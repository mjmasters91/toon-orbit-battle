-- Silver choice was rolling back on hosted Supabase.
-- engine_score clears its scoring table with DELETE FROM es and no WHERE.
-- Supabase rejects that (pg_safeupdate, SQLSTATE 21000, "DELETE requires a WHERE clause").
-- The error fires only when a bot match reaches score, which is the silver move:
-- the player's color is applied, the bot answers, settle calls engine_score, and the
-- whole submit_move rolls back. Place, discard, and swap never call engine_score, so
-- they succeed. The client then restarts the silver phase and bumps the clock, so the
-- timer resets and the color looks unchosen.
-- WHERE true still deletes every scoring row and satisfies the WHERE check.
-- Do not apply from the client. Review this file, then run it in the Supabase SQL editor.

create or replace function public.engine_score(p_state jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r record;
  src record;
  pw jsonb;
  times int;
  kinds int;
  host_pts int := 0;
  guest_pts int := 0;
  host_pen int;
  guest_pen int;
  goals text[] := '{}';
  gcol text;
  bonus_side text := null;
  lead text := null;
  winner text;
  p_count int;
  o_count int;
  g1 text;
  g2 text;
begin
  create temp table if not exists es (
    side text, slot int, cid text, char_name text, grp text, archetype text,
    features text[], powers jsonb, wild boolean, knocked boolean, color text,
    mul numeric, add int, arches text[], pts int, primary key (side, slot)
  ) on commit drop;
  delete from es where true;
  insert into es (side, slot, cid, char_name, grp, archetype, features, powers, wild, knocked, color, mul, add, arches, pts)
  select seat.side, slot.i,
    case when jsonb_typeof(p_state->seat.side->'board'->slot.i) = 'object' then p_state->seat.side->'board'->slot.i->>'id' else null end,
    coalesce(rules.char_name, ''), coalesce(rules.grp, ''), coalesce(rules.archetype, ''),
    coalesce(rules.features, '{}'), coalesce(rules.powers, '[]'::jsonb), coalesce(rules.wild, false),
    false, coalesce(rules_color.color, ''), 1, 0,
    case when coalesce(rules.archetype, '') <> '' then array[rules.archetype] else '{}'::text[] end,
    coalesce(rules_color.pts, 0)
  from (values ('host'), ('guest')) seat(side)
  cross join generate_series(0, 6) slot(i)
  left join public.card_rules rules on rules.id = case when jsonb_typeof(p_state->seat.side->'board'->slot.i) = 'object' then p_state->seat.side->'board'->slot.i->>'id' else null end
  left join public.cards rules_color on rules_color.id = rules.id
  where case when jsonb_typeof(p_state->seat.side->'board'->slot.i) = 'object' then p_state->seat.side->'board'->slot.i->>'id' else null end is not null;

  update es a set knocked = true
  where (select count(*) from es b where b.cid = a.cid) > 1;

  update es a set knocked = true
  where not a.knocked and exists (
    select 1 from es b
    where b.char_name = a.char_name and b.char_name <> '' and b.pts < a.pts and not b.knocked
      and (select count(*) from es c where c.char_name = a.char_name) > 1
  );
  update es a set knocked = true
  where not a.knocked and a.char_name <> '' and (
    select count(*) from es b where b.char_name = a.char_name and b.pts = a.pts
      and not exists (select 1 from es c where c.char_name = a.char_name and c.pts < a.pts)
  ) > 1;

  -- recolor
  for src in select * from es where not knocked loop
    for pw in select value from jsonb_array_elements(src.powers) loop
      if pw->>'type' <> 'recolor' then continue; end if;
      update es t set color = pw->>'color'
      where t.side = src.side and t.slot = any(public.engine_adj(src.slot)) and not t.knocked and t.color is distinct from pw->>'color';
    end loop;
  end loop;
  -- tags
  for src in select * from es where not knocked loop
    for pw in select value from jsonb_array_elements(src.powers) loop
      if pw->>'type' <> 'tag' then continue; end if;
      if coalesce(pw->>'who', 'self') = 'neighbors' then
        update es t set
          wild = t.wild or coalesce((pw->>'all')::boolean, false),
          arches = case when pw ? 'archetype' then t.arches || (pw->>'archetype') else t.arches end
        where t.side = src.side and t.slot = any(public.engine_adj(src.slot)) and not t.knocked;
      else
        update es t set
          wild = t.wild or coalesce((pw->>'all')::boolean, false),
          arches = case when pw ? 'archetype' then t.arches || (pw->>'archetype') else t.arches end
        where t.side = src.side and t.slot = src.slot;
      end if;
    end loop;
  end loop;
  -- boosts
  for src in select * from es where not knocked loop
    for pw in select value from jsonb_array_elements(src.powers) loop
      if pw->>'type' <> 'boost' then continue; end if;
      if pw ? 'cond' then
        if pw->'cond'->>'kind' = 'pure' then
          if (select count(*) from es e where e.side = src.side and not e.knocked) < 2 then continue; end if;
          select count(distinct a) into kinds from es e, unnest(e.arches) a where e.side = src.side and not e.knocked;
          if kinds > 1 then continue; end if;
        elsif pw->'cond'->>'kind' = 'opposite' then
          if not exists (
            select 1 from es e2
            where e2.side = case when src.side = 'host' then 'guest' else 'host' end
              and e2.slot = src.slot and not e2.knocked
              and public.engine_match(e2.features, e2.char_name, e2.grp, e2.color, e2.arches, e2.wild, pw->'cond'->'filter')
          ) then continue; end if;
        else
          if not exists (
            select 1 from es e
            where not e.knocked and (e.side, e.slot) <> (src.side, src.slot)
              and (pw->'cond'->>'kind' <> 'nextTo' or (e.side = src.side and e.slot = any(public.engine_adj(src.slot))))
              and public.engine_match(e.features, e.char_name, e.grp, e.color, e.arches, e.wild, pw->'cond'->'filter')
          ) then continue; end if;
        end if;
      end if;
      times := 1;
      if pw ? 'each' then
        if pw->'each'->>'distinct' = 'archetype' then
          if pw->'each'->>'where' = 'oppSide' then
            select count(distinct a) into kinds from es e, unnest(e.arches) a
            where e.side = case when src.side = 'host' then 'guest' else 'host' end and not e.knocked;
          else
            select count(distinct a) into kinds from es e, unnest(e.arches) a
            where e.side = src.side and not e.knocked;
          end if;
          times := least(4, coalesce(kinds, 0));
        else
          select count(*) into times from es e
          where not e.knocked
            and case pw->'each'->>'where'
              when 'neighbors' then e.side = src.side and e.slot = any(public.engine_adj(src.slot))
              when 'ownSide' then e.side = src.side and (e.side, e.slot) <> (src.side, src.slot)
              when 'oppSide' then e.side = case when src.side = 'host' then 'guest' else 'host' end
              else (e.side, e.slot) <> (src.side, src.slot)
            end
            and public.engine_match(e.features, e.char_name, e.grp, e.color, e.arches, e.wild, pw->'each'->'filter');
        end if;
      end if;
      if times <= 0 then continue; end if;
      update es t set
        mul = case when pw->>'op' = 'mul' then t.mul * power(coalesce((pw->>'n')::numeric, 1), times) else t.mul end,
        add = case when pw->>'op' = 'mul' then t.add else t.add + coalesce((pw->>'n')::int, 0) * times end
      where not t.knocked
        and case coalesce(pw->>'who', 'self')
          when 'self' then t.side = src.side and t.slot = src.slot
          when 'all' then true
          when 'allOther' then (t.side, t.slot) <> (src.side, src.slot)
          when 'neighbors' then t.side = src.side and t.slot = any(public.engine_adj(src.slot))
          when 'opposite' then t.side = case when src.side = 'host' then 'guest' else 'host' end and t.slot = src.slot
          when 'neighborsOrOpposite' then
            (t.side = src.side and t.slot = any(public.engine_adj(src.slot)))
            or (t.side = case when src.side = 'host' then 'guest' else 'host' end and t.slot = src.slot)
          else false
        end
        and (
          coalesce(pw->>'who', 'self') = 'self'
          or public.engine_match(t.features, t.char_name, t.grp, t.color, t.arches, t.wild, pw->'filter')
        );
    end loop;
  end loop;

  -- combos, granted to the lowest printed card on that side
  for src in
    select side from (values ('host'), ('guest')) s(side)
  loop
    declare
      pair record;
      crew record;
      natural_a boolean;
      natural_b boolean;
      has_wild boolean;
    begin
      for pair in select * from public.combo_pairs loop
        select exists(select 1 from es e where e.side = src.side and not e.knocked and not e.wild and pair.a = any(e.arches)) into natural_a;
        select exists(select 1 from es e where e.side = src.side and not e.knocked and not e.wild and pair.b = any(e.arches)) into natural_b;
        select exists(select 1 from es e where e.side = src.side and not e.knocked and e.wild) into has_wild;
        if not ((natural_a and natural_b) or (has_wild and (natural_a <> natural_b))) then continue; end if;
        update es t set add = t.add + pair.bonus
        where t.ctid = (
          select e.ctid from es e
          where e.side = src.side and not e.knocked and (e.wild or pair.a = any(e.arches) or pair.b = any(e.arches))
          order by e.pts, e.slot limit 1
        );
      end loop;
      for crew in select * from public.combo_sets loop
        if (select count(distinct i) from unnest(crew.ids) i where i in (select e.cid from es e where e.side = src.side and not e.knocked)) < array_length(crew.ids, 1) then
          continue;
        end if;
        update es t set add = t.add + crew.bonus
        where t.ctid = (
          select e.ctid from es e
          where e.side = src.side and not e.knocked and e.cid = any(crew.ids)
          order by e.pts, e.slot limit 1
        );
      end loop;
    end;
  end loop;

  select coalesce(sum(greatest(0, round(pts * mul + add))), 0) into host_pts from es where side = 'host' and not knocked;
  select coalesce(sum(greatest(0, round(pts * mul + add))), 0) into guest_pts from es where side = 'guest' and not knocked;
  host_pen := coalesce((p_state->'host'->>'penalty')::int, 0);
  guest_pen := coalesce((p_state->'guest'->>'penalty')::int, 0);
  host_pts := host_pts - host_pen;
  guest_pts := guest_pts - guest_pen;

  -- goal colors from the goal cards, skipping black and silver
  for r in select side from (values ('host'), ('guest')) s(side) loop
    select c.color into gcol from public.cards c
    where c.id = p_state->r.side->'goal'->>'id';
    if gcol is not null and gcol not in ('black', 'silver') and not (gcol = any(goals)) then
      goals := goals || gcol;
    end if;
  end loop;

  if coalesce(array_length(goals, 1), 0) = 1 then
    select count(*) into p_count from es e where e.side = 'host' and not e.knocked and (
      case when e.color = 'silver' and coalesce(p_state->'host'->>'silver', '') <> '' then p_state->'host'->>'silver' else e.color end
    ) = goals[1];
    select count(*) into o_count from es e where e.side = 'guest' and not e.knocked and (
      case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver', '') <> '' then p_state->'guest'->>'silver' else e.color end
    ) = goals[1];
    if p_count > o_count then host_pts := host_pts + 15; bonus_side := 'host';
    elsif o_count > p_count then guest_pts := guest_pts + 15; bonus_side := 'guest'; end if;
  elsif coalesce(array_length(goals, 1), 0) = 2 then
    g1 := goals[1]; g2 := goals[2];
    if (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g1)
       > (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g1)
      and (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g2)
       > (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g2)
    then lead := 'host';
    elsif (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g1)
       > (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g1)
      and (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g2)
       > (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g2)
    then lead := 'guest';
    end if;
    if lead is not null then
      winner := lead;
    end if;
  end if;
  if winner is null then
    if host_pts > guest_pts then winner := 'host';
    elsif guest_pts > host_pts then winner := 'guest';
    else winner := 'tie'; end if;
  end if;
  return jsonb_build_object('host', host_pts, 'guest', guest_pts, 'winner', winner, 'bonus', bonus_side, 'lead', lead);
end;
$$;


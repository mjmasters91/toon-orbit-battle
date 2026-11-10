-- Aetherfall story battles. Not applied.
-- Review this file, then run it in the Supabase SQL editor for project orbzytpukjywqkbkbtcs.
-- It does not alter Toon Orbit Battle tables. It does not change the signature of af_state_json.
-- It adds af_progress plus af_clear_stage and af_get_progress.
-- Hosted Supabase rejects DELETE and UPDATE with no WHERE. This file has neither.

create table if not exists public.af_progress (
  user_id uuid not null references public.af_players (id) on delete cascade,
  difficulty text not null check (difficulty in ('normal', 'hard', 'nightmare')),
  map_index int not null check (map_index between 0 and 4),
  stage int not null check (stage between 1 and 26),
  stars int not null check (stars between 1 and 3),
  best_turns int not null check (best_turns between 1 and 80),
  clears int not null default 1 check (clears >= 1),
  first_cleared_at timestamptz not null default now(),
  last_clear_at timestamptz not null default now(),
  primary key (user_id, difficulty, map_index, stage)
);

alter table public.af_progress enable row level security;

drop policy if exists af_progress_select_own on public.af_progress;
create policy af_progress_select_own
  on public.af_progress
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.af_progress from public, anon, authenticated;
grant select on table public.af_progress to authenticated;

-- Mirrors stages.js clearGold: round(base * mult * boss * star / 1000000)
-- mult 100 / 225 / 450, boss 160 or 100, star 100 / 115 / 130.
create or replace function public.af_clear_gold(p_difficulty text, p_map int, p_stage int, p_stars int)
returns int
language sql
immutable
as $$
  select least(999999, (
    (80 + p_map * 40 + p_stage * 10)::bigint
    * (case p_difficulty when 'hard' then 225 when 'nightmare' then 450 else 100 end)
    * (case when p_stage in (13, 26) then 160 else 100 end)
    * (100 + (p_stars - 1) * 15)
    + 500000
  ) / 1000000)::int;
$$;

create or replace function public.af_clear_stage(
  p_difficulty text,
  p_map int,
  p_stage int,
  p_stars int,
  p_turns int,
  p_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player public.af_players;
  gate text;
  prior boolean;
  gained_gems int := 0;
  gained_gold int := 0;
  stored_stars int;
  first_clear boolean := false;
  row_stars int;
  lim int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if p_difficulty not in ('normal', 'hard', 'nightmare')
     or p_map is null or p_map < 0 or p_map > 4
     or p_stage is null or p_stage < 1 or p_stage > 26 then
    raise exception 'Unknown stage.';
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 3 then
    raise exception 'Stars must be between 1 and 3.';
  end if;
  if p_turns is null or p_turns < 1 or p_turns > 80 then
    raise exception 'That turn count is not plausible.';
  end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 7200 then
    raise exception 'That clear was too fast to count.';
  end if;

  lim := case when p_stage in (13, 26) then 18 else 14 end;
  stored_stars := p_stars;
  if stored_stars = 3 and p_turns > lim then
    stored_stars := 2;
  end if;

  select * into player
  from public.af_players
  where id = auth.uid()
  for update;
  if player.id is null then
    raise exception 'Create your Aetherfall save before clearing a stage.';
  end if;
  perform public.af_reject_banned(player);

  if p_difficulty = 'hard' then
    gate := 'normal';
  elsif p_difficulty = 'nightmare' then
    gate := 'hard';
  else
    gate := null;
  end if;

  if gate is not null then
    select exists (
      select 1 from public.af_progress g
      where g.user_id = player.id
        and g.difficulty = gate
        and g.map_index = p_map
        and g.stage = 26
    ) into prior;
    if not prior then
      raise exception 'That difficulty is still locked.';
    end if;
  end if;

  if p_stage > 1 then
    select exists (
      select 1 from public.af_progress g
      where g.user_id = player.id
        and g.difficulty = p_difficulty
        and g.map_index = p_map
        and g.stage = p_stage - 1
    ) into prior;
    if not prior then
      raise exception 'Clear the previous stage first.';
    end if;
  end if;

  select stars into row_stars
  from public.af_progress
  where user_id = player.id
    and difficulty = p_difficulty
    and map_index = p_map
    and stage = p_stage
  for update;

  if found then
    if now() - (select last_clear_at from public.af_progress
                where user_id = player.id
                  and difficulty = p_difficulty
                  and map_index = p_map
                  and stage = p_stage) < interval '10 seconds' then
      raise exception 'Wait a moment before clearing that stage again.';
    end if;
    update public.af_progress
    set stars = greatest(stars, stored_stars),
        best_turns = case
          when stored_stars > stars then p_turns
          when stored_stars = stars then least(best_turns, p_turns)
          else best_turns
        end,
        clears = clears + 1,
        last_clear_at = now()
    where user_id = player.id
      and difficulty = p_difficulty
      and map_index = p_map
      and stage = p_stage;
  else
    first_clear := true;
    gained_gems := case p_difficulty when 'hard' then 100 when 'nightmare' then 150 else 50 end;
    if p_stage in (13, 26) then
      gained_gems := gained_gems * 2;
    end if;
    insert into public.af_progress (user_id, difficulty, map_index, stage, stars, best_turns)
    values (player.id, p_difficulty, p_map, p_stage, stored_stars, p_turns);
  end if;

  gained_gold := public.af_clear_gold(p_difficulty, p_map, p_stage, stored_stars);
  update public.af_players
  set gems = least(9999999, gems + gained_gems),
      gold = least(9999999, gold + gained_gold)
  where id = player.id;

  return jsonb_build_object(
    'first', first_clear,
    'stars', stored_stars,
    'gems_gained', gained_gems,
    'gold_gained', gained_gold,
    'gems', (select gems from public.af_players where id = player.id),
    'gold', (select gold from public.af_players where id = player.id),
    'progress', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'difficulty', difficulty,
        'map', map_index,
        'stage', stage,
        'stars', stars,
        'turns', best_turns
      ) order by difficulty, map_index, stage), '[]'::jsonb)
      from public.af_progress
      where user_id = player.id
    )
  );
end;
$$;

create or replace function public.af_get_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  player public.af_players;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  select * into player from public.af_players where id = auth.uid();
  if player.id is null then
    return '[]'::jsonb;
  end if;
  perform public.af_reject_banned(player);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'difficulty', difficulty,
      'map', map_index,
      'stage', stage,
      'stars', stars,
      'turns', best_turns
    ) order by difficulty, map_index, stage)
    from public.af_progress
    where user_id = player.id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.af_clear_gold(text, int, int, int) from public, anon, authenticated;
revoke all on function public.af_clear_stage(text, int, int, int, int, int) from public, anon;
revoke all on function public.af_get_progress() from public, anon;

grant execute on function public.af_clear_stage(text, int, int, int, int, int) to authenticated;
grant execute on function public.af_get_progress() to authenticated;

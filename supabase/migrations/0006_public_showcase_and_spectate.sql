-- Public showcase, live spectating, and friend-request actions.
-- Do not apply from the client. Run this in the Supabase SQL editor.
-- Spectators never receive hands, unplayed decks, seeds, or move logs.
-- A public mirror table is what Realtime delivers. The matches row stays
-- visible only to the two players.

alter table public.matches add column if not exists is_public boolean not null default true;

-- ---------- cosmetics: ob_* and admin-only cards stay off public profiles ----------
create or replace function public.set_showcase(p_ids jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  clean jsonb := '[]'::jsonb;
  elem text;
begin
  if jsonb_typeof(p_ids) = 'array' then
    for elem in select jsonb_array_elements_text(p_ids) loop
      if elem like 'ob_%' or exists (select 1 from public.cards c where c.id = elem and c.admin_only) then
        raise exception 'That card cannot be shown publicly.';
      end if;
      if exists (select 1 from public.cards where id = elem)
         and not exists (select 1 from jsonb_array_elements_text(clean) x where x = elem)
         and jsonb_array_length(clean) < 6 then
        clean := clean || to_jsonb(elem);
      end if;
    end loop;
  end if;
  update public.profiles set showcase = clean where id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_avatar(p_card text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
begin
  if p_card like 'ob_%' or exists (select 1 from public.cards c where c.id = p_card and c.admin_only) then
    raise exception 'That card cannot be shown publicly.';
  end if;
  if p_card is not null and p_card <> '' and not exists (select 1 from public.cards where id = p_card) then
    raise exception 'Unknown card.';
  end if;
  update public.profiles set avatar = nullif(p_card, '') where id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.set_showcase(jsonb) from public, anon;
grant execute on function public.set_showcase(jsonb) to authenticated;
revoke execute on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;

-- ---------- private rooms and challenges; quick match stays public ----------
drop function if exists public.create_room(jsonb);
create or replace function public.create_room(p_deck jsonb, p_private boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  me public.profiles;
  code text;
  mid uuid;
begin
  perform public.assert_pvp_deck(uid, p_deck);
  select * into me from public.profiles where id = uid;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
  insert into public.matches (code, kind, host, host_name, host_avatar, host_deck, status, is_public, expires_at)
  values (code, 'room', uid, me.username, me.avatar, p_deck, 'lobby', not coalesce(p_private, false), now() + interval '10 minutes')
  returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid, 'code', code);
end;
$$;

drop function if exists public.create_challenge(text, jsonb);
create or replace function public.create_challenge(p_username text, p_deck jsonb, p_private boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  me public.profiles;
  other uuid;
  mid uuid;
begin
  perform public.assert_pvp_deck(uid, p_deck);
  select id into other from public.profiles where lower(username) = lower(trim(p_username));
  if other is null then raise exception 'No account with that username.'; end if;
  if other = uid then raise exception 'That’s you.'; end if;
  select * into me from public.profiles where id = uid;
  insert into public.matches (kind, host, host_name, host_avatar, host_deck, status, is_public, expires_at)
  values ('friend', uid, me.username, me.avatar, p_deck, 'lobby', not coalesce(p_private, false), now() + interval '10 minutes')
  returning id into mid;
  insert into public.match_invites (match_id, from_id, to_id) values (mid, uid, other);
  return jsonb_build_object('ok', true, 'id', mid);
end;
$$;

revoke execute on function public.create_room(jsonb, boolean) from public, anon;
grant execute on function public.create_room(jsonb, boolean) to authenticated;
revoke execute on function public.create_challenge(text, jsonb, boolean) from public, anon;
grant execute on function public.create_challenge(text, jsonb, boolean) to authenticated;

-- ---------- sanitized board helpers (not callable by clients) ----------
create or replace function public.public_avatar(p_card text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_card is null or p_card = '' or p_card like 'ob_%' then null
    when exists (select 1 from public.cards c where c.id = p_card and c.admin_only) then null
    else p_card
  end;
$$;

create or replace function public.public_board(p_board jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  out jsonb := '[]'::jsonb;
  elem jsonb;
  cid text;
begin
  if jsonb_typeof(p_board) is distinct from 'array' then
    return out;
  end if;
  for elem in select value from jsonb_array_elements(p_board) loop
    cid := case when jsonb_typeof(elem) = 'object' then elem->>'id' else null end;
    if cid is null or cid like 'ob_%' then
      out := out || jsonb_build_array('null'::jsonb);
    else
      out := out || jsonb_build_array(jsonb_build_object(
        'id', cid,
        'gold', coalesce((elem->>'gold')::boolean, false)
      ));
    end if;
  end loop;
  return out;
end;
$$;

create or replace function public.public_seat(p_side jsonb, p_phase text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  revealed boolean := p_phase = 'score';
  silver_on boolean := coalesce((p_side->>'silverDone')::boolean, false);
begin
  return jsonb_build_object(
    'board', public.public_board(p_side->'board'),
    'silver', case when silver_on then p_side->>'silver' else null end,
    'goalColor', case when revealed then (
      select c.color from public.cards c where c.id = p_side->'goal'->>'id' and c.id not like 'ob_%' and not c.admin_only
    ) else null end
  );
end;
$$;

revoke execute on function public.public_avatar(text) from public, anon, authenticated;
revoke execute on function public.public_board(jsonb) from public, anon, authenticated;
revoke execute on function public.public_seat(jsonb, text) from public, anon, authenticated;

-- ---------- public mirror used only as a Realtime signal ----------
create table if not exists public.match_public (
  id uuid primary key references public.matches(id) on delete cascade,
  host_name text not null default '',
  guest_name text not null default '',
  host_avatar text,
  guest_avatar text,
  phase text,
  host_board jsonb not null default '[]'::jsonb,
  guest_board jsonb not null default '[]'::jsonb,
  host_silver text,
  guest_silver text,
  host_goal_color text,
  guest_goal_color text,
  status text not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.match_public replica identity full;
alter table public.match_public enable row level security;
drop policy if exists match_public_read on public.match_public;
create policy match_public_read on public.match_public for select to anon, authenticated
  using (is_public and status = 'active');
revoke all on public.match_public from anon, authenticated;
grant select on public.match_public to anon, authenticated;

create or replace function public.publish_match(m public.matches)
returns void language plpgsql security definer set search_path = public as $$
declare
  phase text := m.state->>'phase';
  host_side jsonb;
  guest_side jsonb;
begin
  if m.status is distinct from 'active' or not coalesce(m.is_public, true) or m.guest is null then
    delete from public.match_public where id = m.id;
    return;
  end if;
  host_side := public.public_seat(m.state->'host', phase);
  guest_side := public.public_seat(m.state->'guest', phase);
  insert into public.match_public (
    id, host_name, guest_name, host_avatar, guest_avatar, phase,
    host_board, guest_board, host_silver, guest_silver, host_goal_color, guest_goal_color,
    status, is_public, updated_at
  ) values (
    m.id, m.host_name, coalesce(m.guest_name, ''),
    public.public_avatar(m.host_avatar), public.public_avatar(m.guest_avatar), phase,
    host_side->'board', guest_side->'board', host_side->>'silver', guest_side->>'silver',
    host_side->>'goalColor', guest_side->>'goalColor',
    m.status, true, now()
  )
  on conflict (id) do update set
    host_name = excluded.host_name,
    guest_name = excluded.guest_name,
    host_avatar = excluded.host_avatar,
    guest_avatar = excluded.guest_avatar,
    phase = excluded.phase,
    host_board = excluded.host_board,
    guest_board = excluded.guest_board,
    host_silver = excluded.host_silver,
    guest_silver = excluded.guest_silver,
    host_goal_color = excluded.host_goal_color,
    guest_goal_color = excluded.guest_goal_color,
    status = excluded.status,
    is_public = excluded.is_public,
    updated_at = excluded.updated_at;
end;
$$;

revoke execute on function public.publish_match(public.matches) from public, anon, authenticated;

create or replace function public.sync_match_public()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.publish_match(new);
  return new;
end;
$$;

revoke execute on function public.sync_match_public() from public, anon, authenticated;

drop trigger if exists matches_public_sync on public.matches;
create trigger matches_public_sync
after insert or update on public.matches
for each row execute function public.sync_match_public();

insert into public.match_public (
  id, host_name, guest_name, host_avatar, guest_avatar, phase,
  host_board, guest_board, host_silver, guest_silver, host_goal_color, guest_goal_color,
  status, is_public, updated_at
)
select
  m.id, m.host_name, coalesce(m.guest_name, ''),
  public.public_avatar(m.host_avatar), public.public_avatar(m.guest_avatar), m.state->>'phase',
  (public.public_seat(m.state->'host', m.state->>'phase'))->'board',
  (public.public_seat(m.state->'guest', m.state->>'phase'))->'board',
  public.public_seat(m.state->'host', m.state->>'phase')->>'silver',
  public.public_seat(m.state->'guest', m.state->>'phase')->>'silver',
  public.public_seat(m.state->'host', m.state->>'phase')->>'goalColor',
  public.public_seat(m.state->'guest', m.state->>'phase')->>'goalColor',
  m.status, true, now()
from public.matches m
where m.status = 'active' and coalesce(m.is_public, true) and m.guest is not null
on conflict (id) do nothing;

-- ---------- spectator presence ----------
create table if not exists public.spectator_pings (
  match_id uuid not null references public.matches(id) on delete cascade,
  viewer text not null,
  seen timestamptz not null default now(),
  primary key (match_id, viewer)
);
alter table public.spectator_pings enable row level security;
revoke all on public.spectator_pings from anon, authenticated;

create or replace function public.list_live_matches()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(s.item order by s.updated_at desc), '[]'::jsonb)
  from (
    select m.updated_at, jsonb_build_object(
      'id', m.id,
      'host_name', m.host_name,
      'guest_name', m.guest_name,
      'host_avatar', public.public_avatar(m.host_avatar),
      'guest_avatar', public.public_avatar(m.guest_avatar),
      'phase', m.state->>'phase',
      'host_board', public.public_board(m.state->'host'->'board'),
      'guest_board', public.public_board(m.state->'guest'->'board'),
      'host_silver', case when coalesce((m.state->'host'->>'silverDone')::boolean, false) then m.state->'host'->>'silver' else null end,
      'guest_silver', case when coalesce((m.state->'guest'->>'silverDone')::boolean, false) then m.state->'guest'->>'silver' else null end,
      'host_goal', case when m.state->>'phase' = 'score' then (public.public_seat(m.state->'host', 'score')->>'goalColor') else null end,
      'guest_goal', case when m.state->>'phase' = 'score' then (public.public_seat(m.state->'guest', 'score')->>'goalColor') else null end
    ) as item
    from public.matches m
    where m.status = 'active' and coalesce(m.is_public, true) and m.guest is not null
    order by m.updated_at desc
    limit 5
  ) s;
$$;

create or replace function public.spectate_match(p_match uuid, p_viewer text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  phase text;
  viewer text;
  n int;
  host_side jsonb;
  guest_side jsonb;
begin
  select * into m from public.matches where id = p_match;
  if m.id is null or m.status is distinct from 'active' or not coalesce(m.is_public, true) or m.guest is null then
    raise exception 'That match is not open to spectators.';
  end if;
  viewer := left(regexp_replace(coalesce(p_viewer, ''), '[^a-zA-Z0-9]', '', 'g'), 24);
  if viewer = '' then viewer := 'anon'; end if;
  insert into public.spectator_pings (match_id, viewer, seen)
  values (m.id, viewer, now())
  on conflict (match_id, viewer) do update set seen = now();
  delete from public.spectator_pings where seen < now() - interval '10 minutes';
  select count(*) into n from public.spectator_pings
  where match_id = m.id and seen > now() - interval '45 seconds';
  phase := m.state->>'phase';
  host_side := public.public_seat(m.state->'host', phase);
  guest_side := public.public_seat(m.state->'guest', phase);
  return jsonb_build_object(
    'id', m.id,
    'phase', phase,
    'spectators', n,
    'host', jsonb_build_object(
      'name', m.host_name,
      'avatar', public.public_avatar(m.host_avatar),
      'board', host_side->'board',
      'silver', host_side->>'silver',
      'goalColor', host_side->>'goalColor'
    ),
    'guest', jsonb_build_object(
      'name', m.guest_name,
      'avatar', public.public_avatar(m.guest_avatar),
      'board', guest_side->'board',
      'silver', guest_side->>'silver',
      'goalColor', guest_side->>'goalColor'
    )
  );
end;
$$;

revoke execute on function public.list_live_matches() from public;
grant execute on function public.list_live_matches() to anon, authenticated;
revoke execute on function public.spectate_match(uuid, text) from public;
grant execute on function public.spectate_match(uuid, text) to anon, authenticated;

-- ---------- friend requests: decline, cancel, and live badges ----------
create or replace function public.decline_friend_request(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  req public.friend_requests;
begin
  select * into req from public.friend_requests where id = p_id for update;
  if req.id is null or req.to_id <> uid or req.status <> 'pending' then
    raise exception 'That request is not waiting for you.';
  end if;
  update public.friend_requests set status = 'declined' where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cancel_friend_request(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  req public.friend_requests;
begin
  select * into req from public.friend_requests where id = p_id for update;
  if req.id is null or req.from_id <> uid or req.status <> 'pending' then
    raise exception 'That request is not yours to cancel.';
  end if;
  update public.friend_requests set status = 'declined' where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.decline_friend_request(uuid) from public, anon;
grant execute on function public.decline_friend_request(uuid) to authenticated;
revoke execute on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

alter table public.friend_requests replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.bids;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.match_public;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.friend_requests;
  exception when duplicate_object or undefined_object then null;
  end;
end $$;

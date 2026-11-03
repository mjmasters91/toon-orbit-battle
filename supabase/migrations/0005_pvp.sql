-- Live PvP. Only the two players can read a match. Coins move inside
-- security-definer functions. New functions follow the 0002 pattern:
-- revoke execute from public and anon, then grant only to authenticated.
-- Do not apply from the client. Run this in the Supabase SQL editor.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  kind text not null default 'room',
  host uuid not null references public.profiles(id) on delete cascade,
  guest uuid references public.profiles(id) on delete cascade,
  host_name text not null default '',
  guest_name text not null default '',
  host_avatar text,
  guest_avatar text,
  status text not null default 'lobby',
  host_deck jsonb,
  guest_deck jsonb,
  seed int not null default 1,
  state jsonb not null default '{}'::jsonb,
  moves jsonb not null default '[]'::jsonb,
  turn_deadline timestamptz,
  host_seen timestamptz not null default now(),
  guest_seen timestamptz,
  winner uuid,
  result text,
  host_report jsonb,
  guest_report jsonb,
  coins_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  check (status in ('lobby', 'active', 'finished', 'disputed', 'cancelled', 'expired'))
);

create table if not exists public.match_invites (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  check (status in ('pending', 'accepted', 'declined', 'cancelled'))
);

create table if not exists public.pvp_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  deck jsonb not null,
  joined_at timestamptz not null default now()
);

create table if not exists public.pvp_results (
  id bigserial primary key,
  match_id uuid references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  opponent uuid references public.profiles(id) on delete set null,
  result text not null,
  coins int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.matches enable row level security;
alter table public.match_invites enable row level security;
alter table public.pvp_queue enable row level security;
alter table public.pvp_results enable row level security;

drop policy if exists matches_players on public.matches;
create policy matches_players on public.matches for select to authenticated
  using (host = auth.uid() or guest = auth.uid());
drop policy if exists invites_parties on public.match_invites;
create policy invites_parties on public.match_invites for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists queue_own on public.pvp_queue;
create policy queue_own on public.pvp_queue for select to authenticated
  using (user_id = auth.uid());
drop policy if exists results_own on public.pvp_results;
create policy results_own on public.pvp_results for select to authenticated
  using (user_id = auth.uid());

revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;
revoke all on public.match_invites from anon, authenticated;
grant select on public.match_invites to authenticated;
revoke all on public.pvp_queue from anon, authenticated;
grant select on public.pvp_queue to authenticated;
revoke all on public.pvp_results from anon, authenticated;
grant select on public.pvp_results to authenticated;

-- Deck must be 12 owned, non-Obsidian cards. Counts come from the server collection.
create or replace function public.assert_pvp_deck(p_user uuid, p_deck jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
  elem jsonb;
  cid text;
  is_gold boolean;
  need int;
  have int;
begin
  if jsonb_typeof(p_deck) is distinct from 'array' then
    raise exception 'Choose a 12-card deck.';
  end if;
  n := jsonb_array_length(p_deck);
  if n <> 12 then
    raise exception 'A PvP deck is exactly 12 cards.';
  end if;
  for elem in select value from jsonb_array_elements(p_deck) loop
    cid := elem->>'id';
    is_gold := coalesce((elem->>'gold')::boolean, false);
    if cid is null or cid like 'ob_%' or exists (select 1 from public.cards c where c.id = cid and c.admin_only) then
      raise exception 'Obsidian cards are not allowed in PvP.';
    end if;
    if not exists (select 1 from public.cards c where c.id = cid and not c.admin_only) then
      raise exception 'Unknown card.';
    end if;
  end loop;
  for cid, is_gold, need in
    select e->>'id', coalesce((e->>'gold')::boolean, false), count(*)::int
    from jsonb_array_elements(p_deck) e
    group by 1, 2
  loop
    select count into have from public.collection
    where user_id = p_user and card_id = cid and gold = is_gold;
    if coalesce(have, 0) < need then
      raise exception 'That deck uses cards you do not own.';
    end if;
  end loop;
end;
$$;

create or replace function public.pvp_rng(p_state bigint)
returns bigint language sql immutable as $$
  select ((1664525::bigint * (p_state % 4294967296) + 1013904223) % 4294967296);
$$;

create or replace function public.pvp_deal(p_deck jsonb, p_seed int)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  play jsonb := '[]'::jsonb;
  goal jsonb;
  i int;
  j int;
  s bigint := (p_seed::bigint % 4294967296);
  tmp jsonb;
  hand jsonb;
  rest jsonb;
begin
  if jsonb_array_length(p_deck) <> 12 then
    raise exception 'A PvP deck is exactly 12 cards.';
  end if;
  goal := p_deck->11;
  for i in 0..10 loop
    play := play || jsonb_build_array(p_deck->i);
  end loop;
  for i in reverse 10..1 loop
    s := public.pvp_rng(s);
    j := ((s * (i + 1)) / 4294967296)::int;
    tmp := play->i;
    play := jsonb_set(play, array[i::text], play->j, false);
    play := jsonb_set(play, array[j::text], tmp, false);
  end loop;
  hand := '[]'::jsonb;
  for i in 0..5 loop
    hand := hand || jsonb_build_array(play->i);
  end loop;
  rest := '[]'::jsonb;
  for i in 6..10 loop
    rest := rest || jsonb_build_array(play->i);
  end loop;
  return jsonb_build_object(
    'hand', hand,
    'deck', rest,
    'goal', goal,
    'board', jsonb_build_array(null, null, null, null, null, null, null),
    'discarded', false,
    'silver', null,
    'silverDone', false
  );
end;
$$;

create or replace function public.pvp_open_state(p_host jsonb, p_guest jsonb, p_seed int)
returns jsonb language plpgsql immutable set search_path = public as $$
begin
  return jsonb_build_object(
    'phase', 'place1',
    'turn', 'host',
    'seq', 0,
    'host', public.pvp_deal(p_host, p_seed),
    'guest', public.pvp_deal(p_guest, p_seed + 1)
  );
end;
$$;

create or replace function public.pvp_reward(p_winner uuid, p_loser uuid, p_match uuid, p_result text)
returns int language plpgsql security definer set search_path = public as $$
declare
  payout int := 0;
  paid int;
  cap int := 3;
begin
  if p_result = 'win' then
    payout := public.setting('win_coins', 100);
    select count(*) into paid from public.pvp_results
    where user_id = p_winner and opponent = p_loser and coins > 0
      and created_at > now() - interval '1 day';
    if paid >= cap then payout := 0; end if;
    update public.profiles set wins = wins + 1, games = games + 1, coins = public.profiles.coins + payout where id = p_winner;
    if p_loser is not null then
      update public.profiles set losses = losses + 1, games = games + 1 where id = p_loser;
    end if;
  elsif p_result = 'tie' then
    payout := 0;
    update public.profiles set games = games + 1 where id = p_winner;
    if p_loser is not null then
      update public.profiles set games = games + 1 where id = p_loser;
    end if;
  end if;
  insert into public.pvp_results (match_id, user_id, opponent, result, coins)
  values (p_match, p_winner, p_loser, p_result, payout);
  if p_result = 'win' and p_loser is not null then
    insert into public.pvp_results (match_id, user_id, opponent, result, coins)
    values (p_match, p_loser, p_winner, 'loss', 0);
  elsif p_result = 'tie' and p_loser is not null then
    insert into public.pvp_results (match_id, user_id, opponent, result, coins)
    values (p_match, p_loser, p_winner, 'tie', 0);
  end if;
  return payout;
end;
$$;

create or replace function public.create_room(p_deck jsonb)
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
  insert into public.matches (code, kind, host, host_name, host_avatar, host_deck, status, expires_at)
  values (code, 'room', uid, me.username, me.avatar, p_deck, 'lobby', now() + interval '10 minutes')
  returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid, 'code', code);
end;
$$;

create or replace function public.join_room(p_code text, p_deck jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  me public.profiles;
  m public.matches;
  st jsonb;
begin
  perform public.assert_pvp_deck(uid, p_deck);
  select * into m from public.matches where code = upper(trim(p_code)) for update;
  if m.id is null or m.status <> 'lobby' then raise exception 'That room is not open.'; end if;
  if m.expires_at < now() then
    update public.matches set status = 'expired' where id = m.id;
    raise exception 'That room expired.';
  end if;
  if m.host = uid then raise exception 'You are already in this room.'; end if;
  select * into me from public.profiles where id = uid;
  st := public.pvp_open_state(m.host_deck, p_deck, m.seed);
  update public.matches set
    guest = uid, guest_name = me.username, guest_avatar = me.avatar, guest_deck = p_deck,
    status = 'active', state = st, guest_seen = now(), turn_deadline = now() + interval '60 seconds', updated_at = now()
  where id = m.id;
  return jsonb_build_object('ok', true, 'id', m.id);
end;
$$;

create or replace function public.cancel_lobby(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
begin
  update public.matches set status = 'cancelled', updated_at = now()
  where id = p_match and host = uid and status = 'lobby';
  update public.match_invites set status = 'cancelled' where match_id = p_match and status = 'pending';
  delete from public.pvp_queue where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.create_challenge(p_username text, p_deck jsonb)
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
  insert into public.matches (kind, host, host_name, host_avatar, host_deck, status, expires_at)
  values ('friend', uid, me.username, me.avatar, p_deck, 'lobby', now() + interval '10 minutes')
  returning id into mid;
  insert into public.match_invites (match_id, from_id, to_id) values (mid, uid, other);
  return jsonb_build_object('ok', true, 'id', mid);
end;
$$;

create or replace function public.respond_invite(p_invite uuid, p_accept boolean, p_deck jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  inv public.match_invites;
  m public.matches;
  me public.profiles;
  st jsonb;
begin
  select * into inv from public.match_invites where id = p_invite for update;
  if inv.id is null or inv.to_id <> uid or inv.status <> 'pending' then
    raise exception 'That invite is not waiting for you.';
  end if;
  select * into m from public.matches where id = inv.match_id for update;
  if m.status <> 'lobby' or m.expires_at < now() then
    update public.match_invites set status = 'cancelled' where id = inv.id;
    raise exception 'That challenge expired.';
  end if;
  if not coalesce(p_accept, false) then
    update public.match_invites set status = 'declined' where id = inv.id;
    update public.matches set status = 'cancelled', updated_at = now() where id = m.id;
    return jsonb_build_object('ok', true, 'declined', true);
  end if;
  perform public.assert_pvp_deck(uid, p_deck);
  select * into me from public.profiles where id = uid;
  st := public.pvp_open_state(m.host_deck, p_deck, m.seed);
  update public.matches set
    guest = uid, guest_name = me.username, guest_avatar = me.avatar, guest_deck = p_deck,
    status = 'active', state = st, guest_seen = now(), turn_deadline = now() + interval '60 seconds', updated_at = now()
  where id = m.id;
  update public.match_invites set status = 'accepted' where id = inv.id;
  return jsonb_build_object('ok', true, 'id', m.id);
end;
$$;

create or replace function public.enqueue_pvp(p_deck jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  me public.profiles;
  other uuid;
  other_deck jsonb;
  mid uuid;
  seed int;
  st jsonb;
begin
  perform public.assert_pvp_deck(uid, p_deck);
  select * into me from public.profiles where id = uid;
  select q.user_id, q.deck into other, other_deck
  from public.pvp_queue q
  where q.user_id <> uid
  order by q.joined_at
  for update skip locked
  limit 1;
  if other is null then
    insert into public.pvp_queue (user_id, deck) values (uid, p_deck)
    on conflict (user_id) do update set deck = excluded.deck, joined_at = now();
    return jsonb_build_object('ok', true, 'queued', true);
  end if;
  delete from public.pvp_queue where user_id in (uid, other);
  seed := floor(random() * 2000000000)::int;
  st := public.pvp_open_state(other_deck, p_deck, seed);
  insert into public.matches (kind, host, guest, host_name, guest_name, host_avatar, guest_avatar, host_deck, guest_deck, seed, status, state, guest_seen, turn_deadline, expires_at)
  select 'queue', other, uid, h.username, me.username, h.avatar, me.avatar, other_deck, p_deck, seed, 'active', st, now(), now() + interval '60 seconds', now() + interval '10 minutes'
  from public.profiles h where h.id = other
  returning id into mid;
  return jsonb_build_object('ok', true, 'queued', false, 'id', mid);
end;
$$;

create or replace function public.dequeue_pvp()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
begin
  delete from public.pvp_queue where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.pvp_slots_full(p_state jsonb, p_phase text)
returns boolean language plpgsql immutable as $$
declare
  seats text[] := array['host', 'guest'];
  seat text;
  slot int;
  lo int;
  hi int;
begin
  if p_phase = 'place1' then lo := 0; hi := 3; else lo := 4; hi := 6; end if;
  foreach seat in array seats loop
    for slot in lo..hi loop
      if (p_state->seat->'board')->slot = 'null'::jsonb or (p_state->seat->'board')->slot is null then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

create or replace function public.submit_move(p_match uuid, p_move jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  m public.matches;
  seat text;
  opp text;
  phase text;
  turn text;
  st jsonb;
  side jsonb;
  hand jsonb;
  board jsonb;
  slot int;
  hand_i int;
  card jsonb;
  i int;
  newhand jsonb;
  elem jsonb;
  ord int;
  draw jsonb;
  idxs int[];
  filled boolean;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or m.status <> 'active' then raise exception 'That match is not in progress.'; end if;
  if m.host = uid then seat := 'host'; opp := 'guest';
  elsif m.guest = uid then seat := 'guest'; opp := 'host';
  else raise exception 'You are not in this match.'; end if;
  st := m.state;
  phase := st->>'phase';
  turn := st->>'turn';
  if turn is distinct from seat then raise exception 'Not your turn.'; end if;
  if m.turn_deadline is not null and now() > m.turn_deadline then
    raise exception 'Turn expired.';
  end if;
  if (p_move->>'t') = 'place' then
    slot := (p_move->>'slot')::int;
    hand_i := (p_move->>'hand')::int;
    if phase = 'place1' and slot not between 0 and 3 then raise exception 'That slot is closed.'; end if;
    if phase = 'place2' and slot not between 4 and 6 then raise exception 'That slot is closed.'; end if;
    if phase not in ('place1', 'place2') then raise exception 'You cannot place a card now.'; end if;
    side := st->seat;
    board := side->'board';
    hand := side->'hand';
    if board->slot is not null and board->slot <> 'null'::jsonb then raise exception 'That slot is full.'; end if;
    if hand_i is null or hand_i < 0 or hand_i >= jsonb_array_length(hand) then raise exception 'Pick a card in your hand.'; end if;
    card := hand->hand_i;
    newhand := '[]'::jsonb;
    ord := 0;
    for elem in select value from jsonb_array_elements(hand) loop
      if ord <> hand_i then newhand := newhand || jsonb_build_array(elem); end if;
      ord := ord + 1;
    end loop;
    board := jsonb_set(board, array[slot::text], card, true);
    side := jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true);
    st := jsonb_set(st, array[seat], side, true);
    filled := public.pvp_slots_full(st, phase);
    if filled and phase = 'place1' then
      st := jsonb_set(st, '{phase}', '"discard"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    elsif filled and phase = 'place2' then
      st := jsonb_set(st, '{phase}', '"silver"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    end if;
  elsif (p_move->>'t') = 'discard' then
    if phase <> 'discard' then raise exception 'You cannot discard now.'; end if;
    if coalesce((st->seat->>'discarded')::boolean, false) then raise exception 'You already discarded.'; end if;
    select coalesce(array_agg(distinct (value)::int), '{}') into idxs
    from jsonb_array_elements_text(coalesce(p_move->'idx', '[]'::jsonb));
    if coalesce(array_length(idxs, 1), 0) > 2 then raise exception 'Discard up to 2 cards.'; end if;
    side := st->seat;
    hand := side->'hand';
    if idxs is not null then
      foreach i in array idxs loop
        if i < 0 or i >= jsonb_array_length(hand) then raise exception 'That card is not in your hand.'; end if;
      end loop;
      newhand := '[]'::jsonb;
      ord := 0;
      for elem in select value from jsonb_array_elements(hand) loop
        if not (ord = any(idxs)) then newhand := newhand || jsonb_build_array(elem); end if;
        ord := ord + 1;
      end loop;
      hand := newhand;
    end if;
    draw := side->'deck';
    while jsonb_array_length(hand) < 6 and jsonb_array_length(draw) > 0 loop
      hand := hand || jsonb_build_array(draw->0);
      draw := draw - 0;
    end loop;
    side := jsonb_set(jsonb_set(jsonb_set(side, '{hand}', hand, true), '{deck}', draw, true), '{discarded}', 'true'::jsonb, true);
    st := jsonb_set(st, array[seat], side, true);
    if coalesce((st->opp->>'discarded')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"place2"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    end if;
  elsif (p_move->>'t') = 'silver' then
    if phase <> 'silver' then raise exception 'Silver is not being chosen.'; end if;
    if coalesce((st->seat->>'silverDone')::boolean, false) then raise exception 'You already chose.'; end if;
    side := jsonb_set(jsonb_set(st->seat, '{silver}', coalesce(p_move->'color', 'null'::jsonb), true), '{silverDone}', 'true'::jsonb, true);
    st := jsonb_set(st, array[seat], side, true);
    if coalesce((st->opp->>'silverDone')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"score"', false);
      st := st - 'turn';
    else
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    end if;
  else
    raise exception 'Unknown move.';
  end if;
  st := jsonb_set(st, '{seq}', to_jsonb(coalesce((st->>'seq')::int, 0) + 1), true);
  if seat = 'host' then m.host_seen := now(); else m.guest_seen := now(); end if;
  update public.matches set
    state = st,
    moves = moves || jsonb_build_array(p_move || jsonb_build_object('seat', seat, 'at', now())),
    turn_deadline = case when st->>'phase' = 'score' then null else now() + interval '60 seconds' end,
    host_seen = m.host_seen,
    guest_seen = case when seat = 'guest' then now() else guest_seen end,
    updated_at = now()
  where id = m.id;
  return jsonb_build_object('ok', true, 'state', st);
end;
$$;

create or replace function public.pvp_heartbeat(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  m public.matches;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.host = uid then
    update public.matches set host_seen = now(), updated_at = now() where id = m.id;
  elsif m.guest = uid then
    update public.matches set guest_seen = now(), updated_at = now() where id = m.id;
  else
    raise exception 'You are not in this match.';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.resign_match(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  m public.matches;
  opp uuid;
  paid int;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or m.status <> 'active' then raise exception 'That match is not in progress.'; end if;
  if m.host = uid then opp := m.guest; elsif m.guest = uid then opp := m.host; else raise exception 'You are not in this match.'; end if;
  if m.coins_paid then return jsonb_build_object('ok', true); end if;
  paid := public.pvp_reward(opp, uid, m.id, 'win');
  update public.matches set status = 'finished', winner = opp, result = 'resign', coins_paid = true, updated_at = now() where id = m.id;
  return jsonb_build_object('ok', true, 'coins', paid);
end;
$$;

create or replace function public.claim_forfeit(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  m public.matches;
  opp uuid;
  opp_seen timestamptz;
  turn text;
  stale boolean := false;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or m.status <> 'active' then raise exception 'That match is not in progress.'; end if;
  if m.host = uid then
    opp := m.guest; opp_seen := m.guest_seen; turn := 'guest';
  elsif m.guest = uid then
    opp := m.host; opp_seen := m.host_seen; turn := 'host';
  else
    raise exception 'You are not in this match.';
  end if;
  if opp_seen is null or opp_seen < now() - interval '60 seconds' then stale := true; end if;
  if m.turn_deadline is not null and now() > m.turn_deadline and m.state->>'turn' = turn then stale := true; end if;
  if not stale then raise exception 'Opponent is still here.'; end if;
  if not m.coins_paid then
    perform public.pvp_reward(uid, opp, m.id, 'win');
  end if;
  update public.matches set status = 'finished', winner = uid, result = 'forfeit', coins_paid = true, updated_at = now() where id = m.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.finish_match(p_match uuid, p_winner text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  m public.matches;
  mine jsonb;
  theirs jsonb;
  agreed boolean := false;
  winner uuid;
  loser uuid;
begin
  if p_winner not in ('me', 'them', 'tie') then raise exception 'Unknown result.'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.id is null or m.status not in ('active', 'disputed') then raise exception 'That match is not ready to finish.'; end if;
  if m.state->>'phase' is distinct from 'score' and m.status <> 'disputed' then
    raise exception 'The match is not over.';
  end if;
  mine := jsonb_build_object('winner', p_winner, 'hash', p_hash);
  if m.host = uid then
    update public.matches set host_report = mine, updated_at = now() where id = m.id;
    theirs := m.guest_report;
  elsif m.guest = uid then
    update public.matches set guest_report = mine, updated_at = now() where id = m.id;
    theirs := m.host_report;
  else
    raise exception 'You are not in this match.';
  end if;
  if theirs is null then
    return jsonb_build_object('ok', true, 'waiting', true);
  end if;
  -- "me" for the host is the opposite of "me" for the guest. Compare absolute winners.
  agreed := p_hash = theirs->>'hash' and (
    (p_winner = 'tie' and theirs->>'winner' = 'tie')
    or (m.host = uid and p_winner = 'me' and theirs->>'winner' = 'them')
    or (m.host = uid and p_winner = 'them' and theirs->>'winner' = 'me')
    or (m.guest = uid and p_winner = 'me' and theirs->>'winner' = 'them')
    or (m.guest = uid and p_winner = 'them' and theirs->>'winner' = 'me')
  );
  if not agreed then
    update public.matches set status = 'disputed', result = 'disputed', updated_at = now() where id = m.id;
    return jsonb_build_object('ok', true, 'disputed', true);
  end if;
  if m.coins_paid then return jsonb_build_object('ok', true); end if;
  if p_winner = 'tie' or theirs->>'winner' = 'tie' then
    perform public.pvp_reward(m.host, m.guest, m.id, 'tie');
    update public.matches set status = 'finished', result = 'tie', coins_paid = true, updated_at = now() where id = m.id;
  else
    if (m.host = uid and p_winner = 'me') or (m.guest = uid and p_winner = 'them') then
      winner := m.host; loser := m.guest;
    else
      winner := m.guest; loser := m.host;
    end if;
    perform public.pvp_reward(winner, loser, m.id, 'win');
    update public.matches set status = 'finished', winner = winner, result = 'score', coins_paid = true, updated_at = now() where id = m.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.pvp_history()
returns table(match_id uuid, opponent text, result text, coins int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.match_id, p.username, r.result, r.coins, r.created_at
  from public.pvp_results r
  left join public.profiles p on p.id = r.opponent
  where r.user_id = auth.uid()
  order by r.created_at desc
  limit 15;
$$;

revoke execute on function public.assert_pvp_deck(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.pvp_deal(jsonb, int) from public, anon, authenticated;
revoke execute on function public.pvp_open_state(jsonb, jsonb, int) from public, anon, authenticated;
revoke execute on function public.pvp_reward(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.pvp_slots_full(jsonb, text) from public, anon, authenticated;
revoke execute on function public.pvp_rng(bigint) from public, anon, authenticated;

revoke execute on function public.create_room(jsonb) from public, anon;
grant execute on function public.create_room(jsonb) to authenticated;
revoke execute on function public.join_room(text, jsonb) from public, anon;
grant execute on function public.join_room(text, jsonb) to authenticated;
revoke execute on function public.cancel_lobby(uuid) from public, anon;
grant execute on function public.cancel_lobby(uuid) to authenticated;
revoke execute on function public.create_challenge(text, jsonb) from public, anon;
grant execute on function public.create_challenge(text, jsonb) to authenticated;
revoke execute on function public.respond_invite(uuid, boolean, jsonb) from public, anon;
grant execute on function public.respond_invite(uuid, boolean, jsonb) to authenticated;
revoke execute on function public.enqueue_pvp(jsonb) from public, anon;
grant execute on function public.enqueue_pvp(jsonb) to authenticated;
revoke execute on function public.dequeue_pvp() from public, anon;
grant execute on function public.dequeue_pvp() to authenticated;
revoke execute on function public.submit_move(uuid, jsonb) from public, anon;
grant execute on function public.submit_move(uuid, jsonb) to authenticated;
revoke execute on function public.pvp_heartbeat(uuid) from public, anon;
grant execute on function public.pvp_heartbeat(uuid) to authenticated;
revoke execute on function public.resign_match(uuid) from public, anon;
grant execute on function public.resign_match(uuid) to authenticated;
revoke execute on function public.claim_forfeit(uuid) from public, anon;
grant execute on function public.claim_forfeit(uuid) to authenticated;
revoke execute on function public.finish_match(uuid, text, text) from public, anon;
grant execute on function public.finish_match(uuid, text, text) to authenticated;
revoke execute on function public.pvp_history() from public, anon;
grant execute on function public.pvp_history() to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.matches;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.match_invites;
  exception when duplicate_object or undefined_object then null;
  end;
end $$;

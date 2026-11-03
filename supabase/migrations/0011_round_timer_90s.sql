-- Round clock is 90 seconds so the client can show 1:30.
-- submit_move and claim_forfeit allow 5 extra seconds, so a move sent as
-- the ring hits zero still counts. The stored deadline stays at 90 seconds.
-- Opponent presence (unseen for 60 seconds), lobby expiry, and the auction
-- anti-snipe window are unchanged.
-- Do not apply from the client. Review this file, then run it in the Supabase SQL editor.
-- CREATE OR REPLACE keeps the existing execute grants.

CREATE OR REPLACE FUNCTION public.join_room(p_code text, p_deck jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    status = 'active', state = st, guest_seen = now(), turn_deadline = now() + interval '90 seconds', updated_at = now()
  where id = m.id;
  return jsonb_build_object('ok', true, 'id', m.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.respond_invite(p_invite uuid, p_accept boolean, p_deck jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    status = 'active', state = st, guest_seen = now(), turn_deadline = now() + interval '90 seconds', updated_at = now()
  where id = m.id;
  update public.match_invites set status = 'accepted' where id = inv.id;
  return jsonb_build_object('ok', true, 'id', m.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_pvp(p_deck jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  select 'queue', other, uid, h.username, me.username, h.avatar, me.avatar, other_deck, p_deck, seed, 'active', st, now(), now() + interval '90 seconds', now() + interval '10 minutes'
  from public.profiles h where h.id = other
  returning id into mid;
  return jsonb_build_object('ok', true, 'queued', false, 'id', mid);
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_move(p_match uuid, p_move jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if m.turn_deadline is not null and now() > m.turn_deadline + interval '5 seconds' then
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
    turn_deadline = case when st->>'phase' = 'score' then null else now() + interval '90 seconds' end,
    host_seen = m.host_seen,
    guest_seen = case when seat = 'guest' then now() else guest_seen end,
    updated_at = now()
  where id = m.id;
  return jsonb_build_object('ok', true, 'state', st);
end;
$function$;

CREATE OR REPLACE FUNCTION public.bot_play(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches;
  st jsonb;
  phase text;
  side jsonb;
  hand jsonb;
  board jsonb;
  draw jsonb;
  newhand jsonb;
  elem jsonb;
  best jsonb;
  best_score int;
  score int;
  i int;
  n int;
  slot int;
  hand_i int;
  dropped boolean;
  cid text;
  pts int;
  col text;
  arch text;
  goal text;
  tier text;
  on_board text[] := '{}';
  rng bigint;
begin
  select * into m from public.matches where id = p_id for update;
  if m.id is null or not m.is_bot or m.status <> 'active' then return; end if;
  st := m.state;
  if st->>'turn' is distinct from 'guest' then return; end if;
  phase := st->>'phase';
  tier := coalesce((public.rating_band(coalesce(m.bot_rating, 1000))->>'tier'), 'Bronze');
  side := st->'guest';
  hand := side->'hand';
  board := side->'board';
  rng := public.pvp_rng(coalesce(m.seed, 1)::bigint + coalesce((st->>'seq')::int, 0));
  select c.color into goal from public.cards c where c.id = side->'goal'->>'id';
  for i in 0..6 loop
    cid := board->i->>'id';
    if cid is not null then on_board := on_board || cid; end if;
  end loop;
  if phase in ('place1', 'place2') then
    best_score := -1;
    n := coalesce(jsonb_array_length(hand), 0);
    if n > 0 then
      for hand_i in 0..n-1 loop
        cid := hand->hand_i->>'id';
        select c.pts, c.color, c.archetype into pts, col, arch from public.cards c where c.id = cid;
        if pts is null then continue; end if;
        score := case
          when tier = 'Bronze' then (rng % 100)::int
          when tier = 'Silver' then pts
          else pts + case when col = goal then 20 else 0 end
            + case when tier in ('Platinum', 'Diamond', 'Champion') and arch = any(
                select c2.archetype from public.cards c2 where c2.id = any(on_board)
              ) then 12 else 0 end
            + case when tier in ('Diamond', 'Champion') and cid = any(on_board) then -30 else 0 end
        end;
        if tier = 'Champion' then score := score + pts; end if;
        if score > best_score then best_score := score; best := hand->hand_i; end if;
        rng := public.pvp_rng(rng);
      end loop;
    end if;
    if best is null then return; end if;
    slot := null;
    for i in (case when phase = 'place1' then 0 else 4 end)..(case when phase = 'place1' then 3 else 6 end) loop
      if board->i is null or board->i = 'null'::jsonb then slot := i; exit; end if;
    end loop;
    if slot is null then return; end if;
    newhand := '[]'::jsonb;
    dropped := false;
    for elem in select value from jsonb_array_elements(hand) loop
      if not dropped and elem = best then dropped := true;
      else newhand := newhand || jsonb_build_array(elem); end if;
    end loop;
    board := jsonb_set(board, array[slot::text], best, true);
    side := jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true);
    st := jsonb_set(st, '{guest}', side, true);
    if public.pvp_slots_full(st, phase) and phase = 'place1' then
      st := jsonb_set(jsonb_set(st, '{phase}', '"discard"', false), '{turn}', '"host"', false);
    elsif public.pvp_slots_full(st, phase) and phase = 'place2' then
      st := jsonb_set(jsonb_set(st, '{phase}', '"silver"', false), '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
  elsif phase = 'discard' then
    if coalesce((side->>'discarded')::boolean, false) then return; end if;
    newhand := '[]'::jsonb;
    best := null;
    if tier <> 'Bronze' and coalesce(jsonb_array_length(hand), 0) > 0 then
      select e.value into best
      from jsonb_array_elements(hand) with ordinality as e(value, ordinality)
      order by coalesce((select c.pts from public.cards c where c.id = e.value->>'id'), 99), e.ordinality
      limit 1;
    end if;
    dropped := false;
    for elem in select value from jsonb_array_elements(hand) loop
      if best is not null and not dropped and elem = best then dropped := true;
      else newhand := newhand || jsonb_build_array(elem); end if;
    end loop;
    draw := side->'deck';
    while jsonb_array_length(newhand) < 6 and jsonb_array_length(coalesce(draw, '[]'::jsonb)) > 0 loop
      newhand := newhand || jsonb_build_array(draw->0);
      draw := draw - 0;
    end loop;
    side := jsonb_set(jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{deck}', coalesce(draw, '[]'::jsonb), true), '{discarded}', 'true'::jsonb, true);
    st := jsonb_set(st, '{guest}', side, true);
    if coalesce((st->'host'->>'discarded')::boolean, false) then
      st := jsonb_set(jsonb_set(st, '{phase}', '"place2"', false), '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
  elsif phase = 'silver' then
    if coalesce((side->>'silverDone')::boolean, false) then return; end if;
    col := coalesce(goal, 'red');
    if tier in ('Bronze', 'Silver') then
      select c.color into col from public.cards c
      where c.id in (select value->>'id' from jsonb_array_elements(board))
        and c.color not in ('black', 'silver')
      group by c.color order by count(*) desc, c.color limit 1;
      col := coalesce(col, 'red');
    elsif tier = 'Champion' and goal is not null and goal not in ('black', 'silver') then
      col := goal;
    end if;
    side := jsonb_set(jsonb_set(side, '{silver}', to_jsonb(col), true), '{silverDone}', 'true'::jsonb, true);
    st := jsonb_set(st, '{guest}', side, true);
    if coalesce((st->'host'->>'silverDone')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"score"', false);
      st := st - 'turn';
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
  else
    return;
  end if;
  st := jsonb_set(st, '{seq}', to_jsonb(coalesce((st->>'seq')::int, 0) + 1), true);
  update public.matches set
    state = st,
    moves = moves || jsonb_build_array(jsonb_build_object('t', 'bot', 'seat', 'guest', 'at', now())),
    turn_deadline = case when st->>'phase' = 'score' then null else now() + interval '90 seconds' end,
    guest_seen = now(),
    updated_at = now()
  where id = m.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_bot_match()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := public.require_login();
  me public.profiles;
  queued jsonb;
  band jsonb;
  seed int;
  bdeck jsonb;
  st jsonb;
  mid uuid;
  bname text;
begin
  select deck into queued from public.pvp_queue where user_id = uid for update;
  if queued is null then raise exception 'Join the queue first.'; end if;
  delete from public.pvp_queue where user_id = uid;
  select * into me from public.profiles where id = uid;
  band := public.rating_band(me.rating);
  seed := floor(random() * 2000000000)::int;
  bdeck := public.bot_deck(band->>'tier', seed);
  if jsonb_array_length(bdeck) <> 12 then raise exception 'Could not build a bot deck.'; end if;
  st := public.pvp_open_state(queued, bdeck, seed);
  bname := case band->>'tier'
    when 'Bronze' then 'Rookie Orbit Bot'
    when 'Silver' then 'Orbit Bot'
    when 'Gold' then 'Ace Orbit Bot'
    when 'Platinum' then 'Elite Orbit Bot'
    when 'Diamond' then 'Diamond Orbit Bot'
    else 'Champion Orbit Bot'
  end;
  insert into public.matches (
    kind, is_bot, bot_name, bot_rating, host, host_name, host_avatar, guest_name,
    host_deck, guest_deck, seed, status, state, guest_seen, turn_deadline, expires_at, is_public
  ) values (
    'bot', true, bname, (band->>'bot')::int, uid, me.username, me.avatar, bname,
    queued, bdeck, seed, 'active', st, now(), now() + interval '90 seconds', now() + interval '30 minutes', true
  ) returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid, 'bot', bname, 'tier', band->>'tier', 'rating', (band->>'bot')::int);
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_forfeit(p_match uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if m.is_bot then
    if m.host = uid and m.state->>'turn' = 'host' and m.turn_deadline is not null and now() > m.turn_deadline + interval '5 seconds' then
      update public.matches set status = 'finished', winner = null, result = 'timeout', coins_paid = true, updated_at = now() where id = m.id;
      return jsonb_build_object('ok', true, 'timeout', true);
    end if;
    raise exception 'The bot is still playing.';
  end if;
  if m.host = uid then
    opp := m.guest; opp_seen := m.guest_seen; turn := 'guest';
  elsif m.guest = uid then
    opp := m.host; opp_seen := m.host_seen; turn := 'host';
  else
    raise exception 'You are not in this match.';
  end if;
  if opp_seen is null or opp_seen < now() - interval '60 seconds' then stale := true; end if;
  if m.turn_deadline is not null and now() > m.turn_deadline + interval '5 seconds' and m.state->>'turn' = turn then stale := true; end if;
  if not stale then raise exception 'Opponent is still here.'; end if;
  if not m.coins_paid then
    perform public.pvp_reward(uid, opp, m.id, 'win');
  end if;
  update public.matches set status = 'finished', winner = uid, result = 'forfeit', coins_paid = true, updated_at = now() where id = m.id;
  return jsonb_build_object('ok', true);
end;
$function$;

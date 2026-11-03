-- Ranked queue and bot matches. Friend rooms and challenges stay unranked.
-- Rating changes only inside these security-definer functions.
-- Do not apply from the client. Run this in the Supabase SQL editor.
--
-- A bot match is settled from the server's own move log. The bot's cards
-- are chosen here, then ranked_winner scores the stored board (printed
-- points, same-card knockouts, goal colors, and silver). The client's
-- reported winner is ignored, so a player cannot post a fake win.

alter table public.profiles
  add column if not exists rating int not null default 1000,
  add column if not exists ranked_wins int not null default 0,
  add column if not exists ranked_losses int not null default 0,
  add column if not exists ranked_games int not null default 0;

alter table public.matches
  add column if not exists is_bot boolean not null default false,
  add column if not exists bot_name text,
  add column if not exists bot_rating int,
  add column if not exists ranked_applied boolean not null default false,
  add column if not exists host_delta int,
  add column if not exists guest_delta int;

create index if not exists profiles_rating_idx on public.profiles (rating desc, ranked_wins desc);

-- ---------- tiers ----------
create or replace function public.rating_band(p_rating int)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'tier', case
      when p_rating >= 1700 then 'Champion'
      when p_rating >= 1550 then 'Diamond'
      when p_rating >= 1400 then 'Platinum'
      when p_rating >= 1250 then 'Gold'
      when p_rating >= 1100 then 'Silver'
      else 'Bronze'
    end,
    'division', case
      when p_rating >= 1700 then null
      when p_rating < 1000 then 'III'
      when p_rating < 1050 then 'II'
      when p_rating < 1100 then 'I'
      else (array['III','II','I'])[1 + ((p_rating - 1100) % 150) / 50]
    end,
    'floor', case
      when p_rating >= 1700 then 1700
      when p_rating >= 1550 then 1550
      when p_rating >= 1400 then 1400
      when p_rating >= 1250 then 1250
      when p_rating >= 1100 then 1100
      else 100
    end,
    'next', case
      when p_rating >= 1700 then null
      when p_rating >= 1550 then 1700
      when p_rating >= 1400 then 1550
      when p_rating >= 1250 then 1400
      when p_rating >= 1100 then 1250
      else 1100
    end,
    'bot', case
      when p_rating >= 1700 then 1775
      when p_rating >= 1550 then 1625
      when p_rating >= 1400 then 1475
      when p_rating >= 1250 then 1325
      when p_rating >= 1100 then 1175
      else 1000
    end
  );
$$;

revoke execute on function public.rating_band(int) from public, anon, authenticated;

create or replace function public.apply_rating(p_user uuid, p_opp int, p_score numeric, p_bot boolean)
returns int language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  k int;
  expected numeric;
  delta int;
begin
  if p_user is null then return 0; end if;
  select * into me from public.profiles where id = p_user for update;
  if me.id is null then return 0; end if;
  k := case when me.ranked_games < 10 then 48 else 32 end;
  if p_bot then k := k / 2; end if;
  expected := 1 / (1 + power(10::numeric, (p_opp - me.rating) / 400.0));
  delta := round(k * (p_score - expected));
  if p_bot and p_score > 0 and me.rating > p_opp then
    delta := least(greatest(delta, 0) / 2, case when me.rating >= p_opp + 200 then 1 else 8 end);
  end if;
  update public.profiles set
    rating = greatest(100, rating + delta),
    ranked_games = ranked_games + 1,
    ranked_wins = ranked_wins + case when p_score >= 1 then 1 else 0 end,
    ranked_losses = ranked_losses + case when p_score <= 0 then 1 else 0 end
  where id = p_user;
  return delta;
end;
$$;

revoke execute on function public.apply_rating(uuid, int, numeric, boolean) from public, anon, authenticated;

create or replace function public.rank_on_finish()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hs int := 0;
  gs int := 0;
  hr int := 1000;
  gr int := 1000;
begin
  if new.status is distinct from 'finished' or old.status = 'finished' then return new; end if;
  if new.ranked_applied or new.kind not in ('queue', 'bot') then return new; end if;
  select rating into hr from public.profiles where id = new.host;
  select rating into gr from public.profiles where id = new.guest;
  hr := coalesce(hr, 1000);
  gr := coalesce(gr, 1000);
  if new.is_bot or new.kind = 'bot' then
    if new.result = 'tie' then
      hs := public.apply_rating(new.host, coalesce(new.bot_rating, 1000), 0.5, true);
    elsif new.winner = new.host then
      hs := public.apply_rating(new.host, coalesce(new.bot_rating, 1000), 1, true);
    else
      hs := public.apply_rating(new.host, coalesce(new.bot_rating, 1000), 0, true);
    end if;
  elsif new.result = 'tie' then
    hs := public.apply_rating(new.host, gr, 0.5, false);
    gs := public.apply_rating(new.guest, hr, 0.5, false);
  elsif new.winner = new.host then
    hs := public.apply_rating(new.host, gr, 1, false);
    gs := public.apply_rating(new.guest, hr, 0, false);
  elsif new.winner = new.guest then
    hs := public.apply_rating(new.host, gr, 0, false);
    gs := public.apply_rating(new.guest, hr, 1, false);
  end if;
  new.ranked_applied := true;
  new.host_delta := hs;
  new.guest_delta := gs;
  return new;
end;
$$;

revoke execute on function public.rank_on_finish() from public, anon, authenticated;

drop trigger if exists matches_rank_on_finish on public.matches;
create trigger matches_rank_on_finish
before update on public.matches
for each row execute function public.rank_on_finish();

-- ---------- server score for a finished bot board ----------
create or replace function public.ranked_winner(p_state jsonb)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  seats text[] := array['host', 'guest'];
  seat text;
  opp text;
  i int;
  elem jsonb;
  cid text;
  pts int;
  col text;
  host_ids text[] := '{}';
  guest_ids text[] := '{}';
  host_pts int := 0;
  guest_pts int := 0;
  host_counts jsonb := '{}'::jsonb;
  guest_counts jsonb := '{}'::jsonb;
  goals text[] := '{}';
  gcol text;
  silver text;
  lead_host boolean;
  lead_guest boolean;
begin
  for seat in select unnest(seats) loop
    for i in 0..6 loop
      elem := p_state->seat->'board'->i;
      cid := case when jsonb_typeof(elem) = 'object' then elem->>'id' else null end;
      if cid is null or cid like 'ob_%' then continue; end if;
      if seat = 'host' then host_ids := host_ids || cid; else guest_ids := guest_ids || cid; end if;
    end loop;
  end loop;
  foreach seat in array seats loop
    opp := case when seat = 'host' then 'guest' else 'host' end;
    silver := case when coalesce((p_state->seat->>'silverDone')::boolean, false) then p_state->seat->>'silver' else null end;
    for i in 0..6 loop
      elem := p_state->seat->'board'->i;
      cid := case when jsonb_typeof(elem) = 'object' then elem->>'id' else null end;
      if cid is null or cid like 'ob_%' then continue; end if;
      if seat = 'host' and cid = any(guest_ids) then continue; end if;
      if seat = 'guest' and cid = any(host_ids) then continue; end if;
      select c.pts, c.color into pts, col from public.cards c where c.id = cid;
      if pts is null then continue; end if;
      if seat = 'host' then host_pts := host_pts + pts; else guest_pts := guest_pts + pts; end if;
      if col = 'silver' and silver is not null then col := silver; end if;
      if col is not null and col not in ('black', 'silver') then
        if seat = 'host' then host_counts := jsonb_set(host_counts, array[col], to_jsonb(coalesce((host_counts->>col)::int, 0) + 1), true);
        else guest_counts := jsonb_set(guest_counts, array[col], to_jsonb(coalesce((guest_counts->>col)::int, 0) + 1), true); end if;
      end if;
    end loop;
    elem := p_state->seat->'goal';
    cid := case when jsonb_typeof(elem) = 'object' then elem->>'id' else null end;
    if cid is not null then
      select c.color into gcol from public.cards c where c.id = cid;
      if gcol is not null and gcol not in ('black', 'silver') and not (gcol = any(goals)) then
        goals := goals || gcol;
      end if;
    end if;
  end loop;
  if coalesce(array_length(goals, 1), 0) = 1 then
    if coalesce((host_counts->>goals[1])::int, 0) > coalesce((guest_counts->>goals[1])::int, 0) then host_pts := host_pts + 15;
    elsif coalesce((guest_counts->>goals[1])::int, 0) > coalesce((host_counts->>goals[1])::int, 0) then guest_pts := guest_pts + 15; end if;
  elsif coalesce(array_length(goals, 1), 0) = 2 then
    lead_host := coalesce((host_counts->>goals[1])::int, 0) > coalesce((guest_counts->>goals[1])::int, 0)
      and coalesce((host_counts->>goals[2])::int, 0) > coalesce((guest_counts->>goals[2])::int, 0);
    lead_guest := coalesce((guest_counts->>goals[1])::int, 0) > coalesce((host_counts->>goals[1])::int, 0)
      and coalesce((guest_counts->>goals[2])::int, 0) > coalesce((host_counts->>goals[2])::int, 0);
    if lead_host then return 'host'; end if;
    if lead_guest then return 'guest'; end if;
  end if;
  if host_pts > guest_pts then return 'host'; end if;
  if guest_pts > host_pts then return 'guest'; end if;
  return 'tie';
end;
$$;

revoke execute on function public.ranked_winner(jsonb) from public, anon, authenticated;

create or replace function public.settle_bot_match(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  who text;
  win uuid;
begin
  select * into m from public.matches where id = p_id for update;
  if m.id is null or not m.is_bot or m.status <> 'active' then return; end if;
  if m.state->>'phase' is distinct from 'score' then return; end if;
  who := public.ranked_winner(m.state);
  if who = 'host' then win := m.host; else win := null; end if;
  if who = 'host' then
    perform public.pvp_reward(m.host, null, m.id, 'win');
  elsif who = 'guest' then
    update public.profiles set losses = losses + 1, games = games + 1 where id = m.host;
    insert into public.pvp_results (match_id, user_id, opponent, result, coins)
    values (m.id, m.host, null, 'loss', 0);
  else
    perform public.pvp_reward(m.host, null, m.id, 'tie');
  end if;
  update public.matches set
    status = 'finished',
    winner = win,
    result = case when who = 'tie' then 'tie' else 'score' end,
    coins_paid = true,
    turn_deadline = null,
    updated_at = now()
  where id = m.id;
end;
$$;

revoke execute on function public.settle_bot_match(uuid) from public, anon, authenticated;

-- One deterministic bot action. Difficulty follows the human's tier.
create or replace function public.bot_play(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
    turn_deadline = case when st->>'phase' = 'score' then null else now() + interval '60 seconds' end,
    guest_seen = now(),
    updated_at = now()
  where id = m.id;
end;
$$;

revoke execute on function public.bot_play(uuid) from public, anon, authenticated;

create or replace function public.bot_after_move()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_bot and new.status = 'active' and new.state->>'phase' = 'score' then
    perform public.settle_bot_match(new.id);
  elsif new.is_bot and new.status = 'active' and new.state->>'turn' = 'guest' then
    perform public.bot_play(new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.bot_after_move() from public, anon, authenticated;

drop trigger if exists matches_bot_after_move on public.matches;
create trigger matches_bot_after_move
after update on public.matches
for each row execute function public.bot_after_move();

-- ---------- queue to bot ----------
create or replace function public.bot_deck(p_tier text, p_seed int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  deck jsonb := '[]'::jsonb;
  cid text;
  n int := 0;
  gold_n int := case p_tier when 'Champion' then 3 when 'Diamond' then 2 when 'Platinum' then 1 when 'Gold' then 1 else 0 end;
  lo int := case p_tier when 'Bronze' then 1 when 'Silver' then 2 else 1 end;
  hi int := case p_tier when 'Bronze' then 4 when 'Silver' then 6 when 'Gold' then 8 when 'Platinum' then 9 else 10 end;
begin
  for cid in
    select c.id
    from public.cards c
    where not c.admin_only and c.id not like 'ob_%' and c.pts between lo and hi
    order by abs(hashtext(c.id || p_seed::text)), c.id
    limit 12
  loop
    deck := deck || jsonb_build_array(jsonb_build_object('id', cid, 'gold', n < gold_n));
    n := n + 1;
  end loop;
  while jsonb_array_length(deck) < 12 loop
    cid := null;
    select c.id into cid from public.cards c
    where not c.admin_only and c.id not like 'ob_%'
      and not (c.id in (select value->>'id' from jsonb_array_elements(deck)))
    order by c.pts desc, c.id limit 1;
    exit when cid is null;
    deck := deck || jsonb_build_array(jsonb_build_object('id', cid, 'gold', false));
  end loop;
  return deck;
end;
$$;

revoke execute on function public.bot_deck(text, int) from public, anon, authenticated;

create or replace function public.start_bot_match()
returns jsonb language plpgsql security definer set search_path = public as $$
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
    queued, bdeck, seed, 'active', st, now(), now() + interval '60 seconds', now() + interval '30 minutes', true
  ) returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid, 'bot', bname, 'tier', band->>'tier', 'rating', (band->>'bot')::int);
end;
$$;

revoke execute on function public.start_bot_match() from public, anon;
grant execute on function public.start_bot_match() to authenticated;

-- Timeouts against a bot are a loss. A bot never forfeits.
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
  if m.is_bot then
    if m.host = uid and m.state->>'turn' = 'host' and m.turn_deadline is not null and now() > m.turn_deadline then
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
  if m.turn_deadline is not null and now() > m.turn_deadline and m.state->>'turn' = turn then stale := true; end if;
  if not stale then raise exception 'Opponent is still here.'; end if;
  if not m.coins_paid then
    perform public.pvp_reward(uid, opp, m.id, 'win');
  end if;
  update public.matches set status = 'finished', winner = uid, result = 'forfeit', coins_paid = true, updated_at = now() where id = m.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.claim_forfeit(uuid) from public, anon;
grant execute on function public.claim_forfeit(uuid) to authenticated;

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
  if m.is_bot then
    update public.matches set status = 'finished', winner = null, result = 'resign', coins_paid = true, updated_at = now() where id = m.id;
    return jsonb_build_object('ok', true, 'rating_loss', true);
  end if;
  paid := public.pvp_reward(opp, uid, m.id, 'win');
  update public.matches set status = 'finished', winner = opp, result = 'resign', coins_paid = true, updated_at = now() where id = m.id;
  return jsonb_build_object('ok', true, 'coins', paid);
end;
$$;

revoke execute on function public.resign_match(uuid) from public, anon;
grant execute on function public.resign_match(uuid) to authenticated;

-- A bot match ignores the winner the client claims.
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
  if m.id is null then raise exception 'That match is not ready to finish.'; end if;
  if m.is_bot then
    if m.status = 'finished' then return jsonb_build_object('ok', true, 'done', true); end if;
    if m.state->>'phase' is distinct from 'score' then raise exception 'The match is not over.'; end if;
    perform public.settle_bot_match(m.id);
    return jsonb_build_object('ok', true, 'server', true);
  end if;
  if m.status not in ('active', 'disputed') then raise exception 'That match is not ready to finish.'; end if;
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

revoke execute on function public.finish_match(uuid, text, text) from public, anon;
grant execute on function public.finish_match(uuid, text, text) to authenticated;

-- ---------- public standings ----------
create or replace function public.pvp_standings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  board jsonb;
  mine jsonb;
begin
  with ranked as (
    select p.id, p.username, public.public_avatar(p.avatar) as avatar,
      p.rating, p.ranked_wins, p.ranked_losses,
      row_number() over (order by p.rating desc, p.ranked_wins desc, p.username) as rank
    from public.profiles p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'rank', r.rank,
    'username', r.username,
    'avatar', r.avatar,
    'rating', r.rating,
    'wins', r.ranked_wins,
    'losses', r.ranked_losses,
    'tier', public.rating_band(r.rating)->>'tier',
    'division', public.rating_band(r.rating)->>'division'
  ) order by r.rank), '[]'::jsonb)
  into board
  from ranked r
  where r.rank <= 50;

  if uid is not null then
    with ranked as (
      select p.id, p.rating, p.ranked_wins, p.ranked_losses,
        row_number() over (order by p.rating desc, p.ranked_wins desc, p.username) as rank
      from public.profiles p
    )
    select jsonb_build_object(
      'rank', r.rank,
      'rating', r.rating,
      'wins', r.ranked_wins,
      'losses', r.ranked_losses,
      'tier', band->>'tier',
      'division', band->>'division',
      'next', band->>'next',
      'floor', band->>'floor',
      'progress', case when (band->>'next') is null then 1
        else round(((r.rating - (band->>'floor')::int)::numeric / nullif((band->>'next')::int - (band->>'floor')::int, 0))::numeric, 3) end
    )
    into mine
    from ranked r
    cross join lateral public.rating_band(r.rating) band
    where r.id = uid;
  end if;
  return jsonb_build_object('board', coalesce(board, '[]'::jsonb), 'me', mine);
end;
$$;

revoke execute on function public.pvp_standings() from public;
grant execute on function public.pvp_standings() to anon, authenticated;

-- Authenticated must not be able to truncate, attach triggers, or add foreign keys.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

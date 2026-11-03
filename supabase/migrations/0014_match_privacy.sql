-- Hide hands, decks, and unrevealed cards from players and spectators.
-- Applied 2026-11-03.
-- The full match state lives in match_private, which players cannot read.
-- matches.state is the redacted copy Realtime and SELECT are allowed to see.
-- A redacted seat carries handCount, deckCount, goalColor, and goalPublic.
-- get_match_view builds each player's own view from the private row.
-- view_seat does not include goalPublic. seat_goal_color returns the color
-- for every goal, including ob_% and admin_only, so the two players still
-- see those colors. Only public_seat hides a goal color: goal_is_public()
-- is the stored goalPublic flag, or a live card check when a goal is present,
-- and the color stays null until score. state_has_secrets() is true when
-- either seat still has a hand, deck, or goal, which is how the trigger, the
-- redactors, and the backfill tell a private row from an already redacted one.
-- Friend matches use the same whole-round turns as bot matches: a player
-- fills the round, then the opponent does, then those cards are revealed.
-- place2 leads to swap, then silver, matching solo.
-- bump_bot_clock extends a bot deadline once per phase.
-- Hosted Supabase rejects DELETE and UPDATE with no WHERE (safeupdate).
-- 0012's bare "delete from es" is already replaced by 0013 ("where true").
-- 0013's updates all have a WHERE clause. This file does not add a bare one.
-- Applied to production on 2026-11-03. Do not run this file again.

create table if not exists public.match_private (
  match_id uuid primary key references public.matches(id) on delete cascade deferrable initially deferred,
  state jsonb not null,
  host_deck jsonb,
  guest_deck jsonb,
  clock_phase text
);

alter table public.match_private enable row level security;
revoke all on public.match_private from public, anon, authenticated;

create or replace function public.slot_revealed(p_phase text, p_slot int)
returns boolean language sql immutable as $$
  select case
    when p_phase = 'score' then true
    when p_phase in ('swap', 'silver') then p_slot <= 5
    when p_phase in ('discard', 'place2') then p_slot <= 3
    else false
  end;
$$;

create or replace function public.redact_board(p_board jsonb, p_phase text)
returns jsonb language plpgsql immutable as $$
declare
  out jsonb := '[]'::jsonb;
  elem jsonb;
  i int;
begin
  for i in 0..6 loop
    elem := case when jsonb_typeof(p_board) = 'array' then p_board->i else null end;
    if elem is null or elem = 'null'::jsonb or jsonb_typeof(elem) is distinct from 'object' or nullif(elem->>'id', '') is null then
      if elem is not null and jsonb_typeof(elem) = 'object' and coalesce((elem->>'hidden')::boolean, false) then
        out := out || jsonb_build_array(jsonb_build_object('hidden', true));
      else
        out := out || jsonb_build_array('null'::jsonb);
      end if;
    elsif public.slot_revealed(p_phase, i) then
      out := out || jsonb_build_array(jsonb_build_object('id', elem->>'id', 'gold', coalesce((elem->>'gold')::boolean, false)));
    else
      out := out || jsonb_build_array(jsonb_build_object('hidden', true));
    end if;
  end loop;
  return out;
end;
$$;

-- True when this JSON still holds a hand, a deck, or a goal card.
-- A redacted seat has counts and goalPublic instead, so this is false.
create or replace function public.state_has_secrets(p_state jsonb)
returns boolean language sql immutable as $$
  select p_state is not null
    and jsonb_typeof(p_state) = 'object'
    and (
      coalesce((p_state->'host') ? 'hand', false)
      or coalesce((p_state->'host') ? 'deck', false)
      or coalesce((p_state->'host') ? 'goal', false)
      or coalesce((p_state->'guest') ? 'hand', false)
      or coalesce((p_state->'guest') ? 'deck', false)
      or coalesce((p_state->'guest') ? 'goal', false)
    );
$$;

-- Spectators. A redacted seat trusts the stored goalPublic flag. A seat that
-- still has a goal card is public only when that card is not ob_% or admin_only.
create or replace function public.goal_is_public(p_side jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when nullif(p_side->'goal'->>'id', '') is not null then exists (
      select 1 from public.cards c
      where c.id = p_side->'goal'->>'id' and c.id not like 'ob_%' and not c.admin_only
    )
    else coalesce((p_side->>'goalPublic')::boolean, false)
  end;
$$;

-- Players, including an admin whose goal is an Obsidian card. This is not
-- nulled for ob_% or admin_only. public_seat is what hides those colors.
create or replace function public.seat_goal_color(p_side jsonb)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(p_side->>'goalColor', ''),
    (select c.color from public.cards c where c.id = p_side->'goal'->>'id')
  );
$$;

create or replace function public.redact_seat(p_side jsonb, p_phase text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hand jsonb := coalesce(p_side->'hand', '[]'::jsonb);
  deck jsonb := coalesce(p_side->'deck', '[]'::jsonb);
  silver_on boolean := coalesce((p_side->>'silverDone')::boolean, false);
  gid text := p_side->'goal'->>'id';
  public_goal boolean := false;
  gcolor text := null;
begin
  if p_side is null or jsonb_typeof(p_side) is distinct from 'object' then
    return jsonb_build_object(
      'board', public.redact_board('[]'::jsonb, p_phase),
      'handCount', 0,
      'deckCount', 0,
      'goalColor', null,
      'goalPublic', false,
      'silver', null,
      'silverDone', false,
      'discarded', false,
      'swapped', false,
      'penalty', 0
    );
  end if;
  if not ((p_side ? 'hand') or (p_side ? 'deck') or (p_side ? 'goal')) then
    return p_side;
  end if;
  if gid is not null and gid not like 'ob_%' and exists (
    select 1 from public.cards c where c.id = gid and not c.admin_only
  ) then
    public_goal := true;
    select c.color into gcolor from public.cards c where c.id = gid;
  end if;
  return jsonb_build_object(
    'board', public.redact_board(p_side->'board', p_phase),
    'handCount', coalesce((p_side->>'handCount')::int, jsonb_array_length(hand)),
    'deckCount', coalesce((p_side->>'deckCount')::int, jsonb_array_length(deck)),
    'goalColor', gcolor,
    'goalPublic', public_goal,
    'silver', case when silver_on then p_side->>'silver' else null end,
    'silverDone', silver_on,
    'discarded', coalesce((p_side->>'discarded')::boolean, false),
    'swapped', coalesce((p_side->>'swapped')::boolean, false),
    'penalty', coalesce((p_side->>'penalty')::int, 0)
  );
end;
$$;

create or replace function public.redact_match_state(p_state jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  phase text;
begin
  if p_state is null or jsonb_typeof(p_state) is distinct from 'object' then
    return '{}'::jsonb;
  end if;
  if not public.state_has_secrets(p_state) then
    return p_state;
  end if;
  phase := p_state->>'phase';
  return jsonb_build_object(
    'phase', phase,
    'turn', p_state->'turn',
    'seq', coalesce(p_state->'seq', '0'::jsonb),
    'host', public.redact_seat(p_state->'host', phase),
    'guest', public.redact_seat(p_state->'guest', phase)
  );
end;
$$;

create or replace function public.view_seat(p_side jsonb, p_phase text, p_own boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hand jsonb := coalesce(p_side->'hand', '[]'::jsonb);
  deck jsonb := coalesce(p_side->'deck', '[]'::jsonb);
  board jsonb := '[]'::jsonb;
  elem jsonb;
  i int;
  silver_on boolean := coalesce((p_side->>'silverDone')::boolean, false);
begin
  if p_side is null or jsonb_typeof(p_side) is distinct from 'object' then
    return jsonb_build_object('board', public.redact_board('[]'::jsonb, p_phase), 'handCount', 0, 'deckCount', 0, 'goalColor', null, 'silver', null, 'silverDone', false, 'discarded', false, 'swapped', false, 'penalty', 0);
  end if;
  for i in 0..6 loop
    elem := case when jsonb_typeof(p_side->'board') = 'array' then p_side->'board'->i else null end;
    if elem is null or elem = 'null'::jsonb or jsonb_typeof(elem) is distinct from 'object' or nullif(elem->>'id', '') is null then
      board := board || jsonb_build_array('null'::jsonb);
    elsif p_own or public.slot_revealed(p_phase, i) then
      board := board || jsonb_build_array(jsonb_build_object('id', elem->>'id', 'gold', coalesce((elem->>'gold')::boolean, false)));
    else
      board := board || jsonb_build_array(jsonb_build_object('hidden', true));
    end if;
  end loop;
  return jsonb_strip_nulls(jsonb_build_object(
    'hand', case when p_own then hand else null end,
    'deck', case when p_own then deck else null end,
    'board', board,
    'handCount', coalesce((p_side->>'handCount')::int, jsonb_array_length(hand)),
    'deckCount', coalesce((p_side->>'deckCount')::int, jsonb_array_length(deck)),
    'goalColor', public.seat_goal_color(p_side),
    'silver', case when p_own or silver_on then p_side->>'silver' else null end,
    'silverDone', silver_on,
    'discarded', coalesce((p_side->>'discarded')::boolean, false),
    'swapped', coalesce((p_side->>'swapped')::boolean, false),
    'penalty', coalesce((p_side->>'penalty')::int, 0)
  ));
end;
$$;

create or replace function public.hydrate_match(p_match public.matches)
returns public.matches language plpgsql stable security definer set search_path = public as $$
declare
  secret public.match_private;
begin
  if p_match.id is null then
    return p_match;
  end if;
  select * into secret from public.match_private where match_id = p_match.id;
  if found then
    p_match.state := secret.state;
    p_match.host_deck := secret.host_deck;
    p_match.guest_deck := secret.guest_deck;
  end if;
  return p_match;
end;
$$;

create or replace function public.matches_hide_secrets()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.state_has_secrets(new.state) then
    insert into public.match_private (match_id, state, host_deck, guest_deck)
    values (new.id, new.state, new.host_deck, new.guest_deck)
    on conflict (match_id) do update set
      state = excluded.state,
      host_deck = coalesce(excluded.host_deck, public.match_private.host_deck),
      guest_deck = coalesce(excluded.guest_deck, public.match_private.guest_deck);
    new.state := public.redact_match_state(new.state);
    new.host_deck := null;
    new.guest_deck := null;
  end if;
  return new;
end;
$$;

drop trigger if exists matches_hide_secrets on public.matches;
create trigger matches_hide_secrets
before insert or update on public.matches
for each row execute function public.matches_hide_secrets();

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
    if elem is not null and jsonb_typeof(elem) = 'object' and coalesce((elem->>'hidden')::boolean, false) then
      out := out || jsonb_build_array(jsonb_build_object('hidden', true));
      continue;
    end if;
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
  silver_on boolean := coalesce((p_side->>'silverDone')::boolean, false);
begin
  return jsonb_build_object(
    'board', public.public_board(p_side->'board'),
    'silver', case when silver_on then p_side->>'silver' else null end,
    'goalColor', case
      when p_phase = 'score' and public.goal_is_public(p_side) then nullif(p_side->>'goalColor', '')
      else null
    end
  );
end;
$$;

create or replace function public.get_match_view(p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  m public.matches;
  you text;
  opp text;
  phase text;
begin
  select * into m from public.matches where id = p_match;
  if m.id is null then
    raise exception 'Match not found.';
  end if;
  if m.host = uid then you := 'host'; opp := 'guest';
  elsif m.guest = uid then you := 'guest'; opp := 'host';
  else raise exception 'You are not in this match.'; end if;
  m := public.hydrate_match(m);
  phase := m.state->>'phase';
  return jsonb_build_object(
    'id', m.id,
    'status', m.status,
    'kind', m.kind,
    'is_bot', coalesce(m.is_bot, false),
    'code', m.code,
    'host', m.host,
    'guest', m.guest,
    'host_name', m.host_name,
    'guest_name', m.guest_name,
    'host_avatar', m.host_avatar,
    'guest_avatar', m.guest_avatar,
    'bot_name', m.bot_name,
    'turn_deadline', m.turn_deadline,
    'winner', m.winner,
    'result', m.result,
    'host_delta', m.host_delta,
    'guest_delta', m.guest_delta,
    'you', you,
    'state', jsonb_build_object(
      'phase', phase,
      'turn', m.state->>'turn',
      'seq', coalesce((m.state->>'seq')::int, 0),
      'you', public.view_seat(m.state->you, phase, true),
      'opp', public.view_seat(m.state->opp, phase, false)
    )
  );
end;
$$;

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
begin
  select * into m from public.matches where id = p_match for update;
  m := public.hydrate_match(m);
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
    if not public.seat_phase_full(st, seat, phase) then
      st := jsonb_set(st, '{turn}', to_jsonb(seat), false);
    elsif not public.seat_phase_full(st, opp, phase) then
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    elsif phase = 'place1' then
      st := jsonb_set(st, '{phase}', '"discard"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{phase}', '"swap"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
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
  elsif (p_move->>'t') = 'swap' then
    if phase <> 'swap' then raise exception 'You cannot swap now.'; end if;
    if coalesce((st->seat->>'swapped')::boolean, false) then raise exception 'You already chose.'; end if;
    side := st->seat;
    hand := side->'hand';
    board := side->'board';
    if p_move ? 'hand' and nullif(p_move->>'hand', '') is not null then
      hand_i := (p_move->>'hand')::int;
      if hand_i < 0 or hand_i >= coalesce(jsonb_array_length(hand), 0) then raise exception 'That card is not in your hand.'; end if;
      card := board->6;
      elem := hand->hand_i;
      newhand := '[]'::jsonb;
      ord := 0;
      for elem in select value from jsonb_array_elements(hand) loop
        if ord = hand_i then newhand := newhand || jsonb_build_array(card);
        else newhand := newhand || jsonb_build_array(elem); end if;
        ord := ord + 1;
      end loop;
      -- elem was overwritten by the loop; take the chosen card again
      elem := hand->hand_i;
      board := jsonb_set(board, '{6}', elem, true);
      side := jsonb_set(jsonb_set(jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true), '{penalty}', '10'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    else
      side := jsonb_set(jsonb_set(side, '{penalty}', '0'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    end if;
    st := jsonb_set(st, array[seat], side, true);
    if coalesce((st->opp->>'swapped')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"silver"', false);
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
  return jsonb_build_object('ok', true);
end;
$function$;

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
  m := public.hydrate_match(m);
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
  m := public.hydrate_match(m);
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
  m := public.hydrate_match(m);
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
    loop
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
    if not public.seat_phase_full(st, 'guest', phase) then
      side := st->'guest';
      hand := side->'hand';
      board := side->'board';
      on_board := '{}';
      for i in 0..6 loop
        cid := board->i->>'id';
        if cid is not null then on_board := on_board || cid; end if;
      end loop;
      continue;
    end if;
    if public.pvp_slots_full(st, phase) and phase = 'place1' then
      st := jsonb_set(jsonb_set(st, '{phase}', '"discard"', false), '{turn}', '"host"', false);
    elsif public.pvp_slots_full(st, phase) and phase = 'place2' then
      st := jsonb_set(jsonb_set(st, '{phase}', '"swap"', false), '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
    exit;
    end loop;
  elsif phase = 'swap' then
    if coalesce((side->>'swapped')::boolean, false) then return; end if;
    side := st->'guest';
    hand := side->'hand';
    board := side->'board';
    best := null;
    best_score := coalesce((select c.pts from public.cards c where c.id = board->6->>'id'), -1);
    if tier <> 'Bronze' then
      n := coalesce(jsonb_array_length(hand), 0);
      if n > 0 then
        for hand_i in 0..n-1 loop
          select c.pts into pts from public.cards c where c.id = hand->hand_i->>'id';
          if pts is not null and pts > best_score then best_score := pts; best := hand->hand_i; end if;
        end loop;
      end if;
    end if;
    if best is not null then
      newhand := '[]'::jsonb;
      dropped := false;
      for elem in select value from jsonb_array_elements(hand) loop
        if not dropped and elem = best then dropped := true;
        else newhand := newhand || jsonb_build_array(elem); end if;
      end loop;
      newhand := newhand || jsonb_build_array(board->6);
      board := jsonb_set(board, '{6}', best, true);
      side := jsonb_set(jsonb_set(jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true), '{penalty}', '10'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    else
      side := jsonb_set(jsonb_set(side, '{penalty}', '0'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    end if;
    st := jsonb_set(st, '{guest}', side, true);
    if coalesce((st->'host'->>'swapped')::boolean, false) then
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

CREATE OR REPLACE FUNCTION public.settle_bot_match(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches;
  who text;
  win uuid;
begin
  select * into m from public.matches where id = p_id for update;
  m := public.hydrate_match(m);
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
$function$;


create or replace function public.bump_bot_clock(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  m public.matches;
  phase text;
  prev text;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or not coalesce(m.is_bot, false) or m.status <> 'active' or m.host <> uid then
    return;
  end if;
  m := public.hydrate_match(m);
  if m.state->>'turn' is distinct from 'host' then
    return;
  end if;
  phase := coalesce(m.state->>'phase', '');
  select clock_phase into prev from public.match_private where match_id = m.id;
  if prev is not distinct from phase then
    return;
  end if;
  update public.matches set turn_deadline = now() + interval '90 seconds', updated_at = now()
  where id = m.id and is_bot and status = 'active' and host = uid and state->>'turn' = 'host';
  update public.match_private set clock_phase = phase where match_id = m.id;
end;
$$;

CREATE OR REPLACE FUNCTION public.spectate_match(p_match uuid, p_viewer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches;
  phase text;
  who text;
  n int;
  host_side jsonb;
  guest_side jsonb;
begin
  select * into m from public.matches where id = p_match;
  if m.id is null or m.status is distinct from 'active' or not coalesce(m.is_public, true) or m.guest is null then
    raise exception 'That match is not open to spectators.';
  end if;
  who := left(regexp_replace(coalesce(p_viewer, ''), '[^a-zA-Z0-9]', '', 'g'), 24);
  if who = '' then who := 'anon'; end if;
  insert into public.spectator_pings (match_id, viewer, seen)
  values (m.id, who, now())
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
$function$;

revoke all on function public.slot_revealed(text, int) from public, anon, authenticated;
revoke all on function public.redact_board(jsonb, text) from public, anon, authenticated;
revoke all on function public.state_has_secrets(jsonb) from public, anon, authenticated;
revoke all on function public.goal_is_public(jsonb) from public, anon, authenticated;
revoke all on function public.seat_goal_color(jsonb) from public, anon, authenticated;
revoke all on function public.redact_seat(jsonb, text) from public, anon, authenticated;
revoke all on function public.redact_match_state(jsonb) from public, anon, authenticated;
revoke all on function public.view_seat(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.hydrate_match(public.matches) from public, anon, authenticated;
revoke all on function public.matches_hide_secrets() from public, anon, authenticated;
revoke all on function public.get_match_view(uuid) from public, anon;
grant execute on function public.get_match_view(uuid) to authenticated;
revoke all on function public.bump_bot_clock(uuid) from public, anon;
grant execute on function public.bump_bot_clock(uuid) to authenticated;

update public.matches set state = state where public.state_has_secrets(state);

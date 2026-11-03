-- Toon Orbit Battle online accounts.
-- Idempotent. Apply once in the Supabase SQL editor (or as a migration).
-- Dashboard: Authentication → Providers → Email → turn OFF "Confirm email".
-- Players sign in with a username. The client stores it as <username>@players.toonorbit.app.
-- Do not put the service_role key in the website.

create extension if not exists pgcrypto;

-- ---------- reference data ----------
create table if not exists public.cards (
  id text primary key,
  name text not null,
  archetype text,
  color text not null default '',
  pts int not null default 0,
  pack_pool boolean not null default true,
  admin_only boolean not null default false
);

create table if not exists public.settings (
  key text primary key,
  value int not null
);

insert into public.settings (key, value) values
  ('win_coins', 100),
  ('loss_coins', 25),
  ('pack_price', 300),
  ('theme_price', 400),
  ('theme_week_price', 350),
  ('auction_fee', 0),
  ('gold_chance_bps', 300),
  ('win_gold_bps', 1000)
on conflict (key) do nothing;

create table if not exists public.starter_decks (
  deck_key text not null,
  card_id text not null references public.cards(id),
  slot int not null,
  primary key (deck_key, slot)
);

-- ---------- profiles and inventory ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  role text not null default 'player',
  coins int not null default 0,
  created_at timestamptz not null default now(),
  wins int not null default 0,
  losses int not null default 0,
  games int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  unopened_packs int not null default 3,
  last_daily date,
  showcase jsonb not null default '[]'::jsonb,
  avatar text,
  starter_deck text,
  packs_opened int not null default 0,
  auctions_sold int not null default 0,
  auctions_won int not null default 0
);

alter table public.profiles add column if not exists games int not null default 0;
alter table public.profiles add column if not exists streak int not null default 0;
alter table public.profiles add column if not exists best_streak int not null default 0;
alter table public.profiles add column if not exists unopened_packs int not null default 3;
alter table public.profiles add column if not exists last_daily date;
alter table public.profiles add column if not exists showcase jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists avatar text;
alter table public.profiles add column if not exists starter_deck text;
alter table public.profiles add column if not exists packs_opened int not null default 0;
alter table public.profiles add column if not exists auctions_sold int not null default 0;
alter table public.profiles add column if not exists auctions_won int not null default 0;

create unique index if not exists profiles_username_lower on public.profiles (lower(username));

create table if not exists public.collection (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null references public.cards(id),
  gold boolean not null default false,
  count int not null default 0 check (count >= 0),
  primary key (user_id, card_id, gold)
);

create table if not exists public.decks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  cards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

create table if not exists public.friends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  check (status in ('pending', 'accepted', 'declined'))
);
create unique index if not exists friend_requests_pending
  on public.friend_requests (from_id, to_id) where status = 'pending';

create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  seller uuid not null references public.profiles(id),
  card_id text not null references public.cards(id),
  gold boolean not null default false,
  start_bid int not null check (start_bid >= 1),
  current_bid int not null default 0,
  high_bidder uuid references public.profiles(id),
  ends_at timestamptz not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  check (status in ('open', 'sold', 'unsold', 'cancelled'))
);

create table if not exists public.bids (
  id bigserial primary key,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder uuid not null references public.profiles(id),
  amount int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.match_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  result text not null,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.setting(p_key text, p_fallback int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = p_key), p_fallback);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.require_login()
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Log in first.';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.theme_pack_price(p_theme text)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  themes text[];
  wk int;
  n int;
  full int := public.setting('theme_price', 400);
  disc int := public.setting('theme_week_price', 350);
begin
  select coalesce(array_agg(a order by a), '{}') into themes
  from (select distinct archetype a from public.cards where pack_pool and archetype is not null and archetype <> '') s;
  n := coalesce(array_length(themes, 1), 0);
  if n = 0 or p_theme is null or p_theme = '' then
    return full;
  end if;
  wk := extract(isoweek from current_date)::int;
  if themes[(((wk - 1) % n) + 1)] = p_theme then
    return disc;
  end if;
  return full;
end;
$$;

create or replace function public.give_copy(p_user uuid, p_card text, p_gold boolean, p_n int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_n is null or p_n <= 0 then return; end if;
  if not exists (select 1 from public.cards where id = p_card) then
    raise exception 'Unknown card.';
  end if;
  insert into public.collection (user_id, card_id, gold, count)
  values (p_user, p_card, coalesce(p_gold, false), p_n)
  on conflict (user_id, card_id, gold)
  do update set count = public.collection.count + excluded.count;
end;
$$;

create or replace function public.take_copy(p_user uuid, p_card text, p_gold boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  select count into n from public.collection
  where user_id = p_user and card_id = p_card and gold = coalesce(p_gold, false)
  for update;
  if n is null or n < 1 then
    raise exception 'That copy is not in your collection.';
  end if;
  if n = 1 then
    delete from public.collection where user_id = p_user and card_id = p_card and gold = coalesce(p_gold, false);
  else
    update public.collection set count = count - 1
    where user_id = p_user and card_id = p_card and gold = coalesce(p_gold, false);
  end if;
end;
$$;

-- ---------- signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text := nullif(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))), '');
  make_admin boolean;
begin
  if uname is null then
    uname := 'player' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  make_admin := lower(uname) in ('mjmasters91', 'sender');
  insert into public.profiles (id, username, role, unopened_packs)
  values (new.id, uname, case when make_admin then 'admin' else 'player' end, 3)
  on conflict (id) do nothing;
  if make_admin then
    insert into public.collection (user_id, card_id, gold, count)
    select new.id, c.id, g.gold, 1
    from public.cards c
    cross join (values (false), (true)) as g(gold)
    where c.admin_only
    on conflict (user_id, card_id, gold) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- packs and matches ----------
create or replace function public.buy_pack()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  price int := public.setting('pack_price', 300);
  prof public.profiles;
begin
  select * into prof from public.profiles where id = uid for update;
  if prof.coins < price then
    raise exception 'Not enough Orbit Coins.';
  end if;
  update public.profiles
  set coins = coins - price, unopened_packs = unopened_packs + 1
  where id = uid;
  return jsonb_build_object('ok', true, 'price', price);
end;
$$;

create or replace function public.claim_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  prof public.profiles;
begin
  select * into prof from public.profiles where id = uid for update;
  if prof.last_daily = current_date then
    raise exception 'Daily pack already claimed.';
  end if;
  update public.profiles
  set unopened_packs = unopened_packs + 1, last_daily = current_date
  where id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.open_pack(p_mode text, p_theme text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  prof public.profiles;
  price int := 0;
  pool text[];
  unowned text[];
  force_at int := 0;
  i int;
  cid text;
  is_gold boolean;
  had_any boolean;
  gold_bps int := public.setting('gold_chance_bps', 300);
  pulls jsonb := '[]'::jsonb;
  seen text[] := '{}';
begin
  select * into prof from public.profiles where id = uid for update;
  if p_mode = 'inventory' then
    if prof.unopened_packs < 1 then
      raise exception 'No unopened packs.';
    end if;
    update public.profiles set unopened_packs = unopened_packs - 1, packs_opened = packs_opened + 1 where id = uid;
    select coalesce(array_agg(id), '{}') into pool from public.cards where pack_pool;
  else
    if p_theme is null or p_theme = '' then
      raise exception 'Pick a themed pack.';
    end if;
    price := public.theme_pack_price(p_theme);
    if prof.coins < price then
      raise exception 'Not enough Orbit Coins.';
    end if;
    select coalesce(array_agg(id), '{}') into pool
    from public.cards where pack_pool and archetype = p_theme;
    if coalesce(array_length(pool, 1), 0) = 0 then
      raise exception 'That pack is empty.';
    end if;
    update public.profiles set coins = coins - price, packs_opened = packs_opened + 1 where id = uid;
  end if;
  if coalesce(array_length(pool, 1), 0) = 0 then
    raise exception 'That pack is empty.';
  end if;
  select coalesce(array_agg(x.id), '{}') into unowned
  from unnest(pool) as x(id)
  where not exists (
    select 1 from public.collection c where c.user_id = uid and c.card_id = x.id and c.count > 0
  );
  if coalesce(array_length(unowned, 1), 0) > 0 then
    force_at := 1 + floor(random() * 5)::int;
  end if;
  for i in 1..5 loop
    if i = force_at then
      cid := unowned[1 + floor(random() * array_length(unowned, 1))::int];
    else
      cid := pool[1 + floor(random() * array_length(pool, 1))::int];
    end if;
    is_gold := random() < (gold_bps / 10000.0);
    had_any := exists (
      select 1 from public.collection c where c.user_id = uid and c.card_id = cid and c.count > 0
    ) or cid = any(seen);
    perform public.give_copy(uid, cid, is_gold, 1);
    seen := seen || cid;
    pulls := pulls || jsonb_build_array(jsonb_build_object(
      'id', cid,
      'gold', is_gold,
      'uid', cid || case when is_gold then ':g:' else ':s:' end || i::text,
      'isNew', not had_any
    ));
  end loop;
  return jsonb_build_object('pulls', pulls, 'price', price);
end;
$$;

create or replace function public.choose_starter(p_deck text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  prof public.profiles;
  rec record;
begin
  select * into prof from public.profiles where id = uid for update;
  if prof.starter_deck is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if not exists (select 1 from public.starter_decks where deck_key = p_deck) then
    raise exception 'Unknown starter deck.';
  end if;
  for rec in select card_id from public.starter_decks where deck_key = p_deck order by slot loop
    perform public.give_copy(uid, rec.card_id, false, 1);
  end loop;
  update public.profiles set starter_deck = p_deck where id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.record_match_result(p_result text, p_deck text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  prof public.profiles;
  gained int := 0;
  reward jsonb := null;
  pool text[];
  cid text;
  is_gold boolean;
  recent int;
begin
  if p_result not in ('win', 'loss', 'tie') then
    raise exception 'Unknown result.';
  end if;
  select * into prof from public.profiles where id = uid for update;
  if exists (
    select 1 from public.match_log
    where user_id = uid and created_at > now() - interval '20 seconds'
  ) then
    raise exception 'That match was recorded too quickly. Wait a moment.';
  end if;
  select count(*) into recent from public.match_log
  where user_id = uid and created_at > now() - interval '1 hour';
  if recent >= 40 then
    raise exception 'Too many matches this hour.';
  end if;
  insert into public.match_log (user_id, result) values (uid, p_result);
  if p_result = 'win' then
    gained := public.setting('win_coins', 100);
    update public.profiles
    set wins = wins + 1,
        games = games + 1,
        streak = streak + 1,
        best_streak = greatest(best_streak, streak + 1),
        coins = coins + gained
    where id = uid;
    select coalesce(array_agg(id), '{}') into pool from public.cards where pack_pool;
    if coalesce(array_length(pool, 1), 0) > 0 then
      cid := pool[1 + floor(random() * array_length(pool, 1))::int];
      is_gold := random() < (public.setting('win_gold_bps', 1000) / 10000.0);
      perform public.give_copy(uid, cid, is_gold, 1);
      reward := jsonb_build_object('id', cid, 'gold', is_gold, 'uid', cid || case when is_gold then ':g:w' else ':s:w' end);
    end if;
  else
    gained := public.setting('loss_coins', 25);
    update public.profiles
    set losses = losses + case when p_result = 'loss' then 1 else 0 end,
        games = games + 1,
        streak = 0,
        coins = coins + gained
    where id = uid;
  end if;
  return jsonb_build_object('gained', gained, 'reward', reward);
end;
$$;

-- ---------- profile cosmetics ----------
create or replace function public.set_showcase(p_ids jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  clean jsonb := '[]'::jsonb;
  elem text;
begin
  if jsonb_typeof(p_ids) = 'array' then
    for elem in select jsonb_array_elements_text(p_ids) loop
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
  if p_card is not null and p_card <> '' and not exists (select 1 from public.cards where id = p_card) then
    raise exception 'Unknown card.';
  end if;
  update public.profiles set avatar = nullif(p_card, '') where id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.save_deck(p_name text, p_cards jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  deck_name text := coalesce(nullif(trim(p_name), ''), 'custom');
begin
  if deck_name !~ '^[A-Za-z0-9_ ]{1,40}$' then
    raise exception 'Pick a shorter deck name.';
  end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards) > 12 then
    raise exception 'A deck holds up to 12 cards.';
  end if;
  insert into public.decks (user_id, name, cards, updated_at)
  values (uid, deck_name, p_cards, now())
  on conflict (user_id, name) do update set cards = excluded.cards, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.my_friends()
returns table(username text)
language sql stable security definer set search_path = public as $$
  select p.username
  from public.friends f
  join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid()
  order by p.username;
$$;

create or replace function public.send_friend_request(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  other uuid;
begin
  select id into other from public.profiles where lower(username) = lower(trim(p_username));
  if other is null then raise exception 'No account with that username.'; end if;
  if other = uid then raise exception 'That’s you.'; end if;
  if exists (select 1 from public.friends where user_id = uid and friend_id = other) then
    raise exception 'Already friends.';
  end if;
  insert into public.friend_requests (from_id, to_id, status)
  values (uid, other, 'pending')
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.accept_friend_request(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  req public.friend_requests;
begin
  select * into req from public.friend_requests where id = p_id for update;
  if req.id is null or req.to_id <> uid or req.status <> 'pending' then
    raise exception 'That request is not waiting for you.';
  end if;
  update public.friend_requests set status = 'accepted' where id = p_id;
  insert into public.friends (user_id, friend_id) values (req.from_id, req.to_id) on conflict do nothing;
  insert into public.friends (user_id, friend_id) values (req.to_id, req.from_id) on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_friend(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  other uuid;
begin
  select id into other from public.profiles where lower(username) = lower(trim(p_username));
  if other is null then raise exception 'No account with that username.'; end if;
  delete from public.friends where (user_id = uid and friend_id = other) or (user_id = other and friend_id = uid);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- auctions ----------
create or replace function public.create_auction(p_card text, p_gold boolean, p_start int, p_ms bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  def public.cards;
  owned int;
  in_deck boolean;
  lot uuid;
  ends timestamptz;
begin
  if p_start is null or p_start < 1 or p_start > 1000000 then
    raise exception 'Set a starting price of at least 1.';
  end if;
  if p_ms is null or p_ms < 60000 or p_ms > 14 * 24 * 60 * 60 * 1000 then
    if not (public.is_admin() and p_ms = 120000) then
      raise exception 'Pick a duration.';
    end if;
  end if;
  select * into def from public.cards where id = p_card;
  if def.id is null then raise exception 'Unknown card.'; end if;
  if def.admin_only or p_card like 'ob_%' then
    raise exception 'Obsidian Order cards stay out of the auction house.';
  end if;
  select count into owned from public.collection
  where user_id = uid and card_id = p_card and gold = coalesce(p_gold, false)
  for update;
  owned := coalesce(owned, 0);
  if owned < 1 then raise exception 'That copy is not in your collection.'; end if;
  select exists (
    select 1 from public.decks d, jsonb_array_elements(d.cards) e
    where d.user_id = uid and d.name = 'custom'
      and coalesce(e->>'id', trim(both '"' from e::text)) = p_card
  ) into in_deck;
  if owned = 1 and in_deck then
    raise exception 'That is the only copy in your custom deck. Take it out of the deck first.';
  end if;
  perform public.take_copy(uid, p_card, coalesce(p_gold, false));
  ends := now() + make_interval(secs => (p_ms / 1000.0));
  insert into public.auctions (seller, card_id, gold, start_bid, current_bid, ends_at, status)
  values (uid, p_card, coalesce(p_gold, false), p_start, 0, ends, 'open')
  returning id into lot;
  return jsonb_build_object('ok', true, 'id', lot);
end;
$$;

create or replace function public.place_bid(p_lot uuid, p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  lot public.auctions;
  floor int;
  me public.profiles;
  prev public.profiles;
begin
  select * into lot from public.auctions where id = p_lot for update;
  if lot.id is null or lot.status <> 'open' then
    raise exception 'That auction is closed.';
  end if;
  if lot.ends_at <= now() then
    raise exception 'That auction just ended.';
  end if;
  if lot.seller = uid then
    raise exception 'You can’t bid on your own auction.';
  end if;
  floor := case when lot.high_bidder is null then lot.start_bid else lot.current_bid + greatest(10, ceil(lot.current_bid * 0.05)) end;
  if p_amount is null or p_amount < floor then
    raise exception 'Bid at least % coins.', floor;
  end if;
  select * into me from public.profiles where id = uid for update;
  if me.coins < p_amount then
    raise exception 'You don’t have enough Orbit Coins.';
  end if;
  if lot.high_bidder is not null then
    select * into prev from public.profiles where id = lot.high_bidder for update;
    update public.profiles set coins = coins + lot.current_bid where id = lot.high_bidder;
  end if;
  update public.profiles set coins = coins - p_amount where id = uid;
  update public.auctions
  set current_bid = p_amount,
      high_bidder = uid,
      ends_at = case when ends_at < now() + interval '60 seconds' then ends_at + interval '60 seconds' else ends_at end
  where id = lot.id;
  insert into public.bids (auction_id, bidder, amount) values (lot.id, uid, p_amount);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.settle_auction(p_lot uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lot public.auctions;
  fee int := public.setting('auction_fee', 0);
  payout int;
  n int := 0;
begin
  for lot in
    select * from public.auctions
    where status = 'open' and ends_at <= now() and (p_lot is null or id = p_lot)
    for update skip locked
  loop
    update public.auctions
    set status = case when lot.high_bidder is null then 'unsold' else 'sold' end
    where id = lot.id and status = 'open';
    if not found then continue; end if;
    if lot.high_bidder is not null then
      perform public.give_copy(lot.high_bidder, lot.card_id, lot.gold, 1);
      payout := lot.current_bid - floor(lot.current_bid * fee / 100.0);
      update public.profiles
      set coins = coins + payout, auctions_sold = auctions_sold + 1
      where id = lot.seller;
      update public.profiles set auctions_won = auctions_won + 1 where id = lot.high_bidder;
    else
      perform public.give_copy(lot.seller, lot.card_id, lot.gold, 1);
    end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'settled', n);
end;
$$;

create or replace function public.cancel_auction(p_lot uuid, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  lot public.auctions;
begin
  if coalesce(p_admin, false) and not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  select * into lot from public.auctions where id = p_lot for update;
  if lot.id is null or lot.status <> 'open' then
    raise exception 'That auction is closed.';
  end if;
  if not coalesce(p_admin, false) and lot.seller <> uid then
    raise exception 'Only the seller can cancel.';
  end if;
  if not coalesce(p_admin, false) and lot.high_bidder is not null then
    raise exception 'You can cancel only before the first bid.';
  end if;
  update public.auctions set status = 'cancelled' where id = lot.id and status = 'open';
  if not found then
    return jsonb_build_object('ok', true);
  end if;
  perform public.give_copy(lot.seller, lot.card_id, lot.gold, 1);
  if lot.high_bidder is not null then
    update public.profiles set coins = coins + lot.current_bid where id = lot.high_bidder;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- admin ----------
create or replace function public.admin_give_coins(p_user uuid, p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.profiles set coins = greatest(0, coalesce(p_amount, 0)) where id = p_user;
  if not found then raise exception 'No player with that name.'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_give_packs(p_user uuid, p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.profiles set unopened_packs = greatest(0, coalesce(p_amount, 0)) where id = p_user;
  if not found then raise exception 'No player with that name.'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_give_card(p_user uuid, p_card text, p_gold boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform public.give_copy(p_user, p_card, coalesce(p_gold, false), 1);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_give_all(p_user uuid, p_gold boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  for rec in select id from public.cards where not admin_only loop
    perform public.give_copy(p_user, rec.id, coalesce(p_gold, false), 1);
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_set_prices(p_prices jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text;
  v int;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  foreach k in array array['win_coins','loss_coins','pack_price','theme_price','theme_week_price','auction_fee'] loop
    if p_prices ? k then
      v := greatest(0, least(1000000, coalesce((p_prices->>k)::int, 0)));
      if k = 'auction_fee' then v := least(50, v); end if;
      insert into public.settings (key, value) values (k, v)
      on conflict (key) do update set value = excluded.value;
    end if;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_list_players()
returns table(id uuid, username text, role text, coins int, unopened_packs int, cards bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query
    select p.id, p.username, p.role, p.coins, p.unopened_packs,
           coalesce((select sum(c.count) from public.collection c where c.user_id = p.id), 0)::bigint
    from public.profiles p
    order by p.username;
end;
$$;

-- ---------- RLS ----------
alter table public.cards enable row level security;
alter table public.settings enable row level security;
alter table public.starter_decks enable row level security;
alter table public.profiles enable row level security;
alter table public.collection enable row level security;
alter table public.decks enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.match_log enable row level security;

drop policy if exists cards_read on public.cards;
create policy cards_read on public.cards for select to anon, authenticated using (true);
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated using (true);
drop policy if exists starters_read on public.starter_decks;
create policy starters_read on public.starter_decks for select to anon, authenticated using (true);

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists collection_owner on public.collection;
create policy collection_owner on public.collection for select to authenticated using (user_id = auth.uid());
drop policy if exists decks_owner on public.decks;
create policy decks_owner on public.decks for select to authenticated using (user_id = auth.uid());
drop policy if exists friends_owner on public.friends;
create policy friends_owner on public.friends for select to authenticated using (user_id = auth.uid() or friend_id = auth.uid());
drop policy if exists requests_parties on public.friend_requests;
create policy requests_parties on public.friend_requests for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists match_owner on public.match_log;
create policy match_owner on public.match_log for select to authenticated using (user_id = auth.uid());

drop policy if exists auctions_read on public.auctions;
create policy auctions_read on public.auctions for select to anon, authenticated using (true);
drop policy if exists bids_read on public.bids;
create policy bids_read on public.bids for select to anon, authenticated using (true);

revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

revoke all on public.collection from anon, authenticated;
grant select on public.collection to authenticated;
revoke all on public.decks from anon, authenticated;
grant select on public.decks to authenticated;
revoke all on public.friends from anon, authenticated;
grant select on public.friends to authenticated;
revoke all on public.friend_requests from anon, authenticated;
grant select on public.friend_requests to authenticated;
revoke all on public.match_log from anon, authenticated;
grant select on public.match_log to authenticated;

grant select on public.cards to anon, authenticated;
grant select on public.settings to anon, authenticated;
grant select on public.starter_decks to anon, authenticated;
grant select on public.auctions to anon, authenticated;
grant select on public.bids to anon, authenticated;

create or replace view public.public_profiles
with (security_invoker = false) as
select id, username, wins, losses, showcase, avatar
from public.profiles;
grant select on public.public_profiles to anon, authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.auctions;
  exception when duplicate_object or undefined_object then
    null;
  end;
end $$;

-- ---------- seed cards (public pool + admin-only obsidian) ----------
insert into public.cards (id, name, archetype, color, pts, pack_pool, admin_only) values
('zoomer','Captain Zoomer','Galaxy','green',10,true,false),
('zoomer_jet','Zoomer Jetpack','Galaxy','yellow',4,true,false),
('nell','Nova Nell','Galaxy','yellow',8,true,false),
('bleep','Bleep-O','Galaxy','silver',1,true,false),
('gravitron','Prof. Gravitron','Galaxy','purple',7,true,false),
('astropup','Astro Pup','Galaxy','blue',3,true,false),
('starhopper','The Starhopper','Galaxy','black',8,true,false),
('lunara','Queen Lunara','Galaxy','silver',2,true,false),
('cometkid','Comet Kid','Galaxy','red',5,true,false),
('gloop','Gloop','Spooks','black',9,true,false),
('fangly','Count Fangly','Spooks','purple',7,true,false),
('bertha','Batwing Bertha','Spooks','red',4,true,false),
('wisp','Wanda Wisp','Spooks','blue',5,true,false),
('manor','Hollow Manor','Spooks','silver',2,true,false),
('bonesy','Bonesy','Spooks','green',6,true,false),
('timid','Timid Tim','Spooks','orange',7,true,false),
('pumpkin','Pumpkin Pete','Spooks','orange',3,true,false),
('hank','Hank the Hog','Barnyard','red',10,true,false),
('hank_mud','Hank Mudbath','Barnyard','blue',5,true,false),
('clara','Clucky Clara','Barnyard','yellow',1,true,false),
('moomax','Moo-Moo Max','Barnyard','green',8,true,false),
('fritz','Farmer Fritz','Barnyard','silver',2,true,false),
('tractor','Rusty the Tractor','Barnyard','orange',4,true,false),
('quack','Sir Quacksalot','Barnyard','blue',7,true,false),
('weasel','Slick Weasel','Barnyard','purple',6,true,false),
('granny','Granny Goose','Barnyard','green',3,true,false),
('pip','Pip Sprout','Sprouts','green',9,true,false),
('pip_armor','Pip in Bark Armor','Sprouts','purple',4,true,false),
('daisy','Daisy Dynamo','Sprouts','orange',6,true,false),
('thorn','Baron Thorn','Sprouts','black',8,true,false),
('weedwhack','Weedwhacker 3000','Sprouts','orange',1,true,false),
('treehouse','Treehouse HQ','Sprouts','purple',5,true,false),
('bud','Bud Buddy','Sprouts','red',5,true,false),
('mossy','Mossy','Sprouts','yellow',4,true,false),
('petal','Petal Pop','Sprouts','blue',10,true,false),
('mayor','Mayor Bigsby','Toons','black',9,true,false),
('dj','DJ Zigzag','Toons','silver',1,true,false),
('rosie','Robo-Rosie','Toons','red',5,true,false),
('sneak','Sneak Peek','Toons','yellow',5,true,false),
('mel','Megaphone Mel','Toons','red',2,true,false),
('zap','Zap Zapper','Toons','red',6,true,false),
('blaze','Blaze Ballerina','Toons','orange',10,true,false),
('ember','Ember Snapjaw','Dragons','red',10,true,false),
('glimmer','Glimmerscale','Dragons','purple',4,true,false),
('mossfang','Mossfang','Dragons','green',8,true,false),
('grandwyrm','Grandmama Wyrm','Dragons','silver',2,true,false),
('ember_egg','Ember Hatchling','Dragons','orange',3,true,false),
('cinderpuff','Cinderpuff','Dragons','yellow',1,true,false),
('volcanolair','Volcano Lair','Dragons','black',2,true,false),
('skyrider','Skyrider Zephyr','Dragons','blue',6,true,false),
('hoardle','Hoardle the Greedy','Dragons','purple',7,true,false),
('frostwing','Frostwing','Dragons','blue',5,true,false),
('zigzag_dr','Ziggle & Zaggle','Dragons','orange',9,true,false),
('sparkler','Sparkler','Dragons','yellow',3,true,false),
('magmaw','Magmaw','Dragons','red',6,true,false),
('noodle','Noodle Longtail','Dragons','green',4,true,false),
('twinkle','Twinkle Bramblewing','Fairies','purple',9,true,false),
('dewdrop','Dewdrop Dot','Fairies','blue',3,true,false),
('thistle','Thistle Thorncap','Fairies','green',8,true,false),
('mushmum','Mother Mushcap','Fairies','silver',2,true,false),
('glowbug','Glowbug Gus','Fairies','yellow',1,true,false),
('fairyring','Fairy Ring','Fairies','black',3,true,false),
('nettle','Nettle the Nasty','Fairies','red',6,true,false),
('twinkle_moon','Twinkle Moonbeam','Fairies','blue',4,true,false),
('pollen','Pollen Puff','Fairies','yellow',5,true,false),
('bloomer','Bloomer Bellflower','Fairies','orange',7,true,false),
('pinecone','Sir Pinecone','Fairies','green',4,true,false),
('duskwing','Duskwing Dora','Fairies','purple',6,true,false),
('rainbow_sp','Prism Flitterly','Fairies','orange',10,true,false),
('sprigsnatch','Sprig Snatcher','Fairies','black',5,true,false),
('sirbumble','Sir Bumbleby','Knights','blue',10,true,false),
('dame_dash','Dame Dashwell','Knights','red',5,true,false),
('squire','Squire Scoot','Knights','yellow',3,true,false),
('shieldwall','Captain Shieldwall','Knights','silver',2,true,false),
('trotter','Trotter the Warhorse','Knights','orange',4,true,false),
('castle','Castle Crumbleton','Knights','black',3,true,false),
('blackvisor','The Black Visor','Knights','black',8,true,false),
('sirbumble_dr','Sir Bumbleby, Dragonslayer','Knights','red',5,true,false),
('axel','Axel the Barbarian','Knights','orange',9,true,false),
('valkyra','Valkyra Stormshield','Knights','purple',7,true,false),
('bannerboy','Banner Benny','Knights','green',1,true,false),
('jester','Jangles the Jester','Knights','yellow',6,true,false),
('gallant','Gallant Gwen','Knights','green',4,true,false),
('rustbucket','Old Rustbucket','Knights','blue',6,true,false),
('fizzwick','Fizzwick the Fumbling','Wizards','purple',9,true,false),
('madame_m','Madame Moonquill','Wizards','silver',2,true,false),
('hexie','Hexie Hollowbrew','Wizards','green',5,true,false),
('bookwyrm','The Spellbook','Wizards','black',3,true,false),
('potion','Bubbly Potion','Wizards','orange',1,true,false),
('owl_hoot','Professor Hootsworth','Wizards','yellow',4,true,false),
('fizzwick_pro','Fizzwick, Grand Sorcerer','Wizards','blue',4,true,false),
('cosmo_crys','Crystalia','Wizards','blue',7,true,false),
('grimble','Grimble Gloomcloak','Wizards','black',8,true,false),
('emberine','Emberine','Wizards','red',6,true,false),
('toadwart','Toadwart','Wizards','green',10,true,false),
('broomzy','Broomzy','Wizards','yellow',5,true,false),
('pupil','Apprentice Ada','Wizards','red',3,true,false),
('runestone','Runestone Ringo','Wizards','orange',6,true,false),
('boltz','Boltz','Robots','silver',10,true,false),
('sprocket','Sprocket Sue','Robots','orange',4,true,false),
('megacrank','Mega Crank','Robots','red',9,true,false),
('wrenchie','Wrenchie','Robots','yellow',1,true,false),
('toastbot','Toastbot 2.0','Robots','red',3,true,false),
('overclock','Dr. Overclock','Robots','purple',7,true,false),
('scrapyard','Scrap Heap Yard','Robots','black',2,true,false),
('boltz_jr','Boltz Jr.','Robots','blue',2,true,false),
('dronie','Dronie','Robots','blue',5,true,false),
('gearbeast','Gear Hound','Robots','green',6,true,false),
('voltara','Voltara','Robots','yellow',8,true,false),
('clanker','Clanker','Robots','black',6,true,false),
('nanobot','Nano Swarm','Robots','green',3,true,false),
('servo','Servo Sam','Robots','purple',4,true,false),
('boobee','Boobert','Ghosts','blue',9,true,false),
('wailina','Wailina','Ghosts','purple',4,true,false),
('poltergust','Poltergust','Ghosts','red',6,true,false),
('chainsy','Chainsy','Ghosts','silver',2,true,false),
('boobee_sheet','Boobert in a Bedsheet','Ghosts','green',3,true,false),
('creakhouse','Creaky Attic','Ghosts','black',3,true,false),
('glimmerghost','Lanterna','Ghosts','yellow',7,true,false),
('spookitty','Spookitty','Ghosts','purple',5,true,false),
('fogg','Mister Fogg','Ghosts','green',8,true,false),
('shriek','Shriek','Ghosts','orange',1,true,false),
('ectopup','Ecto-Pup','Ghosts','blue',4,true,false),
('haunttv','Haunted Telly','Ghosts','orange',6,true,false),
('phantomime','Phantomime','Ghosts','red',5,true,false),
('whisp_twin','Whisper & Wheeze','Ghosts','silver',10,true,false),
('redbeard','Captain Rumbeard','Pirates','red',10,true,false),
('polly','Squawkers','Pirates','green',3,true,false),
('deckhand','Deckhand Dottie','Pirates','yellow',4,true,false),
('saltyship','The Soggy Biscuit','Pirates','black',5,true,false),
('hookie','Hookie Lou','Pirates','purple',6,true,false),
('goldie','Goldie Doubloon','Pirates','orange',1,true,false),
('admiral','Admiral Anchorsworth','Pirates','silver',2,true,false),
('peglegpete','Barnacle Bart','Pirates','blue',8,true,false),
('cannonball','Cannonball Kip','Pirates','red',4,true,false),
('treasurem','Treasure Map Tess','Pirates','orange',5,true,false),
('redbeard_ghost','Rumbeard''s Ghost Crew','Pirates','blue',3,true,false),
('sharkbait','Harpoon Hattie','Pirates','green',7,true,false),
('monkey_m','Mizzen the Monkey','Pirates','yellow',6,true,false),
('krakenkid','Inkbeard Ike','Pirates','purple',9,true,false),
('kitsu','Kitsu Swiftpaw','Ninjas','black',9,true,false),
('pandakick','Rollo Redpaw','Ninjas','green',10,true,false),
('sensei','Sensei Snailsworth','Ninjas','silver',2,true,false),
('shuriko','Shuriko','Ninjas','red',4,true,false),
('smokebomb','Smokebomb Sid','Ninjas','purple',5,true,false),
('dojo','Moonlight Dojo','Ninjas','black',3,true,false),
('kitsu_shadow','Kitsu, Shadow Form','Ninjas','purple',4,true,false),
('blinkblade','Blinkblade','Ninjas','blue',7,true,false),
('froggy_n','Ribbit Ronin','Ninjas','green',6,true,false),
('cherry','Cherry Blossom Bo','Ninjas','yellow',1,true,false),
('oni_onigiri','Oni-Giri','Ninjas','orange',3,true,false),
('nightowl','Night Owl Nori','Ninjas','blue',8,true,false),
('lanternfox','Kitsu''s Lantern Kit','Ninjas','orange',5,true,false),
('robo_r','Iron Ronin','Ninjas','red',6,true,false),
('nutsy','Nutsy Nutkin','Critters','orange',9,true,false),
('bramble_b','Bramble Badger','Critters','black',8,true,false),
('hedgie','Hedgie Pricklepants','Critters','green',4,true,false),
('burrow','The Big Burrow','Critters','silver',2,true,false),
('bunbun','Bunsy Hopsworth','Critters','blue',10,true,false),
('racoon','Rascal Raccoon','Critters','purple',6,true,false),
('mole','Molly Mole','Critters','yellow',3,true,false),
('otter','Ollie Otter','Critters','blue',5,true,false),
('skunk','Stinky Steve','Critters','red',4,true,false),
('possum','Granny Possum','Critters','green',1,true,false),
('frogking','Toadstool Tad','Critters','orange',3,true,false),
('mousey','Squeaks McCheese','Critters','yellow',7,true,false),
('nutsy_jet','Nutsy Rocket Acorn','Critters','red',5,true,false),
('beaver','Chompsy Beaver','Critters','green',6,true,false),
('inkwell','Inkwell the Octopus','Sea Creatures','purple',9,true,false),
('puffbert','Puffbert','Sea Creatures','yellow',5,true,false),
('shellby','Shellby','Sea Creatures','green',8,true,false),
('crabby','Crabby Pinchworth','Sea Creatures','red',6,true,false),
('jellie','Jellie Jiggles','Sea Creatures','blue',3,true,false),
('seahorse','Captain Seahoof','Sea Creatures','orange',4,true,false),
('coralcastle','Coral Castle','Sea Creatures','black',3,true,false),
('whalel','Big Blue Bubba','Sea Creatures','blue',10,true,false),
('angler','Glim the Anglerfish','Sea Creatures','black',6,true,false),
('starla','Starla Starfish','Sea Creatures','orange',1,true,false),
('mermaidkid','Coralie Tidewhistle','Sea Creatures','green',7,true,false),
('inkwell_baby','Baby Inkwell','Sea Creatures','purple',2,true,false),
('clamshell','Clammy','Sea Creatures','silver',2,true,false),
('eel_zap','Sparky Eel','Sea Creatures','red',5,true,false),
('zorp','Zorp','Space Aliens','green',9,true,false),
('glorbina','Glorbina','Space Aliens','purple',3,true,false),
('saucer','The Wobble Saucer','Space Aliens','silver',5,true,false),
('blorgo','Blorgo the Conqueror','Space Aliens','red',7,true,false),
('moonmoo','Moon Moo','Space Aliens','yellow',4,true,false),
('zorp_ray','Zorp & the Shrink Ray','Space Aliens','blue',3,true,false),
('nebulina','Nebulina','Space Aliens','purple',8,true,false),
('gloopgoo','Goo-Goo Squid','Space Aliens','orange',6,true,false),
('beamer','Beamer','Space Aliens','blue',1,true,false),
('spudnik','Spudnik','Space Aliens','orange',5,true,false),
('crater','Crater Kid','Space Aliens','red',4,true,false),
('elder','Elder Glimmerbrain','Space Aliens','black',2,true,false),
('starpup','Comet Critter','Space Aliens','yellow',10,true,false),
('zapzorb','Zapzorb','Space Aliens','green',6,true,false),
('blazey','Blazey','Elementals','red',9,true,false),
('splashy','Splashy','Elementals','blue',8,true,false),
('pebble','Pebbles Boulderton','Elementals','orange',10,true,false),
('gusty','Gusty','Elementals','silver',4,true,false),
('voltie','Voltie','Elementals','yellow',3,true,false),
('mudslide','Muddle','Elementals','green',5,true,false),
('frosty','Frostina','Elementals','blue',6,true,false),
('magmatt','Magma Matt','Elementals','red',6,true,false),
('blazey_inferno','Blazey Inferno','Elementals','orange',4,true,false),
('sproutling','Sproutling','Elementals','green',1,true,false),
('crystalcave','Crystal Core','Elementals','black',2,true,false),
('stormy','Stormy','Elementals','purple',7,true,false),
('sandy','Sandy Swirl','Elementals','yellow',3,true,false),
('smog','Smoggle','Elementals','purple',5,true,false),
('mumbles','Mumbles','Undead','yellow',9,true,false),
('pharoh','Pharaoh Wrapsody','Undead','silver',2,true,false),
('rattles','Rattles','Undead','orange',8,true,false),
('zomb','Zeke the Zombie','Undead','green',6,true,false),
('mumbles_wrap','Mumbles Unwrapped','Undead','purple',4,true,false),
('tomb','Rattling Tomb','Undead','black',3,true,false),
('gravedigger','Digby Graves','Undead','blue',4,true,false),
('banshee','Lady Rattlebone','Undead','purple',7,true,false),
('bonedog','Fetch','Undead','yellow',3,true,false),
('cat_mummy','Whiskerwrap','Undead','orange',5,true,false),
('zombiechef','Chef Rotten-Toot','Undead','green',1,true,false),
('lichling','Lichling','Undead','blue',6,true,false),
('vampbat','Nibbles','Undead','red',5,true,false),
('ghoulgirl','Gravella Pompom','Undead','red',10,true,false),
('gummo','Gummo Jigglewump','Candy Folk','red',9,true,false),
('lolli','Lolli Swirlpop','Candy Folk','purple',10,true,false),
('cupcake','Captain Cupcake','Candy Folk','orange',4,true,false),
('gumdrop','Gumdrop Gail','Candy Folk','green',3,true,false),
('choco','Chocolonel Fudge','Candy Folk','silver',2,true,false),
('candyshop','Sugarplum Shoppe','Candy Folk','black',3,true,false),
('sourpuss','Sour Sally','Candy Folk','yellow',6,true,false),
('caramel','Caramelo','Candy Folk','orange',5,true,false),
('bubblegum','Bubbles Chewsworth','Candy Folk','purple',4,true,false),
('mint','Minty Fresh','Candy Folk','blue',1,true,false),
('cupcake_mega','Captain Cupcake XL','Candy Folk','red',8,true,false),
('jawbreaker','Jawbreaker Jax','Candy Folk','blue',7,true,false),
('cottonc','Cotton Candy Cloud','Candy Folk','blue',5,true,false),
('licorice','Licorice Larry','Candy Folk','green',6,true,false),
('rexie','Rexie Roarington','Dinos','green',10,true,false),
('tricera','Trixie Tops','Dinos','orange',5,true,false),
('ptero','Ptero Pete','Dinos','blue',4,true,false),
('stego','Steggy','Dinos','purple',8,true,false),
('bronto','Big Bertie Bronto','Dinos','yellow',9,true,false),
('raptor','Razz the Raptor','Dinos','red',6,true,false),
('dinoegg','Eggbert','Dinos','yellow',1,true,false),
('rexie_baby','Baby Rexie','Dinos','green',3,true,false),
('ankylo','Clubtail Carl','Dinos','blue',6,true,false),
('jungle','Prehistoric Peak','Dinos','black',3,true,false),
('caveman','Grug-a-Lug','Dinos','silver',2,true,false),
('spino','Spinny Spino','Dinos','purple',5,true,false),
('dilo','Frillophus','Dinos','red',4,true,false),
('pachy','Bonk Headbutt','Dinos','orange',7,true,false),
('ob_nightbane','Lord Nightbane','Obsidian Order','black',9,false,true),
('ob_onyxion','Onyxion the Obsidian Dragon','Obsidian Order','black',10,false,true),
('ob_drakerider','Sir Vex Drakerider','Obsidian Order','red',6,false,true),
('ob_shadewyrm','Umbrafang the Shadow Wyrm','Obsidian Order','purple',7,false,true),
('ob_embersquire','Ember Squire Ashby','Obsidian Order','orange',3,false,true),
('ob_smolder','Smolder the Obsidian Whelp','Obsidian Order','yellow',3,false,true),
('ob_citadel','The Obsidian Citadel','Obsidian Order','black',4,false,true),
('ob_ravenna','Dame Ravenna Duskhelm','Obsidian Order','silver',6,false,true)on conflict (id) do update set name = excluded.name, archetype = excluded.archetype, color = excluded.color, pts = excluded.pts, pack_pool = excluded.pack_pool, admin_only = excluded.admin_only;

insert into public.starter_decks (deck_key, card_id, slot) values
('galaxy','zoomer',0),
('galaxy','nell',1),
('galaxy','bleep',2),
('galaxy','gravitron',3),
('galaxy','astropup',4),
('galaxy','starhopper',5),
('galaxy','lunara',6),
('galaxy','cometkid',7),
('galaxy','zap',8),
('galaxy','dj',9),
('galaxy','petal',10),
('galaxy','quack',11),
('spooky','gloop',0),
('spooky','fangly',1),
('spooky','bertha',2),
('spooky','wisp',3),
('spooky','manor',4),
('spooky','bonesy',5),
('spooky','pumpkin',6),
('spooky','mel',7),
('spooky','sneak',8),
('spooky','thorn',9),
('spooky','mayor',10),
('spooky','timid',11),
('barnyard','hank',0),
('barnyard','clara',1),
('barnyard','moomax',2),
('barnyard','fritz',3),
('barnyard','tractor',4),
('barnyard','quack',5),
('barnyard','weasel',6),
('barnyard','granny',7),
('barnyard','mossy',8),
('barnyard','hank_mud',9),
('barnyard','rosie',10),
('barnyard','blaze',11),
('sprout','pip',0),
('sprout','daisy',1),
('sprout','treehouse',2),
('sprout','bud',3),
('sprout','mossy',4),
('sprout','weedwhack',5),
('sprout','petal',6),
('sprout','pip_armor',7),
('sprout','thorn',8),
('sprout','mayor',9),
('sprout','rosie',10),
('sprout','zap',11),
('batch1','ember',0),
('batch1','glimmer',1),
('batch1','twinkle',2),
('batch1','dewdrop',3),
('batch1','sirbumble',4),
('batch1','dame_dash',5),
('batch1','fizzwick',6),
('batch1','madame_m',7),
('batch1','boltz',8),
('batch1','sprocket',9),
('batch1','boobee',10),
('batch1','wailina',11)on conflict (deck_key, slot) do update set card_id = excluded.card_id;


create or replace function public.admin_end_auction(p_lot uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.auctions set ends_at = now() - interval '1 second' where id = p_lot and status = 'open';
  return public.settle_auction(p_lot);
end;
$$;

revoke all on function public.give_copy(uuid, text, boolean, int) from public, anon, authenticated;
revoke all on function public.take_copy(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.setting(text, int) to anon, authenticated;
grant execute on function public.theme_pack_price(text) to anon, authenticated;
grant execute on function public.buy_pack() to authenticated;
grant execute on function public.claim_daily() to authenticated;
grant execute on function public.open_pack(text, text) to authenticated;
grant execute on function public.choose_starter(text) to authenticated;
grant execute on function public.record_match_result(text, text) to authenticated;
grant execute on function public.set_showcase(jsonb) to authenticated;
grant execute on function public.set_avatar(text) to authenticated;
grant execute on function public.save_deck(text, jsonb) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(text) to authenticated;
grant execute on function public.create_auction(text, boolean, int, bigint) to authenticated;
grant execute on function public.place_bid(uuid, int) to authenticated;
grant execute on function public.settle_auction(uuid) to anon, authenticated;
grant execute on function public.cancel_auction(uuid, boolean) to authenticated;
grant execute on function public.admin_give_coins(uuid, int) to authenticated;
grant execute on function public.admin_give_packs(uuid, int) to authenticated;
grant execute on function public.admin_give_card(uuid, text, boolean) to authenticated;
grant execute on function public.admin_give_all(uuid, boolean) to authenticated;
grant execute on function public.admin_set_prices(jsonb) to authenticated;
grant execute on function public.admin_list_players() to authenticated;
grant execute on function public.admin_end_auction(uuid) to authenticated;

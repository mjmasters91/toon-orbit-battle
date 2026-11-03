-- Notable pack pulls for the public home feed.
-- Do not apply from the client. Review this file, then run it in the Supabase SQL editor.
-- Only open_pack writes the feed. Gold copies are always notable. So are Rare and
-- Legendary cards (6+ and 8+ printed points). There is no Epic tier in the card table.
-- Obsidian cards never appear.

create table if not exists public.pull_feed (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  card_id text not null,
  is_gold boolean not null default false,
  rarity text not null,
  pack_kind text not null default 'standard',
  created_at timestamptz not null default now()
);

create index if not exists pull_feed_created_idx on public.pull_feed (created_at desc);

alter table public.pull_feed enable row level security;

revoke all on public.pull_feed from public, anon, authenticated;
revoke all on sequence public.pull_feed_id_seq from public, anon, authenticated;
revoke truncate, trigger, references on public.pull_feed from anon, authenticated;

create or replace function public.card_rarity(p_pts int)
returns text language sql immutable as $$
  select case
    when coalesce(p_pts, 0) >= 8 then 'Legendary'
    when p_pts >= 6 then 'Rare'
    when p_pts >= 4 then 'Uncommon'
    else 'Common'
  end;
$$;

create or replace function public.record_notable_pull(p_user uuid, p_card text, p_gold boolean, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare
  card_pts int;
  admin_flag boolean;
  band text;
  uname text;
begin
  if p_user is null or p_card is null or p_card = '' or p_card like 'ob_%' then
    return;
  end if;
  select c.pts, c.admin_only into card_pts, admin_flag
  from public.cards c
  where c.id = p_card;
  if admin_flag is null or admin_flag then
    return;
  end if;
  band := public.card_rarity(card_pts);
  if not coalesce(p_gold, false) and band not in ('Rare', 'Legendary') then
    return;
  end if;
  select username into uname from public.profiles where id = p_user;
  if uname is null then
    return;
  end if;
  insert into public.pull_feed (user_id, username, card_id, is_gold, rarity, pack_kind)
  values (p_user, uname, p_card, coalesce(p_gold, false), band, left(coalesce(nullif(p_kind, ''), 'standard'), 40));
  delete from public.pull_feed where created_at < now() - interval '7 days';
  delete from public.pull_feed
  where id in (
    select id from public.pull_feed
    order by created_at desc
    offset 500
  );
end;
$$;

create or replace function public.public_recent_pulls(p_limit int default 15)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  n int := least(30, greatest(1, coalesce(p_limit, 15)));
  rows jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'username', s.username,
    'card_id', s.card_id,
    'is_gold', s.is_gold,
    'rarity', s.rarity,
    'created_at', s.created_at
  ) order by s.created_at desc), '[]'::jsonb)
  into rows
  from (
    select f.username, f.card_id, f.is_gold, f.rarity, f.created_at
    from public.pull_feed f
    join public.cards c on c.id = f.card_id
    where c.admin_only = false
      and f.card_id not like 'ob_%'
      and f.created_at >= now() - interval '7 days'
    order by f.created_at desc
    limit n
  ) s;
  return rows;
end;
$$;

revoke execute on function public.card_rarity(int) from public, anon, authenticated;
revoke execute on function public.record_notable_pull(uuid, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.public_recent_pulls(int) from public;
grant execute on function public.public_recent_pulls(int) to anon, authenticated;

-- Pack openings are the only writer. Inventory covers the daily pack and bought packs.
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
  kind text;
begin
  select * into prof from public.profiles where id = uid for update;
  if p_mode = 'inventory' then
    if prof.unopened_packs < 1 then
      raise exception 'No unopened packs.';
    end if;
    update public.profiles set unopened_packs = unopened_packs - 1, packs_opened = packs_opened + 1 where id = uid;
    select coalesce(array_agg(id), '{}') into pool from public.cards where pack_pool;
    kind := 'standard';
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
    kind := p_theme;
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
    perform public.record_notable_pull(uid, cid, is_gold, kind);
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

alter table public.pull_feed replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.pull_feed;
  exception when duplicate_object or undefined_object then
    null;
  end;
end $$;

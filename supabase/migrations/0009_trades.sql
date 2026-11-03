-- Player-to-player trades. Cards and coins move only inside accept_trade.
-- Do not apply from the client. Review this file, then run it in the Supabase SQL editor.
-- Offers last 3 days. Nothing is escrowed: accept re-checks both collections
-- under row locks, so a copy listed in an auction or already swapped fails cleanly.
-- Obsidian (ob_* / admin_only) cards cannot be traded.

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id),
  to_id uuid not null references public.profiles(id),
  offer_cards jsonb not null default '[]'::jsonb,
  offer_coins int not null default 0 check (offer_coins >= 0),
  want_cards jsonb not null default '[]'::jsonb,
  want_coins int not null default 0 check (want_coins >= 0),
  message text not null default '',
  status text not null default 'open',
  parent_id uuid references public.trades(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days'),
  settled_at timestamptz,
  check (from_id <> to_id),
  check (status in ('open', 'accepted', 'declined', 'cancelled', 'expired', 'countered'))
);

create index if not exists trades_incoming_open on public.trades (to_id, created_at desc) where status = 'open';
create index if not exists trades_outgoing_open on public.trades (from_id, created_at desc) where status = 'open';

create table if not exists public.trade_log (
  id bigserial primary key,
  trade_id uuid not null references public.trades(id),
  actor uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.trades enable row level security;
alter table public.trade_log enable row level security;

drop policy if exists trades_parties on public.trades;
create policy trades_parties on public.trades for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists trade_log_parties on public.trade_log;
create policy trade_log_parties on public.trade_log for select to authenticated
  using (exists (
    select 1 from public.trades t
    where t.id = trade_id and (t.from_id = auth.uid() or t.to_id = auth.uid())
  ));

revoke all on public.trades from public, anon, authenticated;
grant select on public.trades to authenticated;
revoke all on public.trade_log from public, anon, authenticated;
grant select on public.trade_log to authenticated;
revoke all on sequence public.trade_log_id_seq from public, anon, authenticated;
revoke truncate, trigger, references on public.trades, public.trade_log from anon, authenticated;

-- ---------- internals ----------
create or replace function public.trade_expire()
returns void language plpgsql security definer set search_path = public as $$
begin
  with gone as (
    update public.trades
    set status = 'expired', settled_at = now()
    where status = 'open' and expires_at <= now()
    returning id
  )
  insert into public.trade_log (trade_id, actor, action, detail)
  select gone.id, null, 'expired', '{}'::jsonb from gone;
end;
$$;

create or replace function public.trade_pack(p_cards jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  grouped jsonb;
  line jsonb;
  cid text;
  is_gold boolean;
  copies int;
  admin_flag boolean;
  lines int := 0;
  total int := 0;
begin
  if p_cards is null or jsonb_typeof(p_cards) = 'null' then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_cards) <> 'array' then
    raise exception 'Cards must be a list.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.card_id, 'gold', s.is_gold, 'n', s.copies
  ) order by s.card_id, s.is_gold), '[]'::jsonb)
  into grouped
  from (
    select e.value->>'id' as card_id,
           coalesce((e.value->>'gold')::boolean, false) as is_gold,
           sum(coalesce((e.value->>'n')::int, 1))::int as copies
    from jsonb_array_elements(p_cards) as e(value)
    group by 1, 2
  ) s;
  for line in select value from jsonb_array_elements(grouped)
  loop
    cid := line->>'id';
    is_gold := coalesce((line->>'gold')::boolean, false);
    copies := coalesce((line->>'n')::int, 0);
    if cid is null or cid = '' or copies < 1 or copies > 20 then
      raise exception 'That card is not tradable.';
    end if;
    if cid like 'ob_%' then
      raise exception 'Obsidian cards cannot be traded.';
    end if;
    select c.admin_only into admin_flag from public.cards c where c.id = cid;
    if admin_flag is null then
      raise exception 'Unknown card.';
    end if;
    if admin_flag then
      raise exception 'Obsidian cards cannot be traded.';
    end if;
    lines := lines + 1;
    total := total + copies;
  end loop;
  if lines > 12 or total > 24 then
    raise exception 'That offer is too large.';
  end if;
  return grouped;
end;
$$;

create or replace function public.trade_named(p_cards jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.value->>'id',
    'gold', coalesce((e.value->>'gold')::boolean, false),
    'n', coalesce((e.value->>'n')::int, 1),
    'name', c.name
  ) order by c.name), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) as e(value)
  left join public.cards c on c.id = e.value->>'id';
$$;

create or replace function public.trade_hold(p_user uuid, p_cards jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  line jsonb;
  have int;
begin
  for line in select value from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
  loop
    select col.count into have
    from public.collection col
    where col.user_id = p_user
      and col.card_id = line->>'id'
      and col.gold = coalesce((line->>'gold')::boolean, false)
    for update;
    if have is null or have < coalesce((line->>'n')::int, 1) then
      raise exception 'Those cards are no longer available.';
    end if;
  end loop;
end;
$$;

create or replace function public.trade_move(p_from uuid, p_to uuid, p_cards jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  line jsonb;
  copies int;
  i int;
  cid text;
  is_gold boolean;
begin
  for line in select value from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
  loop
    cid := line->>'id';
    is_gold := coalesce((line->>'gold')::boolean, false);
    copies := coalesce((line->>'n')::int, 0);
    for i in 1..copies loop
      perform public.take_copy(p_from, cid, is_gold);
    end loop;
    perform public.give_copy(p_to, cid, is_gold, copies);
  end loop;
end;
$$;

create or replace function public.trade_insert(
  p_from uuid,
  p_to uuid,
  p_offer jsonb,
  p_offer_coins int,
  p_want jsonb,
  p_want_coins int,
  p_message text,
  p_parent uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  offer jsonb := public.trade_pack(p_offer);
  want jsonb := public.trade_pack(p_want);
  coins_out int := coalesce(p_offer_coins, 0);
  coins_in int := coalesce(p_want_coins, 0);
  note text := left(trim(coalesce(p_message, '')), 200);
  open_n int;
  have int;
  new_id uuid;
begin
  if p_from = p_to then
    raise exception 'You cannot trade with yourself.';
  end if;
  if coins_out < 0 or coins_in < 0 or coins_out > 1000000 or coins_in > 1000000 then
    raise exception 'That coin amount is not allowed.';
  end if;
  if offer = '[]'::jsonb and want = '[]'::jsonb and coins_out = 0 and coins_in = 0 then
    raise exception 'Add cards or coins to the trade.';
  end if;
  perform public.trade_expire();
  select count(*) into open_n
  from public.trades
  where from_id = p_from and status = 'open' and expires_at > now();
  if open_n >= 20 then
    raise exception 'You already have 20 open offers.';
  end if;
  select coins into have from public.profiles where id = p_from for update;
  if have is null or have < coins_out then
    raise exception 'Not enough coins for this trade.';
  end if;
  select coins into have from public.profiles where id = p_to;
  if have is null or have < coins_in then
    raise exception 'They do not have those coins.';
  end if;
  perform public.trade_hold(p_from, offer);
  perform public.trade_hold(p_to, want);
  insert into public.trades (from_id, to_id, offer_cards, offer_coins, want_cards, want_coins, message, parent_id)
  values (p_from, p_to, offer, coins_out, want, coins_in, note, p_parent)
  returning id into new_id;
  insert into public.trade_log (trade_id, actor, action, detail)
  values (new_id, p_from, 'created', jsonb_build_object('parent', p_parent));
  return new_id;
end;
$$;

-- ---------- player RPCs ----------
create or replace function public.create_trade(
  p_username text,
  p_offer_cards jsonb default '[]'::jsonb,
  p_offer_coins int default 0,
  p_want_cards jsonb default '[]'::jsonb,
  p_want_coins int default 0,
  p_message text default ''
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  other uuid;
  new_id uuid;
begin
  select id into other from public.profiles where lower(username) = lower(trim(coalesce(p_username, '')));
  if other is null then
    raise exception 'No player with that name.';
  end if;
  new_id := public.trade_insert(uid, other, p_offer_cards, p_offer_coins, p_want_cards, p_want_coins, p_message, null);
  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

create or replace function public.accept_trade(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  rec public.trades;
  from_coins int;
  to_coins int;
  first uuid;
  second uuid;
begin
  perform public.trade_expire();
  select * into rec from public.trades where id = p_id for update;
  if rec.id is null or rec.to_id <> uid then
    raise exception 'That trade is not open.';
  end if;
  if rec.status = 'expired' or rec.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'This offer expired.');
  end if;
  if rec.status <> 'open' then
    raise exception 'That trade is not open.';
  end if;
  if rec.from_id < rec.to_id then
    first := rec.from_id; second := rec.to_id;
  else
    first := rec.to_id; second := rec.from_id;
  end if;
  perform 1 from public.profiles where id = first for update;
  perform 1 from public.profiles where id = second for update;
  select coins into from_coins from public.profiles where id = rec.from_id;
  select coins into to_coins from public.profiles where id = rec.to_id;
  if from_coins < rec.offer_coins or to_coins < rec.want_coins then
    raise exception 'Not enough coins to finish this trade.';
  end if;
  perform public.trade_hold(rec.from_id, rec.offer_cards);
  perform public.trade_hold(rec.to_id, rec.want_cards);
  perform public.trade_move(rec.from_id, rec.to_id, rec.offer_cards);
  perform public.trade_move(rec.to_id, rec.from_id, rec.want_cards);
  update public.profiles
  set coins = coins - rec.offer_coins + rec.want_coins
  where id = rec.from_id;
  update public.profiles
  set coins = coins - rec.want_coins + rec.offer_coins
  where id = rec.to_id;
  update public.trades set status = 'accepted', settled_at = now() where id = rec.id;
  insert into public.trade_log (trade_id, actor, action, detail)
  values (rec.id, uid, 'accepted', jsonb_build_object(
    'offer_cards', rec.offer_cards,
    'want_cards', rec.want_cards,
    'offer_coins', rec.offer_coins,
    'want_coins', rec.want_coins
  ));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.decline_trade(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  rec public.trades;
begin
  perform public.trade_expire();
  select * into rec from public.trades where id = p_id for update;
  if rec.id is null or rec.to_id <> uid or rec.status <> 'open' then
    raise exception 'That trade is not open.';
  end if;
  update public.trades set status = 'declined', settled_at = now() where id = rec.id;
  insert into public.trade_log (trade_id, actor, action) values (rec.id, uid, 'declined');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cancel_trade(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  rec public.trades;
begin
  perform public.trade_expire();
  select * into rec from public.trades where id = p_id for update;
  if rec.id is null or rec.from_id <> uid or rec.status <> 'open' then
    raise exception 'That trade is not open.';
  end if;
  update public.trades set status = 'cancelled', settled_at = now() where id = rec.id;
  insert into public.trade_log (trade_id, actor, action) values (rec.id, uid, 'cancelled');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.counter_trade(
  p_id uuid,
  p_offer_cards jsonb default '[]'::jsonb,
  p_offer_coins int default 0,
  p_want_cards jsonb default '[]'::jsonb,
  p_want_coins int default 0,
  p_message text default ''
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  rec public.trades;
  new_id uuid;
begin
  perform public.trade_expire();
  select * into rec from public.trades where id = p_id for update;
  if rec.id is null or rec.to_id <> uid or rec.status <> 'open' then
    raise exception 'That trade is not open.';
  end if;
  new_id := public.trade_insert(uid, rec.from_id, p_offer_cards, p_offer_coins, p_want_cards, p_want_coins, p_message, rec.id);
  update public.trades set status = 'countered', settled_at = now() where id = rec.id;
  insert into public.trade_log (trade_id, actor, action, detail)
  values (rec.id, uid, 'countered', jsonb_build_object('next', new_id));
  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

create or replace function public.my_trades()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  incoming jsonb;
  outgoing jsonb;
  purse int;
begin
  perform public.trade_expire();
  select coins into purse from public.profiles where id = uid;
  select coalesce(jsonb_agg(row_to_json(s)::jsonb order by s.created_at desc), '[]'::jsonb) into incoming
  from (
    select t.id, t.status, t.message, t.offer_coins, t.want_coins,
           public.trade_named(t.offer_cards) as offer_cards,
           public.trade_named(t.want_cards) as want_cards,
           fp.username as from_name, tp.username as to_name,
           t.created_at, t.expires_at
    from public.trades t
    join public.profiles fp on fp.id = t.from_id
    join public.profiles tp on tp.id = t.to_id
    where t.to_id = uid and t.status = 'open'
  ) s;
  select coalesce(jsonb_agg(row_to_json(s)::jsonb order by s.created_at desc), '[]'::jsonb) into outgoing
  from (
    select t.id, t.status, t.message, t.offer_coins, t.want_coins,
           public.trade_named(t.offer_cards) as offer_cards,
           public.trade_named(t.want_cards) as want_cards,
           fp.username as from_name, tp.username as to_name,
           t.created_at, t.expires_at
    from public.trades t
    join public.profiles fp on fp.id = t.from_id
    join public.profiles tp on tp.id = t.to_id
    where t.from_id = uid
    order by t.created_at desc
    limit 40
  ) s;
  return jsonb_build_object('coins', coalesce(purse, 0), 'incoming', incoming, 'outgoing', outgoing);
end;
$$;

create or replace function public.trade_browse(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  other uuid;
  uname text;
  purse int;
  cards jsonb;
begin
  if uid is null then
    raise exception 'Log in first.';
  end if;
  select id, username, coins into other, uname, purse
  from public.profiles
  where lower(username) = lower(trim(coalesce(p_username, '')));
  if other is null then
    raise exception 'No player with that name.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', col.card_id,
    'gold', col.gold,
    'n', col.count,
    'name', c.name,
    'pts', c.pts,
    'archetype', c.archetype,
    'color', c.color
  ) order by c.name, col.gold), '[]'::jsonb) into cards
  from public.collection col
  join public.cards c on c.id = col.card_id
  where col.user_id = other
    and col.count > 0
    and c.admin_only = false
    and col.card_id not like 'ob_%';
  return jsonb_build_object('username', uname, 'coins', purse, 'cards', cards);
end;
$$;

revoke execute on function public.trade_expire() from public, anon, authenticated;
revoke execute on function public.trade_pack(jsonb) from public, anon, authenticated;
revoke execute on function public.trade_named(jsonb) from public, anon, authenticated;
revoke execute on function public.trade_hold(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.trade_move(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.trade_insert(uuid, uuid, jsonb, int, jsonb, int, text, uuid) from public, anon, authenticated;

revoke execute on function public.create_trade(text, jsonb, int, jsonb, int, text) from public, anon;
grant execute on function public.create_trade(text, jsonb, int, jsonb, int, text) to authenticated;
revoke execute on function public.accept_trade(uuid) from public, anon;
grant execute on function public.accept_trade(uuid) to authenticated;
revoke execute on function public.decline_trade(uuid) from public, anon;
grant execute on function public.decline_trade(uuid) to authenticated;
revoke execute on function public.cancel_trade(uuid) from public, anon;
grant execute on function public.cancel_trade(uuid) to authenticated;
revoke execute on function public.counter_trade(uuid, jsonb, int, jsonb, int, text) from public, anon;
grant execute on function public.counter_trade(uuid, jsonb, int, jsonb, int, text) to authenticated;
revoke execute on function public.my_trades() from public, anon;
grant execute on function public.my_trades() to authenticated;
revoke execute on function public.trade_browse(text) from public, anon;
grant execute on function public.trade_browse(text) to authenticated;

alter table public.trades replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.trades;
  exception when duplicate_object or undefined_object then
    null;
  end;
end $$;

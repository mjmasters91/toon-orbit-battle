-- Aetherfall accounts. Not applied.
-- Review this file, then run it in the Supabase SQL editor for project orbzytpukjywqkbkbtcs.
-- It does not alter Toon Orbit Battle tables or functions. It only reads public.profiles
-- to seed af_admins and to recognize an existing admin role.
-- Players sign in with the same username and password as Toon Orbit Battle.
-- The client stores that username as <username>@players.toonorbit.app.
-- Hosted Supabase rejects DELETE and UPDATE with no WHERE. This file has neither.

-- ---------- catalog (server copy of the roster; the client cannot invent units) ----------
create table if not exists public.af_catalog (
  id text primary key,
  name text not null,
  rarity int not null check (rarity in (3, 4, 5)),
  element text not null,
  role text not null,
  sort_order int not null unique
);

insert into public.af_catalog (id, name, rarity, element, role, sort_order) values
  ('veyra', 'Veyra Solenne', 5, 'fire', 'attacker', 1),
  ('calder', 'Calder Brine', 5, 'water', 'tank', 2),
  ('siff', 'Siff Gale', 5, 'wind', 'support', 3),
  ('thistle', 'Thistle Bram', 5, 'earth', 'healer', 4),
  ('iri', 'Halcyon Iri', 5, 'light', 'healer', 5),
  ('morr', 'Morr Vesper', 5, 'dark', 'attacker', 6),
  ('joss', 'Emberlin Joss', 4, 'fire', 'support', 7),
  ('pella', 'Pella Moor', 4, 'water', 'healer', 8),
  ('arun', 'Arun Kite', 4, 'wind', 'attacker', 9),
  ('osa', 'Osa Gravel', 4, 'earth', 'tank', 10),
  ('mae', 'Lantern Mae', 4, 'light', 'support', 11),
  ('cole', 'Umbryn Cole', 4, 'dark', 'tank', 12),
  ('rin', 'Rin Wisp', 4, 'fire', 'attacker', 13),
  ('marin', 'Marin Brook', 4, 'water', 'attacker', 14),
  ('pip', 'Ashen Pip', 3, 'fire', 'attacker', 15),
  ('nia', 'Nia Puddle', 3, 'water', 'support', 16),
  ('tam', 'Tam Breeze', 3, 'wind', 'healer', 17),
  ('puck', 'Puck Clay', 3, 'earth', 'tank', 18),
  ('tess', 'Tess Glow', 3, 'light', 'support', 19),
  ('rathe', 'Rathe Dusk', 3, 'dark', 'attacker', 20),
  ('hobb', 'Hobb Flint', 3, 'fire', 'tank', 21),
  ('sallow', 'Sallow Reed', 3, 'wind', 'attacker', 22),
  ('quinn', 'Quinn Pebble', 3, 'earth', 'healer', 23),
  ('lir', 'Lir Shade', 3, 'dark', 'support', 24)
on conflict (id) do nothing;

-- ---------- players, units, admins, audit ----------
create table if not exists public.af_players (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  gems int not null default 4500 check (gems >= 0 and gems <= 9999999),
  gold int not null default 8000 check (gold >= 0 and gold <= 9999999),
  tickets int not null default 1 check (tickets >= 0 and tickets <= 99),
  pity_wanderer int not null default 0 check (pity_wanderer between 0 and 79),
  pity_cinders int not null default 0 check (pity_cinders between 0 and 79),
  party text[] not null default array['pip', 'nia', 'tam', 'puck']::text[],
  leader int not null default 0 check (leader between 0 and 3),
  banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now(),
  constraint af_players_party_len check (array_length(party, 1) = 4)
);

create unique index if not exists af_players_username_lower on public.af_players (lower(username));

create table if not exists public.af_units (
  user_id uuid not null references public.af_players (id) on delete cascade,
  unit_id text not null references public.af_catalog (id),
  level int not null default 1 check (level between 1 and 40),
  awaken int not null default 0 check (awaken between 0 and 5),
  shards int not null default 0 check (shards >= 0 and shards <= 9999),
  primary key (user_id, unit_id)
);

create table if not exists public.af_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null
);

insert into public.af_admins (user_id, username)
select p.id, p.username
from public.profiles p
where lower(p.username) in ('mjmasters91', 'sender')
on conflict (user_id) do nothing;

create table if not exists public.af_admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  action text not null check (action in ('grant', 'ban', 'unban')),
  target_id uuid,
  target_username text,
  gems int not null default 0,
  gold int not null default 0,
  tickets int not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists af_admin_log_created on public.af_admin_log (created_at desc);

alter table public.af_players enable row level security;
alter table public.af_units enable row level security;
alter table public.af_catalog enable row level security;
alter table public.af_admins enable row level security;
alter table public.af_admin_log enable row level security;

drop policy if exists af_players_read_own on public.af_players;
create policy af_players_read_own on public.af_players
  for select to authenticated using (id = auth.uid());

drop policy if exists af_units_read_own on public.af_units;
create policy af_units_read_own on public.af_units
  for select to authenticated using (user_id = auth.uid());

drop policy if exists af_catalog_read on public.af_catalog;
create policy af_catalog_read on public.af_catalog
  for select to authenticated using (true);

revoke all on public.af_players from public, anon;
revoke all on public.af_units from public, anon;
revoke all on public.af_catalog from public, anon;
revoke all on public.af_admins from public, anon;
revoke all on public.af_admin_log from public, anon;
grant select on public.af_players to authenticated;
grant select on public.af_units to authenticated;
grant select on public.af_catalog to authenticated;

-- ---------- helpers ----------
create or replace function public.af_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.af_admins where user_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.af_pick_unit(p_rarity int, p_roll double precision, p_banner text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  feat text;
  rate double precision := 0;
  n int;
  idx int;
  chosen text;
  span double precision;
begin
  if p_roll < 0 or p_roll >= 1 then
    raise exception 'Bad roll.';
  end if;
  if p_banner = 'cinders' and p_rarity = 5 then
    feat := 'veyra';
    rate := 0.5;
  elsif p_banner = 'cinders' and p_rarity = 4 then
    feat := 'rin';
    rate := 0.5;
  end if;
  if feat is not null and p_roll < rate then
    return feat;
  end if;
  select count(*) into n
  from public.af_catalog
  where rarity = p_rarity and (feat is null or id <> feat);
  if coalesce(n, 0) = 0 then
    select id into chosen from public.af_catalog where rarity = p_rarity order by sort_order limit 1;
    return chosen;
  end if;
  if feat is not null then
    span := (p_roll - rate) / (1 - rate);
  else
    span := p_roll;
  end if;
  idx := least(n - 1, greatest(0, floor(span * n)::int));
  select id into chosen
  from (
    select id, row_number() over (order by sort_order) - 1 as rn
    from public.af_catalog
    where rarity = p_rarity and (feat is null or id <> feat)
  ) s
  where rn = idx;
  return chosen;
end;
$$;

create or replace function public.af_state_json(p_row public.af_players)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  units jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'unit_id', u.unit_id,
    'level', u.level,
    'awaken', u.awaken,
    'shards', u.shards
  ) order by u.unit_id), '[]'::jsonb)
  into units
  from public.af_units u
  where u.user_id = p_row.id;
  return jsonb_build_object(
    'player', jsonb_build_object(
      'id', p_row.id,
      'username', p_row.username,
      'gems', p_row.gems,
      'gold', p_row.gold,
      'tickets', p_row.tickets,
      'pity_wanderer', p_row.pity_wanderer,
      'pity_cinders', p_row.pity_cinders,
      'party', to_jsonb(p_row.party),
      'leader', p_row.leader,
      'banned', p_row.banned,
      'ban_reason', p_row.ban_reason,
      'admin', public.af_is_admin(),
      'created_at', p_row.created_at
    ),
    'units', units
  );
end;
$$;

create or replace function public.af_reject_banned(p_row public.af_players)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_row.banned then
    raise exception 'This account is banned: %', coalesce(nullif(trim(p_row.ban_reason), ''), 'No reason was recorded.');
  end if;
end;
$$;

-- ---------- signup kit ----------
create or replace function public.af_ensure_player()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  row public.af_players;
begin
  if uid is null then
    raise exception 'Log in first.';
  end if;
  select coalesce(nullif(trim(u.raw_user_meta_data->>'username'), ''), split_part(u.email, '@', 1))
  into uname
  from auth.users u
  where u.id = uid;
  if uname is null or uname = '' then
    uname := 'player' || substr(replace(uid::text, '-', ''), 1, 8);
  end if;
  insert into public.af_players (id, username)
  values (uid, uname)
  on conflict (id) do nothing;
  insert into public.af_units (user_id, unit_id)
  select uid, starter
  from unnest(array['pip', 'nia', 'tam', 'puck']::text[]) as starter
  where exists (select 1 from public.af_players where id = uid)
  on conflict (user_id, unit_id) do nothing;
  select * into row from public.af_players where id = uid;
  perform public.af_reject_banned(row);
  return public.af_state_json(row);
end;
$$;

-- ---------- summon (same rates, pity, and 10-pull promise as the client) ----------
create or replace function public.af_summon(p_banner text, p_count int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.af_players;
  pity int;
  i int;
  rarity_roll double precision;
  unit_roll double precision;
  pulls int;
  rar int;
  triggered boolean;
  chosen text;
  results jsonb := '[]'::jsonb;
  final jsonb := '[]'::jsonb;
  entry jsonb;
  has_high boolean;
  owned_row public.af_units;
  shard_add int;
  gained int;
  is_new boolean;
  costs int[] := array[40, 70, 110, 160, 220];
  cname text;
begin
  if uid is null then
    raise exception 'Log in first.';
  end if;
  if p_banner not in ('wanderer', 'cinders') then
    raise exception 'Unknown gate.';
  end if;
  if p_count not in (1, 10) then
    raise exception 'Choose a single summon or a 10-pull.';
  end if;
  select * into row from public.af_players where id = uid for update;
  if row.id is null then
    raise exception 'Log in first.';
  end if;
  perform public.af_reject_banned(row);
  if p_count = 10 and row.tickets > 0 then
    update public.af_players set tickets = tickets - 1 where id = uid;
  else
    if row.gems < (case when p_count = 10 then 3000 else 300 end) then
      raise exception 'Not enough gems.';
    end if;
    update public.af_players
    set gems = gems - (case when p_count = 10 then 3000 else 300 end)
    where id = uid;
  end if;
  pity := case when p_banner = 'cinders' then row.pity_cinders else row.pity_wanderer end;
  for i in 1..p_count loop
    rarity_roll := random();
    unit_roll := random();
    pulls := pity + 1;
    triggered := false;
    if pulls >= 80 then
      rar := 5;
      pity := 0;
      triggered := true;
    elsif rarity_roll < 0.03 then
      rar := 5;
      pity := 0;
    elsif rarity_roll < 0.21 then
      rar := 4;
      pity := pulls;
    else
      rar := 3;
      pity := pulls;
    end if;
    chosen := public.af_pick_unit(rar, unit_roll, p_banner);
    select name into cname from public.af_catalog where id = chosen;
    results := results || jsonb_build_array(jsonb_build_object(
      'unitId', chosen,
      'rarity', rar,
      'unitRoll', unit_roll,
      'pityTriggered', triggered,
      'guaranteed', false,
      'name', cname
    ));
  end loop;
  if p_count = 10 then
    select coalesce(bool_or((e->>'rarity')::int >= 4), false)
    into has_high
    from jsonb_array_elements(results) e;
    if not has_high then
      unit_roll := (results->9->>'unitRoll')::double precision;
      chosen := public.af_pick_unit(4, unit_roll, p_banner);
      select name into cname from public.af_catalog where id = chosen;
      results := jsonb_set(results, '{9,rarity}', '4'::jsonb);
      results := jsonb_set(results, '{9,unitId}', to_jsonb(chosen));
      results := jsonb_set(results, '{9,guaranteed}', 'true'::jsonb);
      results := jsonb_set(results, '{9,name}', to_jsonb(cname));
    end if;
  end if;
  for entry in select value from jsonb_array_elements(results) loop
    chosen := entry->>'unitId';
    rar := (entry->>'rarity')::int;
    is_new := false;
    shard_add := 0;
    gained := 0;
    select * into owned_row from public.af_units where user_id = uid and unit_id = chosen for update;
    if owned_row.user_id is null then
      insert into public.af_units (user_id, unit_id) values (uid, chosen);
      is_new := true;
    else
      shard_add := case rar when 5 then 40 when 4 then 25 else 10 end;
      owned_row.shards := owned_row.shards + shard_add;
      while owned_row.awaken < 5 and owned_row.shards >= costs[owned_row.awaken + 1] loop
        owned_row.shards := owned_row.shards - costs[owned_row.awaken + 1];
        owned_row.awaken := owned_row.awaken + 1;
        gained := gained + 1;
      end loop;
      update public.af_units
      set shards = owned_row.shards, awaken = owned_row.awaken
      where user_id = uid and unit_id = chosen;
    end if;
    final := final || jsonb_build_array(entry || jsonb_build_object(
      'isNew', is_new,
      'shardsAdded', shard_add,
      'awakensGained', gained
    ));
  end loop;
  if p_banner = 'cinders' then
    update public.af_players set pity_cinders = pity where id = uid;
  else
    update public.af_players set pity_wanderer = pity where id = uid;
  end if;
  select * into row from public.af_players where id = uid;
  return jsonb_build_object(
    'results', final,
    'state', public.af_state_json(row)
  );
end;
$$;

create or replace function public.af_level_up(p_unit text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.af_players;
  owned_row public.af_units;
  cost int;
begin
  if uid is null then
    raise exception 'Log in first.';
  end if;
  select * into row from public.af_players where id = uid for update;
  if row.id is null then
    raise exception 'Log in first.';
  end if;
  perform public.af_reject_banned(row);
  select * into owned_row from public.af_units where user_id = uid and unit_id = p_unit for update;
  if owned_row.user_id is null then
    raise exception 'That veinwalker is not summoned.';
  end if;
  if owned_row.level >= 40 then
    raise exception 'Already at the level cap.';
  end if;
  cost := 80 + (owned_row.level - 1) * 40;
  if row.gold < cost then
    raise exception 'Not enough gold.';
  end if;
  update public.af_players set gold = gold - cost where id = uid;
  update public.af_units set level = level + 1 where user_id = uid and unit_id = p_unit;
  select * into row from public.af_players where id = uid;
  return public.af_state_json(row);
end;
$$;

create or replace function public.af_set_party(p_party jsonb, p_leader int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.af_players;
  slots text[] := array[null, null, null, null];
  seen text[] := array[]::text[];
  i int;
  slot text;
  lead int;
begin
  if uid is null then
    raise exception 'Log in first.';
  end if;
  if jsonb_typeof(p_party) <> 'array' or jsonb_array_length(p_party) <> 4 then
    raise exception 'A party has four slots.';
  end if;
  select * into row from public.af_players where id = uid for update;
  if row.id is null then
    raise exception 'Log in first.';
  end if;
  perform public.af_reject_banned(row);
  for i in 0..3 loop
    if (p_party->i) = 'null'::jsonb or p_party->i is null then
      slot := null;
    else
      slot := p_party->>i;
      if slot is null or slot = '' then
        slot := null;
      elsif not exists (select 1 from public.af_units where user_id = uid and unit_id = slot) then
        raise exception 'That veinwalker is not summoned.';
      elsif slot = any(seen) then
        raise exception 'A veinwalker can only take one slot.';
      else
        seen := seen || slot;
      end if;
    end if;
    slots[i + 1] := slot;
  end loop;
  lead := coalesce(p_leader, 0);
  if lead < 0 or lead > 3 or slots[lead + 1] is null then
    lead := 0;
    for i in 1..4 loop
      if slots[i] is not null then
        lead := i - 1;
        exit;
      end if;
    end loop;
  end if;
  update public.af_players set party = slots, leader = lead where id = uid;
  select * into row from public.af_players where id = uid;
  return public.af_state_json(row);
end;
$$;

-- ---------- admin ----------
create or replace function public.af_admin_search(p_query text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw text := left(trim(coalesce(p_query, '')), 32);
  q text := replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_');
  rows jsonb;
begin
  if not public.af_is_admin() then
    raise exception 'Admins only.';
  end if;
  select coalesce(jsonb_agg(s.item order by s.username), '[]'::jsonb)
  into rows
  from (
    select p.username, jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'gems', p.gems,
      'gold', p.gold,
      'tickets', p.tickets,
      'banned', p.banned,
      'ban_reason', p.ban_reason,
      'created_at', p.created_at
    ) as item
    from public.af_players p
    where q = '' or p.username ilike '%' || q || '%' escape '\'
    order by p.username
    limit 40
  ) s;
  return jsonb_build_object('players', rows);
end;
$$;

create or replace function public.af_admin_grant(
  p_username text,
  p_gems int default 0,
  p_gold int default 0,
  p_tickets int default 0,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.af_players;
  add_gems int := coalesce(p_gems, 0);
  add_gold int := coalesce(p_gold, 0);
  add_tickets int := coalesce(p_tickets, 0);
begin
  if not public.af_is_admin() then
    raise exception 'Admins only.';
  end if;
  if add_gems < 0 or add_gold < 0 or add_tickets < 0 then
    raise exception 'Grants must be zero or positive.';
  end if;
  if add_gems = 0 and add_gold = 0 and add_tickets = 0 then
    raise exception 'Grant at least one currency.';
  end if;
  if add_gems > 100000 or add_gold > 100000 or add_tickets > 100 then
    raise exception 'That grant is too large.';
  end if;
  select * into target from public.af_players where lower(username) = lower(trim(p_username)) for update;
  if target.id is null then
    raise exception 'No Aetherfall player by that name.';
  end if;
  update public.af_players
  set gems = public.af_players.gems + add_gems,
      gold = public.af_players.gold + add_gold,
      tickets = least(99, public.af_players.tickets + add_tickets)
  where id = target.id;
  insert into public.af_admin_log (admin_id, action, target_id, target_username, gems, gold, tickets, note)
  values (uid, 'grant', target.id, target.username, add_gems, add_gold, add_tickets, nullif(left(trim(coalesce(p_note, '')), 200), ''));
  return jsonb_build_object('ok', true, 'username', target.username);
end;
$$;

create or replace function public.af_admin_ban(p_username text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.af_players;
  why text := left(trim(coalesce(p_reason, '')), 200);
begin
  if not public.af_is_admin() then
    raise exception 'Admins only.';
  end if;
  if why = '' then
    raise exception 'A ban needs a reason.';
  end if;
  select * into target from public.af_players where lower(username) = lower(trim(p_username)) for update;
  if target.id is null then
    raise exception 'No Aetherfall player by that name.';
  end if;
  if target.id = uid then
    raise exception 'You cannot ban this login.';
  end if;
  update public.af_players set banned = true, ban_reason = why where id = target.id;
  insert into public.af_admin_log (admin_id, action, target_id, target_username, note)
  values (uid, 'ban', target.id, target.username, why);
  return jsonb_build_object('ok', true, 'username', target.username);
end;
$$;

create or replace function public.af_admin_unban(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.af_players;
begin
  if not public.af_is_admin() then
    raise exception 'Admins only.';
  end if;
  select * into target from public.af_players where lower(username) = lower(trim(p_username)) for update;
  if target.id is null then
    raise exception 'No Aetherfall player by that name.';
  end if;
  update public.af_players set banned = false, ban_reason = null where id = target.id;
  insert into public.af_admin_log (admin_id, action, target_id, target_username, note)
  values (uid, 'unban', target.id, target.username, null);
  return jsonb_build_object('ok', true, 'username', target.username);
end;
$$;

create or replace function public.af_admin_log_recent()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rows jsonb;
begin
  if not public.af_is_admin() then
    raise exception 'Admins only.';
  end if;
  select coalesce(jsonb_agg(s.item order by s.created_at desc), '[]'::jsonb)
  into rows
  from (
    select l.created_at, jsonb_build_object(
      'action', l.action,
      'username', l.target_username,
      'gems', l.gems,
      'gold', l.gold,
      'tickets', l.tickets,
      'note', l.note,
      'created_at', l.created_at
    ) as item
    from public.af_admin_log l
    order by l.created_at desc
    limit 12
  ) s;
  return jsonb_build_object('entries', rows);
end;
$$;

revoke all on function public.af_is_admin() from public, anon;
revoke all on function public.af_pick_unit(int, double precision, text) from public, anon, authenticated;
revoke all on function public.af_state_json(public.af_players) from public, anon, authenticated;
revoke all on function public.af_reject_banned(public.af_players) from public, anon, authenticated;
revoke all on function public.af_ensure_player() from public, anon;
revoke all on function public.af_summon(text, int) from public, anon;
revoke all on function public.af_level_up(text) from public, anon;
revoke all on function public.af_set_party(jsonb, int) from public, anon;
revoke all on function public.af_admin_search(text) from public, anon;
revoke all on function public.af_admin_grant(text, int, int, int, text) from public, anon;
revoke all on function public.af_admin_ban(text, text) from public, anon;
revoke all on function public.af_admin_unban(text) from public, anon;
revoke all on function public.af_admin_log_recent() from public, anon;

grant execute on function public.af_is_admin() to authenticated;
grant execute on function public.af_ensure_player() to authenticated;
grant execute on function public.af_summon(text, int) to authenticated;
grant execute on function public.af_level_up(text) to authenticated;
grant execute on function public.af_set_party(jsonb, int) to authenticated;
grant execute on function public.af_admin_search(text) to authenticated;
grant execute on function public.af_admin_grant(text, int, int, int, text) to authenticated;
grant execute on function public.af_admin_ban(text, text) to authenticated;
grant execute on function public.af_admin_unban(text) to authenticated;
grant execute on function public.af_admin_log_recent() to authenticated;

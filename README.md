# Toon Orbit Battle

Toon Orbit Battle is an original card battle game for one player against a computer opponent. The characters and art are original.

Open `index.html` in a browser to play. No install or build step is required. Cards are round discs. On a phone, the same page fits the screen and can be added to the home screen.

The published game is at https://mjmasters91.github.io/toon-orbit-battle/.

## Adding a card

1. Add one object in `cards.js` (inside the list passed to `add`). Give it a unique `id`, plus `name`, `char`, `group`, `pts`, `color`, `features`, `power`, `powers`, and an `art` fallback used only when no image is available. Do not create a second entry for a gold version.
2. Add the face image at `assets/cards/<id>.webp`. Use a 512×512 picture with the character centered on dark navy. The game clips it to the round card.
3. Reload `index.html`. The card shows up in the deck builder, Card Gallery, and (once a player owns a copy) My Collection. To put it in a prebuilt deck, add its `id` to that deck's `cards` array in `cards.js`.

If `assets/cards/<id>.webp` is missing or fails to load, the card face falls back to the original SVG drawing from `art.js`. The name banner, point badge, and power star stay on top of either face.

Gold copies are cosmetic. A copy is the card definition plus `{gold: true}` (see `copies.js`). They score the same as the plain card. Each prebuilt deck deals one or two gold copies at random. Card Gallery, under the deck menu, can show every card's gold look.

## Accounts

The game is a static site. There is no backend in the default setup. Sign-in goes through `auth.js`, which exposes one provider interface:

| Method | Role |
| --- | --- |
| `signUp` | Create an account and start a session |
| `logIn` | Open an existing session |
| `logOut` | End the session |
| `currentUser` | The signed-in player, or `null` (synchronous) |
| `loadProfile` | That player's profile |
| `saveProfile` | Write the profile back |

A profile is `{username, createdAt, starterDeck, stats: {wins, losses, games}, collection, packs, coins, role, welcomeGranted, lastDaily}`. Each collection entry is a copy `{id, gold, uid}` from `copies.js`. Gold does not change scoring. `packs` is how many unopened packs the player has. `coins` are Orbit Coins. `role` is `player` or `admin`.

On first launch the game asks you to sign up or log in. **Play as guest** keeps a profile on this device only. Signing up afterward moves the guest's cards and win/loss record onto the new account.

A new account starts with every card in the chosen starter deck, all non-gold. After every game the profile is saved. A win also adds one random card copy. That copy is gold 10% of the time, and the game shows it in a "New toon!" popup. Wins, losses, and ties also pay Orbit Coins. There is no real money and no pack bonus for a win streak.

## Packs

Packs is in the header menu and on the deck screen. The badge is the number still unopened. A pack holds 5 copies drawn from all 42 cards. Each copy is gold on its own 10% roll, and the pack includes a card the player does not own yet when any remain. The cards are saved as soon as the pack is opened, before the tear-open animation. New copies are tagged NEW!. A duplicate shows the new total, such as x2. A gold pull flashes the screen, plays a short sparkle, and vibrates the phone when the browser allows it. Sound uses the same on/off switch as the rest of the game.

New accounts and guests start with 3 welcome packs and 0 Orbit Coins. An account saved before packs existed is given those 3 the next time it loads. One more pack can be claimed each calendar day. Guest packs, coins, and the daily claim move onto an account at sign-up. With Supabase, those fields travel inside the `stats` JSON so the existing table does not need new columns.

Orbit Coins are the only currency. The amounts live in one object in `game.js`:

```js
ECONOMY = {winCoins: 100, lossCoins: 25, packPrice: 300}
```

A win pays `winCoins`. A loss or a tie pays `lossCoins`. The Packs screen sells one pack for `packPrice`. The header shows the balance. An admin can change the three numbers; the override is stored in `localStorage` under `tob_economy` and replaces the defaults on this device.

The local account `mjmasters91` (any capitalization) is an admin when it is created. Admins see an Admin item in the header menu. From there they can list every profile on this device, set coins, set packs, grant a normal or gold copy of a card, promote or demote another player, and save the economy. Each of those actions shows a confirmation. This panel is device-only and client-side: the data sits in `localStorage`, so it is not a security boundary. Do not treat it as one.

The header shows the player's initial and username. The menu opens **My Collection** (owned copies, duplicate counts, gold holos, and locked silhouettes for the rest of the 42-card set) and **Log out**. Card Gallery is still the full catalog.

### This device (default)

`LocalAuthProvider` stores accounts in `localStorage` under `tob_accounts`. It is active while `supabase-config.js` has an empty `url` or `anonKey`.

- Usernames are 3–16 letters, numbers, or underscores, unique ignoring case. `guest` is reserved.
- Passwords must be 6–128 characters.
- The password is never written to storage. Each account gets a random 16-byte salt. The stored secret is PBKDF2-HMAC-SHA-256, 100,000 iterations, 256 bits, hex-encoded, compared in constant time.
- Friendly errors cover a short name, a taken name, an unknown name, and a wrong password.

Logging out leaves the guest blob in place so a later sign-up can claim it. Real accounts stay on this browser until its storage is cleared.

### Every device (Supabase)

`SupabaseAuthProvider` in `auth.js` switches on when both `url` and `anonKey` in `supabase-config.js` are non-empty. It loads `supabase-js` and uses email + password. The profile and collection live in a `profiles` row whose id is the auth user id. Row-level security lets that user read and write only their own row. Leave the anon key as the public client key. Do not put a service-role key in the config file.

For instant play after sign-up, turn off email confirmation in the Supabase project's Auth settings. With confirmation left on, the player confirms the email and then logs in.

Run this in the Supabase SQL editor before pointing the config at the project:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  starter_deck text,
  stats jsonb not null default '{"wins":0,"losses":0,"games":0}'::jsonb,
  collection jsonb not null default '[]'::jsonb
);

create unique index if not exists profiles_username_lower
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );
```

That update check stops a player from changing their own `role`. Coins and packs for other people, and role changes, go through a security-definer function that only an admin can run. The local game does not call this yet. Install it before trusting Supabase with admin actions:

```sql
alter table public.profiles add column if not exists role text not null default 'player' check (role in ('player', 'admin'));
alter table public.profiles add column if not exists coins integer not null default 0;
alter table public.profiles add column if not exists packs integer not null default 0;

create or replace function public.admin_update_profile(
  target uuid,
  new_role text,
  new_coins integer,
  new_packs integer,
  new_collection jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not admin';
  end if;
  if new_role is not null and new_role not in ('player', 'admin') then
    raise exception 'bad role';
  end if;
  update public.profiles
     set role = coalesce(new_role, role),
         coins = coalesce(new_coins, coins),
         packs = coalesce(new_packs, packs),
         collection = coalesce(new_collection, collection)
   where id = target;
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, integer, integer, jsonb) from public;
grant execute on function public.admin_update_profile(uuid, text, integer, integer, jsonb) to authenticated;
```

There is no delete policy: a player cannot delete another row, and client code does not delete profiles. After the table exists, set `url` and `anonKey` in `supabase-config.js` and reload. Local accounts are not copied to Supabase.

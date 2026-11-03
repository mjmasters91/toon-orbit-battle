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

A profile is `{username, createdAt, starterDeck, stats, collection, packs, coins, role, welcomeGranted, lastDaily, avatar, showcase, friends}`. `stats` keeps `wins`, `losses`, and `games`, plus `streak`, `bestStreak`, `packsOpened`, `decks`, and `archetypes`. Older saves that only have wins and losses still load. Each collection entry is a copy `{id, gold, uid}` from `copies.js`. Gold does not change scoring. `packs` is how many unopened packs the player has. `coins` are Orbit Coins. `role` is `player` or `admin`.

On first launch the game asks you to sign up or log in. **Play as guest** keeps a profile on this device only. Signing up afterward moves the guest's cards and win/loss record onto the new account.

A new account starts with every card in the chosen starter deck, all non-gold. After every game the profile is saved. A win also adds one random card copy. That copy is gold 10% of the time, and the game shows it in a "New toon!" popup. Wins, losses, and ties also pay Orbit Coins. There is no real money and no pack bonus for a win streak.

## Packs

Packs is in the header menu and on the deck screen. The badge is the number still unopened. A pack holds 5 copies drawn from all 42 cards. Each copy is gold on its own 3% roll (`GOLD_CHANCE` in `game.js`), and the pack includes a card the player does not own yet when any remain. There is no guaranteed gold card in a pack. The shop also sells one pack per archetype for `themePrice` coins (400). Pack of the Week, picked from the ISO week number, costs `themeWeekPrice` (350). Themed packs never include admin-only cards. The cards are saved as soon as the pack is opened, before the tear-open animation. New copies are tagged NEW!. A duplicate shows the new total, such as x2. A gold pull flashes the screen, plays a short sparkle, and vibrates the phone when the browser allows it. Sound uses the same on/off switch as the rest of the game.

New accounts and guests start with 3 welcome packs and 0 Orbit Coins. An account saved before packs existed is given those 3 the next time it loads. One more pack can be claimed each calendar day. Guest packs, coins, and the daily claim move onto an account at sign-up. With Supabase, those fields travel inside the `stats` JSON so the existing table does not need new columns.

Orbit Coins are the only currency. The amounts live in one object in `game.js`:

```js
ECONOMY = {winCoins: 100, lossCoins: 25, packPrice: 300, themePrice: 400, themeWeekPrice: 350}
```

A win pays `winCoins`. A loss or a tie pays `lossCoins`. The Packs screen sells one pack for `packPrice`. The header shows the balance. An admin can change the three numbers; the override is stored in `localStorage` under `tob_economy` and replaces the defaults on this device.

The usernames in `ADMIN_USERNAMES` inside `auth.js` (`mjmasters91` and `Sender`) are admins. The check trims spaces and ignores capitalization. An account that already exists is promoted the next time that person logs in or the page loads while they are signed in. No password is stored for them; each person signs up with their own. Admins see an Admin item in the header menu. From there they can list every profile on this device, set coins, set packs, grant a normal or gold copy of a card, promote or demote another player, and save the economy. Each of those actions shows a confirmation. This panel is device-only and client-side: the data sits in `localStorage`, so it is not a security boundary. Do not treat it as one.

The header shows the player's initial and username. The menu opens **My Collection** (owned copies, duplicate counts, gold holos, and locked silhouettes for the rest of the 42-card set) and **Log out**. Card Gallery is still the full catalog.

### This device (default)

`LocalAuthProvider` stores accounts in `localStorage` under `tob_accounts`. It stays active for guests, and for everyone until the `profiles` table answers.

- Usernames are 3–16 letters, numbers, or underscores, unique ignoring case. `guest` is reserved.
- Passwords must be 6–128 characters.
- The password is never written to storage. Each account gets a random 16-byte salt. The stored secret is PBKDF2-HMAC-SHA-256, 100,000 iterations, 256 bits, hex-encoded, compared in constant time.
- Friendly errors cover a short name, a taken name, an unknown name, and a wrong password.

Logging out leaves the guest blob in place so a later sign-up can claim it. Real accounts stay on this browser until its storage is cleared.

### Every device (Supabase)

The site already has the project URL and the publishable key in `supabase-config.js`. That key is public. Do not put a service-role key in the client.

Players type a username and a password. The client signs them in as `<username>@players.toonorbit.app`. **Turn Confirm email OFF** under Authentication → Providers → Email, or sign-up cannot start a session.

Apply `supabase/migrations/0001_online_accounts.sql` in the Supabase SQL editor. Until that table answers, the game stays on this device and the sign-in screen says “Online accounts coming soon.” After the migration is applied, a reload switches to online accounts by itself.

Coins, cards, pack rolls, match rewards, and auction bids move only inside security-definer functions. The browser cannot update those columns. `mjmasters91` and `sender` become admins when their profile is created, and they receive the Obsidian cards. Those cards are never in packs or auctions. A one-time “Import your local deck layout” prompt copies the custom deck only. It does not import coins or cards.

Guest play stays in `localStorage`.

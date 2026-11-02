# Toon Orbit Battle

Toon Orbit Battle is an original card battle game for one player against a computer opponent. The characters and art are original.

Open `index.html` in a browser to play. No install or build step is required. Cards are round discs. On a phone, the same page fits the screen and can be added to the home screen.

The published game is at https://mjmasters91.github.io/toon-orbit-battle/.

## Adding a card

1. Add one object in `cards.js` (inside the list passed to `add`). Give it a unique `id`, plus `name`, `char`, `group`, `pts`, `color`, `features`, `power`, `powers`, and an `art` fallback used only when no image is available. Do not create a second entry for a gold version.
2. Add the face image at `assets/cards/<id>.webp`. Use a 512×512 picture with the character centered on dark navy. The game clips it to the round card.
3. Reload `index.html`. The card shows up in the deck builder and the Collection screen. To put it in a prebuilt deck, add its `id` to that deck's `cards` array in `cards.js`.

If `assets/cards/<id>.webp` is missing or fails to load, the card face falls back to the original SVG drawing from `art.js`. The name banner, point badge, and power star stay on top of either face.

Gold copies are cosmetic. A copy is the card definition plus `{gold: true}` (see `copies.js`). They score the same as the plain card. Each prebuilt deck deals one or two gold copies at random. Collection, under the deck menu, can show every card's gold look.

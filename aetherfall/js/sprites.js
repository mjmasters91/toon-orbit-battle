import { blitText, textWidth } from "./font.js";
import { buffer, paint, shift } from "./pixel.js";
import { FRAME_COUNT, SPRITE_H, SPRITE_W, lookIds, renderPortrait, renderUnit } from "./cast.js";

export { FRAME_COUNT, SPRITE_H, SPRITE_W, lookIds, renderPortrait, renderUnit };

export function paintUnit(canvas, id, frame, scale) {
  paint(canvas, renderUnit(id, frame), scale);
}

export function paintPortrait(canvas, id, frame, scale) {
  paint(canvas, renderPortrait(id, frame), scale);
}

function iconBuffer(draw) {
  const d = buffer(16, 16);
  draw(d);
  return d.g;
}

const ICON_DRAW = {
  gem(d) {
    d.rect(7, 1, 2, 2, "#e8fff8");
    d.rect(4, 3, 8, 2, "#7ef0e0");
    d.rect(3, 5, 10, 4, "#14b8a6", "#0c6e64");
    d.rect(5, 9, 6, 3, "#0e8f84");
    d.p(6, 6, "#ffffff");
    d.rect(7, 12, 2, 2, "#0a5c56");
  },
  ticket(d) {
    d.rect(1, 3, 14, 10, "#a86a10");
    d.rect(2, 4, 12, 8, "#ffd48a");
    d.rect(3, 5, 10, 6, "#fff1c8");
    d.p(5, 7, "#e23a24");
    d.p(8, 8, "#e23a24");
    d.p(11, 7, "#e23a24");
  },
  gold(d) {
    d.oval(8, 8, 6, 6, "#f2d56b", "#a86a12");
    d.rect(6, 5, 3, 6, "#fff1b0");
    d.rect(7, 4, 2, 8, "#a86a12");
  },
  star(d) {
    const c = "#ffd56a";
    const s = "#a86a12";
    d.rect(7, 1, 2, 3, c);
    d.rect(4, 5, 8, 2, c);
    d.p(3, 6, c);
    d.p(12, 6, c);
    d.rect(5, 7, 6, 2, c);
    d.p(6, 9, c);
    d.p(9, 9, c);
    d.p(5, 11, c);
    d.p(10, 11, c);
    d.p(4, 13, s);
    d.p(11, 13, s);
    d.p(7, 2, "#fff6c8");
  },
  home(d) {
    d.rect(7, 1, 2, 2, "#ffd56a");
    for (let i = 0; i < 6; i++) d.hline(2 + i, 3 + i, 12 - i * 2, "#f6edd8");
    d.rect(4, 8, 8, 6, "#d7c4a4", "#5a4636");
    d.rect(7, 10, 2, 4, "#2a1604");
  },
  summon(d) {
    d.ring(8, 9, 6, "#9ad7ff");
    d.rect(7, 2, 2, 3, "#fff6c8");
    d.rect(5, 5, 6, 6, "#3ee0c3", "#14685e");
    d.p(6, 6, "#ffffff");
    d.rect(7, 11, 2, 2, "#ffd56a");
  },
  units(d) {
    d.oval(5, 5, 2, 2, "#f6d3bc");
    d.rect(3, 8, 5, 5, "#ff8a3a", "#8a3018");
    d.oval(11, 5, 2, 2, "#f6d3bc");
    d.rect(9, 8, 5, 5, "#3aa6ff", "#14386a");
  },
  story(d) {
    d.rect(2, 2, 12, 12, "#1d4e38", "#0e2a1c");
    d.rect(3, 3, 10, 5, "#67b0e8");
    d.rect(4, 8, 8, 5, "#3e9a48");
    d.rect(6, 6, 2, 4, "#f2d56a");
    d.p(11, 4, "#fff6c8");
    d.p(4, 10, "#2f8a40");
  },
  party(d) {
    d.rect(2, 2, 3, 3, "#ffd56a");
    d.rect(7, 1, 3, 4, "#ffd56a");
    d.rect(12, 2, 3, 3, "#ffd56a");
    d.rect(1, 7, 4, 6, "#f0c2a4", "#8a5a40");
    d.rect(6, 7, 4, 6, "#ff5a32", "#8a2018");
    d.rect(11, 7, 4, 6, "#3aa6ff", "#14386a");
  },
  sound(d) {
    d.rect(2, 6, 3, 4, "#f6edd8");
    d.rect(5, 4, 3, 8, "#f6edd8");
    d.p(10, 3, "#ffd56a");
    d.p(12, 5, "#ffd56a");
    d.p(13, 8, "#ffd56a");
    d.p(12, 11, "#ffd56a");
    d.p(10, 13, "#ffd56a");
  },
  mute(d) {
    d.rect(2, 6, 3, 4, "#f6edd8");
    d.rect(5, 4, 3, 8, "#f6edd8");
    d.line(10, 4, 14, 12, "#ff8a8a", 1);
    d.line(14, 4, 10, 12, "#ff8a8a", 1);
  },
  fire(d) {
    d.p(8, 1, "#fff6c8");
    d.rect(7, 2, 2, 2, "#ffd56a");
    d.rect(6, 4, 4, 3, "#ff8a3a");
    d.rect(5, 7, 6, 5, "#ff5a32", "#a02818");
    d.rect(7, 10, 2, 3, "#ffd56a");
  },
  water(d) {
    d.oval(8, 9, 5, 5, "#3aa6ff", "#14508a");
    d.p(8, 2, "#e8f7ff");
    d.p(8, 3, "#8fd0ff");
    d.p(6, 7, "#ffffff");
  },
  wind(d) {
    d.hline(2, 4, 9, "#e8fff4");
    d.hline(4, 7, 9, "#43e08a");
    d.hline(2, 10, 8, "#178a58");
    d.p(12, 4, "#ffffff");
    d.p(13, 7, "#d8ffe8");
  },
  earth(d) {
    d.rect(7, 2, 2, 2, "#f0d8a0");
    d.rect(5, 4, 6, 3, "#e0a04a");
    d.rect(3, 7, 10, 5, "#8a5a28", "#4a3014");
    d.hline(4, 12, 8, "#c4843a");
  },
  light(d) {
    d.oval(8, 8, 3, 3, "#fff6c8", "#ffd56a");
    for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) d.p(x, y, "#ffe9a0");
  },
  dark(d) {
    d.oval(7, 8, 5, 5, "#c4b0ff", "#5a3a98");
    for (let y = 2; y <= 14; y++) {
      for (let x = 8; x <= 15; x++) {
        const dx = x - 11;
        const dy = y - 7;
        if (dx * dx + dy * dy < 18) d.clear(x, y);
      }
    }
  },
};

export function renderIcon(name) {
  const draw = ICON_DRAW[name];
  if (!draw) return iconBuffer((d) => d.rect(6, 6, 4, 4, "#ffd56a"));
  return iconBuffer(draw);
}

export function paintIcon(canvas, name, scale = 2) {
  paint(canvas, renderIcon(name), scale);
}

function cloud(d, x, y, w, c) {
  d.rect(x, y, w, 3, c);
  d.rect(x + 2, y - 2, w - 5, 3, c);
  d.p(x + 3, y - 3, "#ffffff");
}

export function renderBanner(kind) {
  const d = buffer(160, 96);
  const cinder = kind === "cinders";
  const sky = cinder ? "#3a1420" : "#1a2c58";
  const sky2 = cinder ? "#6a2830" : "#2e4c86";
  d.rect(0, 0, 160, 96, sky);
  d.rect(0, 40, 160, 56, sky2);
  for (let i = 0; i < 24; i++) d.p((i * 13 + 4) % 160, (i * 7) % 36, i % 2 ? "#fff6d8" : "#b7d4ff");
  cloud(d, 12, 18, 22, cinder ? "#ffb090" : "#d5e4ff");
  cloud(d, 70, 12, 28, cinder ? "#ffc8a8" : "#eef4ff");
  cloud(d, 120, 22, 20, cinder ? "#ffb090" : "#c5d8f8");
  d.rect(0, 72, 160, 24, cinder ? "#4a2820" : "#24345a");
  d.hline(0, 72, 160, cinder ? "#c46a48" : "#8aa0d0");
  for (let x = 6; x < 160; x += 18) {
    d.rect(x, 64, 8, 10, cinder ? "#3a2018" : "#1a2848");
    d.p(x + 3, 62, cinder ? "#ffd56a" : "#9ad7c8");
  }
  const stone = cinder ? "#7a4038" : "#6a78a8";
  const stoneD = cinder ? "#4a2824" : "#3a4870";
  d.rect(36, 40, 10, 34, stone, stoneD);
  d.rect(114, 40, 10, 34, stone, stoneD);
  d.rect(36, 36, 88, 6, shift(stone, 24), stoneD);
  for (let x = 46; x <= 114; x++) {
    const t = (x - 80) / 34;
    const y = 36 - Math.round((1 - t * t) * 16);
    d.p(x, y, shift(stone, 30));
    d.p(x, y + 1, stoneD);
  }
  if (cinder) {
    d.rect(70, 8, 6, 10, "#ffd56a", "#a86a12");
    d.rect(60, 14, 5, 8, "#ff8a3a");
    d.rect(96, 14, 5, 8, "#ff8a3a");
    d.rect(74, 16, 12, 8, "#ff5a32", "#8a2818");
    for (const [x, h] of [[54, 8], [80, 14], [104, 7], [68, 6], [92, 6]]) {
      for (let i = 0; i < h; i++) d.p(x, 34 - i, i % 2 ? "#ffd56a" : "#ff5a32");
    }
  } else {
    for (let i = 0; i < 18; i++) {
      const w = i < 10 ? i : 18 - i;
      d.hline(80 - w, 18 + i, w * 2 + 1, i % 3 === 0 ? "#f4fffc" : "#3ee0c3");
    }
    d.p(80, 22, "#ffffff");
    d.rect(48, 48, 4, 5, "#ffd56a");
    d.rect(108, 48, 4, 5, "#ffd56a");
  }
  d.rect(62, 66, 36, 6, cinder ? "#5a3028" : "#2a3c64");
  return d.g;
}

export function renderLogo() {
  const scale = 4;
  const label = "AETHERFALL";
  const tw = textWidth(label, scale);
  const w = tw + 24;
  const h = 36 + 7 * scale;
  const d = buffer(w, h);
  const cx = Math.floor(w / 2);
  d.rect(cx - 2, 2, 4, 3, "#fff6c8");
  for (let i = 0; i < 10; i++) {
    const span = i < 6 ? i + 1 : 10 - i;
    d.hline(cx - span, 5 + i, span * 2 + 1, i % 2 ? "#bffff4" : "#3ee0c3");
  }
  d.p(cx, 8, "#ffffff");
  blitText(d, label, 14, 24, "#4a2e08", scale);
  blitText(d, label, 10, 20, "#ffd56a", scale);
  return d.g;
}

import { buffer, outline, shift } from "./pixel.js";

const INK = "#1b1218";

function tones(base) {
  return { hi: shift(base, 48), light: shift(base, 22), base, shadow: shift(base, -40) };
}

function blob(d, cx, cy, rx, ry, t) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx + 0.1) + (y * y) / (ry * ry + 0.1) > 1) continue;
      const nx = (x + rx) / (rx * 2);
      const ny = (y + ry) / (ry * 2);
      let c = t.base;
      if (nx < 0.28 && ny < 0.35) c = t.hi;
      else if (nx < 0.48 && ny < 0.6) c = t.light;
      else if (nx > 0.72 || ny > 0.75) c = t.shadow;
      d.p(cx + x, cy + y, c);
    }
  }
}

function eyes(d, cx, cy, blink) {
  if (blink) {
    d.hline(cx - 4, cy, 3, INK);
    d.hline(cx + 2, cy, 3, INK);
    return;
  }
  d.rect(cx - 5, cy - 1, 3, 3, "#f4f7ff");
  d.rect(cx + 2, cy - 1, 3, 3, "#f4f7ff");
  d.p(cx - 4, cy, "#1a1020");
  d.p(cx + 3, cy, "#1a1020");
  d.p(cx - 5, cy - 1, "#ffffff");
  d.p(cx + 2, cy - 1, "#ffffff");
}

const PALETTE = {
  slime: "#3ecf7a",
  beast: "#c47a3a",
  plant: "#3d9a4a",
  crab: "#e07a55",
  bird: "#7eb4e0",
  moth: "#c9a0e8",
  scorpion: "#d2a04a",
  drake: "#e44532",
  golem: "#9aa4b4",
  wraith: "#7a6ad0",
  seraph: "#f0e2a0",
};

export function renderMonster(kind, element, boss, frame = 0) {
  const d = buffer(boss ? 56 : 40, boss ? 48 : 36);
  const cx = Math.floor(d.w / 2);
  const bob = frame % 2 ? -1 : 0;
  const blink = frame === 4;
  const base = PALETTE[kind] || "#8a7048";
  const t = tones(element === "fire" ? shift(base, 10) : base);
  const cy = d.h - 16 + bob;
  if (kind === "slime") {
    blob(d, cx, cy + 2, boss ? 16 : 11, boss ? 12 : 8, t);
    d.p(cx - 4, cy - 2, t.hi);
  } else if (kind === "beast" || kind === "drake") {
    blob(d, cx, cy + 2, boss ? 14 : 10, boss ? 9 : 6, t);
    blob(d, cx + 6, cy - 4, boss ? 8 : 5, boss ? 6 : 4, t);
    d.rect(cx - 8, cy + 6, 4, 4, t.shadow);
    d.rect(cx + 4, cy + 6, 4, 4, t.shadow);
    if (kind === "drake") {
      blob(d, cx - 10, cy - 2 + (frame % 2 ? -1 : 0), boss ? 10 : 6, 4, tones(shift(base, 20)));
      blob(d, cx + 8, cy - 2, boss ? 8 : 5, 3, tones(shift(base, 20)));
    }
    d.p(cx + 8, cy - 8, t.hi);
  } else if (kind === "crab") {
    blob(d, cx, cy + 2, boss ? 14 : 10, boss ? 8 : 5, t);
    d.rect(cx - 16, cy, 6, 3, t.light);
    d.rect(cx + 10, cy, 6, 3, t.light);
    d.rect(cx - 6, cy + 6, 3, 4, t.shadow);
    d.rect(cx + 3, cy + 6, 3, 4, t.shadow);
  } else if (kind === "plant") {
    d.rect(cx - 1, cy, 3, 10, "#5a3a22");
    blob(d, cx, cy - 4, boss ? 10 : 7, boss ? 8 : 6, t);
    d.rect(cx + 4, cy - 10, 3, 3, "#e85a8c");
  } else if (kind === "moth" || kind === "bird") {
    blob(d, cx, cy, 5, 4, t);
    blob(d, cx - 8, cy - 1 + (frame % 2 ? -2 : 0), boss ? 8 : 6, 4, tones(shift(base, 16)));
    blob(d, cx + 8, cy - 1 + (frame % 2 ? -2 : 0), boss ? 8 : 6, 4, tones(shift(base, 16)));
  } else if (kind === "golem" || kind === "scorpion") {
    d.rect(cx - (boss ? 12 : 8), cy - 4, boss ? 24 : 16, boss ? 16 : 12, t.base);
    d.rect(cx - (boss ? 10 : 6), cy - 6, boss ? 10 : 7, 4, t.light);
    d.rect(cx + 2, cy + 8, 4, 4, t.shadow);
    d.rect(cx - 6, cy + 8, 4, 4, t.shadow);
    d.rect(cx - 1, cy, 3, 3, "#7ee0c8");
    if (kind === "scorpion") d.line(cx, cy + 4, cx + 12, cy - 8, t.shadow, 2);
  } else if (kind === "wraith" || kind === "seraph") {
    for (let i = 0; i < (boss ? 18 : 14); i++) {
      const half = Math.max(2, (boss ? 10 : 7) - Math.floor(i / 3));
      d.hline(cx - half, cy - 8 + i, half * 2, i % 4 === 0 ? t.light : t.base);
    }
    if (kind === "seraph") {
      blob(d, cx - 10, cy - 4 + (frame % 2 ? -1 : 0), 6, 3, tones("#fff6c8"));
      blob(d, cx + 10, cy - 4, 6, 3, tones("#fff6c8"));
    }
  } else {
    blob(d, cx, cy, 8, 6, t);
  }
  eyes(d, kind === "beast" || kind === "drake" ? cx + 6 : cx, cy - 2, blink);
  outline(d, INK);
  return d.g;
}

const FIELD = {
  meadow: { sky: "#67b0e8", land: "#3e9a48", accent: "#f2d56a" },
  coast: { sky: "#6aa8d8", land: "#d8c48a", accent: "#3a88c8" },
  forest: { sky: "#2a6848", land: "#1d4028", accent: "#8ad48a" },
  cinder: { sky: "#e07a48", land: "#c46a3a", accent: "#ffd56a" },
  spire: { sky: "#3a4c98", land: "#c8c4dc", accent: "#f2e2a0" },
};

export function renderField(mapId) {
  const theme = FIELD[mapId] || FIELD.meadow;
  const d = buffer(180, 100);
  d.rect(0, 0, 180, 62, theme.sky);
  d.rect(0, 62, 180, 38, theme.land);
  d.hline(0, 62, 180, shift(theme.land, 30));
  for (let i = 0; i < 12; i++) d.p((i * 17 + 4) % 180, (i * 9) % 40, "#fff6d8");
  d.rect(20, 22, 28, 6, "#f4f8ff");
  d.rect(24, 18, 16, 6, "#ffffff");
  d.rect(110, 16, 34, 6, "#f4f8ff");
  if (mapId === "coast") {
    d.rect(0, 70, 180, 8, "#49a0d0");
    d.rect(30, 78, 16, 6, "#efe6c8");
  } else if (mapId === "forest") {
    for (const x of [16, 40, 130, 156]) {
      d.rect(x, 40, 4, 24, "#3a2a18");
      d.rect(x - 6, 28, 16, 14, "#1f6a38");
    }
  } else if (mapId === "cinder") {
    d.rect(70, 48, 18, 16, "#8a4030");
    d.p(76, 44, "#ffd56a");
    d.p(80, 42, "#ff5a32");
  } else if (mapId === "spire") {
    d.rect(78, 28, 24, 36, "#ddd6ea");
    d.rect(84, 16, 12, 14, "#f0e6ff");
    d.rect(86, 10, 8, 8, theme.accent);
  } else {
    for (const x of [24, 150]) {
      d.rect(x, 48, 3, 14, "#5a3a22");
      d.rect(x - 5, 40, 13, 10, "#2f8a40");
    }
  }
  return d.g;
}

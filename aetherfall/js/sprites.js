import { blitText, textWidth } from "./font.js";
import { buffer, outline, paint, shift } from "./pixel.js";

export const SPRITE_W = 40;
export const SPRITE_H = 52;
const CX = 20;
const FEET = 46;
const INK = "#140c16";

const BUILDS = {
  short: { leg: 6, body: 9, headRx: 5, headRy: 5, tw: 10 },
  slim: { leg: 9, body: 9, headRx: 4, headRy: 5, tw: 8 },
  tall: { leg: 11, body: 9, headRx: 4, headRy: 5, tw: 8 },
  wide: { leg: 7, body: 10, headRx: 5, headRy: 5, tw: 13 },
  robe: { leg: 8, body: 15, headRx: 4, headRy: 5, tw: 10 },
};

const BEHIND = new Set(["flute", "staff", "spear", "trident", "scythe", "bow", "lantern", "bucket", "bell", "jar", "rosary"]);

export const LOOKS = {
  veyra: { build: "tall", outfit: "plate", hairStyle: "spiky", ears: "point", hat: "crown", back: "flame", weapon: "dual", mouth: "smile", skin: "#f0c2a4", hair: "#ff4d2a", cloth: "#7a1a2a", trim: "#ffd15a", metal: "#f4f6fb", boots: "#2a1418", cape: "#ff7a32", gem: "#ffd15a", pupil: "#3a120c" },
  calder: { build: "wide", outfit: "plate", hairStyle: "short", hat: "helm", back: "cape", weapon: "anchor", shield: "tower", feature: "beard", mouth: "flat", skin: "#e2b08e", hair: "#6e5438", cloth: "#1e4c74", trim: "#d7c39a", metal: "#d5e2ee", boots: "#15202c", cape: "#16324e", gem: "#3aa6ff", pupil: "#14202c" },
  siff: { build: "slim", outfit: "tunic", hairStyle: "long", ears: "point", hat: "ribbon", back: "ribbon", weapon: "flute", mouth: "smile", skin: "#f6d3bc", hair: "#f4e6bc", cloth: "#2c6d62", trim: "#f0d78a", metal: "#e8eef2", boots: "#24342e", cape: "#8fd8c4", gem: "#7dffe0", pupil: "#24302c" },
  thistle: { build: "robe", outfit: "robe", hairStyle: "long", hat: "antler", back: "cape", weapon: "staff", feature: "beard", mouth: "flat", skin: "#c98458", hair: "#6a8f4a", cloth: "#3d5a32", trim: "#d8c07a", metal: "#e6d7b0", boots: "#3a2a1c", cape: "#2f4a28", gem: "#d8a04a", pupil: "#2a2418" },
  iri: { build: "robe", outfit: "dress", hairStyle: "long", hat: "halo", weapon: "book", mouth: "smile", skin: "#f7d7c4", hair: "#f7f3ea", cloth: "#f4f6fb", trim: "#f0d78a", metal: "#ffffff", boots: "#c9bdd6", cape: "#fff6d8", gem: "#ffe9a0", pupil: "#5a4a38" },
  morr: { build: "slim", outfit: "coat", hairStyle: "hood", back: "ragged", weapon: "scythe", mouth: "flat", skin: "#d7b4a4", hair: "#2a2140", cloth: "#241833", trim: "#c6b4f0", metal: "#d9d3e6", boots: "#120c18", cape: "#3a2858", gem: "#b48cff", pupil: "#140c18" },
  joss: { build: "slim", outfit: "coat", hairStyle: "side", back: "cape", weapon: "fan", mouth: "smile", skin: "#e8b898", hair: "#ff8a3a", cloth: "#8a2e22", trim: "#ffd08a", metal: "#f0e6d8", boots: "#3a1c18", cape: "#c4482c", gem: "#ff6a3a", pupil: "#3a1810" },
  pella: { build: "short", outfit: "robe", hairStyle: "curls", hat: "flower", weapon: "bell", mouth: "smile", blush: true, skin: "#f3c7b4", hair: "#3a6ea5", cloth: "#245c86", trim: "#f2e2c0", metal: "#d5e4ef", boots: "#1c3344", cape: "#7eb7d8", gem: "#8fd0ff", pupil: "#1a3044" },
  arun: { build: "tall", outfit: "tunic", hairStyle: "ponytail", back: "quiver", weapon: "bow", mouth: "flat", skin: "#c48458", hair: "#1c1a28", cloth: "#3e6b4e", trim: "#e6d39a", metal: "#dfe7ea", boots: "#2a241c", cape: "#c8b07a", gem: "#49d68a", pupil: "#141810" },
  osa: { build: "wide", outfit: "plate", hairStyle: "bob", hat: "helm", weapon: "hammer", mouth: "flat", skin: "#8d4e34", hair: "#1a1614", cloth: "#6a5438", trim: "#e0c48a", metal: "#c7c0b4", boots: "#2c241c", cape: "#5a4632", gem: "#e0a04a", pupil: "#1a120c" },
  mae: { build: "slim", outfit: "coat", hairStyle: "bob", weapon: "lantern", feature: "glasses", mouth: "smile", skin: "#f0c8aa", hair: "#5a3828", cloth: "#f0e2c4", trim: "#e0b45a", metal: "#8aa0b8", boots: "#5a4030", cape: "#f7e7c4", gem: "#ffe08a", pupil: "#3a2818" },
  cole: { build: "wide", outfit: "plate", hairStyle: "short", feature: "mask", weapon: "sword", shield: "kite", mouth: "flat", skin: "#b8886a", hair: "#1a1a22", cloth: "#2a2e3a", trim: "#8f86b0", metal: "#9aa0ae", boots: "#12141a", cape: "#1a1c24", gem: "#8b7cff", pupil: "#d8e8ff" },
  rin: { build: "slim", outfit: "wrap", hairStyle: "wild", ears: "cat", tail: true, weapon: "claws", mouth: "fang", skin: "#f0b898", hair: "#ffb03a", cloth: "#6a2430", trim: "#ffd08a", metal: "#f2d2b0", boots: "#3a1c20", cape: "#ff8844", gem: "#ff5a32", pupil: "#3a140c" },
  marin: { build: "tall", outfit: "tunic", hairStyle: "short", hat: "cap", weapon: "trident", mouth: "flat", skin: "#e0a888", hair: "#16324a", cloth: "#1f6a8a", trim: "#d8e8f0", metal: "#d5dee6", boots: "#142838", cape: "#1a4c68", gem: "#3aa6ff", pupil: "#0e2030" },
  pip: { build: "short", outfit: "tunic", hairStyle: "spiky", weapon: "sword", mouth: "smile", blush: true, skin: "#f6c8a8", hair: "#ff5a3a", cloth: "#a33b2a", trim: "#f0d08a", metal: "#e8e8ee", boots: "#3a221c", cape: "#ff7a4a", gem: "#ff5a32", pupil: "#3a140e" },
  nia: { build: "short", outfit: "dress", hairStyle: "buns", weapon: "bucket", mouth: "smile", blush: true, skin: "#f8d2bc", hair: "#4aa0d8", cloth: "#5eb0d4", trim: "#f7f0d8", metal: "#d5e6ef", boots: "#2a4a5c", cape: "#8fd0ea", gem: "#7ec8ff", pupil: "#1a3850" },
  tam: { build: "short", outfit: "tunic", hairStyle: "bob", weapon: "leaf", mouth: "smile", skin: "#f3d0b4", hair: "#5a9a48", cloth: "#d8e2c4", trim: "#e8c878", metal: "#eef2ea", boots: "#4a5a3a", cape: "#b7d89a", gem: "#63d48a", pupil: "#24301c" },
  puck: { build: "orb", outfit: "tunic", hairStyle: "none", weapon: "none", shield: "round", mouth: "smile", skin: "#d8a06a", hair: "#d8a06a", cloth: "#d09058", trim: "#f0d2a4", metal: "#e4d2b4", boots: "#6a4a32", cape: "#d09058", gem: "#7d5a34", pupil: "#3a2414" },
  tess: { build: "short", outfit: "dress", hairStyle: "short", hat: "flower", wings: "insect", weapon: "jar", mouth: "smile", blush: true, skin: "#fbe0cc", hair: "#f2d48a", cloth: "#f7f3e4", trim: "#f0d56a", metal: "#fffaf0", boots: "#e0c8a0", cape: "#fff4c8", gem: "#ffe98a", pupil: "#6a5030" },
  rathe: { build: "slim", outfit: "wrap", hairStyle: "hood", weapon: "dagger", feature: "scar", mouth: "flat", skin: "#c89880", hair: "#1a1428", cloth: "#3a2a40", trim: "#6a5a78", metal: "#c8c2d0", boots: "#120e18", cape: "#2a2034", gem: "#9070d0", pupil: "#100c16" },
  hobb: { build: "wide", outfit: "plate", hairStyle: "none", hat: "kettle", weapon: "axe", mouth: "flat", skin: "#e0b090", hair: "#5a4030", cloth: "#8a3a28", trim: "#e0b060", metal: "#d8d2cc", boots: "#3a241c", cape: "#6a2c22", gem: "#ff6a3a", pupil: "#1a120e" },
  sallow: { build: "tall", outfit: "tunic", hairStyle: "crest", weapon: "spear", mouth: "flat", skin: "#e8c0a0", hair: "#d8c878", cloth: "#4a6a48", trim: "#d8d0a8", metal: "#dfe6df", boots: "#2c3424", cape: "#3e5a40", gem: "#8ee08a", pupil: "#1c2414" },
  quinn: { build: "robe", outfit: "robe", hairStyle: "braids", hat: "circlet", weapon: "rosary", mouth: "smile", skin: "#e8b898", hair: "#8a5a3a", cloth: "#8d6a48", trim: "#f0d8a0", metal: "#efe8dc", boots: "#4a3428", cape: "#a68460", gem: "#e0a04a", pupil: "#3a2418" },
  lir: { build: "slim", outfit: "robe", hairStyle: "hood", wings: "moth", weapon: "lantern", mouth: "smile", skin: "#e0c0cc", hair: "#3a2858", cloth: "#4a3568", trim: "#e0c8f0", metal: "#d4c8e4", boots: "#2a2038", cape: "#c8a0e0", gem: "#e4c6ff", pupil: "#1a1028" },
};

function prep(look) {
  return {
    shield: "none",
    wings: "none",
    back: "none",
    hat: "none",
    ears: "none",
    feature: "none",
    mouth: "flat",
    tail: false,
    blush: false,
    ...look,
    hairDark: shift(look.hair, -52),
    clothDark: shift(look.cloth, -42),
    skinDark: shift(look.skin, -38),
    skinLight: shift(look.skin, 24),
    metalDark: shift(look.metal, -48),
    capeDark: shift(look.cape, -40),
    trimDark: shift(look.trim, -36),
    bootDark: shift(look.boots, -28),
    pants: look.pants || shift(look.cloth, -30),
  };
}

function drawBack(d, spec, bodyTop, bodyH, feet, frame) {
  const flutter = frame % 2 ? 2 : 0;
  if (spec.back === "cape" || spec.back === "ragged" || spec.back === "flame") {
    const len = spec.back === "flame" ? bodyH + 4 : bodyH + 8;
    const half = spec.back === "flame" ? 5 : 6;
    for (let i = 0; i < len; i++) {
      const y = bodyTop + 2 + i;
      if (y >= feet - 1) break;
      const nib = spec.back === "ragged" && i % 4 === 0 ? 2 : 0;
      const color = spec.back === "flame" && i > len * 0.55 ? spec.trim : spec.cape;
      d.hline(CX - half + flutter - nib, y, half * 2 + 1 - nib, color);
    }
  }
  if (spec.back === "ribbon") {
    d.line(CX + 3, bodyTop + 2, CX + 9 + flutter, Math.min(feet - 6, bodyTop + 16), spec.trim, 2);
    d.line(CX + 2, bodyTop + 4, CX + 7 + flutter, Math.min(feet - 4, bodyTop + 18), spec.cape, 1);
  }
  if (spec.back === "quiver") {
    d.rect(CX + 6, bodyTop + 1, 3, 9, "#6b442c", "#3e2616");
    d.p(CX + 6, bodyTop, spec.trim);
    d.p(CX + 7, bodyTop - 1, spec.metal);
    d.p(CX + 8, bodyTop, spec.trim);
  }
}

function drawWings(d, spec, bodyTop, frame) {
  const flap = frame % 2 ? -1 : 0;
  if (spec.wings === "moth") {
    d.oval(CX - 12, bodyTop + 2 + flap, 6, 5, spec.cape, spec.capeDark);
    d.oval(CX + 12, bodyTop + 2 + flap, 6, 5, spec.cape, spec.capeDark);
    d.oval(CX - 10, bodyTop + 6, 4, 3, spec.capeDark, spec.trim);
    d.oval(CX + 10, bodyTop + 6, 4, 3, spec.capeDark, spec.trim);
    d.rect(CX - 14, bodyTop + 1 + flap, 2, 2, spec.gem);
    d.rect(CX + 12, bodyTop + 1 + flap, 2, 2, spec.gem);
  } else if (spec.wings === "insect") {
    d.oval(CX - 9, bodyTop + flap, 4, 3, "#fff6c2", spec.gem);
    d.oval(CX + 9, bodyTop + flap, 4, 3, "#fff6c2", spec.gem);
  }
}

function drawTail(d, spec, hip) {
  if (!spec.tail) return;
  d.line(CX + 5, hip, CX + 12, hip + 3, spec.hair, 2);
  d.line(CX + 12, hip + 3, CX + 8, hip + 7, spec.hairDark, 2);
}

function drawLegs(d, spec, legTop, bootTop, feet) {
  const wide = spec.build === "wide" || spec.build === "short";
  const lw = wide ? 3 : 2;
  const gap = wide ? 3 : 2;
  d.rect(CX - gap - lw, legTop, lw, bootTop - legTop, spec.pants, shift(spec.pants, -24));
  d.rect(CX + gap, legTop, lw, bootTop - legTop, spec.pants, shift(spec.pants, -24));
  d.rect(CX - gap - lw - 1, bootTop, lw + 2, feet - bootTop, spec.boots, spec.bootDark);
  d.rect(CX + gap - 1, bootTop, lw + 2, feet - bootTop, spec.boots, spec.bootDark);
}

function drawBody(d, spec, bodyTop, bodyH, tw) {
  for (let i = 0; i < bodyH; i++) {
    const k = i / Math.max(1, bodyH - 1);
    let half = Math.floor(tw / 2);
    if (spec.outfit === "plate" && i < 3) half += 2;
    if (spec.outfit === "robe") half += Math.floor(k * 4);
    if (spec.outfit === "dress") half += Math.floor(k * 5);
    if (spec.outfit === "coat" && k > 0.4) half += 2;
    if (spec.outfit === "wrap") half = Math.max(3, half - 1);
    const width = half * 2 + 1;
    const x0 = CX - half;
    for (let x = 0; x < width; x++) {
      let color = spec.cloth;
      if (x >= width - 2) color = spec.clothDark;
      if (spec.outfit === "plate" && i > 2 && i < bodyH - 4 && x > 2 && x < width - 3) color = spec.metal;
      if (spec.outfit === "wrap" && Math.abs(x - half) < 1) color = spec.trim;
      if (spec.outfit === "coat" && k > 0.35 && (x < 2 || x >= width - 2)) color = spec.capeDark;
      if ((spec.outfit === "robe" || spec.outfit === "dress") && i >= bodyH - 2) color = spec.trim;
      d.p(x0 + x, bodyTop + i, color);
    }
  }
  if (spec.outfit === "tunic" || spec.outfit === "plate" || spec.outfit === "wrap") {
    const half = Math.floor(tw / 2);
    d.hline(CX - half, bodyTop + bodyH - 3, half * 2 + 1, spec.trim);
  }
  d.rect(CX - 1, bodyTop + 3, 2, 2, spec.gem);
  d.p(CX - 1, bodyTop + 3, "#fffaf0");
}

function handsFor(spec, bodyTop, bodyH, tw) {
  const y = bodyTop + Math.max(4, Math.floor(bodyH * 0.5));
  return {
    left: { x: CX - Math.floor(tw / 2) - 4, y },
    right: { x: CX + Math.floor(tw / 2) + 2, y },
  };
}

function drawArms(d, spec, bodyTop, tw) {
  const y0 = bodyTop + 2;
  const left = CX - Math.floor(tw / 2);
  const right = CX + Math.floor(tw / 2);
  const reach = spec.build === "wide" ? 6 : 7;
  const plate = spec.outfit === "plate";
  const color = plate ? spec.metal : spec.cloth;
  const dark = plate ? spec.metalDark : spec.clothDark;
  const hand = plate ? spec.metal : spec.skin;
  d.line(left, y0, left - 3, y0 + reach, color, 2);
  d.rect(left - 4, y0 + reach, 3, 3, hand, spec.skinDark);
  d.line(right, y0, right + 3, y0 + reach, color, 2);
  d.rect(right + 1, y0 + reach, 3, 3, hand, spec.skinDark);
  if (plate) {
    d.rect(left - 3, y0 - 2, 5, 4, spec.metal, spec.metalDark);
    d.rect(right - 2, y0 - 2, 5, 4, spec.metal, spec.metalDark);
  }
}

function drawHair(d, spec, headTop, headCy, headBottom, headRx, bodyBottom) {
  const style = spec.hairStyle;
  if (!style || style === "none" || style === "hood") return;
  const c = spec.hair;
  const dk = spec.hairDark;
  for (let y = headTop - 1; y <= headCy - 2; y++) {
    for (let x = -headRx - 1; x <= headRx + 1; x++) {
      const ny = (y - headCy) / (headRx + 2);
      const nx = x / (headRx + 1.2);
      if (nx * nx + ny * ny <= 1) d.p(CX + x, y, x > headRx - 1 ? dk : c);
    }
  }
  d.hline(CX - headRx + 1, headCy - 2, headRx * 2 - 1, dk);
  if (style === "spiky" || style === "wild" || style === "crest") {
    const spikes = style === "crest" ? [[-1, 8]] : style === "wild" ? [[-6, 4], [-3, 7], [1, 5], [5, 6]] : [[-5, 5], [-1, 7], [3, 4]];
    for (const [dx, h] of spikes) {
      for (let i = 0; i < h; i++) d.p(CX + dx + (i > h - 3 ? 0 : 0), headTop - 1 - i, i === h - 1 ? dk : c);
      d.p(CX + dx + 1, headTop - 2, c);
    }
  }
  if (style === "long" || style === "ponytail" || style === "braids") {
    const drop = Math.min(bodyBottom - 2, headCy + 14);
    d.rect(CX - headRx - 2, headCy - 1, 2, drop - headCy, c, dk);
    if (style === "ponytail") d.rect(CX + headRx + 1, headCy + 1, 2, 9, c, dk);
    else d.rect(CX + headRx, headCy - 1, 2, drop - headCy, c, dk);
  }
  if (style === "braids") {
    d.rect(CX - headRx - 1, headBottom - 1, 2, 7, dk, c);
    d.rect(CX + headRx - 1, headBottom - 1, 2, 7, dk, c);
    d.p(CX - headRx, headBottom + 6, spec.trim);
    d.p(CX + headRx, headBottom + 6, spec.trim);
  }
  if (style === "bob" || style === "curls" || style === "buns") {
    d.rect(CX - headRx - 1, headCy - 1, 2, headRx + 3, c, dk);
    d.rect(CX + headRx - 1, headCy - 1, 2, headRx + 3, c, dk);
  }
  if (style === "curls") {
    d.oval(CX - headRx, headBottom, 2, 2, c, dk);
    d.oval(CX + headRx, headBottom, 2, 2, c, dk);
  }
  if (style === "buns") {
    d.oval(CX - headRx - 1, headTop + 1, 3, 3, c, dk);
    d.oval(CX + headRx + 1, headTop + 1, 3, 3, c, dk);
  }
  if (style === "short") d.rect(CX - headRx, headTop, headRx * 2 + 1, 2, dk);
}

function drawHood(d, spec, headCy, headRx) {
  d.oval(CX, headCy - 1, headRx + 2, headRx + 3, spec.hair, spec.hairDark);
  d.rect(CX - headRx - 3, headCy + 2, 3, 6, spec.hair, spec.hairDark);
  d.rect(CX + headRx, headCy + 2, 3, 6, spec.hair, spec.hairDark);
}

function drawEars(d, spec, headTop, headCy, headRx) {
  if (spec.hairStyle === "hood" || spec.hat === "helm" || spec.hat === "kettle") return;
  if (spec.ears === "point") {
    d.line(CX - headRx, headCy, CX - headRx - 3, headCy - 3, spec.skin, 1);
    d.p(CX - headRx - 3, headCy - 3, spec.skinDark);
    d.line(CX + headRx, headCy, CX + headRx + 3, headCy - 3, spec.skin, 1);
    d.p(CX + headRx + 3, headCy - 3, spec.skinDark);
  }
  if (spec.ears === "cat") {
    d.line(CX - headRx + 1, headTop, CX - headRx - 1, headTop - 5, spec.hair, 2);
    d.line(CX + headRx - 1, headTop, CX + headRx + 1, headTop - 5, spec.hair, 2);
    d.p(CX - headRx, headTop - 3, "#ffb0c0");
    d.p(CX + headRx, headTop - 3, "#ffb0c0");
  }
}

function drawHat(d, spec, headTop, headCy, headRx) {
  switch (spec.hat) {
    case "crown":
      d.rect(CX - 6, headTop - 3, 2, 4, spec.trim, spec.trimDark);
      d.rect(CX - 1, headTop - 5, 2, 6, spec.trim, spec.trimDark);
      d.rect(CX + 4, headTop - 3, 2, 4, spec.trim, spec.trimDark);
      d.p(CX, headTop - 5, spec.gem);
      break;
    case "antler":
      d.line(CX - 2, headTop, CX - 8, headTop - 7, "#6b4a2e", 2);
      d.line(CX + 2, headTop, CX + 8, headTop - 7, "#6b4a2e", 2);
      d.p(CX - 8, headTop - 4, "#6b4a2e");
      d.p(CX + 8, headTop - 4, "#6b4a2e");
      break;
    case "flower":
      d.rect(CX + headRx - 2, headTop - 3, 3, 3, "#e85a8c");
      d.p(CX + headRx - 1, headTop - 2, "#ffe08a");
      d.p(CX + headRx - 1, headTop - 4, "#67b85a");
      break;
    case "cap":
      d.rect(CX - headRx - 1, headTop - 3, headRx * 2 + 2, 3, spec.cloth, spec.clothDark);
      d.rect(CX - headRx - 2, headTop, headRx * 2 + 4, 2, spec.trim);
      break;
    case "circlet":
      d.hline(CX - headRx + 1, headTop + 1, headRx * 2 - 1, spec.trim);
      d.p(CX, headTop, spec.gem);
      break;
    case "ribbon":
      d.rect(CX - 1, headTop - 7, 2, 6, spec.trim);
      d.rect(CX - 4, headTop - 7, 3, 3, spec.cape);
      d.rect(CX + 1, headTop - 6, 3, 4, spec.gem);
      break;
    case "helm":
      d.oval(CX, headCy, headRx + 1, headRx + 2, spec.metal, spec.metalDark);
      d.rect(CX - 4, headCy, 8, 2, "#123044");
      d.p(CX - 3, headCy, "#d7f6ff");
      d.p(CX + 2, headCy, "#d7f6ff");
      d.rect(CX - headRx, headCy + headRx - 1, headRx * 2, 2, spec.metalDark);
      break;
    case "kettle":
      d.oval(CX, headCy - 1, headRx + 2, headRx + 3, spec.metal, spec.metalDark);
      d.rect(CX - headRx - 2, headCy + 2, headRx * 2 + 4, 3, spec.metalDark);
      d.rect(CX - 5, headCy, 10, 2, "#1b2430");
      d.p(CX - 4, headCy, "#ffb080");
      d.p(CX + 3, headCy, "#ffb080");
      d.rect(CX - 2, headCy - headRx - 2, 4, 2, spec.trim);
      break;
    default:
      break;
  }
}

function drawWeapon(d, spec, hands, headTop) {
  const { left, right } = hands;
  const x = right.x;
  const y = right.y;
  const metal = spec.metal;
  const dark = spec.metalDark;
  const haft = "#6d4630";
  const haftD = "#3b2416";
  switch (spec.weapon) {
    case "sword":
      d.rect(x, y - 13, 2, 11, metal, dark);
      d.rect(x - 1, y - 3, 4, 2, spec.trim);
      d.rect(x, y - 1, 2, 3, haft);
      break;
    case "dual":
      d.rect(x, y - 12, 2, 10, metal, dark);
      d.rect(x - 1, y - 3, 4, 2, spec.trim);
      d.rect(left.x, y - 12, 2, 10, metal, dark);
      d.rect(left.x - 1, y - 3, 4, 2, spec.trim);
      break;
    case "dagger":
      d.rect(x, y - 8, 2, 7, metal, dark);
      d.rect(x - 1, y - 2, 4, 2, spec.trim);
      d.rect(left.x, y - 8, 2, 7, metal, dark);
      d.rect(left.x - 1, y - 2, 4, 2, spec.trim);
      break;
    case "anchor":
      d.rect(x, y - 16, 2, 16, metal, dark);
      d.hline(x - 3, y - 16, 8, metal);
      d.p(x - 3, y - 15, metal);
      d.p(x + 4, y - 15, metal);
      d.hline(x - 3, y - 1, 8, metal);
      d.p(x - 3, y, metal);
      d.p(x + 4, y, metal);
      break;
    case "flute":
      d.rect(x, y - 22, 2, 26, haft, haftD);
      d.oval(x, y - 24, 3, 3, spec.gem, spec.trim);
      d.p(x, y - 24, "#ffffff");
      for (let i = 0; i < 4; i++) d.p(x, y - 16 + i * 3, "#1a120c");
      break;
    case "staff":
      d.rect(x, y - 20, 2, 24, "#5c3a22", haftD);
      d.oval(x, y - 22, 3, 3, spec.gem, spec.trim);
      d.p(x - 1, y - 26, "#2f7a3a");
      d.p(x, y - 27, "#67b85a");
      d.p(x + 1, y - 26, "#2f7a3a");
      break;
    case "book":
      d.rect(x + 1, y - 10, 8, 9, spec.trim, spec.trimDark);
      d.rect(x + 2, y - 9, 6, 7, "#f7f1e4");
      d.rect(x + 4, y - 7, 2, 3, spec.gem);
      break;
    case "scythe":
      d.rect(x, y - 24, 2, 28, haft, haftD);
      for (let i = 0; i < 12; i++) {
        d.p(x - i, y - 24 + Math.floor(i / 2), metal);
        d.p(x - i, y - 23 + Math.floor(i / 2), dark);
      }
      break;
    case "fan":
      for (let i = -5; i <= 5; i++) d.line(x, y, x + i, y - 9, i % 2 ? spec.trim : spec.gem, 1);
      d.rect(x - 1, y - 1, 3, 3, haft);
      break;
    case "bell":
      d.rect(x, y - 12, 2, 3, spec.trim);
      d.oval(x, y - 6, 4, 4, metal, dark);
      d.p(x, y - 3, spec.trim);
      break;
    case "bow": {
      const bx = CX - 13;
      for (let i = -11; i <= 11; i++) {
        const bend = Math.round(Math.sin(((i + 11) / 22) * Math.PI) * 4);
        d.p(bx - bend, y - 4 + i, haft);
      }
      for (let i = -10; i <= 10; i++) d.p(bx + 1, y - 4 + i, spec.trim);
      break;
    }
    case "hammer":
      d.rect(x - 4, y - 14, 9, 5, metal, dark);
      d.rect(x - 1, y - 9, 2, 12, haft, haftD);
      break;
    case "lantern":
      d.rect(x, y - 16, 2, 4, haft);
      d.rect(x - 2, y - 12, 6, 7, spec.trim, spec.trimDark);
      d.rect(x - 1, y - 11, 4, 5, spec.gem);
      d.p(x, y - 10, "#fffce8");
      break;
    case "claws":
      for (const hand of [left, right]) {
        const dir = hand.x < CX ? -1 : 1;
        for (let i = 0; i < 3; i++) d.line(hand.x + i, hand.y + 2, hand.x + i + dir * 3, hand.y + 7, spec.metal, 1);
      }
      break;
    case "trident":
      d.rect(x, y - 18, 2, 20, metal, dark);
      d.rect(x - 3, y - 18, 2, 6, metal, dark);
      d.rect(x + 3, y - 18, 2, 6, metal, dark);
      break;
    case "bucket":
      d.line(x - 1, y - 12, x + 5, y - 12, haft, 1);
      d.rect(x - 1, y - 11, 6, 2, spec.trim);
      d.rect(x - 1, y - 9, 6, 5, metal, dark);
      d.rect(x + 1, y - 4, 2, 4, haft);
      break;
    case "leaf":
      d.line(x, y, x, y - 12, "#1d5a30", 1);
      d.oval(x, y - 8, 4, 5, "#3f9d55", "#1d5a30");
      d.line(x, y - 12, x, y - 4, "#1d5a30", 1);
      break;
    case "axe":
      d.rect(x, y - 15, 2, 17, haft, haftD);
      d.rect(x + 2, y - 15, 5, 7, metal, dark);
      d.p(x + 6, y - 16, metal);
      break;
    case "spear":
      d.rect(x, y - 22, 2, 26, haft, haftD);
      d.rect(x - 1, y - 26, 4, 5, metal, dark);
      break;
    case "jar":
      d.rect(x - 2, y - 12, 6, 2, metal, dark);
      d.oval(x, y - 6, 4, 5, spec.gem, spec.trim);
      d.p(x, y - 7, "#fffce8");
      break;
    case "rosary":
      d.ring(x + 2, y - 6, 4, spec.trim);
      d.p(x + 2, y - 6, spec.gem);
      d.line(x + 2, y - 2, x + 2, y + 3, spec.trim, 1);
      break;
    default:
      break;
  }
}

function drawShield(d, spec, left) {
  if (!spec.shield || spec.shield === "none") return;
  const x = left.x - 1;
  const y = left.y - 1;
  if (spec.shield === "round") {
    d.oval(x, y, 6, 6, spec.metal, spec.metalDark);
    d.ring(x, y, 2, spec.trim);
    d.rect(x - 1, y - 1, 2, 2, spec.gem);
  } else if (spec.shield === "tower") {
    d.rect(x - 5, y - 12, 10, 16, spec.metal, spec.metalDark);
    d.rect(x - 1, y - 10, 2, 12, spec.trim);
    d.hline(x - 4, y - 3, 8, spec.trim);
    d.rect(x - 1, y - 1, 2, 2, spec.gem);
  } else {
    d.oval(x, y - 2, 5, 7, spec.metal, spec.metalDark);
    d.rect(x - 1, y - 7, 2, 10, spec.trim);
    d.hline(x - 3, y - 2, 6, spec.trim);
    d.p(x, y, spec.gem);
  }
}

function drawFace(d, spec, headCy, blink) {
  if (spec.hat === "kettle" || spec.hat === "helm") return;
  const eyeY = headCy;
  const pupil = spec.pupil;
  if (spec.feature === "mask") d.rect(CX - 6, eyeY - 1, 12, 4, "#241833");
  const eye = (x, hide) => {
    if (hide) return;
    if (blink) {
      d.hline(x, eyeY, 3, pupil);
      return;
    }
    d.rect(x, eyeY - 1, 3, 3, "#f7fbff");
    d.rect(x + 1, eyeY, 2, 2, pupil);
    d.p(x, eyeY - 1, "#ffffff");
  };
  eye(CX - 5, spec.hairStyle === "side");
  eye(CX + 2, false);
  if (spec.feature === "glasses") {
    for (const x of [CX - 6, CX + 1]) {
      d.hline(x, eyeY - 2, 5, spec.metalDark);
      d.hline(x, eyeY + 2, 5, spec.metalDark);
      d.p(x, eyeY - 1, spec.metalDark);
      d.p(x, eyeY, spec.metalDark);
      d.p(x, eyeY + 1, spec.metalDark);
      d.p(x + 4, eyeY - 1, spec.metalDark);
      d.p(x + 4, eyeY, spec.metalDark);
      d.p(x + 4, eyeY + 1, spec.metalDark);
    }
    d.hline(CX - 1, eyeY, 2, spec.metalDark);
  }
  if (spec.blush) {
    d.p(CX - 7, eyeY + 2, "#f0a0aa");
    d.p(CX + 6, eyeY + 2, "#f0a0aa");
  }
  const my = eyeY + 4;
  if (spec.mouth === "smile") {
    d.p(CX - 2, my, "#8d4038");
    d.p(CX - 1, my + 1, "#8d4038");
    d.p(CX, my + 1, "#8d4038");
    d.p(CX + 1, my, "#8d4038");
  } else if (spec.mouth === "fang") {
    d.hline(CX - 2, my, 4, "#8d4038");
    d.rect(CX - 1, my + 1, 1, 2, "#f4f7ff");
    d.rect(CX + 1, my + 1, 1, 2, "#f4f7ff");
  } else {
    d.hline(CX - 2, my, 4, "#8d4038");
  }
  if (spec.feature === "scar") {
    d.p(CX + 6, eyeY - 2, "#c45b5b");
    d.p(CX + 7, eyeY - 1, "#c45b5b");
    d.p(CX + 7, eyeY, "#c45b5b");
    d.p(CX + 8, eyeY + 1, "#c45b5b");
  }
}

function drawBeard(d, spec, headCy) {
  if (spec.feature !== "beard") return;
  const my = headCy + 4;
  d.rect(CX - 4, my + 1, 8, 4, spec.hair, spec.hairDark);
  d.rect(CX - 2, my + 5, 4, 2, spec.hairDark);
}

function drawOrb(d, spec, feet, blink, frame) {
  const bob = frame % 2 ? -1 : 0;
  const cy = feet - 16 + bob;
  d.rect(CX - 8, feet - 4 + bob, 5, 4, spec.boots, spec.bootDark);
  d.rect(CX + 3, feet - 4 + bob, 5, 4, spec.boots, spec.bootDark);
  d.oval(CX - 12, cy + 1, 5, 5, spec.metal, spec.metalDark);
  d.rect(CX - 13, cy, 2, 2, spec.gem);
  d.oval(CX, cy, 9, 8, spec.cloth, spec.clothDark);
  d.oval(CX, cy + 2, 5, 4, spec.trim, spec.clothDark);
  d.rect(CX - 13, cy - 1, 4, 3, spec.cloth, spec.clothDark);
  d.rect(CX + 9, cy - 1, 4, 3, spec.cloth, spec.clothDark);
  d.p(CX, cy - 11, "#2f7a3a");
  d.p(CX, cy - 12, "#2f7a3a");
  d.p(CX - 1, cy - 13, "#67b85a");
  d.p(CX + 1, cy - 13, "#67b85a");
  if (blink) {
    d.hline(CX - 4, cy - 1, 3, spec.pupil);
    d.hline(CX + 2, cy - 1, 3, spec.pupil);
  } else {
    d.rect(CX - 4, cy - 2, 3, 3, "#fffaf0");
    d.rect(CX + 2, cy - 2, 3, 3, "#fffaf0");
    d.rect(CX - 3, cy - 1, 2, 2, spec.pupil);
    d.rect(CX + 3, cy - 1, 2, 2, spec.pupil);
  }
  d.p(CX - 1, cy + 3, spec.pupil);
  d.p(CX, cy + 4, spec.pupil);
  d.p(CX + 1, cy + 3, spec.pupil);
}

function clipFeet(d) {
  for (let y = FEET; y < d.h; y++) {
    for (let x = 0; x < d.w; x++) d.clear(x, y);
  }
}

export function renderLook(look, frame = 0) {
  const spec = prep(look);
  const d = buffer(SPRITE_W, SPRITE_H);
  const bob = frame % 2 === 1 ? -1 : 0;
  const blink = frame >= 2;
  const feet = FEET + bob;
  if (spec.build === "orb") {
    drawOrb(d, spec, FEET, blink, frame);
    clipFeet(d);
    outline(d, INK);
    return d.g;
  }
  const b = BUILDS[spec.build] || BUILDS.slim;
  const bootTop = feet - 3;
  const legTop = bootTop - b.leg;
  const robe = spec.outfit === "robe" || spec.outfit === "dress";
  const bodyBottom = robe ? feet - 2 : legTop + 1;
  const bodyTop = bodyBottom - b.body;
  const headRx = b.headRx;
  const headBottom = bodyTop + 2;
  const headCy = headBottom - b.headRy;
  const headTop = headCy - b.headRy;
  const hands = handsFor(spec, bodyTop, b.body, b.tw);

  drawWings(d, spec, bodyTop, frame);
  drawBack(d, spec, bodyTop, b.body, feet, frame);
  drawTail(d, spec, bodyBottom - 2);
  if (!robe) drawLegs(d, spec, legTop, bootTop, feet);
  if (BEHIND.has(spec.weapon)) drawWeapon(d, spec, hands, headTop);
  drawBody(d, spec, bodyTop, b.body, b.tw);
  if (robe) {
    d.rect(CX - 5, feet - 3, 4, 3, spec.boots, spec.bootDark);
    d.rect(CX + 2, feet - 3, 4, 3, spec.boots, spec.bootDark);
  } else {
    d.rect(CX - 1, bodyTop - 2, 3, 3, spec.skin);
  }
  drawArms(d, spec, bodyTop, b.tw);
  if (spec.hairStyle === "hood") drawHood(d, spec, headCy, headRx);
  d.oval(CX, headCy, headRx, b.headRy, spec.skin, spec.skinDark);
  d.p(CX - 2, headTop + 2, spec.skinLight);
  drawEars(d, spec, headTop, headCy, headRx);
  drawHair(d, spec, headTop, headCy, headBottom, headRx, bodyBottom);
  drawShield(d, spec, hands.left);
  if (!BEHIND.has(spec.weapon)) drawWeapon(d, spec, hands, headTop);
  if (spec.hairStyle === "side") d.rect(CX - headRx, headCy - 2, headRx, 5, spec.hair, spec.hairDark);
  drawFace(d, spec, headCy, blink);
  drawHat(d, spec, headTop, headCy, headRx);
  drawBeard(d, spec, headCy);
  clipFeet(d);
  outline(d, INK);
  if (spec.hat === "halo") {
    for (let a = 0; a < 14; a++) {
      const ang = (a / 14) * Math.PI * 2;
      d.p(CX + Math.round(Math.cos(ang) * 7), headTop - 3 + Math.round(Math.sin(ang) * 2), spec.trim);
    }
  }
  return d.g;
}

export function renderUnit(id, frame = 0) {
  const look = LOOKS[id];
  if (!look) throw new Error(`no sprite for ${id}`);
  return renderLook(look, frame);
}

export function paintUnit(canvas, id, frame, scale) {
  paint(canvas, renderUnit(id, frame), scale);
}

export function lookIds() {
  return Object.keys(LOOKS);
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
    d.rect(7, 12, 2, 2, "#0a5c56");
  },
  ticket(d) {
    d.rect(2, 4, 12, 8, "#ffb03a", "#a86a10");
    d.rect(3, 5, 10, 6, "#ffe0a0");
    d.p(5, 7, "#ff5a32");
    d.p(8, 8, "#ff5a32");
    d.p(11, 7, "#ff5a32");
    d.rect(1, 7, 2, 2, "#2a1604");
    d.rect(13, 7, 2, 2, "#2a1604");
  },
  gold(d) {
    d.oval(8, 8, 6, 6, "#f2d56b", "#a86a12");
    d.rect(6, 6, 4, 5, "#fff1b0");
    d.rect(7, 5, 2, 7, "#a86a12");
  },
  home(d) {
    d.rect(7, 2, 2, 2, "#ffd56a");
    for (let i = 0; i < 5; i++) d.hline(3 + i, 4 + i, 10 - i * 2, "#f6edd8");
    d.rect(4, 8, 8, 6, "#cbbba6", "#5a4636");
    d.rect(7, 10, 2, 4, "#2a1604");
  },
  summon(d) {
    d.ring(8, 9, 6, "#9ad7ff");
    d.rect(7, 3, 2, 4, "#7ef0e0");
    d.rect(6, 6, 4, 5, "#3ee0c3", "#14685e");
    d.rect(7, 11, 2, 2, "#fff6c8");
  },
  units(d) {
    d.oval(5, 5, 2, 2, "#f6d3bc");
    d.rect(3, 8, 5, 5, "#ff8a3a");
    d.oval(11, 5, 2, 2, "#f6d3bc");
    d.rect(9, 8, 5, 5, "#3aa6ff");
  },
  party(d) {
    d.rect(2, 3, 3, 3, "#ffd56a");
    d.rect(7, 2, 3, 4, "#ffd56a");
    d.rect(12, 3, 3, 3, "#ffd56a");
    d.rect(1, 7, 4, 6, "#f0c2a4");
    d.rect(6, 7, 4, 6, "#ff5a32");
    d.rect(11, 7, 4, 6, "#3aa6ff");
  },
  sound(d) {
    d.rect(3, 6, 3, 4, "#f6edd8");
    d.rect(6, 5, 2, 6, "#f6edd8");
    d.p(10, 4, "#ffd56a");
    d.p(12, 6, "#ffd56a");
    d.p(13, 8, "#ffd56a");
    d.p(12, 10, "#ffd56a");
    d.p(10, 12, "#ffd56a");
  },
  mute(d) {
    d.rect(3, 6, 3, 4, "#f6edd8");
    d.rect(6, 5, 2, 6, "#f6edd8");
    d.line(10, 4, 14, 12, "#ff8a8a", 1);
    d.line(14, 4, 10, 12, "#ff8a8a", 1);
  },
  fire(d) {
    d.p(8, 2, "#fff1b0");
    d.rect(7, 3, 2, 2, "#ffd56a");
    d.rect(6, 5, 4, 3, "#ff8a3a");
    d.rect(5, 8, 6, 4, "#ff5a32", "#a02818");
    d.rect(7, 10, 2, 3, "#ffd56a");
  },
  water(d) {
    d.oval(8, 9, 4, 5, "#3aa6ff", "#14508a");
    d.p(8, 3, "#d7f2ff");
    d.p(8, 4, "#8fd0ff");
    d.p(6, 8, "#e8f7ff");
  },
  wind(d) {
    d.hline(3, 5, 8, "#bfffe0");
    d.hline(5, 8, 8, "#43e08a");
    d.hline(3, 11, 7, "#178a58");
    d.p(11, 5, "#e8fff4");
    d.p(13, 8, "#e8fff4");
  },
  earth(d) {
    d.rect(7, 3, 2, 2, "#f0d8a0");
    d.rect(5, 5, 6, 3, "#e0a04a");
    d.rect(3, 8, 10, 4, "#8a5a28", "#4a3014");
    d.hline(4, 12, 8, "#c4843a");
  },
  light(d) {
    d.oval(8, 8, 3, 3, "#fff6c8", "#ffd56a");
    for (const [x, y] of [[8, 2], [8, 13], [2, 8], [13, 8], [4, 4], [12, 4], [4, 12], [12, 12]]) d.p(x, y, "#ffe9a0");
  },
  dark(d) {
    d.oval(7, 8, 5, 5, "#b792ff", "#5a3a98");
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

export function renderBanner(kind) {
  const d = buffer(128, 72);
  const cinder = kind === "cinders";
  d.rect(0, 0, 128, 72, cinder ? "#2a1018" : "#141028");
  for (const [x, y] of [[6, 6], [18, 12], [36, 5], [58, 10], [84, 4], [110, 8], [100, 18], [14, 24], [70, 16], [122, 28]]) {
    d.p(x, y, cinder ? "#ffb089" : "#f6edd8");
  }
  d.rect(0, 58, 128, 14, cinder ? "#3a1820" : "#1b1430");
  d.hline(0, 58, 128, cinder ? "#a05040" : "#6a5888");
  const pillar = cinder ? "#6a3030" : "#3a3058";
  const cap = cinder ? "#a05048" : "#6a5a90";
  d.rect(30, 30, 8, 30, pillar, "#120810");
  d.rect(90, 30, 8, 30, pillar, "#120810");
  d.rect(30, 28, 68, 5, cap, "#120810");
  for (let x = 38; x <= 90; x++) {
    const t = (x - 64) / 26;
    const y = 28 - Math.round((1 - t * t) * 12);
    d.p(x, y, cap);
    d.p(x, y + 1, pillar);
  }
  if (cinder) {
    d.rect(58, 8, 4, 8, "#ffd15a", "#a86a12");
    d.rect(50, 12, 4, 6, "#ff8a3a");
    d.rect(74, 12, 4, 6, "#ff8a3a");
    d.rect(60, 14, 8, 6, "#ff5a32", "#8a2818");
    for (const [x, h] of [[46, 7], [64, 11], [80, 6], [56, 5], [72, 5]]) {
      for (let i = 0; i < h; i++) d.p(x, 26 - i, i % 2 ? "#ffd15a" : "#ff5a32");
    }
  } else {
    for (let i = 0; i < 16; i++) {
      const w = i < 9 ? i : 16 - i;
      d.hline(64 - w, 16 + i, w * 2 + 1, i % 3 === 0 ? "#f4fffc" : "#3ee0c3");
    }
    d.p(64, 20, "#ffffff");
    d.rect(40, 36, 3, 4, "#ffd56a");
    d.rect(86, 36, 3, 4, "#ffd56a");
  }
  d.rect(50, 54, 28, 4, cinder ? "#4a2828" : "#2a2444");
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

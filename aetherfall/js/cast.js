import { buffer, outline, shift } from "./pixel.js";

export const SPRITE_W = 40;
export const SPRITE_H = 64;
export const FRAME_COUNT = 6;

const CX = 20;
const FEET = 62;
const INK = "#1b1218";

const BOB = [0, 0, -1, -1, -1, 0];
const HAIR_X = [0, 1, 1, 0, -1, -1];
const CAPE_X = [0, -1, 0, 1, 1, 0];
const WING_Y = [0, -1, -2, -1, 0, 1];

function tones(base, lift = 36) {
  return {
    hi: shift(base, lift + 28),
    light: shift(base, lift),
    base,
    shadow: shift(base, -42),
  };
}

function paintCel(d, x0, y0, w, h, t, hole) {
  if (w <= 0 || h <= 0) return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (hole && hole(x, y)) continue;
      const nx = w === 1 ? 0 : x / (w - 1);
      const ny = h === 1 ? 0 : y / (h - 1);
      let c = t.base;
      if (nx < 0.22 && ny < 0.32) c = t.hi;
      else if (nx < 0.46 && ny < 0.72) c = t.light;
      else if (nx > 0.74 || ny > 0.84) c = t.shadow;
      d.p(x0 + x, y0 + y, c);
    }
  }
}

function paintEllipse(d, cx, cy, rx, ry, t) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx + 0.01) + (y * y) / (ry * ry + 0.01) > 1) continue;
      const nx = (x + rx) / (rx * 2);
      const ny = (y + ry) / (ry * 2);
      let c = t.base;
      if (nx < 0.28 && ny < 0.34) c = t.hi;
      else if (nx < 0.48 && ny < 0.62) c = t.light;
      else if (nx > 0.72 || ny > 0.78) c = t.shadow;
      d.p(cx + x, cy + y, c);
    }
  }
}

function shine(d, x, y, c) {
  d.p(x, y, c);
  d.p(x + 1, y, c);
  d.p(x, y + 1, c);
}

const CAST = {
  veyra: spec("tall", "plate", "spiky", { hat: "crown", back: "flame", weapon: "dual", ears: "point", skin: "#f2c2a6", hair: "#ef3d24", cloth: "#8d1a30", metal: "#f3f6fb", trim: "#ffd36a", cape: "#ff7630", gem: "#ffd36a", boots: "#35161c", pants: "#5c2432", iris: "#ffb03a" }),
  calder: spec("wide", "plate", "short", { hat: "helm", back: "cape", weapon: "anchor", shield: "tower", feature: "beard", skin: "#e2b08e", hair: "#6a5340", cloth: "#1d4e78", metal: "#d5e4f2", trim: "#e6d2a4", cape: "#16344e", gem: "#49b4ff", boots: "#14202c", pants: "#16344c", iris: "#7ec8ff" }),
  siff: spec("tall", "tunic", "long", { hat: "ribbon", back: "ribbon", weapon: "flute", ears: "point", skin: "#f6d2ba", hair: "#f3e4b4", cloth: "#2c6e62", metal: "#e7eef2", trim: "#f0d78a", cape: "#8fd8c8", gem: "#7dffe0", boots: "#24342e", pants: "#1e4e48", iris: "#7dffe0" }),
  thistle: spec("robe", "robe", "long", { hat: "antler", back: "cape", weapon: "staff", feature: "beard", skin: "#d09268", hair: "#6d9348", cloth: "#3c5a30", metal: "#efe0b8", trim: "#d8c078", cape: "#2c4a26", gem: "#d8a04a", boots: "#3a2a1c", pants: "#2c4024", iris: "#d8a04a" }),
  iri: spec("robe", "dress", "long", { hat: "halo", weapon: "book", skin: "#f7d8c6", hair: "#f7f4ee", cloth: "#f4f7fc", metal: "#ffffff", trim: "#f0d78c", cape: "#fff6d8", gem: "#ffe9a0", boots: "#c8bdd4", pants: "#e4d8f0", iris: "#ffe08a" }),
  morr: spec("slim", "coat", "hood", { back: "ragged", weapon: "scythe", skin: "#d8b4a4", hair: "#2a2144", cloth: "#241833", metal: "#d9d4e8", trim: "#c6b4f0", cape: "#3a2858", gem: "#b48cff", boots: "#120c18", pants: "#1a1428", iris: "#c4b0ff" }),
  joss: spec("slim", "coat", "side", { back: "cape", weapon: "fan", skin: "#e8b898", hair: "#ff8a32", cloth: "#8c2e22", metal: "#f0e6d8", trim: "#ffd08a", cape: "#c4482c", gem: "#ff6a3a", boots: "#3a1c18", pants: "#6a2820", iris: "#ffb060" }),
  pella: spec("short", "robe", "curls", { hat: "flower", weapon: "bell", blush: true, skin: "#f4c8b6", hair: "#3a72aa", cloth: "#245c88", metal: "#d5e6f2", trim: "#f2e2c0", cape: "#7eb7d8", gem: "#8fd0ff", boots: "#1c3344", pants: "#1a4460", iris: "#8fd0ff" }),
  arun: spec("tall", "tunic", "ponytail", { back: "quiver", weapon: "bow", skin: "#c88858", hair: "#1c1a28", cloth: "#3e6c4e", metal: "#e2e8ea", trim: "#e6d39a", cape: "#c8b07a", gem: "#49d68a", boots: "#2a241c", pants: "#2a4434", iris: "#49d68a" }),
  osa: spec("wide", "plate", "bob", { hat: "helm", weapon: "hammer", skin: "#8d4e34", hair: "#1a1614", cloth: "#6a5438", metal: "#c8c2b6", trim: "#e0c48a", cape: "#5a4632", gem: "#e0a04a", boots: "#2c241c", pants: "#4a3c2c", iris: "#e0a04a" }),
  mae: spec("slim", "coat", "bob", { weapon: "lantern", feature: "glasses", skin: "#f0c8aa", hair: "#5c3a2a", cloth: "#f0e2c4", metal: "#8aa0b8", trim: "#e0b45a", cape: "#f7e7c4", gem: "#ffe08a", boots: "#5a4030", pants: "#c8b498", iris: "#ffe08a" }),
  cole: spec("wide", "plate", "crop", { feature: "mask", weapon: "sword", shield: "kite", skin: "#b8886a", hair: "#1a1a22", cloth: "#2a2e3c", metal: "#9aa2b0", trim: "#8f86b0", cape: "#1a1c26", gem: "#8b7cff", boots: "#12141a", pants: "#222633", iris: "#d8e8ff" }),
  rin: spec("slim", "wrap", "wild", { ears: "cat", tail: true, weapon: "claws", mouth: "fang", skin: "#f0b898", hair: "#ffb03a", cloth: "#6e2430", metal: "#f2d2b0", trim: "#ffd08a", cape: "#ff8844", gem: "#ff5a32", boots: "#3a1c20", pants: "#4a2030", iris: "#ff8a3a" }),
  marin: spec("tall", "tunic", "crop", { hat: "cap", weapon: "trident", skin: "#e0a888", hair: "#16324a", cloth: "#1f6a8c", metal: "#d5dee8", trim: "#d8e8f2", cape: "#1a4c68", gem: "#3aa6ff", boots: "#142838", pants: "#163448", iris: "#7ec4ff" }),
  pip: spec("short", "tunic", "spiky", { weapon: "sword", blush: true, skin: "#f6c8a8", hair: "#ff5a32", cloth: "#a33b2a", metal: "#e8e8ee", trim: "#f0d08a", cape: "#ff7a48", gem: "#ff5a32", boots: "#3a221c", pants: "#6a3028", iris: "#ffb060" }),
  nia: spec("short", "dress", "buns", { weapon: "bucket", blush: true, skin: "#f8d2bc", hair: "#4aa0d8", cloth: "#68b4d8", metal: "#d5e6ef", trim: "#f7f0d8", cape: "#8fd0ea", gem: "#7ec8ff", boots: "#2a4a5c", pants: "#3a7090", iris: "#7ec8ff" }),
  tam: spec("short", "tunic", "bob", { weapon: "leaf", skin: "#f3d0b4", hair: "#5a9a48", cloth: "#d8e2c4", metal: "#eef2ea", trim: "#e8c878", cape: "#b7d89a", gem: "#63d48a", boots: "#4a5a3a", pants: "#8aaa78", iris: "#63d48a" }),
  puck: spec("orb", "tunic", "none", { weapon: "none", shield: "round", skin: "#e0b078", hair: "#d8a06a", cloth: "#d09058", metal: "#e6d4b4", trim: "#f0d2a4", cape: "#c48448", gem: "#7d5a34", boots: "#6a4a32", pants: "#c48448", iris: "#5a3818" }),
  tess: spec("short", "dress", "crop", { hat: "flower", wings: "insect", weapon: "jar", blush: true, skin: "#fbe0cc", hair: "#f2d48a", cloth: "#f7f3e6", metal: "#fffaf0", trim: "#f0d56a", cape: "#fff4c8", gem: "#ffe98a", boots: "#e0c8a0", pants: "#f0e0c0", iris: "#ffe08a" }),
  rathe: spec("slim", "wrap", "hood", { weapon: "dagger", feature: "scar", skin: "#c89880", hair: "#1a1428", cloth: "#3a2a42", metal: "#c8c2d0", trim: "#6a5a78", cape: "#2a2034", gem: "#9070d0", boots: "#120e18", pants: "#241828", iris: "#b090e0" }),
  hobb: spec("wide", "plate", "none", { hat: "kettle", weapon: "axe", skin: "#e0b090", hair: "#5a4030", cloth: "#8a3a28", metal: "#d8d2cc", trim: "#e0b060", cape: "#6a2c22", gem: "#ff6a3a", boots: "#3a241c", pants: "#5a3024", iris: "#ffb080" }),
  sallow: spec("tall", "tunic", "crest", { weapon: "spear", skin: "#e8c0a0", hair: "#d8c878", cloth: "#4a6a48", metal: "#dfe6df", trim: "#d8d0a8", cape: "#3e5a40", gem: "#8ee08a", boots: "#2c3424", pants: "#2e4430", iris: "#b0e090" }),
  quinn: spec("robe", "robe", "braids", { hat: "circlet", weapon: "rosary", skin: "#e8b898", hair: "#8a5a3a", cloth: "#8d6a48", metal: "#efe8dc", trim: "#f0d8a0", cape: "#a68460", gem: "#e0a04a", boots: "#4a3428", pants: "#6a4c34", iris: "#e0b070" }),
  lir: spec("slim", "robe", "hood", { wings: "moth", weapon: "lantern", skin: "#e4c4ce", hair: "#3a2858", cloth: "#4a3568", metal: "#d4c8e4", trim: "#e0c8f0", cape: "#c8a0e0", gem: "#e4c6ff", boots: "#2a2038", pants: "#3a2850", iris: "#e4c6ff" }),
};

function spec(build, outfit, hair, rest) {
  return { build, outfit, hair, mouth: "smile", ...rest };
}

function layout(unit, bob) {
  const feet = FEET + bob;
  const robe = unit.outfit === "robe" || unit.outfit === "dress";
  const legs = unit.build === "short" ? 7 : unit.build === "tall" ? 12 : unit.build === "wide" ? 8 : unit.build === "slim" ? 11 : 10;
  const torsoH = robe ? (unit.build === "short" ? 16 : 20) : unit.build === "wide" ? 12 : 12;
  const bootTop = feet - 4;
  const legTop = bootTop - legs;
  const torsoBottom = robe ? feet - 3 : legTop + 2;
  const torsoTop = torsoBottom - torsoH;
  const headRy = unit.build === "short" ? 9 : 8;
  const headRx = unit.build === "short" ? 9 : 8;
  const headCy = torsoTop + 2;
  const headTop = headCy - headRy;
  const half = unit.build === "wide" ? 8 : unit.outfit === "wrap" ? 4 : unit.outfit === "plate" ? 6 : 5;
  return { feet, bootTop, legTop, torsoTop, torsoBottom, torsoH, headCy, headTop, headRx, headRy, half, robe };
}

function drawCape(d, unit, box, sway) {
  if (!unit.back || unit.back === "quiver" || unit.back === "ribbon") return;
  const t = tones(unit.cape, 28);
  const top = box.torsoTop + 1;
  const len = unit.back === "flame" ? box.torsoH + 6 : box.torsoH + 10;
  for (let i = 0; i < len; i++) {
    const y = top + i;
    if (y >= box.feet - 2) break;
    let half = unit.back === "flame" ? 6 : 7;
    if (unit.back === "ragged" && i % 4 === 0) half -= 2;
    if (unit.back === "flame") half += (i % 3 === 0 ? 0 : 1);
    for (let x = -half; x <= half; x++) {
      const nx = (x + half) / Math.max(1, half * 2);
      let c = nx < 0.3 ? t.light : nx > 0.75 ? t.shadow : t.base;
      if (unit.back === "flame" && (i > len * 0.55 || Math.abs(x) >= half - 1)) c = t.hi;
      d.p(CX + x + sway, y, c);
    }
  }
}

function drawRibbon(d, unit, box, sway) {
  if (unit.back !== "ribbon") return;
  const t = tones(unit.cape, 24);
  d.line(CX + 4, box.torsoTop + 2, CX + 9 + sway, Math.min(box.feet - 8, box.torsoTop + 16), t.light, 2);
  d.line(CX + 3, box.torsoTop + 4, CX + 7 + sway, Math.min(box.feet - 6, box.torsoTop + 18), t.base, 1);
}

function drawQuiver(d, unit, box) {
  if (unit.back !== "quiver") return;
  const wood = tones("#6b442c", 20);
  paintCel(d, CX + 6, box.torsoTop, 4, 10, wood);
  d.p(CX + 6, box.torsoTop - 1, unit.trim);
  d.p(CX + 7, box.torsoTop - 2, unit.metal);
  d.p(CX + 8, box.torsoTop - 1, unit.trim);
}

function drawWings(d, unit, box, flap) {
  if (unit.wings === "moth") {
    const t = tones(unit.cape, 30);
    paintEllipse(d, CX - 12, box.torsoTop + 2 + flap, 6, 5, t);
    paintEllipse(d, CX + 12, box.torsoTop + 2 + flap, 6, 5, t);
    paintEllipse(d, CX - 10, box.torsoTop + 9, 4, 3, tones(unit.trim, 10));
    paintEllipse(d, CX + 10, box.torsoTop + 9, 4, 3, tones(unit.trim, 10));
    d.rect(CX - 14, box.torsoTop + flap, 2, 2, unit.gem);
    d.rect(CX + 12, box.torsoTop + flap, 2, 2, unit.gem);
  } else if (unit.wings === "insect") {
    const t = tones(unit.gem, 16);
    paintEllipse(d, CX - 10, box.headTop + 2 + flap, 5, 3, t);
    paintEllipse(d, CX + 10, box.headTop + 2 + flap, 5, 3, t);
  }
}

function drawTail(d, unit, box, sway) {
  if (!unit.tail) return;
  const t = tones(unit.hair, 24);
  d.line(CX + 5, box.torsoBottom - 4, CX + 11 + sway, box.torsoBottom, t.light, 2);
  d.line(CX + 11 + sway, box.torsoBottom, CX + 8 + sway, box.torsoBottom + 4, t.base, 2);
}

function drawLegs(d, unit, box) {
  if (box.robe) return;
  const pants = tones(unit.pants, 22);
  const boot = tones(unit.boots, 18);
  const gap = unit.build === "wide" ? 3 : 2;
  const lw = unit.build === "wide" ? 4 : 3;
  const lh = box.bootTop - box.legTop;
  paintCel(d, CX - gap - lw, box.legTop, lw, lh, pants);
  paintCel(d, CX + gap, box.legTop, lw, lh, pants);
  paintCel(d, CX - gap - lw - 1, box.bootTop, lw + 2, box.feet - box.bootTop, boot);
  paintCel(d, CX + gap - 1, box.bootTop, lw + 2, box.feet - box.bootTop, boot);
}

function drawTorso(d, unit, box) {
  const cloth = tones(unit.outfit === "plate" ? unit.metal : unit.cloth, unit.outfit === "plate" ? 18 : 30);
  if (box.robe) {
    const flare = unit.outfit === "dress" ? 7 : 5;
    const h = box.torsoBottom - box.torsoTop;
    for (let i = 0; i < h; i++) {
      const k = i / Math.max(1, h - 1);
      const half = box.half + Math.round(k * flare);
      for (let x = -half; x <= half; x++) {
        const nx = (x + half) / Math.max(1, half * 2);
        let c = cloth.base;
        if (nx < 0.2 && k < 0.3) c = cloth.hi;
        else if (nx < 0.4) c = cloth.light;
        else if (nx > 0.78) c = cloth.shadow;
        if (x === 0 && k > 0.12) c = cloth.shadow;
        if (k > 0.92) c = unit.trim;
        d.p(CX + x, box.torsoTop + i, c);
      }
    }
    const boot = tones(unit.boots, 18);
    paintCel(d, CX - 5, box.feet - 4, 4, 4, boot);
    paintCel(d, CX + 2, box.feet - 4, 4, 4, boot);
    return;
  }
  const w = box.half * 2 + 1;
  const h = box.torsoBottom - box.torsoTop;
  paintCel(d, CX - box.half, box.torsoTop, w, h, cloth);
  if (unit.outfit === "plate") {
    const trim = tones(unit.trim, 12);
    paintCel(d, CX - box.half - 2, box.torsoTop - 1, 5, 5, cloth);
    paintCel(d, CX + box.half - 3, box.torsoTop - 1, 5, 5, cloth);
    d.hline(CX - box.half, box.torsoBottom - 3, w, trim.base);
  } else if (unit.outfit === "coat") {
    d.rect(CX - 1, box.torsoTop + 2, 2, h - 4, tones(unit.cape, 10).shadow);
  } else if (unit.outfit === "wrap") {
    d.line(CX - box.half, box.torsoTop + 2, CX + box.half, box.torsoBottom - 3, unit.trim, 1);
  } else {
    d.hline(CX - box.half, box.torsoBottom - 3, w, unit.trim);
  }
}

function drawArms(d, unit, box) {
  const plate = unit.outfit === "plate";
  const t = tones(plate ? unit.metal : unit.cloth, plate ? 16 : 26);
  const skin = tones(unit.skin, 28);
  const reach = unit.build === "wide" ? 7 : 8;
  const y0 = box.torsoTop + 2;
  const left = CX - box.half - 1;
  const right = CX + box.half - 1;
  paintCel(d, left - 3, y0, 3, reach, t);
  paintCel(d, right + 1, y0, 3, reach, t);
  paintCel(d, left - 3, y0 + reach, 3, 3, plate ? t : skin);
  paintCel(d, right + 1, y0 + reach, 3, 3, plate ? t : skin);
  return {
    left: { x: left - 2, y: y0 + reach },
    right: { x: right + 2, y: y0 + reach },
  };
}

function drawNeck(d, unit, box) {
  if (box.robe) return;
  paintCel(d, CX - 2, box.torsoTop - 3, 4, 4, tones(unit.skin, 28));
}

function drawHead(d, unit, box) {
  paintEllipse(d, CX, box.headCy, box.headRx, box.headRy, tones(unit.skin, 32));
}

function drawEars(d, unit, box) {
  if (unit.hair === "hood" || unit.hat === "helm" || unit.hat === "kettle") return;
  const skin = tones(unit.skin, 28);
  const hair = tones(unit.hair, 24);
  if (unit.ears === "point") {
    d.line(CX - box.headRx, box.headCy, CX - box.headRx - 3, box.headCy - 4, skin.light, 1);
    d.p(CX - box.headRx - 3, box.headCy - 4, skin.shadow);
    d.line(CX + box.headRx, box.headCy, CX + box.headRx + 3, box.headCy - 4, skin.light, 1);
    d.p(CX + box.headRx + 3, box.headCy - 4, skin.shadow);
  }
  if (unit.ears === "cat") {
    d.line(CX - box.headRx + 1, box.headTop + 2, CX - box.headRx - 1, box.headTop - 5, hair.light, 2);
    d.line(CX + box.headRx - 1, box.headTop + 2, CX + box.headRx + 1, box.headTop - 5, hair.light, 2);
    d.p(CX - box.headRx, box.headTop - 2, "#ffb0c4");
    d.p(CX + box.headRx, box.headTop - 2, "#ffb0c4");
  }
}

function hairCap(d, cx, top, rx, depth, t, sway) {
  for (let y = 0; y < depth; y++) {
    const half = rx - Math.floor(y * 0.35);
    for (let x = -half; x <= half; x++) {
      const nx = (x + half) / Math.max(1, half * 2);
      let c = t.base;
      if (nx < 0.22 && y < 2) c = t.hi;
      else if (nx < 0.42) c = t.light;
      else if (nx > 0.75) c = t.shadow;
      d.p(cx + x + sway, top + y, c);
    }
  }
  shine(d, cx - rx + 3 + sway, top + 1, t.hi);
}

function drawHair(d, unit, box, sway) {
  const t = tones(unit.hair, 34);
  const top = box.headTop;
  const style = unit.hair;
  if (!style || style === "none") return;
  if (style === "hood") {
    paintEllipse(d, CX + sway, box.headCy - 1, box.headRx + 3, box.headRy + 3, t);
    paintCel(d, CX - box.headRx - 4 + sway, box.headCy, 4, 8, t);
    paintCel(d, CX + box.headRx + sway, box.headCy, 4, 8, t);
    return;
  }
  if (style === "spiky" || style === "wild" || style === "crest") {
    const spikes = style === "crest"
      ? [[-1, 10]]
      : style === "wild"
        ? [[-8, 6], [-3, 9], [2, 5], [6, 8]]
        : [[-7, 7], [-2, 10], [3, 6], [7, 8]];
    for (const [dx, h] of spikes) {
      for (let i = 0; i < h; i++) {
        const c = i > h - 2 ? t.hi : i > h * 0.45 ? t.light : t.base;
        d.p(CX + dx + sway, top - i, c);
        d.p(CX + dx + 1 + sway, top - i, i === 0 ? t.shadow : c);
      }
    }
  }
  hairCap(d, CX, top, box.headRx + 1, 6, t, sway);
  if (style === "long" || style === "ponytail" || style === "braids") {
    const drop = Math.min(16, box.torsoBottom - top - 8);
    paintCel(d, CX - box.headRx - 3 + sway, top + 4, 3, drop, t);
    if (style === "ponytail") paintCel(d, CX + box.headRx + 1 + sway, top + 5, 3, 11, t);
    else paintCel(d, CX + box.headRx + sway, top + 4, 3, drop, t);
  }
  if (style === "braids") {
    for (let i = 0; i < 12; i++) {
      const c = i % 3 === 0 ? t.hi : t.shadow;
      d.p(CX - box.headRx + sway, top + 12 + i, c);
      d.p(CX + box.headRx - 1 + sway, top + 12 + i, c);
    }
    d.p(CX - box.headRx + sway, top + 23, unit.trim);
    d.p(CX + box.headRx - 1 + sway, top + 23, unit.trim);
  }
  if (style === "bob" || style === "curls" || style === "buns") {
    paintCel(d, CX - box.headRx - 2 + sway, top + 3, 3, box.headRy + 2, t);
    paintCel(d, CX + box.headRx - 1 + sway, top + 3, 3, box.headRy + 2, t);
  }
  if (style === "curls") {
    paintEllipse(d, CX - box.headRx + sway, box.headCy + 4, 3, 3, t);
    paintEllipse(d, CX + box.headRx + sway, box.headCy + 4, 3, 3, t);
  }
  if (style === "buns") {
    paintEllipse(d, CX - box.headRx - 1 + sway, top + 2, 4, 4, t);
    paintEllipse(d, CX + box.headRx + 1 + sway, top + 2, 4, 4, t);
    shine(d, CX - box.headRx - 2 + sway, top, t.hi);
    shine(d, CX + box.headRx + sway, top, t.hi);
  }
  if (style === "side") {
    paintCel(d, CX - box.headRx + sway, top + 4, box.headRx, 7, t);
  }
  if (style === "crop" || style === "short") {
    hairCap(d, CX, top, box.headRx, 4, t, sway);
  }
}

function drawHat(d, unit, box, sway) {
  const top = box.headTop;
  switch (unit.hat) {
    case "crown":
      d.rect(CX - 7, top - 4, 2, 5, unit.trim);
      d.rect(CX - 1, top - 7, 2, 8, unit.trim);
      d.rect(CX + 5, top - 4, 2, 5, unit.trim);
      d.p(CX, top - 7, unit.gem);
      d.p(CX - 6, top - 4, "#fff6c8");
      break;
    case "antler":
      d.line(CX - 2, top, CX - 8 + sway, top - 8, "#6b4a2e", 2);
      d.line(CX + 2, top, CX + 8 + sway, top - 8, "#6b4a2e", 2);
      d.p(CX - 9 + sway, top - 5, "#8a6240");
      d.p(CX + 9 + sway, top - 5, "#8a6240");
      break;
    case "flower":
      d.rect(CX + box.headRx - 2, top - 3, 4, 4, "#e85a8c");
      d.p(CX + box.headRx - 1, top - 2, "#ffe08a");
      d.p(CX + box.headRx, top - 4, "#67b85a");
      break;
    case "cap":
      paintCel(d, CX - box.headRx, top - 4, box.headRx * 2, 4, tones(unit.cloth, 20));
      d.rect(CX - box.headRx - 1, top, box.headRx * 2 + 2, 2, unit.trim);
      break;
    case "circlet":
      d.hline(CX - box.headRx + 2, top + 2, box.headRx * 2 - 3, unit.trim);
      d.rect(CX - 1, top, 3, 2, unit.gem);
      break;
    case "ribbon":
      d.rect(CX - 1, top - 8, 2, 7, unit.trim);
      paintCel(d, CX - 5, top - 8, 4, 4, tones(unit.cape, 20));
      paintCel(d, CX + 2, top - 7, 4, 5, tones(unit.gem, 12));
      break;
    case "helm": {
      const m = tones(unit.metal, 16);
      paintEllipse(d, CX, box.headCy, box.headRx + 1, box.headRy + 1, m);
      d.rect(CX - 5, box.headCy - 1, 10, 3, "#102838");
      d.p(CX - 4, box.headCy, "#d7f6ff");
      d.p(CX + 3, box.headCy, "#d7f6ff");
      d.rect(CX - 2, top - 2, 4, 2, unit.trim);
      break;
    }
    case "kettle": {
      const m = tones(unit.metal, 14);
      paintEllipse(d, CX, box.headCy - 1, box.headRx + 2, box.headRy + 3, m);
      d.rect(CX - box.headRx - 1, box.headCy + 2, box.headRx * 2 + 3, 3, m.shadow);
      d.rect(CX - 6, box.headCy, 12, 3, "#1b2430");
      d.p(CX - 5, box.headCy + 1, "#ffb080");
      d.p(CX + 4, box.headCy + 1, "#ffb080");
      d.rect(CX - 3, top - 5, 6, 3, unit.trim);
      break;
    }
    default:
      break;
  }
}

function drawWeapon(d, unit, hands) {
  const metal = tones(unit.metal, 20);
  const wood = tones("#6d4630", 18);
  const gem = tones(unit.gem, 18);
  const { left, right } = hands;
  const x = right.x;
  const y = right.y;
  const blade = (bx, by, len) => {
    paintCel(d, bx, by - len, 3, len, metal);
    d.rect(bx, by - len, 1, len, metal.hi);
    d.rect(bx - 1, by - 2, 5, 2, unit.trim);
    paintCel(d, bx, by, 3, 3, wood);
  };
  switch (unit.weapon) {
    case "sword":
      blade(x, y, 16);
      break;
    case "dual":
      blade(x, y, 14);
      blade(left.x - 1, y, 14);
      break;
    case "dagger":
      blade(x, y, 9);
      blade(left.x, y, 9);
      break;
    case "anchor":
      paintCel(d, x, y - 18, 3, 18, metal);
      d.hline(x - 4, y - 18, 11, metal.light);
      d.p(x - 4, y - 17, metal.base);
      d.p(x + 6, y - 17, metal.base);
      d.hline(x - 4, y - 2, 11, metal.light);
      d.p(x - 4, y - 1, metal.shadow);
      d.p(x + 6, y - 1, metal.shadow);
      break;
    case "flute":
      paintCel(d, x, y - 24, 3, 26, wood);
      paintEllipse(d, x + 1, y - 26, 3, 3, gem);
      shine(d, x, y - 27, "#ffffff");
      for (let i = 0; i < 4; i++) d.p(x + 1, y - 16 + i * 3, "#1a120c");
      break;
    case "staff":
      paintCel(d, x, y - 22, 3, 24, wood);
      paintEllipse(d, x + 1, y - 26, 4, 4, gem);
      shine(d, x, y - 28, "#ffffff");
      d.p(x - 1, y - 30, "#2f7a3a");
      d.p(x, y - 31, "#8ad48a");
      d.p(x + 2, y - 30, "#2f7a3a");
      break;
    case "book":
      paintCel(d, x + 1, y - 12, 9, 10, tones(unit.trim, 16));
      d.rect(x + 2, y - 11, 7, 8, "#f7f1e4");
      d.rect(x + 4, y - 8, 3, 3, unit.gem);
      shine(d, x + 4, y - 8, "#ffffff");
      break;
    case "scythe":
      paintCel(d, x, y - 26, 2, 28, wood);
      for (let i = 0; i < 14; i++) {
        d.p(x - i, y - 26 + Math.floor(i / 2), metal.light);
        d.p(x - i, y - 25 + Math.floor(i / 2), metal.shadow);
      }
      break;
    case "fan":
      for (let i = -6; i <= 6; i++) d.line(x, y, x + i, y - 12, i % 2 ? unit.trim : unit.gem, 1);
      paintCel(d, x - 2, y - 2, 4, 4, wood);
      break;
    case "bell":
      d.rect(x, y - 14, 2, 3, unit.trim);
      paintEllipse(d, x, y - 8, 4, 4, metal);
      d.p(x, y - 4, unit.trim);
      break;
    case "bow": {
      const bx = CX - 14;
      for (let i = -12; i <= 12; i++) {
        const bend = Math.round(Math.sin(((i + 12) / 24) * Math.PI) * 5);
        d.p(bx - bend, y - 4 + i, wood.base);
        d.p(bx - bend - 1, y - 4 + i, wood.shadow);
      }
      for (let i = -11; i <= 11; i++) d.p(bx + 1, y - 4 + i, unit.trim);
      d.p(bx + 2, y - 6, metal.hi);
      break;
    }
    case "hammer":
      paintCel(d, x - 5, y - 16, 11, 6, metal);
      shine(d, x - 4, y - 15, metal.hi);
      paintCel(d, x, y - 10, 3, 12, wood);
      break;
    case "lantern":
      paintCel(d, x, y - 18, 2, 4, wood);
      paintCel(d, x - 3, y - 14, 8, 8, tones(unit.trim, 14));
      d.rect(x - 2, y - 13, 6, 6, unit.gem);
      shine(d, x - 1, y - 12, "#fffce8");
      break;
    case "claws":
      for (const hand of [left, right]) {
        const dir = hand.x < CX ? -1 : 1;
        for (let i = 0; i < 3; i++) {
          d.line(hand.x + i - 1, hand.y + 2, hand.x + i - 1 + dir * 4, hand.y + 8, metal.light, 1);
        }
      }
      break;
    case "trident":
      paintCel(d, x, y - 22, 3, 22, metal);
      paintCel(d, x - 4, y - 22, 2, 7, metal);
      paintCel(d, x + 4, y - 22, 2, 7, metal);
      d.p(x, y - 22, metal.hi);
      break;
    case "bucket":
      d.line(x - 2, y - 14, x + 6, y - 14, wood.base, 1);
      paintCel(d, x - 2, y - 13, 8, 2, tones(unit.trim, 10));
      paintCel(d, x - 2, y - 11, 8, 6, metal);
      shine(d, x - 1, y - 10, metal.hi);
      paintCel(d, x + 2, y - 5, 2, 4, wood);
      break;
    case "leaf":
      d.line(x + 1, y, x + 1, y - 14, "#1d5a30", 1);
      paintEllipse(d, x + 1, y - 9, 5, 6, tones("#3f9d55", 28));
      d.line(x + 1, y - 14, x + 1, y - 4, "#1d5a30", 1);
      break;
    case "axe":
      paintCel(d, x, y - 18, 3, 18, wood);
      paintCel(d, x + 2, y - 18, 6, 8, metal);
      shine(d, x + 3, y - 17, metal.hi);
      d.p(x + 7, y - 19, metal.light);
      break;
    case "spear":
      paintCel(d, x, y - 26, 2, 28, wood);
      paintCel(d, x - 2, y - 30, 6, 6, metal);
      d.p(x, y - 30, metal.hi);
      break;
    case "jar":
      paintCel(d, x - 3, y - 14, 8, 3, metal);
      paintEllipse(d, x + 1, y - 7, 5, 6, gem);
      shine(d, x, y - 9, "#fffce8");
      break;
    case "rosary":
      d.ring(x + 2, y - 8, 5, unit.trim);
      d.p(x + 2, y - 8, unit.gem);
      d.line(x + 2, y - 3, x + 2, y + 3, unit.trim, 1);
      shine(d, x + 1, y - 10, "#fff6c8");
      break;
    default:
      break;
  }
}

function drawShield(d, unit, left) {
  if (!unit.shield) return;
  const metal = tones(unit.metal, 16);
  const x = left.x - 2;
  const y = left.y - 2;
  if (unit.shield === "round") {
    paintEllipse(d, x, y, 7, 7, metal);
    d.ring(x, y, 3, unit.trim);
    d.rect(x - 1, y - 1, 3, 3, unit.gem);
    shine(d, x - 3, y - 3, metal.hi);
  } else if (unit.shield === "tower") {
    paintCel(d, x - 6, y - 14, 12, 18, metal);
    d.rect(x - 1, y - 12, 2, 14, unit.trim);
    d.hline(x - 5, y - 4, 10, unit.trim);
    d.rect(x - 1, y - 2, 3, 3, unit.gem);
    shine(d, x - 4, y - 12, metal.hi);
  } else {
    paintEllipse(d, x, y - 2, 6, 8, metal);
    d.rect(x - 1, y - 8, 2, 12, unit.trim);
    d.hline(x - 4, y - 2, 8, unit.trim);
    d.p(x, y, unit.gem);
    shine(d, x - 3, y - 6, metal.hi);
  }
}

function drawFace(d, unit, box, blink) {
  if (unit.hat === "helm" || unit.hat === "kettle" || unit.build === "orb") return;
  const y = box.headCy - 1;
  const iris = unit.iris;
  const spots = unit.hair === "side" ? [CX + 2] : [CX - 6, CX + 2];
  if (unit.feature === "mask") d.rect(CX - 7, y - 1, 14, 6, "#241833");
  for (const x of spots) {
    d.hline(x, y - 1, 4, tones(unit.hair, 10).shadow);
    if (blink) {
      d.hline(x, y + 2, 4, "#4a342c");
      continue;
    }
    d.rect(x, y + 1, 4, 3, "#f7fbff");
    d.rect(x + 1, y + 1, 2, 3, iris);
    d.rect(x + 1, y + 2, 2, 2, "#160e12");
    d.p(x + 1, y + 1, "#ffffff");
  }
  if (unit.feature === "glasses") {
    for (const x of [CX - 7, CX + 1]) {
      d.hline(x, y - 1, 6, unit.metal);
      d.hline(x, y + 5, 6, unit.metal);
      d.p(x, y, unit.metal);
      d.p(x, y + 4, unit.metal);
      d.p(x + 5, y, unit.metal);
      d.p(x + 5, y + 4, unit.metal);
    }
    d.hline(CX - 1, y + 2, 2, unit.metal);
  }
  if (!unit.feature || unit.feature === "none" || unit.feature === "scar" || unit.feature === "glasses" || unit.feature === "mask") {
    const my = y + 7;
    if (unit.mouth === "fang") {
      d.hline(CX - 2, my, 4, "#a05048");
      d.p(CX - 1, my + 1, "#f4f7ff");
      d.p(CX + 1, my + 1, "#f4f7ff");
    } else if (unit.mouth === "flat") {
      d.hline(CX - 2, my, 4, "#a05048");
    } else {
      d.p(CX - 2, my, "#c06058");
      d.p(CX - 1, my + 1, "#a04840");
      d.p(CX, my + 1, "#a04840");
      d.p(CX + 1, my, "#c06058");
    }
  }
  if (unit.blush) {
    d.p(CX - 8, y + 4, "#f0a0aa");
    d.p(CX - 7, y + 5, "#f0a0aa");
    d.p(CX + 7, y + 4, "#f0a0aa");
    d.p(CX + 8, y + 5, "#f0a0aa");
  }
  if (unit.feature === "scar") {
    d.p(CX + 7, y - 1, "#c45b5b");
    d.p(CX + 8, y, "#c45b5b");
    d.p(CX + 8, y + 1, "#c45b5b");
  }
  d.p(CX, y + 6, tones(unit.skin, 20).shadow);
}

function drawBeard(d, unit, box) {
  if (unit.feature !== "beard") return;
  const t = tones(unit.hair, 18);
  const y = box.headCy + 6;
  paintCel(d, CX - 5, y, 10, 5, t);
  paintCel(d, CX - 2, y + 4, 4, 3, t);
}

function drawGem(d, unit, box) {
  if (unit.build === "orb") return;
  const x = CX - 1;
  const y = box.torsoTop + 4;
  d.rect(x, y, 3, 3, unit.gem);
  d.p(x, y, "#fffaf0");
}

function drawOrb(d, unit, bob, blink) {
  const feet = FEET + bob;
  const cy = feet - 16;
  const cloth = tones(unit.cloth, 26);
  const boot = tones(unit.boots, 16);
  const metal = tones(unit.metal, 16);
  paintCel(d, CX - 8, feet - 4, 5, 4, boot);
  paintCel(d, CX + 3, feet - 4, 5, 4, boot);
  paintEllipse(d, CX - 12, cy + 1, 6, 6, metal);
  d.rect(CX - 13, cy, 2, 2, unit.gem);
  shine(d, CX - 14, cy - 2, metal.hi);
  paintEllipse(d, CX, cy, 10, 9, cloth);
  paintEllipse(d, CX, cy + 2, 6, 5, tones(unit.trim, 18));
  paintCel(d, CX - 14, cy - 1, 4, 4, cloth);
  paintCel(d, CX + 10, cy - 1, 4, 4, cloth);
  d.p(CX, cy - 12, "#2f7a3a");
  d.p(CX, cy - 13, "#2f7a3a");
  d.p(CX - 1, cy - 14, "#8ad48a");
  d.p(CX + 1, cy - 14, "#8ad48a");
  if (blink) {
    d.hline(CX - 5, cy - 1, 4, unit.iris);
    d.hline(CX + 2, cy - 1, 4, unit.iris);
  } else {
    d.rect(CX - 5, cy - 2, 4, 4, "#fffaf0");
    d.rect(CX + 2, cy - 2, 4, 4, "#fffaf0");
    d.rect(CX - 4, cy - 1, 2, 2, unit.iris);
    d.rect(CX + 3, cy - 1, 2, 2, unit.iris);
    d.p(CX - 4, cy - 2, "#ffffff");
    d.p(CX + 3, cy - 2, "#ffffff");
  }
  d.p(CX - 1, cy + 3, "#6a4030");
  d.p(CX, cy + 4, "#6a4030");
  d.p(CX + 1, cy + 3, "#6a4030");
}

function clip(d) {
  for (let y = FEET; y < d.h; y++) {
    for (let x = 0; x < d.w; x++) d.clear(x, y);
  }
}

export function renderLook(unit, frame = 0) {
  const f = ((frame % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
  const d = buffer(SPRITE_W, SPRITE_H);
  const bob = BOB[f];
  if (unit.build === "orb") {
    drawOrb(d, unit, bob, f === 4);
    clip(d);
    outline(d, INK);
    return d.g;
  }
  const box = layout(unit, bob);
  const sway = HAIR_X[f];
  const cape = CAPE_X[f];
  drawWings(d, unit, box, WING_Y[f]);
  drawCape(d, unit, box, cape);
  drawRibbon(d, unit, box, sway);
  drawQuiver(d, unit, box);
  drawTail(d, unit, box, sway);
  if (unit.hair === "long" || unit.hair === "ponytail" || unit.hair === "braids" || unit.hair === "hood") {
    drawHair(d, unit, box, sway);
  }
  drawLegs(d, unit, box);
  drawTorso(d, unit, box);
  drawNeck(d, unit, box);
  const hands = drawArms(d, unit, box);
  drawHead(d, unit, box);
  if (unit.hair !== "long" && unit.hair !== "ponytail" && unit.hair !== "braids" && unit.hair !== "hood") {
    drawHair(d, unit, box, sway);
  } else if (unit.hair !== "hood") {
    hairCap(d, CX, box.headTop, box.headRx + 1, 6, tones(unit.hair, 34), sway);
  }
  drawEars(d, unit, box);
  drawHat(d, unit, box, sway);
  drawShield(d, unit, hands.left);
  drawWeapon(d, unit, hands);
  clip(d);
  outline(d, INK);
  drawFace(d, unit, box, f === 4);
  drawBeard(d, unit, box);
  drawGem(d, unit, box);
  if (unit.hat === "halo") {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      d.p(CX + Math.round(Math.cos(ang) * 8), box.headTop - 4 + Math.round(Math.sin(ang) * 3), unit.trim);
    }
  }
  return d.g;
}

export function renderUnit(id, frame = 0) {
  const unit = CAST[id];
  if (!unit) throw new Error(`no sprite for ${id}`);
  return renderLook(unit, frame);
}

export function lookIds() {
  return Object.keys(CAST);
}

const SKY = {
  fire: ["#4a1c28", "#8a3030", "#ffb080"],
  water: ["#143048", "#1d5c86", "#b7e4ff"],
  wind: ["#143828", "#2e7a58", "#d8ffe8"],
  earth: ["#3a2a16", "#6a4a28", "#f0d8a8"],
  light: ["#3a3458", "#c8b8e8", "#fff6d0"],
  dark: ["#1a1030", "#3a2868", "#d8c8ff"],
};

function backdrop(d, element) {
  const [deep, mid, light] = SKY[element] || SKY.light;
  d.rect(0, 0, d.w, d.h, deep);
  d.rect(0, Math.floor(d.h * 0.45), d.w, d.h, mid);
  for (let i = 0; i < 18; i++) {
    const x = (i * 17 + 5) % d.w;
    const y = (i * 9 + 3) % Math.floor(d.h * 0.55);
    d.p(x, y, i % 3 ? "#f6edd8" : light);
  }
  for (const [cx, cy, rx] of [[18, 28, 10], [70, 22, 14], [46, 16, 8]]) {
    if (cx < d.w) paintEllipse(d, cx, cy, rx, 4, tones(light, 8));
  }
  d.rect(0, d.h - 16, d.w, 16, shift(deep, -16));
  d.hline(0, d.h - 16, d.w, light);
  for (let x = 8; x < d.w; x += 14) {
    d.rect(x, d.h - 22, 6, 8, shift(mid, -20));
    d.p(x + 2, d.h - 24, light);
  }
}

export function renderPortrait(id, frame = 0) {
  const unit = CAST[id];
  if (!unit) throw new Error(`no portrait for ${id}`);
  const d = buffer(88, 140);
  const element = PORTRAIT_ELEMENT[id];
  backdrop(d, element);
  const sprite = renderUnit(id, frame);
  const scale = 2;
  const ox = Math.floor((88 - sprite[0].length * scale) / 2);
  const oy = 140 - 14 - sprite.length * scale;
  for (let y = 0; y < sprite.length; y++) {
    for (let x = 0; x < sprite[0].length; x++) {
      const color = sprite[y][x];
      if (!color) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) d.p(ox + x * scale + sx, oy + y * scale + sy, color);
      }
    }
  }
  d.rect(0, 0, 88, 2, "#f0d78a");
  d.rect(0, 138, 88, 2, "#f0d78a");
  d.rect(0, 0, 2, 140, "#f0d78a");
  d.rect(86, 0, 2, 140, "#f0d78a");
  return d.g;
}

const PORTRAIT_ELEMENT = {
  veyra: "fire", pip: "fire", joss: "fire", rin: "fire", hobb: "fire",
  calder: "water", pella: "water", marin: "water", nia: "water",
  siff: "wind", arun: "wind", tam: "wind", sallow: "wind",
  thistle: "earth", osa: "earth", puck: "earth", quinn: "earth",
  iri: "light", mae: "light", tess: "light",
  morr: "dark", cole: "dark", rathe: "dark", lir: "dark",
};

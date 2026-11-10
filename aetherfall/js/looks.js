/** Original silhouette recipes for the 24 veinwalkers. No borrowed character designs. */

export const LOOKS = {
  veyra: { skin: "#f0c2a4", hair: "#6e140e", hairStyle: "long", cloth: "#9a2418", trim: "#ffb15a", weapon: "twinblade", cape: true, bulk: 0.95 },
  calder: { skin: "#e7c2a2", hair: "#1d3c4a", hairStyle: "short", cloth: "#1d4e62", trim: "#8fd0e8", weapon: "anchor", cape: true, bulk: 1.28 },
  siff: { skin: "#f4d2b4", hair: "#d8f4e4", hairStyle: "wild", cloth: "#d7fff0", trim: "#43c98a", weapon: "ribbon", cape: false, bulk: 0.9 },
  thistle: { skin: "#e8c8a4", hair: "#2f6a32", hairStyle: "bun", cloth: "#3e6a34", trim: "#d2e29a", weapon: "staff", robe: true, bulk: 1 },
  iri: { skin: "#f6d8c0", hair: "#f7f1dc", hairStyle: "long", cloth: "#f4efe2", trim: "#f0d78c", weapon: "staff", halo: true, robe: true, bulk: 0.92 },
  morr: { skin: "#d8b8a4", hair: "#1a1020", hairStyle: "hood", cloth: "#2a1840", trim: "#b9a0e8", weapon: "scythe", horns: true, cape: true, bulk: 1 },
  joss: { skin: "#f0c8a8", hair: "#c45a22", hairStyle: "crest", cloth: "#c4522a", trim: "#ffd08a", weapon: "lantern", bulk: 0.94 },
  pella: { skin: "#f2d0b8", hair: "#2a6a8a", hairStyle: "braid", cloth: "#3a88b0", trim: "#d8f4ff", weapon: "staff", robe: true, bulk: 0.96 },
  arun: { skin: "#e8c4a4", hair: "#245c40", hairStyle: "crest", cloth: "#1f6a48", trim: "#b8f0c8", weapon: "bow", bulk: 0.92 },
  osa: { skin: "#c8a07a", hair: "#4a3a28", hairStyle: "bald", cloth: "#8a7048", trim: "#e6d2a4", weapon: "hammer", bulk: 1.32 },
  mae: { skin: "#f6d4bc", hair: "#f2e2a0", hairStyle: "bun", cloth: "#f7f1d8", trim: "#e7c56a", weapon: "lantern", halo: true, bulk: 0.9 },
  cole: { skin: "#d8b8a8", hair: "#241428", hairStyle: "hood", cloth: "#3a2848", trim: "#c8b0e0", weapon: "shield", bulk: 1.26 },
  rin: { skin: "#f0c8aa", hair: "#ff6a3a", hairStyle: "short", cloth: "#c43420", trim: "#ffd0a0", weapon: "sword", bulk: 0.88 },
  marin: { skin: "#e8c8b0", hair: "#14384a", hairStyle: "long", cloth: "#1d5a78", trim: "#9ad8f0", weapon: "trident", bulk: 0.94 },
  pip: { skin: "#f6d0b4", hair: "#e07a3a", hairStyle: "short", cloth: "#c4622a", trim: "#ffd8a8", weapon: "sword", bulk: 0.82 },
  nia: { skin: "#f4d4bc", hair: "#7ec8ea", hairStyle: "short", cloth: "#5aa4d4", trim: "#e8f7ff", weapon: "pail", bulk: 0.8 },
  tam: { skin: "#f2d2b6", hair: "#b8e8c8", hairStyle: "braid", cloth: "#d8ffe8", trim: "#7ad8a0", weapon: "fan", robe: true, bulk: 0.84 },
  puck: { skin: "#e0b48a", hair: "#6a4a28", hairStyle: "bald", cloth: "#c4925a", trim: "#f0d8b0", weapon: "shield", bulk: 1.18 },
  tess: { skin: "#f6d6c0", hair: "#fff1c8", hairStyle: "bun", cloth: "#fff6dc", trim: "#f0d48a", weapon: "staff", bulk: 0.84 },
  rathe: { skin: "#d2b09a", hair: "#2a1830", hairStyle: "wild", cloth: "#3a2048", trim: "#c090e0", weapon: "claws", tail: true, bulk: 0.96 },
  hobb: { skin: "#e4b898", hair: "#8a3018", hairStyle: "short", cloth: "#a84828", trim: "#ffb070", weapon: "hammer", bulk: 1.22 },
  sallow: { skin: "#e8c8a8", hair: "#6a8a48", hairStyle: "long", cloth: "#5a7a40", trim: "#d8e8a0", weapon: "spear", bulk: 0.9 },
  quinn: { skin: "#e6c4a4", hair: "#3a5a30", hairStyle: "bun", cloth: "#6a8a48", trim: "#e4f0b0", weapon: "staff", robe: true, bulk: 0.92 },
  lir: { skin: "#e0c0b0", hair: "#3a2858", hairStyle: "hood", cloth: "#4a3870", trim: "#d0c0f0", weapon: "lantern", cape: true, bulk: 0.9 },
};

export function lookIds() {
  return Object.keys(LOOKS);
}

export function lookSignature(id) {
  const look = LOOKS[id];
  if (!look) return "";
  return [id, look.hairStyle, look.weapon, look.cloth, look.trim, look.bulk, look.cape ? "cape" : "", look.robe ? "robe" : "", look.horns ? "horns" : "", look.halo ? "halo" : "", look.tail ? "tail" : ""].join("|");
}

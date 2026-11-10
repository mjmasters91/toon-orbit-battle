/** Original Stellarbound elements. Flame, Gale, and Tide form a cycle. Radiant and Umbral oppose each other. */

export const ELEMENT_INFO = {
  flame: { name: "Flame", hex: "#ff6a2c", value: 0xff6a2c },
  tide: { name: "Tide", hex: "#3ec6c6", value: 0x3ec6c6 },
  gale: { name: "Gale", hex: "#a6d86a", value: 0xa6d86a },
  radiant: { name: "Radiant", hex: "#ffd56a", value: 0xffd56a },
  umbral: { name: "Umbral", hex: "#b79cff", value: 0xb79cff },
};

const BEATS = { flame: "gale", gale: "tide", tide: "flame" };

export function elementRelation(attacker, defender) {
  if (!attacker || !defender || attacker === defender) return "neutral";
  if (
    (attacker === "radiant" && defender === "umbral") ||
    (attacker === "umbral" && defender === "radiant")
  ) {
    return "advantage";
  }
  if (BEATS[attacker] === defender) return "advantage";
  if (BEATS[defender] === attacker) return "disadvantage";
  return "neutral";
}

export function elementMultiplier(relation) {
  if (relation === "advantage") return 1.3;
  if (relation === "disadvantage") return 0.75;
  return 1;
}

export function relationCopy(attacker, defender) {
  const a = ELEMENT_INFO[attacker]?.name ?? attacker;
  const b = ELEMENT_INFO[defender]?.name ?? defender;
  const relation = elementRelation(attacker, defender);
  if (relation === "advantage") {
    if (attacker === "radiant" || attacker === "umbral") {
      return `${a} and ${b} unmake each other. This blow is favored.`;
    }
    return `${a} into ${b}. This blow is favored.`;
  }
  if (relation === "disadvantage") {
    return `${a} into ${b}. This blow is unfavored and may glance.`;
  }
  if (attacker === defender) return `${a} against ${a}. An even strike.`;
  return `${a} against ${b}. An even strike.`;
}

export const EFFECTS = {
  atk_up: { name: "ATK↑", stat: "atk", mult: 1.4, helpful: true },
  atk_down: { name: "ATK↓", stat: "atk", mult: 0.7, helpful: false },
  def_up: { name: "DEF↑", stat: "def", mult: 1.5, helpful: true },
  def_down: { name: "DEF↓", stat: "def", mult: 0.62, helpful: false },
  spd_up: { name: "SPD↑", stat: "spd", mult: 1.3, helpful: true },
  spd_down: { name: "SPD↓", stat: "spd", mult: 0.7, helpful: false },
  stun: { name: "STUN", stat: null, helpful: false },
};

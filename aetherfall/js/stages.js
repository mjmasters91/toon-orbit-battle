/** Story ladder: maps, unlocks, enemy scaling, and clear rewards. Pure data. */

export const DIFFICULTIES = ["normal", "hard", "nightmare"];
export const STAGES_PER_MAP = 26;
export const BOSS_STAGES = [13, 26];

export const DIFF_MULT = { normal: 1, hard: 2.25, nightmare: 4.5 };

export const MAPS = [
  { id: "meadow", name: "Bramblemead", blurb: "Pollen, briars, and a path the goats gave up on.", element: "earth", family: "sprout" },
  { id: "coast", name: "Saltglass Reach", blurb: "Tide pools bite. The barnacles remember ships.", element: "water", family: "crab" },
  { id: "forest", name: "Hollowroot Wilds", blurb: "A wood that keeps its own night under the leaves.", element: "wind", family: "treant" },
  { id: "cinder", name: "Cinderreach", blurb: "Glass dunes over a fire that never finished leaving.", element: "fire", family: "drake" },
  { id: "spire", name: "Aether Spire", blurb: "The citadel still hangs in the crack in the sky.", element: "light", family: "sentinel" },
];

const BOSS_NAMES = {
  meadow: { 13: "Thorn Tusker", 26: "Briar Colossus" },
  coast: { 13: "Reef Warden", 26: "Tide Leviathan" },
  forest: { 13: "Hollow Stag", 26: "Rootcrown Wraith" },
  cinder: { 13: "Cinder Drake", 26: "Caldera Heart" },
  spire: { 13: "Veil Knight", 26: "Spire Seraph" },
};

export function isBoss(stage) {
  return stage === 13 || stage === 26;
}

export function stageKey(difficulty, mapIndex, stage) {
  return `${difficulty}:${mapIndex}:${stage}`;
}

export function stageLevel(mapIndex, stage) {
  return 2 + mapIndex * 56 + (stage - 1) * 2;
}

export function stageTitle(mapIndex, stage) {
  const map = MAPS[mapIndex];
  if (!map) return `Stage ${stage}`;
  if (isBoss(stage)) return BOSS_NAMES[map.id][stage];
  return `${map.name} ${stage}`;
}

export function waveCount(stage) {
  if (isBoss(stage)) return 1;
  if (stage >= 18) return 3;
  if (stage >= 8) return 2;
  return 1;
}

export function foesInWave(stage, waveIndex) {
  if (isBoss(stage)) return stage === 26 ? 2 : 1;
  return Math.min(5, 1 + Math.floor((stage + waveIndex * 3) / 10));
}

export function enemyStats(difficulty, mapIndex, stage) {
  const level = stageLevel(mapIndex, stage);
  const mult = DIFF_MULT[difficulty];
  const boss = isBoss(stage);
  const hp = Math.round((90 + level * 8) * mult * (boss ? 2.5 : 1));
  const atk = Math.round((5 + level * 0.5) * mult * (boss ? 1.2 : 1));
  const def = Math.round((4 + level * 0.5) * mult * (boss ? 1.15 : 1));
  const spd = Math.round(42 + level * 0.55 + (boss ? 8 : 0));
  const mag = Math.round(atk * 0.8);
  return { level, hp, atk, def, spd, mag, boss };
}

export function recommendedPower(difficulty, mapIndex, stage) {
  const stats = enemyStats(difficulty, mapIndex, stage);
  const count = foesInWave(stage, 0);
  const one = Math.round(stats.hp * 0.15 + stats.atk * 2 + stats.def * 1.4 + stats.spd);
  return one * count;
}

const MIX = {
  meadow: ["earth", "wind", "earth"],
  coast: ["water", "water", "wind"],
  forest: ["wind", "earth", "wind"],
  cinder: ["fire", "earth", "fire"],
  spire: ["light", "dark", "light"],
};

export function enemyElement(mapIndex, stage, slot) {
  const map = MAPS[mapIndex];
  if (isBoss(stage)) return map.element === "light" && stage === 26 ? "dark" : map.element;
  return MIX[map.id][(stage + slot) % 3];
}

export function enemyName(mapIndex, stage, slot, bossSlot) {
  const map = MAPS[mapIndex];
  if (isBoss(stage) && bossSlot) return BOSS_NAMES[map.id][stage];
  const names = {
    sprout: ["Pollen Slime", "Briar Pup", "Petal Boar"],
    crab: ["Tide Slime", "Barnacle Crab", "Salt Gull"],
    treant: ["Sap Slime", "Root Wolf", "Lantern Moth"],
    drake: ["Ash Slime", "Glass Scorpion", "Ember Fox"],
    sentinel: ["Veil Wisp", "Spire Golem", "Halo Moth"],
  }[map.family];
  return names[(stage + slot) % names.length];
}

export function monsterKind(mapIndex, stage, boss) {
  const map = MAPS[mapIndex];
  if (boss) {
    if (stage === 26) return map.family === "sentinel" ? "seraph" : "drake";
    return map.family === "crab" ? "golem" : map.family === "sprout" ? "beast" : "drake";
  }
  const kinds = {
    sprout: ["slime", "beast", "plant"],
    crab: ["slime", "crab", "bird"],
    treant: ["slime", "beast", "moth"],
    drake: ["slime", "scorpion", "beast"],
    sentinel: ["wraith", "golem", "moth"],
  }[map.family];
  return kinds[stage % kinds.length];
}

export function buildEncounter(difficulty, mapIndex, stage) {
  const waves = [];
  const total = waveCount(stage);
  for (let w = 0; w < total; w++) {
    const n = foesInWave(stage, w);
    const foes = [];
    for (let i = 0; i < n; i++) {
      const boss = isBoss(stage) && i === 0;
      const stats = enemyStats(difficulty, mapIndex, stage);
      if (!boss && isBoss(stage)) {
        stats.hp = Math.round(stats.hp * 0.28);
        stats.atk = Math.round(stats.atk * 0.7);
        stats.boss = false;
      }
      foes.push({
        id: `foe-${w}-${i}`,
        name: enemyName(mapIndex, stage, i, boss),
        element: enemyElement(mapIndex, stage, i),
        kind: monsterKind(mapIndex, stage, boss),
        boss,
        difficulty,
        ...stats,
        hpMax: stats.hp,
      });
    }
    waves.push(foes);
  }
  return { waves, difficulty, mapIndex, stage };
}

export function starTurnLimit(stage) {
  return isBoss(stage) ? 18 : 14;
}

export function starsFromResult({ won, deaths, turns, stage }) {
  if (!won) return 0;
  if (deaths > 0) return 1;
  if (turns <= starTurnLimit(stage)) return 3;
  return 2;
}

export function firstClearGems(difficulty, stage) {
  const base = { normal: 50, hard: 100, nightmare: 150 }[difficulty];
  return isBoss(stage) ? base * 2 : base;
}

export function clearGold(difficulty, mapIndex, stage, stars) {
  const mult = { normal: 100, hard: 225, nightmare: 450 }[difficulty];
  const boss = isBoss(stage) ? 160 : 100;
  const star = 100 + (Math.max(1, Math.min(3, stars)) - 1) * 15;
  const base = 80 + mapIndex * 40 + stage * 10;
  return Math.round((base * mult * boss * star) / 1_000_000);
}

export function isStageUnlocked(clears, difficulty, mapIndex, stage) {
  if (!DIFFICULTIES.includes(difficulty)) return false;
  if (mapIndex < 0 || mapIndex >= MAPS.length) return false;
  if (stage < 1 || stage > STAGES_PER_MAP) return false;
  const gate = difficulty === "hard" ? "normal" : difficulty === "nightmare" ? "hard" : null;
  if (gate && !clears[stageKey(gate, mapIndex, STAGES_PER_MAP)]) return false;
  if (stage === 1) return true;
  return Boolean(clears[stageKey(difficulty, mapIndex, stage - 1)]);
}

export function mapStars(clears, difficulty, mapIndex) {
  let stars = 0;
  let cleared = 0;
  for (let stage = 1; stage <= STAGES_PER_MAP; stage++) {
    const row = clears[stageKey(difficulty, mapIndex, stage)];
    if (!row) continue;
    cleared += 1;
    stars += row.stars || 0;
  }
  return { stars, cleared, max: STAGES_PER_MAP * 3 };
}

const PROGRESS_KEY = "aetherfall_progress_v1";

export function emptyProgress() {
  return {};
}

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
    if (!raw || typeof raw !== "object") return {};
    return raw;
  } catch {
    return {};
  }
}

export function saveProgress(clears) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(clears));
}

export function progressFromRows(rows) {
  const clears = {};
  for (const row of rows || []) {
    if (!row) continue;
    clears[stageKey(row.difficulty, Number(row.map), Number(row.stage))] = {
      stars: Number(row.stars) || 0,
      turns: Number(row.turns) || 0,
    };
  }
  return clears;
}

export function recordClear(clears, difficulty, mapIndex, stage, stars, turns) {
  const key = stageKey(difficulty, mapIndex, stage);
  const prev = clears[key];
  const first = !prev;
  const best = Math.max(prev?.stars || 0, stars);
  clears[key] = { stars: best, turns: prev && prev.stars > stars ? prev.turns : turns };
  return { first, stars: best, gems: first ? firstClearGems(difficulty, stage) : 0, gold: clearGold(difficulty, mapIndex, stage, stars) };
}

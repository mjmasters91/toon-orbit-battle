import { SAVE_KEY, START_GEMS, START_GOLD, START_TICKETS } from "./balance.js";
import { BANNERS, STARTER_IDS, unitById } from "./units.js";

function blankRecord() {
  return { owned: true, level: 1, awaken: 0, shards: 0 };
}

export function defaultSave() {
  const units = {};
  for (const id of STARTER_IDS) units[id] = blankRecord();
  return {
    version: 1,
    gems: START_GEMS,
    tickets: START_TICKETS,
    gold: START_GOLD,
    muted: false,
    leader: 0,
    pity: Object.fromEntries(BANNERS.map((banner) => [banner.id, 0])),
    units,
    party: [...STARTER_IDS],
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function normalizeSave(raw) {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") return base;
  const save = {
    version: 1,
    gems: clampInt(raw.gems, 0, 9999999, base.gems),
    tickets: clampInt(raw.tickets, 0, 99, base.tickets),
    gold: clampInt(raw.gold, 0, 9999999, base.gold),
    muted: Boolean(raw.muted),
    leader: clampInt(raw.leader, 0, 3, 0),
    pity: {},
    units: {},
    party: [null, null, null, null],
  };
  for (const banner of BANNERS) {
    save.pity[banner.id] = clampInt(raw.pity?.[banner.id], 0, 79, 0);
  }
  if (raw.units && typeof raw.units === "object") {
    for (const [id, record] of Object.entries(raw.units)) {
      if (!unitById(id) || !record || typeof record !== "object" || !record.owned) continue;
      save.units[id] = {
        owned: true,
        level: clampInt(record.level, 1, 40, 1),
        awaken: clampInt(record.awaken, 0, 5, 0),
        shards: clampInt(record.shards, 0, 9999, 0),
      };
    }
  }
  const seen = new Set();
  const incoming = Array.isArray(raw.party) ? raw.party : [];
  for (let i = 0; i < 4; i++) {
    const id = incoming[i];
    if (typeof id === "string" && save.units[id]?.owned && !seen.has(id)) {
      save.party[i] = id;
      seen.add(id);
    }
  }
  if (!save.party[save.leader]) {
    const fallback = save.party.findIndex(Boolean);
    save.leader = fallback === -1 ? 0 : fallback;
  }
  return save;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return normalizeSave(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function resetSave() {
  const fresh = defaultSave();
  writeSave(fresh);
  return fresh;
}

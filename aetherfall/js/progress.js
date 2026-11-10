import { MAX_LEVEL } from "./balance.js";

const LEADER_BONUS = {
  attacker: { stat: "atk", also: null, pct: 10, label: "Party ATK +10%" },
  tank: { stat: "def", also: null, pct: 10, label: "Party DEF +10%" },
  healer: { stat: "hp", also: null, pct: 10, label: "Party HP +10%" },
  support: { stat: "mag", also: "spd", pct: 8, label: "Party MAG & SPD +8%" },
};

export function leaderBonus(role) {
  return LEADER_BONUS[role] || null;
}

export function levelCost(level) {
  if (!Number.isInteger(level) || level < 1 || level >= MAX_LEVEL) return null;
  return 80 + (level - 1) * 40;
}

export function unitStats(def, record) {
  const level = record?.level ?? 1;
  const awaken = record?.awaken ?? 0;
  const growth = 1 + (level - 1) * 0.045 + awaken * 0.08;
  const spdGrowth = 1 + (level - 1) * 0.012 + awaken * 0.03;
  return {
    hp: Math.round(def.hp * growth),
    atk: Math.round(def.atk * growth),
    def: Math.round(def.def * growth),
    spd: Math.round(def.spd * spdGrowth),
    mag: Math.round(def.mag * growth),
  };
}

export function unitPower(stats) {
  return Math.round(stats.hp * 0.18 + stats.atk * 2.1 + stats.def * 1.7 + stats.spd * 1.25 + stats.mag * 1.9);
}

export function tryLevelUp(record, gold) {
  if (!record?.owned) return { ok: false, reason: "unowned" };
  const cost = levelCost(record.level);
  if (cost == null) return { ok: false, reason: "max" };
  if (gold < cost) return { ok: false, reason: "gold", cost };
  return {
    ok: true,
    cost,
    gold: gold - cost,
    record: { ...record, level: record.level + 1 },
  };
}

function boosted(stats, bonus) {
  if (!bonus) return stats;
  const mul = 1 + bonus.pct / 100;
  const next = { ...stats, [bonus.stat]: Math.round(stats[bonus.stat] * mul) };
  if (bonus.also) next[bonus.also] = Math.round(stats[bonus.also] * mul);
  return next;
}

export function partyPower(members, leaderIndex) {
  const leader = members[leaderIndex] || null;
  const bonus = leader ? leaderBonus(leader.def.role) : null;
  let power = 0;
  members.forEach((member) => {
    if (!member) return;
    const stats = unitStats(member.def, member.record);
    power += unitPower(boosted(stats, bonus));
  });
  return { power, bonus };
}

export function sortRoster(list, sort) {
  const rows = [...list];
  rows.sort((a, b) => {
    if (sort === "name") return a.def.name.localeCompare(b.def.name);
    if (sort === "level") {
      return (b.record?.level || 0) - (a.record?.level || 0) || b.def.rarity - a.def.rarity || a.def.name.localeCompare(b.def.name);
    }
    if (sort === "element") {
      return a.def.element.localeCompare(b.def.element) || b.def.rarity - a.def.rarity || a.def.name.localeCompare(b.def.name);
    }
    if (sort === "role") {
      return a.def.role.localeCompare(b.def.role) || b.def.rarity - a.def.rarity || a.def.name.localeCompare(b.def.name);
    }
    if (sort === "power") return (b.power || 0) - (a.power || 0) || a.def.name.localeCompare(b.def.name);
    return b.def.rarity - a.def.rarity || a.def.name.localeCompare(b.def.name);
  });
  return rows;
}

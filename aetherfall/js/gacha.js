import { AWAKEN_COST, COST_1, COST_10, MAX_AWAKEN, PITY_AT, RATES, SHARDS } from "./balance.js";

export function rarityFromRoll(roll, pityBefore) {
  if (!(roll >= 0 && roll < 1)) throw new Error("roll must be in [0, 1)");
  if (!Number.isInteger(pityBefore) || pityBefore < 0) throw new Error("pity must be a non-negative integer");
  const pulls = pityBefore + 1;
  if (pulls >= PITY_AT) {
    return { rarity: 5, pityAfter: 0, pityTriggered: true };
  }
  let rarity = 3;
  if (roll < RATES[5]) rarity = 5;
  else if (roll < RATES[5] + RATES[4]) rarity = 4;
  return {
    rarity,
    pityAfter: rarity === 5 ? 0 : pulls,
    pityTriggered: false,
  };
}

export function pickUnit(rarity, roll, banner, catalog) {
  if (!(roll >= 0 && roll < 1)) throw new Error("roll must be in [0, 1)");
  const pool = catalog.filter((unit) => unit.rarity === rarity);
  if (pool.length === 0) throw new Error(`empty ${rarity}★ pool`);
  const featId = banner.featured?.[rarity] ?? null;
  const rateUp = featId ? banner.rateUp || 0 : 0;
  const featured = rateUp > 0 ? pool.find((unit) => unit.id === featId) : null;
  if (featured && roll < rateUp) return featured.id;
  const source = featured ? pool.filter((unit) => unit.id !== featured.id) : pool;
  const usable = source.length ? source : pool;
  const t = featured ? (roll - rateUp) / (1 - rateUp) : roll;
  const index = Math.min(usable.length - 1, Math.floor(t * usable.length));
  return usable[index].id;
}

/**
 * Roll `count` copies. A 10-pull with no 4★ or 5★ promotes the last copy to 4★.
 * Pity still treats that promoted copy as a non-5★.
 */
export function pull({ count, pity, rng, banner, catalog }) {
  if (count !== 1 && count !== 10) throw new Error("count must be 1 or 10");
  const results = [];
  let pityCursor = pity;
  for (let i = 0; i < count; i++) {
    const rarityRoll = rng();
    const unitRoll = rng();
    const step = rarityFromRoll(rarityRoll, pityCursor);
    const unitId = pickUnit(step.rarity, unitRoll, banner, catalog);
    results.push({
      rarity: step.rarity,
      pityAfter: step.pityAfter,
      pityTriggered: step.pityTriggered,
      unitId,
      unitRoll,
      guaranteed: false,
    });
    pityCursor = step.pityAfter;
  }
  if (count === 10 && results.every((row) => row.rarity < 4)) {
    const last = results[9];
    last.rarity = 4;
    last.guaranteed = true;
    last.unitId = pickUnit(4, last.unitRoll, banner, catalog);
  }
  return { results, pityAfter: pityCursor };
}

export function applyCopy(record, rarity) {
  const shards = SHARDS[rarity];
  if (!shards) throw new Error(`bad rarity ${rarity}`);
  if (!record || !record.owned) {
    return {
      record: { owned: true, level: 1, awaken: 0, shards: 0 },
      isNew: true,
      shardsAdded: 0,
      awakensGained: 0,
    };
  }
  const next = {
    owned: true,
    level: record.level,
    awaken: record.awaken,
    shards: record.shards + shards,
  };
  let awakensGained = 0;
  while (next.awaken < MAX_AWAKEN && next.shards >= AWAKEN_COST[next.awaken]) {
    next.shards -= AWAKEN_COST[next.awaken];
    next.awaken += 1;
    awakensGained += 1;
  }
  return { record: next, isNew: false, shardsAdded: shards, awakensGained };
}

export function resolvePull(owned, results, catalog) {
  const nextOwned = {};
  for (const [id, record] of Object.entries(owned)) nextOwned[id] = { ...record };
  const presentation = results.map((result) => {
    const unit = catalog.find((row) => row.id === result.unitId);
    if (!unit) throw new Error(`unknown unit ${result.unitId}`);
    if (unit.rarity !== result.rarity) {
      throw new Error(`rarity mismatch for ${unit.id}`);
    }
    const applied = applyCopy(nextOwned[unit.id], unit.rarity);
    nextOwned[unit.id] = applied.record;
    return { ...result, ...applied, name: unit.name };
  });
  return { owned: nextOwned, presentation };
}

export function againOffer(count, wallet) {
  const payment = payForPull(wallet, count);
  const label = count === 10 ? "Summon again ×10" : "Summon again ×1";
  if (!payment.ok) return { ok: false, label, detail: "Not enough gems" };
  const shown = payment.method === "ticket" ? "1 Tenfold Ticket" : `${Number(payment.cost).toLocaleString("en-US")} gems`;
  return { ok: true, label, detail: shown, method: payment.method };
}

export function payForPull(wallet, count) {
  if (count !== 1 && count !== 10) return { ok: false, reason: "bad count" };
  if (count === 10 && wallet.tickets > 0) {
    return { ok: true, method: "ticket", cost: 0, gems: wallet.gems, tickets: wallet.tickets - 1 };
  }
  const cost = count === 10 ? COST_10 : COST_1;
  if (wallet.gems < cost) {
    return { ok: false, reason: "gems", cost, gems: wallet.gems, tickets: wallet.tickets };
  }
  return { ok: true, method: "gems", cost, gems: wallet.gems - cost, tickets: wallet.tickets };
}

export function rateTable(banner) {
  const rows = [5, 4, 3].map((rarity) => ({
    rarity,
    chance: RATES[rarity],
  }));
  const featured = [];
  const rateUp = banner.rateUp || 0;
  if (banner.featured && rateUp > 0) {
    for (const rarity of [5, 4]) {
      const id = banner.featured[rarity];
      if (!id) continue;
      featured.push({ id, rarity, chance: RATES[rarity] * rateUp });
    }
  }
  const sum = rows.reduce((total, row) => total + row.chance, 0);
  return { rows, featured, pity: PITY_AT, multiFloor: 4, sum };
}

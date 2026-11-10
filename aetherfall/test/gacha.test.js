import assert from "node:assert/strict";
import test from "node:test";
import { AWAKEN_COST, COST_1, COST_10, MAX_AWAKEN, PITY_AT, RATES, SHARDS, START_GEMS, START_GOLD, START_TICKETS } from "../js/balance.js";
import { againOffer, applyCopy, payForPull, pickUnit, pull, rarityFromRoll, rateTable, resolvePull } from "../js/gacha.js";
import { levelCost, partyPower, tryLevelUp, unitPower, unitStats } from "../js/progress.js";
import { defaultSave, normalizeSave } from "../js/save.js";
import { BANNERS, STARTER_IDS, UNITS, unitById } from "../js/units.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scripted(values) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("rng exhausted");
    return values[i++];
  };
}

const standard = BANNERS.find((banner) => banner.id === "wanderer");
const featured = BANNERS.find((banner) => banner.id === "cinders");

test("published rates sum to 1", () => {
  assert.ok(Math.abs(RATES[3] + RATES[4] + RATES[5] - 1) < 1e-9);
  const table = rateTable(standard);
  assert.ok(Math.abs(table.sum - 1) < 1e-9);
  assert.equal(table.pity, PITY_AT);
  assert.equal(table.multiFloor, 4);
});

test("rarity thresholds follow the posted rates", () => {
  assert.equal(rarityFromRoll(0, 0).rarity, 5);
  assert.equal(rarityFromRoll(RATES[5] - 1e-6, 0).rarity, 5);
  assert.equal(rarityFromRoll(RATES[5], 0).rarity, 4);
  assert.equal(rarityFromRoll(RATES[5] + RATES[4] - 1e-4, 0).rarity, 4);
  assert.equal(rarityFromRoll(RATES[5] + RATES[4], 0).rarity, 3);
  assert.equal(rarityFromRoll(0.99, 0).rarity, 3);
});

test("a natural 5★ resets pity before the cap", () => {
  const rolled = rarityFromRoll(0, 40);
  assert.equal(rolled.rarity, 5);
  assert.equal(rolled.pityAfter, 0);
  assert.equal(rolled.pityTriggered, false);
});

test("pity forces a 5★ on the 80th pull and then resets", () => {
  let pity = 0;
  for (let i = 0; i < PITY_AT - 1; i++) {
    const rolled = rarityFromRoll(0.99, pity);
    assert.equal(rolled.rarity, 3);
    assert.equal(rolled.pityTriggered, false);
    pity = rolled.pityAfter;
  }
  assert.equal(pity, PITY_AT - 1);
  const forced = rarityFromRoll(0.99, pity);
  assert.equal(forced.rarity, 5);
  assert.equal(forced.pityAfter, 0);
  assert.equal(forced.pityTriggered, true);
});

test("simulated singles stay near the posted rates when pity is ignored", () => {
  const rng = mulberry32(7);
  const counts = { 3: 0, 4: 0, 5: 0 };
  const n = 20000;
  for (let i = 0; i < n; i++) counts[rarityFromRoll(rng(), 0).rarity] += 1;
  assert.ok(counts[5] / n > 0.024 && counts[5] / n < 0.037, `5★ rate ${counts[5] / n}`);
  assert.ok(counts[4] / n > 0.165 && counts[4] / n < 0.195, `4★ rate ${counts[4] / n}`);
  assert.ok(counts[3] / n > 0.77 && counts[3] / n < 0.81, `3★ rate ${counts[3] / n}`);
});

test("pity never lets 80 pulls pass without a 5★", () => {
  const rng = mulberry32(3);
  let pity = 0;
  let misses = 0;
  let maxMisses = 0;
  let fives = 0;
  for (let i = 0; i < 5000; i++) {
    const rolled = rarityFromRoll(rng(), pity);
    if (rolled.rarity === 5) {
      maxMisses = Math.max(maxMisses, misses);
      misses = 0;
      fives += 1;
    } else misses += 1;
    pity = rolled.pityAfter;
  }
  assert.ok(maxMisses < PITY_AT);
  assert.ok(fives / 5000 > RATES[5]);
});

test("featured banner puts half of each boosted rarity on the rate-up unit", () => {
  assert.equal(pickUnit(5, 0, featured, UNITS), "veyra");
  assert.equal(pickUnit(5, 0.49, featured, UNITS), "veyra");
  assert.notEqual(pickUnit(5, 0.5, featured, UNITS), "veyra");
  assert.equal(pickUnit(4, 0.1, featured, UNITS), "rin");
  assert.notEqual(pickUnit(4, 0.9, featured, UNITS), "rin");
  const table = rateTable(featured);
  const veyra = table.featured.find((row) => row.id === "veyra");
  const rin = table.featured.find((row) => row.id === "rin");
  assert.ok(Math.abs(veyra.chance - 0.015) < 1e-9);
  assert.ok(Math.abs(rin.chance - 0.09) < 1e-9);
});

test("standard banner walks the rarity pool", () => {
  const fives = UNITS.filter((unit) => unit.rarity === 5).map((unit) => unit.id);
  assert.equal(pickUnit(5, 0, standard, UNITS), fives[0]);
  assert.equal(pickUnit(5, 0.999, standard, UNITS), fives[fives.length - 1]);
});

test("a dry 10-pull promotes the last copy to 4★+", () => {
  const values = [];
  for (let i = 0; i < 10; i++) values.push(0.99, 0.2);
  const rolled = pull({ count: 10, pity: 0, rng: scripted(values), banner: standard, catalog: UNITS });
  assert.equal(rolled.results.filter((row) => row.rarity >= 4).length, 1);
  assert.equal(rolled.results[9].rarity, 4);
  assert.equal(rolled.results[9].guaranteed, true);
  assert.equal(unitById(rolled.results[9].unitId).rarity, 4);
  assert.equal(rolled.pityAfter, 10);
});

test("a 10-pull that already has a 4★ is not rewritten", () => {
  const values = [];
  for (let i = 0; i < 10; i++) values.push(i === 3 ? 0.05 : 0.99, 0.1);
  const rolled = pull({ count: 10, pity: 0, rng: scripted(values), banner: standard, catalog: UNITS });
  assert.equal(rolled.results[3].rarity, 4);
  assert.equal(rolled.results[3].guaranteed, false);
  assert.ok(rolled.results.every((row) => !row.guaranteed));
});

test("pity can fire inside a 10-pull without downgrading that 5★", () => {
  const values = [];
  for (let i = 0; i < 10; i++) values.push(0.99, 0.4);
  const rolled = pull({ count: 10, pity: 75, rng: scripted(values), banner: standard, catalog: UNITS });
  assert.equal(rolled.results[4].rarity, 5);
  assert.equal(rolled.results[4].pityTriggered, true);
  assert.equal(rolled.results[4].guaranteed, false);
  assert.equal(rolled.pityAfter, 5);
  const resolved = resolvePull({}, rolled.results, UNITS);
  assert.equal(resolved.presentation.length, 10);
});

test("duplicates become shards and spend themselves on awaken", () => {
  const first = applyCopy(null, 5);
  assert.equal(first.isNew, true);
  assert.equal(first.record.awaken, 0);
  assert.equal(first.shardsAdded, 0);
  const dupe = applyCopy(first.record, 5);
  assert.equal(dupe.isNew, false);
  assert.equal(dupe.shardsAdded, SHARDS[5]);
  assert.equal(dupe.awakensGained, 1);
  assert.equal(dupe.record.awaken, 1);
  assert.equal(dupe.record.shards, 0);
  assert.equal(first.record.shards, 0);
});

test("3★ duplicates need four copies to awaken once", () => {
  let record = applyCopy(null, 3).record;
  let gained = 0;
  for (let i = 0; i < 3; i++) {
    const step = applyCopy(record, 3);
    record = step.record;
    gained += step.awakensGained;
    assert.equal(step.shardsAdded, SHARDS[3]);
  }
  assert.equal(gained, 0);
  assert.equal(record.shards, 30);
  const fourth = applyCopy(record, 3);
  assert.equal(fourth.awakensGained, 1);
  assert.equal(fourth.record.awaken, 1);
  assert.equal(fourth.record.shards, 0);
  assert.equal(AWAKEN_COST[0], 40);
});

test("awaken stops at the cap and keeps leftover shards", () => {
  const capped = applyCopy({ owned: true, level: 4, awaken: MAX_AWAKEN, shards: 5 }, 5);
  assert.equal(capped.awakensGained, 0);
  assert.equal(capped.record.awaken, MAX_AWAKEN);
  assert.equal(capped.record.shards, 5 + SHARDS[5]);
  assert.equal(capped.record.level, 4);
});

test("two copies of a new unit in one pull unlock then convert", () => {
  const results = [
    { rarity: 3, unitId: "tess", pityAfter: 1, pityTriggered: false, unitRoll: 0, guaranteed: false },
    { rarity: 3, unitId: "tess", pityAfter: 2, pityTriggered: false, unitRoll: 0, guaranteed: false },
  ];
  const resolved = resolvePull({}, results, UNITS);
  assert.equal(resolved.presentation[0].isNew, true);
  assert.equal(resolved.presentation[1].isNew, false);
  assert.equal(resolved.presentation[1].shardsAdded, SHARDS[3]);
  assert.equal(resolved.owned.tess.owned, true);
});

test("summon again offers the ticket or the gem price", () => {
  const withTicket = againOffer(10, { gems: 0, tickets: 1 });
  assert.equal(withTicket.ok, true);
  assert.equal(withTicket.label, "Summon again ×10");
  assert.equal(withTicket.detail, "1 Tenfold Ticket");
  const withGems = againOffer(10, { gems: 4500, tickets: 0 });
  assert.equal(withGems.ok, true);
  assert.equal(withGems.detail, "3,000 gems");
  const broke = againOffer(10, { gems: 2999, tickets: 0 });
  assert.equal(broke.ok, false);
  assert.equal(broke.detail, "Not enough gems");
  const single = againOffer(1, { gems: 300, tickets: 5 });
  assert.equal(single.ok, true);
  assert.equal(single.label, "Summon again ×1");
  assert.equal(single.detail, "300 gems");
});

test("tickets pay for a 10-pull and singles always cost gems", () => {
  const withTicket = payForPull({ gems: 100, tickets: 1 }, 10);
  assert.equal(withTicket.ok, true);
  assert.equal(withTicket.method, "ticket");
  assert.equal(withTicket.tickets, 0);
  assert.equal(withTicket.gems, 100);
  const single = payForPull({ gems: START_GEMS, tickets: 1 }, 1);
  assert.equal(single.method, "gems");
  assert.equal(single.cost, COST_1);
  assert.equal(single.tickets, 1);
  const poor = payForPull({ gems: COST_10 - 1, tickets: 0 }, 10);
  assert.equal(poor.ok, false);
  const rich = payForPull({ gems: COST_10, tickets: 0 }, 10);
  assert.equal(rich.ok, true);
  assert.equal(rich.gems, 0);
});

test("level-up spends gold and raises stats", () => {
  assert.equal(levelCost(1), 80);
  assert.equal(levelCost(40), null);
  const start = { owned: true, level: 1, awaken: 0, shards: 0 };
  const poor = tryLevelUp(start, 79);
  assert.equal(poor.ok, false);
  const paid = tryLevelUp(start, 80);
  assert.equal(paid.ok, true);
  assert.equal(paid.gold, 0);
  assert.equal(paid.record.level, 2);
  const def = unitById("pip");
  assert.ok(unitPower(unitStats(def, paid.record)) > unitPower(unitStats(def, start)));
});

test("leader bonus raises party power", () => {
  const def = unitById("pip");
  const record = { owned: true, level: 1, awaken: 0, shards: 0 };
  const member = { def, record };
  const plain = partyPower([member, null, null, null], 1);
  const lead = partyPower([member, null, null, null], 0);
  assert.equal(plain.bonus, null);
  assert.ok(lead.power > plain.power);
  assert.match(lead.bonus.label, /ATK/);
  assert.equal(partyPower([null, null, null, null], 0).power, 0);
});

test("roster, starters, and banners are a complete original set", () => {
  assert.equal(UNITS.length, 24);
  assert.equal(new Set(UNITS.map((unit) => unit.id)).size, 24);
  assert.equal(UNITS.filter((unit) => unit.rarity === 5).length, 6);
  assert.equal(UNITS.filter((unit) => unit.rarity === 4).length, 8);
  assert.equal(UNITS.filter((unit) => unit.rarity === 3).length, 10);
  for (const element of ["fire", "water", "wind", "earth", "light", "dark"]) {
    assert.ok(UNITS.some((unit) => unit.element === element));
  }
  for (const role of ["attacker", "tank", "healer", "support"]) {
    assert.ok(UNITS.some((unit) => unit.role === role));
  }
  for (const unit of UNITS) {
    assert.ok(unit.skills.length >= 1 && unit.skills.length <= 2);
    assert.ok(unit.flavor.length > 8);
    for (const stat of ["hp", "atk", "def", "spd", "mag"]) assert.ok(unit[stat] > 0);
  }
  for (const id of STARTER_IDS) assert.ok(unitById(id));
  assert.equal(unitById(featured.featured[5]).rarity, 5);
  assert.equal(unitById(featured.featured[4]).rarity, 4);
});

test("a fresh save can summon immediately and ignores junk", () => {
  const save = defaultSave();
  assert.equal(save.gems, START_GEMS);
  assert.equal(save.tickets, START_TICKETS);
  assert.equal(save.gold, START_GOLD);
  assert.deepEqual(save.party, STARTER_IDS);
  assert.equal(payForPull(save, 10).method, "ticket");
  const messy = normalizeSave({
    gems: -20,
    tickets: 4,
    gold: 50.2,
    pity: { wanderer: 200, cinders: -3 },
    units: {
      nope: { owned: true },
      pip: { owned: true, level: 99, awaken: 9, shards: -4 },
      nia: { owned: true, level: 2, awaken: 0, shards: 3 },
    },
    party: ["pip", "pip", "ghost", "nia"],
    leader: 3,
  });
  assert.equal(messy.gems, 0);
  assert.equal(messy.gold, 50);
  assert.equal(messy.pity.wanderer, 79);
  assert.equal(messy.pity.cinders, 0);
  assert.equal(messy.units.nope, undefined);
  assert.equal(messy.units.pip.level, 40);
  assert.equal(messy.units.pip.awaken, 5);
  assert.equal(messy.units.pip.shards, 0);
  assert.deepEqual(messy.party, ["pip", null, null, "nia"]);
});

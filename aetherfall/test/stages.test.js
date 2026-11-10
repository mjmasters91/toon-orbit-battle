import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { autoChoice, elementMod, endRound, enemyTurn, openBattle, performAction, strikeDamage } from "../js/battle.js";
import { renderMonster } from "../js/monsters.js";
import { leaderBonus, unitStats } from "../js/progress.js";
import {
  DIFFICULTIES,
  MAPS,
  STAGES_PER_MAP,
  buildEncounter,
  clearGold,
  enemyStats,
  firstClearGems,
  isBoss,
  isStageUnlocked,
  recordClear,
  stageLevel,
} from "../js/stages.js";
import { unitById } from "../js/units.js";

function ally(id, record, bonus) {
  const def = unitById(id);
  const stats = unitStats(def, record);
  if (bonus) {
    const mul = 1 + bonus.pct / 100;
    stats[bonus.stat] = Math.round(stats[bonus.stat] * mul);
    if (bonus.also) stats[bonus.also] = Math.round(stats[bonus.also] * mul);
  }
  return { id, name: def.name, element: def.element, role: def.role, ...stats };
}

function fight(allies, encounter, cap = 48) {
  const battle = openBattle(allies, encounter);
  let guard = 0;
  while (!battle.over && guard < cap) {
    for (const actor of battle.allies) {
      if (actor.hp <= 0 || battle.over) continue;
      const choice = autoChoice(battle, actor);
      performAction(battle, actor, choice.action, choice.target);
    }
    if (!battle.over) {
      enemyTurn(battle, () => 0.1);
      endRound(battle);
    }
    guard += 1;
  }
  return battle;
}

test("story ladder is 3 difficulties, 5 maps, 26 stages", () => {
  assert.equal(DIFFICULTIES.length, 3);
  assert.equal(MAPS.length, 5);
  assert.equal(STAGES_PER_MAP, 26);
  assert.equal(DIFFICULTIES.length * MAPS.length * STAGES_PER_MAP, 390);
});

test("stage level and non-boss stats strictly increase, and bosses outscale their neighbors", () => {
  for (const difficulty of DIFFICULTIES) {
    for (let map = 0; map < MAPS.length; map++) {
      let prevLevel = 0;
      let prevHp = 0;
      let prevAtk = 0;
      let prevDef = 0;
      for (let stage = 1; stage <= STAGES_PER_MAP; stage++) {
        const level = stageLevel(map, stage);
        const stats = enemyStats(difficulty, map, stage);
        assert.ok(level > prevLevel, `${difficulty} ${map} ${stage} level`);
        prevLevel = level;
        if (!isBoss(stage)) {
          assert.ok(stats.hp > prevHp, `${difficulty} ${map} ${stage} hp`);
          assert.ok(stats.atk > prevAtk, `${difficulty} ${map} ${stage} atk`);
          assert.ok(stats.def > prevDef, `${difficulty} ${map} ${stage} def`);
          prevHp = stats.hp;
          prevAtk = stats.atk;
          prevDef = stats.def;
        }
        if (isBoss(stage)) {
          const before = enemyStats(difficulty, map, stage - 1);
          assert.ok(stats.hp > before.hp);
          assert.ok(stats.atk > before.atk);
          if (stage < STAGES_PER_MAP) {
            const after = enemyStats(difficulty, map, stage + 1);
            assert.ok(stats.hp > after.hp);
            assert.ok(stats.atk > after.atk);
          }
        }
      }
      if (map < MAPS.length - 1) {
        assert.ok(stageLevel(map + 1, 1) >= stageLevel(map, STAGES_PER_MAP));
        const next = enemyStats(difficulty, map + 1, 1);
        const tail = enemyStats(difficulty, map, 25);
        assert.ok(next.hp >= tail.hp);
        assert.ok(next.atk >= tail.atk);
      }
    }
  }
});

test("hard is about 2.25x normal and nightmare is about 2x hard", () => {
  for (let map = 0; map < MAPS.length; map++) {
    for (const stage of [1, 7, 13, 20, 26]) {
      const normal = enemyStats("normal", map, stage);
      const hard = enemyStats("hard", map, stage);
      const nightmare = enemyStats("nightmare", map, stage);
      assert.ok(hard.hp >= normal.hp * 2 && hard.hp <= normal.hp * 2.5 + 2);
      assert.ok(hard.atk >= normal.atk * 2 && hard.atk <= normal.atk * 2.5 + 2);
      assert.ok(nightmare.hp >= hard.hp * 1.9 && nightmare.hp <= hard.hp * 2.15);
      assert.ok(nightmare.atk >= hard.atk * 1.9 && nightmare.atk <= hard.atk * 2.15);
    }
  }
});

test("unlocks walk one stage at a time and difficulties gate on a cleared map", () => {
  const clears = {};
  assert.equal(isStageUnlocked(clears, "normal", 0, 1), true);
  assert.equal(isStageUnlocked(clears, "normal", 0, 2), false);
  assert.equal(isStageUnlocked(clears, "hard", 0, 1), false);
  recordClear(clears, "normal", 0, 1, 3, 2);
  assert.equal(isStageUnlocked(clears, "normal", 0, 2), true);
  for (let stage = 1; stage <= 26; stage++) recordClear(clears, "normal", 0, stage, 1, 4);
  assert.equal(isStageUnlocked(clears, "hard", 0, 1), true);
  assert.equal(isStageUnlocked(clears, "hard", 1, 1), false);
  assert.equal(isStageUnlocked(clears, "nightmare", 0, 1), false);
  for (let stage = 1; stage <= 26; stage++) recordClear(clears, "hard", 0, stage, 2, 6);
  assert.equal(isStageUnlocked(clears, "nightmare", 0, 1), true);
});

test("first clear pays gems once, gold stays capped, stars do not fall", () => {
  const clears = {};
  const first = recordClear(clears, "normal", 0, 1, 2, 5);
  assert.equal(first.gems, 50);
  assert.equal(first.gold, clearGold("normal", 0, 1, 2));
  const again = recordClear(clears, "normal", 0, 1, 1, 9);
  assert.equal(again.gems, 0);
  assert.equal(again.gold, clearGold("normal", 0, 1, 1));
  assert.equal(clears["normal:0:1"].stars, 2);
  assert.equal(firstClearGems("hard", 13), 200);
  assert.equal(firstClearGems("nightmare", 26), 300);
  assert.ok(clearGold("nightmare", 4, 26, 3) > clearGold("hard", 4, 26, 3));
  assert.ok(clearGold("hard", 4, 26, 3) > clearGold("normal", 4, 26, 3));
  assert.ok(clearGold("normal", 4, 26, 3) < 100000);
});

test("element wheel and a scripted heal, burn, and arts hit", () => {
  assert.equal(elementMod("fire", "wind"), 1.3);
  assert.equal(elementMod("wind", "earth"), 1.3);
  assert.equal(elementMod("earth", "water"), 1.3);
  assert.equal(elementMod("water", "fire"), 1.3);
  assert.equal(elementMod("fire", "water"), 0.75);
  assert.equal(elementMod("light", "dark"), 1.3);
  assert.equal(elementMod("dark", "light"), 1.3);
  const battle = openBattle(
    [ally("tam", { level: 1, awaken: 0 }), ally("pip", { level: 1, awaken: 0 })],
    buildEncounter("normal", 0, 1),
  );
  const hurt = battle.allies[1];
  hurt.hp = 20;
  const healed = performAction(battle, battle.allies[0], "skill", 1);
  assert.ok(healed.some((row) => row.type === "heal" && row.amount > 0));
  assert.ok(battle.allies[1].hp > 20);
  battle.allies[1].gauge = 100;
  const before = battle.enemies[0].hp;
  const arts = performAction(battle, battle.allies[1], "arts", 0);
  assert.ok(arts.some((row) => row.type === "damage"));
  assert.ok(battle.enemies[0].hp < before);
  assert.ok(battle.enemies[0].status.burn > 0);
  assert.equal(battle.allies[1].gauge, 0);
  assert.ok(strikeDamage(battle.allies[1], battle.enemies[0], 1) >= 1);
});

test("starter party clears the first meadow and a built team clears the last nightmare", () => {
  const starters = ["pip", "nia", "tam", "puck"].map((id) => ally(id, { level: 1, awaken: 0 }, leaderBonus("attacker")));
  const opening = fight(starters, buildEncounter("normal", 0, 1));
  assert.equal(opening.over, "win");
  assert.equal(opening.deaths, 0);
  const built = ["veyra", "morr", "thistle", "calder"].map((id) => ally(id, { level: 40, awaken: 5 }, leaderBonus("attacker")));
  const finale = fight(built, buildEncounter("nightmare", 4, 26), 40);
  assert.equal(finale.over, "win");
});

test("battle migration is a reviewable script and not a secret", () => {
  const sql = readFileSync(new URL("../sql/0002_aetherfall_battles.sql", import.meta.url), "utf8");
  assert.match(sql, /af_clear_stage/);
  assert.match(sql, /af_get_progress/);
  assert.match(sql, /af_progress/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /interval '10 seconds'/);
  assert.doesNotMatch(sql, /service_role|sb_secret/i);
  assert.match(sql, /Not applied/);
});

test("monster sprites paint a body", () => {
  for (const kind of ["slime", "beast", "golem", "wraith", "drake", "crab", "seraph"]) {
    const grid = renderMonster(kind, "fire", kind === "drake" || kind === "seraph", 1);
    const filled = grid.flat().filter(Boolean).length;
    assert.ok(filled > 40, kind);
  }
});

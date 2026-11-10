import assert from "node:assert/strict";
import test from "node:test";
import { buildMonster, buildUnit, poseFigure } from "../js/figures.js";
import { lookIds, lookSignature } from "../js/looks.js";
import { UNITS } from "../js/units.js";

test("every veinwalker has a unique original 3D figure", () => {
  assert.deepEqual(lookIds().sort(), UNITS.map((unit) => unit.id).sort());
  const signatures = new Set();
  for (const unit of UNITS) {
    const figure = buildUnit(unit.id);
    assert.equal(signatures.has(figure.userData.signature), false, unit.id);
    signatures.add(figure.userData.signature);
    assert.equal(figure.userData.signature, lookSignature(unit.id));
    let meshes = 0;
    figure.traverse((node) => {
      if (node.isMesh) meshes += 1;
    });
    assert.ok(meshes >= 10, `${unit.id} is too simple (${meshes})`);
    for (const clip of ["idle", "attack", "hit", "skill", "death"]) {
      figure.userData.phase = 0.4;
      poseFigure(figure, clip, 1.2);
    }
  }
});

test("story monsters are original meshes and bosses are larger", () => {
  const kinds = ["slime", "beast", "plant", "crab", "bird", "moth", "golem", "scorpion", "drake", "wraith", "seraph"];
  const signatures = new Set();
  for (const kind of kinds) {
    const figure = buildMonster(kind, "fire", false);
    assert.equal(figure.userData.monster, kind);
    assert.equal(signatures.has(figure.userData.signature), false, kind);
    signatures.add(figure.userData.signature);
    poseFigure(figure, "attack", 0.4);
  }
  const boss = buildMonster("drake", "fire", true);
  const mob = buildMonster("drake", "fire", false);
  assert.ok(boss.scale.x > mob.scale.x);
});

import assert from "node:assert/strict";
import test from "node:test";
import { filledCount, maskOf } from "../js/pixel.js";
import { SPRITE_H, lookIds, renderUnit } from "../js/sprites.js";
import { UNITS } from "../js/units.js";

function bottomRow(grid) {
  for (let y = grid.length - 1; y >= 0; y--) {
    if (grid[y].some(Boolean)) return y;
  }
  return -1;
}

test("every veinwalker has a unique original sprite", () => {
  assert.deepEqual(lookIds().sort(), UNITS.map((unit) => unit.id).sort());
  const masks = new Set();
  const colors = new Set();
  const bottoms = [];
  for (const unit of UNITS) {
    const grid = renderUnit(unit.id, 0);
    assert.equal(grid.length, SPRITE_H);
    assert.ok(filledCount(grid) > 140, unit.id);
    const mask = maskOf(grid);
    const color = grid.flat().filter(Boolean).join(",");
    assert.equal(masks.has(mask), false, `${unit.id} shares a silhouette`);
    assert.equal(colors.has(color), false, `${unit.id} shares a palette`);
    masks.add(mask);
    colors.add(color);
    bottoms.push(bottomRow(grid));
    for (const frame of [1, 2, 3]) renderUnit(unit.id, frame);
  }
  const low = Math.min(...bottoms);
  const high = Math.max(...bottoms);
  assert.ok(high - low <= 2, `feet drifted ${low}..${high}`);
});

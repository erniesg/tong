import test from 'node:test';
import assert from 'node:assert/strict';
import { hillHeight, hillPlace, HILL_START, HILL_END } from '../apps/client/public/cozy/js/cities/seoul-terrain.js';
import { createTraversal, stepTraversal } from '../apps/client/public/cozy/js/traversal.js';

// Pure terrain physics: the same heightAt the runtime dispatches for Seoul
// outside the original core. No colliders, so only the ground shape decides.
const env = { heightAt: (x, z) => hillHeight(x, z), colliders: [], bounds: { minX: -62, maxX: 62, minZ: 60, maxZ: HILL_END } };
function walk(p, to, mode = 'walk', seconds = 30) {
  const state = createTraversal(); state.mode = mode;
  let maxY = p.y;
  for (let i = 0; i < seconds * 120; i++) {
    const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const m = Math.min(1, d * 2);
    stepTraversal(state, p, { x: dx / d * m, z: dz / d * m }, env, 1 / 120);
    maxY = Math.max(maxY, p.y);
  }
  return { p, maxY };
}

test('flat streets are untouched and the hill rises north of the park', () => {
  for (const [x, z] of [[0, 0], [-35, 61], [30, 65], [-44, 68.2]]) assert.equal(hillHeight(x, z), 0);
  assert.ok(hillHeight(0, 85) > 2 && hillHeight(0, 85) < 3.1, 'lower slope');
  assert.ok(hillHeight(0, 105) > 8, 'upper terrace');
  assert.ok(Math.abs(hillPlace.spawn[1] - hillHeight(hillPlace.spawn[0], hillPlace.spawn[2])) < 1e-9, 'lookout spawn on the ground');
  assert.ok(HILL_START > 72);
});

test('walking straight up the slope is stopped by the retaining wall', () => {
  const { p } = walk({ x: 0, y: 0, z: 70 }, { x: 0, z: 108 });
  assert.ok(p.z < 90.6 && p.z > 89, `stopped at the wall, z=${p.z}`);
  assert.ok(Math.abs(p.y - hillHeight(p.x, p.z)) < 0.05 && p.y < 3.2);
});

test('the stair alley climbs to the upper terrace and back down', () => {
  const p = { x: -13, y: 0, z: 74 };
  walk(p, { x: -13, z: 100 });
  assert.ok(Math.abs(p.z - 100) < 0.1 && p.y > 7, `reached terrace ${JSON.stringify(p)}`);
  walk(p, { x: -28, z: 104 });
  assert.ok(Math.abs(p.y - hillHeight(-28, 104)) < 0.05, 'at the lookout');
  walk(p, { x: -13, z: 100 }); walk(p, { x: -13, z: 74 });
  assert.ok(p.z < 74.2 && p.y < 0.05, `back on the street ${JSON.stringify(p)}`);
});

test('the sloped lane works on foot and by bicycle', () => {
  for (const mode of ['walk', 'bicycle']) {
    const p = { x: 24, y: 0, z: 74 };
    const { maxY } = walk(p, { x: 24, z: 103 }, mode);
    assert.ok(Math.abs(p.z - 103) < 0.2 && maxY > 7.5, `${mode} reached the terrace ${JSON.stringify(p)}`);
    walk(p, { x: 24, z: 74 }, mode);
    assert.ok(p.y < 0.05, `${mode} descended`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTraversal, stepTraversal, queueJump, resetTraversal, MODES, overlaps, bodyOverlaps, segmentHitsBox, PLAYER_CLEARANCE } from '../apps/client/public/cozy/js/traversal.js';

const flat = { heightAt: () => 0, colliders: [], bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 } };
const advance = (s, p, input, seconds, env = flat, dt = 1 / 60) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) stepTraversal(s, p, input, env, Math.min(dt, seconds - t));
};
const actor = (mode = 'walk') => { const s = createTraversal(); resetTraversal(s, mode); return [s, { x: 0, y: 0, z: 0 }]; };

test('run travels faster than walking without diagonal speed inflation', () => {
  const [walk, a] = actor(), [run, b] = actor(), [diagonal, c] = actor();
  advance(walk, a, { x: 1, z: 0 }, 1);
  advance(run, b, { x: 1, z: 0, run: true }, 1);
  advance(diagonal, c, { x: 1, z: 1 }, 1);
  assert.ok(a.x > 2.5 && a.x < 3.5);
  assert.ok(b.x > a.x * 1.5);
  assert.ok(Math.abs(Math.hypot(c.x, c.z) - a.x) < 0.02);
});

test('jump has gravity, cannot double jump, and lands on the terrain', () => {
  const [s, p] = actor(); queueJump(s); let peak = 0;
  for (let i = 0; i < 90; i++) {
    stepTraversal(s, p, {}, flat, 1 / 120);
    peak = Math.max(peak, p.y);
    if (i === 20) { queueJump(s); assert.equal(s.jumpQueued, false); }
    assert.ok(Number.isFinite(p.y) && p.y >= 0);
  }
  assert.ok(peak > 0.8 && peak < 1.5, `jump apex ${peak}`);
  assert.equal(s.grounded, true); assert.equal(s.vy, 0); assert.equal(p.y, 0);
});

for (const mode of ['skateboard', 'scooter', 'bicycle']) {
  test(`${mode} accelerates and coasts; braking stops faster than coasting`, () => {
    const [s, p] = actor(mode);
    advance(s, p, { x: 1 }, 0.1);
    assert.ok(s.vx > 0 && s.vx < MODES[mode].speed / 2);
    advance(s, p, { x: 1 }, 2.5);
    const a = { ...s }, b = { ...s }, pa = { ...p }, pb = { ...p };
    advance(a, pa, {}, 0.3); advance(b, pb, { brake: true }, 0.3);
    assert.ok(a.vx > 0, 'releasing input must not instantly stop a ride');
    assert.ok(b.vx < a.vx, 'braking must be stronger than coast drag');
    assert.ok(pb.x - p.x < pa.x - p.x);
  });
  test(`${mode} cannot tunnel through thin walls at a long frame interval`, () => {
    const [s, p] = actor(mode); s.vx = MODES[mode].speed;
    const wall = { minX: 1, maxX: 1.05, minZ: -50, maxZ: 50 };
    advance(s, p, { x: 1 }, 2, { ...flat, colliders: [wall] }, 0.25);
    assert.ok(p.x <= wall.minX - MODES[mode].radius + 1e-7);
    assert.equal(overlaps(p.x, p.z, MODES[mode].radius, wall), false);
    assert.equal(p.y, 0);
  });
}

test('terrain ledges are not elevators, while the continuous Seoul-style ramp is walkable', () => {
  const [s, p] = actor();
  advance(s, p, { x: 1 }, 2, { ...flat, heightAt: (x) => x < 0.5 ? 0 : 2.4 });
  assert.ok(p.x < 0.5); assert.equal(p.y, 0);
  const [r, q] = actor();
  const ramp = { ...flat, heightAt: (x) => Math.max(0, Math.min(2.4, x * 0.6)) };
  advance(r, q, { x: 1 }, 2, ramp);
  assert.ok(q.x > 4); assert.ok(Math.abs(q.y - 2.4) < 1e-7);
});

test('a jump hits a low sloping roof without passing through it, then lands', () => {
  const [s, p] = actor(); p.z = 1.5;
  // Physical tent: eaves 2.3m, ridge 3m, z range -2.2..2.0.
  const roof = (z) => 3 - 0.7 * Math.min(1, Math.abs(z + 0.1) / 2.1);
  const env = { ...flat, ceilingAt: (_x, z) => roof(z) };
  queueJump(s); let peak = 0;
  for (let i = 0; i < 120; i++) {
    stepTraversal(s, p, {}, env, 1 / 120);
    peak = Math.max(peak, p.y);
    assert.ok(p.y + PLAYER_CLEARANCE <= roof(p.z) + 1e-8);
  }
  assert.ok(peak > 0.3 && peak <= roof(p.z) - PLAYER_CLEARANCE + 1e-8);
  assert.equal(p.y, 0); assert.equal(s.grounded, true); assert.equal(s.vy, 0);
});

test('ceiling collisions stay active while horizontal input is frozen', () => {
  const [s, p] = actor(); queueJump(s);
  stepTraversal(s, p, {}, flat, 0.1);
  const x = p.x;
  const env = { ...flat, ceilingAt: () => 2.1 };
  stepTraversal(s, p, { x: 1, frozen: true }, env, 1 / 60);
  assert.ok(p.y + PLAYER_CLEARANCE <= 2.1 + 1e-8);
  advance(s, p, { x: 1, frozen: true }, 1, env);
  assert.equal(p.x, x); assert.equal(p.y, 0); assert.equal(s.grounded, true);
});

test('frozen controls stop horizontal motion without suspending gravity', () => {
  const [s, p] = actor(); advance(s, p, { x: 1 }, 0.4); queueJump(s);
  stepTraversal(s, p, { x: 1 }, flat, 0.1);
  const x = p.x; advance(s, p, { x: 1, frozen: true }, 1);
  assert.equal(p.x, x); assert.equal(s.vx, 0); assert.equal(p.y, 0); assert.equal(s.grounded, true);
});

test('finite-Y walls/staff separate floors, while legacy boxes remain unbounded', () => {
  const upstairs = { minX: 1, maxX: 1.2, minZ: -2, maxZ: 2, minY: 3.4, maxY: 5.3 };
  assert.equal(bodyOverlaps(1.1, 0, 0, 0.3, upstairs), false);
  assert.equal(bodyOverlaps(1.1, 3.4, 0, 0.3, upstairs), true);
  assert.equal(bodyOverlaps(1.1, 5.3, 0, 0.3, upstairs), false);
  assert.equal(bodyOverlaps(1.1, 30, 0, 0.3, { ...upstairs, minY: undefined, maxY: undefined }), true);
  for (const y of [0, 3.4]) {
    const [s, p] = actor(); p.y = y;
    advance(s, p, { x: 1 }, 1, { ...flat, heightAt: () => y, colliders: [upstairs] });
    assert.ok(y === 0 ? p.x > 2 : p.x < 0.71);
  }
});

test('staff sight lines cannot pass through walls, but may pass over a service counter or through a doorway', () => {
  const a = { x: 0, y: 1.1, z: 0 }, b = { x: 2, y: 1.1, z: 0 };
  const wall = { minX: 0.9, maxX: 1.1, minZ: -1, maxZ: 1, minY: 0, maxY: 3 };
  assert.equal(segmentHitsBox(a, b, wall), true);
  assert.equal(segmentHitsBox(a, b, { ...wall, maxY: 0.95 }), false);
  assert.equal(segmentHitsBox(a, b, { ...wall, minZ: 0.5 }), false);
  assert.equal(segmentHitsBox(a, b, { ...wall, minY: 3.4, maxY: 6.8 }), false);
});

test('every slope substep and ceiling query receives updated feet Y', () => {
  const [s, p] = actor(); const seen = [];
  const env = { ...flat,
    heightAt: (x, _z, feetY) => { assert.ok(Number.isFinite(feetY)); seen.push(feetY); return Math.max(0, x * 0.8); },
    ceilingAt: (_x, _z, feetY) => feetY + 3,
  };
  advance(s, p, { x: 1 }, 1, env, 0.25);
  assert.ok(p.x > 2 && p.y > 1.6);
  assert.ok(new Set(seen.map(y => y.toFixed(4))).size > 50);
});

test('a low landing ceiling stops horizontal ascent instead of pushing feet through support', () => {
  const [s, p] = actor();
  advance(s, p, { x: 1 }, 1, { ...flat, heightAt: x => Math.max(0, x * 0.6), ceilingAt: () => 2.4 });
  assert.ok(p.x > 0.5 && p.x < 0.85);
  assert.ok(p.y + PLAYER_CLEARANCE <= 2.4 + 1e-6);
  assert.ok(Math.abs(p.y - p.x * 0.6) < 1e-7);
});

test('explicit building fall edges use gravity, without changing legacy terrace ledge rejection', () => {
  const [s, p] = actor(); p.y = 3.4;
  const env = { ...flat, heightAt: x => x < 0.5 ? 3.4 : 0, allowDrop: () => true };
  advance(s, p, { x: 1 }, 0.3, env);
  assert.ok(p.x > 0.5); assert.ok(p.y > 2.8 && p.y < 3.4); assert.equal(s.grounded, false);
  advance(s, p, {}, 1, env);
  assert.equal(p.y, 0); assert.equal(s.grounded, true);
});

test('city edges account for the ride radius and invalid modes reset safely', () => {
  const [s, p] = actor('bicycle');
  advance(s, p, { x: 1, z: 1 }, 3, { ...flat, bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 } });
  assert.ok(p.x <= 1 - MODES.bicycle.radius + 1e-7 && p.z <= 1 - MODES.bicycle.radius + 1e-7);
  resetTraversal(s, 'unknown'); assert.equal(s.mode, 'walk'); assert.equal(s.vx, 0);
});

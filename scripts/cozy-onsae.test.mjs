// Onsae Entertainment (docs/seoul-first-day.md): the three-floor agency plan
// (level-support.js `layout: 'agency'`, standing on the terrace via `baseY`)
// and the named spots in onsae.js agree with each other and are walkable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApartmentPlan, supportAt, ceilingAt, zoneAt } from '../apps/client/public/cozy/js/level-support.js';
import { createTraversal, stepTraversal, bodyOverlaps } from '../apps/client/public/cozy/js/traversal.js';
import * as O from '../apps/client/public/cozy/js/onsae.js';

const { ONSAE, FLOOR_Y, ROOMS, SPOTS, SPOT_ROOMS, CAST_SPOTS, CORRIDOR_SPOTS, roomAt } = O;
const plan = () => createApartmentPlan({ ...ONSAE });
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} != ${expected}`);
const TERRACE_Y = 2.4;
// Outside the footprint the terrace carries you, as the game's heightAt() does.
const environment = (b) => ({
  bounds: { minX: -40, maxX: 40, minZ: -60, maxZ: 0 }, colliders: b.solids,
  heightAt: (x, z, y) => supportAt(b, x, z, y) ?? TERRACE_Y,
  ceilingAt: (x, z, y) => ceilingAt(b, x, z, y),
});
const blocked = (b, [x, y, z]) => b.solids.some((s) => bodyOverlaps(x, y, z, 0.3, s));

test('plans without baseY are byte-identical to before the agency layout existed', () => {
  const hash = (options) => createHash('sha256').update(JSON.stringify(createApartmentPlan(options))).digest('hex');
  // Recorded from level-support.js at 4ad0f0c^ (before `baseY` and `layout: 'agency'`).
  assert.equal(hash({ id: 'seoul-home', city: 'seoul', x: -35, z: 61, w: 14, d: 12, style: 'seoul', layout: 'dorm' }), 'd08ccfcfb77c182f5a86e377f235b5d53c31979251c188a797164d84153b57e8');
  assert.equal(hash({ id: 'flat', city: 'tokyo', x: 10, z: -20 }), '257e2252b234595810ea3c204029d7a22b2e8de287867972f9e69068e3588e6a');
  assert.equal(hash({ id: 'flat2', city: 'shanghai', x: 3, z: 4, w: 16, d: 12, floors: 4, storeyHeight: 3.3, rooftop: false }), '8c5f71934a4ed3273cbedc0f3cbdcc9e2112213c95428a6748ac32e521e29745');
  assert.equal('baseY' in createApartmentPlan({ id: 'flat', city: 'tokyo', x: 10, z: -20 }), false);
  assert.equal(JSON.stringify(createApartmentPlan({ id: 'flat', city: 'tokyo', x: 10, z: -20, baseY: 0 })), JSON.stringify(createApartmentPlan({ id: 'flat', city: 'tokyo', x: 10, z: -20 })));
});

test('baseY lifts every record of an ordinary plan by exactly that much', () => {
  const options = { id: 'lifted', city: 'tokyo', x: 348, z: -47 };
  const low = createApartmentPlan(options), high = createApartmentPlan({ ...options, baseY: 2.4 });
  assert.equal(high.baseY, 2.4);
  assert.equal(high.pieces.length, low.pieces.length);
  low.pieces.forEach((p, i) => { close(high.pieces[i].minY - p.minY, 2.4, p.id); close(high.pieces[i].maxY - p.maxY, 2.4, p.id); close(high.pieces[i].position[1] - p.position[1], 2.4, p.id); });
  low.supports.forEach((s, i) => close(high.supports[i].y - s.y, 2.4, s.id));
  low.route.forEach((p, i) => close(high.route[i].y - p.y, 2.4, p.kind));
  low.safePoints.forEach((p, i) => close(high.safePoints[i].y - p.y, 2.4, p.kind));
  low.levels.forEach((room, i) => {
    const up = high.levels[i];
    close(up.floorY - room.floorY, 2.4); close(up.bounds.minY - room.bounds.minY, 2.4); close(up.bounds.maxY - room.bounds.maxY, 2.4);
    close(up.door[1] - room.door[1], 2.4); close(up.staff.spawn[1] - room.staff.spawn[1], 2.4);
  });
  close(high.bounds.minY - low.bounds.minY, 2.4); close(high.bounds.maxY - low.bounds.maxY, 2.4); close(high.entry[1], 2.4);
  for (const [x, y, z] of [[348, 0, -45], [351, 3.4, -46], [343, 5.2, -47.5], [352, 10.2, -48]]) {
    close(supportAt(high, x, z, y + 2.4) - supportAt(low, x, z, y), 2.4, 'support');
    assert.equal(zoneAt(high, { x, y: y + 2.4, z })?.level, zoneAt(low, { x, y, z })?.level, 'zone');
    const c = ceilingAt(low, x, z, y);
    if (c === null) assert.equal(ceilingAt(high, x, z, y + 2.4), null); else close(ceilingAt(high, x, z, y + 2.4) - c, 2.4, 'ceiling');
  }
  assert.equal(zoneAt(high, { x: 348, y: 0.5, z: -45 }), null, 'below the lifted ground floor is outside');
});

test('the agency: three floors on the terrace, no rooftop, nobody on staff, no home props', () => {
  const b = plan();
  assert.deepEqual(b.levels.map((l) => l.floorY), FLOOR_Y);
  assert.deepEqual(b.levels.map((l) => l.id), O.LEVEL_IDS);
  assert.deepEqual(FLOOR_Y, [2.4, 5.8, 9.2]);
  assert.deepEqual([b.bounds.minX, b.bounds.maxX, b.bounds.minZ, b.bounds.maxZ], [-16, -2, -44, -32]);
  assert.deepEqual(b.entry, [-9, 2.4, -32]);
  for (const room of b.levels) { assert.equal(room.staff, null); assert.equal(room.category, 'studio'); }
  const kinds = b.levels.map((l) => l.furniture.map((f) => f.kind));
  for (const k of ['mailbox-bank', 'concierge-desk', 'bunk-frame', 'bed-frame', 'manager-desk']) assert.equal(kinds.flat().includes(k), false, k);
  assert.equal(b.pieces.some((p) => /rooftop|parapet|water-tank/.test(p.role)), false);
  assert.equal(supportAt(b, -5, -38, 12.6 + 2), 9.2, 'nothing to stand on above the third floor');
  assert.equal(zoneAt(b, { x: -5, y: 12.61, z: -38 }), null);
  for (const k of ['reception-desk', 'sofa-base', 'low-table', 'trophy-cabinet', 'trophy', 'vending-machine', 'water-cooler', 'plant-pot']) assert.ok(kinds[0].includes(k), `1F ${k}`);
  for (const k of ['barre', 'speaker', 'mirror-panel', 'water-bottle', 'towel-on-floor', 'corridor-bench']) assert.ok(kinds[1].includes(k), `2F ${k}`);
  for (const k of ['locker', 'your-locker', 'locker-bench', 'microphone', 'keyboard', 'kettle', 'vending-machine', 'sofa-base']) assert.ok(kinds[2].includes(k), `3F ${k}`);
  assert.equal(kinds[2].filter((k) => k === 'locker' || k === 'your-locker').length, 7);
  // The player's locker is the middle one, under the label.
  const mine = b.levels[2].furniture.find((f) => f.kind === 'your-locker');
  close(mine.position[0], O.lockerLabel[0]); close(mine.position[0], O.locker[0]);
  assert.throws(() => createApartmentPlan({ ...ONSAE, floors: 4 }), RangeError);
  assert.throws(() => createApartmentPlan({ ...ONSAE, d: 10 }), RangeError);
});

test('zones, supports and ceilings answer at the right heights on every floor', () => {
  const b = plan();
  assert.equal(zoneAt(b, { x: -7, y: 2.4, z: -37 }).level, 0);
  assert.equal(zoneAt(b, { x: -7, y: 5.8, z: -37 }).level, 1);
  assert.equal(zoneAt(b, { x: -7, y: 9.2, z: -37 }).level, 2);
  assert.equal(zoneAt(b, { x: -7, y: 0, z: -37 }), null, 'street level under the terrace is not the lobby');
  assert.equal(zoneAt(b, { x: -1, y: 2.4, z: -37 }), null, 'the terrace beside it');
  for (const y of FLOOR_Y) {
    close(supportAt(b, -6, -37, y), y, 'floor');
    close(ceilingAt(b, -6, -37, y), y + 3.24, 'slab overhead');
    const under = supportAt(b, -6, -37, y - 0.2);
    if (y === 2.4) assert.equal(under, null, 'nothing under the lobby floor'); else close(under, y - 3.4, 'never snaps up a storey');
  }
  // The stairwell hole on 2F/3F exposes the flight below rather than a floor.
  assert.ok(supportAt(b, -14.55, -37, 5.8) < 5.8 - 0.5);
  // Every level's bounds are its own storey.
  b.levels.forEach((room, i) => { close(room.bounds.minY, FLOOR_Y[i] - 0.025); close(room.bounds.maxY, FLOOR_Y[i] + 3.374); close(room.door[1], FLOOR_Y[i]); });
  for (const p of b.safePoints) { close(supportAt(b, p.x, p.z, p.y), p.y, p.kind); assert.equal(blocked(b, [p.x, p.y, p.z]), false, p.kind); }
});

test('the authored route is continuous: door → lobby → stairs → 2F corridor → rooms A and B → 3F lockers, lounge, vocal booth → back out', () => {
  const b = plan();
  let p = b.route[0];
  const kinds = new Set();
  for (const q of b.route.slice(1)) {
    const distance = Math.hypot(q.x - p.x, q.z - p.z);
    assert.ok(Math.abs(q.y - p.y) <= distance * 0.9 + 1e-6, 'no vertical-only transition');
    const steps = Math.max(1, Math.ceil(distance / 0.012));
    let last = p;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const v = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t };
      close(supportAt(b, v.x, v.z, last.y) ?? TERRACE_Y, v.y, `${q.kind} support at ${JSON.stringify(v)}`);
      const c = ceilingAt(b, v.x, v.z, v.y);
      assert.ok(c === null || c >= v.y + 1.9 - 1e-6, `head blocked on ${q.kind} at ${JSON.stringify(v)}, ceiling ${c}`);
      assert.equal(b.solids.some((s) => bodyOverlaps(v.x, v.y, v.z, 0.3, s)), false, `body blocked on ${q.kind} at ${JSON.stringify(v)}`);
      last = v;
    }
    kinds.add(`${q.kind}:${q.y.toFixed(1)}`); p = q;
  }
  for (const k of ['lobby:2.4', 'artist-wall:2.4', 'floor-guide:2.4', 'half-landing:4.1', 'corridor:5.8', 'practice-a:5.8', 'practice-b:5.8', 'half-landing:7.5',
    'corridor:9.2', 'locker:9.2', 'lounge:9.2', 'vocal:9.2', 'descent-street-approach:2.4']) assert.ok(kinds.has(k), k);
});

test('CPU traversal walks the whole building with ordinary input and comes back out on the terrace', () => {
  const b = plan(), env = environment(b), state = createTraversal();
  const p = { ...b.route[0] }; let maxY = 0;
  for (const target of b.route.slice(1)) {
    let reached = false;
    for (let frame = 0; frame < 6000; frame++) {
      const dx = target.x - p.x, dz = target.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 0.035 && Math.hypot(state.vx, state.vz) < 0.03) { reached = true; break; }
      const speed = Math.min(1, Math.max(0.085, dist * 2));
      const input = dist < 0.02 ? { brake: true } : { x: dx / dist * speed, z: dz / dist * speed };
      const before = { ...p };
      stepTraversal(state, p, input, env, 1 / 120);
      maxY = Math.max(maxY, p.y);
      assert.ok(Math.abs(p.y - before.y) < 0.07, 'no floor snap');
      assert.ok(!b.solids.some((s) => bodyOverlaps(p.x, p.y, p.z, 0.3, s)), `collider penetration ${target.kind}`);
    }
    assert.ok(reached, `stuck approaching ${JSON.stringify(target)} at ${JSON.stringify(p)}`);
    assert.ok(Math.abs(p.y - target.y) < 0.04, `wrong level at ${target.kind}: ${p.y}`);
  }
  close(maxY, 9.2, 'the third floor is the top');
  close(p.y, TERRACE_Y, 'back on the terrace');
});

test('the top of the stairwell is closed: you cannot walk off the third-floor landing into the well', () => {
  const b = plan(), env = environment(b);
  for (const x of [-15.55, -14.55, -13.2]) {
    const state = createTraversal(), p = { x, y: 9.2, z: -34.6 };
    for (let i = 0; i < 360; i++) stepTraversal(state, p, { z: -1 }, env, 1 / 120);
    close(p.y, 9.2, `still on the landing from x=${x}`);
    assert.ok(p.z > -35.8, `stopped at the rail, z=${p.z}`);
  }
});

test('onsae.js rooms are the plan\'s zones', () => {
  const b = plan();
  const zones = Object.fromEntries(b.levels.flatMap((room) => room.zones.filter((z) => z.name !== 'stairs' || room.level === 0).map((z) => [z.name, { ...z, level: room.level, floorY: room.floorY }])));
  assert.deepEqual(Object.keys(ROOMS).sort(), Object.keys(zones).sort());
  for (const [name, r] of Object.entries(ROOMS)) {
    const z = zones[name];
    for (const k of ['minX', 'maxX', 'minZ', 'maxZ', 'floorY']) close(r[k], z[k], `${name}.${k}`);
    assert.equal(r.level, z.level, name);
  }
  // The stair hall is the same rectangle on every floor.
  for (const room of b.levels) for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) close(room.zones.find((z) => z.name === 'stairs')[k], ROOMS.stairs[k]);
});

test('every onsae.js spot is in its room, on a support at that floor\'s height, and not inside furniture', () => {
  const b = plan();
  for (const [name, room] of Object.entries(SPOT_ROOMS)) {
    const [x, y, z] = SPOTS[name];
    assert.equal(roomAt(x, y, z), room, `${name} is in ${room}`);
    close(supportAt(b, x, z, y), y, `${name} support`);
    if (room !== 'stairs') close(y, ROOMS[room].floorY, `${name} floor`);
    assert.equal(blocked(b, [x, y, z]), false, `${name} is clear of solids`);
    assert.equal(zoneAt(b, { x, y, z }).level, FLOOR_Y.indexOf(y), `${name} level`);
    // main.js zoneAt() names the room from the level's zones: same answer as roomAt().
    assert.equal(zoneAt(b, { x, y, z }).zones.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)?.name, room, `${name} zone name`);
    const c = ceilingAt(b, x, z, y);
    assert.ok(c === null || c >= y + 1.9, `${name} headroom`);
  }
  for (const name of Object.keys(SPOTS)) assert.ok(name in SPOT_ROOMS || name === 'door' || name === 'lockerLabel', `${name} has a room`);
  for (const name of ['door', 'lobby', 'desk', 'artistWall', 'guide', 'stair1', 'stair2', 'stair3', 'corridor2', 'roomADoor', 'roomA', 'roomAFront', 'mirror', 'whiteboard', 'evalBoard',
    'roomBDoor', 'roomB', 'roomBWatch', 'roomBWall', 'corridor3', 'locker', 'lockerLabel', 'vocal', 'lounge']) {
    assert.ok(Array.isArray(O[name]) && O[name].length === 3 && O[name].every(Number.isFinite), `export ${name}`);
  }
  // The front door spot is outside, on the terrace walk between the stone stairs and the building.
  const [dx, dy, dz] = O.door;
  assert.equal(roomAt(dx, dy, dz), null);
  assert.equal(dy, TERRACE_Y);
  assert.ok(dz > -32 && dz < -28 && dx > -16 && dx < 3, 'on the terrace walk');
  assert.equal(blocked(b, [dx, dy, dz]), false);
  // The label is on the middle locker's door, at eye height, in the locker room.
  assert.equal(roomAt(...O.lockerLabel.map((v, i) => (i === 1 ? FLOOR_Y[2] : v))), 'lockers');
  close(O.lockerLabel[1], FLOOR_Y[2] + 1.62);
  // 연습실 B: watch from just inside the door; the sitting spot is against the wall, off the route to her.
  assert.ok(Math.hypot(O.roomBWatch[0] - O.roomBDoor[0], O.roomBWatch[2] - O.roomBDoor[2]) < 2);
  assert.ok(O.roomBWall[0] > ROOMS.practice_b.maxX - 0.6, 'back to the corridor wall');
  assert.ok(Math.hypot(O.roomBWall[0] - O.roomB[0], O.roomBWall[2] - O.roomB[2]) > 1.2, 'not on top of her');
});

test('roomAt names every room, the stairs between floors, and nothing outside', () => {
  assert.equal(roomAt(-7, 2.4, -37), 'lobby');
  assert.equal(roomAt(-14.55, 3.3, -37), 'stairs', 'mid-flight');
  assert.equal(roomAt(-12, 5.8, -34.5), 'stairs', '2F landing');
  assert.equal(roomAt(-9.7, 5.8, -37), 'corridor2');
  assert.equal(roomAt(-5, 5.8, -37), 'practice_a');
  assert.equal(roomAt(-13, 5.8, -42), 'practice_b');
  assert.equal(roomAt(-9.7, 9.2, -37), 'corridor3');
  assert.equal(roomAt(-5, 9.2, -35), 'lockers');
  assert.equal(roomAt(-5, 9.2, -41), 'lounge');
  assert.equal(roomAt(-13, 9.2, -42), 'vocal');
  assert.equal(roomAt(-13, 2.4, -42), null, 'the closed bay behind the stairs on 1F');
  assert.equal(roomAt(-9, 2.4, -30.8), null, 'outside the door');
  assert.equal(roomAt(-7, 0, -37), null, 'under the terrace');
  assert.equal(roomAt(-7, 12.7, -37), null, 'above the roof');
  assert.equal(roomAt(0, 2.4, -37), null);
});

test('cast spots: staff at the mirror facing the room, six trainees facing them; the corridor pairs stand clear of the doors', () => {
  const b = plan();
  const ids = ['manager_choi', 'coach_park', 'minji', 'yerin', 'daon', 'yunseo', 'dohee', 'boram'];
  assert.deepEqual(Object.keys(CAST_SPOTS), ids);
  const all = [];
  for (const id of ids) {
    const { at: [x, y, z], yaw } = CAST_SPOTS[id];
    assert.equal(roomAt(x, y, z), 'practice_a', id);
    close(supportAt(b, x, z, y), y, id);
    assert.equal(blocked(b, [x, y, z]), false, id);
    const staff = id === 'manager_choi' || id === 'coach_park';
    assert.equal(Math.sin(yaw) < -0.5, staff, `${id} faces ${staff ? 'the room' : 'the mirror wall'}`);
    assert.equal(x > O.roomA[0] + 1, staff, `${id} side of the room`);
    assert.ok(Math.hypot(x - (O.roomADoor[0] + 1.6), z - O.roomADoor[2]) > 1.2, `${id} leaves the doorway clear`);
    all.push([x, z]);
  }
  for (let i = 0; i < all.length; i++) for (let j = 0; j < i; j++) assert.ok(Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]) > 0.8, 'nobody overlaps');
  assert.deepEqual(Object.keys(CORRIDOR_SPOTS).sort(), ids.slice(2).sort());
  const pairs = [0, 1, 2].map((n) => Object.values(CORRIDOR_SPOTS).filter((s) => s.pair === n));
  for (const pair of pairs) {
    assert.equal(pair.length, 2);
    const d = Math.hypot(pair[0].at[0] - pair[1].at[0], pair[0].at[2] - pair[1].at[2]);
    assert.ok(d > 0.6 && d < 1.3, 'a pair walks together');
  }
  for (const [id, { at: [x, y, z] }] of Object.entries(CORRIDOR_SPOTS)) {
    assert.ok(['corridor2', 'stairs'].includes(roomAt(x, y, z)), id);
    close(y, FLOOR_Y[1], id);
    close(supportAt(b, x, z, y), y, id);
    assert.equal(blocked(b, [x, y, z]), false, id);
    // Not standing in the top of the flight or in the stair door.
    assert.ok(Math.hypot(x - O.stair2[0], z - O.stair2[2]) > 0.9, `${id} clear of the stair head`);
  }
});

test('day1.js seats the studio cast at the room-A spots', async () => {
  const { createStudioCast } = await import('../apps/client/public/cozy/js/day1.js');
  const made = [];
  const cast = createStudioCast({ group: { attach: (root) => made.push(root) }, floorY: FLOOR_Y[1],
    makeCastMember: () => ({ root: { position: { set(x, y, z) { this.at = [x, y, z]; } }, rotation: {}, visible: true } }) });
  assert.equal(cast.actors.length, 8);
  for (const a of cast.actors) {
    assert.deepEqual(a.character.root.position.at, CAST_SPOTS[a.id].at, a.id);
    assert.equal(a.character.root.rotation.y, CAST_SPOTS[a.id].yaw);
    assert.equal(a.character.root.visible, false);
  }
});

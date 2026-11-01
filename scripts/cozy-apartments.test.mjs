import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createApartmentPlan, supportAt, ceilingAt, zoneAt, SUPPORT_REACH } from '../apps/client/public/cozy/js/level-support.js';
import { createTraversal, stepTraversal, bodyOverlaps } from '../apps/client/public/cozy/js/traversal.js';

const make = (d = 12) => createApartmentPlan({ id: `tokyo-home-d${d}`, city: 'tokyo', x: 348, z: -47, w: 14, d });
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} != ${expected}`);
const environment = b => ({
  bounds: { minX: 320, maxX: 380, minZ: -80, maxZ: -20 }, colliders: b.solids,
  heightAt: (x, z, y) => supportAt(b, x, z, y) ?? 0,
  ceilingAt: (x, z, y) => ceilingAt(b, x, z, y),
});

const makeDorm = () => createApartmentPlan({ id: 'seoul-dorm', city: 'seoul', x: 348, z: -47, layout: 'dorm' });
for (const [label, build] of [['d12', () => make(12)], ['d10', () => make(10)], ['dorm', makeDorm]]) {
  test(`${label}: real authored route has continuous support, body width and head clearance`, () => {
    const b = build();
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
        const h = supportAt(b, v.x, v.z, last.y) ?? 0;
        close(h, v.y, `${q.kind} support at ${JSON.stringify(v)}`);
        const c = ceilingAt(b, v.x, v.z, v.y);
        assert.ok(c === null || c >= v.y + 1.9 - 1e-6, `head blocked on ${q.kind} at ${JSON.stringify(v)}, ceiling ${c}`);
        assert.equal(b.solids.some(s => bodyOverlaps(v.x, v.y, v.z, 0.3, s)), false, `body blocked on ${q.kind} at ${JSON.stringify(v)}`);
        last = v;
      }
      kinds.add(`${q.kind}:${q.y.toFixed(1)}`); p = q;
    }
    for (const y of [3.4, 6.8]) assert.ok(kinds.has(`bedside:${y.toFixed(1)}`));
    assert.ok(kinds.has('half-landing:1.7') && kinds.has('half-landing:5.1'));
    assert.match(b.route.at(-1).kind, /^descent-street/);
    assert.deepEqual(JSON.parse(JSON.stringify(b.route)), b.route);
  });

  test(`${label}: CPU traversal walks up BOTH flights, visits rooms, descends and exits with no pose assignment`, () => {
    const b = build(), env = environment(b), state = createTraversal();
    const p = { ...b.route[0] }; let maxY = 0;
    for (const target of b.route.slice(1)) {
      let reached = false;
      for (let frame = 0; frame < 6000; frame++) {
        const dx = target.x - p.x, dz = target.z - p.z, dist = Math.hypot(dx, dz);
        if (dist < 0.035 && Math.hypot(state.vx, state.vz) < 0.03) { reached = true; break; }
        // Ordinary directional input, eased/braked at corners; never write pose.
        const speed = Math.min(1, Math.max(0.085, dist * 2));
        const input = dist < 0.02 ? { brake: true } : { x: dx / dist * speed, z: dz / dist * speed };
        const before = { ...p };
        stepTraversal(state, p, input, env, 1 / 120);
        maxY = Math.max(maxY, p.y);
        assert.ok(Math.abs(p.y - before.y) < 0.07, 'no floor snap');
        assert.ok(!b.solids.some(s => bodyOverlaps(p.x, p.y, p.z, 0.3, s)), `collider penetration ${target.kind}`);
      }
      assert.ok(reached, `stuck approaching ${JSON.stringify(target)} at ${JSON.stringify(p)}`);
      assert.ok(Math.abs(p.y - target.y) < 0.04, `wrong level at ${target.kind}: ${p.y}`);
    }
    close(maxY, 10.2, 'reached the actual rooftop above the top floor');
    close(p.y, 0, 'exited at street height');
  });
}

test('dorm: three bunk rooms, your bunk on the first floor only, Sua\'s stripped bed, a manager at the desk', () => {
  const b = makeDorm();
  for (const room of b.levels.slice(1)) {
    const kinds = room.furniture.map(f => f.kind);
    assert.equal(kinds.filter(k => k === 'bunk-frame').length, 4, 'four bunks per floor');
    for (const k of ['stripped-mattress', 'rice-cooker', 'kitchen-table', 'whiteboard', 'shoe-rack', 'manager-desk', 'washing-machine', 'toilet-seat', 'shower-tray', 'drying-rack'])
      assert.ok(kinds.includes(k), k);
    assert.equal(kinds.includes('your-bunk'), room.level === 1);
    assert.deepEqual(room.zones.filter(z => z.name).map(z => z.name).sort(), ['room_a', 'room_b', 'room_c']);
    const [x, y, z] = room.staff.spawn;
    close(supportAt(b, x, z, y), y);
    assert.equal(b.solids.some(s => bodyOverlaps(x, y, z, 0.3, s)), false, 'staff not in furniture');
  }
  assert.equal(b.levels[1].staff.role, 'manager');
  for (const p of b.categoryPositions) assert.equal(b.solids.some(s => bodyOverlaps(p.x, p.y, p.z, 0.3, s)), false, p.kind);
  assert.throws(() => createApartmentPlan({ id: 'x', city: 'seoul', x: 0, z: 0, d: 10, layout: 'dorm' }), RangeError);
});

test('rooftop terrace is outdoors, guarded at the well and the parapet, with a platform to sit on', () => {
  const b = make(), env = environment(b), roofY = 10.2;
  close(supportAt(b, 352, -48, roofY), roofY, 'walkable terrace');
  assert.equal(zoneAt(b, { x: 352, y: roofY, z: -48 }), null, 'roof is outdoors, not the top flat');
  close(supportAt(b, 352.8, -50.8, roofY + 0.42), roofY + 0.42, 'sitting platform top');
  const walkFor = (p, input, seconds, jump = false) => {
    const state = createTraversal();
    for (let i = 0; i < seconds * 120; i++) {
      if (jump && i % 60 === 0) state.jumpQueued = true;
      stepTraversal(state, p, input, env, 1 / 120);
      assert.ok(!b.solids.some(s => bodyOverlaps(p.x, p.y, p.z, 0.3, s)), 'no penetration');
    }
    return p;
  };
  // From the arrival landing, walking into the well over the west flight is blocked.
  const well = walkFor({ x: 342.45, y: roofY, z: -43.4 }, { z: -1 }, 3);
  close(well.y, roofY, 'still on the roof');
  assert.ok(well.z > -44.8 + 0.3, `stopped at the well rail, z=${well.z}`);
  // Running and jumping at the east parapet never carries the player over it.
  const edge = walkFor({ x: 352, y: roofY, z: -45 }, { x: 1 }, 4, true);
  assert.ok(edge.x < 355 - 0.1 - 0.3 + 1e-6 && edge.y >= roofY - 1e-6, `kept inside the parapet ${JSON.stringify(edge)}`);
});

test('feet-Y selects reachable support, never the highest floor; holes expose lower geometry', () => {
  const b = make();
  for (const feet of [0, 3.4, 6.8]) close(supportAt(b, 349.55, -43.75, feet), feet);
  close(supportAt(b, 349.55, -43.75, 2.9), 0);
  assert.equal(supportAt(b, 349.55, -43.75, undefined), null);
  // Centre of the open well: no top slab, no ramp, no intermediate landing.
  close(supportAt(b, 343.75, -46, 6.8), 0);
  assert.equal(supportAt(b, 400, -47, 0), null);
  assert.equal(supportAt(b, 348, -39.8, 0), null);
  const flight = b.supports.find(s => s.kind === 'stair');
  const x = (flight.minX + flight.maxX) / 2, z = (flight.minZ + flight.maxZ) / 2;
  close(supportAt(b, x, z, 0), 0, 'under a flight stays on lower support');
  close(supportAt(b, x, z, 0.85), 0.85);
  assert.ok(SUPPORT_REACH < 0.1);
  assert.ok(b.supports.filter(s => s.kind === 'stair').every(s => Math.abs(s.slopeZ) <= 0.9));
});

test('ceilings model the real slab and low stair underside, not a room-wide floor index', () => {
  const b = make();
  close(ceilingAt(b, 349.55, -43.75, 0), 3.24);
  close(ceilingAt(b, 349.55, -43.75, 3.4), 6.64);
  close(ceilingAt(b, 349.55, -43.75, 6.8), 10.04);
  const landing = b.supports.find(s => s.kind === 'half-landing');
  const x = (landing.minX + landing.maxX) / 2, z = (landing.minZ + landing.maxZ) / 2;
  close(ceilingAt(b, x, z, 0), 1.54, 'low under-landing clearance');
  assert.ok(ceilingAt(b, x, z, 1.7) >= 3.6, 'standing on landing does not hit its own underside');
  const flight = b.supports.find(s => s.kind === 'stair');
  const c = ceilingAt(b, (flight.minX + flight.maxX) / 2, (flight.minZ + flight.maxZ) / 2, 0);
  assert.ok(c > 0.4 && c < 1.9, `actual low under-stair ${c}`);
  assert.equal(ceilingAt(b, 400, -47, 0), null);
});

test('finite solids, room zones, actual furnishings and accessible resident/safe/category positions', () => {
  const b = make();
  const ids = new Set(b.pieces.map(p => p.id));
  assert.equal(ids.size, b.pieces.length);
  for (const s of b.solids) {
    for (const key of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ']) assert.ok(Number.isFinite(s[key]), `${s.id} ${key}`);
    assert.ok(s.maxY > s.minY && s.role && s.id && s.buildingId && s.interiorId);
    assert.ok(!['slab', 'step'].includes(s.role), 'no horizontal full-slab XZ collider');
  }
  for (const room of b.levels) {
    assert.ok(Number.isFinite(room.bounds.minY) && Number.isFinite(room.bounds.maxY));
    assert.equal(zoneAt(b, { x: 349, y: room.floorY, z: -44 }).id, room.id);
    assert.ok(room.furniture.every(f => f.pieceIds.length && f.pieceIds.every(id => ids.has(id))));
    if (room.level) for (const kind of ['bed-frame', 'mattress', 'duvet', 'pillow', 'wardrobe', 'toilet-seat', 'shower-tray', 'bath-basin', 'kitchen-cabinets', 'sofa-cushion'])
      assert.ok(room.furniture.some(f => f.kind === kind), kind);
    const [x, y, z] = room.staff.spawn;
    close(supportAt(b, x, z, y), y);
    assert.equal(b.solids.some(s => bodyOverlaps(x, y, z, 0.3, s)), false, 'resident not in furniture');
    assert.ok(ceilingAt(b, x, z, y) >= y + 1.9);
  }
  for (const p of [...b.safePoints, ...b.categoryPositions]) {
    close(supportAt(b, p.x, p.z, p.y), p.y);
    assert.equal(b.solids.some(s => bodyOverlaps(p.x, p.y, p.z, 0.3, s)), false, `safe ${p.kind}`);
  }
  assert.equal(zoneAt(b, { x: 348, y: 10.3, z: -47 }), null);
  assert.equal(zoneAt(b, { x: 400, y: 3.4, z: -47 }), null);
  const upstairs = b.solids.find(s => s.level === 2 && s.role === 'furniture');
  assert.equal(bodyOverlaps((upstairs.minX + upstairs.maxX) / 2, 0, (upstairs.minZ + upstairs.maxZ) / 2, 0.3, upstairs), false);
});

test('open well has no invisible slab; gravity falls to actual lower support', () => {
  const b = make(), env = { ...environment(b), allowDrop: () => true };
  // Deliberately start falling INSIDE the central hole, not a normal-entry proof.
  const state = createTraversal(); state.grounded = false;
  const p = { x: 343.75, y: 6.8, z: -46 };
  let last = p.y;
  for (let i = 0; i < 240; i++) {
    stepTraversal(state, p, {}, env, 1 / 120);
    assert.ok(p.y <= last + 1e-7 && p.y >= 0);
    last = p.y;
  }
  close(p.y, 0); assert.ok(state.grounded);
});

test('upper standing floors belong only to lower roof cutaway; batching inputs retain floor roles', () => {
  const b = make();
  const slabs = b.pieces.filter(p => p.role === 'slab');
  for (const y of [3.4, 6.8]) {
    const upperFloor = slabs.filter(p => Math.abs(p.minY - (y - 0.16)) < 1e-6);
    assert.equal(upperFloor.length, 4);
    assert.ok(upperFloor.every(p => p.level === Math.round(y / 3.4) - 1 && p.cutaway === 'roof'));
  }
  assert.ok(slabs.some(p => p.cutaway === 'base'));
  assert.ok(slabs.some(p => p.cutaway === 'content'));
});

// Optional offline CPU mesh proof, using an existing local Three module. No
// renderer/browser/download. The unrelated shop merge utility is deliberately
// unavailable: this test calls the REAL registerInterior/cutaway implementation,
// but never buildRoom/enhanceRoom, and fails if their merge path is invoked.
test('real Three instances, public APIs, inventory-to-mesh transforms and stack cutaway ownership',
  { skip: !process.env.COZY_THREE_MODULE && 'Set COZY_THREE_MODULE to an existing offline three.module.js' }, async t => {
    const { registerHooks } = await import('node:module'); // Optional mesh proof needs Node >=22.15.
    const hooks = registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'three') return { url: pathToFileURL(process.env.COZY_THREE_MODULE).href, shortCircuit: true };
      if (specifier === 'three/addons/utils/BufferGeometryUtils.js') return {
        url: 'data:text/javascript,export function mergeGeometries(){throw new Error("Shop merge path is outside this apartment CPU test")}', shortCircuit: true,
      };
      return next(specifier, context);
    } });
    try {
      const THREE = await import('three');
      const { G } = await import('../apps/client/public/cozy/js/util.js');
      const { updateCutaways } = await import('../apps/client/public/cozy/js/interiors.js');
      const api = await import('../apps/client/public/cozy/js/apartments.js');
      assert.equal(api.apartments.length, 0, 'no import-time building');
      assert.equal(G.colliders.length, 0);
      G.scene = new THREE.Scene();
      const b = api.buildApartment({ id: 'mesh-pilot', city: 'tokyo', x: 348, z: -47 });
      assert.equal(b.rooms, b.levels);
      assert.equal(b.rooms.length, 3);
      assert.ok(b.meshes.length < 100, `static batches ${b.meshes.length}`);
      assert.equal(G.colliders.length, b.solids.length);
      assert.equal(api.apartmentHeightAt(349.55, -43.75, 3.4, 'tokyo'), 3.4);
      assert.equal(api.apartmentHeightAt(349.55, -43.75, 0, 'seoul'), null);
      close(api.apartmentCeilingAt(349.55, -43.75, 3.4, 'tokyo'), 6.64);
      assert.equal(api.apartmentZoneAt({ x: 349.55, y: 6.8, z: -43.75 }, 'tokyo').level, 2);
      assert.equal(api.apartmentZoneAt({ x: 400, y: 0, z: -43 }, 'tokyo'), null);
      const matrix = new THREE.Matrix4();
      for (const p of b.pieces) {
        const mesh = b.meshes.find(m => m.userData.pieceIds.includes(p.id));
        assert.ok(mesh?.isInstancedMesh, `${p.id} has real mesh`);
        mesh.getMatrixAt(p.batchIndex, matrix);
        const bounds = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix);
        for (const axis of ['X', 'Y', 'Z']) for (const extreme of ['min', 'max'])
          assert.ok(Math.abs(bounds[extreme][axis.toLowerCase()] - p[extreme + axis]) < 0.0001, `render/solid bounds agree ${p.id} ${extreme}${axis}`);
      }
      for (const r of b.rooms) assert.ok(r.walls.length && r.roofs.length && r.occluders.length && typeof r.ceilingAt === 'function');
      updateCutaways({ x: 348, y: 0, z: -43.75 }, { x: 348, y: 8, z: -35 }, 1, 'tokyo');
      for (const r of b.rooms.slice(1)) for (const m of [...r.walls, ...r.roofs, ...r.occluders]) assert.equal(m.visible, false, 'upper structure and furniture hidden downstairs');
      updateCutaways({ x: 348, y: 3.4, z: -43.75 }, { x: 348, y: 11, z: -35 }, 1, 'tokyo');
      for (const floor of b.rooms[0].roofs) {
        assert.equal(floor.visible, true, 'upper standing floor visible');
        assert.equal(floor.userData.cutawayHidden, false);
        close(floor.material.opacity, 1);
      }
      updateCutaways({ x: 400, y: 0, z: -43.75 }, { x: 400, y: 8, z: -35 }, 1, 'tokyo');
      for (const mesh of b.meshes) { assert.equal(mesh.visible, true); assert.equal(!!mesh.userData.cutawayHidden, false); }
      t.diagnostic(`${b.pieces.length} actual box instances / ${b.meshes.length} static batches / ${b.solids.length} finite solids; real registerInterior and cutaways, unused shop-merge import fixture`);
    } finally { hooks.deregister(); }
  });

// CPU contract checks: actual authored support records + runtime/traversal
// functions. No WebGL, normal-input browser journey or persistence claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { createApartmentPlan, supportAt, ceilingAt as planCeilingAt, zoneAt as planZoneAt } from '../apps/client/public/cozy/js/level-support.js';
import { roadSurfaceData } from '../apps/client/public/cozy/js/surfaces.js';
import { createTraversal, resetTraversal, stopTraversal, stepTraversal, bodyOverlaps, segmentHitsBox, MODES, PLAYER_CLEARANCE } from '../apps/client/public/cozy/js/traversal.js';

const source = readFileSync(new URL('../apps/client/public/cozy/js/main.js', import.meta.url), 'utf8');
const functionSource = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `actual runtime ${name}`);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const plan = () => createApartmentPlan({ id: 'tokyo-home', city: 'tokyo', x: 348, z: -47, w: 14, d: 12 });
test('actual ride selector and saved-pose dispatcher use finite-height collisions for all three rides', () => {
  for (const mode of ['skateboard', 'scooter', 'bicycle']) {
    const r = runtime(plan());
    r.p.set(380, 0, 40); // Outdoors; real, nonempty apartment collider list.
    assert.equal(r.setTransport(mode), true);
    assert.equal(r.state.mode, mode);
    const saved = r.safePose();
    assert.equal(saved.mode, mode);
    r.setTransport('walk');
    r.placePlayer(saved); // Actual dispatcher returns void; verify resulting pose/mode below.
    assert.deepEqual(r.p.toArray(), saved.position);
    assert.equal(r.state.mode, mode);
    const overhead = { minX: 379, maxX: 381, minZ: 39, maxZ: 41, minY: 3.4, maxY: 6.6 };
    const upper = runtime(plan(), { G: { colliders: [overhead] } });
    upper.p.set(380, 0, 40);
    upper.setTransport(mode);
    assert.equal(upper.state.mode, mode, 'overhead furniture does not pack an outdoor ride');
    overhead.minY = 0; overhead.maxY = 2;
    upper.setTransport(mode);
    assert.equal(upper.state.mode, 'walk', 'same-level obstacle still packs the ride safely');
  }
});

function runtime(building, overrides = {}) {
  const S = { city: 'tokyo', started: true, cityPositions: {} };
  const city = { bounds: { minX: 340, maxX: 460, minZ: -70, maxZ: 70 }, spawn: [380, 0, 40], yaw: 0, heightAt: () => 0 };
  const p = { ...building.safePoints[0], toArray() { return [this.x, this.y, this.z]; }, set(x,y,z) { Object.assign(this, { x,y,z }); return this; } };
  const player = { root: { position: p, rotation: { y: 0 } }, pose: 'idle' };
  const rooms = building.levels;
  const context = {
    S, player, interiors: rooms, currentCity: () => city, inSeoulCore: () => false,
    seoulHeightAt: () => 0, seoulZoneAt: () => null,
    apartments: [building],
    apartmentHeightAt: (x, z, y, cityId) => cityId === building.city ? supportAt(building, x, z, y) : null,
    apartmentCeilingAt: (x, z, y, cityId) => cityId === building.city ? planCeilingAt(building, x, z, y) : null,
    apartmentZoneAt: (position, cityId) => cityId === building.city ? planZoneAt(building, position) : null,
    interiorAt: (position) => rooms.find(r => position.x > r.bounds.minX && position.x < r.bounds.maxX && position.z > r.bounds.minZ && position.z < r.bounds.maxZ && position.y >= r.bounds.minY && position.y <= r.bounds.maxY),
    physicsColliders: () => building.solids, MODES, PLAYER_CLEARANCE, bodyOverlaps,
    traversal: createTraversal(), cam: { yaw: 0 },
    occupants: { update() {} }, localHour: () => 16.5,
    G: { colliders: building.solids }, transitioning: false, dlg: { state: { active: false } },
    rides: { resetPose() {} }, $: () => null, toast() {}, resetTraversal, stopTraversal,
    tong: { root: { position: { copy(position) { this.y = position.y; return this; } } } }, ...overrides,
  };
  const names = ['heightAt', 'ceilingAt', 'zoneAt', 'validPose', 'safePose', 'placePlayer', 'setTransport'];
  const api = new Function(...Object.keys(context), `let overview, vistaIndex; ${names.map(functionSource).join('\n')}\nreturn {${names.join(',')}};`)(...Object.values(context));
  return { ...api, S, p, state: context.traversal, city };
}

test('runtime selects explicit reachable feet support, not first XZ room or highest storey', () => {
  const b = plan(), r = runtime(b);
  for (const level of [0, 1, 2]) {
    const y = level * b.storeyHeight, p = b.safePoints[level];
    assert.equal(r.heightAt(p.x, p.z, y), y);
    assert.equal(r.zoneAt(p.x, p.z, y).level, level);
    assert.equal(r.validPose({ position: [p.x, y, p.z], yaw: 0 }), true);
    assert.equal(r.validPose({ position: [p.x, y + 0.5, p.z], yaw: 0 }), false, 'jump pose not a safe floor save');
  }
  assert.equal(r.heightAt(b.x, b.z + 3, 0), 0);
});

test('safe pose preserves an upper floor and falls back to the prior safe pose during a jump', () => {
  const b = plan(), r = runtime(b), upper = b.safePoints[2];
  Object.assign(r.p, upper);
  const saved = r.safePose();
  assert.equal(saved.position[1], 6.8);
  r.state.grounded = false; r.p.y += 0.7;
  assert.deepEqual(r.safePose(), saved);
});

test('actual restore preserves upper-floor and mid-flight saves instead of dropping to the first XZ room', () => {
  const b = plan(), r = runtime(b);
  const points = [...b.safePoints];
  for (const support of b.supports.filter(s => s.kind === 'stair')) {
    const x = (support.minX+support.maxX)/2, z = (support.minZ+support.maxZ)/2;
    points.push({ x, z, y: support.y + support.slopeZ*(z-support.startZ) });
  }
  for (const point of points) {
    const pose = { position: [point.x,point.y,point.z], yaw: 0 };
    assert.equal(r.validPose(pose), true);
    r.p.set(380,0,40); // Explicit CPU restore setup, not gameplay proof.
    r.placePlayer(pose);
    assert.deepEqual(r.p.toArray(), pose.position);
    assert.equal(r.state.grounded, true);
    assert.deepEqual(r.safePose().position, pose.position);
  }
});

test('pilot complete authored stair/room/descent route is physically traversable with finite solids and ceiling clearance', () => {
  const b = plan(), r = runtime(b), s = createTraversal();
  const first = b.route[0];
  const p = { x: first.x, y: first.y, z: first.z };
  const env = { colliders: b.solids, bounds: r.city.bounds, heightAt: r.heightAt, ceilingAt: r.ceilingAt, allowDrop: () => true };
  let highest = 0;
  for (const target of b.route.slice(1)) {
    let steps = 0;
    while (Math.hypot(target.x - p.x, target.z - p.z) > 0.035 && steps++ < 3600) {
      const dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz);
      // Proportional walking only; no position/Y writes after initial setup.
      const magnitude = Math.min(1, distance * 3);
      stepTraversal(s, p, { x: dx / distance * magnitude, z: dz / distance * magnitude }, env, 1 / 120);
      highest = Math.max(highest, p.y);
      assert.ok(!b.solids.some(c => bodyOverlaps(p.x, p.y, p.z, 0.3, c)), `body intersects solid at ${JSON.stringify(p)}`);
      const ceiling = r.ceilingAt(p.x, p.z, p.y);
      assert.ok(!Number.isFinite(ceiling) || p.y + PLAYER_CLEARANCE <= ceiling + 1e-5, `head clearance at ${target.kind}`);
    }
    assert.ok(steps < 3600, `${target.kind}: stuck ${JSON.stringify(p)} → ${JSON.stringify(target)}`);
    assert.ok(Math.abs(p.y - target.y) < 0.08, `correct level at ${target.kind}: ${p.y} vs ${target.y}`);
  }
  assert.ok(highest >= 6.79); assert.ok(p.y < 0.01); assert.equal(s.grounded, true);
});

// Optional real Three CPU scene (no renderer/canvas pixels). Use existing
// sources via COZY_THREE_MODULE/COZY_THREE_UTILS; never install for this test.
test('actual Tokyo native geometry + pilot + occupants retain street approach, full stair route and reachable staff', {
  skip: !process.env.COZY_THREE_MODULE || !process.env.COZY_THREE_UTILS,
}, async () => {
  const gradient = () => ({ addColorStop() {} });
  const canvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({
    createLinearGradient: gradient, createRadialGradient: gradient,
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  }, { get: (target, key) => target[key] ?? (() => {}) }) });
  const context = vm.createContext({ console, document: { createElement: canvas,
    createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_value) {} }) },
    Path2D: class { constructor() { return new Proxy({}, { get: () => () => {} }); } } });
  const modules = new Map();
  async function load(path) {
    path = resolve(path);
    if (modules.has(path)) return modules.get(path);
    const module = new vm.SourceTextModule(readFileSync(path, 'utf8'), { context, identifier: path });
    modules.set(path, module);
    await module.link((specifier, ref) => load(specifier === 'three' ? process.env.COZY_THREE_MODULE :
      specifier === 'three/addons/utils/BufferGeometryUtils.js' ? process.env.COZY_THREE_UTILS : resolve(dirname(ref.identifier), specifier)));
    return module;
  }
  const root = resolve('apps/client/public/cozy/js');
  const tokyo = await load(resolve(root, 'cities/tokyo.js'));
  const apartmentModule = await load(resolve(root, 'apartments.js'));
  const occupantModule = await load(resolve(root, 'occupants.js'));
  await tokyo.evaluate(); await apartmentModule.evaluate(); await occupantModule.evaluate();
  const THREE = (await load(process.env.COZY_THREE_MODULE)).namespace;
  const { G } = (await load(resolve(root, 'util.js'))).namespace;
  const interior = (await load(resolve(root, 'interiors.js'))).namespace;
  const apartment = apartmentModule.namespace;
  G.scene = new THREE.Scene();
  tokyo.namespace.default.build();
  const nativeSolids = [...G.colliders];
  const pilotCafe = interior.enhanceRoom(interior.interiors.find(room => room.id === 'tokyo-cafe-room'));
  pilotCafe.staff.placeId = 'tokyo-cafe';
  const b = apartment.buildApartment({ id: 'tokyo-home', city: 'tokyo', x: 348, z: -47, w: 14, d: 12, style: 'tokyo' });
  const occupants = occupantModule.namespace.createOccupants(interior.interiors);
  const r = runtime(b, { interiors: interior.interiors, interiorAt: interior.interiorAt,
    apartmentHeightAt: apartment.apartmentHeightAt, apartmentCeilingAt: apartment.apartmentCeilingAt, apartmentZoneAt: apartment.apartmentZoneAt,
    physicsColliders: () => [...G.colliders, ...occupants.colliders('tokyo')],
  });
  const overlapsPlot = nativeSolids.filter(c => c.minX < b.bounds.maxX && c.maxX > b.bounds.minX && c.minZ < b.bounds.maxZ && c.maxZ > b.bounds.minZ);
  assert.equal(overlapsPlot.length, 0, `pilot does not cover native solid/landmark footprints: ${JSON.stringify(overlapsPlot)}`);
  const p = { x: 357, y: 0, z: -30 }, s = createTraversal();
  const route = [{ x: 357, y: 0, z: -38.5 }, { x: 348, y: 0, z: -39.8 }, ...b.route.slice(2)];
  const env = { heightAt: r.heightAt, ceilingAt: r.ceilingAt, colliders: [], bounds: r.city.bounds, allowDrop: () => true };
  for (const target of route) {
    let i = 0;
    while (Math.hypot(target.x-p.x, target.z-p.z) > 0.035 && i++ < 3600) {
      occupants.update({ city: 'tokyo', position: p, hour: 16.5 });
      env.colliders = [...G.colliders, ...occupants.colliders('tokyo')];
      const dx=target.x-p.x, dz=target.z-p.z, d=Math.hypot(dx,dz), magnitude=Math.min(1,d*3);
      stepTraversal(s, p, { x: dx/d*magnitude, z: dz/d*magnitude }, env, 1/120);
    }
    assert.ok(i < 3600, `native-scene blocked ${JSON.stringify(p)} -> ${JSON.stringify(target)}`);
    assert.ok(Math.abs(p.y-target.y)<0.08, 'native scene retains support level');
    assert.equal(r.validPose({ position: [p.x,p.y,p.z], yaw: 0 }), true, 'route save pose clear of native and actor solids');
  }
  const cafe = interior.interiors.find(room => room.id === 'tokyo-cafe-room');
  const q = { x: cafe.door[0]+0.8, y: 0, z: cafe.door[2] }, walk = createTraversal();
  const staff = occupants.actors.find(a => a.roomId === cafe.id), goal = { x: staff.spawn[0]+1.1, z: staff.spawn[2] };
  for (let i=0; i<420; i++) {
    occupants.update({ city: 'tokyo', position: q, hour: 16.5 });
    const dx=goal.x-q.x, dz=goal.z-q.z, d=Math.hypot(dx,dz);
    env.colliders=[...G.colliders,...occupants.colliders('tokyo')];
    stepTraversal(walk, q, { x: dx/(d||1)*Math.min(1,d*3), z: dz/(d||1)*Math.min(1,d*3) }, env, 1/120);
  }
  assert.equal(interior.interiorAt(q,'tokyo')?.id,cafe.id);
  assert.equal(occupants.nearest({ city:'tokyo',position:q,roomId:cafe.id })?.name,'Aoi');
  assert.equal(staff.placeId, 'tokyo-cafe', 'staff retains stable authored objective place id');
  assert.ok(Math.hypot(q.x-goal.x,q.z-goal.z)<0.05, 'staff physically approachable from outside cafe door');
});

test('actual runtime occupied-room interaction uses nearby actor, not the zero-distance room fallback', () => {
  const place = { id: 'tokyo-cafe', category: 'cafe', interiorId: 'tokyo-cafe-room', spawn: [10, 0, 0], icon: '☕', ko: '喫茶', en: 'Cafe' };
  const room = { id: place.interiorId, city: 'tokyo', staff: { spawn: [1, 0, 0] } };
  const character = { root: { position: { x: 1, y: 0, z: 0 } } };
  const actor = { character, roomId: room.id, placeId: place.id, name: 'Aoi' };
  let nearby = null, inside = room, opened = null;
  const context = { S: { city: 'tokyo', started: true }, vistaIndex: -1, modalOpen: () => false,
    dlg: { state: { active: false } }, player: { root: { position: { x: 0, y: 0, z: 0 } }, pose: 'idle' },
    currentCity: () => ({ airport: { spawn: [40, 0, 0] } }), interiorAt: () => inside,
    cityPlaces: () => [place], interiors: [room], interactables: [], G: { colliders: [] },
    occupants: { nearest: () => nearby && { ...nearby } },
    openPlace: (p, a) => { opened = { p, a }; }, openTravel: () => {}, staffAccessible: () => true,
    THREE: { Vector3: class { constructor(x,y,z) { Object.assign(this, { x,y,z }); } } },
    ui: { prompt: { innerHTML: '', classList: { add() {}, remove() {} } } },
    segmentHitsBox,
  };
  const api = new Function(...Object.keys(context), `let activeInteract; ${functionSource('updateInteract')}\nreturn () => {updateInteract(); return activeInteract;};`)(...Object.values(context));
  assert.equal(api(), null, 'room alone must not start an occupied shop activity');
  nearby = actor;
  const interaction = api();
  assert.ok(interaction.label.includes('Aoi'));
  interaction.act(); assert.equal(opened.p, place); assert.equal(opened.a.character, character);
  nearby = null; assert.equal(api(), null, 'out-of-range vendor is not replaced by room-wide activity');
  inside = null; assert.equal(api(), null, 'no exterior/through-wall shop trigger');
});

test('home category does not change the authored food/cafe/scenic errand sequence', () => {
  const places = [{ id: 'food', category: 'food' }, { id: 'cafe', category: 'cafe' }, { id: 'tokyo-home', category: 'home' }, { id: 'gate', category: 'scenic' }];
  const api = new Function('cityPlaces', `${functionSource('roleOf')}\n${functionSource('errandPlaces')}\nreturn {roleOf,errandPlaces};`)(() => places);
  assert.equal(api.roleOf(places[2]), 'home');
  assert.deepEqual(api.errandPlaces().map(p => p.id), ['food', 'cafe', 'gate']);
});

test('Tokyo roads use grouped disjoint surface data; existing geography and connector retained', () => {
  const tokyo = readFileSync(new URL('../apps/client/public/cozy/js/cities/tokyo.js', import.meta.url), 'utf8');
  const literal = tokyo.slice(tokyo.indexOf('const roads = ') + 'const roads = '.length, tokyo.indexOf('\nconst place ='));
  const roads = new Function('road', `return ${literal}`)((points, width, color = '#b9ac94') => ({ points: points.map(([x,z]) => [400+x,z]), width, color }));
  assert.equal(roads.length, 15, '14 native roads plus one home connector');
  assert.deepEqual(roads.at(-1).points, [[348, -39.8], [357, -38.5], [357, -30]]);
  const data = roadSurfaceData(roads);
  assert.ok(data.length > 0 && data.length <= new Set(roads.map(r => r.color)).size);
  for (const group of data) for (let i = 1; i < group.positions.length; i += 3) assert.equal(group.positions[i], Math.fround(0.025));
  assert.ok(!/function surface\(|surface\(r\.points/.test(tokyo), 'old segment/pad boxes removed');
  assert.ok(tokyo.includes('for (const data of roadSurfaceData(roads))'));
});

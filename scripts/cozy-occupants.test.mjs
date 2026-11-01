// CPU geometry/selection tests, NOT renderer, canvas appearance or gameplay proof.
// No install: supply existing Three r170 module + its BufferGeometryUtils source.
// COZY_THREE_MODULE=... COZY_THREE_UTILS=... node --experimental-vm-modules --test scripts/cozy-occupants.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';

const sourceRoot = resolve('apps/client/public/cozy/js');
async function harness() {
  assert.ok(process.env.COZY_THREE_MODULE && process.env.COZY_THREE_UTILS,
    'Set COZY_THREE_MODULE and COZY_THREE_UTILS to existing Three r170 sources (no dependency installation).');
  // Real factories/meshes with a no-op canvas painter: this does not test pixels.
  const gradient = () => ({ addColorStop() {} });
  const canvas = () => {
    const context = new Proxy({
      createLinearGradient: gradient, createRadialGradient: gradient,
      getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    }, { get: (target, key) => target[key] ?? (() => {}) });
    return { width: 0, height: 0, getContext: () => context };
  };
  const context = vm.createContext({ console, document: { createElement: canvas },
    Path2D: class { constructor() { return new Proxy({}, { get: () => () => {} }); } } });
  const modules = new Map();
  async function load(path) {
    path = resolve(path);
    if (modules.has(path)) return modules.get(path);
    const module = new vm.SourceTextModule(await readFile(path, 'utf8'), { context, identifier: path });
    modules.set(path, module);
    await module.link((specifier, referencing) => load(specifier === 'three' ? process.env.COZY_THREE_MODULE :
      specifier === 'three/addons/utils/BufferGeometryUtils.js' ? process.env.COZY_THREE_UTILS : resolve(dirname(referencing.identifier), specifier)));
    return module;
  }
  const interiorModule = await load(resolve(sourceRoot, 'interiors.js'));
  const occupantsModule = await load(resolve(sourceRoot, 'occupants.js'));
  await interiorModule.evaluate(); await occupantsModule.evaluate();
  const THREE = (await load(process.env.COZY_THREE_MODULE)).namespace;
  const util = (await load(resolve(sourceRoot, 'util.js'))).namespace;
  util.G.scene = new THREE.Scene();
  return { ...interiorModule.namespace, ...occupantsModule.namespace, THREE, ...util, load };
}
test('actual stocked cans are exposed to the aisle in rotated open shelf bays', async () => {
  for (const face of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const h = await harness(), room = h.buildRoom(roomArgs(h, 'store', { city: 'shanghai', face }));
    h.enhanceRoom(room); h.G.scene.updateMatrixWorld(true);
    const s = Math.round(Math.sin(face)), c = Math.round(Math.cos(face));
    const cans = room.furniture.filter(p => p.kind === 'stocked-can');
    assert.equal(cans.length, 8);
    for (const record of cans) {
      const target = new h.THREE.Vector3(...record.position);
      const dx = target.x - room.layout.x, dz = target.z - room.layout.z;
      const v = s * dx + c * dz;
      const origin = new h.THREE.Vector3(room.layout.x + s * (v + 1), target.y, room.layout.z + c * (v + 1));
      const ray = new h.THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.15);
      const hit = ray.intersectObjects(h.G.scene.children, true).find(hit => hit.object.material.opacity > 0.5);
      assert.ok(hit, 'actual geometry intersects the stock view');
      assert.ok(hit.object.userData.furniture?.some(p => p.kind === 'stocked-can'), 'first opaque surface is exposed stock, not a shelf casing');
      assert.ok(hit.point.distanceTo(target) < 0.13, 'visible stock is the targeted can, not another prop in its batch');
    }
  }
});

test('compact actual apartment lower-body sightline fades the intersecting wall plane and restores on orbit/exit', async () => {
  const h = await harness(), module = await h.load(resolve(sourceRoot, 'apartments.js'));
  await module.evaluate();
  const b = module.namespace.buildApartment({ id: 'shanghai-home', city: 'shanghai', x: 780, z: -69, w: 14, d: 10 });
  const p = new h.THREE.Vector3(784, 3.4, -72.35);
  const eye = new h.THREE.Vector3(784, p.y + 1.25 + 8 * Math.sin(.6), p.z + 8 * Math.cos(.6));
  const target = p.clone().add(new h.THREE.Vector3(0, .2, 0));
  h.updateCutaways(p, eye, 1, 'shanghai'); h.G.scene.updateMatrixWorld(true);
  const hits = new h.THREE.Raycaster(eye, target.clone().sub(eye).normalize(), 0, eye.distanceTo(target)).intersectObjects(b.rooms[1].walls, true);
  assert.ok(hits.length > 0, 'the photographed lower-body ray really intersects authored partition geometry');
  const wall = hits[0].object;
  assert.equal(h.isCameraOccluder(wall), false, 'partition is not opaque across lower avatar/bed');
  assert.ok(wall.material.opacity < .05);
  assert.equal(wall.visible, false, 'settled stacked-home wall is not drawn as a ghost band');
  assert.ok(b.rooms[1].roofs.every(mesh => !mesh.visible), 'settled active-home ceiling is not drawn or casting a wash');
  h.updateCutaways(p, { x: eye.x, y: eye.y, z: p.z - 8 * Math.cos(.6) }, 1, 'shanghai');
  assert.equal(h.isCameraOccluder(wall), true, 'opposite orbit restores the internal wall');
  assert.equal(wall.material.opacity, 1);
  assert.equal(wall.visible, true, 'opposite orbit restores original visibility');
  h.updateCutaways({ x: 784, y: 0, z: -60 }, eye, 1, 'shanghai');
  for (const room of b.rooms) for (const mesh of [...room.walls, ...room.roofs, ...room.occluders]) {
    assert.equal(mesh.visible, true);
    assert.equal(h.isCameraOccluder(mesh), true);
  }
});

function roomArgs(h, category = 'cafe', extra = {}) {
  return { id: `tokyo-${category}-room`, city: 'tokyo', category, x: 428, z: -2,
    w: 10, d: 9, face: Math.PI / 2, wallMaterial: h.mat('#eeeecc'), roofMaterial: h.mat('#555555'), ...extra };
}
function countMeshes(scene) { let n = 0; scene.traverse(m => { if (m.isMesh) n++; }); return n; }
function overlapsBody(p, b, radius = 0.34) {
  return p[1] + 1.85 > (b.minY ?? -Infinity) && p[1] < (b.maxY ?? Infinity) &&
    p[0] + radius > b.minX && p[0] - radius < b.maxX && p[2] + radius > b.minZ && p[2] - radius < b.maxZ;
}

test('rotated Tokyo pilot: separated visual floor, explicit idempotent opt-in and city parent', async () => {
  const h = await harness(), room = h.buildRoom(roomArgs(h));
  assert.equal(room.floorY, 0); assert.equal(room.staff, undefined); assert.equal(room.enhanced, undefined);
  const floor = h.G.scene.children.find(m => m.userData.role === 'floor');
  const bounds = new h.THREE.Box3().setFromObject(floor);
  assert.ok(Math.abs(bounds.max.y - 0.04) < 1e-8);
  const group = new h.THREE.Group();
  for (const child of [...h.G.scene.children]) group.add(child);
  h.G.scene.add(group); group.visible = false;
  const count = countMeshes(h.G.scene);
  h.enhanceRoom(room);
  assert.ok(countMeshes(h.G.scene) > count);
  assert.equal(h.G.scene.children.length, 1, 'enrichment after grouping stays in city group');
  assert.equal(room.staff.role, 'barista'); assert.equal(room.staff.name, 'Aoi');
  const after = [countMeshes(h.G.scene), h.G.colliders.length, room.furniture.length, h.G.nightMats.length];
  h.enhanceRoom(room); h.registerInterior({ ...room });
  assert.deepEqual([countMeshes(h.G.scene), h.G.colliders.length, room.furniture.length, h.G.nightMats.length], after);
  assert.equal(h.interiors.length, 1);
  // Door -> front of staff is a physical, unobstructed central walk route.
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, p = room.door.map((value, axis) => value + t * (room.staff.spawn[axis] - value));
    assert.ok(!h.G.colliders.some(b => overlapsBody(p, b)), `blocked approach step ${i}`);
  }
  h.updateCutaways({ x: 428, y: 0, z: -2 }, { x: 434, y: 5, z: 1 }, 1, 'tokyo');
  assert.equal(room.roofs[0].visible, false, 'settled single-floor roof no longer leaves ghost layers');
  assert.ok(room.roofs[0].material.opacity < .05);
  const authored = { id: 'seoul-cafe-room', city: 'seoul', category: 'cafe', furniture: [] };
  assert.equal(h.enhanceRoom(authored), authored); assert.equal(authored.staff, undefined);
});

test('settled generic cutaway hides late attached roof labels and restores their original state', async () => {
  const h = await harness(), room = h.buildRoom(roomArgs(h));
  const label = new h.THREE.Mesh(new h.THREE.PlaneGeometry(1, 1), h.mat('#ffffff'));
  room.roofs[0].add(label); // City signs attach AFTER room registration.
  h.updateCutaways({ x: 428, y: 0, z: -2 }, { x: 434, y: 5, z: -2 }, 1, 'tokyo');
  assert.equal(room.roofs[0].visible, false, 'parent suppresses even unregistered opaque sign children');
  assert.equal(label.visible, true); assert.equal(label.material.opacity, 1, 'do not mutate authored label material/state');
  h.updateCutaways({ x: 450, y: 0, z: 20 }, { x: 456, y: 5, z: 20 }, 1, 'tokyo');
  assert.equal(room.roofs[0].visible, true); assert.equal(label.visible, true); assert.equal(label.material.opacity, 1);
});

test('all category kits place semantic geometry, retain baseline, finite collisions and reachable staff', async () => {
  const h = await harness();
  const expected = { cafe: ['espresso-spout', 'bean-hopper', 'pastry', 'cup', 'chair-back'],
    food: ['steamer-lid', 'bowl', 'knife-blade', 'stool-seat'], store: ['fridge-door', 'drink-bottle', 'register-screen', 'stocked-can'],
    studio: ['piano-key', 'microphone', 'locker', 'speaker-cone'], subway: ['ticket-slot', 'route-line', 'route-stop', 'station-clock-face'] };
  for (const [i, category] of Object.keys(expected).entries()) {
    const room = h.buildRoom(roomArgs(h, category, { x: i * 30, face: i % 2 ? 0 : Math.PI / 2 }));
    const baseline = room.furniture.length;
    h.enhanceRoom(room);
    assert.ok(room.furniture.length > baseline);
    const placed = room.occluders.flatMap(mesh => mesh.userData.furniture ?? []);
    for (const kind of expected[category]) {
      const records = room.furniture.filter(record => record.kind === kind);
      assert.ok(records.length, `${category}: ${kind}`);
      for (const record of records) assert.ok(placed.includes(record), `${kind} retained on real batched mesh`);
    }
    assert.ok(!h.G.colliders.some(b => overlapsBody(room.staff.spawn, b)), `${category} staff spawn clear`);
  }
  for (const b of h.G.colliders) assert.ok(Number.isFinite(b.minY) && Number.isFinite(b.maxY));
  for (const child of h.G.scene.children.filter(m => m.isMesh)) {
    assert.ok(child.geometry.attributes.position.count > 0);
    for (const value of child.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
  }
});

test('real factory actors: deterministic names, city visibility, actual proximity/floor/wall checks and finite bodies', async () => {
  const h = await harness(), room = h.enhanceRoom(h.buildRoom(roomArgs(h)));
  const upstairs = { ...room, id: 'flat', floorY: 3.4, bounds: { ...room.bounds, minY: 3.15, maxY: 6.6 },
    category: 'home', staff: { spawn: [428, 3.4, -2], yaw: 0, role: 'resident', name: 'Yui', placeId: 'tokyo-apartments' } };
  const hiddenCity = { ...room, id: 'shanghai-cafe-room', city: 'shanghai', staff: { ...room.staff, spawn: [700, 0, 0] } };
  const groups = { tokyo: new h.THREE.Group(), shanghai: new h.THREE.Group() };
  Object.values(groups).forEach(group => h.G.scene.add(group));
  const api = h.createOccupants([room, { ...room }, upstairs, hiddenCity], { groups });
  assert.equal(api.actors.length, 3, 'no duplicate actor for duplicate descriptor');
  const p = room.staff.spawn, position = { x: p[0] + 1, y: p[1], z: p[2] };
  api.update({ city: 'tokyo', position, hour: 23, dt: 1 / 60, time: 2 });
  const actor = api.nearest({ city: 'tokyo', position, roomId: room.id });
  assert.equal(actor.name, 'Aoi'); assert.ok(Math.abs(actor.distance - 1) < 1e-9);
  assert.equal(actor.character.root.parent, groups.tokyo);
  assert.ok(countMeshes(actor.character.root) > 20, 'real chibi body, face, hair and role details');
  assert.equal(api.nearest({ city: 'tokyo', position: { ...position, x: position.x + 6 }, roomId: room.id }), null);
  assert.equal(api.nearest({ city: 'tokyo', position: { ...position, y: 3.4 }, roomId: room.id }), null);
  assert.equal(api.nearest({ city: 'tokyo', position, roomId: upstairs.id }), null);
  assert.equal(api.nearest({ city: 'shanghai', position, roomId: room.id }), null);
  const barrier = { minX: p[0] + 0.4, maxX: p[0] + 0.5, minZ: p[2] - 1, maxZ: p[2] + 1, minY: 0, maxY: 2.5 };
  h.G.colliders.push(barrier);
  assert.equal(api.nearest({ city: 'tokyo', position, roomId: room.id }), null, 'not through wall');
  h.G.colliders.pop();
  const resident = api.actors.find(a => a.roomId === 'flat');
  assert.equal(resident.placeId, 'tokyo-apartments');
  resident.character.body.position.y = 123;
  resident.character.face.key = 'not animated';
  api.update({ city: 'shanghai', position: { x: 700, y: 0, z: 1 }, dt: 0.1, time: 5 });
  assert.equal(actor.character.root.visible, false);
  assert.equal(resident.character.body.position.y, 123, 'hidden city body not animated');
  assert.equal(resident.character.face.key, 'not animated', 'hidden city face not painted');
  assert.equal(api.colliders('tokyo').length, 0);
  const boxes = api.colliders('shanghai'); assert.equal(boxes.length, 1);
  assert.ok(Number.isFinite(boxes[0].minY) && boxes[0].maxY === boxes[0].minY + 1.85);
  assert.equal(h.G.scene.children.some(child => child.isLight), false);
});

test('upper residents follow stack cutaway visibility and restore outside', async () => {
  const h = await harness();
  const rooms = [0, 1, 2].map(level => ({
    id: `home-${level}`, city: 'tokyo', category: 'home', buildingId: 'home', level, floorY: level * 3.4,
    bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: level * 3.4 - 0.025, maxY: level * 3.4 + 3.374 },
    staff: { spawn: [2, level * 3.4, 0], role: 'resident' },
  }));
  const api = h.createOccupants(rooms);
  const visible = () => Array.from(api.actors, a => a.character.root.visible);
  api.update({ city: 'tokyo', position: { x: 0, y: 0, z: 0 } });
  assert.deepEqual(visible(), [true, false, false]);
  assert.equal(api.colliders('tokyo').length, 1);
  api.update({ city: 'tokyo', position: { x: 0, y: 3.4, z: 0 } });
  assert.deepEqual(visible(), [true, true, false]);
  api.update({ city: 'tokyo', position: { x: 0, y: 6.8, z: 0 } });
  assert.deepEqual(visible(), [true, true, true]);
  api.update({ city: 'tokyo', position: { x: 10, y: 0, z: 0 } });
  assert.deepEqual(visible(), [true, true, true]);
});

test('optional explicit availability supports overnight hours', async () => {
  const h = await harness(), room = h.enhanceRoom(h.buildRoom(roomArgs(h)));
  room.staff.hours = [20, 6];
  const api = h.createOccupants([room]);
  const [x, y, z] = room.staff.spawn, position = { x, y, z };
  api.update({ city: 'tokyo', position, hour: 12 }); assert.equal(api.colliders('tokyo').length, 0);
  api.update({ city: 'tokyo', position, hour: 23 }); assert.equal(api.colliders('tokyo').length, 1);
  api.update({ city: 'tokyo', position, hour: 5 }); assert.equal(api.colliders('tokyo').length, 1);
  api.update({ city: 'tokyo', position, hour: 6 }); assert.equal(api.colliders('tokyo').length, 0);
});

test('stack cutaways hide every upper structure/prop; standing/lower slabs and outside restore, Reflector untouched', async () => {
  const h = await harness();
  const make = (level, buildingId = 'stack') => {
    const y = level * 3.4;
    const wall = h.box(8, 3, 0.2, h.mat('#aaa'), 0, y, -4);
    const slab = h.box(8, 0.2, 8, h.mat('#555'), 0, y + 3.2, 0);
    const prop = h.box(1, 1, 1, h.mat('#b75'), 2, y, 0);
    const room = { id: `${buildingId}-${level}`, city: 'tokyo', category: 'home', buildingId, level,
      floorY: y, bounds: { minX: -4, maxX: 4, minZ: -4, maxZ: 4, minY: y - 0.1, maxY: y + 3.1 },
      walls: [wall], roofs: [slab], occluders: [prop] };
    h.registerInterior(room); return room;
  };
  const rooms = [make(0), make(1), make(2)];
  const standalone = make(2, 'elsewhere');
  const reflector = new h.THREE.Mesh(new h.THREE.PlaneGeometry(1, 1), h.mat('#abc'));
  reflector.isReflector = true; rooms[0].walls.push(reflector); h.G.scene.add(reflector);
  reflector.userData.cutawaySide = 3;
  const original = reflector.material; h.registerInterior(rooms[0]);
  const shared = h.nightGlow(h.mat('#abc', { emissive: '#abc' }), 0.1, 0.8);
  const sameMaterialOutside = h.box(1, 1, 1, shared, 40, 0, 40);
  const glowingWall = h.box(1, 1, 1, shared, 3.9, 0, 0);
  rooms[0].walls.push(glowingWall); h.registerInterior(rooms[0]);
  assert.notEqual(glowingWall.material, shared, 'cutaway material isolated from city props');
  assert.ok(h.G.nightMats.some(record => record.m === glowingWall.material), 'day/night follows cloned material');
  const material = rooms[1].walls[0].material;
  const count = h.G.nightMats.length;
  h.registerInterior({ ...rooms[1] });
  assert.equal(rooms[1].walls[0].material, material); assert.equal(h.G.nightMats.length, count);
  h.updateCutaways({ x: 0, y: 0, z: 0 }, { x: 1, y: 5, z: 6 }, 1, 'tokyo');
  for (const room of rooms.slice(1)) for (const mesh of [...room.walls, ...room.roofs, ...room.occluders]) {
    assert.equal(mesh.visible, false); assert.equal(h.isCameraOccluder(mesh), false);
  }
  assert.equal(rooms[0].occluders[0].visible, true); assert.equal(rooms[0].occluders[0].material.opacity, 1);
  assert.equal(standalone.roofs[0].visible, true);
  assert.equal(reflector.visible, false); assert.equal(reflector.material, original);
  assert.equal(sameMaterialOutside.material.opacity, 1); assert.equal(shared.transparent, false);
  h.updateCutaways({ x: 0, y: 3.4, z: 0 }, { x: 1, y: 8, z: 6 }, 1 / 60, 'tokyo');
  assert.equal(rooms[0].roofs[0].visible, true); assert.equal(rooms[0].roofs[0].material.opacity, 1, 'standing slab immediately opaque');
  assert.equal(rooms[1].occluders[0].visible, true);
  h.updateCutaways({ x: 30, y: 0, z: 30 }, { x: 30, y: 5, z: 35 }, 2, 'tokyo');
  for (const room of rooms) for (const mesh of [...room.walls, ...room.roofs, ...room.occluders]) {
    assert.equal(mesh.visible, true); assert.equal(mesh.material.opacity, 1);
    assert.equal(mesh.material.transparent, false); assert.equal(mesh.material.depthWrite, true);
  }
  assert.equal(reflector.material, original);
  // A replacement descriptor releases stale state rather than fading old roots.
  h.updateCutaways({ x: 0, y: 0, z: 0 }, { x: 1, y: 5, z: 6 }, 1, 'tokyo');
  const oldWall = rooms[2].walls[0];
  h.registerInterior({ ...rooms[2], walls: [], roofs: [], occluders: [] });
  assert.equal(oldWall.visible, true); assert.equal(oldWall.material.opacity, 1);
});

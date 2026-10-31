// Actual source/Three geometry, with no-op canvas paint and no WebGL. Not browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { createTraversal, stepTraversal, bodyOverlaps } from '../apps/client/public/cozy/js/traversal.js';

async function scene(cityId) {
  assert.ok(process.env.COZY_THREE_MODULE && process.env.COZY_THREE_UTILS && process.env.COZY_REFLECTOR_MODULE,
    'Supply existing pinned Three/BufferGeometryUtils/Reflector modules; no installs.');
  const gradient = () => ({ addColorStop() {} });
  const canvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({
    createLinearGradient: gradient, createRadialGradient: gradient, measureText: s => ({ width: s.length * 10 }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  }, { get: (target, key) => target[key] ?? (() => {}) }) });
  const context = vm.createContext({ console, document: { createElement: canvas,
    createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_v) {} }) },
    Path2D: class { constructor() { return new Proxy({}, { get: () => () => {} }); } } });
  const modules = new Map();
  async function load(path) {
    path = resolve(path);
    if (modules.has(path)) return modules.get(path);
    const m = new vm.SourceTextModule(readFileSync(path, 'utf8'), { context, identifier: path }); modules.set(path, m);
    await m.link((name, parent) => load(name === 'three' ? process.env.COZY_THREE_MODULE :
      name === 'three/addons/utils/BufferGeometryUtils.js' ? process.env.COZY_THREE_UTILS :
      name === 'three/addons/objects/Reflector.js' ? process.env.COZY_REFLECTOR_MODULE : resolve(dirname(parent.identifier), name)));
    return m;
  }
  const root = resolve('apps/client/public/cozy/js');
  const native = await load(resolve(root, `cities/${cityId}.js`));
  const homes = await load(resolve(root, 'apartments.js'));
  const staff = await load(resolve(root, 'occupants.js'));
  const world = cityId === 'seoul' ? await load(resolve(root, 'world.js')) : null;
  const sky = cityId === 'seoul' ? await load(resolve(root, 'sky.js')) : null;
  await native.evaluate(); await homes.evaluate(); await staff.evaluate(); if (world) await world.evaluate(); if (sky) await sky.evaluate();
  const THREE = (await load(process.env.COZY_THREE_MODULE)).namespace;
  const { G } = (await load(resolve(root, 'util.js'))).namespace;
  const rooms = (await load(resolve(root, 'interiors.js'))).namespace;
  G.scene = new THREE.Scene();
  if (world) world.namespace.buildWorld();
  const city = native.namespace.default; city.build();
  const nativeSolids = [...G.colliders];
  const places = [...(world ? world.namespace.PLACES : []), ...city.places];
  const authored = rooms.interiors.filter(r => !r.layout).map(r => [r, r.staff]);
  for (const r of rooms.interiors.filter(r => r.city === cityId && r.layout)) {
    rooms.enhanceRoom(r); const place = places.find(p => p.interiorId === r.id);
    if (r.staff && place) r.staff.placeId = place.id;
  }
  for (const [r, original] of authored) assert.equal(r.staff, original, 'authored Seoul cast not replaced');
  const b = homes.namespace.buildApartment(city.home);
  const occupants = staff.namespace.createOccupants(rooms.interiors);
  const heightAt = (x,z,y) => homes.namespace.apartmentHeightAt(x,z,y,cityId) ?? 0;
  const ceilingAt = (x,z,y) => homes.namespace.apartmentCeilingAt(x,z,y,cityId) ?? rooms.interiorAt({x,y,z},cityId)?.ceilingAt?.(x,z,y);
  return { G, THREE, sky: sky?.namespace, world: world?.namespace, homeApi: homes.namespace, city, b, occupants, rooms, places, nativeSolids, heightAt, ceilingAt };
}

function checkBoardGuide({ G, city }) {
  const views = Array.from(city.vistas), view = views.find(v => v.id === 'seoul-board-art');
  assert.ok(view, 'actual ordinary world-art Guide entry exists');
  assert.deepEqual(views.filter(v => v.kind !== 'artwork').map(v => v.id), ['seoul-hangang', 'seoul-namsan']);
  assert.equal(view.kind, 'artwork'); assert.equal(view.fov, 55);
  let poster; G.scene.traverse(m => { if (m.userData.artworkId === view.id) poster = m; });
  assert.ok(poster?.isMesh, 'view points to actual authored world poster, not a replacement UI image');
  assert.equal(poster.geometry.parameters.width, 2.16); assert.equal(poster.geometry.parameters.height, 3.84);
  const main = readFileSync(resolve('apps/client/public/cozy/js/main.js'), 'utf8');
  const fn = name => { const start = main.indexOf(`function ${name}(`); assert.ok(start >= 0); return main.slice(start, main.indexOf('\n}', start) + 2); };
  const node = () => ({ children: [], appendChild(n) { this.children.push(n); }, replaceChildren() { this.children = []; } });
  const list = node(), tools = { hidden: false, classList: { add(value) { if (value === 'hidden') tools.hidden = true; } } };
  const S = { city: 'seoul', started: true, storySentinel: 7 }, player = { root: { position: { x: 4, y: 0, z: 35 } } }, cam = {};
  const before = JSON.stringify({ S, player }); let focused = false;
  const context = { S, player, cam, currentCity: () => city, cityPlaces: () => [], adventure: () => ({}),
    $: id => id === 'location-list' ? list : id === 'tools-panel' ? tools : null,
    document: { createElement: node }, clearControls() {}, actionsAllowed: () => tools.hidden && S.started,
    updateCameraButtons() {}, banner() {}, canvas: { focus() { focused = true; } } };
  const api = new Function(...Object.keys(context), `let vistaIndex = -1, overview = true; ${['populateLocations', 'resetCamera', 'followCamera'].map(fn).join('\n')} return { populateLocations, resetCamera, get index() { return vistaIndex; }, get overview() { return overview; } };`)(...Object.values(context));
  api.populateLocations();
  const button = list.children.flatMap(n => n.children).find(n => n.textContent?.includes(view.title));
  assert.ok(button && button.textContent.includes('Camera only'));
  const originalLink = list.children.flatMap(n => n.children).find(n => n.href);
  assert.ok(originalLink, 'supplemental full-resolution original is keyboard-accessible beside the world view');
  assert.equal(originalLink.href, '/assets/locations/seoul-static.png');
  assert.equal(originalLink.href, view.artworkHref); assert.equal(originalLink.target, '_blank');
  assert.ok(originalLink.rel.split(' ').includes('noopener'));
  button.onclick(); // Actual runtime callback; DOM adapters only, not a selector stub.
  assert.equal(api.index, views.indexOf(view)); assert.equal(api.overview, false); assert.equal(cam.snap, true); assert.equal(focused, true);
  assert.equal(JSON.stringify({ S, player }), before, 'selection cannot teleport or alter story/city');
  api.resetCamera(); assert.equal(api.index, -1); assert.equal(api.overview, false);
  assert.equal(cam.yaw, city.yaw); assert.equal(cam.pitch, .36); assert.equal(cam.dist, 6.5);
}

function checkTentLight({ G, THREE, world, sky }) {
  const lamp = G.nightLights.find(({ light }) => light.position.x === world.TX && light.position.y === 2.35 && light.position.z === -.3);
  assert.ok(lamp, 'actual authored tent emitter is registered');
  assert.equal(lamp.day, 2); assert.equal(lamp.night, 4);
  assert.equal(lamp.light.color.getHex(), 0xffb066);
  assert.equal(lamp.light.distance, 14); assert.equal(lamp.light.decay, 2);
  const cycle = new sky.DayNight(), focus = new THREE.Vector3(), camera = new THREE.PerspectiveCamera();
  for (const [hour, expected] of [[12, 2], [18.5, 3.1], [20.5, 3.922222222222222], [0, 4], [12, 2]]) {
    cycle.update(hour, 0, focus, camera);
    assert.ok(Math.abs(lamp.light.intensity - expected) < 1e-10, `actual day/night update at ${hour}`);
  }
  // This checks local configuration/interpolation, NOT visual improvement.
}

function checkTentEntry(h) {
  const { G, THREE, world, homeApi, rooms, city } = h, { TX, TENT } = world;
  const source = readFileSync(resolve('apps/client/public/cozy/js/main.js'), 'utf8');
  const start = source.indexOf('function ceilingAt('), text = source.slice(start, source.indexOf('\n}', start) + 2);
  const runtimeCeiling = new Function('apartmentCeilingAt', 'apartmentZoneAt', 'S', 'interiorAt', 'interiors', `${text}; return ceilingAt;`)(homeApi.apartmentCeilingAt, homeApi.apartmentZoneAt, { city: 'seoul' }, rooms.interiorAt, rooms.interiors);
  world.setTentOpen(true);
  const env = { heightAt: world.heightAt, ceilingAt: runtimeCeiling, colliders: G.colliders, bounds: city.bounds, allowDrop: () => true };
  const p = { x: TX, y: 0, z: TENT.maxZ + .8 }, state = createTraversal();
  for (let i = 0; i < 480 && p.z > TENT.maxZ - .9; i++) stepTraversal(state, p, { x: 0, z: -1 }, env, 1 / 120);
  const headers = G.scene.children.filter(m => m.isMesh).map(m => new THREE.Box3().setFromObject(m)).filter(b =>
    b.max.x - b.min.x > 4 && b.max.x - b.min.x < 4.6 && b.min.y > 1 && b.max.y <= TENT.wallH + .001 && b.min.z >= TENT.maxZ - .201 && b.max.z <= TENT.maxZ + .101);
  const visualClearance = Math.min(...headers.map(b => b.min.y)), logicalClearance = runtimeCeiling(TX, TENT.maxZ - .05, 0);
  console.log(JSON.stringify({ tent: { openWalkZ: p.z, visualClearance, logicalClearance, playerClearance: 1.9, headerPieces: headers.length } }));
  assert.ok(p.z < TENT.maxZ - .8, 'actual runtime ceiling/physics must allow normal night doorway entry');
  assert.ok(headers.length >= 3, 'real tarp header, roller and painted valance measured');
  assert.ok(visualClearance >= 2, 'visible opening clears the full player, not a collision bypass');
  assert.ok(Math.abs(visualClearance - logicalClearance) < 1e-5, 'physical ceiling matches lowest visible header component');
  const roller = G.scene.children.find(m => m.isMesh && m.geometry.type === 'CylinderGeometry' && Math.abs(m.geometry.parameters.height - 4.4) < .01 && Math.abs(m.position.x - TX) < .01 && Math.abs(m.position.y - logicalClearance - .075) < .01);
  assert.ok(roller && new THREE.Box3().setFromObject(roller).max.z < TENT.maxZ, 'raised roll stays behind the painted valance, not over its lettering');
  world.setTentOpen(false); env.colliders = G.colliders;
  Object.assign(p, { x: TX, y: 0, z: TENT.maxZ + .8 }); const closed = createTraversal();
  for (let i = 0; i < 240; i++) stepTraversal(closed, p, { x: 0, z: -1 }, env, 1 / 120);
  assert.ok(p.z > TENT.maxZ + .25, 'closed daytime flap remains physically blocking');
}

for (const cityId of ['seoul', 'tokyo', 'shanghai']) test(`${cityId}: actual plot, every generic staffed room, both apartment floors and physical exit`, async (t) => {
  const h = await scene(cityId), { G, city, b, occupants, rooms, places } = h;
  if (cityId === 'seoul') {
    await t.test('actual artwork Guide callback is camera-only and preserves named landmarks / reset', () => checkBoardGuide(h));
    await t.test('authored tent visible header and actual runtime ceiling permit night entry, retain closed flap', () => checkTentEntry(h));
    await t.test('local tent calibration preserves noon and the actual day/night update path', () => checkTentLight(h));
  }
  assert.equal(places.filter(p => p.category === 'home').length, 1);
  for (const category of ['food','cafe','store','subway','studio']) assert.ok(places.some(p => p.category === category), category);
  assert.ok(b.bounds.minX > city.bounds.minX && b.bounds.maxX < city.bounds.maxX && b.bounds.minZ > city.bounds.minZ && b.bounds.maxZ < city.bounds.maxZ);
  assert.equal(h.nativeSolids.filter(c => c.minX < b.bounds.maxX && c.maxX > b.bounds.minX && c.minZ < b.bounds.maxZ && c.maxZ > b.bounds.minZ).length, 0, 'home does not cover native building/tree/route blockers');
  const home = places.find(p => p.id === b.id); assert.ok(home);
  assert.ok(Math.hypot(home.entry[0]-b.entry[0],home.entry[2]-b.entry[2])<.01);
  const env = { heightAt:h.heightAt, ceilingAt:h.ceilingAt, colliders:[], bounds:city.bounds, allowDrop:()=>true };
  function walk(p, targets) {
    const state=createTraversal();
    for(const target of targets){let steps=0;
      while(Math.hypot(target.x-p.x,target.z-p.z)>.035&&steps++<3600){
        occupants.update({city:cityId,position:p,hour:12}); env.colliders=[...G.colliders,...occupants.colliders(cityId)];
        const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),m=Math.min(1,d*3);
        stepTraversal(state,p,{x:dx/d*m,z:dz/d*m},env,1/120);
      }
      assert.ok(steps<3600,JSON.stringify({cityId,p,target}));
      assert.ok(Math.abs(p.y-(target.y??0))<.09,`correct support ${target.kind}`);
      assert.ok(!env.colliders.some(c=>bodyOverlaps(p.x,p.y,p.z,.3,c)),'no body penetration');
    }
  }
  for(const room of rooms.interiors.filter(r=>r.layout&&r.city===cityId)){
    assert.ok(room.staff&&room.enhanced&&room.furniture.length>5);
    assert.ok(places.some(p=>p.id===room.staff.placeId&&p.interiorId===room.id));
    const c=room.center,door=room.door,d=Math.hypot(door[0]-c[0],door[2]-c[2]),nx=(door[0]-c[0])/d,nz=(door[2]-c[2])/d;
    const p={x:door[0]+nx*.8,y:room.floorY,z:door[2]+nz*.8};
    const target={x:room.staff.spawn[0]+nx*1.1,y:room.floorY,z:room.staff.spawn[2]+nz*1.1};
    walk(p,[target]); occupants.update({city:cityId,position:p,hour:12});
    assert.equal(occupants.nearest({city:cityId,position:p,roomId:room.id})?.roomId,room.id,'actual staff approachable');
  }
  const start=b.route[0],p={x:start.x,y:start.y,z:start.z}; walk(p,b.route.slice(1));
  assert.equal(p.y,0); assert.ok(b.rooms.every(r=>r.staff&&r.furniture.length));
});

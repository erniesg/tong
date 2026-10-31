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
  await native.evaluate(); await homes.evaluate(); await staff.evaluate(); if (world) await world.evaluate();
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
  return { G, city, b, occupants, rooms, places, nativeSolids, heightAt, ceilingAt };
}

for (const cityId of ['seoul', 'tokyo', 'shanghai']) test(`${cityId}: actual plot, every generic staffed room, both apartment floors and physical exit`, async () => {
  const h = await scene(cityId), { G, city, b, occupants, rooms, places } = h;
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

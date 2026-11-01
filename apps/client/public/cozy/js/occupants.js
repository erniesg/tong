// Opt-in city-local staff; legacy Seoul actors/story remain runtime-owned.
import * as THREE from 'three';
import { G, add, mat, seeded } from './util.js';
import { makeAjusshi, makeBarista, makeCashier, makePedestrian, animate, lookAtYaw } from './characters.js';

function seedOf(text) {
  let seed = 2166136261;
  for (const ch of text) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return seed >>> 0;
}

// Slab intersection along the hands/eye-height segment prevents selecting a
// resident through a partition even when both positions share one descriptor.
function obstructed(a, b) {
  return G.colliders.some(box => {
    let enter = 0, exit = 1;
    for (const [axis, min, max] of [['x', box.minX, box.maxX], ['y', box.minY ?? -Infinity, box.maxY ?? Infinity], ['z', box.minZ, box.maxZ]]) {
      const start = a[axis] + (axis === 'y' ? 1 : 0), delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) { if (start < min || start > max) return false; continue; }
      const t1 = (min - start) / delta, t2 = (max - start) / delta;
      enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
      if (enter > exit) return false;
    }
    return exit > 0 && enter < 1;
  });
}

function roleDetails(character, role, city) {
  const cream = mat('#fff0d8'), metal = mat('#d9be71', { metalness: 0.5, roughness: 0.3 });
  const uniform = mat(city === 'tokyo' ? '#436359' : city === 'shanghai' ? '#8a4640' : '#3f6080');
  // Name badge visible on the front of the real chibi, not a floating icon.
  add(new THREE.BoxGeometry(0.11, 0.06, 0.018), cream, -0.09, 0.98, 0.22, character.body, false);
  if (role === 'attendant' || role === 'concierge') {
    add(new THREE.CylinderGeometry(0.34, 0.35, 0.11, 16), uniform, 0, 0.24, 0, character.head);
    add(new THREE.BoxGeometry(0.39, 0.035, 0.22), uniform, 0, 0.19, 0.26, character.head);
    add(new THREE.SphereGeometry(0.045, 8, 6), metal, 0, 0.24, 0.34, character.head, false);
  } else if (role === 'instructor') {
    const band = add(new THREE.TorusGeometry(0.34, 0.025, 6, 20, Math.PI), uniform, 0, 0.02, 0, character.head);
    band.rotation.z = 0;
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.09, 0.15, 0.11), uniform, side * 0.34, 0.01, 0, character.head);
    add(new THREE.BoxGeometry(0.18, 0.24, 0.035), uniform, 0.25, -0.24, 0.1, character.arms[0]);
  } else if (role === 'resident') {
    const ring = add(new THREE.TorusGeometry(0.045, 0.009, 5, 12), metal, 0, -0.39, 0.075, character.arms[1], false);
    add(new THREE.BoxGeometry(0.015, 0.09, 0.015), metal, 0, -0.075, 0, ring, false);
  } else if (role === 'barista' || role === 'vendor') {
    add(new THREE.BoxGeometry(0.12, 0.13, 0.018), uniform, 0, 0.71, 0.235, character.body, false);
  }
}

/** Returns stable actors plus actual-range selection/finite-height collisions.
 * Availability defaults to all hours: these demo shops never show an empty
 * counter merely because the user's saved clock happens to be late at night.
 * Optional staff.hours=[open,close] may be used by explicitly scheduled homes. */
export function createOccupants(rooms, { groups = {} } = {}) {
  const actors = [], descriptors = new Map();
  // A city builder may re-register the same descriptor. Last descriptor wins.
  for (const room of rooms) descriptors.set(room.id, room);
  for (const room of descriptors.values()) {
    if (!room.staff) continue;
    const staff = room.staff, seed = seedOf(`${room.city}:${room.id}:${staff.role}`);
    const character = staff.role === 'barista' ? makeBarista() : staff.role === 'vendor' ? makeAjusshi() :
      ['clerk', 'attendant', 'concierge'].includes(staff.role) ? makeCashier() : makePedestrian(seed);
    character.name = staff.name ?? `${room.city} ${staff.role}`;
    character.root.name = `occupant:${room.id}`;
    character.root.position.set(...staff.spawn);
    character.root.rotation.y = staff.yaw ?? 0;
    character.blinkT = 2 + seeded(seed)() * 2;
    character.expr = character.baseExpr = 'smile';
    roleDetails(character, staff.role, room.city);
    (groups[room.city] ?? G.scene).attach(character.root);
    // The first update establishes active city/availability before rendering.
    character.root.visible = false;
    const actor = { character, roomId: room.id, city: room.city, role: staff.role,
      name: character.name, greeting: staff.greeting ?? 'Ready to practise your local phrase?',
      placeId: staff.placeId ?? room.interiorId ?? room.category, spawn: [...staff.spawn] };
    actors.push(actor);
  }
  function isAvailable(actor, hour) {
    const hours = descriptors.get(actor.roomId).staff.hours;
    if (!hours || hours[0] === hours[1]) return true;
    const h = ((hour % 24) + 24) % 24;
    return hours[0] < hours[1] ? h >= hours[0] && h < hours[1] : h >= hours[0] || h < hours[1];
  }
  function update({ city, position, hour = 12, dt = 0, time = 0 }) {
    const occupied = [...descriptors.values()].find(room => {
      const b = room.bounds;
      return room.city === city && position.x > b.minX && position.x < b.maxX &&
        position.z > b.minZ && position.z < b.maxZ &&
        position.y >= (b.minY ?? room.floorY - 0.25) && position.y <= (b.maxY ?? room.floorY + 3.5);
    });
    for (const actor of actors) {
      const ch = actor.character, room = descriptors.get(actor.roomId);
      // Residents must not float over a cut-away lower flat after their floor,
      // furniture and walls have been hidden by the building's stack cutaway.
      const above = occupied?.buildingId && room.buildingId === occupied.buildingId && room.level > occupied.level;
      ch.root.visible = actor.city === city && isAvailable(actor, hour) && !above;
      if (!ch.root.visible) continue;
      const p = ch.root.position;
      const distance = Math.hypot(p.x - position.x, p.y - position.y, p.z - position.z);
      if (distance > 18 || Math.abs(p.y - position.y) > 3) continue;
      const phase = seeded(seedOf(actor.roomId))() * 4.3;
      const t = time + phase;
      // Set the blink phase before animate so it never requests random timing.
      ch.blinkT = t % 4.3 > 4.18 ? -0.01 : 1;
      ch.blinking = false;
      if (distance < 4 && Math.abs(p.y - position.y) < 0.65) lookAtYaw(ch, position, 0.7);
      else ch.lookYaw = Math.sin(t * 0.6) * 0.12;
      animate(ch, Math.min(0.08, Math.max(0, dt)), t, 0);
    }
  }
  function nearest({ city, position, roomId, maxDistance = 2.8 }) {
    const room = descriptors.get(roomId);
    if (!room || room.city !== city) return null;
    const b = room.bounds;
    if (position.x <= b.minX || position.x >= b.maxX || position.z <= b.minZ || position.z >= b.maxZ ||
      position.y < (b.minY ?? room.floorY - 0.25) || position.y > (b.maxY ?? room.floorY + 3.5)) return null;
    let best = null, range = maxDistance;
    for (const actor of actors) {
      if (actor.city !== city || actor.roomId !== roomId || !actor.character.root.visible) continue;
      const p = actor.character.root.position;
      if (Math.abs(position.y - p.y) > 0.65) continue;
      const distance = Math.hypot(position.x - p.x, position.y - p.y, position.z - p.z);
      if (distance <= range && !obstructed(position, p)) { best = { ...actor, distance }; range = distance; }
    }
    return best;
  }
  function colliders(city) {
    return actors.filter(actor => actor.city === city && actor.character.root.visible).map(actor => {
      const p = actor.character.root.position, radius = 0.32;
      return { minX: p.x - radius, maxX: p.x + radius, minZ: p.z - radius, maxZ: p.z + radius,
        minY: p.y, maxY: p.y + 1.85, roomId: actor.roomId, interiorId: actor.roomId, role: actor.role };
    });
  }
  return { actors, update, nearest, colliders };
}

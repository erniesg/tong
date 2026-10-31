// Rooms keep their physical walls/colliders when the camera cuts them away.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, box, mat, nightGlow } from './util.js';

export const interiors = [];
const states = new Map();
const box3 = new THREE.Box3();
const center = new THREE.Vector3();

function restoreState(mesh, state) {
  if (state.wasHidden) mesh.visible = state.restoreVisible;
  for (const { m, opacity, transparent, depthWrite } of state.materials ?? []) {
    m.opacity = opacity;
    if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
    m.depthWrite = depthWrite;
  }
  state.amount = 0;
  state.wasHidden = false;
  mesh.userData.cutawayHidden = state.root.userData.cutawayHidden = false;
}

export function registerInterior(descriptor) {
  const previous = interiors.findIndex(room => room.id === descriptor.id);
  if (previous !== -1) interiors.splice(previous, 1);
  interiors.push(descriptor);
  const roots = [...descriptor.walls, ...descriptor.roofs, ...(descriptor.occluders ?? [])];
  const retained = new Set();
  for (const root of roots) {
    root.traverse(mesh => retained.add(mesh));
  }
  // Replacing a descriptor must neither retain stale cutaways nor clone the
  // same live day/night materials again when cities re-register their rooms.
  for (const [mesh, state] of states) {
    if (state.room.id !== descriptor.id || retained.has(mesh)) continue;
    restoreState(mesh, state);
    if (!state.reflector) {
      mesh.material = state.originalMaterial;
      const clones = new Set(state.materials.map(record => record.m));
      G.nightMats = G.nightMats.filter(record => !clones.has(record.m));
      state.materials.forEach(({ m }) => m.dispose());
    }
    states.delete(mesh);
  }
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse(mesh => {
      if (!mesh.isMesh && !mesh.isLine) return;
      const stackOnly = !descriptor.walls.includes(root) && !descriptor.roofs.includes(root);
      if (states.has(mesh)) {
        Object.assign(states.get(mesh), { room: descriptor, root, roof: descriptor.roofs.includes(root), stackOnly });
        return;
      }
      // Reflector owns live render-target/matrix uniforms. Cloning them breaks
      // reflection, and its shader does not use Material.opacity. Hide only
      // this decorative surface during a cutaway; ordinary walls still fade.
      if (mesh.isReflector) {
        mesh.userData.interiorId = descriptor.id;
        states.set(mesh, { room: descriptor, root, roof: descriptor.roofs.includes(root), amount: 0, reflector: true, wasHidden: false, stackOnly });
        return;
      }
      const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = original.map(m => m.clone());
      // Keep the day/night material controller connected to the clones.
      original.forEach((m, i) => {
        for (const record of G.nightMats.filter(r => r.m === m)) G.nightMats.push({ ...record, m: materials[i] });
      });
      const originalMaterial = mesh.material;
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      mesh.userData.interiorId = descriptor.id;
      states.set(mesh, { room: descriptor, root, roof: descriptor.roofs.includes(root), amount: 0,
        originalMaterial, stackOnly, wasHidden: false, materials: materials.map(m => ({ m, opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite })) });
    });
    if (!descriptor.occluders?.includes(root) && !G.blockers.includes(root)) G.blockers.push(root);
  }
  return descriptor;
}

export function interiorAt(position, cityId) {
  return interiors.find(room => {
    const b = room.bounds;
    return room.city === cityId && position.x > b.minX && position.x < b.maxX &&
      position.z > b.minZ && position.z < b.maxZ &&
      position.y >= (b.minY ?? room.floorY - 0.25) && position.y <= (b.maxY ?? room.floorY + 3.5);
  }) ?? null;
}

export function updateCutaways(playerPosition, cameraPosition, dt, cityId) {
  const active = interiorAt(playerPosition, cityId);
  const k = 1 - Math.exp(-12 * Math.max(0, dt));
  const facing = new Map();
  for (const [mesh, state] of states) {
    const upper = !!active?.buildingId && state.room.city === cityId &&
      state.room.buildingId === active.buildingId && state.room.level > active.level;
    let hidden = upper;
    if (state.room === active && !state.stackOnly) {
      if (state.roof) hidden = true;
      else {
        if (!facing.has(state.root)) {
          const plane = state.root.userData.cutawayPlane;
          if (plane) {
            // Internal partitions are not necessarily aligned with the nearest
            // exterior side. Fade their actual plane only when it lies between
            // the player and camera; keep walls behind the player intact.
            const fromPlayer = plane.at - playerPosition[plane.axis];
            const toCamera = cameraPosition[plane.axis] - plane.at;
            facing.set(state.root, fromPlayer * toCamera > 0);
          } else {
            box3.setFromObject(state.root).getCenter(center);
            const b = active.bounds;
            const rx = (center.x - (b.minX + b.maxX) / 2) / ((b.maxX - b.minX) / 2);
            const rz = (center.z - (b.minZ + b.maxZ) / 2) / ((b.maxZ - b.minZ) / 2);
            const side = state.root.userData.cutawaySide ?? (Math.abs(rx) > Math.abs(rz) ? (rx < 0 ? 0 : 1) : (rz < 0 ? 2 : 3));
            const dx = cameraPosition.x - playerPosition.x, dz = cameraPosition.z - playerPosition.z;
            facing.set(state.root, [dx < -0.05, dx > 0.05, dz < -0.05, dz > 0.05][side]);
          }
        }
        hidden = facing.get(state.root);
      }
    }
    state.root.userData.cutawayHidden = hidden;
    mesh.userData.cutawayHidden = hidden;
    const lower = !!active?.buildingId && state.room.city === cityId &&
      state.room.buildingId === active.buildingId && state.room.level < active.level;
    if (lower) state.amount = 0; // In particular, the slab under the standing floor.
    else state.amount += ((hidden ? 1 : 0) - state.amount) * k;
    if (Math.abs(state.amount - (hidden ? 1 : 0)) < 0.001) state.amount = hidden ? 1 : 0;
    // Stacked homes must not retain ghost ceiling/partition layers over the
    // occupied room. Fade first, then stop drawing those settled planes (and
    // their shadows). Single-floor rooms keep their existing fade behavior.
    const settledHomeCutaway = !!state.room.buildingId && hidden && state.amount === 1;
    if (state.reflector || upper || settledHomeCutaway || state.wasHidden) {
      const hideMesh = state.reflector ? hidden : upper || settledHomeCutaway;
      if (hideMesh && !state.wasHidden) state.restoreVisible = mesh.visible;
      if (hideMesh) mesh.visible = false;
      else if (state.wasHidden) mesh.visible = state.restoreVisible;
      state.wasHidden = hideMesh;
      if (state.reflector) continue;
    }
    for (const { m, opacity, transparent, depthWrite } of state.materials) {
      m.opacity = opacity * (1 - state.amount * 0.96);
      const fading = state.amount > 0;
      if (m.transparent !== (fading || transparent)) { m.transparent = fading || transparent; m.needsUpdate = true; }
      m.depthWrite = fading ? false : depthWrite;
    }
  }
}

export function isCameraOccluder(mesh) {
  for (let node = mesh; node; node = node.parent) if (node.userData.cutawayHidden) return false;
  return true;
}

export function cutawaySnapshot() {
  return interiors.map(room => ({ id: room.id, city: room.city, category: room.category,
    walls: room.walls.map(root => ({ hidden: !!root.userData.cutawayHidden, visible: root.visible, opacity: (Array.isArray(root.material) ? root.material[0] : root.material)?.opacity })),
    roofs: room.roofs.map(root => ({ hidden: !!root.userData.cutawayHidden, visible: root.visible, opacity: (Array.isArray(root.material) ? root.material[0] : root.material)?.opacity })),
    buildingId: room.buildingId, level: room.level,
    occluders: (room.occluders ?? []).map(root => ({ hidden: !!root.userData.cutawayHidden, visible: root.visible })),
  }));
}

/** Adapt an existing footprint, never a new roadside box. Front is local +z. */
export function buildRoom({ id, city, category, x, z, w, d, h = 3.6, face = 0, wallMaterial, roofMaterial, roofs = [], open = false }) {
  const s = Math.round(Math.sin(face)), c = Math.round(Math.cos(face));
  const fw = s ? d : w, fd = s ? w : d;
  const walls = [], furnishings = [], furniture = [];
  const wood = mat('#a67b51'), dark = mat('#35434a'), cream = mat('#eee0bf');
  const position = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  const piece = (ww, hh, dd, material, u, y, v, solid = false, role = 'furniture') => {
    const [px, pz] = position(u, v);
    const m = box(s ? dd : ww, hh, s ? ww : dd, material, px, y, pz, { collide: solid, block: role === 'wall' });
    m.userData.interiorId = id;
    m.userData.role = role;
    if (role === 'furniture') {
      furnishings.push(m);
      const record = { kind: 'baseline-fixture', position: [px, y, pz], size: [s ? dd : ww, hh, s ? ww : dd] };
      furniture.push(record);
      m.userData.furniture = [record];
    }
    if (solid) Object.assign(G.colliders[G.colliders.length - 1], { interiorId: id, role, minY: y, maxY: y + hh });
    return m;
  };
  piece(fw - 0.2, 0.045, fd - 0.2, wood, 0, -0.005, 0, false, 'floor');
  if (open) {
    for (const u of [-fw / 2 + 0.15, fw / 2 - 0.15]) for (const v of [-fd / 2 + 0.15, fd / 2 - 0.15])
      walls.push(piece(0.2, h, 0.2, wallMaterial, u, 0, v, true, 'wall'));
  } else {
    walls.push(piece(fw, h, 0.22, wallMaterial, 0, 0, -fd / 2, true, 'wall'));
    for (const u of [-fw / 2, fw / 2]) walls.push(piece(0.22, h, fd, wallMaterial, u, 0, 0, true, 'wall'));
    const doorWidth = 2.2, panel = (fw - doorWidth) / 2;
    for (const side of [-1, 1]) walls.push(piece(panel, h, 0.22, wallMaterial, side * (doorWidth / 2 + panel / 2), 0, fd / 2, true, 'wall'));
    walls.push(piece(doorWidth, h - 2.6, 0.22, wallMaterial, 0, 2.6, fd / 2, false, 'wall'));
  }
  if (!roofs.length) roofs.push(piece(fw + 0.5, 0.2, fd + 0.5, roofMaterial, 0, h, 0, false, 'roof'));
  // Keep a central 2.2m aisle from the doorway to the back of every room.
  if (category === 'store') {
    for (const side of [-1, 1]) {
      const u = side * (fw / 2 - 0.6);
      // Open bays: back/end panels and real ledges, not a solid case that
      // encloses every product. Ledges retain the shelf's physical boundary.
      piece(0.08, 2.1, fd - 1.4, cream, u + side * 0.285, 0, 0, true);
      for (const end of [-1, 1]) piece(0.65, 2.1, 0.08, cream, u, 0, end * (fd / 2 - 0.7), true);
      for (let level = 0; level < 4; level++) {
        piece(0.8, 0.06, fd - 1.3, dark, u, 0.35 + level * 0.48, 0, true);
        for (let row = 0; row < 7; row++) piece(0.3, 0.28, 0.32, row % 2 ? wood : cream, side * (fw / 2 - 0.6), 0.4 + level * 0.48, -fd / 2 + 1 + row * (fd - 2) / 7);
      }
    }
    piece(1.2, 0.95, 0.7, dark, -fw / 2 + 1.4, 0, fd / 2 - 1.4, true);
    piece(0.35, 0.28, 0.3, cream, -fw / 2 + 1.4, 0.95, fd / 2 - 1.4);
  } else if (category === 'studio') {
    const mirror = mat('#b9d2d8', { metalness: 0.85, roughness: 0.12 });
    // Mirror faces the room; it is part of the rear wall cutaway, not a floating pane.
    const pane = piece(fw - 1.1, 2.2, 0.05, mirror, 0, 0.55, -fd / 2 + 0.14);
    walls[0].attach(pane);
    for (const side of [-1, 1]) {
      piece(0.65, 1.1, 0.6, dark, side * (fw / 2 - 0.7), 0, -fd / 2 + 0.8, true);
      piece(0.4, 0.55, 0.07, cream, side * (fw / 2 - 0.7), 0.3, -fd / 2 + 1.14);
    }
    piece(fw - 1.4, 0.07, 0.12, wood, 0, 1.05, -fd / 2 + 0.45);
    piece(1.3, 0.12, 0.35, dark, fw / 2 - 1.1, 0.9, 0, true);
    piece(0.06, 0.9, 0.06, dark, fw / 2 - 1.1, 0, 0);
  } else if (category === 'subway') {
    for (const side of [-1, 1]) {
      piece(0.65, 0.48, fd - 1.4, wood, side * (fw / 2 - 0.7), 0, 0, true);
      piece(0.1, 0.6, fd - 1.4, dark, side * (fw / 2 - 0.96), 0.48, 0);
    }
    piece(1.0, 1.7, 0.5, dark, -fw / 2 + 1.1, 0, -fd / 2 + 0.6, true);
    piece(0.7, 0.6, 0.06, mirrorMaterial(), -fw / 2 + 1.1, 0.9, -fd / 2 + 0.89);
  } else {
    piece(fw - 1.5, 0.95, 0.75, wood, 0, 0, -fd / 2 + 1, true);
    if (category === 'food') {
      for (const u of [-0.7, 0.7]) {
        const [px, pz] = position(u, -fd / 2 + 1);
        const steamer = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.28, 16), cream);
        steamer.position.set(px, 1.1, pz); G.scene.add(steamer);
        const record = { kind: 'steamer', position: [px, 0.96, pz], size: [0.7, 0.28, 0.7] };
        furniture.push(record); furnishings.push(steamer);
        Object.assign(steamer.userData, { interiorId: id, role: 'furniture', furniture: [record] });
      }
    } else {
      piece(0.7, 0.5, 0.5, dark, -0.9, 0.95, -fd / 2 + 1);
      for (const side of [-1, 1]) {
        piece(1.0, 0.08, 1.0, wood, side * (fw / 2 - 1.15), 0.74, fd / 2 - 1.6, true);
        piece(0.12, 0.74, 0.12, dark, side * (fw / 2 - 1.15), 0, fd / 2 - 1.6);
        piece(0.55, 0.45, 0.55, cream, side * (fw / 2 - 1.15), 0, fd / 2 - 2.5, true);
      }
    }
  }
  const lamp = nightGlow(mat('#ffe9b8', { emissive: '#ffd59b' }), 0.45, 1.8);
  const fixture = piece(fw - 1, 0.06, 0.2, lamp, 0, h - 0.13, 0);
  roofs[0].attach(fixture);
  // Room contents do not animate/fade: merge by shared material, keeping the
  // mirrored rear-wall child separate. Shelf products cost three draws, not 60.
  const occluders = batchFurniture(furnishings, id);
  const [dx, dz] = position(0, fd / 2);
  return registerInterior({ id, city, category,
    bounds: { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: -0.25, maxY: h },
    // The lamp sits just below the roof; a closed room also has a 2.6m lintel.
    ceilingAt: (px, pz) => {
      const u = c * (px - x) - s * (pz - z), v = s * (px - x) + c * (pz - z);
      return !open && Math.abs(u) < 1.5 && Math.abs(v - fd / 2) < 0.4 ? Math.min(h - 0.15, 2.6) : h - 0.15;
    },
    floorY: 0, center: [x, 0, z], door: [dx, 0, dz], walls, roofs, furniture, occluders,
    layout: { x, z, w, d, face, h } });
}
function mirrorMaterial() { return nightGlow(mat('#b0d5d9', { emissive: '#7ac5dd' }), 0.1, 0.8); }

// Baking world-space copies keeps each room's semantic records and cutaway
// ownership while reducing repeated plates, keys and products to a few draws.
function batchFurniture(meshes, id) {
  G.scene.updateMatrixWorld(true);
  const batches = new Map(), result = [];
  for (const mesh of meshes) {
    if (mesh.parent !== G.scene) continue;
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(mesh);
  }
  for (const [material, items] of batches) {
    if (items.length === 1) { result.push(items[0]); continue; }
    const copies = items.map(m => m.geometry.clone().applyMatrix4(m.matrixWorld));
    const merged = new THREE.Mesh(mergeGeometries(copies), material);
    merged.castShadow = merged.receiveShadow = true;
    Object.assign(merged.userData, { interiorId: id, role: 'furniture', furniture: items.flatMap(m => m.userData.furniture ?? []) });
    G.scene.add(merged);
    result.push(merged);
    for (const m of items) { m.removeFromParent(); m.geometry.dispose(); }
    copies.forEach(g => g.dispose());
  }
  return result;
}

/** Explicit opt-in: the runtime pilots one shop before enabling other rooms.
 * Authored Seoul interiors have no generic layout and are deliberately intact. */
export function enhanceRoom(room) {
  if (!room.layout || room.enhanced || !['cafe', 'food', 'store', 'studio', 'subway'].includes(room.category)) return room;
  const { x, z, w, d, face } = room.layout;
  const s = Math.round(Math.sin(face)), c = Math.round(Math.cos(face));
  const fw = s ? d : w, fd = s ? w : d;
  const floor = room.floorY;
  const world = (u, y, v) => [x + c * u + s * v, floor + y, z - s * u + c * v];
  const meshes = [], records = [];
  const metal = mat('#b2bdbe', { metalness: 0.55, roughness: 0.3 });
  const dark = mat('#293c43'), porcelain = mat('#fff1d7'), wood = mat('#b87945');
  const accent = mat(room.city === 'tokyo' ? '#57795a' : '#a95845');
  const glass = mat('#9cc6cc', { metalness: 0.2, roughness: 0.22 });
  const food = mat('#dfae65'), ink = mat('#243443');
  function prop(kind, geo, material, u, y, v, solidSize = null, rotation = null) {
    const mesh = new THREE.Mesh(geo, material);
    const p = world(u, y, v);
    mesh.position.set(...p); mesh.rotation.y = face;
    if (rotation) mesh.rotateX(rotation);
    mesh.castShadow = mesh.receiveShadow = true;
    const record = { kind, position: p, yaw: face };
    records.push(record); meshes.push(mesh);
    Object.assign(mesh.userData, { interiorId: room.id, role: 'furniture', furniture: [record] });
    G.scene.add(mesh);
    if (solidSize) {
      const [ww, hh, dd] = solidSize;
      const bx = s ? dd : ww, bz = s ? ww : dd;
      G.colliders.push({ minX: p[0] - bx / 2, maxX: p[0] + bx / 2, minZ: p[2] - bz / 2, maxZ: p[2] + bz / 2,
        minY: p[1] - hh / 2, maxY: p[1] + hh / 2, interiorId: room.id, role: kind });
      record.size = [bx, hh, bz];
    }
    return mesh;
  }
  const block = (kind, ww, hh, dd, material, u, y, v, solid = false) =>
    prop(kind, new THREE.BoxGeometry(ww, hh, dd), material, u, y + hh / 2, v, solid ? [ww, hh, dd] : null);
  const cylinder = (kind, top, bottom, hh, material, u, y, v, open = false) =>
    prop(kind, new THREE.CylinderGeometry(top, bottom, hh, 12, 1, open), material, u, y + hh / 2, v);
  const ring = (kind, r, tube, material, u, y, v) =>
    prop(kind, new THREE.TorusGeometry(r, tube, 6, 16), material, u, y, v, null, Math.PI / 2);
  const cup = (u, y, v) => {
    cylinder('cup', 0.095, 0.07, 0.14, porcelain, u, y, v, true);
    cylinder('coffee', 0.076, 0.076, 0.008, dark, u, y + 0.12, v);
    prop('cup-handle', new THREE.TorusGeometry(0.047, 0.014, 6, 12), porcelain, u + 0.1, y + 0.07, v);
    cylinder('saucer', 0.145, 0.13, 0.018, porcelain, u, y - 0.018, v);
  };
  const rear = -fd / 2 + 1;
  if (room.category === 'cafe') {
    // Augment the existing coffee-machine body, rather than overlap it.
    block('espresso-front', 0.62, 0.26, 0.025, metal, -0.9, 1.08, rear + 0.265);
    for (const u of [-1.08, -0.72]) {
      cylinder('espresso-dial', 0.045, 0.045, 0.025, porcelain, u, 1.34, rear);
      block('espresso-spout', 0.04, 0.12, 0.13, metal, u, 1.06, rear + 0.29);
      cup(u, 0.98, rear + 0.3);
    }
    cylinder('grinder-base', 0.15, 0.16, 0.24, metal, 0.1, 0.95, rear);
    cylinder('bean-hopper', 0.18, 0.1, 0.25, food, 0.1, 1.19, rear);
    cylinder('hopper-lid', 0.19, 0.19, 0.03, dark, 0.1, 1.44, rear);
    block('pastry-tray', 1.25, 0.04, 0.5, porcelain, 1.5, 0.95, rear);
    for (let i = 0; i < 4; i++) {
      cylinder('pastry', 0.11, 0.14, 0.12, food, 1.08 + i * 0.27, 0.99, rear);
      ring('pastry-glaze', 0.075, 0.025, porcelain, 1.08 + i * 0.27, 1.13, rear);
    }
    // Open display frame and clear front; no opaque box concealing the food.
    for (const u of [0.82, 2.18]) block('display-frame', 0.035, 0.6, 0.035, metal, u, 0.95, rear - 0.28);
    block('display-canopy', 1.4, 0.04, 0.65, glass, 1.5, 1.55, rear);
    for (const side of [-1, 1]) {
      const u = side * (fw / 2 - 1.15), v = fd / 2 - 1.6;
      cup(u, 0.82, v);
      block('chair-back', 0.55, 0.5, 0.07, accent, u, 0.4, v - 1.14);
      for (const leg of [-0.2, 0.2]) block('chair-leg', 0.05, 0.4, 0.05, dark, u + leg, 0, v - 0.9);
    }
  } else if (room.category === 'food') {
    for (const u of [-0.7, 0.7]) {
      for (const y of [1.0, 1.14, 1.26]) ring('steamer-band', 0.35, 0.025, wood, u, y, rear);
      cylinder('steamer-lid', 0.36, 0.36, 0.04, wood, u, 1.25, rear);
      cylinder('lid-knob', 0.055, 0.055, 0.05, dark, u, 1.29, rear);
    }
    block('cutting-board', 0.8, 0.035, 0.42, food, fw / 2 - 1.5, 0.95, rear);
    block('knife-blade', 0.28, 0.09, 0.015, metal, fw / 2 - 1.5, 0.985, rear);
    block('knife-handle', 0.14, 0.06, 0.035, dark, fw / 2 - 1.71, 1, rear);
    for (const side of [-1, 1]) {
      const u = side * (fw / 2 - 1.0);
      block('dining-table', 0.85, 0.08, 0.85, wood, u, 0.72, 0, true);
      block('table-pedestal', 0.15, 0.72, 0.15, dark, u, 0, 0);
      cylinder('stool-seat', 0.28, 0.28, 0.09, accent, u, 0.42, 1.05);
      block('stool-base', 0.4, 0.42, 0.4, wood, u, 0, 1.05, true);
      cylinder('bowl', 0.22, 0.1, 0.15, porcelain, u, 0.8, 0, true);
      cylinder('soup', 0.19, 0.19, 0.015, accent, u, 0.92, 0);
      for (const du of [-0.025, 0.025]) block('chopstick', 0.012, 0.012, 0.38, dark, u + 0.3 + du, 0.81, 0);
    }
  } else if (room.category === 'store') {
    const u = fw / 2 - 1.65;
    block('fridge-body', 0.95, 1.95, 0.8, porcelain, u, 0, rear - 0.1, true);
    block('fridge-door', 0.85, 1.7, 0.035, glass, u, 0.13, rear + 0.32);
    block('fridge-handle', 0.04, 0.65, 0.06, dark, u - 0.31, 0.7, rear + 0.37);
    for (let level = 0; level < 3; level++) for (let row = 0; row < 3; row++) {
      cylinder('drink-bottle', 0.065, 0.07, 0.27, level % 2 ? accent : food, u - 0.25 + row * 0.25, 0.3 + level * 0.48, rear + 0.35);
      cylinder('bottle-cap', 0.035, 0.035, 0.04, dark, u - 0.25 + row * 0.25, 0.57 + level * 0.48, rear + 0.35);
    }
    const till = -fw / 2 + 1.4, v = fd / 2 - 1.4;
    block('register-screen', 0.32, 0.2, 0.035, ink, till, 1, v + 0.17);
    block('card-reader', 0.18, 0.07, 0.25, metal, till + 0.37, 0.95, v);
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const su = side * (fw / 2 - 0.88), sv = -fd / 2 + 1.3 + i * (fd - 2.6) / 4;
      cylinder('stocked-can', 0.1, 0.1, 0.24, accent, su, 1.85, sv);
      ring('can-rim', 0.09, 0.01, metal, su, 2.09, sv);
    }
  } else if (room.category === 'studio') {
    const keyboard = fw / 2 - 1.1;
    for (let i = 0; i < 12; i++) {
      block('piano-key', 0.09, 0.025, 0.3, porcelain, keyboard - 0.55 + i * 0.1, 1.02, 0);
      if (i % 7 !== 2 && i % 7 !== 6) block('piano-sharp', 0.045, 0.04, 0.16, ink, keyboard - 0.5 + i * 0.1, 1.045, -0.06);
    }
    const u = -fw / 2 + 1.05;
    cylinder('microphone-foot', 0.24, 0.24, 0.04, dark, u, 0, 0);
    cylinder('microphone-stand', 0.025, 0.025, 1.25, metal, u, 0.04, 0);
    prop('microphone', new THREE.CapsuleGeometry(0.06, 0.16, 3, 8), dark, u, 1.34, 0);
    for (let i = 0; i < 3; i++) {
      const lu = -fw / 2 + 0.9 + i * 0.65, lv = fd / 2 - 0.6;
      block('locker', 0.6, 1.9, 0.65, accent, lu, 0, lv, true);
      block('locker-handle', 0.03, 0.18, 0.05, metal, lu + 0.18, 0.85, lv - 0.36);
      for (let vent = 0; vent < 3; vent++) block('locker-vent', 0.3, 0.025, 0.015, ink, lu, 1.55 + vent * 0.07, lv - 0.333);
    }
    for (const side of [-1, 1]) for (const y of [0.28, 0.68]) {
      prop('speaker-cone', new THREE.TorusGeometry(0.15, 0.04, 6, 12), ink, side * (fw / 2 - 0.7), y, -fd / 2 + 1.16);
    }
  } else if (room.category === 'subway') {
    const u = -fw / 2 + 1.1, v = -fd / 2 + 0.9;
    block('ticket-slot', 0.4, 0.035, 0.03, ink, u, 0.68, v);
    block('ticket-tray', 0.55, 0.05, 0.2, metal, u, 0.4, v + 0.04);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++)
      cylinder('ticket-button', 0.035, 0.035, 0.025, accent, u - 0.2 + col * 0.2, 0.78 + row * 0.08, v + 0.01);
    // Route lines/station nodes are actual raised geometry on a side-facing
    // board, not inventory-only claims or another box labelled "station".
    block('route-board', 0.07, 1.1, fd - 2, porcelain, fw / 2 - 0.2, 1.35, 0);
    for (let line = 0; line < 2; line++) {
      block('route-line', 0.09, 0.035, fd - 2.5, line ? accent : food, fw / 2 - 0.25, 1.65 + line * 0.35, 0);
      for (let stop = 0; stop < 5; stop++) {
        const station = prop('route-stop', new THREE.SphereGeometry(0.065, 8, 6), ink,
          fw / 2 - 0.3, 1.665 + line * 0.35, -(fd - 2.7) / 2 + stop * (fd - 2.7) / 4);
        station.scale.x = 0.35;
      }
    }
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++)
      block('bench-seat-divider', 0.65, 0.025, 0.035, dark, side * (fw / 2 - 0.7), 0.48, -fd / 2 + 1 + i * (fd - 2) / 4);
    const clock = cylinder('station-clock-face', 0.28, 0.28, 0.06, porcelain, 0, 2.75, rear);
    clock.rotateX(Math.PI / 2);
    block('clock-hand', 0.025, 0.17, 0.035, dark, 0, 2.78, rear + 0.04);
    block('clock-hand', 0.15, 0.025, 0.035, dark, 0.06, 2.78, rear + 0.04);
  }
  const roots = batchFurniture(meshes, room.id);
  // Opting in after city grouping must not leak furniture into every city.
  const parent = room.walls[0]?.parent ?? G.scene;
  for (const root of roots) if (parent !== G.scene) parent.attach(root);
  room.furniture ??= [];
  room.furniture.push(...records);
  room.occluders ??= [];
  room.occluders.push(...roots);
  const names = { tokyo: { cafe: 'Aoi', food: 'Ren', store: 'Sora', studio: 'Haru', subway: 'Nao' },
    shanghai: { cafe: 'Lin', food: 'Wei', store: 'Mei', studio: 'Yun', subway: 'Tao' },
    seoul: { cafe: 'Bomi', food: 'Duri', store: 'Nari', studio: 'Sumi', subway: 'Min' } };
  const roles = { cafe: 'barista', food: 'vendor', store: 'clerk', studio: 'instructor', subway: 'attendant' };
  const greetings = { cafe: 'Ready to order a drink? Let’s practise your café phrase.', food: 'Choose a snack and practise ordering it.',
    store: 'Let’s practise asking for your purchase.', studio: 'Ready to practise your rehearsal phrase?', subway: 'Let’s practise asking for directions.' };
  room.staff = { spawn: world(0, 0, rear + 1.15), yaw: face, role: roles[room.category],
    name: names[room.city]?.[room.category] ?? roles[room.category], greeting: greetings[room.category] };
  room.enhanced = true;
  return registerInterior(room);
}

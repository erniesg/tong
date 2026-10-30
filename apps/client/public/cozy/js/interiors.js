// Rooms keep their physical walls/colliders when the camera cuts them away.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, box, mat, nightGlow } from './util.js';

export const interiors = [];
const states = new Map();
const box3 = new THREE.Box3();
const center = new THREE.Vector3();

export function registerInterior(descriptor) {
  const previous = interiors.findIndex(room => room.id === descriptor.id);
  if (previous !== -1) interiors.splice(previous, 1);
  interiors.push(descriptor);
  for (const root of [...descriptor.walls, ...descriptor.roofs]) {
    root.updateWorldMatrix(true, true);
    root.traverse(mesh => {
      if ((!mesh.isMesh && !mesh.isLine) || states.has(mesh)) return;
      const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = original.map(m => m.clone());
      // Keep the day/night material controller connected to the clones.
      original.forEach((m, i) => {
        for (const record of G.nightMats.filter(r => r.m === m)) G.nightMats.push({ ...record, m: materials[i] });
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      mesh.userData.interiorId = descriptor.id;
      states.set(mesh, { room: descriptor, root, roof: descriptor.roofs.includes(root), amount: 0,
        materials: materials.map(m => ({ m, opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite })) });
    });
    if (!G.blockers.includes(root)) G.blockers.push(root);
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
    let hidden = false;
    if (state.room === active) {
      if (state.roof) hidden = true;
      else {
        if (!facing.has(state.root)) {
          box3.setFromObject(state.root).getCenter(center);
          const b = active.bounds;
          const rx = (center.x - (b.minX + b.maxX) / 2) / ((b.maxX - b.minX) / 2);
          const rz = (center.z - (b.minZ + b.maxZ) / 2) / ((b.maxZ - b.minZ) / 2);
          const side = state.root.userData.cutawaySide ?? (Math.abs(rx) > Math.abs(rz) ? (rx < 0 ? 0 : 1) : (rz < 0 ? 2 : 3));
          const dx = cameraPosition.x - playerPosition.x, dz = cameraPosition.z - playerPosition.z;
          facing.set(state.root, [dx < -0.05, dx > 0.05, dz < -0.05, dz > 0.05][side]);
        }
        hidden = facing.get(state.root);
      }
    }
    state.root.userData.cutawayHidden = hidden;
    mesh.userData.cutawayHidden = hidden;
    state.amount += ((hidden ? 1 : 0) - state.amount) * k;
    if (Math.abs(state.amount - (hidden ? 1 : 0)) < 0.001) state.amount = hidden ? 1 : 0;
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
    walls: room.walls.map(root => ({ hidden: !!root.userData.cutawayHidden, opacity: (Array.isArray(root.material) ? root.material[0] : root.material)?.opacity })),
    roofs: room.roofs.map(root => ({ hidden: !!root.userData.cutawayHidden, opacity: (Array.isArray(root.material) ? root.material[0] : root.material)?.opacity })),
  }));
}

/** Adapt an existing footprint, never a new roadside box. Front is local +z. */
export function buildRoom({ id, city, category, x, z, w, d, h = 3.6, face = 0, wallMaterial, roofMaterial, roofs = [], open = false }) {
  const s = Math.round(Math.sin(face)), c = Math.round(Math.cos(face));
  const fw = s ? d : w, fd = s ? w : d;
  const walls = [], furnishings = [];
  const wood = mat('#a67b51'), dark = mat('#35434a'), cream = mat('#eee0bf');
  const position = (u, v) => [x + c * u + s * v, z - s * u + c * v];
  const piece = (ww, hh, dd, material, u, y, v, solid = false, role = 'furniture') => {
    const [px, pz] = position(u, v);
    const m = box(s ? dd : ww, hh, s ? ww : dd, material, px, y, pz, { collide: solid, block: role === 'wall' });
    m.userData.interiorId = id;
    m.userData.role = role;
    if (role === 'furniture') furnishings.push(m);
    if (solid) Object.assign(G.colliders[G.colliders.length - 1], { interiorId: id, role, minY: y, maxY: y + hh });
    return m;
  };
  piece(fw - 0.2, 0.045, fd - 0.2, wood, 0, -0.045, 0, false, 'floor');
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
      piece(0.65, 2.1, fd - 1.4, cream, side * (fw / 2 - 0.6), 0, 0, true);
      for (let level = 0; level < 4; level++) {
        piece(0.8, 0.06, fd - 1.3, dark, side * (fw / 2 - 0.6), 0.35 + level * 0.48, 0);
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
  G.scene.updateMatrixWorld(true);
  const batches = new Map();
  for (const mesh of furnishings.filter(m => m.parent === G.scene)) {
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(mesh);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const copies = meshes.map(m => m.geometry.clone().applyMatrix4(m.matrixWorld));
    const merged = new THREE.Mesh(mergeGeometries(copies), material);
    merged.castShadow = merged.receiveShadow = true;
    Object.assign(merged.userData, { interiorId: id, role: 'furniture' });
    G.scene.add(merged);
    for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); }
    copies.forEach(g => g.dispose());
  }
  const [dx, dz] = position(0, fd / 2);
  return registerInterior({ id, city, category, bounds: { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 },
    floorY: 0, center: [x, 0, z], door: [dx, 0, dz], walls, roofs });
}
function mirrorMaterial() { return nightGlow(mat('#b0d5d9', { emissive: '#7ac5dd' }), 0.1, 0.8); }

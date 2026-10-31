// Authored, physically traversable homes. No buildings are created on import.
import * as THREE from 'three';
import { G, mat, nightGlow } from './util.js';
import { registerInterior } from './interiors.js';
import { createApartmentPlan, supportAt, ceilingAt, zoneAt } from './level-support.js';

export const apartments = [];
const palettes = {
  tokyo: { plaster: '#e7decb', trim: '#465851', wood: '#a37a51', floor: '#bb9671', accent: '#718d7c', stone: '#c2beb3', linen: '#f4ebd9', dark: '#343d3d', glass: '#aacbd0', roof: '#485951', rooftop: '#a7a69c', plastic: '#3f7fbf', white: '#f2f0ea', green: '#5d8a3c', tank: '#5b8fb5', bulb: '#ffe2a8' },
  seoul: { plaster: '#f1e0cf', trim: '#594c52', wood: '#af795c', floor: '#c79d77', accent: '#c58c7a', stone: '#cbc2b9', linen: '#fff0db', dark: '#3f3940', glass: '#b3d5d7', roof: '#665465', rooftop: '#5f9470', plastic: '#3f7fbf', white: '#f2f0ea', green: '#5d8a3c', tank: '#5b8fb5', bulb: '#ffe2a8' },
  shanghai: { plaster: '#e3d8c2', trim: '#4f635f', wood: '#92694e', floor: '#b38a66', accent: '#648f8a', stone: '#bcb9ae', linen: '#f3e8cd', dark: '#343e3d', glass: '#afcfd0', roof: '#496361', rooftop: '#a5927c', plastic: '#3f7fbf', white: '#f2f0ea', green: '#5d8a3c', tank: '#5b8fb5', bulb: '#ffe2a8' },
};

export function buildApartment(options) {
  if (apartments.some(b => b.id === options.id)) throw new Error(`Apartment already built: ${options.id}`);
  const building = createApartmentPlan(options);
  const colors = { ...(palettes[options.city] || palettes.tokyo), ...(typeof options.style === 'object' ? options.style : palettes[options.style]) };
  const materials = Object.fromEntries(Object.entries(colors).map(([key, color]) => [key, key === 'bulb'
    ? nightGlow(mat(color, { emissive: '#ffc98a' }), 0.1, 2.6)
    : mat(color, key === 'glass' ? { transparent: true, opacity: 0.32, roughness: 0.24, depthWrite: false } : {})]));
  const rooms = building.levels.map(level => ({ ...level, walls: [], roofs: [], occluders: [],
    ceilingAt: (x, z, feetY = level.floorY) => ceilingAt(building, x, z, feetY),
    floorSupport: (x, z, feetY) => supportAt(building, x, z, feetY),
  }));
  // Instance ONLY within one level, cutaway role and authored wall plane.
  // Floors owned by a lower ceiling never get merged into the upper contents.
  const batches = new Map();
  for (const p of building.pieces) {
    const plane = p.cutawayPlane;
    const group = p.role === 'wall' ? `wall:${plane.axis}:${plane.at}` : p.cutaway === 'roof' || p.role === 'roof-trim' ? 'roof' : p.cutaway === 'base' ? 'base' : 'content';
    const key = `${p.level}:${group}:${p.color}`;
    if (!batches.has(key)) batches.set(key, { level: p.level, group, plane, pieces: [] });
    batches.get(key).pieces.push(p);
  }
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), axis = new THREE.Vector3(1, 0, 0);
  const position = new THREE.Vector3(), scale = new THREE.Vector3();
  building.meshes = [];
  for (const { level, group, plane, pieces } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, materials[pieces[0].color], pieces.length);
    pieces.forEach((p, i) => {
      quaternion.setFromAxisAngle(axis, p.rotationX);
      matrix.compose(position.fromArray(p.position), quaternion, scale.fromArray(p.size));
      mesh.setMatrixAt(i, matrix);
      p.batchIndex = i;
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { buildingId: building.id, interiorId: rooms[level].id, level, role: group,
      pieceIds: pieces.map(p => p.id), ...(group.startsWith('wall:') ? { cutawayPlane: plane } : {}) };
    G.scene.add(mesh); building.meshes.push(mesh);
    if (group.startsWith('wall:')) rooms[level].walls.push(mesh);
    else if (group === 'roof') rooms[level].roofs.push(mesh);
    else if (group === 'content') rooms[level].occluders.push(mesh);
  }
  for (const solid of building.solids) {
    const { id, minX, maxX, minY, maxY, minZ, maxZ, role, interiorId, buildingId, level } = solid;
    G.colliders.push({ id, minX, maxX, minY, maxY, minZ, maxZ, role, interiorId, buildingId, level });
  }
  rooms.forEach(registerInterior);
  building.rooms = rooms;
  building.levels = rooms;
  apartments.push(building);
  return building;
}

export function apartmentHeightAt(x, z, feetY, city) {
  let best = null;
  for (const b of apartments) {
    if (b.city !== city) continue;
    const height = supportAt(b, x, z, feetY);
    if (height !== null && (best === null || height > best)) best = height;
  }
  return best;
}
export function apartmentCeilingAt(x, z, feetY, city) {
  let best = null;
  for (const b of apartments) {
    if (b.city !== city) continue;
    const height = ceilingAt(b, x, z, feetY);
    if (height !== null && (best === null || height < best)) best = height;
  }
  return best;
}
export function apartmentZoneAt(position, city) {
  for (const b of apartments) if (b.city === city) {
    const zone = zoneAt(b, position);
    if (zone) return zone;
  }
  return null;
}

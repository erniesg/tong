// Hand-shaped, seeded foliage. Four shared-geometry instanced draws per tree;
// no image assets, transparent canopy shells or per-tree shader variants.
import * as THREE from 'three';
import { G, collider, seeded } from './util.js';

const TAU = Math.PI * 2;
const branchGeo = new THREE.CylinderGeometry(0.68, 1, 1, 7);
const barkMat = new THREE.MeshStandardMaterial({ color: 0x8b7461, roughness: 1 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x3a3022, emissiveIntensity: 0.16 });
const twigMat = new THREE.MeshStandardMaterial({ color: 0x755845, roughness: 1 });

// Folded fans/pointed leaves have real scalloped edges, not alpha rectangles.
function leafGeometry(kind) {
  const points = [0, 0, 0];
  const indices = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    if (kind === 'ginkgo') {
      const a = -1.12 + u * 2.24;
      const r = 0.88 + 0.09 * Math.cos(u * TAU * 5) - 0.12 * Math.exp(-Math.pow((u - 0.5) * 16, 2));
      points.push(Math.sin(a) * r, 0.08 * Math.cos(u * TAU * 3), Math.cos(a) * r);
    } else {
      const a = u * TAU;
      points.push(Math.sin(a) * 0.43 * Math.sin(u * Math.PI), 0.14 * Math.sin(u * Math.PI), (1 - Math.cos(a)) * 0.55);
    }
    if (i > 0) indices.push(0, i, i + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function blossomGeometry() {
  const p = [], ix = [];
  // Five slightly cupped, notched petals and a warm heart, in one instance.
  for (let k = 0; k < 5; k++) {
    const a = k * TAU / 5;
    const base = p.length / 3;
    p.push(0, 0, 0);
    for (const [x, z, y] of [[-0.20, 0.36, 0.02], [-0.23, 0.64, 0.11], [-0.07, 0.8, 0.16], [0, 0.72, 0.13], [0.07, 0.8, 0.16], [0.23, 0.64, 0.11], [0.20, 0.36, 0.02]]) {
      p.push(x * Math.cos(a) + z * Math.sin(a), y, z * Math.cos(a) - x * Math.sin(a));
    }
    for (let j = 1; j < 7; j++) ix.push(base, base + j, base + j + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setIndex(ix);
  const colors = new Float32Array(p.length);
  // Leave tinting to instance colors, but give flower centres a honey-pink tint.
  for (let i = 0; i < p.length / 3; i++) {
    colors.set(i % 8 === 0 ? [1, 0.64, 0.44] : [1, 1, 1], i * 3);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

const fanGeo = leafGeometry('ginkgo');
const greenGeo = leafGeometry('camphor');
const bloomGeo = blossomGeometry();
const bloomMat = leafMat.clone();
bloomMat.vertexColors = true;
const palettes = {
  ginkgo: [0xf3b631, 0xe9a52b, 0xffd85c, 0xf8ca49, 0xdba332, 0xffe58a],
  cherry: [0xf6b4c7, 0xffd4df, 0xffe9e8, 0xf8c5d4, 0xfff4ed, 0xeaa2bc],
  camphor: [0x477c4b, 0x628e50, 0x7b9e54, 0x3c704b, 0x97af65, 0x537f40],
};
const v = (x, y, z) => new THREE.Vector3(x, y, z);

/** Add a tree rooted at world (x,y,z); scale includes its trunk-only collider. */
export function makeTree({ x, z, y = 0, scale = 1, kind = 'ginkgo', seed = 1 }) {
  if (!palettes[kind]) kind = 'ginkgo';
  const rnd = seeded(seed);
  const between = (a, b) => a + (b - a) * rnd();
  const group = new THREE.Group();
  group.name = `${kind}-tree`;
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  G.scene.add(group);
  const crown = new THREE.Group();
  group.add(crown);
  const limbs = [], twigs = [], clusters = [];
  const lean = between(-0.15, 0.15), phase = rnd() * TAU;
  const trunkPoint = (h) => v(lean * h + Math.sin(h * 1.4 + phase) * 0.055, h, Math.sin(h * 0.9) * 0.08);
  const height = kind === 'cherry' ? 3.55 : kind === 'camphor' ? 3.9 : 4.15;
  // A flared foot and gradually bending, tapering leader.
  for (let i = 0; i < 8; i++) {
    const a = i * height / 8, b = (i + 1) * height / 8;
    limbs.push([trunkPoint(a), trunkPoint(b), 0.19 * Math.pow(1 - i / 9, 1.25)]);
  }
  // Small buttress roots meet the ground, without obstructing the whole crown.
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 + phase;
    limbs.push([v(Math.cos(a) * 0.32, 0.025, Math.sin(a) * 0.32), trunkPoint(0.32), 0.07]);
  }
  for (let i = 0; i < 15; i++) {
    const level = i / 14;
    const a = phase + i * 2.39996 + between(-0.15, 0.15);
    const reach = (kind === 'cherry' ? 1.55 : kind === 'camphor' ? 1.45 : 1.1) * (1 - level * 0.46) * between(0.83, 1.16);
    const start = trunkPoint(1.45 + level * (height - 1.8));
    const mid = start.clone().add(v(Math.cos(a) * reach * 0.52, 0.34, Math.sin(a) * reach * 0.52));
    const end = start.clone().add(v(Math.cos(a) * reach, between(0.48, 0.85), Math.sin(a) * reach));
    limbs.push([start, mid, 0.065 * (1 - level * 0.6)], [mid, end, 0.04 * (1 - level * 0.55)]);
    for (let j = 0; j < 3; j++) {
      const aa = a + (j - 1) * 0.8;
      const tip = end.clone().add(v(Math.cos(aa) * between(0.15, 0.4), between(0.06, 0.32), Math.sin(aa) * between(0.15, 0.4)));
      twigs.push([mid.clone().lerp(end, 0.45), tip, 0.016]);
      if (j === 1) clusters.push({ p: tip, r: between(0.52, 0.73) });
    }
  }
  clusters.push({ p: trunkPoint(height).add(v(0, 0.1, 0)), r: 0.55 });
  const tmp = new THREE.Object3D();
  const up = v(0, 1, 0);
  function wood(instances, material, parent) {
    const mesh = new THREE.InstancedMesh(branchGeo, material, instances.length);
    instances.forEach(([a, b, r], i) => {
      const d = b.clone().sub(a);
      tmp.position.copy(a).add(b).multiplyScalar(0.5);
      tmp.quaternion.setFromUnitVectors(up, d.clone().normalize());
      tmp.scale.set(r, d.length() + 0.025, r);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  }
  wood(limbs, barkMat, group);
  wood(twigs, twigMat, crown);

  const perCluster = kind === 'cherry' ? 90 : 100;
  const foliage = new THREE.InstancedMesh(kind === 'cherry' ? bloomGeo : kind === 'ginkgo' ? fanGeo : greenGeo, kind === 'cherry' ? bloomMat : leafMat, clusters.length * perCluster);
  const palette = palettes[kind].map(c => new THREE.Color(c));
  const color = new THREE.Color();
  let index = 0;
  for (const cluster of clusters) {
    for (let j = 0; j < perCluster; j++) {
      const a = rnd() * TAU, u = between(-1, 1), r = Math.cbrt(rnd()) * cluster.r;
      const ring = Math.sqrt(1 - u * u) * r;
      tmp.position.copy(cluster.p).add(v(Math.cos(a) * ring, u * r * 0.68, Math.sin(a) * ring));
      // Loosely drooping sprays, with enough turned leaves to catch the light.
      tmp.rotation.set(between(-0.7, 0.7), a, between(-0.6, 0.6));
      const s = between(0.17, 0.30) * (kind === 'cherry' ? 0.9 : 1);
      tmp.scale.set(s * between(0.85, 1.18), s, s);
      tmp.updateMatrix();
      foliage.setMatrixAt(index, tmp.matrix);
      color.copy(palette[Math.floor(rnd() * palette.length)]).multiplyScalar(between(0.9, 1.06));
      foliage.setColorAt(index++, color);
    }
  }
  foliage.castShadow = foliage.receiveShadow = true;
  crown.add(foliage);
  // Cherry's early copper-green leaves break up the pink/white flower sprays.
  const accents = new THREE.InstancedMesh(greenGeo, leafMat, clusters.length * 8);
  index = 0;
  for (const { p, r } of clusters) {
    for (let j = 0; j < 8; j++) {
      tmp.position.copy(p).add(v(between(-r, r), between(-0.2, 0.3), between(-r, r)));
      tmp.rotation.set(between(-0.4, 0.6), rnd() * TAU, between(-0.5, 0.5));
      tmp.scale.setScalar(between(0.13, 0.23));
      tmp.updateMatrix();
      accents.setMatrixAt(index, tmp.matrix);
      accents.setColorAt(index++, new THREE.Color(kind === 'cherry' ? 0x84915a : palettes[kind][2]));
    }
  }
  accents.castShadow = true;
  crown.add(accents);
  // Do not register foliage as a camera blocker or a solid wall.
  const radius = 0.24 * scale;
  collider(x - radius, x + radius, z - radius, z + radius);
  G.updaters.push((dt, t) => {
    crown.rotation.z = Math.sin(t * 0.75 + phase) * 0.006;
    crown.rotation.x = Math.sin(t * 0.57 + phase) * 0.004;
  });
  return group;
}

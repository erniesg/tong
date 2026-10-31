// Yeonhui hillside rendering: terrain, lanes, stair alley, retaining wall,
// villas and the lookout pavilion. Shape comes from seoul-terrain.js.
import * as THREE from 'three';
import { G, add, box, collider, mat, worldUV, pointLight } from '../util.js';
import { makeTree } from '../nature.js';
import { HILL_START, HILL_END, WALL, STAIR, LANE, LOOKOUT, HILL_ROADS, lowerH, upperH, corridorH, hillHeight } from './seoul-terrain.js';

/** Terrain-following ribbon (roads/paths) laid just above the ground. */
function ribbon(points, width, material, lift = 0.03) {
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    const geo = new THREE.PlaneGeometry(width, len, 2, Math.max(1, Math.ceil(len / 0.5)));
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.atan2(bx - ax, bz - az));
    geo.translate((ax + bx) / 2, 0, (az + bz) / 2);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, hillHeight(p.getX(k), p.getZ(k)) + lift);
    geo.computeVertexNormals();
    worldUV(geo, 3);
    add(geo, material, 0, 0, 0, G.scene, false);
  }
}

function terrain(material) {
  const geo = new THREE.PlaneGeometry(190, 70, 190, 140);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, HILL_START + 35 - 0.5);
  const p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), z = p.getZ(k);
    // Beyond the playable edge the slope keeps rising into Ansan's flank.
    p.setY(k, (z > HILL_END ? upperH(110) + (z - HILL_END) * 0.25 : hillHeight(x, z)) - 0.02);
  }
  geo.computeVertexNormals();
  worldUV(geo, 5);
  const mesh = add(geo, material, 0, 0, 0, G.scene, false);
  mesh.receiveShadow = true;
  return mesh;
}

/** A villa stepping into the slope: its foundation runs down past the low side. */
function villa(x, z, w, d, h, M, material, variant) {
  let base = -Infinity, low = Infinity;
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
    const y = hillHeight(x + u * w / 2, z + v * d / 2);
    base = Math.max(base, y); low = Math.min(low, y);
  }
  box(w, h + (base - low) + 3, d, material, x, low - 3, z, { block: true, uv: 2 });
  collider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  box(w + 0.25, 0.25, d + 0.25, M.roof, x, base + h, z, { block: true });
  const frames = [], panes = [[], []], tmp = new THREE.Object3D();
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2, s = Math.sin(angle), c = Math.cos(angle);
    const depth = side % 2 ? w / 2 : d / 2, width = side % 2 ? d : w;
    for (let floor = base + 1.1; floor < base + h - 1; floor += 2.8) {
      for (let u = -width / 2 + 1.3; u < width / 2 - 0.6; u += 2.4) {
        tmp.rotation.y = angle;
        tmp.position.set(x + c * u + s * (depth + 0.025), floor + 0.775, z - s * u + c * (depth + 0.025));
        tmp.updateMatrix(); frames.push(tmp.matrix.clone());
        tmp.position.x += s * 0.06; tmp.position.z += c * 0.06;
        tmp.updateMatrix();
        panes[(Math.round(u * 10) + Math.round(floor * 10) + side + variant) % 3 ? 0 : 1].push(tmp.matrix.clone());
      }
    }
  }
  for (const [matrices, geometry, m] of [
    [frames, new THREE.BoxGeometry(1.25, 1.55, 0.1), M.trim],
    [panes[0], new THREE.BoxGeometry(1.07, 1.35, 0.12), M.window],
    [panes[1], new THREE.BoxGeometry(1.07, 1.35, 0.12), M.unlit],
  ]) {
    const mesh = new THREE.InstancedMesh(geometry, m, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    G.scene.add(mesh);
  }
  // Rooftop rooms (옥탑방) and water tanks, as on the flat streets.
  box(2.3, 1.7, 2.4, M.concrete, x - w * 0.2, base + h + 0.25, z + d * 0.15, { block: true });
  if (variant % 2 === 0) add(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 12), M.tank, x + w * 0.22, base + h + 0.8, z - d * 0.2);
}

function hillLamp(x, z, M, real = false) {
  const y = hillHeight(x, z);
  box(0.1, 3.9, 0.1, M.metal, x, y, z);
  box(0.55, 0.12, 0.55, M.metal, x, y + 3.9, z);
  box(0.4, 0.05, 0.4, M.warm, x, y + 3.86, z, { cast: false });
  collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
  if (real) pointLight(0xffc58b, 7, 13, x, y + 3.6, z);
}

function stairAlley(M) {
  const c = STAIR, mid = (c.minX + c.maxX) / 2, width = c.maxX - c.minX;
  // Treads over the continuous physical ramp, as in the apartment stairs.
  const steps = Math.round((c.z1 - c.z0) / 0.4);
  for (let i = 0; i < steps; i++) {
    const za = c.z0 + i * (c.z1 - c.z0) / steps, zb = c.z0 + (i + 1) * (c.z1 - c.z0) / steps;
    const lo = corridorH(c, za), hi = corridorH(c, zb);
    box(width - 0.2, hi - lo + 0.25, zb - za, M.stone, mid, lo - 0.25, (za + zb) / 2, { cast: false });
    box(width - 0.2, 0.03, 0.05, M.trim, mid, hi - 0.01, zb, { cast: false });
  }
  // Low stone cheek walls and a handrail; ends stay open.
  for (const x of [c.minX - 0.15, c.maxX + 0.15]) {
    for (let i = 0; i < 12; i++) {
      const za = c.z0 + 0.5 + i * (c.z1 - c.z0 - 1) / 12, zb = za + (c.z1 - c.z0 - 1) / 12;
      const y = Math.min(hillHeight(x, za), corridorH(c, za));
      box(0.3, corridorH(c, zb) - y + 0.85, zb - za + 0.02, M.stone, x, y - 0.3, (za + zb) / 2, { cast: false });
    }
    collider(x - 0.15, x + 0.15, c.z0 + 0.5, c.z1 - 0.5);
  }
  const rail = box(0.06, 0.06, Math.hypot(c.z1 - c.z0, corridorH(c, c.z1) - corridorH(c, c.z0)), M.metal,
    c.maxX - 0.25, (corridorH(c, c.z0) + corridorH(c, c.z1)) / 2 + 0.6, (c.z0 + c.z1) / 2, { cast: false });
  rail.rotation.x = -Math.atan((corridorH(c, c.z1) - corridorH(c, c.z0)) / (c.z1 - c.z0));
}

function laneEdges(M) {
  const c = LANE;
  // The lane cuts through the wall: kerb walls retain the terrace beside it.
  for (const x of [c.minX - 0.15, c.maxX + 0.15]) {
    for (let i = 0; i < 14; i++) {
      const za = c.z0 + 1 + i * (c.z1 - c.z0 - 2) / 14, zb = za + (c.z1 - c.z0 - 2) / 14;
      const top = Math.max(hillHeight(x + (x < c.minX ? -0.4 : 0.4), za), corridorH(c, zb) + 0.9);
      box(0.3, top - corridorH(c, za) + 0.3, zb - za + 0.02, M.stone, x, corridorH(c, za) - 0.3, (za + zb) / 2, { cast: false });
    }
    collider(x - 0.15, x + 0.15, c.z0 + 1, c.z1 - 1);
  }
}

function retainingWall(M) {
  // Stone wall face between the lower slope and the upper terrace, with
  // gaps where the stair alley and the lane pass through.
  const spans = [[-62, STAIR.minX - 0.3], [STAIR.maxX + 0.3, LANE.minX - 0.3], [LANE.maxX + 0.3, 62]];
  for (const [a, b] of spans) {
    box(b - a, upperH(WALL.z1) - lowerH(WALL.z0) + 0.3, WALL.z1 - WALL.z0, M.stone,
      (a + b) / 2, lowerH(WALL.z0) - 0.2, (WALL.z0 + WALL.z1) / 2, { block: true });
    // Guard rail along the top edge of the terrace.
    box(b - a, 0.06, 0.06, M.metal, (a + b) / 2, upperH(WALL.z1) + 1.0, WALL.z1 - 0.1, { cast: false });
    for (let x = a + 0.5; x < b; x += 2) box(0.05, 1.0, 0.05, M.metal, x, upperH(WALL.z1), WALL.z1 - 0.1, { cast: false });
  }
  // Ivy patches soften the long wall.
  for (let x = -58; x < 60; x += 7.3) {
    if (x > STAIR.minX - 2 && x < STAIR.maxX + 2) continue;
    if (x > LANE.minX - 2 && x < LANE.maxX + 2) continue;
    box(2.2 + (x % 3), 1.6, 0.08, M.ivy, x, lowerH(WALL.z0) + 0.3, WALL.z0 - 0.05, { cast: false });
  }
}

function pavilion(M) {
  // 정자: open timber pavilion with a hipped roof and benches facing south.
  const { x, z } = LOOKOUT, y = hillHeight(x, z);
  box(6.2, 0.18, 6.2, M.stone, x, y - 0.1, z, { cast: false });
  for (const [u, v] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
    box(0.26, 3, 0.26, M.timber, x + u, y, z + v);
    collider(x + u - 0.13, x + u + 0.13, z + v - 0.13, z + v + 0.13);
  }
  box(6.4, 0.3, 6.4, M.timber, x, y + 3, z, { block: true });
  const roof = add(new THREE.ConeGeometry(5.2, 1.9, 4, 1), M.tile, x, y + 4.25, z);
  roof.rotation.y = Math.PI / 4;
  for (const v of [-1.6, 1.6]) box(4.2, 0.45, 0.5, M.timber, x, y, z + v);
  collider(x - 2.1, x + 2.1, z - 1.85, z - 1.35);
  collider(x - 2.1, x + 2.1, z + 1.35, z + 1.85);
  pointLight(0xffd59a, 5, 10, x, y + 2.7, z);
}

/** Builds the district. `sign(lines, x, y, z, yaw, w, h, bg)` is Seoul's sign helper. */
export function buildHill(base, sign) {
  const M = {
    ...base,
    stone: mat('#a49a8a'), timber: mat('#7c4a32'), tile: mat('#3d4146', { roughness: 0.7 }), ivy: mat('#4f7a45'),
  };
  terrain(base.ground);
  for (const road of HILL_ROADS) ribbon(road.points, road.width, road.color === '#a89a89' ? base.asphalt : base.pavers);
  stairAlley(M);
  laneEdges(M);
  retainingWall(M);
  pavilion(M);
  // Villas step up both sides; none sits on a lane or the stairs.
  for (const [x, z, w, d, h, material, variant] of [
    [-30, 84, 10, 7, 8, M.cream, 0], [-3, 84.5, 12, 7, 9, M.red, 1], [9.5, 84, 6, 7, 7, M.grey, 2],
    [38, 84, 12, 8, 10, M.cream, 3], [53, 84, 10, 8, 8, M.red, 4],
    [-52, 97, 10, 10, 9, M.grey, 5], [5, 106, 14, 7, 9, M.cream, 6], [38, 106.5, 12, 8, 8, M.red, 7], [54, 96, 8, 9, 8, M.grey, 8],
  ]) villa(x, z, w, d, h, M, material, variant);
  // Scenery villas behind the playable edge, higher up the slope.
  for (let i = 0; i < 5; i++) {
    const x = -52 + i * 26, z = 122 + (i % 2) * 4;
    const y = upperH(110) + (z - HILL_END) * 0.25;
    box(14, 10 + (i % 3) * 3, 10, i % 2 ? M.red : M.grey, x, y - 3, z, { uv: 2 });
  }
  // Ansan's wooded edge above the terrace and trees along the lanes.
  for (let i = 0; i < 26; i++) {
    const x = -60 + i * 4.7 + ((i * 37) % 5) * 0.4, z = 111 + ((i * 53) % 7) * 0.3;
    makeTree({ x, z, y: hillHeight(x, Math.min(z, HILL_END)), scale: 1.1 + (i % 3) * 0.15, kind: 'ginkgo', seed: 400 + i });
  }
  for (const [x, z] of [[-22, 105], [-40, 103], [-22, 79], [16, 79], [32, 98], [-8, 97]]) makeTree({ x, z, y: hillHeight(x, z), scale: 1, kind: 'ginkgo', seed: 500 + x });
  for (const [x, z, real] of [[-15.6, 82, true], [-10.4, 97.5, false], [20.4, 79.2, false], [28, 103, true], [-25, 101, false], [6, 79.4, false]]) hillLamp(x, z, M, real);
  const post = (x, z, lines, yaw) => {
    const y = hillHeight(x, z);
    box(0.07, 2.6, 0.07, M.metal, x, y, z);
    collider(x - 0.06, x + 0.06, z - 0.06, z + 0.06);
    sign(lines, x, y + 2.3, z + 0.05, yaw, 3.4, 0.9);
  };
  post(-10, 80, ['계단길 ↑ 전망대', 'Stair alley · up to the lookout'], Math.PI);
  post(20, 79.5, ['언덕길 ↑', 'Sloped lane · bikes & scooters'], Math.PI);
  post(-27, 106, ['연희동 언덕 전망대', 'Yeonhui hill lookout · 정자'], Math.PI);
  // Side boundaries follow the slope; north boundary tops the terrace.
  for (const x of [-61.9, 61.9]) {
    for (let z = HILL_START - 1; z < HILL_END; z += 2) box(0.24, 0.8, 2.02, M.red, x, hillHeight(x, z + 1) - 0.1, z + 1, { cast: false });
    collider(x - 0.12, x + 0.12, HILL_START - 1, HILL_END + 0.3);
  }
  box(124, 0.8, 0.24, M.red, 0, upperH(110), HILL_END + 0.15, { collide: true, block: true });
}

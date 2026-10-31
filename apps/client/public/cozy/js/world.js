// Seoul's activity core; cities/seoul.js adds the surrounding street loops.
// +z is north (Yeonnam), -z south (compressed Han River connection).
// The reference art is atmospheric, not a literal map of Hongdae.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { makeTree } from './nature.js';
import { registerInterior, buildRoom } from './interiors.js';
import {
  G, add, box, boxMM, collider, mat, makeCanvas, canvasTexture, roundRect, softTexture, textTexture,
  nightGlow, pointLight, hdr, rand, seeded, clamp, worldUV,
} from './util.js';
import { asphalt, pavers, brick, stone, plaster, wood, tiles, fabric, tiled } from './textures.js';
import { toon } from './characters.js';

/* ── Layout ───────────────────────────────────────── */

export const TX = -2.4;
export const TENT = { minX: TX - 3, maxX: TX + 3, minZ: -2.2, maxZ: 2.0, wallH: 2.3, ridgeH: 3.0, valanceDrop: 0.25 };
export const COUNTER_Y = 0.87;
export const STOOLS = [-1.8, -0.6, 0.6, 1.8].map((dx) => new THREE.Vector3(TX + dx, 0, 0));
export const TERRACE_Y = 2.4;

export const SPOTS = {
  haeunTent: STOOLS[2],
  playerSeat: STOOLS[1],
  ajusshi: new THREE.Vector3(TX - 1.55, 0, -1.75),
  cat: new THREE.Vector3(1.45, 0.82, -1.4),
  haeunStudio: new THREE.Vector3(-11.5, TERRACE_Y, -37.5),
  jinCafe: new THREE.Vector3(13.15, 0, -12.6),
  jinLookout: new THREE.Vector3(9, TERRACE_Y, -44.35),
  barista: new THREE.Vector3(17.25, 0, -16.5),
  cashier: new THREE.Vector3(-13.35, 0, -12.6),
  subway: new THREE.Vector3(-4, 0, -18.4),
  telescope: new THREE.Vector3(4.6, TERRACE_Y, -45.2),
  whiteboard: new THREE.Vector3(-9.2, TERRACE_Y, -43.2),
  tentSign: new THREE.Vector3(TX + 2.6, 0, 2.6),
  vending: new THREE.Vector3(5.4, 0, -4.5),
};

export const PLACES = [
  { id: 'food', ko: '포장마차 거리', en: 'Food Street', spawn: [1.6, 0, 9], yaw: 0, icon: '🏮' },
  { id: 'store', ko: '편의점', en: 'Convenience Store', spawn: [-8.6, 0, -15.5], yaw: Math.PI / 2, icon: '🏪' },
  { id: 'cafe', ko: '카페 봄', en: 'Café Bom', spawn: [8.6, 0, -15.5], yaw: -Math.PI / 2, icon: '☕' },
  { id: 'subway', ko: '홍대입구역', en: 'Subway', spawn: [-4, 0, -16.6], yaw: 0, icon: '🚇' },
  { id: 'studio', ko: '연습실', en: 'Practice Studio', spawn: [-4.6, TERRACE_Y, -37.5], yaw: Math.PI / 2, icon: '💃' },
  { id: 'lookout', ko: '한강 전망대', en: 'Han River Lookout', spawn: [6, TERRACE_Y, -41.5], yaw: 0, icon: '🌉' },
];
for (const place of PLACES) {
  if (place.id === 'lookout') continue;
  place.category = place.id;
  place.interiorId = `seoul-${place.id}-room`;
  place.entry = { food: [TX, 0, TENT.maxZ], store: [-10, 0, -15.5], cafe: [10, 0, -15.5],
    subway: [-4, 0, -19.2], studio: [-6, TERRACE_Y, -37.5] }[place.id];
}

// Register the existing Seoul shells, including their upper floors, fascia and
// ceiling fixtures. Furniture stays visible; original story/NPC spots stay put.
function registerSeoulShell(category, initial, bounds, floorY = 0) {
  const walls = [], roofs = [];
  G.scene.updateMatrixWorld(true);
  for (const root of G.scene.children.filter(o => !initial.has(o))) {
    if (!root.isMesh && !root.isGroup && !root.isLine) continue;
    const b = new THREE.Box3().setFromObject(root);
    if (b.isEmpty()) continue;
    if (b.min.y >= floorY + 2.3) roofs.push(root);
    else if (b.max.y >= floorY + 3 || (b.max.y - b.min.y > 0.4 &&
      ((b.max.x - b.min.x < 0.35 && (Math.abs(b.min.x - bounds.minX) < 0.2 || Math.abs(b.max.x - bounds.maxX) < 0.2)) ||
       (b.max.z - b.min.z < 0.35 && (Math.abs(b.min.z - bounds.minZ) < 0.2 || Math.abs(b.max.z - bounds.maxZ) < 0.2))))) walls.push(root);
  }
  for (const collision of G.colliders.slice(initial.colliderStart)) {
    const boundary = (collision.maxX - collision.minX < 0.4 &&
      (Math.abs(collision.minX - bounds.minX) < 0.4 || Math.abs(collision.maxX - bounds.maxX) < 0.4)) ||
      (collision.maxZ - collision.minZ < 0.4 &&
      (Math.abs(collision.minZ - bounds.minZ) < 0.4 || Math.abs(collision.maxZ - bounds.maxZ) < 0.4));
    const matching = G.scene.children.filter(o => !initial.has(o) && o.isMesh).map(o => new THREE.Box3().setFromObject(o)).filter(b =>
      Math.abs(b.min.x - collision.minX) < 0.04 && Math.abs(b.max.x - collision.maxX) < 0.04 &&
      Math.abs(b.min.z - collision.minZ) < 0.04 && Math.abs(b.max.z - collision.maxZ) < 0.04);
    const maxY = matching.length ? Math.max(...matching.map(b => b.max.y)) : floorY + (boundary ? 3 : 1);
    Object.assign(collision, { interiorId: `seoul-${category}-room`, role: boundary || maxY > floorY + 3 ? 'wall' : 'furniture', minY: floorY, maxY });
  }
  const ceilingAt = category === 'food' ? (_x, z) => {
    // The front valance is lower than the sloped tent roof.
    if (z > TENT.maxZ - 0.4) return TENT.wallH - TENT.valanceDrop;
    const mid = (TENT.minZ + TENT.maxZ) / 2;
    return TENT.ridgeH - (TENT.ridgeH - TENT.wallH) * clamp(Math.abs(z - mid) / ((TENT.maxZ - TENT.minZ) / 2), 0, 1);
  } : () => floorY + 3.4;
  return registerInterior({ id: `seoul-${category}-room`, city: 'seoul', category,
    bounds: { ...bounds, minY: floorY - 0.25, maxY: category === 'food' ? TENT.ridgeH : floorY + 3.4 }, ceilingAt,
    floorY, door: PLACES.find(p => p.id === category).entry,
    center: [(bounds.minX + bounds.maxX) / 2, floorY, (bounds.minZ + bounds.maxZ) / 2], walls, roofs });
}

export const ZONES = [
  { id: 'store', minX: -18, maxX: -10, minZ: -20, maxZ: -11, indoor: true },
  { id: 'cafe', minX: 10, maxX: 18, minZ: -20, maxZ: -11, indoor: true },
  { id: 'studio', minX: -16, maxX: -6, minZ: -44, maxZ: -31, indoor: true },
  { id: 'food', minX: -6.2, maxX: 6.2, minZ: -8, maxZ: 30 },
  { id: 'subway', minX: -7, maxX: -1, minZ: -27, maxZ: -16 },
  { id: 'lookout', minX: -6, maxX: 16, minZ: -46, maxZ: -38 },
  { id: 'plaza', minX: -10, maxX: 10, minZ: -28, maxZ: -8 },
  { id: 'terrace', minX: -16, maxX: 16, minZ: -46, maxZ: -28 },
];

export const BOUNDS = { minX: -15.7, maxX: 15.7, minZ: -45.5, maxZ: 29.5 };

export function heightAt(x, z) {
  if (z > -28 || x < -16.3 || x > 16.3) return 0;
  if (x > 3 && x < 7 && z > -32) return clamp((-28 - z) / 4, 0, 1) * TERRACE_Y;
  return TERRACE_Y;
}

export function zoneAt(x, z) {
  return ZONES.find((zn) => x >= zn.minX && x <= zn.maxX && z >= zn.minZ && z <= zn.maxZ) ?? null;
}

/* ── Shared materials ─────────────────────────────── */

function texMat(t, rx, ry, opts = {}) {
  const tt = tiled(t, rx, ry);
  return mat(0xffffff, { map: tt.map, normalMap: tt.normalMap, ...opts });
}

/** Material whose texture tiles at 1 repeat per `scale` metres (use with worldUV/box). */
function worldMat(t, opts = {}) {
  return mat(0xffffff, { map: t.map, normalMap: t.normalMap, ...opts });
}

let M;
function materials() {
  M = {
    asphalt: worldMat(asphalt(), { roughness: 0.75, metalness: 0.05 }),
    pavers: worldMat(pavers(), { roughness: 0.85 }),
    stone: worldMat(stone(), { roughness: 0.95 }),
    concrete: worldMat(plaster('#a9a49c'), { roughness: 0.95 }),
    white: worldMat(plaster('#f1ede6')),
    pink: worldMat(plaster('#f0c4c8')),
    cream: worldMat(plaster('#efe2cc')),
    grey: worldMat(plaster('#9a9aa2')),
    brickRed: worldMat(brick('#8a4a3a')),
    brickBrown: worldMat(brick('#7a5a48', 'b2')),
    wood: worldMat(wood('#b58b5c')),
    woodLight: worldMat(wood('#d8b585')),
    tiles: worldMat(tiles()),
    steel: mat(0xb9bec4, { metalness: 0.75, roughness: 0.32 }),
    dark: mat(0x2a2a30, { roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd6e6, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
  };
}

/* ── Facades ──────────────────────────────────────── */

const BRICKS = ['#8a4a3a', '#6e5d4c', '#7a5642', '#5f5a68', '#9b6b4f', '#6b3b33', '#b9a58e'];

function facade(widthM, heightM, rnd, { shop = true, base } = {}) {
  const ppm = 32;
  const w = Math.round(widthM * ppm);
  const h = Math.round(heightM * ppm);
  const [c, g] = makeCanvas(w, h);
  const [e, ge] = makeCanvas(w, h);
  const col = base ?? BRICKS[Math.floor(rnd() * BRICKS.length)];
  g.fillStyle = col;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < h; y += 7) g.fillRect(0, y, w, 1);
  for (let y = 0; y < h; y += 14) for (let x = (y / 14) % 2 ? 0 : 8; x < w; x += 16) g.fillRect(x, y, 1, 7);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, w, h);

  const shopH = 3.0 * ppm;
  const sy = h - shopH;
  if (shop) {
    const lit = rnd() < 0.7;
    const glow = ['#ffd9a0', '#ffe8c2', '#ffc7d6', '#c9f1ff', '#fff0b8'][Math.floor(rnd() * 5)];
    g.fillStyle = '#2b2a30';
    g.fillRect(6, sy + 4, w - 12, shopH - 4);
    if (lit) {
      g.fillStyle = glow;
      g.globalAlpha = 0.55;
      g.fillRect(12, sy + 22, w - 24, shopH - 26);
      g.globalAlpha = 1;
      ge.fillStyle = glow;
      ge.globalAlpha = 0.7;
      ge.fillRect(12, sy + 22, w - 24, shopH - 26);
      ge.globalAlpha = 1;
      g.fillStyle = 'rgba(40,30,30,0.6)';
      for (let x = 12; x < w - 12; x += 44) g.fillRect(x, sy + 22, 3, shopH - 26);
    } else {
      g.fillStyle = '#868991';
      g.fillRect(12, sy + 22, w - 24, shopH - 26);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = sy + 22; y < h; y += 5) g.fillRect(12, y, w - 24, 1);
    }
    // awning band
    g.fillStyle = ['#c7432f', '#2f6a8f', '#3d7a4f', '#d9a33d', '#6a4a8f'][Math.floor(rnd() * 5)];
    g.fillRect(6, sy + 4, w - 12, 16);
  }
  for (let fy = (shop ? sy : h) - 2.9 * ppm; fy > 0.5 * ppm; fy -= 2.9 * ppm) {
    for (let fx = 0.7 * ppm; fx < w - 1.5 * ppm; fx += 2.4 * ppm) {
      const lit = rnd() < 0.45;
      const glass = g.createLinearGradient(0, fy, 0, fy + 1.5 * ppm);
      glass.addColorStop(0, '#9fb6cc');
      glass.addColorStop(1, '#4d6176');
      g.fillStyle = '#d8d2c8';
      g.fillRect(fx - 3, fy - 3, 1.3 * ppm + 6, 1.5 * ppm + 8);
      g.fillStyle = glass;
      g.fillRect(fx, fy, 1.3 * ppm, 1.5 * ppm);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(fx + 4, fy + 3, 6, 1.5 * ppm - 6);
      if (lit) {
        const lc = ['#ffcf87', '#ffe2a8', '#ffb877', '#bfe3ff'][Math.floor(rnd() * 4)];
        ge.fillStyle = lc;
        ge.fillRect(fx, fy, 1.3 * ppm, 1.5 * ppm);
        ge.fillStyle = 'rgba(0,0,0,0.5)';
        ge.fillRect(fx, fy, 0.35 * ppm, 1.5 * ppm);
      }
      if (rnd() < 0.18) {
        g.fillStyle = '#e9e6e0';
        g.fillRect(fx + 6, fy + 1.5 * ppm + 8, 0.8 * ppm, 0.5 * ppm);
        g.fillStyle = '#999';
        for (let k = 0; k < 4; k++) g.fillRect(fx + 10, fy + 1.5 * ppm + 12 + k * 3, 0.8 * ppm - 8, 1);
      }
    }
  }
  const map = canvasTexture(c, { repeat: false });
  const emissiveMap = canvasTexture(e, { repeat: false });
  const n = brick(col, 'f').normalMap.clone();
  n.repeat.set(widthM / 2, heightM / 2);
  n.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), emissive: 0xffffff, roughness: 0.9 });
  nightGlow(m, 0.0, 0.85);
  return m;
}

/** A building block whose street face (±x or +z) gets a facade. */
function building(minX, maxX, minZ, maxZ, height, face, rnd, opts = {}) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const faceW = face === 'px' || face === 'nx' ? d : w;
  const fm = facade(faceW, height, rnd, opts);
  const side = mat(new THREE.Color(BRICKS[Math.floor(rnd() * BRICKS.length)]).multiplyScalar(0.55), { roughness: 0.95 });
  const mats = [side, side, mat(0x4a4a50), side, side, side];
  const idx = { px: 0, nx: 1, pz: 4, nz: 5 }[face];
  mats[idx] = fm;
  const geo = new THREE.BoxGeometry(w, height, d);
  const m = new THREE.Mesh(geo, mats);
  m.position.set((minX + maxX) / 2, opts.y0 ?? 0 + height / 2, (minZ + maxZ) / 2);
  m.position.y = (opts.y0 ?? 0) + height / 2;
  m.castShadow = m.receiveShadow = true;
  G.scene.add(m);
  G.blockers.push(m);
  if (opts.collide !== false) collider(minX, maxX, minZ, maxZ);
  // rooftop clutter
  if (rnd() < 0.6) {
    const top = (opts.y0 ?? 0) + height;
    box(1.2, 1.1, 1.2, mat(0xd9dde2, { roughness: 0.6 }), minX + w * rand(0.2, 0.8), top, minZ + d * rand(0.2, 0.8));
  }
  return m;
}

/* ── Signage ──────────────────────────────────────── */

function neonSign(text, color, x, y, z, rotY, w, h) {
  const [c, g] = makeCanvas(512, Math.round((512 * h) / w));
  g.fillStyle = 'rgba(14,10,24,0.9)';
  roundRect(g, 6, 6, c.width - 12, c.height - 12, 26);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 24;
  roundRect(g, 18, 18, c.width - 36, c.height - 36, 20);
  g.stroke();
  g.font = `${Math.round(c.height * 0.55)}px Jua, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(text, c.width / 2, c.height / 2 + 6);
  g.globalAlpha = 0.5;
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2 + 6);
  const tex = canvasTexture(c, { repeat: false });
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, transparent: true, roughness: 0.5 });
  nightGlow(m, 0.25, 1.9);
  const mesh = add(new THREE.PlaneGeometry(w, h), m, x, y, z, G.scene, false);
  mesh.rotation.y = rotY;
  return mesh;
}

function bladeSign(text, color, x, y, z) {
  const chars = [...text];
  const [c, g] = makeCanvas(160, 160 * chars.length + 40);
  g.fillStyle = 'rgba(14,10,24,0.92)';
  roundRect(g, 4, 4, c.width - 8, c.height - 8, 20);
  g.fill();
  g.font = '120px Jua, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 22;
  chars.forEach((ch, i) => g.fillText(ch, 80, 20 + 160 * i + 88));
  const tex = canvasTexture(c, { repeat: false });
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, transparent: true, side: THREE.DoubleSide });
  nightGlow(m, 0.3, 1.8);
  add(new THREE.PlaneGeometry(0.6, 0.6 * chars.length + 0.15), m, x, y, z, G.scene, false);
}

function fascia(text, sub, bg, fg, x, y, z, rotY, w, h = 0.6) {
  const tex = textTexture(
    [
      [text, 150, fg, sub ? 110 : 128],
      ...(sub ? [[sub, 56, fg, 205, 'Gowun Dodum']] : []),
    ],
    1024,
    256,
    { bg, radius: 20 },
  );
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, roughness: 0.5 });
  nightGlow(m, 0.15, 1.15);
  const mesh = add(new THREE.BoxGeometry(w, h, 0.12), [M.dark, M.dark, M.dark, M.dark, m, M.dark], x, y, z, G.scene, false);
  mesh.rotation.y = rotY;
  return mesh;
}

/* ── String lights & lamps ────────────────────────── */

function stringLights(ax, ay, az, bx, by, bz, n = 22, sag = 0.8) {
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff3d8, emissive: 0xffffff, emissiveIntensity: 1 }), n);
  nightGlow(bulbs.material, 0.15, 2.6);
  const pts = [];
  const tmp = new THREE.Object3D();
  const palette = [new THREE.Color(0xffc56b), new THREE.Color(0xffe3a3), new THREE.Color(0xff9bb3), new THREE.Color(0xffd27a)];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const y = ay + (by - ay) * t - sag * (1 - (2 * t - 1) ** 2);
    pts.push(new THREE.Vector3(x, y + 0.05, z));
    tmp.position.set(x, y, z);
    tmp.updateMatrix();
    bulbs.setMatrixAt(i, tmp.matrix);
    bulbs.setColorAt(i, palette[i % palette.length]);
  }
  G.scene.add(bulbs);
  G.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x15151c })));
}

const poolTex = () => softTexture('rgba(255,200,130,0.9)', 'rgba(255,170,80,0)');
let POOL;
function lightPool(x, y, z, r = 2.6, color = 0xffc98a) {
  POOL ??= poolTex();
  const m = new THREE.MeshBasicMaterial({ map: POOL, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  G.nightMats.push({ m, day: 0, night: 0.55, prop: 'opacity' });
  const p = add(new THREE.CircleGeometry(r, 24), m, x, y + 0.02, z, G.scene, false);
  p.rotation.x = -Math.PI / 2;
  p.receiveShadow = false;
  return p;
}

function streetLamp(x, y, z, rotY = 0, real = false) {
  const pole = mat(0x3b3f46, { roughness: 0.5, metalness: 0.4 });
  add(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 8), pole, x, y + 2.2, z);
  const arm = new THREE.Group();
  arm.position.set(x, y + 4.3, z);
  arm.rotation.y = rotY;
  G.scene.add(arm);
  add(new THREE.BoxGeometry(0.06, 0.06, 0.9), pole, 0, 0, 0.45, arm);
  add(new THREE.BoxGeometry(0.3, 0.12, 0.5), pole, 0, -0.04, 0.9, arm);
  const bulb = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0 });
  nightGlow(bulb, 0, 3);
  add(new THREE.BoxGeometry(0.24, 0.03, 0.42), bulb, 0, -0.11, 0.9, arm, false);
  const head = new THREE.Vector3(0, 0, 0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  lightPool(x + head.x, y, z + head.z, 3);
  if (real) pointLight(0xffd29a, 9, 12, x + head.x, y + 4.0, z + head.z);
  collider(x - 0.12, x + 0.12, z - 0.12, z + 0.12);
}

/* ── Ginkgo trees & leaves ────────────────────────── */

const leafTex = (() => {
  let t;
  return () => {
    if (t) return t;
    const [c, g] = makeCanvas(64, 64);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(32, 60);
    g.lineTo(30, 40);
    g.bezierCurveTo(4, 36, 2, 10, 14, 6);
    g.quadraticCurveTo(24, 16, 32, 10);
    g.quadraticCurveTo(40, 16, 50, 6);
    g.bezierCurveTo(62, 10, 60, 36, 34, 40);
    g.closePath();
    g.fill();
    t = canvasTexture(c, { repeat: false });
    return t;
  };
})();

export const treeSpots = [];

function ginkgo(x, y, z, rnd, scale = 1) {
  const tree = makeTree({ x, y, z, scale, kind: 'ginkgo', seed: Math.floor(rnd() * 0xffffffff) });
  treeSpots.push(new THREE.Vector3(x, y, z));
  return tree;
}

function leafCarpet(rnd) {
  const n = 1400;
  const m = new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), m, n);
  const tmp = new THREE.Object3D();
  const golds = [0xf5c13a, 0xe9a521, 0xf7d250, 0xd99c1c, 0xc98a1a];
  for (let i = 0; i < n; i++) {
    const t = treeSpots[i % treeSpots.length];
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 3.2;
    const x = t.x + Math.cos(a) * r;
    const z = t.z + Math.sin(a) * r;
    tmp.position.set(x, heightAt(x, z) + 0.012 + rnd() * 0.004, z);
    tmp.rotation.set(-Math.PI / 2, 0, rnd() * Math.PI * 2);
    tmp.scale.setScalar(0.7 + rnd() * 0.6);
    tmp.updateMatrix();
    inst.setMatrixAt(i, tmp.matrix);
    inst.setColorAt(i, new THREE.Color(golds[Math.floor(rnd() * golds.length)]));
  }
  inst.receiveShadow = true;
  G.scene.add(inst);
}

/** Leaves drifting down from the ginkgo canopies. */
function fallingLeaves() {
  const n = 160;
  const m = new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0xf2bf3a, roughness: 0.9 });
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 0.15), m, n);
  const leaves = [];
  const tmp = new THREE.Object3D();
  const spawn = (l, fresh) => {
    const t = treeSpots[Math.floor(Math.random() * treeSpots.length)];
    l.base = t;
    l.x = t.x + rand(-1.6, 1.6);
    l.z = t.z + rand(-1.6, 1.6);
    l.y = t.y + (fresh ? rand(0.5, 4) : rand(3, 4.4));
    l.ground = heightAt(l.x, l.z) + 0.02;
    l.phase = Math.random() * 10;
    l.rest = 0;
  };
  for (let i = 0; i < n; i++) {
    const l = {};
    spawn(l, true);
    leaves.push(l);
  }
  G.scene.add(inst);
  G.updaters.push((dt, t) => {
    for (let i = 0; i < n; i++) {
      const l = leaves[i];
      if (l.y > l.ground) {
        l.y -= dt * 0.45;
        l.x += Math.sin(t * 1.3 + l.phase) * dt * 0.5;
        l.z += Math.cos(t * 0.9 + l.phase) * dt * 0.3;
        tmp.rotation.set(Math.sin(t * 3 + l.phase) * 1.2, t + l.phase, Math.cos(t * 2.4 + l.phase));
      } else {
        l.rest += dt;
        tmp.rotation.set(-Math.PI / 2, 0, l.phase);
        if (l.rest > 6) spawn(l, false);
      }
      tmp.position.set(l.x, Math.max(l.y, l.ground), l.z);
      tmp.updateMatrix();
      inst.setMatrixAt(i, tmp.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });
}

/* ── Ground ───────────────────────────────────────── */

function slab(minX, maxX, minZ, maxZ, material, y = 0, uv = 4) {
  const m = boxMM(minX, maxX, y - 0.05, y, minZ, maxZ, material, { uv, cast: false });
  m.receiveShadow = true;
  return m;
}

function buildGround() {
  // Keep the core foundation local; the city descriptor owns outer paving/park.
  slab(-24, 24, -28, 30, M.asphalt, -0.01, 5);
  slab(-6.2, 6.2, -8, 30, M.asphalt, 0.0, 5);
  for (const s of [-1, 1]) slab(s * 6.2 - (s > 0 ? 0.9 : 0), s * 6.2 + (s > 0 ? 0 : 0.9), -8, 30, M.pavers, 0.05, 2);
  // plaza pavers around the subway pit
  slab(-10, 10, -19, -8, M.pavers, 0.03, 2);
  slab(-10, -6, -28, -19, M.pavers, 0.03, 2);
  slab(-2, 10, -28, -19, M.pavers, 0.03, 2);
  slab(-6, -2, -28, -26, M.pavers, 0.03, 2);
  // yellow tactile strip
  slab(-0.2, 0.2, -28, -8, mat(0xe8c13a, { roughness: 0.7 }), 0.04, 1);
}

/* ── Alley (Food Street) ──────────────────────────── */

function buildAlley(rnd) {
  for (const side of [-1, 1]) {
    // Two genuine cross-streets connect the original lane to the new loops.
    // Keep the tent, signs, shops and all activity/character coordinates intact.
    for (const [south, north] of [[-4, 7.5], [11.5, 30]]) {
      let z = north;
      while (z > south) {
        const width = Math.min(z - south, 5 + rnd() * 3);
        const height = 7 + rnd() * 7;
        const minX = side < 0 ? -12.2 : 6.2;
        building(minX, minX + 6, z - width, z, height, side < 0 ? 'px' : 'nx', rnd);
        z -= width;
      }
    }
  }
  neonSign('노래방', '#ff4fa0', -6.12, 3.7, 12, Math.PI / 2, 2.4, 0.9);
  neonSign('호프', '#ffd23f', -6.12, 3.5, 21, Math.PI / 2, 1.8, 0.85);
  neonSign('PC방', '#52b6ff', 6.12, 3.8, -2.5, -Math.PI / 2, 2.0, 0.85);
  neonSign('분식', '#ff8a3d', 6.12, 3.4, 21, -Math.PI / 2, 1.8, 0.85);
  bladeSign('치킨', '#ffcf3f', -5.75, 4.4, 6.5);
  bladeSign('헤어', '#c48bff', 5.75, 4.6, 14);
  pointLight(0xff4fa0, 7, 9, -5.4, 3.4, 12);
  for (const z of [8.5, 15, 22, -5]) stringLights(-6.1, 4.8, z, 6.1, 4.8, z + 0.4);
  streetLamp(5.6, 0, 18, -Math.PI / 2);
  streetLamp(-5.6, 0, -3.5, Math.PI / 2);

  // potted plants & bins
  const potM = mat(0x9b5b3a);
  const leafM = mat(0x3d7a4a, { roughness: 0.9 });
  for (const [x, z] of [[-5.4, 16.5], [5.3, 12.5], [5.3, 25]]) {
    add(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 12), potM, x, 0.28, z);
    add(new THREE.IcosahedronGeometry(0.42, 1), leafM, x, 0.8, z);
    collider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  }
  buildVending();
}

function buildVending() {
  const g = new THREE.Group();
  g.position.set(5.75, 0, -4.5);
  g.rotation.y = -Math.PI / 2;
  add(new THREE.BoxGeometry(0.95, 1.9, 0.7), mat(0xd8dde6, { roughness: 0.5 }), 0, 0.95, 0, g);
  const [c, gg] = makeCanvas(256, 384);
  gg.fillStyle = '#e9f6ff';
  gg.fillRect(0, 0, 256, 384);
  const cols = ['#ffd64a', '#ff7a7a', '#5ac8fa', '#7ddc6f', '#ff9f43', '#c58bff'];
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 4; k++) {
      gg.fillStyle = cols[(r * 4 + k) % cols.length];
      roundRect(gg, 18 + k * 58, 20 + r * 80, 42, 58, 10);
      gg.fill();
      gg.fillStyle = '#c4313a';
      gg.fillRect(22 + k * 58, 84 + r * 80, 34, 6);
    }
  }
  const tex = canvasTexture(c, { repeat: false });
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff });
  nightGlow(m, 0.25, 1.1);
  add(new THREE.PlaneGeometry(0.75, 1.15), m, 0, 1.25, 0.351, g, false);
  G.scene.add(g);
  collider(5.4, 6.2, -5.0, -4.0);
}

/* ── The pojangmacha tent ─────────────────────────── */

export const tentMats = {};
export const lanterns = [];

function lanternTexture(text) {
  const [c, g] = makeCanvas(512, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff6a4a');
  grad.addColorStop(0.5, '#ffb08a');
  grad.addColorStop(1, '#ff5a3a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(160,40,20,0.35)';
  g.lineWidth = 2;
  for (let y = 8; y < 256; y += 12) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  const chars = [...text];
  g.fillStyle = '#3a1208';
  g.font = `${Math.floor(220 / chars.length)}px Jua, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const cx of [128, 384]) chars.forEach((ch, i) => g.fillText(ch, cx, (256 / chars.length) * (i + 0.5) + 4));
  return canvasTexture(c, { repeat: false });
}

function lantern(text, x, y, z, real) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const tex = lanternTexture(text);
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, side: THREE.DoubleSide });
  nightGlow(m, 0.25, 1.4);
  const body = add(new THREE.SphereGeometry(0.28, 24, 16), m, 0, 0, 0, grp, false);
  body.scale.set(1, 1.25, 1);
  const capM = mat(0x2a1a14);
  add(new THREE.CylinderGeometry(0.12, 0.15, 0.06, 16), capM, 0, 0.35, 0, grp, false);
  add(new THREE.CylinderGeometry(0.15, 0.12, 0.06, 16), capM, 0, -0.35, 0, grp, false);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), capM, 0, 0.55, 0, grp, false);
  G.scene.add(grp);
  const light = real ? pointLight(0xff8a5a, 6, 10, x, y - 0.1, z) : null;
  lanterns.push({ grp, light, phase: Math.random() * 6 });
}

function buildTent() {
  const initial = new Set(G.scene.children);
  initial.colliderStart = G.colliders.length;
  const { minX, maxX, minZ, maxZ, wallH, ridgeH, valanceDrop } = TENT;
  const W = maxX - minX;
  const D = maxZ - minZ;
  const midZ = (minZ + maxZ) / 2;
  const ft = tiled(fabric('#ff7a22'), 4, 2);
  const tarp = mat(0xffffff, { map: ft.map, normalMap: ft.normalMap, emissive: 0xff5a10, emissiveIntensity: 0.1, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
  nightGlow(tarp, 0.0, 0.32);
  tentMats.tarp = tarp;

  add(new THREE.PlaneGeometry(W, wallH), tarp, TX, wallH / 2, minZ, G.scene, false);
  for (const x of [minX, maxX]) {
    const side = add(new THREE.PlaneGeometry(D, wallH), tarp, x, wallH / 2, midZ, G.scene, false);
    side.rotation.y = Math.PI / 2;
    const tri = new THREE.Shape([new THREE.Vector2(-minZ, wallH), new THREE.Vector2(-maxZ, wallH), new THREE.Vector2(-midZ, ridgeH)]);
    add(new THREE.ShapeGeometry(tri), tarp, x, 0, 0, G.scene, false).rotation.y = Math.PI / 2;
  }
  const open = 2.2;
  add(new THREE.PlaneGeometry(maxX - (TX + open), wallH), tarp, (TX + open + maxX) / 2, wallH / 2, maxZ, G.scene, false);
  add(new THREE.PlaneGeometry(TX - open - minX, wallH), tarp, (minX + TX - open) / 2, wallH / 2, maxZ, G.scene, false);
  // Keep the real header/roller above the 1.9m player, not just its query.
  const rollerRadius = 0.075, openingHeight = wallH - valanceDrop;
  add(new THREE.PlaneGeometry(open * 2, valanceDrop), tarp, TX, wallH - valanceDrop / 2, maxZ, G.scene, false);
  add(new THREE.CylinderGeometry(rollerRadius, rollerRadius, open * 2, 12), tarp, TX, openingHeight + rollerRadius, maxZ - rollerRadius - 0.02, G.scene, false).rotation.z = Math.PI / 2;
  // closed flap (daytime)
  const flap = add(new THREE.PlaneGeometry(open * 2, openingHeight), tarp, TX, openingHeight / 2, maxZ + 0.01, G.scene, false);
  tentMats.flap = flap;

  const valTex = textTexture([['포장마차 · 떡볶이 · 오뎅 · 소주', 64, '#fff6e0', 64]], 1024, 128);
  const valM = new THREE.MeshStandardMaterial({ map: valTex, emissiveMap: valTex, transparent: true, emissive: 0xffffff, depthWrite: false });
  nightGlow(valM, 0.05, 0.4);
  tentMats.valance = valM;
  const valance = add(new THREE.PlaneGeometry(open * 2, valanceDrop * 0.88), valM, TX, wallH - valanceDrop / 2, maxZ + 0.015, G.scene, false);
  valance.renderOrder = 2;

  const half = D / 2;
  const slopeL = Math.hypot(half, ridgeH - wallH);
  const a = Math.atan2(ridgeH - wallH, half);
  add(new THREE.PlaneGeometry(W + 0.3, slopeL), tarp, TX, (wallH + ridgeH) / 2, midZ + half / 2, G.scene, true).rotation.x = -Math.PI / 2 + a;
  add(new THREE.PlaneGeometry(W + 0.3, slopeL), tarp, TX, (wallH + ridgeH) / 2, midZ - half / 2, G.scene, true).rotation.x = -Math.PI / 2 - a;

  const poleM = mat(0xc9ccd2, { metalness: 0.7, roughness: 0.35 });
  for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ], [TX - open, maxZ], [TX + open, maxZ]]) add(new THREE.CylinderGeometry(0.03, 0.03, wallH, 8), poleM, x, wallH / 2, z);
  add(new THREE.CylinderGeometry(0.03, 0.03, W, 8), poleM, TX, ridgeH - 0.03, midZ).rotation.z = Math.PI / 2;
  const bulbM = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffd08a, emissiveIntensity: 3 });
  nightGlow(bulbM, 0.3, 2.2);
  for (const dx of [-1.6, 0, 1.6]) {
    add(new THREE.CylinderGeometry(0.005, 0.005, 0.45, 4), poleM, TX + dx, ridgeH - 0.25, -0.1, G.scene, false);
    add(new THREE.SphereGeometry(0.07, 12, 10), bulbM, TX + dx, ridgeH - 0.5, -0.1, G.scene, false);
  }
  tentMats.light = pointLight(0xffb066, 4, 14, TX, 2.35, -0.3, { day: 2 });

  const menu = textTexture(
    [
      ['메뉴', 70, '#c0392b', 60],
      ['떡볶이 4,000    오뎅 1,000', 56, '#3a2416', 150, 'Gowun Dodum'],
      ['라면 3,500    순대 4,000', 56, '#3a2416', 225, 'Gowun Dodum'],
      ['김밥 3,000    소주 5,000', 56, '#3a2416', 300, 'Gowun Dodum'],
    ],
    768,
    360,
    { bg: '#fff3dc' },
  );
  add(new THREE.PlaneGeometry(2.2, 1.03), mat(0xffffff, { map: menu, roughness: 0.9 }), TX + 0.9, 1.75, minZ + 0.02, G.scene, false);

  add(new THREE.BoxGeometry(4.8, COUNTER_Y - 0.03, 0.6), worldMat(wood('#8a3a24')), TX, (COUNTER_Y - 0.03) / 2, -1.0);
  add(new THREE.BoxGeometry(4.95, 0.05, 0.72), M.steel, TX, COUNTER_Y - 0.02, -1.0);
  const stripe = mat(0xfff0d0, { emissive: 0xffd9a0, emissiveIntensity: 0.4 });
  add(new THREE.BoxGeometry(4.8, 0.08, 0.01), stripe, TX, 0.6, -0.69, G.scene, false);

  const stoolM = toon('#ff6a2b');
  for (const p of STOOLS) add(new THREE.CylinderGeometry(0.17, 0.2, 0.47, 16), stoolM, p.x, 0.235, p.z);

  const pan = new THREE.Group();
  pan.position.set(TX - 1.95, COUNTER_Y, -1.08);
  add(new THREE.CylinderGeometry(0.4, 0.36, 0.1, 28), M.steel, 0, 0.05, 0, pan);
  add(new THREE.CylinderGeometry(0.37, 0.37, 0.02, 28), mat(0xd42a17, { emissive: 0x500800, roughness: 0.25 }), 0, 0.09, 0, pan, false);
  const riceM = mat(0xf2d8c4, { roughness: 0.5 });
  for (let i = 0; i < 16; i++) add(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 8), riceM, rand(-0.25, 0.25), 0.11, rand(-0.25, 0.25), pan, false).rotation.set(Math.PI / 2, 0, rand(0, Math.PI));
  G.scene.add(pan);

  const pot = new THREE.Group();
  pot.position.set(TX - 1.15, COUNTER_Y, -1.12);
  add(new THREE.CylinderGeometry(0.27, 0.25, 0.28, 24), M.steel, 0, 0.14, 0, pot);
  add(new THREE.CylinderGeometry(0.255, 0.255, 0.02, 24), mat(0xd9a45a, { emissive: 0x3a2000, roughness: 0.2 }), 0, 0.25, 0, pot, false);
  const stickM = mat(0xdcc08f);
  const odengM = mat(0xe3b277, { roughness: 0.6 });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Group();
    const ang = (i / 7) * Math.PI * 2;
    s.position.set(Math.cos(ang) * 0.13, 0.25, Math.sin(ang) * 0.13);
    s.rotation.set(Math.sin(ang) * 0.35, 0, -Math.cos(ang) * 0.35);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 5), stickM, 0, 0.1, 0, s, false);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.09, 0.05, 0.015), odengM, k % 2 ? 0.02 : -0.02, -0.02 + k * 0.05, 0, s, false);
    pot.add(s);
  }
  G.scene.add(pot);

  const sojuM = mat(0x2f9e4f, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  for (const [x, z] of [[TX + 1.3, -1.2], [TX + 1.45, -1.25], [TX + 2.0, -1.15], [TX - 0.2, -1.2]]) soju(sojuM, x, COUNTER_Y, z);

  lantern('포장마차', maxX + 0.15, 2.2, maxZ + 0.15, true);
  lantern('오뎅', minX - 0.15, 2.1, maxZ + 0.15, false);

  // opening-hours sign: a reading exercise during the day
  const hours = textTexture(
    [
      ['영업시간', 64, '#7a2a12', 60],
      ['19:00 ~ 03:00', 72, '#3a1a10', 140, 'Gowun Dodum'],
    ],
    512,
    200,
    { bg: '#fff1d6', border: '#c0392b' },
  );
  const sign = add(new THREE.PlaneGeometry(0.9, 0.35), mat(0xffffff, { map: hours }), TX + 2.6, 1.25, maxZ + 0.04, G.scene, false);
  add(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), poleM, TX + 2.6, 0.55, maxZ + 0.04);
  tentMats.sign = sign;

  const tableM = toon('#d9452b');
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 20), tableM, -4.7, 0.62, 4.5);
  add(new THREE.CylinderGeometry(0.06, 0.25, 0.6, 12), tableM, -4.7, 0.3, 4.5);
  soju(sojuM, -4.55, 0.64, 4.4);
  for (const [x, z] of [[-4.7, 3.7], [-4.7, 5.3]]) add(new THREE.CylinderGeometry(0.17, 0.2, 0.47, 16), stoolM, x, 0.235, z);
  collider(-5.25, -4.15, 3.5, 5.5);

  const c = SPOTS.cat;
  add(new THREE.BoxGeometry(0.62, 0.4, 0.45), toon('#4b7bd1'), c.x, 0.2, c.z);
  add(new THREE.BoxGeometry(0.62, 0.4, 0.45), toon('#e2b23a'), c.x, 0.6, c.z);
  collider(c.x - 0.32, c.x + 0.32, c.z - 0.25, c.z + 0.25);

  collider(minX, maxX, minZ - 0.15, minZ + 0.1);
  collider(minX - 0.12, minX + 0.12, minZ, maxZ);
  collider(maxX - 0.12, maxX + 0.12, minZ, maxZ);
  collider(minX, TX - open, maxZ - 0.1, maxZ + 0.1);
  collider(TX + open, maxX, maxZ - 0.1, maxZ + 0.1);
  collider(minX, maxX, minZ, -0.66);
  const room = registerSeoulShell('food', initial, { minX, maxX, minZ, maxZ });
  // The thin tarp panels also need directional cutaway even below 3m.
  for (const mesh of G.scene.children.filter(o => !initial.has(o))) {
    if (mesh.isMesh && mesh.material === tarp && !room.walls.includes(mesh) && !room.roofs.includes(mesh)) room.walls.push(mesh);
  }
  if (!room.walls.includes(valance) && !room.roofs.includes(valance)) room.walls.push(valance);
  registerInterior(room);
}

export function setTentOpen(open) {
  tentMats.flap.visible = !open;
  G.colliders = G.colliders.filter((c) => !c.flap);
  if (!open) G.colliders.push({ minX: TX - 2.2, maxX: TX + 2.2, minZ: TENT.maxZ - 0.1, maxZ: TENT.maxZ + 0.1, minY: 0, maxY: TENT.wallH, role: 'wall', interiorId: 'seoul-food-room', flap: true });
}

function soju(m, x, y, z) {
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), m, x, y + 0.08, z);
  add(new THREE.CylinderGeometry(0.018, 0.04, 0.08, 12), m, x, y + 0.2, z);
  add(new THREE.CylinderGeometry(0.046, 0.046, 0.06, 12, 1, true), mat(0xf4f1e6), x, y + 0.08, z, G.scene, false);
}

/* ── Plaza: convenience store, café, chimaek, subway ─ */

function shopShell(side, rnd) {
  // side -1 = left block (store), +1 = right block (café)
  const s = side;
  const outer = s < 0 ? [-24, -10] : [10, 24];
  const room = s < 0 ? [-18, -10] : [10, 18];
  const facadeM = s < 0 ? M.cream : M.pink;
  const fx = s < 0 ? -10 : 10;
  // ground-floor solid pieces around the room
  boxMM(s < 0 ? -24 : 18, s < 0 ? -18 : 24, 0, 3.6, -28, -8, facadeM, { collide: true, block: true });
  boxMM(room[0], room[1], 0, 3.6, -28, -20, facadeM, { collide: true, block: true });
  boxMM(room[0], room[1], 0, 3.6, -11, -8, facadeM, { collide: true, block: true });
  // upper floors with a windowed facade toward the plaza
  building(outer[0], outer[1], -28, -8, 7.4, s < 0 ? 'px' : 'nx', rnd, { y0: 3.6, shop: false, collide: false, base: s < 0 ? '#b9a58e' : '#e8b9bf' });
  // room interior: floor, ceiling, walls (inner faces come from the solid pieces)
  const floor = s < 0 ? M.tiles : M.woodLight;
  boxMM(room[0], room[1], -0.05, 0.02, -20, -11, floor, { uv: 2, cast: false });
  boxMM(room[0], room[1], 3.4, 3.6, -20, -11, s < 0 ? M.white : M.cream, { cast: false });
  // glass storefront with a door gap
  const gx0 = fx - 0.05;
  const gx1 = fx + 0.05;
  boxMM(gx0, gx1, 0, 3.0, -20, -16.5, M.glass, { cast: false });
  boxMM(gx0, gx1, 0, 3.0, -14.5, -11, M.glass, { cast: false });
  collider(fx - 0.15, fx + 0.15, -20, -16.5);
  collider(fx - 0.15, fx + 0.15, -14.5, -11);
  for (const z of [-20, -16.5, -14.5, -11]) boxMM(fx - 0.08, fx + 0.08, 0, 3.0, z - 0.06, z + 0.06, M.dark);
  boxMM(fx - 0.1, fx + 0.1, 3.0, 3.4, -20, -11, M.dark, { cast: false });
  // warm light spilling onto the plaza
  lightPool(fx + s * -1.6, 0, -15.5, 3.2, s < 0 ? 0xc8f0ff : 0xffd0a0);
}

function buildStore(rnd) {
  const initial = new Set(G.scene.children);
  initial.colliderStart = G.colliders.length;
  shopShell(-1, rnd);
  fascia('편의점 24', '24시간 · open 24 hours', '#1f8a4c', '#ffffff', -9.88, 3.25, -15.5, Math.PI / 2, 8.6, 0.6);
  // chimaek pub sign above
  const chimaek = textTexture([['치맥', 170, '#ffffff', 120], ['치킨 + 맥주', 54, '#ffd23f', 215, 'Gowun Dodum']], 768, 256, { bg: '#2a1a14', border: '#ffb000' });
  const cm = new THREE.MeshStandardMaterial({ map: chimaek, emissiveMap: chimaek, emissive: 0xffffff });
  nightGlow(cm, 0.2, 1.4);
  add(new THREE.PlaneGeometry(3.4, 1.15), cm, -9.92, 5.6, -12.4, G.scene, false).rotation.y = Math.PI / 2;
  stringLights(-9.9, 7.4, -9, -9.9, 7.4, -20, 18, 0.5);

  // fridges along the back wall
  const fridge = new THREE.MeshStandardMaterial({ color: 0xe9f4ff, emissive: 0xcfe8ff, emissiveIntensity: 0.8, roughness: 0.2 });
  boxMM(-18, -17.3, 0, 2.4, -19.8, -11.2, fridge, { collide: true, cast: false });
  const bottleCols = [0xff6b6b, 0x5ac8fa, 0xffd64a, 0x7ddc6f, 0xffffff, 0xff9f43, 0x9b7bff];
  const bottles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), mat(0xffffff, { roughness: 0.3 }), 220);
  const tmp = new THREE.Object3D();
  let i = 0;
  for (let shelf = 0; shelf < 5; shelf++) {
    for (let k = 0; k < 44 && i < 220; k++, i++) {
      tmp.position.set(-17.25, 0.35 + shelf * 0.42, -19.6 + k * 0.19);
      tmp.updateMatrix();
      bottles.setMatrixAt(i, tmp.matrix);
      bottles.setColorAt(i, new THREE.Color(bottleCols[Math.floor(rnd() * bottleCols.length)]));
    }
  }
  G.scene.add(bottles);
  // aisles of shelves with colourful products
  const shelfM = mat(0xf2f2f2, { roughness: 0.5 });
  const products = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.2, 0.12), mat(0xffffff, { roughness: 0.6 }), 360);
  const prodCols = [0xff6b6b, 0x5ac8fa, 0xffd64a, 0x7ddc6f, 0xff9f43, 0xc58bff, 0xf4f1ea, 0xe85d9a];
  let p = 0;
  for (const z of [-14.2, -17.4]) {
    boxMM(-16.6, -13.4, 0, 1.5, z - 0.35, z + 0.35, shelfM, { collide: true });
    for (let lvl = 0; lvl < 3; lvl++) {
      for (let k = 0; k < 17; k++) {
        for (const side of [-1, 1]) {
          if (p >= 360) break;
          tmp.position.set(-16.45 + k * 0.18, 0.12 + lvl * 0.48 + 0.1, z + side * 0.42);
          tmp.rotation.y = rnd() * 0.2;
          tmp.updateMatrix();
          products.setMatrixAt(p, tmp.matrix);
          products.setColorAt(p++, new THREE.Color(prodCols[Math.floor(rnd() * prodCols.length)]));
        }
      }
    }
  }
  products.castShadow = true;
  G.scene.add(products);
  // counter + register
  boxMM(-12.7, -12.1, 0, 1.0, -13.9, -11.3, mat(0x2e9a5a, { roughness: 0.5 }), { collide: true });
  boxMM(-12.68, -12.12, 1.0, 1.04, -13.9, -11.3, mat(0xf4f4f4), { cast: false });
  box(0.3, 0.22, 0.3, M.dark, -12.4, 1.04, -12.2);
  // ceiling light panels
  const panel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 });
  for (const z of [-13, -15.5, -18]) boxMM(-16.5, -11.5, 3.32, 3.4, z - 0.25, z + 0.25, panel, { cast: false });
  pointLight(0xe8f4ff, 7, 12, -14, 3.1, -15.5, { day: 5 });
  registerSeoulShell('store', initial, { minX: -18, maxX: -10, minZ: -20, maxZ: -11 });
}

function buildCafe(rnd) {
  const initial = new Set(G.scene.children);
  initial.colliderStart = G.colliders.length;
  shopShell(1, rnd);
  fascia('카페 봄', 'Café Bom · coffee & cake', '#f7d6dc', '#b3445e', 9.88, 3.25, -15.5, -Math.PI / 2, 8.6, 0.6);
  // string lights + flower garland on the facade (like the key art)
  stringLights(9.92, 3.75, -20.4, 9.92, 3.75, -10.6, 22, 0.35);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xffffff, { roughness: 0.8 }), 70);
  const tmp = new THREE.Object3D();
  const fc = [0xe85d75, 0xffffff, 0xf7b2c4, 0xd9364f, 0x7bb06a];
  for (let i = 0; i < 70; i++) {
    const t = i / 69;
    const z = -16.6 + t * 2.2;
    const y = 2.95 + Math.sin(t * Math.PI) * -0.25 + rand(-0.05, 0.05);
    tmp.position.set(9.9, y, z);
    tmp.updateMatrix();
    flowers.setMatrixAt(i, tmp.matrix);
    flowers.setColorAt(i, new THREE.Color(fc[i % fc.length]));
  }
  G.scene.add(flowers);
  // striped awning over the windows
  const [c, g] = makeCanvas(256, 64);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = (x / 32) % 2 ? '#ffffff' : '#e86b84';
    g.fillRect(x, 0, 32, 64);
  }
  const awn = add(new THREE.PlaneGeometry(8.8, 1.1), mat(0xffffff, { map: canvasTexture(c), side: THREE.DoubleSide }), 9.45, 2.85, -15.5, G.scene, true);
  awn.rotation.set(0, -Math.PI / 2, 0);
  awn.rotation.x = 0;
  awn.rotateX(-0.9);
  awn.material.map.repeat.set(4, 1);

  // counter, espresso machine, cake case
  boxMM(16.2, 16.9, 0, 1.0, -19.5, -13.2, worldMat(wood('#7a4a2e')), { collide: true });
  boxMM(16.15, 16.95, 1.0, 1.05, -19.5, -13.2, mat(0xf2ede6), { cast: false });
  box(0.5, 0.45, 0.4, M.steel, 16.6, 1.05, -18.6);
  box(0.25, 0.05, 0.25, mat(0x2a2a30), 16.6, 1.5, -18.6);
  const caseM = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false });
  boxMM(15.3, 16.1, 0, 0.8, -15.2, -13.4, mat(0xf6f2ec), { collide: true });
  boxMM(15.3, 16.1, 0.8, 1.35, -15.2, -13.4, caseM, { cast: false });
  const cakeCols = [0xffb3c6, 0xfff1d0, 0xc98b5a, 0xff6b81, 0xfafafa];
  for (let i = 0; i < 6; i++) {
    const cz = -15 + (i % 3) * 0.6;
    const cy = 0.82 + Math.floor(i / 3) * 0.26;
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 16), toon(cakeCols[i % cakeCols.length]), 15.7, cy + 0.06, cz, G.scene, false);
    add(new THREE.SphereGeometry(0.03, 8, 6), toon('#e8233a'), 15.7, cy + 0.14, cz, G.scene, false);
  }
  // tables & chairs
  const tableM = worldMat(wood('#c99a6a'));
  for (const [tx, tz] of [[12.4, -12.6], [12.4, -18.6], [14.3, -15.6]]) {
    add(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 20), tableM, tx, 0.75, tz);
    add(new THREE.CylinderGeometry(0.05, 0.22, 0.73, 10), M.dark, tx, 0.37, tz);
    collider(tx - 0.45, tx + 0.45, tz - 0.45, tz + 0.45);
    for (const dx of [-0.75, 0.75]) {
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), toon('#e8b9bf'), tx + dx, 0.46, tz);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 6), M.dark, tx + dx, 0.22, tz);
    }
    add(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 10), toon('#ffffff'), tx + 0.15, 0.82, tz + 0.1, G.scene, false);
  }
  // pendant lamps
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffc070, emissiveIntensity: 1.5 });
  nightGlow(lampM, 0.8, 2.6);
  for (const [lx, lz] of [[12.4, -12.6], [12.4, -18.6], [14.3, -15.6]]) {
    add(new THREE.CylinderGeometry(0.005, 0.005, 1.0, 4), M.dark, lx, 2.9, lz, G.scene, false);
    add(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#3a3a40', { side: THREE.DoubleSide }), lx, 2.45, lz, G.scene, false);
    add(new THREE.SphereGeometry(0.08, 12, 8), lampM, lx, 2.38, lz, G.scene, false);
  }
  // menu board & plant
  const menu = textTexture(
    [
      ['MENU', 60, '#fff', 50],
      ['아메리카노  4,500', 44, '#ffe6ea', 120, 'Gowun Dodum'],
      ['카페라테  5,000', 44, '#ffe6ea', 180, 'Gowun Dodum'],
      ['딸기 케이크  6,500', 44, '#ffe6ea', 240, 'Gowun Dodum'],
    ],
    512,
    300,
    { bg: '#2f2a2e' },
  );
  add(new THREE.PlaneGeometry(1.6, 0.95), mat(0xffffff, { map: menu }), 17.98, 2.2, -16.4, G.scene, false).rotation.y = -Math.PI / 2;
  add(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 12), toon('#c98a5a'), 17.5, 0.2, -11.6);
  add(new THREE.IcosahedronGeometry(0.4, 1), toon('#5e9a5a'), 17.5, 0.8, -11.6);
  pointLight(0xffd4a0, 6, 12, 14, 3.0, -15.5, { day: 4 });

  // outdoor table on the plaza
  add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18), toon('#ffffff'), 8.4, 0.72, -10.6);
  add(new THREE.CylinderGeometry(0.04, 0.2, 0.7, 8), M.dark, 8.4, 0.35, -10.6);
  const umb = add(new THREE.ConeGeometry(1.2, 0.5, 12, 1, true), toon('#e86b84', { side: THREE.DoubleSide }), 8.4, 2.3, -10.6);
  umb.castShadow = true;
  add(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), M.dark, 8.4, 1.4, -10.6);
  collider(8.0, 8.8, -11.0, -10.2);
  registerSeoulShell('cafe', initial, { minX: 10, maxX: 18, minZ: -20, maxZ: -11 });
}

function buildSubway() {
  // Replace the sealed decorative stair pit in its original footprint with a
  // level, open waiting pavilion. SPOTS.subway remains the original story stop.
  const room = buildRoom({ id: 'seoul-subway-room', city: 'seoul', category: 'subway',
    x: -4, z: -22.6, w: 4, d: 6.8, h: 2.9, open: true, wallMaterial: M.steel, roofMaterial: M.glass });
  const st = textTexture([['홍대입구역', 112, '#ffffff', 110], ['Hongik Univ. · 2호선 / Line 2', 52, '#dce8ff', 240, 'Gowun Dodum']], 1024, 320, { bg: '#2556b8' });
  const sm = nightGlow(mat(0xffffff, { map: st, emissiveMap: st, emissive: 0xffffff }), 0.25, 1.3);
  const fascia = add(new THREE.PlaneGeometry(4, 1), sm, -4, 2.5, -18.98, G.scene, false);
  room.roofs[0].attach(fascia);
  registerInterior(room);
  lightPool(-4, 0, -18.7, 2.2, 0xd8ecff);
}

/* ── Terrace, stairs, studio, lookout ─────────────── */

function buildTerrace(rnd) {
  const top = M.pavers;
  const wall = M.stone;
  const mk = (minX, maxX, minZ, maxZ) => boxMM(minX, maxX, -0.2, TERRACE_Y, minZ, maxZ, [wall, wall, top, wall, wall, wall], { uv: 2.5, block: true });
  mk(-16, 3, -46, -28);
  mk(7, 16, -46, -28);
  mk(3, 7, -46, -32);
  collider(-16, 3, -28.15, -27.85);
  collider(7, 16, -28.15, -27.85);
  collider(2.85, 3.15, -32, -28);
  collider(6.85, 7.15, -32, -28);
  // stone stairs
  const n = 8;
  for (let i = 0; i < n; i++) {
    const zA = -28 - (i * 4) / n;
    boxMM(3, 7, -0.2, ((i + 1) * TERRACE_Y) / n, zA - 4 / n, zA, [wall, wall, M.concrete, wall, wall, wall], { uv: 1.5, cast: false });
  }
  // handrails
  const rail = mat(0x6a6f78, { metalness: 0.6, roughness: 0.4 });
  for (const x of [3.25, 6.75]) {
    const pts = [new THREE.Vector3(x, 1.0, -27.8), new THREE.Vector3(x, 1.0 + TERRACE_Y, -32.2)];
    const tube = add(new THREE.TubeGeometry(new THREE.LineCurve3(pts[0], pts[1]), 1, 0.03, 6), rail, 0, 0, 0, G.scene, false);
    tube.castShadow = true;
    for (let i = 0; i <= 2; i++) box(0.04, 1.0, 0.04, rail, x, (i * TERRACE_Y) / 2, -27.9 - i * 2.1);
  }
  // terrace-edge railing above the retaining wall
  for (const [a, b] of [[-16, 3], [7, 16]]) {
    boxMM(a, b, TERRACE_Y + 0.95, TERRACE_Y + 1.0, -28.3, -28.25, rail, { cast: false });
    for (let x = a; x <= b; x += 1.5) box(0.05, 1.0, 0.05, rail, x, TERRACE_Y, -28.28);
  }
  // shrubs along the wall foot (key-art vibe)
  const shrub = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, flatShading: true, roughness: 0.95 });
  for (let i = 0; i < 12; i++) {
    const x = -15 + i * 2.6 + rnd();
    if (x > 2.5 && x < 7.5) continue;
    add(new THREE.IcosahedronGeometry(0.4 + rnd() * 0.25, 0), shrub, x, TERRACE_Y + 0.25, -28.9 - rnd() * 0.4);
  }
}

let studioMirror;
export function studioMirrorVisible(on) {
  if (studioMirror) studioMirror.visible = on && !studioMirror.userData.cutawayHidden;
}

function buildStudio(rnd) {
  const initial = new Set(G.scene.children);
  initial.colliderStart = G.colliders.length;
  const y = TERRACE_Y;
  const wallM = M.white;
  boxMM(-16.3, -16, y, y + 3.6, -44, -31, wallM, { collide: true, block: true });
  boxMM(-16, -6, y, y + 3.6, -44.3, -44, wallM, { collide: true, block: true });
  boxMM(-16, -6, y, y + 3.6, -31, -30.7, wallM, { collide: true, block: true });
  boxMM(-16, -6, y - 0.01, y + 0.03, -44, -31, M.wood, { uv: 2, cast: false });
  boxMM(-16.3, -6, y + 3.4, y + 3.6, -44.3, -30.7, M.white, { cast: false });
  building(-16.3, -6, -44.3, -30.7, 5.6, 'px', rnd, { y0: y + 3.6, shop: false, collide: false, base: '#c9c4bd' });
  // glass front with door gap
  boxMM(-6.05, -5.95, y, y + 3.0, -44, -39, M.glass, { cast: false });
  boxMM(-6.05, -5.95, y, y + 3.0, -36, -31, M.glass, { cast: false });
  collider(-6.15, -5.85, -44, -39);
  collider(-6.15, -5.85, -36, -31);
  for (const z of [-44, -39, -36, -31]) boxMM(-6.08, -5.92, y, y + 3.0, z - 0.06, z + 0.06, M.dark);
  boxMM(-6.1, -5.9, y + 3.0, y + 3.6, -44, -31, M.dark, { cast: false });
  fascia('별빛 엔터 연습실', 'STARLIGHT ENT. · Practice Studio', '#1d1b3a', '#ffe9a8', -5.88, y + 3.3, -37.5, Math.PI / 2, 8, 0.6);

  // the mirror wall
  studioMirror = new Reflector(new THREE.PlaneGeometry(12.6, 2.6), {
    textureWidth: 768,
    textureHeight: 192,
    color: 0xb8c4c8,
  });
  studioMirror.position.set(-15.97, y + 1.45, -37.5);
  studioMirror.rotation.y = Math.PI / 2;
  G.scene.add(studioMirror);
  // barre, speakers, ring light, posters
  const steel = M.steel;
  const barre = add(new THREE.CylinderGeometry(0.03, 0.03, 12, 8), steel, -15.6, y + 1.05, -37.5, G.scene, false);
  barre.rotation.x = Math.PI / 2;
  for (const z of [-42.5, -32.5]) box(0.5, 1.1, 0.5, mat(0x1d1d22, { roughness: 0.4 }), -15.4, y, z, { collide: true });
  const poster = (lines, bg, x, z, ry) => {
    const t = textTexture(lines, 384, 512, { bg });
    add(new THREE.PlaneGeometry(0.9, 1.2), mat(0xffffff, { map: t }), x, y + 1.9, z, G.scene, false).rotation.y = ry;
  };
  poster([['데뷔까지', 64, '#fff', 180], ['D-100', 120, '#ffd23f', 300], ['화이팅!', 60, '#fff', 420]], '#3b2a6b', -9, -31.03, Math.PI);
  poster([['연습', 100, '#3a1a10', 200], ['또 연습', 80, '#c0392b', 330]], '#fff3dc', -12, -31.03, Math.PI);
  // whiteboard: daily word quiz
  const wb = textTexture(
    [
      ['오늘의 단어', 72, '#2b3a8a', 80],
      ['Word of the day quiz', 40, '#555', 150, 'Gowun Dodum'],
      ['떡볶이 · 커피 · 지하철 · 한강', 44, '#c0392b', 240, 'Gowun Dodum'],
    ],
    768,
    320,
    { bg: '#ffffff', border: '#9aa0a8' },
  );
  add(new THREE.PlaneGeometry(2.4, 1.0), mat(0xffffff, { map: wb, roughness: 0.3 }), -9.2, y + 1.6, -43.97, G.scene, false);
  const panel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.1 });
  for (const z of [-41, -37.5, -34]) boxMM(-15, -7, y + 3.33, y + 3.4, z - 0.2, z + 0.2, panel, { cast: false });
  pointLight(0xfff4e8, 7, 14, -11, y + 3.0, -37.5, { day: 5 });
  const room = registerSeoulShell('studio', initial, { minX: -16, maxX: -6, minZ: -44, maxZ: -31 }, y);
  // Mirror is a rear-wall child and must not remain an opaque slab in cutaway.
  const rear = room.walls.find(m => m.position.x < -16);
  if (rear && !room.walls.includes(studioMirror)) { rear.attach(studioMirror); registerInterior(room); }
}

function buildLookout(rnd) {
  const y = TERRACE_Y;
  const rail = mat(0x5c626c, { metalness: 0.6, roughness: 0.4 });
  boxMM(-16, 16, y + 1.0, y + 1.06, -45.95, -45.85, rail, { cast: false });
  boxMM(-16, 16, y + 0.5, y + 0.53, -45.94, -45.86, rail, { cast: false });
  for (let x = -16; x <= 16; x += 1.6) box(0.05, 1.05, 0.05, rail, x, y, -45.9);
  collider(-16, 16, -46.2, -45.75);
  // benches facing the river
  const benchWood = worldMat(wood('#a8743f'));
  for (const bx of [1.6, 9, 13.2]) {
    boxMM(bx - 0.9, bx + 0.9, y + 0.42, y + 0.48, -44.55, -44.15, benchWood);
    boxMM(bx - 0.9, bx + 0.9, y + 0.5, y + 0.9, -44.18, -44.1, benchWood);
    for (const dx of [-0.75, 0.75]) box(0.06, 0.42, 0.4, M.dark, bx + dx, y, -44.35);
    collider(bx - 0.9, bx + 0.9, -44.6, -44.05);
  }
  // coin binoculars
  const tel = SPOTS.telescope;
  box(0.12, 0.9, 0.12, mat(0x2d6fb8, { metalness: 0.4, roughness: 0.4 }), tel.x, y, tel.z);
  const head = add(new THREE.BoxGeometry(0.34, 0.2, 0.3), mat(0x2d6fb8, { metalness: 0.4, roughness: 0.4 }), tel.x, y + 1.05, tel.z);
  head.rotation.x = -0.2;
  collider(tel.x - 0.15, tel.x + 0.15, tel.z - 0.15, tel.z + 0.15);

  // slope down to the river
  const grass = new THREE.MeshStandardMaterial({ color: 0x3e5a34, roughness: 1 });
  // steep bank down to the water so the river stays in view
  const slope = add(new THREE.PlaneGeometry(260, 18.5, 30, 4), grass, 0, -3.85, -52, G.scene, false);
  slope.rotation.x = -Math.PI / 2 - 0.797;
  const p = slope.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + rand(-0.6, 0.6));
  slope.geometry.computeVertexNormals();
  const bushM = new THREE.MeshStandardMaterial({ color: 0x35592f, flatShading: true });
  for (let i = 0; i < 50; i++) {
    const x = rand(-60, 60);
    const z = rand(-47.5, -57);
    const yy = -3.85 + (z + 52) * 1.026;
    add(new THREE.IcosahedronGeometry(rand(0.6, 1.6), 0), bushM, x, yy + 0.3, z, G.scene, false);
  }
}

/* ── Han river, bridge, skyline, Namsan ───────────── */

export let water;

function buildRiver(rnd) {
  water = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 1400),
    new THREE.ShaderMaterial({
      uniforms: {
        uSky: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color() },
        uTime: { value: 0 },
        uNight: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
        uniform float uTime; uniform float uNight;
        varying vec3 vWorld;
        void main() {
          vec3 V = normalize(cameraPosition - vWorld);
          float t = uTime;
          vec2 p = vWorld.xz;
          vec3 N = normalize(vec3(
            sin(p.x * 0.05 + t * 0.7) * 0.04 + sin(p.x * 0.31 + p.y * 0.2 + t * 1.7) * 0.02,
            1.0,
            cos(p.y * 0.07 + t * 0.5) * 0.04 + sin(p.y * 0.43 - p.x * 0.1 + t * 2.1) * 0.02));
          float fres = pow(1.0 - max(dot(V, N), 0.0), 4.0);
          vec3 deep = mix(vec3(0.07, 0.17, 0.23), vec3(0.015, 0.025, 0.06), uNight);
          vec3 col = mix(deep, mix(uHorizon, uSky, 0.35), 0.2 + fres * 0.8);
          vec3 R = reflect(-V, N);
          col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 180.0) * 3.0;
          float d = length(vWorld.xz - cameraPosition.xz);
          col = mix(col, uHorizon, smoothstep(250.0, 1300.0, d));
          gl_FragColor = vec4(col, 1.0);
        }`,
      fog: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -10, -760);
  G.scene.add(water);

  // bridge with lamp rows and moving car lights
  const deckM = mat(0x8c8f96, { roughness: 0.8 });
  add(new THREE.BoxGeometry(1800, 1.6, 16), deckM, 0, -4.2, -170, G.scene, false);
  for (let x = -900; x <= 900; x += 60) {
    add(new THREE.BoxGeometry(3, 6, 10), deckM, x, -7.5, -170, G.scene, false);
    const arch = add(new THREE.TorusGeometry(26, 0.8, 6, 24, Math.PI), mat(0x6f8fb0, { metalness: 0.4 }), x + 30, -4.2, -170, G.scene, false);
    arch.scale.y = 0.35;
  }
  const lampN = 140;
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 6, 4), new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffd28a, emissiveIntensity: 0 }), lampN);
  nightGlow(lamps.material, 0, 4);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < lampN; i++) {
    tmp.position.set(-875 + (i >> 1) * 25, -2.2, i % 2 ? -162 : -178);
    tmp.updateMatrix();
    lamps.setMatrixAt(i, tmp.matrix);
  }
  G.scene.add(lamps);
  const carN = 60;
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 1.6, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 }), carN);
  nightGlow(cars.material, 0.1, 2.5);
  const carState = [];
  for (let i = 0; i < carN; i++) {
    const dir = i % 2 ? 1 : -1;
    carState.push({ x: rand(-900, 900), dir, speed: rand(16, 26), z: dir > 0 ? -166 : -174 });
    cars.setColorAt(i, new THREE.Color(dir > 0 ? 0xff5040 : 0xfff1d8));
  }
  G.scene.add(cars);
  const carT = new THREE.Object3D();
  G.updaters.push((dt) => {
    for (let i = 0; i < carN; i++) {
      const c = carState[i];
      c.x += c.dir * c.speed * dt;
      if (c.x > 900) c.x = -900;
      if (c.x < -900) c.x = 900;
      carT.position.set(c.x, -2.6, c.z);
      carT.updateMatrix();
      cars.setMatrixAt(i, carT.matrix);
    }
    cars.instanceMatrix.needsUpdate = true;
  });

  // reflections of the bridge lights on the water at night
  const streak = new THREE.MeshBasicMaterial({ map: softTexture('rgba(255,210,140,0.9)', 'rgba(255,190,120,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  G.nightMats.push({ m: streak, day: 0, night: 0.5, prop: 'opacity' });
  for (let x = -400; x <= 400; x += 25) {
    const s = add(new THREE.PlaneGeometry(3, 40), streak, x + rand(-3, 3), -9.9, -150, G.scene, false);
    s.rotation.x = -Math.PI / 2;
  }

  // far-bank skyline
  const [c, g] = makeCanvas(64, 256);
  const [e, ge] = makeCanvas(64, 256);
  g.fillStyle = '#8f98a6';
  g.fillRect(0, 0, 64, 256);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 64, 256);
  for (let y = 4; y < 256; y += 8) {
    for (let x = 4; x < 64; x += 8) {
      g.fillStyle = '#5b6a7c';
      g.fillRect(x, y, 5, 5);
      if (Math.random() < 0.4) {
        ge.fillStyle = Math.random() < 0.8 ? '#ffd9a0' : '#cfe6ff';
        ge.fillRect(x, y, 5, 5);
      }
    }
  }
  const sm = new THREE.MeshStandardMaterial({ map: canvasTexture(c), emissiveMap: canvasTexture(e), emissive: 0xffffff, roughness: 0.8 });
  nightGlow(sm, 0, 1.4);
  const sky = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sm, 320);
  const rr = seeded(808);
  for (let i = 0; i < 320; i++) {
    const w = 14 + rr() * 26;
    const h = 18 + rr() ** 2 * 90;
    tmp.position.set(-900 + rr() * 1800, -10 + h / 2, -330 - rr() * 380);
    tmp.scale.set(w, h, 14 + rr() * 20);
    tmp.rotation.set(0, 0, 0);
    tmp.updateMatrix();
    sky.setMatrixAt(i, tmp.matrix);
    sky.setColorAt(i, new THREE.Color().setHSL(0.6, 0.08, 0.55 + rr() * 0.3));
  }
  G.scene.add(sky);

  // Distant eastern, north-bank skyline: Namsan is not across the Han.
  // Scenic compression only; the tower is not a walkable Hongdae neighbour.
  const hill = add(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f5f3a, flatShading: true, roughness: 1 }), 420, -10, -10, G.scene, false);
  hill.scale.set(110, 80, 45);
  const hp = hill.geometry.attributes.position;
  for (let i = 0; i < hp.count; i++) if (hp.getY(i) > 0.05) hp.setXYZ(i, hp.getX(i) * (0.95 + rr() * 0.1), hp.getY(i) * (0.92 + rr() * 0.12), hp.getZ(i));
  hill.geometry.computeVertexNormals();
  const tw = new THREE.Group();
  tw.position.set(420, 66, -10);
  G.scene.add(tw);
  const towerM = nightGlow(mat(0xe8e4dc, { roughness: 0.6, emissive: '#b8d5ed' }), 0, 0.35);
  add(new THREE.CylinderGeometry(2.6, 4.2, 60, 12), towerM, 0, 30, 0, tw, false);
  add(new THREE.CylinderGeometry(9, 7, 9, 16), towerM, 0, 62, 0, tw, false);
  const band = new THREE.MeshStandardMaterial({ color: 0x8fa3c4, emissive: 0xff6aa8, emissiveIntensity: 0 });
  nightGlow(band, 0, 2.2);
  add(new THREE.CylinderGeometry(9.2, 9.2, 2.5, 16), band, 0, 61, 0, tw, false);
  add(new THREE.CylinderGeometry(1.0, 1.6, 34, 8), mat(0xd9d4cc), 0, 84, 0, tw, false);
  const tip = new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020, emissiveIntensity: 0 });
  nightGlow(tip, 0, 4);
  add(new THREE.SphereGeometry(1.4, 8, 6), tip, 0, 102, 0, tw, false);
  G.updaters.push((dt, t) => {
    band.emissive.setHSL((t * 0.03) % 1, 0.8, 0.55);
    tip.emissiveIntensity = (Math.sin(t * 3) > 0 ? 4 : 0.5) * G.night;
  });
}

/* ── Food models (served at the stall) ────────────── */

const silver = new THREE.MeshStandardMaterial({ color: 0xeef1f6, metalness: 1, roughness: 0.18 });

export function makeFood(ko, extraSpicy = false) {
  const g = new THREE.Group();
  add(new THREE.CylinderGeometry(0.17, 0.14, 0.035, 24), mat(0xf4f1ea, { roughness: 0.35 }), 0, 0.018, 0, g);
  const r = (a, b) => rand(a, b);
  if (ko === '떡볶이') {
    add(new THREE.CylinderGeometry(0.145, 0.145, 0.015, 24), mat(extraSpicy ? 0xa8120a : 0xd9301e, { emissive: extraSpicy ? 0x400000 : 0x2a0400, roughness: 0.25 }), 0, 0.04, 0, g, false);
    for (let i = 0; i < 9; i++) add(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8), mat(0xf0b9a2, { roughness: 0.45 }), r(-0.08, 0.08), 0.06, r(-0.08, 0.08), g, false).rotation.set(Math.PI / 2, 0, r(0, Math.PI));
  } else if (ko === '오뎅') {
    add(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 14), mat(0xf1ece2), -0.08, 0.08, 0.05, g);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Group();
      s.position.set(0.02 + i * 0.04, 0.05, -0.02);
      s.rotation.set(Math.PI / 2 - 0.2, 0, 0.5 - i * 0.3);
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 5), mat(0xdcc08f), 0, 0, 0, s, false);
      for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.08, 0.05, 0.012), mat(0xe3b277), k % 2 ? 0.015 : -0.015, -0.05 + k * 0.05, 0, s, false);
      g.add(s);
    }
  } else if (ko === '라면') {
    add(new THREE.CylinderGeometry(0.14, 0.12, 0.09, 20), mat(0xd4a33a, { metalness: 0.6, roughness: 0.35 }), 0, 0.08, 0, g);
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 20), mat(0xe0702e, { roughness: 0.2 }), 0, 0.12, 0, g, false);
    for (let i = 0; i < 6; i++) add(new THREE.TorusGeometry(0.04, 0.006, 4, 12), mat(0xf6dd8b), r(-0.06, 0.06), 0.126, r(-0.06, 0.06), g, false).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.03, 10, 8), mat(0xffb400, { roughness: 0.3 }), 0.04, 0.13, 0.02, g, false);
  } else if (ko === '순대') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12), mat(0x3a2226, { roughness: 0.5 }), Math.cos(a) * 0.08, 0.045, Math.sin(a) * 0.08, g, false).rotation.z = 0.3;
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = new THREE.Group();
      s.position.set(Math.cos(a) * 0.085, 0.05, Math.sin(a) * 0.085);
      add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 14), mat(0x1f2b1f), 0, 0, 0, s, false);
      add(new THREE.CylinderGeometry(0.031, 0.031, 0.032, 14), mat(0xfaf6ee), 0, 0.001, 0, s, false);
      g.add(s);
    }
  }
  for (const sgn of [-1, 1]) add(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 5), silver, 0.2, 0.01, sgn * 0.012, g, false).rotation.x = Math.PI / 2;
  return g;
}

/* ── Build everything ─────────────────────────────── */

export function buildWorld() {
  materials();
  const rnd = seeded(1234);
  buildGround();
  buildAlley(rnd);
  buildTent();
  buildStore(rnd);
  buildCafe(rnd);
  buildSubway();
  buildTerrace(rnd);
  buildStudio(rnd);
  buildLookout(rnd);
  buildRiver(rnd);

  for (const [x, z] of [[-8.6, -9.8], [8.6, -9.4], [-8.4, -25.6], [9.2, -25.8], [-3.2, -31.6], [10.8, -31.2], [14.6, -38.5], [-3.6, -44.2], [12.6, -42.6], [1.2, -36]]) ginkgo(x, heightAt(x, z), z, rnd, 1 + rnd() * 0.25);
  leafCarpet(rnd);
  fallingLeaves();

  streetLamp(0.8, 0, -9.6, 0, true);
  streetLamp(-0.8, 0, -26.8, Math.PI);
  streetLamp(7.6, TERRACE_Y, -33, Math.PI, true);
  streetLamp(-4.8, TERRACE_Y, -45.3, 0);
  streetLamp(15.2, TERRACE_Y, -45.3, 0);
  stringLights(-10, 5.2, -12.5, 10, 5.2, -12.5, 24, 0.9);
  stringLights(-10, 5.4, -21, 10, 5.4, -21.3, 24, 1.0);
}

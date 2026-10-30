// Shared helpers and the global game registry.
import * as THREE from 'three';

/** Global registry filled in by main.js and the world builders. */
export const G = {
  scene: null,
  camera: null,
  renderer: null,
  colliders: [], // { minX, maxX, minZ, maxZ }
  blockers: [], // meshes the camera should not pass through
  nightMats: [], // { m, day, night, prop }
  nightLights: [], // { light, day, night }
  nightVisible: [], // { obj, on: (night) => bool }
  zones: [], // { id, minX, maxX, minZ, maxZ }
  interactables: [],
  updaters: [], // (dt, t, env) => void
  night: 0,
};

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, v) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Seeded PRNG so the neighbourhood looks the same on every visit. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function canvasTexture(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function softTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const [c, g] = makeCanvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvasTexture(c, { repeat: false });
}

export const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });

export function add(geo, material, x = 0, y = 0, z = 0, parent = G.scene, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadows;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * Rewrite UVs as a box projection in metres so tiled textures keep a
 * consistent real-world scale on any box/plane, whatever its size.
 */
export function worldUV(geo, scale = 1, ox = 0, oy = 0, oz = 0) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox;
    const y = p.getY(i) + oy;
    const z = p.getZ(i) + oz;
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u;
    let v;
    if (ay >= ax && ay >= az) {
      u = x;
      v = -z;
    } else if (ax >= az) {
      u = -z * Math.sign(n.getX(i) || 1);
      v = y;
    } else {
      u = x * Math.sign(n.getZ(i) || 1);
      v = y;
    }
    uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Axis-aligned box in world units: centred on x/z, sitting on y0. */
export function box(w, h, d, material, x, y0, z, { parent = G.scene, uv = 2, cast = true, collide = false, block = false } = {}) {
  const geo = worldUV(new THREE.BoxGeometry(w, h, d), uv, x, y0 + h / 2, z);
  const m = add(geo, material, x, y0 + h / 2, z, parent, cast);
  if (collide) G.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  if (block) G.blockers.push(m);
  return m;
}

/** Box from min/max extents — easier for laying out walls and floors. */
export function boxMM(minX, maxX, minY, maxY, minZ, maxZ, material, opts = {}) {
  return box(maxX - minX, maxY - minY, maxZ - minZ, material, (minX + maxX) / 2, minY, (minZ + maxZ) / 2, opts);
}

export function collider(minX, maxX, minZ, maxZ) {
  G.colliders.push({ minX, maxX, minZ, maxZ });
}

/** Register a material whose emissive glow follows the night factor. */
export function nightGlow(m, day, night) {
  G.nightMats.push({ m, day, night });
  return m;
}

export function nightLight(light, day, night) {
  G.nightLights.push({ light, day, night });
  return light;
}

export function pointLight(color, intensity, distance, x, y, z, { day = 0 } = {}) {
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(x, y, z);
  G.scene.add(l);
  nightLight(l, day, intensity);
  return l;
}

/** Simple sign/label canvas texture. */
export function textTexture(lines, w, h, { bg = null, radius = 18, border = null } = {}) {
  const [c, g] = makeCanvas(w, h);
  if (bg) {
    g.fillStyle = bg;
    roundRect(g, 3, 3, w - 6, h - 6, radius);
    g.fill();
  }
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 6;
    roundRect(g, 8, 8, w - 16, h - 16, radius);
    g.stroke();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [text, size, color, y, font = 'Jua', glow = null] of lines) {
    g.font = `${size}px ${font}, sans-serif`;
    if (glow) {
      g.shadowColor = glow;
      g.shadowBlur = 18;
    }
    g.fillStyle = color;
    g.fillText(text, w / 2, y);
    g.shadowBlur = 0;
  }
  return canvasTexture(c, { repeat: false });
}

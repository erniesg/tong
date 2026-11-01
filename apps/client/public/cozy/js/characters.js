// Toon-shaded chibi characters with canvas-painted anime faces.
import * as THREE from 'three';
import { G, add, clamp, damp, rand, makeCanvas, canvasTexture, wrapAngle, hdr, seeded } from './util.js';
import { knit, denim, leather, fabric, hairTexture, strandAlpha, furTextures, tiled } from './textures.js';

const TAU = Math.PI * 2;
const R = 0.36; // head radius
const HEAD_Y = 1.32;

/* ── Toon materials ─────────────────────────────────── */

const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 240, 240, 240, 255, 255, 255, 255, 255]), 4, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export const toon = (color, opts = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...opts });

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a1c22, side: THREE.BackSide });

/**
 * Inverted-hull ink outline. It is a child of the mesh with a uniform local
 * scale, so it inherits any position/rotation/scale the caller applies after
 * part() returns (shoes, ears, locks, brims) and hides along with the mesh.
 */
function outline(mesh, t = 0.011) {
  mesh.geometry.computeBoundingSphere();
  const r = Math.max(0.03, mesh.geometry.boundingSphere.radius);
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  const k = 1 + t / r;
  // Grow about the geometry's own centre, so off-origin lathes (torsos, cowls) get an even rim.
  o.scale.setScalar(k);
  o.position.copy(mesh.geometry.boundingSphere.center).multiplyScalar(1 - k);
  o.castShadow = false;
  o.userData.isOutline = true;
  mesh.add(o);
  return o;
}

function part(geo, material, x, y, z, parent, { ol = 0.011, shadow = true } = {}) {
  const m = add(geo, material, x, y, z, parent, shadow);
  if (ol) outline(m, ol);
  return m;
}

function lathe(pts, material, parent, { phiStart = 0, phiLength = TAU, ol = 0.011, segments = 28 } = {}) {
  const geo = new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
    phiStart,
    phiLength,
  );
  const m = add(geo, material, 0, 0, 0, parent);
  if (ol) outline(m, ol);
  return m;
}

/* ── Face painting ─────────────────────────────────── */

const FW = 512;
const FH = 512;
const PHI_SPAN = 2.0;
const TH0 = 0.3 * Math.PI;
const TH1 = 0.8 * Math.PI;

/** Head-local surface point (metres) → face canvas pixels. */
function P(x, y) {
  const th = Math.acos(clamp(y / R, -1, 1));
  const s = R * Math.sin(th);
  const ph = Math.asin(clamp(x / s, -1, 1));
  return [(0.5 + ph / PHI_SPAN) * FW, ((th - TH0) / (TH1 - TH0)) * FH, FW / (PHI_SPAN * s), FH / ((TH1 - TH0) * R)];
}

export const EXPR = {
  neutral: { eyes: 'open', mouth: 'neutral', brow: 0 },
  cool: { eyes: 'open', mouth: 'neutral', brow: -0.6, lid: 0.32 },
  smirk: { eyes: 'open', mouth: 'smirk', brow: -0.4, lid: 0.25 },
  smile: { eyes: 'open', mouth: 'smile', brow: 0.2 },
  happy: { eyes: 'happy', mouth: 'grin', brow: 0.5 },
  laugh: { eyes: 'happy', mouth: 'grin', brow: 0.7, blush: 0.45 },
  surprised: { eyes: 'open', mouth: 'o', brow: 1, pupil: 0.75 },
  blush: { eyes: 'open', mouth: 'wavy', brow: 0.9, blush: 0.75, lookX: -0.8 },
  sad: { eyes: 'open', mouth: 'frown', brow: 1.1, lid: 0.15 },
  spicy: { eyes: 'tight', mouth: 'open', brow: 1, blush: 0.9 },
  sleepy: { eyes: 'closed', mouth: 'smile', brow: 0.3 },
};

function ellipse(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  g.fill();
}

function drawEye(g, cx, cy, ew, eh, side, f, E, state, look) {
  const w = ew / 2;
  const h = eh / 2;
  g.save();
  g.translate(cx, cy);
  g.rotate(-(f.tilt ?? 0.08) * side);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = f.line;
  if (state === 'closed') {
    g.lineWidth = h * 0.2;
    g.beginPath();
    g.moveTo(-w, 0);
    g.quadraticCurveTo(0, h * 0.5, w, 0);
    g.stroke();
    if (f.liner) {
      g.beginPath();
      g.moveTo(side * w, 0);
      g.lineTo(side * w * 1.35, -h * 0.3);
      g.stroke();
    }
    g.restore();
    return;
  }
  if (state === 'happy') {
    g.lineWidth = h * 0.22;
    g.beginPath();
    g.moveTo(-w, h * 0.3);
    g.quadraticCurveTo(0, -h * 0.75, w, h * 0.3);
    g.stroke();
    g.restore();
    return;
  }
  if (state === 'tight') {
    g.lineWidth = h * 0.2;
    g.beginPath();
    g.moveTo(side * w * 0.8, -h * 0.5);
    g.lineTo(-side * w * 0.6, 0);
    g.lineTo(side * w * 0.8, h * 0.5);
    g.stroke();
    g.restore();
    return;
  }
  if (f.style === 'tong') {
    g.fillStyle = '#1a1214';
    ellipse(g, 0, 0, w, h);
    g.fillStyle = '#3b2c30';
    ellipse(g, 0, h * 0.35, w * 0.7, h * 0.45);
    g.fillStyle = '#fff';
    ellipse(g, -w * 0.3, -h * 0.35, w * 0.32, h * 0.3);
    ellipse(g, w * 0.35, h * 0.3, w * 0.14, h * 0.13);
    // sparkle star
    g.save();
    g.translate(w * 0.32, -h * 0.45);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? w * 0.06 : w * 0.2;
      const a = (i / 8) * TAU;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.fill();
    g.restore();
    g.restore();
    return;
  }

  // Single lids sit a little lower at rest; hooded lids lower still.
  const lidBase = f.lid === 'single' ? 0.12 : f.lid === 'hooded' ? 0.2 : 0;
  const lidOff = Math.max(E.lid ?? 0, lidBase) * h * 1.25;
  const sclera = new Path2D();
  sclera.moveTo(-w, h * 0.12);
  sclera.bezierCurveTo(-w * 0.62, -h * 1.08, w * 0.62, -h * 1.08, w, -h * 0.08);
  sclera.bezierCurveTo(w * 0.62, h * 1.02, -w * 0.62, h * 1.02, -w, h * 0.12);
  g.fillStyle = '#fffaf5';
  g.fill(sclera);
  g.save();
  g.clip(sclera);
  const lx = (look + (E.lookX ?? 0)) * w * 0.28;
  const ir = g.createLinearGradient(0, -h, 0, h);
  ir.addColorStop(0, f.irisDark);
  ir.addColorStop(0.55, f.iris);
  ir.addColorStop(1, f.irisLight);
  g.fillStyle = ir;
  ellipse(g, lx, h * 0.06, w * 0.6 * (E.pupil ?? 1), h * 0.94 * (E.pupil ?? 1));
  g.fillStyle = '#120a0c';
  ellipse(g, lx, h * 0.14, w * 0.27 * (E.pupil ?? 1), h * 0.42 * (E.pupil ?? 1));
  g.fillStyle = 'rgba(20,10,20,0.28)';
  g.fillRect(-w * 1.2, -h * 1.2, w * 2.4, h * 0.62);
  g.fillStyle = '#fff';
  ellipse(g, lx - w * 0.22, -h * 0.28, w * 0.2, h * 0.22);
  ellipse(g, lx + w * 0.2, h * 0.38, w * 0.09, h * 0.09);
  if (lidOff > 0) {
    g.fillStyle = f.skin;
    g.beginPath();
    g.moveTo(-w * 1.4, -h * 1.6);
    g.lineTo(w * 1.4, -h * 1.6);
    g.lineTo(w * 1.05, -h * 0.08);
    g.bezierCurveTo(w * 0.62, -h * 1.08 + lidOff * 1.3, -w * 0.62, -h * 1.08 + lidOff * 1.3, -w * 1.05, h * 0.12);
    g.closePath();
    g.fill();
  }
  g.restore();

  // upper lash line (follows the lid); lashThick scales its weight
  const lashThick = f.lashThick ?? 1;
  g.lineWidth = f.lashThick == null ? h * (f.lashW ?? 0.2) : h * 0.17 * lashThick;
  const lid = [[-w * 1.04, h * 0.12], [-w * 0.62, -h * 1.08 + lidOff * 1.3], [w * 0.62, -h * 1.08 + lidOff * 1.3], [w * 1.04, -h * 0.08]];
  g.beginPath();
  g.moveTo(...lid[0]);
  g.bezierCurveTo(...lid[1], ...lid[2], ...lid[3]);
  g.stroke();
  // Lash flicks along the outer half of the lid, independent of presentation.
  const lashLen = f.lashLen ?? (f.lashes ? 0.55 : 0);
  if (lashLen > 0.02) {
    const at = (u) => {
      const v = 1 - u;
      const k = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u];
      return [0, 1].map((j) => lid.reduce((acc, p, i) => acc + p[j] * k[i], 0));
    };
    g.save();
    g.lineWidth = h * 0.085 * lashThick;
    for (const [u, a, l] of [[0.66, 0.3, 0.6], [0.82, 0.62, 0.85], [0.95, 0.95, 1]]) {
      const [x, y] = at(side > 0 ? u : 1 - u);
      const len = h * 0.5 * lashLen * l;
      const ang = -Math.PI / 2 + side * a;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(ang) * len * 0.4, y + Math.sin(ang) * len * 0.7, x + Math.cos(ang + side * 0.35) * len, y + Math.sin(ang + side * 0.35) * len);
      g.stroke();
    }
    g.restore();
  }
  if (f.lid === 'double' || f.lid === 'hooded') {
    // Lid crease: well above the lash line for double lids, tucked close for hooded.
    const up = f.lid === 'double' ? h * 0.36 : h * 0.14;
    g.save();
    g.globalAlpha = 0.5;
    g.lineWidth = h * 0.07;
    g.beginPath();
    g.moveTo(-w * 0.7, -h * 0.55 - up * 0.6 + lidOff);
    g.bezierCurveTo(-w * 0.4, -h * 1.08 - up + lidOff * 1.3, w * 0.55, -h * 1.08 - up + lidOff * 1.3, w * 1.0, -h * 0.3 - up * 0.5);
    g.stroke();
    g.restore();
  }
  if (f.liner) {
    g.lineWidth = h * 0.17;
    g.beginPath();
    g.moveTo(side * w * 0.92, -h * 0.12);
    g.lineTo(side * w * 1.42, -h * 0.55);
    g.stroke();
  }
  g.globalAlpha = 0.45;
  g.lineWidth = h * 0.07;
  g.beginPath();
  g.moveTo(-w * 0.55, h * 0.9);
  g.quadraticCurveTo(0, h * 1.08, w * 0.7, h * 0.72);
  g.stroke();
  g.restore();
}

function drawMouth(g, kind, f) {
  const [mx, my, sx] = P(0, f.style === 'tong' ? -0.14 : -0.19);
  const shape = f.mouthShape ?? 'classic';
  const mw = sx * (f.mouthW ?? 0.07) * (MOUTH_WIDTH[shape] ?? 1);
  g.save();
  g.translate(mx, my);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = f.mouthLine;
  g.lineWidth = 4;
  const dark = '#7a2832';
  if (shape === 'cat' && (kind === 'smile' || kind === 'neutral')) {
    // ω-shaped "cat" mouth, a common anime resting mouth
    const h = kind === 'smile' ? mw * 0.2 : mw * 0.12;
    g.beginPath();
    g.moveTo(-mw * 0.42, -2);
    g.quadraticCurveTo(-mw * 0.21, h * 1.6, 0, -1);
    g.quadraticCurveTo(mw * 0.21, h * 1.6, mw * 0.42, -2);
    g.stroke();
    g.restore();
    return;
  }
  if (shape === 'full' && ['smile', 'neutral', 'smirk', 'frown'].includes(kind)) {
    g.fillStyle = 'rgba(214,112,122,0.55)';
    ellipse(g, 0, mw * 0.2, mw * 0.24, mw * 0.1);
  }
  switch (kind) {
    case 'smile':
      g.beginPath();
      g.moveTo(-mw / 2, -3);
      g.quadraticCurveTo(0, mw * 0.42, mw / 2, -3);
      g.stroke();
      break;
    case 'smirk':
      g.beginPath();
      g.moveTo(-mw * 0.42, 2);
      g.quadraticCurveTo(mw * 0.1, 5, mw * 0.5, -7);
      g.stroke();
      break;
    case 'open':
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(-mw * 0.3, 0);
      g.quadraticCurveTo(0, -5, mw * 0.3, 0);
      g.quadraticCurveTo(0, mw * 0.6, -mw * 0.3, 0);
      g.fill();
      g.fillStyle = '#e8838d';
      ellipse(g, 0, mw * 0.22, mw * 0.14, mw * 0.08);
      break;
    case 'grin':
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(-mw * 0.5, -2);
      g.lineTo(mw * 0.5, -2);
      g.quadraticCurveTo(0, mw * 0.75, -mw * 0.5, -2);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(-mw * 0.4, -2, mw * 0.8, 5);
      g.fillStyle = '#e8838d';
      ellipse(g, 0, mw * 0.32, mw * 0.18, mw * 0.08);
      break;
    case 'o':
      g.fillStyle = dark;
      ellipse(g, 0, 2, mw * 0.16, mw * 0.2);
      break;
    case 'wavy':
      g.beginPath();
      g.moveTo(-mw * 0.45, 0);
      for (let i = 1; i <= 6; i++) g.lineTo(-mw * 0.45 + (i * mw * 0.9) / 6, i % 2 ? -4 : 2);
      g.stroke();
      break;
    case 'frown':
      g.beginPath();
      g.moveTo(-mw * 0.4, 4);
      g.quadraticCurveTo(0, -6, mw * 0.4, 4);
      g.stroke();
      break;
    default:
      g.beginPath();
      g.moveTo(-mw * 0.38, 0);
      g.quadraticCurveTo(0, 3, mw * 0.38, 0);
      g.stroke();
  }
  g.restore();
}

const MOUTH_WIDTH = { classic: 1, small: 0.75, wide: 1.3, cat: 1, full: 1 };

// Brow shapes (head-local metres unless noted): arch height and where it peaks
// (0 = inner head, 1 = tail), tail drop, how much the tail tapers, a thickness
// factor and how much feathered hair texture is drawn over the soft body.
const BROWS = {
  soft: { arch: 0.009, peak: 0.6, drop: 0.006, taper: 0.62, w: 1, feather: 0.7 },
  straight: { arch: 0.002, peak: 0.55, drop: 0.001, taper: 0.5, w: 1, feather: 0.6, inY: 0.003 },
  arched: { arch: 0.018, peak: 0.66, drop: 0.012, taper: 0.72, w: 0.9, feather: 0.5, inY: -0.003 },
  natural: { arch: 0.006, peak: 0.58, drop: 0.004, taper: 0.42, w: 1.22, feather: 1.2 },
  tapered: { arch: 0.011, peak: 0.5, drop: 0.009, taper: 0.88, w: 1, feather: 0.6 },
  // NPC-only legacy shapes
  thick: { arch: 0.004, peak: 0.55, drop: 0.002, taper: 0.35, w: 1.2, feather: 0.8 },
  thin: { arch: 0.012, peak: 0.6, drop: 0.006, taper: 0.7, w: 0.6, feather: 0.25 },
};

function rgba(hex, a) {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Soft, feathered brows: a body with a diffuse inner head, full middle and
 * tapered tail, overlaid with short hair strokes that rise at the head and
 * sweep toward the tail. Thickness, length and expression lift are continuous.
 */
function drawBrows(g, f, E) {
  const b = BROWS[f.browStyle] ?? BROWS.soft;
  const lift = 0.014 * (E.brow ?? 0);
  const thick = f.browThick ?? 1;
  const len = f.browLen ?? 1;
  const half = (4 + (f.browW ?? 5) * 1.3) * b.w * thick; // px, half-width at the fullest point
  const tilt = (f.browTilt ?? 0) * 0.012;
  const N = 18;
  for (const s of [-1, 1]) {
    // Centre line in canvas pixels, inner head (i = 0) to tail (i = N).
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const bump = t < b.peak ? Math.sin((t / b.peak) * Math.PI / 2) : 1 - ((t - b.peak) / (1 - b.peak)) ** 2 * 1.15;
      const y = 0.024 + (b.inY ?? 0) + lift * (1 - 0.5 * t) + tilt * t + b.arch * bump - b.drop * t * t;
      const x = 0.058 + 0.128 * len * t;
      const [px, py] = P(x * s, y);
      // fullest a quarter of the way in; soft inner head, tapered tail
      const w = t < 0.25 ? half * (0.78 + 0.88 * t) : half * (1 - b.taper * ((t - 0.25) / 0.75) ** 1.4);
      pts.push([px, py, Math.max(0.6, w), t]);
    }
    const [x0] = pts[0];
    const [x1] = pts[N];
    const body = g.createLinearGradient(x0, 0, x1, 0);
    body.addColorStop(0, rgba(f.brow, 0.3));
    body.addColorStop(0.18, rgba(f.brow, 0.78));
    body.addColorStop(0.55, rgba(f.brow, 0.92));
    body.addColorStop(1, rgba(f.brow, 0.72));
    g.save();
    g.fillStyle = body;
    g.filter = 'blur(0.8px)';
    g.beginPath();
    pts.forEach(([x, y, w], i) => (i ? g.lineTo(x, y - w) : g.moveTo(x, y - w)));
    for (let i = N; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + pts[i][2] * 0.85);
    g.closePath();
    g.fill();
    g.filter = 'none';
    // Hair strokes. Seeded per side so the texture is stable between redraws.
    const rnd = seeded(s > 0 ? 7 : 11);
    const count = Math.round((14 + 30 * b.feather) * len * Math.min(1.4, 0.6 + 0.4 * thick));
    g.lineCap = 'round';
    for (let k = 0; k < count; k++) {
      const u = rnd() * N * 0.98;
      const i = Math.floor(u);
      const fr = u - i;
      const [ax, ay, aw, t] = pts[i];
      const [bx, by, bw] = pts[i + 1];
      const w = aw + (bw - aw) * fr;
      const v = (rnd() * 2 - 1) * 0.62;
      const x = ax + (bx - ax) * fr;
      const y = ay + (by - ay) * fr - v * w;
      // inner hairs stand up; the rest lie along the brow, angled slightly upward
      const along = Math.atan2(by - ay, bx - ax);
      const ang = t < 0.18 ? Math.atan2(-Math.cos(0.4), s * Math.sin(0.4)) : along - s * 0.22;
      const l = Math.min(w * (t < 0.18 ? 0.95 : 1.35), 14) * (0.7 + rnd() * 0.5);
      g.strokeStyle = rgba(f.brow, t < 0.15 ? 0.35 : 0.55 + rnd() * 0.3);
      g.lineWidth = Math.max(0.8, 1.3 * Math.min(1.2, thick));
      g.beginPath();
      g.moveTo(x - Math.cos(ang) * l * 0.5, y - Math.sin(ang) * l * 0.5);
      g.lineTo(x + Math.cos(ang) * l * 0.5, y + Math.sin(ang) * l * 0.5);
      g.stroke();
    }
    g.restore();
  }
}

function drawNose(g, f) {
  const [nx, ny, sx] = P(0, -0.128);
  const kind = f.nose ?? 'dot';
  g.lineCap = 'round';
  if (kind === 'button') {
    g.strokeStyle = 'rgba(160,92,88,0.7)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(nx - sx * 0.012, ny - 1);
    g.quadraticCurveTo(nx, ny + 4, nx + sx * 0.012, ny - 1);
    g.stroke();
  } else if (kind === 'line') {
    g.strokeStyle = 'rgba(150,88,84,0.7)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(nx + 2, ny - sx * 0.03);
    g.lineTo(nx + 4, ny + 1);
    g.lineTo(nx - 1, ny + 3);
    g.stroke();
  } else if (kind === 'soft') {
    const gr = g.createRadialGradient(nx, ny - 4, 0, nx, ny - 4, sx * 0.03);
    gr.addColorStop(0, 'rgba(200,120,110,0.28)');
    gr.addColorStop(1, 'rgba(200,120,110,0)');
    g.fillStyle = gr;
    ellipse(g, nx, ny - 4, sx * 0.03, sx * 0.025);
    g.fillStyle = 'rgba(150,85,80,0.55)';
    for (const s of [-1, 1]) ellipse(g, nx + s * 4, ny + 1, 2, 1.4);
  } else {
    g.fillStyle = 'rgba(170,100,95,0.55)';
    ellipse(g, nx, ny, 3, 2);
  }
}

// Fixed freckle scatter (head-local metres), mirrored across both cheeks and the nose bridge.
const FRECKLES = [[0.15, -0.1], [0.18, -0.115], [0.205, -0.098], [0.165, -0.132], [0.225, -0.12], [0.135, -0.118], [0.19, -0.142], [0.035, -0.105]];

function drawMarks(g, f) {
  const m = f.marks ?? 'none';
  if (m === 'freckles' || m === 'both') {
    g.fillStyle = 'rgba(160,92,62,0.5)';
    for (const s of [-1, 1]) for (const [x, y] of FRECKLES) {
      const [fx, fy] = P(x * s, y);
      ellipse(g, fx, fy, 2.4, 2);
    }
  }
  if (m === 'mole' || m === 'both') {
    const [mx, my] = P(0.165, -0.115);
    g.fillStyle = 'rgba(70,40,34,0.85)';
    ellipse(g, mx + 6, my + 10, 2.6, 2.6);
  }
}

function drawFace(g, f, st, browG) {
  g.clearRect(0, 0, FW, FH);
  const E = EXPR[st.expr] ?? EXPR.neutral;
  const blush = Math.max(f.blush ?? 0.2, E.blush ?? 0);
  for (const s of [-1, 1]) {
    const [bx, by, sx] = P(0.195 * s, f.style === 'tong' ? -0.09 : -0.13);
    const gr = g.createRadialGradient(bx, by, 0, bx, by, sx * 0.055);
    gr.addColorStop(0, `rgba(255,110,130,${blush})`);
    gr.addColorStop(1, 'rgba(255,110,130,0)');
    g.fillStyle = gr;
    ellipse(g, bx, by, sx * 0.055, sx * 0.038);
    if (E.blush > 0.6 && f.style !== 'tong') {
      g.strokeStyle = 'rgba(220,70,90,0.6)';
      g.lineWidth = 2.5;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(bx + k * 12 - 4, by + 6);
        g.lineTo(bx + k * 12 + 4, by - 6);
        g.stroke();
      }
    }
  }
  if (f.style !== 'tong') {
    drawMarks(g, f);
    drawNose(g, f);
  }
  const eyeState = st.blink ? 'closed' : E.eyes;
  const ey = f.style === 'tong' ? -0.02 : -0.055;
  const ex = f.style === 'tong' ? 0.11 : 0.128;
  for (const s of [-1, 1]) {
    const [x, y, sx, sy] = P(ex * s, ey);
    const size = f.eyeSize ?? 1;
    drawEye(g, x, y, sx * 0.1 * size, sy * 0.115 * size * (f.lid === 'single' ? 0.92 : 1), s, f, E, eyeState, st.look ?? 0);
  }
  if (browG) browG.clearRect(0, 0, FW, FH);
  if (f.style !== 'tong' && !f.noBrows && (browG || !f.browLayer)) drawBrows(browG ?? g, f, E);
  if (f.mustache) {
    const [mx, my, sx] = P(0, -0.158);
    g.fillStyle = '#5a524e';
    for (const s of [-1, 1]) ellipse(g, mx + s * sx * 0.025, my, sx * 0.03, sx * 0.012, s * 0.25);
  }
  const mouth = st.talkOpen ? (E.mouth === 'grin' ? 'grin' : 'open') : E.mouth;
  drawMouth(g, mouth, f);
}

const BROW_DEPTH_BIAS = 0.055; // metres; just more than the deepest bangs sit in front of the face

function browMaterial(map) {
  const m = toon(0xffffff, { map, transparent: true, depthWrite: false });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec4 biased = mvPosition;
        biased.xyz *= max(0.0, 1.0 - ${BROW_DEPTH_BIAS.toFixed(3)} / length(mvPosition.xyz));
        vec4 clip = projectionMatrix * biased;
        gl_Position.z = clip.z / clip.w * gl_Position.w;
      }`,
    );
  };
  m.customProgramCacheKey = () => 'tong-brow-depth-bias';
  return m;
}

function makeFace(head, f) {
  const [c, g] = makeCanvas(FW, FH);
  const tex = canvasTexture(c, { repeat: false });
  const geo = new THREE.SphereGeometry(R * 1.006, 48, 32, Math.PI / 2 - PHI_SPAN / 2, PHI_SPAN, TH0, TH1 - TH0);
  const m = new THREE.Mesh(geo, toon(0xffffff, { map: tex, transparent: true, depthWrite: false }));
  m.renderOrder = 2;
  head.add(m);
  // Brows sit on the face surface but their depth is biased toward the camera,
  // so they read over bangs (as in anime art) without floating off the face in
  // profile. Hands, walls and other characters further in front still cover them.
  const [bc, browG] = makeCanvas(FW, FH);
  const browTex = canvasTexture(bc, { repeat: false });
  const browGeo = new THREE.SphereGeometry(R * 1.008, 48, 32, Math.PI / 2 - PHI_SPAN / 2, PHI_SPAN, TH0, TH1 - TH0);
  const brows = new THREE.Mesh(browGeo, browMaterial(browTex));
  brows.renderOrder = 4;
  head.add(brows);
  f.browLayer = true;
  return { g, tex, browG, browTex, key: '', browKey: null, f };
}

/* ── Hair ─────────────────────────────────────────── */

function hairMat(color, light, opts = {}) {
  return toon(0xffffff, { map: hairTexture(color, light), ...opts });
}

function strandMat(color, tips, depth) {
  return toon(color, { alphaMap: strandAlpha(tips, depth), alphaTest: 0.5, side: THREE.DoubleSide });
}

// Hair parts carry userData.keep = true when they should stay visible under a
// raised hood (fringe, face-framing locks). Every hair group records its crown
// (head-local centre + outer radius) so hats and hoods can fit over it.
const keep = (m) => { m.userData.keep = true; return m; };
const DEFAULT_CROWN = { y: 0.02, z: -0.02, r: R + 0.03 };

/** A domed hair cap; `tilt` < 0 lifts the hairline at the front and drops it at the nape. */
function hairCap(hair, color, light, { r = R + 0.022, theta = 0.56, tilt = -0.42, y = 0.02, z = -0.015, ol = 0.011 } = {}) {
  const g = new THREE.Group();
  g.position.set(0, y, z);
  g.rotation.x = tilt;
  hair.add(g);
  const cap = part(new THREE.SphereGeometry(r, 44, 24, 0, TAU, 0, Math.PI * theta), hairMat(color, light), 0, 0, 0, g, { ol });
  cap.rotation.y = Math.PI;
  cap.userData.crownPart = true;
  return cap;
}

/** Bangs: an open cylinder band with an alpha-cut strand edge, centred on `at` (radians, 0 = front). */
function bangs(hair, color, { at = 0, span = 2.0, y = 0.055, h = 0.15, r0, r1, tips = 24, depth = 0.3, tiltZ = 0 } = {}) {
  // By default the band is a cone hugging the skull, so it doesn't float off the head in profile.
  r0 ??= Math.sqrt((R + 0.024) ** 2 - (y + h / 2) ** 2) + 0.004;
  r1 ??= Math.sqrt((R + 0.012) ** 2 - Math.min(0, y - h / 2) ** 2) + 0.006;
  const f = add(new THREE.CylinderGeometry(r0, r1, h, 48, 1, true, at - span / 2, span), strandMat(color, tips, depth), 0, y, 0, hair);
  f.rotation.z = tiltZ;
  f.renderOrder = 3;
  return keep(f);
}

/** A tapered hanging tail (ponytail/pigtail) from a tie at `pos`, swinging back by `swing`, out by `splay`. */
function tail(hair, color, pos, { len = 0.52, w = 0.09, swing = 0.25, splay = 0 } = {}) {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.rotation.set(Math.PI + swing, 0, splay);
  g.userData.tail = true;
  hair.add(g);
  const prof = [[0, 0], [w * 0.55, 0.02], [w, len * 0.22], [w * 0.95, len * 0.55], [w * 0.6, len * 0.85], [0, len]];
  lathe(prof, toon(color), g, { ol: 0.008, segments: 16 });
  const tie = add(new THREE.TorusGeometry(w * 0.5, 0.014, 6, 14), toon('#d65a6e'), 0, 0.02, 0, g, false);
  tie.rotation.x = Math.PI / 2;
  return g;
}

function longHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  const cap = part(new THREE.SphereGeometry(R + 0.024, 36, 18, 0, TAU, 0, Math.PI * 0.47), hairMat(color, light), 0, 0.006, 0, hair);
  cap.rotation.y = Math.PI;
  cap.userData.crownPart = true;
  bangs(hair, color, { r0: R + 0.026, r1: R + 0.036 }); // blunt bangs with strand tips (Ha-eun's canon look)
  // long back curtain
  const back = add(new THREE.CylinderGeometry(R + 0.03, R + 0.085, 1.0, 48, 1, true, 0.82, TAU - 1.64), strandMat(color, 30, 0.18), 0, -0.4, -0.01, hair);
  back.scale.z = 0.92;
  // side locks framing the face
  const lockM = toon(color);
  for (const s of [-1, 1]) {
    const l = keep(part(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), lockM, 0.29 * s, -0.33, 0.1, hair, { ol: 0.008 }));
    l.scale.set(1, 1, 1.6);
    l.rotation.z = -0.06 * s;
  }
  hair.userData.crown = { y: 0.006, z: 0, r: R + 0.024 };
  return hair;
}

function wavyHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  const m = hairMat(color, light);
  const flat = toon(color);
  const cap = part(new THREE.SphereGeometry(R + 0.03, 32, 16, 0, TAU, 0, Math.PI * 0.5), m, 0, 0.02, -0.02, hair);
  cap.rotation.y = Math.PI;
  cap.userData.crownPart = true;
  const locks = [
    [-0.13, 0.17, 0.27, 0.13, 0.4, 1],
    [0.04, 0.2, 0.28, 0.14, -0.2, 1],
    [0.18, 0.12, 0.25, 0.11, -0.6, 1],
    [-0.31, 0.12, 0.0, 0.12, 0.9],
    [0.31, 0.1, -0.01, 0.11, -0.9],
    [0, 0.26, 0.05, 0.18, 0],
    [-0.18, 0.22, -0.15, 0.17, 0.3],
    [0.18, 0.22, -0.15, 0.17, -0.3],
    [0, 0.05, -0.27, 0.22, 0],
  ];
  for (const [x, y, z, r, rot, front] of locks) {
    const s = part(new THREE.SphereGeometry(r, 14, 10), flat, x, y, z, hair, { ol: 0.008 });
    s.scale.set(1.2, 0.75, 1);
    s.rotation.z = rot;
    if (front) keep(s);
  }
  hair.userData.crown = { y: 0.02, z: -0.02, r: R + 0.03 };
  return hair;
}

function shortHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  hairCap(hair, color, light);
  // short textured fringe that stops above the brows
  bangs(hair, color, { y: 0.13, h: 0.1, span: 1.9, tips: 18, depth: 0.45 });
  hair.userData.crown = { y: 0.02, z: -0.015, r: R + 0.022 };
  return hair;
}

function bunHair(head, color, light) {
  const hair = shortHair(head, color, light);
  const bun = part(new THREE.SphereGeometry(0.13, 16, 12), toon(color), 0, 0.3, -0.18, hair, { ol: 0.008 });
  bun.userData.bun = true;
  return hair;
}

function bobHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  hairCap(hair, color, light, { r: R + 0.026, theta: 0.5, tilt: -0.2, z: -0.01 });
  bangs(hair, color, { y: 0.06, span: 1.9 });
  // chin-length shell, tucking in slightly at the ends
  const shell = add(new THREE.CylinderGeometry(R + 0.035, R + 0.06, 0.44, 48, 1, true, 0.62, TAU - 1.24), strandMat(color, 40, 0.12), 0, -0.13, -0.01, hair);
  shell.scale.z = 0.95;
  hair.userData.crown = { y: 0.02, z: -0.01, r: R + 0.026 };
  return hair;
}

function ponytailHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  hairCap(hair, color, light, { r: R + 0.022, theta: 0.58, tilt: -0.5 });
  bangs(hair, color, { y: 0.075, h: 0.13, at: 0.15, span: 1.8, tiltZ: 0.1, tips: 16, depth: 0.42 });
  tail(hair, color, [0, 0.17, -0.37], { len: 0.55, swing: 0.3 });
  hair.userData.crown = { y: 0.02, z: -0.015, r: R + 0.022 };
  return hair;
}

function pigtailHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  hairCap(hair, color, light, { r: R + 0.022, theta: 0.6, tilt: -0.35 });
  bangs(hair, color, { y: 0.07, span: 1.9, tips: 20 });
  for (const s of [-1, 1]) tail(hair, color, [0.3 * s, -0.04, -0.17], { len: 0.42, w: 0.075, swing: 0.15, splay: -0.25 * s });
  hair.userData.crown = { y: 0.02, z: -0.015, r: R + 0.022 };
  return hair;
}

function curtainHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  hairCap(hair, color, light, { r: R + 0.024, theta: 0.57, tilt: -0.38 });
  // centre-parted bangs sweeping out toward the temples
  for (const s of [-1, 1]) bangs(hair, color, { y: 0.08, h: 0.16, at: s * 0.58, span: 1.0, tiltZ: -0.1 * s, tips: 12, depth: 0.5 });
  hair.userData.crown = { y: 0.02, z: -0.015, r: R + 0.024 };
  return hair;
}

function buzzHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  hairCap(hair, color, light, { r: R + 0.014, theta: 0.55, tilt: -0.32, ol: 0.006 });
  hair.userData.crown = { y: 0.02, z: -0.015, r: R + 0.014 };
  return hair;
}

const HAIR_BUILDERS = { short: shortHair, wavy: wavyHair, long: longHair, bun: bunHair, bob: bobHair, ponytail: ponytailHair, curtain: curtainHair, buzz: buzzHair, pigtails: pigtailHair };

/**
 * Fit hair under a shell (hat or raised hood) centred at `center` (head-local) with
 * `radius`. A part whose bounds reach past the shell while its centre sits above
 * `minY` is hidden, except: the crown cap (always fits), `keep` parts (fringe,
 * face-framing locks), which are pressed down instead when `press` is set, and
 * hanging tails when `tails` is set (they fall out from under a hat).
 */
function tuckHair(c, center, radius, { minY = -Infinity, press = false, tails = false } = {}) {
  c.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(c.head.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  for (const o of [...c.hair.children]) {
    const meshes = [];
    o.traverse((x) => x.isMesh && !x.userData.isOutline && meshes.push(x));
    if (meshes.some((x) => x.userData.crownPart) || (tails && o.userData.tail)) continue;
    let out = false;
    for (const mesh of meshes) {
      mesh.geometry.computeBoundingSphere();
      sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(m.multiplyMatrices(inv, mesh.matrixWorld));
      if (sphere.center.y > minY && sphere.center.distanceTo(center) + sphere.radius > radius) out = true;
    }
    if (!out) continue;
    if (o.userData.keep) {
      if (press) {
        o.position.y -= 0.05;
        o.scale.y *= 0.8;
      }
    } else o.visible = false;
  }
}

/* ── Body ─────────────────────────────────────────── */

const SHOE_UPPER = new THREE.SphereGeometry(0.084, 20, 10, 0, TAU, 0, Math.PI / 2);
const SHOE_SOLE = new THREE.CylinderGeometry(0.086, 0.082, 0.032, 20);
const soleMats = new Map();

/**
 * A sneaker: a flat sole plus a domed upper that runs forward into a toe.
 * Leg-local; the leg pivot sits 0.5 m above the floor, so y = -0.5 is ground.
 */
function makeShoe(leg, material) {
  const shoe = new THREE.Group();
  shoe.position.set(0, -0.5, 0.038);
  leg.add(shoe);
  // Contrasting sole: cream under dark shoes, warm grey under light ones.
  const lum = material.color ? material.color.r * 0.3 + material.color.g * 0.59 + material.color.b * 0.11 : 0;
  const soleHex = lum > 0.55 ? '#d8cfc2' : '#efe8dc';
  if (!soleMats.has(soleHex)) soleMats.set(soleHex, toon(soleHex));
  const sole = part(SHOE_SOLE, soleMats.get(soleHex), 0, 0.016, 0, shoe, { ol: 0.006 });
  sole.scale.set(1, 1, 1.5);
  const upper = part(SHOE_UPPER, material, 0, 0.03, 0.004, shoe, { ol: 0.008 });
  upper.scale.set(1, 1.08, 1.5);
  shoe.userData.shoe = true;
  return shoe;
}

export function makeChibi(spec) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = toon(spec.skin ?? '#f7d9c4');
  const mats = spec.mats;

  const legs = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0.095 * s, 0.5, 0);
    body.add(g);
    part(new THREE.CapsuleGeometry(0.088, 0.28, 4, 10), mats.legs, 0, -0.2, 0, g);
    makeShoe(g, mats.shoes);
    return g;
  });

  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0.235 * s, 1.0, 0);
    body.add(g);
    part(new THREE.CapsuleGeometry(0.072, 0.26, 4, 10), mats.sleeves, 0, -0.17, 0, g);
    part(new THREE.SphereGeometry(0.072, 12, 10), skin, 0, -0.38, 0, g);
    g.rotation.z = 0.14 * s;
    return g;
  });

  add(new THREE.CylinderGeometry(0.07, 0.075, 0.14, 12), skin, 0, 1.12, 0, body);
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  body.add(head);
  part(new THREE.SphereGeometry(R, 40, 28), skin, 0, 0, 0, head, { ol: 0.013 });
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.06, 10, 8), skin, s * 0.345, -0.05, 0, head, { ol: 0.006 }).scale.set(0.5, 1, 0.8);
  const face = makeFace(head, { skin: spec.skin ?? '#f7d9c4', ...spec.face });

  const hair = (HAIR_BUILDERS[spec.hairStyle] ?? shortHair)(head, spec.hair, spec.hairLight);
  hair.userData.crown ??= DEFAULT_CROWN;

  const c = {
    name: spec.name,
    root,
    body,
    head,
    legs,
    arms,
    hair,
    face,
    skin,
    walkT: 0,
    blinkT: rand(1, 4),
    blinking: false,
    lookYaw: 0,
    look: 0,
    pose: 'idle',
    expr: spec.expr ?? 'neutral',
    baseExpr: spec.expr ?? 'neutral',
    exprT: 0,
    talkT: 0,
    wave: 0,
    hairFlip: 0,
    sway: 0,
    armPose: null,
  };
  spec.outfit?.(c, { body, skin, mats });
  G.scene.add(root);
  return c;
}

export function setExpr(c, expr, dur = 0) {
  c.expr = expr;
  c.exprT = dur;
}

/** Per-frame animation: walk/sit/dance poses, blinking, talking, hair. */
export function animate(c, dt, t, speed = 0) {
  c.walkT += dt * 10 * speed;
  const sw = Math.sin(c.walkT) * Math.min(speed, 1);
  const L = c.legs;
  const A = c.arms;
  let arm = [-sw * 0.6, sw * 0.6];
  let armZ = [-0.14, 0.14];
  c.body.rotation.y = 0;
  c.body.rotation.z = 0;
  if (c.pose === 'sit') {
    const kick = c.legSwing ? Math.sin(t * 2.2) * 0.18 : 0;
    L[0].rotation.x = -1.45 + kick;
    L[1].rotation.x = -1.45 - kick;
    c.body.position.y = 0;
  } else if (c.pose === 'dance') {
    const b = t * 2.2 * Math.PI;
    c.body.position.y = Math.abs(Math.sin(b)) * 0.07;
    c.body.rotation.y = Math.sin(b / 4) * 0.5;
    c.body.rotation.z = Math.sin(b / 2) * 0.08;
    L[0].rotation.x = Math.max(0, Math.sin(b)) * -0.6;
    L[1].rotation.x = Math.max(0, -Math.sin(b)) * -0.6;
    arm = [-1.4 + Math.sin(b) * 0.9, -0.6 + Math.cos(b) * 1.1];
    armZ = [-0.5 - Math.sin(b / 2) * 0.4, 0.5 + Math.cos(b / 2) * 0.4];
    c.lookYaw = Math.sin(b / 4) * -0.3;
  } else {
    L[0].rotation.x = sw * 0.7;
    L[1].rotation.x = -sw * 0.7;
    c.body.position.y = Math.abs(Math.cos(c.walkT)) * 0.05 * Math.min(speed, 1) + Math.sin(t * 2) * 0.006;
  }
  if (c.armPose) arm = c.armPose(t);
  const k = damp(12, dt);
  A[0].rotation.x += (arm[0] - A[0].rotation.x) * k;
  A[1].rotation.x += (arm[1] - A[1].rotation.x) * k;
  A[0].rotation.z += (armZ[0] - A[0].rotation.z) * k;
  A[1].rotation.z += (armZ[1] - A[1].rotation.z) * k;
  if (c.wave > 0) {
    c.wave -= dt;
    A[1].rotation.x = -2.7;
    A[1].rotation.z = 0.35 + Math.sin(t * 14) * 0.35;
  }
  c.head.rotation.y += (c.lookYaw - c.head.rotation.y) * damp(6, dt);

  // hair trails behind motion, flips when flustered
  c.sway += (-speed * 0.12 - c.sway) * damp(4, dt);
  c.hair.rotation.x = c.sway;
  if (c.hairFlip > 0) {
    c.hairFlip -= dt;
    const kk = Math.sin((1 - c.hairFlip / 0.7) * Math.PI);
    c.hair.rotation.z = kk * 0.25;
    c.head.rotation.z = kk * 0.12;
  } else {
    c.hair.rotation.z *= 0.9;
    c.head.rotation.z *= 0.9;
  }

  // face
  if (c.exprT > 0) {
    c.exprT -= dt;
    if (c.exprT <= 0) c.expr = c.baseExpr;
  }
  c.blinkT -= dt;
  if (c.blinkT < 0) {
    c.blinking = true;
    if (c.blinkT < -0.12) {
      c.blinking = false;
      c.blinkT = rand(2, 5);
    }
  }
  let talkOpen = false;
  if (c.talkT > 0) {
    c.talkT -= dt;
    talkOpen = Math.floor(t * 9) % 2 === 0;
  }
  const key = `${c.expr}|${c.blinking}|${talkOpen}|${c.look.toFixed(1)}`;
  if (key !== c.face.key) {
    c.face.key = key;
    // Brows only depend on expression; skip their texture upload on blinks/talking.
    const browG = c.face.browG && c.face.browKey !== c.expr ? c.face.browG : null;
    drawFace(c.face.g, c.face.f, { expr: c.expr, blink: c.blinking, talkOpen, look: c.look }, browG);
    c.face.tex.needsUpdate = true;
    if (browG) {
      c.face.browKey = c.expr;
      c.face.browTex.needsUpdate = true;
    }
  }
}

export function lookAtYaw(c, target, limit = 1.1) {
  const p = c.root.position;
  const want = Math.atan2(target.x - p.x, target.z - p.z);
  c.lookYaw = clamp(wrapAngle(want - c.root.rotation.y - c.body.rotation.y), -limit, limit);
}

export const headPos = (c, v = new THREE.Vector3()) => c.head.getWorldPosition(v);

/* ── Cast ─────────────────────────────────────────── */

const silver = new THREE.MeshStandardMaterial({ color: 0xeef1f6, metalness: 1, roughness: 0.18, emissive: 0x555a60 });

function texMat(color, t, r = 2) {
  const tt = tiled(t, r, r);
  return toon(color, { map: tt.map, normalMap: tt.normalMap });
}

const FACE_BASE = { line: '#1f1418', iris: '#6b4630', irisDark: '#2b1810', irisLight: '#b78a5c', brow: '#2b1d1a', mouthLine: '#a2555c' };

export function makeHaeun() {
  const jacket = texMat('#ffffff', leather(), 3);
  return makeChibi({
    name: 'haeun',
    skin: '#f6d6c2',
    hair: '#141419',
    hairLight: 'rgba(150,160,200,0.85)',
    hairStyle: 'long',
    expr: 'cool',
    face: { ...FACE_BASE, browStyle: 'arched', nose: 'line', mouthShape: 'full', lid: 'single', marks: 'mole', liner: true, tilt: 0.16, browTilt: 0.6, browW: 5, mouthLine: '#b8545c', blush: 0.18, iris: '#5a3a2a' },
    mats: { legs: texMat('#ffffff', denim('#5277b3'), 1.5), shoes: toon('#1d1d22'), sleeves: jacket },
    outfit: (c, { body, skin }) => {
      lathe([[0, 0.4], [0.18, 0.4], [0.205, 0.5], [0.19, 0.62], [0, 0.62]], texMat('#ffffff', denim('#5277b3'), 1.5), body);
      lathe([[0, 0.6], [0.188, 0.6], [0.172, 0.7], [0.17, 0.78], [0, 0.78]], skin, body, { ol: 0 });
      lathe([[0, 0.76], [0.175, 0.76], [0.18, 0.82], [0.19, 0.95], [0.2, 1.03], [0.17, 1.1], [0.09, 1.15], [0, 1.16]], toon('#f7f5f0'), body);
      const gap = 1.1;
      const jk = lathe([[0.205, 0.73], [0.195, 0.8], [0.208, 0.95], [0.222, 1.03], [0.195, 1.1], [0.125, 1.16]], jacket, body, { phiStart: gap / 2, phiLength: TAU - gap, ol: 0 });
      jk.material = jacket.clone();
      jk.material.side = THREE.DoubleSide;
      const collar = add(new THREE.TorusGeometry(0.125, 0.03, 8, 24, TAU - 1.3), jacket, 0, 1.13, 0, body);
      collar.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.65);
      for (const s of [-1, 1]) {
        const z = add(new THREE.BoxGeometry(0.012, 0.32, 0.012), silver, Math.sin(s * gap * 0.5) * 0.205, 0.89, Math.cos(gap * 0.5) * 0.205, body, false);
        z.rotation.y = s * gap * 0.5;
      }
      add(new THREE.BoxGeometry(0.06, 0.012, 0.012), silver, -0.12, 0.92, 0.17, body, false).rotation.y = -0.6;
      const neck = add(new THREE.TorusGeometry(0.085, 0.007, 6, 24), silver, 0, 1.11, 0.03, body, false);
      neck.rotation.x = Math.PI / 2 - 0.4;
      const cross = new THREE.Group();
      cross.position.set(0.345, -0.15, 0.02);
      add(new THREE.BoxGeometry(0.012, 0.075, 0.01), silver, 0, 0, 0, cross, false);
      add(new THREE.BoxGeometry(0.042, 0.012, 0.01), silver, 0, 0.014, 0, cross, false);
      c.head.add(cross);
      c.legSwing = false;
    },
  });
}

export function makeJin() {
  const sweater = texMat('#ffffff', knit('#f2e9d8'), 0.6);
  return makeChibi({
    name: 'jin',
    skin: '#f3d3bb',
    hair: '#4a2f22',
    hairLight: 'rgba(200,150,110,0.8)',
    hairStyle: 'wavy',
    expr: 'smile',
    face: { ...FACE_BASE, browStyle: 'soft', nose: 'button', mouthShape: 'cat', lid: 'double', iris: '#6a4632', tilt: 0.02, browW: 6, browTilt: -0.2, brow: '#3b261c', mouthLine: '#a56060', blush: 0.12, eyeSize: 0.92 },
    mats: { legs: toon('#5d5f66'), shoes: toon('#efe9df'), sleeves: sweater },
    outfit: (c, { body }) => {
      lathe([[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]], toon('#5d5f66'), body);
      lathe([[0, 0.5], [0.205, 0.5], [0.215, 0.58], [0.205, 0.75], [0.21, 0.95], [0.222, 1.03], [0.19, 1.1], [0.1, 1.15], [0, 1.16]], sweater, body);
      const hem = add(new THREE.TorusGeometry(0.208, 0.025, 8, 28), sweater, 0, 0.52, 0, body);
      hem.rotation.x = Math.PI / 2;
      const tee = add(new THREE.TorusGeometry(0.1, 0.022, 8, 24), toon('#ffffff'), 0, 1.13, 0.01, body);
      tee.rotation.x = Math.PI / 2;
      for (const a of c.arms) {
        const cuff = add(new THREE.TorusGeometry(0.075, 0.025, 8, 16), sweater, 0, -0.31, 0, a);
        cuff.rotation.x = Math.PI / 2;
      }
      const br = add(new THREE.TorusGeometry(0.07, 0.012, 6, 16), toon('#e9dcc6'), 0, -0.34, 0, c.arms[1], false);
      br.rotation.x = Math.PI / 2;
      add(new THREE.SphereGeometry(0.014, 8, 6), silver, 0.35, -0.13, 0.02, c.head, false);
    },
  });
}

/* ── Player look (character creator) ─────────────── */

export const LOOK_OPTIONS = {
  skin: ['#f8dcc8', '#f4d4bd', '#e9bf9c', '#c98f68', '#8d5b3e'],
  hair: ['#141419', '#3b2a20', '#7a5236', '#c9a06a', '#b0566b', '#5b6b8f'],
  hairStyle: ['short', 'wavy', 'long', 'bun', 'bob', 'ponytail', 'curtain', 'buzz', 'pigtails'],
  eyes: ['#4e3a2c', '#2b1d18', '#6b7a4a', '#4f6f8f'],
  brows: ['soft', 'straight', 'arched', 'natural', 'tapered'],
  nose: ['dot', 'button', 'line', 'soft'],
  mouth: ['classic', 'small', 'wide', 'cat', 'full'],
  lids: ['double', 'single', 'hooded'],
  marks: ['none', 'freckles', 'mole', 'both'],
  topStyle: ['hoodie', 'tee', 'knit', 'jacket'],
  hood: ['down', 'up'],
  top: ['#e7dac4', '#9fb8d6', '#e9a8b5', '#7c9a6e', '#3c3f4a', '#c95b4a'],
  bottom: ['jeans', 'slacks', 'shorts', 'skirt'],
  bottomColor: ['#3e4f6e', '#5a5148', '#2f2f36', '#c9b48f', '#8a4a5a'],
  shoes: ['#f7f4ee', '#2a2a2e', '#c9a27a', '#d9534f'],
  hat: ['beanie', 'cap', 'none'],
  glasses: [false, true],
};

// Fields stored as palette indices; the rest store the option value itself.
const INDEXED = new Set(['skin', 'hair', 'eyes', 'top', 'bottomColor', 'shoes']);
export const isIndexedLook = (k) => INDEXED.has(k);

/** Continuous look values: [min, max]. Stored as numbers rounded to 0.01. */
export const LOOK_RANGES = {
  browThick: [0.5, 1.6],
  browLen: [0.8, 1.2],
  lashLen: [0, 1],
  lashThick: [0.4, 1.6],
};

/** Presentation presets; every field remains individually editable. */
export const LOOK_PRESETS = {
  m: { gender: 'm', skin: 1, hair: 1, hairStyle: 'short', eyes: 0, brows: 'straight', nose: 'dot', mouth: 'classic', lids: 'double', marks: 'none',
    topStyle: 'hoodie', hood: 'down', top: 0, bottom: 'jeans', bottomColor: 0, shoes: 0, hat: 'beanie', glasses: false,
    browThick: 1.15, browLen: 1, lashLen: 0, lashThick: 0.8 },
  f: { gender: 'f', skin: 0, hair: 1, hairStyle: 'long', eyes: 0, brows: 'soft', nose: 'button', mouth: 'full', lids: 'double', marks: 'none',
    topStyle: 'knit', hood: 'down', top: 2, bottom: 'skirt', bottomColor: 2, shoes: 0, hat: 'none', glasses: false,
    browThick: 0.95, browLen: 1, lashLen: 0.55, lashThick: 0.9 },
};

// Brow shapes retired from the creator, mapped to a shape plus a thickness.
const LEGACY_BROWS = { thick: ['natural', 1.4], thin: ['tapered', 0.65] };

/** Coerce a saved/edited look into a valid one (unknown values fall back to the preset). */
export function normalizeLook(look) {
  const base = LOOK_PRESETS[look?.gender === 'f' ? 'f' : 'm'];
  const src = { ...look };
  if (typeof src.hat === 'boolean') src.hat = src.hat ? 'beanie' : 'none'; // first creator build stored a boolean
  if (LEGACY_BROWS[src.brows]) {
    const [shape, thick] = LEGACY_BROWS[src.brows];
    src.brows = shape;
    if (!Number.isFinite(src.browThick)) src.browThick = thick;
  }
  const out = { gender: base.gender };
  for (const [k, values] of Object.entries(LOOK_OPTIONS)) {
    const v = src[k];
    const ok = INDEXED.has(k) ? Number.isInteger(v) && v >= 0 && v < values.length : values.includes(v);
    out[k] = ok ? v : base[k];
  }
  for (const [k, [lo, hi]] of Object.entries(LOOK_RANGES)) {
    const v = src[k];
    out[k] = typeof v === 'number' && Number.isFinite(v) ? Math.round(clamp(v, lo, hi) * 100) / 100 : base[k];
  }
  return out;
}

/** Brow colour follows the hair colour, deepened toward dark brown. */
function browColor(hairHex) {
  const n = parseInt(hairHex.slice(1), 16);
  const mix = (c, d) => Math.round(c * 0.45 + d * 0.55);
  const r = mix((n >> 16) & 255, 0x1e), g = mix((n >> 8) & 255, 0x15), b = mix(n & 255, 0x12);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Face-painter features for a (normalized) player look. */
export function playerFace(look) {
  const O = LOOK_OPTIONS;
  const features = {
    browStyle: look.brows, nose: look.nose, mouthShape: look.mouth, lid: look.lids, marks: look.marks, iris: O.eyes[look.eyes],
    brow: browColor(O.hair[look.hair]), browThick: look.browThick, browLen: look.browLen, lashLen: look.lashLen, lashThick: look.lashThick,
  };
  return look.gender === 'f'
    ? { ...FACE_BASE, tilt: 0.08, browW: 5, blush: 0.24, mouthLine: '#b8585f', eyeSize: 1, ...features }
    : { ...FACE_BASE, tilt: 0.04, browW: 5, eyeSize: 0.95, ...features };
}

/** Repaint a player's face for a new look without rebuilding the body (brow/lash sliders). */
export function repaintFace(c, rawLook) {
  const look = normalizeLook(rawLook);
  Object.assign(c.face.f, playerFace(look));
  c.face.key = '';
  c.face.browKey = null;
}

// Face opening of a raised hood, in unit-sphere directions around the hood centre.
const HOOD_HOLE = { x: 0.7, y0: -0.12, y: 0.74, minY: -0.8 };
const inHoodHole = (d) => d.z > 0 && (d.x / HOOD_HOLE.x) ** 2 + ((d.y - HOOD_HOLE.y0) / HOOD_HOLE.y) ** 2 < 1;

/** A raised hood: a sphere shell around the hair crown with an oval face opening and a soft rim. */
function hoodUp(c, material) {
  const crown = c.hair.userData.crown;
  const r = crown.r + 0.06;
  const center = new THREE.Vector3(0, crown.y, crown.z - 0.01);
  const geo = new THREE.SphereGeometry(r, 40, 28);
  const pos = geo.attributes.position;
  const idx = geo.index.array;
  const kept = [];
  const d = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    d.set(0, 0, 0);
    for (let k = 0; k < 3; k++) d.x += pos.getX(idx[i + k]), d.y += pos.getY(idx[i + k]), d.z += pos.getZ(idx[i + k]);
    d.normalize();
    if (d.y < HOOD_HOLE.minY || inHoodHole(d)) continue;
    kept.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(kept);
  const hood = new THREE.Group();
  hood.position.copy(center);
  hood.userData.hood = 'up';
  c.head.add(hood);
  const shellMat = material.clone();
  shellMat.side = THREE.DoubleSide;
  part(geo, shellMat, 0, 0, 0, hood, { ol: 0.01 });
  // rolled rim around the opening
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = -Math.PI / 2 + (i / 48) * TAU;
    const x = HOOD_HOLE.x * Math.cos(a);
    const y = HOOD_HOLE.y0 + HOOD_HOLE.y * Math.sin(a);
    if (y < HOOD_HOLE.minY + 0.02) continue;
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    pts.push(new THREE.Vector3(x, y, z).multiplyScalar(r));
  }
  part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.028, 8, false), material, 0, 0, 0, hood, { ol: 0.006 });
  tuckHair(c, center, r - 0.012);
  return hood;
}

/** A lowered hood: a soft folded cowl lying across the upper back, under any long hair. */
function hoodDown(body, material) {
  const m = material.clone();
  m.side = THREE.DoubleSide;
  const cowl = lathe([[0.215, 0.87], [0.255, 0.9], [0.29, 0.98], [0.285, 1.07], [0.235, 1.135], [0.16, 1.15]], m, body, { phiStart: Math.PI - 1.25, phiLength: 2.5, ol: 0.008 });
  cowl.userData.hood = 'down';
  return cowl;
}

function addTop(c, body, look, color) {
  const torso = [[0, 0.5], [0.21, 0.5], [0.22, 0.6], [0.21, 0.78], [0.215, 0.95], [0.225, 1.03], [0.19, 1.1], [0.1, 1.15], [0, 1.16]];
  if (look.topStyle === 'tee') {
    const tee = toon(color);
    lathe([[0, 0.5], [0.2, 0.5], [0.21, 0.6], [0.2, 0.78], [0.205, 0.95], [0.215, 1.03], [0.185, 1.1], [0.1, 1.15], [0, 1.16]], tee, body);
    const neck = add(new THREE.TorusGeometry(0.095, 0.02, 8, 24), tee, 0, 1.13, 0.01, body);
    neck.rotation.x = Math.PI / 2;
    for (const a of c.arms) part(new THREE.CylinderGeometry(0.088, 0.096, 0.16, 12), tee, 0, -0.06, 0, a, { ol: 0.008 });
  } else if (look.topStyle === 'knit') {
    const sweater = texMat('#ffffff', knit(color), 0.6);
    lathe(torso, sweater, body);
    const hem = add(new THREE.TorusGeometry(0.212, 0.025, 8, 28), sweater, 0, 0.52, 0, body);
    hem.rotation.x = Math.PI / 2;
    const collar = add(new THREE.TorusGeometry(0.1, 0.03, 8, 24), sweater, 0, 1.13, 0.01, body);
    collar.rotation.x = Math.PI / 2;
    for (const a of c.arms) {
      const cuff = add(new THREE.TorusGeometry(0.075, 0.025, 8, 16), sweater, 0, -0.31, 0, a);
      cuff.rotation.x = Math.PI / 2;
    }
  } else if (look.topStyle === 'jacket') {
    const jacket = texMat(color, leather(), 3);
    lathe([[0, 0.5], [0.19, 0.5], [0.2, 0.6], [0.19, 0.8], [0.2, 0.95], [0.21, 1.03], [0.18, 1.1], [0.09, 1.15], [0, 1.16]], toon('#f7f5f0'), body);
    const gap = 1.0;
    const jk = lathe([[0.215, 0.5], [0.225, 0.6], [0.212, 0.8], [0.218, 0.95], [0.232, 1.03], [0.2, 1.1], [0.13, 1.16]], jacket, body, { phiStart: gap / 2, phiLength: TAU - gap, ol: 0 });
    jk.material = jacket.clone();
    jk.material.side = THREE.DoubleSide;
    const collar = add(new THREE.TorusGeometry(0.13, 0.03, 8, 24, TAU - 1.3), jacket, 0, 1.13, 0, body);
    collar.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.65);
  } else {
    const hoodie = texMat('#ffffff', fabric(color), 0.5);
    lathe(torso, hoodie, body);
    add(new THREE.BoxGeometry(0.22, 0.12, 0.04), hoodie, 0, 0.66, 0.2, body);
    if (look.hood === 'up') hoodUp(c, hoodie);
    else hoodDown(body, hoodie);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 5), toon('#f8f3ea'), s * 0.05, 0.98, 0.205, body, false);
  }
}

function addHeadwear(c, look) {
  const crown = c.hair.userData.crown;
  const center = new THREE.Vector3(0, crown.y, crown.z);
  const hooded = look.topStyle === 'hoodie' && look.hood === 'up';
  if (look.hat === 'beanie') {
    const beanieTex = tiled(knit('#e8a33d'), 3, 1.5);
    const beanie = toon('#ffffff', { map: beanieTex.map, normalMap: beanieTex.normalMap });
    const r = crown.r + 0.026;
    part(new THREE.SphereGeometry(r, 32, 16, 0, TAU, 0, Math.PI * 0.42), beanie, 0, crown.y + 0.03, crown.z, c.head);
    // The rolled cuff is thicker than the hood allows; under a raised hood only the crown shows.
    if (!hooded) {
      const cuff = add(new THREE.TorusGeometry(r - 0.012, 0.048, 10, 32), beanie, 0, crown.y + 0.03 + r * Math.cos(Math.PI * 0.42) - 0.01, crown.z, c.head);
      cuff.rotation.x = Math.PI / 2;
    }
    if (!hooded) part(new THREE.SphereGeometry(0.08, 12, 10), toon('#fff3dc'), 0, crown.y + 0.03 + r + 0.03, crown.z, c.head, { ol: 0.008 });
    if (!hooded) tuckHair(c, center, r + 0.004, { minY: crown.y + 0.1, press: true, tails: true });
  } else if (look.hat === 'cap') {
    const capM = toon(LOOK_OPTIONS.top[look.top]);
    const r = crown.r + 0.02;
    part(new THREE.SphereGeometry(r, 32, 16, 0, TAU, 0, Math.PI * 0.42), capM, 0, crown.y + 0.04, crown.z, c.head);
    const brim = part(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 24, 1, false, -Math.PI / 2, Math.PI), capM, 0, crown.y + 0.04 + r * Math.cos(Math.PI * 0.42) + 0.005, crown.z + r * Math.sin(Math.PI * 0.42) - 0.12, c.head, { ol: 0.008 });
    brim.scale.set(1, 1, 0.9);
    brim.rotation.x = 0.12;
    if (!hooded) part(new THREE.SphereGeometry(0.03, 8, 6), capM, 0, crown.y + 0.04 + r, crown.z, c.head, { ol: 0.006 });
    if (!hooded) tuckHair(c, center, r + 0.004, { minY: crown.y + 0.12, press: true, tails: true });
  }
  if (look.glasses) {
    const frame = toon('#2a1c22');
    for (const s of [-1, 1]) {
      const ring = add(new THREE.TorusGeometry(0.068, 0.009, 6, 24), frame, s * 0.128, -0.055, 0.35, c.head, false);
      ring.rotation.y = s * 0.36;
      add(new THREE.BoxGeometry(0.012, 0.012, 0.3), frame, s * 0.33, -0.04, 0.17, c.head, false).rotation.y = s * 0.12;
    }
    add(new THREE.BoxGeometry(0.06, 0.01, 0.01), frame, 0, -0.045, 0.36, c.head, false);
  }
}

export function makePlayer(rawLook = LOOK_PRESETS.m) {
  const look = normalizeLook(rawLook);
  const O = LOOK_OPTIONS;
  const skinTone = O.skin[look.skin];
  const lower = O.bottomColor[look.bottomColor];
  const denimMat = texMat('#ffffff', denim(lower), 1.5);
  const cloth = look.bottom === 'jeans' ? denimMat : look.bottom === 'skirt' ? texMat('#ffffff', fabric(lower), 0.8) : toon(lower);
  // Shorts and skirts show the leg; a skirt adds dark tights.
  const legs = look.bottom === 'shorts' ? toon(skinTone) : look.bottom === 'skirt' ? toon('#3a3640') : cloth;
  const sleeves = look.topStyle === 'tee' ? toon(skinTone)
    : look.topStyle === 'knit' ? texMat('#ffffff', knit(O.top[look.top]), 0.6)
    : look.topStyle === 'jacket' ? texMat(O.top[look.top], leather(), 3)
    : texMat('#ffffff', fabric(O.top[look.top]), 0.5);
  return makeChibi({
    name: 'player',
    skin: skinTone,
    hair: O.hair[look.hair],
    hairLight: 'rgba(170,130,100,0.7)',
    hairStyle: look.hairStyle,
    expr: 'smile',
    face: playerFace(look),
    mats: { legs, shoes: toon(O.shoes[look.shoes]), sleeves },
    outfit: (c, { body }) => {
      if (look.bottom === 'skirt') {
        lathe([[0, 0.38], [0.27, 0.38], [0.24, 0.5], [0.205, 0.62], [0, 0.62]], cloth, body);
      } else {
        lathe([[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]], cloth, body);
        if (look.bottom === 'shorts') for (const l of c.legs) part(new THREE.CylinderGeometry(0.105, 0.11, 0.16, 12), cloth, 0, -0.04, 0, l, { ol: 0.008 });
      }
      addTop(c, body, look, O.top[look.top]);
      addHeadwear(c, look);
    },
  });
}

/** Rebuild an existing player's body in place, keeping its root, rides, pose and story references. */
export function restylePlayer(c, look) {
  const n = makePlayer(look);
  n.root.remove(n.body);
  G.scene.remove(n.root);
  n.body.position.copy(c.body.position);
  n.body.rotation.copy(c.body.rotation);
  c.root.remove(c.body);
  c.root.add(n.body);
  for (const k of ['body', 'head', 'legs', 'arms', 'hair', 'face', 'skin', 'legSwing']) c[k] = n[k];
  c.face.key = '';
  c.face.browKey = null;
  return c;
}

export function makeAjusshi() {
  return makeChibi({
    name: 'ajusshi',
    skin: '#eec3a5',
    hair: '#8f8c88',
    hairLight: 'rgba(230,230,230,0.6)',
    hairStyle: 'short',
    expr: 'smile',
    face: { ...FACE_BASE, browStyle: 'thick', nose: 'soft', mouthShape: 'wide', lid: 'hooded', iris: '#3a2a22', tilt: -0.05, browW: 8, brow: '#6d6560', mustache: true, eyeSize: 0.8, blush: 0.3 },
    mats: { legs: toon('#3e3f48'), shoes: toon('#2a2a2e'), sleeves: toon('#ddd5c4') },
    outfit: (c, { body }) => {
      lathe([[0, 0.4], [0.18, 0.4], [0.21, 0.5], [0.2, 0.6], [0, 0.6]], toon('#3e3f48'), body);
      lathe([[0, 0.5], [0.22, 0.5], [0.24, 0.62], [0.235, 0.8], [0.22, 0.95], [0.22, 1.03], [0.19, 1.1], [0.1, 1.15], [0, 1.16]], toon('#ddd5c4'), body);
      const apron = add(new THREE.CylinderGeometry(0.245, 0.25, 0.55, 20, 1, true, -0.9, 1.8), toon('#2f5d50', { side: THREE.DoubleSide }), 0, 0.75, 0, body);
      apron.castShadow = false;
      const band = add(new THREE.TorusGeometry(R + 0.005, 0.045, 10, 32), toon('#fafafa'), 0, 0.1, 0, c.head);
      band.rotation.x = Math.PI / 2;
    },
  });
}

export function makeBarista() {
  return makeChibi({
    name: 'barista',
    skin: '#f7dccb',
    hair: '#5a3826',
    hairLight: 'rgba(200,150,110,0.7)',
    hairStyle: 'bun',
    expr: 'smile',
    face: { ...FACE_BASE, browStyle: 'thin', nose: 'button', mouthShape: 'small', lid: 'double', marks: 'freckles', lashes: true, iris: '#5d3c2a', tilt: 0.06, blush: 0.28, mouthLine: '#c0606a' },
    mats: { legs: toon('#2f2f36'), shoes: toon('#2a2a2e'), sleeves: toon('#f4ede4') },
    outfit: (c, { body }) => {
      lathe([[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]], toon('#2f2f36'), body);
      lathe([[0, 0.5], [0.2, 0.5], [0.205, 0.62], [0.19, 0.78], [0.2, 0.95], [0.21, 1.03], [0.18, 1.1], [0.1, 1.15], [0, 1.16]], toon('#f4ede4'), body);
      add(new THREE.CylinderGeometry(0.215, 0.22, 0.5, 20, 1, true, -0.9, 1.8), toon('#7a4a2e', { side: THREE.DoubleSide }), 0, 0.74, 0, body);
    },
  });
}

export function makeCashier() {
  return makeChibi({
    name: 'cashier',
    skin: '#f1cfb6',
    hair: '#1e1a1c',
    hairLight: 'rgba(140,150,190,0.7)',
    hairStyle: 'short',
    expr: 'smile',
    face: { ...FACE_BASE, browStyle: 'straight', nose: 'dot', lid: 'single', iris: '#3e2c22', tilt: 0, eyeSize: 0.9 },
    mats: { legs: toon('#33384a'), shoes: toon('#2a2a2e'), sleeves: toon('#fafafa') },
    outfit: (c, { body }) => {
      lathe([[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]], toon('#33384a'), body);
      lathe([[0, 0.5], [0.2, 0.5], [0.205, 0.62], [0.19, 0.78], [0.2, 0.95], [0.21, 1.03], [0.18, 1.1], [0.1, 1.15], [0, 1.16]], toon('#fafafa'), body);
      lathe([[0.215, 0.52], [0.21, 0.7], [0.215, 0.95], [0.225, 1.03], [0.18, 1.08]], toon('#2e9a5a', { side: THREE.DoubleSide }), body, { phiStart: 0.4, phiLength: TAU - 0.8, ol: 0 });
    },
  });
}

const PED_TOPS = ['#c95b4a', '#5b7fc9', '#f0c34d', '#7cb07a', '#b07cc0', '#e98aa6', '#56575e', '#f2efe8'];
const PED_PANTS = ['#2f3442', '#4f74ad', '#5d5f66', '#8a6e52', '#1f1f24'];
const PED_HAIR = ['#141419', '#3b2a20', '#5a3826', '#2a1c16', '#7a5236'];

export function makePedestrian(seed) {
  const r = seeded(seed);
  const p = (a) => a[Math.floor(r() * a.length)];
  const top = p(PED_TOPS);
  const pants = p(PED_PANTS);
  const style = p(['short', 'long', 'bun', 'wavy']);
  return makeChibi({
    name: 'ped',
    skin: p(['#f6d6c2', '#efcbb1', '#f3dcca', '#e6bf9f']),
    hair: p(PED_HAIR),
    hairLight: 'rgba(170,150,140,0.6)',
    hairStyle: style,
    expr: p(['neutral', 'smile', 'smile']),
    face: { ...FACE_BASE, lashes: style !== 'short', tilt: r() * 0.12, eyeSize: 0.85 + r() * 0.15,
      browStyle: p(['soft', 'straight', 'arched', 'thick', 'thin']), nose: p(['dot', 'button', 'line', 'soft']), mouthShape: p(['classic', 'small', 'wide', 'cat', 'full']),
      lid: p(['single', 'single', 'double', 'hooded']), marks: p(['none', 'none', 'none', 'freckles', 'mole']) },
    mats: { legs: toon(pants), shoes: toon(p(['#f7f4ee', '#2a2a2e', '#c9a27a'])), sleeves: toon(top) },
    outfit: (c, { body }) => {
      lathe([[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]], toon(pants), body);
      lathe([[0, 0.5], [0.2, 0.5], [0.21, 0.6], [0.2, 0.78], [0.205, 0.95], [0.215, 1.03], [0.185, 1.1], [0.1, 1.15], [0, 1.16]], toon(top), body);
      if (r() < 0.5) {
        const bag = add(new THREE.BoxGeometry(0.2, 0.24, 0.1), toon(p(['#c9a27a', '#2a2a2e', '#e8dcc6'])), 0, 0.85, -0.24, body);
        bag.castShadow = true;
      }
    },
  });
}

/* ── Tong, the mascot companion ───────────────────── */

export function makeTong() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fur = furTextures('#d9a24a');
  const base = toon('#ffffff', { map: fur.map });
  const ball = part(new THREE.SphereGeometry(0.3, 32, 24), base, 0, 0, 0, body, { ol: 0.012 });
  // shell fur: concentric alpha-tested shells for a fluffy silhouette
  for (let i = 1; i <= 5; i++) {
    const m = toon('#ffffff', { map: fur.map, alphaMap: fur.alpha, alphaTest: 0.18 + i * 0.13 });
    const s = add(new THREE.SphereGeometry(0.3 + i * 0.012, 28, 20), m, 0, 0, 0, body, false);
    s.castShadow = false;
  }
  const facePatch = add(new THREE.SphereGeometry(0.302, 32, 20, Math.PI / 2 - 0.85, 1.7, Math.PI * 0.3, Math.PI * 0.42), toon('#f6e2c8'), 0, 0, 0, body, false);
  facePatch.scale.setScalar(1.075);
  // reuse the painter with Tong's style on a patch matching its geometry
  const [c, g] = makeCanvas(FW, FH);
  const tex = canvasTexture(c, { repeat: false });
  const faceMesh = add(new THREE.SphereGeometry(R * 1.006, 48, 32, Math.PI / 2 - PHI_SPAN / 2, PHI_SPAN, TH0, TH1 - TH0), toon(0xffffff, { map: tex, transparent: true, depthWrite: false }), 0, 0, 0, body, false);
  faceMesh.scale.setScalar((0.302 * 1.08) / R);
  faceMesh.renderOrder = 2;
  const face = { g, tex, key: '', f: { style: 'tong', line: '#1a1214', mouthLine: '#6a3a30', mouthW: 0.06, blush: 0.4, skin: '#f6e2c8' } };

  const pink = toon('#f4a6b4');
  for (const s of [-1, 1]) {
    const ear = part(new THREE.SphereGeometry(0.1, 16, 12), base, s * 0.24, 0.22, -0.04, body);
    ear.scale.set(1, 1, 0.6);
    add(new THREE.SphereGeometry(0.06, 12, 10), pink, s * 0.245, 0.22, 0.01, body, false).scale.set(1, 1, 0.4);
    part(new THREE.SphereGeometry(0.075, 12, 10), base, s * 0.31, -0.06, 0.1, body);
    add(new THREE.SphereGeometry(0.035, 10, 8), pink, s * 0.34, -0.06, 0.16, body, false);
    part(new THREE.SphereGeometry(0.085, 12, 10), base, s * 0.12, -0.29, 0.06, body).scale.set(1, 0.75, 1.15);
  }
  add(new THREE.CylinderGeometry(0.007, 0.007, 0.22, 6), toon('#c79a4a'), 0, 0.4, 0, body, false);
  const bulb = add(new THREE.SphereGeometry(0.045, 14, 12), new THREE.MeshBasicMaterial({ color: hdr(0xffd36a, 3) }), 0, 0.53, 0, body, false);
  G.scene.add(root);
  return { root, body, ball, bulb, face, expr: 'smile', exprT: 0, blinkT: 2, blinking: false, talkT: 0, spin: 0 };
}

export function animateTong(tg, dt, t) {
  tg.body.position.y = Math.sin(t * 2.4) * 0.06;
  tg.body.rotation.z = Math.sin(t * 1.3) * 0.08;
  if (tg.spin > 0) {
    tg.spin -= dt;
    tg.body.rotation.y = (1 - tg.spin / 0.8) * TAU;
  } else tg.body.rotation.y = 0;
  tg.bulb.scale.setScalar(1 + Math.sin(t * 5) * 0.12);
  if (tg.exprT > 0) {
    tg.exprT -= dt;
    if (tg.exprT <= 0) tg.expr = 'smile';
  }
  tg.blinkT -= dt;
  tg.blinking = tg.blinkT < 0;
  if (tg.blinkT < -0.12) tg.blinkT = rand(2, 5);
  let talkOpen = false;
  if (tg.talkT > 0) {
    tg.talkT -= dt;
    talkOpen = Math.floor(t * 9) % 2 === 0;
  }
  const key = `${tg.expr}|${tg.blinking}|${talkOpen}`;
  if (key !== tg.face.key) {
    tg.face.key = key;
    drawFace(tg.face.g, tg.face.f, { expr: tg.expr, blink: tg.blinking, talkOpen });
    tg.face.tex.needsUpdate = true;
  }
}

/* ── 떡이 the cat ─────────────────────────────────── */

export function makeCat(pos) {
  const g = new THREE.Group();
  g.name = 'tteok-cat';
  const fur = toon('#efb36c');
  const white = toon('#fff2df');
  const stripe = toon('#bb7848');
  const pink = toon('#e99caa');
  const ink = toon('#392f30');
  const glint = new THREE.MeshBasicMaterial({ color: '#fff9ed' });
  // Bake proportions into geometry, so the existing body's scale.y breathing
  // and inverted-hull outlines stay aligned. Paws sit at pos.y (crate top).
  const ballGeo = new THREE.SphereGeometry(1, 20, 14);
  function soft(rx, ry, rz, material, x, y, z, parent, ol = 0.003) {
    return part(ballGeo.clone().scale(rx, ry, rz), material, x, y, z, parent, { ol });
  }
  const body = soft(0.215, 0.12, 0.135, fur, -0.035, 0.12, 0, g, 0.005);
  soft(0.12, 0.075, 0.12, white, 0.1, 0.10, 0.005, g, 0);
  for (const s of [-1, 1]) {
    soft(0.07, 0.038, 0.049, white, 0.14, 0.038, s * 0.085, g);
    soft(0.064, 0.039, 0.053, fur, -0.16, 0.04, s * 0.085, g);
    // Tiny pink toe beans on the outward-facing edges of tucked paws.
    for (let k = -1; k <= 1; k++) {
      soft(0.009, 0.009, 0.004, pink, 0.151 + k * 0.019, 0.033, s * 0.132, g, 0);
    }
  }
  const head = new THREE.Group();
  head.position.set(0.17, 0.205, 0.005);
  g.add(head);
  const face = new THREE.Group();
  face.rotation.y = Math.PI / 2; // old cat faces +X; face details use local +Z
  head.add(face);
  soft(0.15, 0.135, 0.14, fur, 0, 0, 0, face, 0.005);
  for (const s of [-1, 1]) {
    soft(0.053, 0.05, 0.07, fur, s * 0.108, -0.043, 0.045, face, 0.003);
  }
  const earShape = new THREE.Shape();
  earShape.moveTo(-0.055, 0);
  earShape.quadraticCurveTo(-0.06, 0.045, -0.028, 0.133);
  earShape.quadraticCurveTo(-0.019, 0.148, -0.006, 0.13);
  earShape.quadraticCurveTo(0.042, 0.075, 0.057, 0.005);
  earShape.closePath();
  const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.036, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, steps: 1, curveSegments: 6 });
  const ears = [];
  const eyes = [];
  const sleepy = [];
  const iris = toon('#8b6948');
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.1, 0.087, -0.008);
    ear.rotation.z = -s * 0.25;
    face.add(ear);
    part(earGeo, fur, 0, 0, 0, ear, { ol: 0.003 });
    const inner = add(earGeo, pink, 0, 0.016, 0.046, ear, false);
    inner.scale.set(0.61, 0.66, 0.36);
    ears.push(ear);
    const eye = new THREE.Group();
    eye.position.set(s * 0.062, 0.012, 0.123);
    eye.rotation.y = s * 0.2;
    face.add(eye);
    soft(0.028, 0.034, 0.014, ink, 0, 0, 0, eye, 0);
    soft(0.018, 0.014, 0.004, iris, 0, -0.015, 0.012, eye, 0);
    soft(0.008, 0.009, 0.003, glint, -0.009, 0.012, 0.015, eye, 0);
    soft(0.0035, 0.004, 0.002, glint, 0.011, -0.009, 0.016, eye, 0);
    eyes.push(eye);
    // Curved contented eyelids replace (not squash) the open eyes on petting.
    const lid = add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(s * 0.062 - 0.024, 0.007, 0.144),
      new THREE.Vector3(s * 0.062, 0.031, 0.15),
      new THREE.Vector3(s * 0.062 + 0.024, 0.007, 0.144),
    ), 10, 0.0028, 5, false), ink, 0, 0, 0, face, false);
    lid.visible = false;
    sleepy.push(lid);
    soft(0.039, 0.025, 0.022, white, s * 0.029, -0.043, 0.129, face, 0);
    soft(0.024, 0.009, 0.007, pink, s * 0.102, -0.027, 0.113, face, 0);
    for (let k = 0; k < 3; k++) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(s * 0.072, -0.042 - k * 0.011, 0.128),
        new THREE.Vector3(s * 0.137, -0.034 - k * 0.016, 0.155),
        new THREE.Vector3(s * (0.188 - k * 0.009), -0.016 - k * 0.029, 0.126),
      );
      add(new THREE.TubeGeometry(curve, 8, 0.0015, 4, false), white, 0, 0, 0, face, false);
    }
    // Warm tabby temple marks, not angry eyebrows.
    soft(0.025, 0.008, 0.005, stripe, s * 0.118, 0.037, 0.082, face, 0).rotation.z = s * 0.35;
  }
  for (const x of [-0.024, 0, 0.024]) {
    soft(0.006, 0.023, 0.004, stripe, x, 0.096 - Math.abs(x) * 0.3, 0.095, face, 0);
  }
  const noseShape = new THREE.Shape();
  noseShape.moveTo(-0.015, 0.003);
  noseShape.quadraticCurveTo(0, 0.012, 0.015, 0.003);
  noseShape.quadraticCurveTo(0.012, -0.006, 0, -0.012);
  noseShape.quadraticCurveTo(-0.012, -0.006, -0.015, 0.003);
  add(new THREE.ShapeGeometry(noseShape), pink, 0, -0.028, 0.155, face, false);
  for (const s of [-1, 1]) {
    add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, -0.043, 0.154),
      new THREE.Vector3(s * 0.012, -0.059, 0.152),
      new THREE.Vector3(s * 0.025, -0.047, 0.15),
    ), 8, 0.0017, 4, false), ink, 0, 0, 0, face, false);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.22, 0.08, 0);
  g.add(tail);
  const curl = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.07, 0.03, 0.08),
    new THREE.Vector3(-0.09, 0.08, 0.19), new THREE.Vector3(-0.02, 0.14, 0.23),
    new THREE.Vector3(0.045, 0.17, 0.18),
  ]);
  part(new THREE.TubeGeometry(curl, 24, 0.031, 8, false), fur, 0, 0, 0, tail, { ol: 0.003 });
  soft(0.032, 0.032, 0.032, white, 0.045, 0.17, 0.18, tail, 0.002);
  for (const u of [0.28, 0.48, 0.68]) {
    const p = curl.getPoint(u);
    const ring = add(new THREE.TorusGeometry(0.0315, 0.004, 5, 10), stripe, p.x, p.y, p.z, tail, false);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curl.getTangent(u));
  }
  g.position.copy(pos);
  g.rotation.y = -0.6;
  G.scene.add(g);
  const cat = { g, body, head, tail, purr: 0 };
  G.updaters.push((dt, t) => {
    if (!g.visible) return;
    const pleased = cat.purr > 0;
    const blink = t % 4.7 > 4.54;
    eyes.forEach(eye => { eye.visible = !pleased && !blink; });
    sleepy.forEach(lid => { lid.visible = pleased || blink; });
    // The runtime owns body.scale.y, tail.rotation.y and head.rotation.z.
    // Animate only nested features / unused axes; don't double-decrement purr.
    face.position.y = pleased ? Math.sin(t * 24) * 0.0015 : 0;
    head.rotation.x = pleased ? -0.07 : Math.sin(t * 0.8) * 0.018;
    if (!pleased) head.rotation.z *= Math.exp(-dt * 8);
    ears.forEach((ear, i) => {
      ear.rotation.x = Math.sin(t * 1.2 + i) * 0.025 + (pleased ? 0.05 : 0);
    });
  });
  return cat;
}

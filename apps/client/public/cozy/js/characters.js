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

/** Inverted-hull ink outline. */
function outline(mesh, t = 0.011) {
  mesh.geometry.computeBoundingSphere();
  const r = Math.max(0.03, mesh.geometry.boundingSphere.radius);
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  const k = 1 + t / r;
  o.position.copy(mesh.position);
  o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale).multiplyScalar(k);
  o.castShadow = false;
  o.userData.isOutline = true;
  mesh.parent.add(o);
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

  const lidOff = (E.lid ?? 0) * h * 1.25;
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

  // upper lash line (follows the lid)
  g.lineWidth = h * (f.lashW ?? 0.2);
  g.beginPath();
  g.moveTo(-w * 1.04, h * 0.12);
  g.bezierCurveTo(-w * 0.62, -h * 1.08 + lidOff * 1.3, w * 0.62, -h * 1.08 + lidOff * 1.3, w * 1.04, -h * 0.08);
  g.stroke();
  if (f.liner) {
    g.lineWidth = h * 0.17;
    g.beginPath();
    g.moveTo(side * w * 0.92, -h * 0.12);
    g.lineTo(side * w * 1.42, -h * 0.55);
    g.stroke();
  } else if (f.lashes) {
    g.lineWidth = h * 0.1;
    g.beginPath();
    g.moveTo(side * w * 0.95, -h * 0.15);
    g.lineTo(side * w * 1.25, -h * 0.45);
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
  const mw = sx * (f.mouthW ?? 0.07);
  g.save();
  g.translate(mx, my);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = f.mouthLine;
  g.lineWidth = 4;
  const dark = '#7a2832';
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

function drawFace(g, f, st) {
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
    const [nx, ny] = P(0, -0.128);
    g.fillStyle = 'rgba(170,100,95,0.55)';
    ellipse(g, nx, ny, 3, 2);
  }
  const eyeState = st.blink ? 'closed' : E.eyes;
  const ey = f.style === 'tong' ? -0.02 : -0.055;
  const ex = f.style === 'tong' ? 0.11 : 0.128;
  for (const s of [-1, 1]) {
    const [x, y, sx, sy] = P(ex * s, ey);
    const size = f.eyeSize ?? 1;
    drawEye(g, x, y, sx * 0.1 * size, sy * 0.115 * size, s, f, E, eyeState, st.look ?? 0);
  }
  if (f.style !== 'tong' && !f.noBrows) {
    g.strokeStyle = f.brow;
    g.lineCap = 'round';
    g.lineWidth = f.browW ?? 5;
    for (const s of [-1, 1]) {
      const [ix, iy] = P(0.07 * s, 0.045 + 0.014 * (E.brow ?? 0));
      const [ox, oy] = P(0.19 * s, 0.05 + (f.browTilt ?? 0) * 0.012);
      g.beginPath();
      g.moveTo(ix, iy);
      g.quadraticCurveTo((ix + ox) / 2, Math.min(iy, oy) - 6, ox, oy);
      g.stroke();
    }
  }
  if (f.mustache) {
    const [mx, my, sx] = P(0, -0.158);
    g.fillStyle = '#5a524e';
    for (const s of [-1, 1]) ellipse(g, mx + s * sx * 0.025, my, sx * 0.03, sx * 0.012, s * 0.25);
  }
  const mouth = st.talkOpen ? (E.mouth === 'grin' ? 'grin' : 'open') : E.mouth;
  drawMouth(g, mouth, f);
}

function makeFace(head, f) {
  const [c, g] = makeCanvas(FW, FH);
  const tex = canvasTexture(c, { repeat: false });
  const geo = new THREE.SphereGeometry(R * 1.006, 48, 32, Math.PI / 2 - PHI_SPAN / 2, PHI_SPAN, TH0, TH1 - TH0);
  const m = new THREE.Mesh(geo, toon(0xffffff, { map: tex, transparent: true, depthWrite: false }));
  m.renderOrder = 2;
  head.add(m);
  return { g, tex, key: '', f };
}

/* ── Hair ─────────────────────────────────────────── */

function hairMat(color, light, opts = {}) {
  return toon(0xffffff, { map: hairTexture(color, light), ...opts });
}

function strandMat(color, tips, depth) {
  return toon(color, { alphaMap: strandAlpha(tips, depth), alphaTest: 0.5, side: THREE.DoubleSide });
}

function longHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  const cap = part(new THREE.SphereGeometry(R + 0.024, 36, 18, 0, TAU, 0, Math.PI * 0.47), hairMat(color, light), 0, 0.006, 0, hair);
  cap.rotation.y = Math.PI;
  // blunt bangs with strand tips
  const fringe = add(new THREE.CylinderGeometry(R + 0.026, R + 0.036, 0.15, 48, 1, true, -1.0, 2.0), strandMat(color, 24, 0.3), 0, 0.055, 0, hair);
  fringe.renderOrder = 3;
  // long back curtain
  const back = add(new THREE.CylinderGeometry(R + 0.03, R + 0.085, 1.0, 48, 1, true, 0.82, TAU - 1.64), strandMat(color, 30, 0.18), 0, -0.4, -0.01, hair);
  back.scale.z = 0.92;
  // side locks framing the face
  const lockM = toon(color);
  for (const s of [-1, 1]) {
    const l = part(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), lockM, 0.29 * s, -0.33, 0.1, hair, { ol: 0.008 });
    l.scale.set(1, 1, 1.6);
    l.rotation.z = -0.06 * s;
  }
  return hair;
}

function wavyHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  const m = hairMat(color, light);
  const flat = toon(color);
  const cap = part(new THREE.SphereGeometry(R + 0.03, 32, 16, 0, TAU, 0, Math.PI * 0.5), m, 0, 0.02, -0.02, hair);
  cap.rotation.y = Math.PI;
  const locks = [
    [-0.13, 0.17, 0.27, 0.13, 0.4],
    [0.04, 0.2, 0.28, 0.14, -0.2],
    [0.18, 0.12, 0.25, 0.11, -0.6],
    [-0.31, 0.12, 0.0, 0.12, 0.9],
    [0.31, 0.1, -0.01, 0.11, -0.9],
    [0, 0.26, 0.05, 0.18, 0],
    [-0.18, 0.22, -0.15, 0.17, 0.3],
    [0.18, 0.22, -0.15, 0.17, -0.3],
    [0, 0.05, -0.27, 0.22, 0],
  ];
  for (const [x, y, z, r, rot] of locks) {
    const s = part(new THREE.SphereGeometry(r, 14, 10), flat, x, y, z, hair, { ol: 0.008 });
    s.scale.set(1.2, 0.75, 1);
    s.rotation.z = rot;
  }
  return hair;
}

function shortHair(head, color, light) {
  const hair = new THREE.Group();
  head.add(hair);
  part(new THREE.SphereGeometry(R + 0.022, 30, 16, 0, TAU, 0, Math.PI * 0.62), hairMat(color, light), 0, 0.02, -0.06, hair).rotation.y = Math.PI;
  part(new THREE.SphereGeometry(R + 0.018, 30, 16, 0, TAU, 0, Math.PI * 0.3), toon(color), 0, 0.03, 0, hair, { ol: 0 });
  return hair;
}

function bunHair(head, color, light) {
  const hair = shortHair(head, color, light);
  part(new THREE.SphereGeometry(0.13, 16, 12), toon(color), 0, 0.3, -0.18, hair, { ol: 0.008 });
  return hair;
}

/* ── Body ─────────────────────────────────────────── */

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
    const shoe = part(new THREE.CapsuleGeometry(0.075, 0.12, 4, 10), mats.shoes, 0, -0.43, 0.04, g);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1.15, 1, 0.8);
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

  let hair;
  const hc = spec.hair;
  if (spec.hairStyle === 'long') hair = longHair(head, hc, spec.hairLight);
  else if (spec.hairStyle === 'wavy') hair = wavyHair(head, hc, spec.hairLight);
  else if (spec.hairStyle === 'bun') hair = bunHair(head, hc, spec.hairLight);
  else hair = shortHair(head, hc, spec.hairLight);

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
    drawFace(c.face.g, c.face.f, { expr: c.expr, blink: c.blinking, talkOpen, look: c.look });
    c.face.tex.needsUpdate = true;
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
    face: { ...FACE_BASE, liner: true, tilt: 0.16, browTilt: 0.6, browW: 5, mouthLine: '#b8545c', blush: 0.18, iris: '#5a3a2a' },
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
    face: { ...FACE_BASE, iris: '#6a4632', tilt: 0.02, browW: 6, browTilt: -0.2, brow: '#3b261c', mouthLine: '#a56060', blush: 0.12, eyeSize: 0.92 },
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

export function makePlayer() {
  const hoodie = texMat('#ffffff', fabric('#e7dac4'), 0.5);
  return makeChibi({
    name: 'player',
    skin: '#f4d4bd',
    hair: '#3b2a20',
    hairLight: 'rgba(160,120,90,0.7)',
    hairStyle: 'short',
    expr: 'smile',
    face: { ...FACE_BASE, iris: '#4e3a2c', tilt: 0.04, browW: 5, eyeSize: 0.95 },
    mats: { legs: texMat('#ffffff', denim('#3e4f6e'), 1.5), shoes: toon('#f7f4ee'), sleeves: hoodie },
    outfit: (c, { body }) => {
      lathe([[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]], texMat('#ffffff', denim('#3e4f6e'), 1.5), body);
      lathe([[0, 0.5], [0.21, 0.5], [0.22, 0.6], [0.21, 0.78], [0.215, 0.95], [0.225, 1.03], [0.19, 1.1], [0.1, 1.15], [0, 1.16]], hoodie, body);
      add(new THREE.BoxGeometry(0.22, 0.12, 0.04), hoodie, 0, 0.66, 0.2, body);
      const hood = add(new THREE.TorusGeometry(0.16, 0.07, 10, 24), hoodie, 0, 1.12, -0.1, body);
      hood.rotation.x = Math.PI / 2 + 0.35;
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 5), toon('#f8f3ea'), s * 0.05, 0.98, 0.205, body, false);
      const beanieTex = tiled(knit('#e8a33d'), 3, 1.5);
      const beanie = toon('#ffffff', { map: beanieTex.map, normalMap: beanieTex.normalMap });
      part(new THREE.SphereGeometry(R + 0.04, 32, 16, 0, TAU, 0, Math.PI * 0.4), beanie, 0, 0.05, -0.01, c.head);
      const cuff = add(new THREE.TorusGeometry(R + 0.005, 0.05, 10, 32), beanie, 0, 0.12, -0.01, c.head);
      cuff.rotation.x = Math.PI / 2;
      part(new THREE.SphereGeometry(0.08, 12, 10), toon('#fff3dc'), 0, 0.43, -0.01, c.head, { ol: 0.008 });
    },
  });
}

export function makeAjusshi() {
  return makeChibi({
    name: 'ajusshi',
    skin: '#eec3a5',
    hair: '#8f8c88',
    hairLight: 'rgba(230,230,230,0.6)',
    hairStyle: 'short',
    expr: 'smile',
    face: { ...FACE_BASE, iris: '#3a2a22', tilt: -0.05, browW: 8, brow: '#6d6560', mustache: true, eyeSize: 0.8, blush: 0.3 },
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
    face: { ...FACE_BASE, lashes: true, iris: '#5d3c2a', tilt: 0.06, blush: 0.28, mouthLine: '#c0606a' },
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
    face: { ...FACE_BASE, iris: '#3e2c22', tilt: 0, eyeSize: 0.9 },
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
    face: { ...FACE_BASE, lashes: style !== 'short', tilt: r() * 0.12, eyeSize: 0.85 + r() * 0.15 },
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
  const fur = toon('#f0a24b');
  const white = toon('#fff4e6');
  const body = part(new THREE.CapsuleGeometry(0.13, 0.22, 6, 12), fur, 0, 0.12, 0, g);
  body.rotation.z = Math.PI / 2;
  const head = new THREE.Group();
  head.position.set(0.23, 0.15, 0.04);
  g.add(head);
  part(new THREE.SphereGeometry(0.12, 16, 12), fur, 0, 0, 0, head);
  add(new THREE.SphereGeometry(0.07, 12, 10), white, 0.06, -0.04, 0.0, head, false).scale.set(0.7, 0.8, 1);
  for (const s of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.045, 0.09, 4), fur, 0, 0.1, 0.06 * s, head, { ol: 0.006 });
    ear.rotation.x = 0.3 * s;
    const eye = add(new THREE.BoxGeometry(0.01, 0.006, 0.04), new THREE.MeshBasicMaterial({ color: 0x2a1a10 }), 0.115, 0.02, 0.045 * s, head, false);
    eye.rotation.y = 0.3 * s;
  }
  const tail = new THREE.Group();
  tail.position.set(-0.24, 0.08, 0);
  g.add(tail);
  part(new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), fur, 0, 0, 0.12, tail, { ol: 0.006 }).rotation.x = Math.PI / 2;
  g.position.copy(pos);
  g.rotation.y = -0.6;
  G.scene.add(g);
  return { g, body, head, tail, purr: 0 };
}

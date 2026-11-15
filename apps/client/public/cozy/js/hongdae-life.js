// Hongdae on a Sunday afternoon (docs/seoul-first-day.md): the people and the street
// furniture between the station exit, the plaza, the terrace stairs and the food street.
// Everything here is dressing: nothing is required by the story, and the only
// colliders are around solid props. Static pieces are merged per material.
import * as THREE from 'three';
import { G, nightGlow, collider, pointLight, seeded, damp, wrapAngle } from './util.js';
import { makeChibi, makePedestrian, makeCat, toon, animate, setExpr, lookAtYaw, chibiKit } from './characters.js';
import { TX, TENT, STOOLS, COUNTER_Y, tentMats, heightAt as coreHeightAt } from './world.js';
import { batcher, paintTexture, signPlane, dramaPosterTexture } from './set-dressing.js';

const TAU = Math.PI * 2;

/** Places a scene can stand the player, as [x, y, z]. */
export const STREET = {
  exit: [-4, 0, -17.2], // just outside the station pavilion
  poster: [-0.4, 0, -22.6], // facing the light box on the pavilion's east side (look −x)
  taxi: [-6.8, 0, -21.6], // the kerb-side rear door of the taxi (look −x)
  busker: [5.7, 0, -22.6], // the gap in the listeners' arc (look +x)
  cart: [1.4, 0, -25.3], // in front of the 붕어빵 cart (look −z)
  stairsFoot: [5, 0, -27.2],
  tent: [TX, 0, TENT.maxZ + 1.2], // in front of the pojangmacha's opening
  signpost: [-1.6, 0, -13.2],
};
/** The three people a scene may want to speak or emote (characters.js chibis). */
export const STREET_CAST = { busker: null, seller: null, driver: null };

const SPOT = {
  busker: new THREE.Vector3(8.5, 0, -22.8),
  cart: new THREE.Vector3(1.4, 0, -26.7),
  taxi: new THREE.Vector3(-8.3, 0, -22.2),
  pigeons: new THREE.Vector3(4.6, 0, -15.2),
};

let heightAt = coreHeightAt;
let P; // shared materials
const walkers = [];
const statics = []; // { c, update(dt, t, env), hours: [from, to] | null, tent }
const pigeons = [];
const perches = [[-5.6, 3.14, -19.6], [-2.5, 3.14, -19.4], [-4.2, 3.14, -19.3], [-3.2, 3.14, -25.6], [-5, 3.14, -25.4]];
let steam = null;
let cat = null;
let claw = null;
let buskerNote = null;

/* ── Materials & small helpers ───────────────────── */

function materials() {
  P = {
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false }),
    // lit from 16:00 on: these read as "on" in daylight and bloom after dusk
    bulb: nightGlow(new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffc070', emissiveIntensity: 1.6 }), 1.6, 2.8),
    lamp: nightGlow(new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#fff0d0', emissiveIntensity: 0.6 }), 0.6, 1.6),
    red: nightGlow(new THREE.MeshStandardMaterial({ color: '#ff5a48', emissive: '#ff3a28', emissiveIntensity: 0.8 }), 0.8, 2.2),
  };
}

const hand = (g, text, x, y, size, color, { rot = 0, font = 'Jua', jitter = 0.05 } = {}) => {
  // marker lettering: each glyph a little off the line
  g.font = `${size}px ${font}, sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const chars = [...text];
  const total = chars.reduce((s, ch) => s + g.measureText(ch).width, 0);
  let cx = x - total / 2;
  chars.forEach((ch, i) => {
    const w = g.measureText(ch).width;
    g.save();
    g.translate(cx + w / 2, y + Math.sin(i * 2.3) * size * jitter);
    g.rotate(rot + Math.sin(i * 1.7 + 1) * jitter);
    g.fillText(ch, -w / 2, 0);
    g.restore();
    cx += w;
  });
};

function place(mesh, x, y, z, ry = 0, parent = G.scene) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  parent.add(mesh);
  return mesh;
}

/** Keep the crowd's shadow cost down: only heads, torsos and legs cast. */
function trimShadows(c) {
  c.root.traverse((m) => {
    if (!m.isMesh || !m.castShadow) return;
    m.geometry.computeBoundingSphere();
    if (m.geometry.boundingSphere.radius < 0.21) m.castShadow = false;
  });
  return c;
}

function addPhone(c) {
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, 0.014), toon('#22252b'));
  phone.position.set(0, -0.44, 0.07);
  phone.rotation.x = -0.5;
  c.arms[1].add(phone);
}

/* ── One-off characters ──────────────────────────── */

const { lathe, FACE_BASE } = chibiKit;
const TORSO = [[0, 0.5], [0.2, 0.5], [0.21, 0.6], [0.2, 0.78], [0.205, 0.95], [0.215, 1.03], [0.185, 1.1], [0.1, 1.15], [0, 1.16]];
const HIPS = [[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]];
const over = (pts, d = 0.028) => pts.map(([r, y]) => [r + d, y]);

function makeBusker() {
  const denim = toon('#5f86bd', { side: THREE.DoubleSide });
  const c = makeChibi({
    name: 'busker', skin: '#f3d3bc', hair: '#3b2a20', hairLight: 'rgba(200,160,120,0.7)', hairStyle: 'curtain', expr: 'smile',
    face: { ...FACE_BASE, browStyle: 'soft', nose: 'line', mouthShape: 'wide', lid: 'double', iris: '#5a3a2a', eyeSize: 0.92, blush: 0.2 },
    mats: { legs: toon('#2b2d36'), shoes: toon('#f7f4ee'), sleeves: toon('#5f86bd') },
    outfit: (ch, { body }) => {
      lathe(HIPS, toon('#2b2d36'), body);
      lathe(TORSO, toon('#f4ecdc'), body);
      lathe(over(TORSO.slice(1, 7)), denim, body, { phiStart: 0.5, phiLength: TAU - 1.0, ol: 0 });
    },
  });
  // acoustic guitar across the lap, neck up to his left
  const gtr = new THREE.Group();
  const wood = toon('#d39a52');
  const dark = toon('#5a3520');
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.09, 20), wood);
  lower.rotation.x = Math.PI / 2;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.09, 18), wood);
  upper.rotation.x = Math.PI / 2;
  upper.position.x = 0.24;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), toon('#2a1a12'));
  hole.position.set(0.1, 0, 0.047);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.03), dark);
  neck.position.set(0.62, 0, 0.03);
  const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.025), dark);
  headstock.position.set(0.92, 0, 0.03);
  gtr.add(lower, upper, hole, neck, headstock);
  for (const m of [lower, upper]) m.castShadow = true;
  gtr.position.set(-0.08, 0.78, 0.27);
  gtr.rotation.z = 0.32;
  c.body.add(gtr);
  c.pose = 'sit';
  return c;
}

function makeSeller() {
  const apron = toon('#d9534a', { side: THREE.DoubleSide });
  const c = makeChibi({
    name: 'seller', skin: '#efcbb1', hair: '#3a2420', hairLight: 'rgba(190,140,120,0.7)', hairStyle: 'bob', expr: 'smile',
    face: { ...FACE_BASE, browStyle: 'thin', nose: 'soft', mouthShape: 'wide', lid: 'hooded', iris: '#4a3428', eyeSize: 0.84, blush: 0.4 },
    mats: { legs: toon('#4a4552'), shoes: toon('#5d4a42'), sleeves: toon('#f1dfe6') },
    outfit: (ch, { body }) => {
      lathe(HIPS, toon('#4a4552'), body);
      lathe(TORSO, toon('#f1dfe6'), body);
      lathe(over(TORSO.slice(1, 7), 0.03), toon('#7d5aa0', { side: THREE.DoubleSide }), body, { phiStart: 0.55, phiLength: TAU - 1.1, ol: 0 }); // quilted vest
      const bib = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.268, 0.56, 20, 1, true, -0.95, 1.9), apron);
      bib.position.y = 0.74;
      body.add(bib);
      // sun visor
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.02, 20, 1, false, -0.9, 1.8), toon('#ff8fb0'));
      visor.position.set(0, 0.13, 0.04);
      visor.rotation.x = 0.18;
      ch.head.add(visor);
    },
  });
  return c;
}

function makeDriver() {
  const c = makeChibi({
    name: 'driver', skin: '#e9c3a3', hair: '#6f6c69', hairLight: 'rgba(230,230,230,0.6)', hairStyle: 'short', expr: 'neutral',
    face: { ...FACE_BASE, browStyle: 'thick', nose: 'soft', mouthShape: 'wide', lid: 'hooded', iris: '#3a2a22', brow: '#5d5754', eyeSize: 0.8, blush: 0.2, browW: 7 },
    mats: { legs: toon('#4b4f5a'), shoes: toon('#2a2a2e'), sleeves: toon('#f4f1ea') },
    outfit: (ch, { body }) => {
      lathe(HIPS, toon('#4b4f5a'), body);
      lathe(TORSO, toon('#f4f1ea'), body);
      lathe(over(TORSO.slice(1, 7)), toon('#2f3d5c', { side: THREE.DoubleSide }), body, { phiStart: 0.5, phiLength: TAU - 1.0, ol: 0 });
    },
  });
  return c;
}

/* ── Painted signs ───────────────────────────────── */

const cartSign = () => paintTexture(640, 250, (g, w, h) => {
  g.fillStyle = '#fff6df';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9534a';
  g.lineWidth = 10;
  g.strokeRect(9, 9, w - 18, h - 18);
  hand(g, '붕어빵', w / 2 - 60, 84, 104, '#c63a2a');
  hand(g, '3개 2,000원', w / 2, 186, 68, '#2a2422', { font: "'Gowun Dodum'" });
  // a fish doodle
  g.fillStyle = '#d9913a';
  g.beginPath();
  g.ellipse(w - 128, 84, 58, 34, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(w - 76, 84);
  g.lineTo(w - 34, 52);
  g.lineTo(w - 34, 116);
  g.fill();
  g.fillStyle = '#5a3520';
  g.beginPath();
  g.arc(w - 160, 76, 5, 0, TAU);
  g.fill();
});

const buskSign = () => paintTexture(384, 420, (g, w, h) => {
  g.fillStyle = '#c9a878';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(120,90,50,0.18)';
  for (let y = 12; y < h; y += 14) g.fillRect(0, y, w, 3);
  hand(g, '버스킹', w / 2, 120, 112, '#1f1a18', { jitter: 0.08 });
  hand(g, '♪ 매주 일요일', w / 2, 250, 50, '#1f1a18', { font: "'Gowun Dodum'" });
  hand(g, '고맙습니다!', w / 2, 340, 54, '#b3362a');
});

const stripes = () => paintTexture(256, 64, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#fff4e2' : '#d9433a';
    g.fillRect(i * 32, 0, 32, h);
  }
});

const taxiSign = () => paintTexture(256, 96, (g, w, h) => {
  g.fillStyle = '#fff7d6';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f2a44';
  g.font = '76px Jua, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('택시', w / 2, h / 2 + 4);
});

const taxiDoor = () => paintTexture(512, 128, (g, w, h) => {
  g.fillStyle = '#f28c28';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 86, w, 14);
  g.fillStyle = '#3a2412';
  g.font = '54px Jua, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('서울 택시', w / 2, 46);
});

const taxiBay = () => paintTexture(256, 512, (g, w, h) => {
  g.strokeStyle = 'rgba(245,205,60,0.9)';
  g.lineWidth = 12;
  g.strokeRect(10, 10, w - 20, h - 20);
});

const standSign = () => paintTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#f2a31b';
  g.beginPath();
  g.arc(w / 2, h / 2, 122, 0, TAU);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '84px Jua, sans-serif';
  g.fillText('택시', w / 2, 104);
  g.font = "38px 'Gowun Dodum', sans-serif";
  g.fillText('타는 곳', w / 2, 176);
});

const boothFront = () => paintTexture(768, 880, (g, w, h) => {
  g.fillStyle = '#ff9db8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, 190);
  g.fillStyle = '#ff4f86';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '138px Jua, sans-serif';
  g.fillText('인생네컷', w / 2, 104);
  // curtained doorway
  g.fillStyle = '#3a2a3c';
  g.fillRect(70, 240, 300, 640);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#fbe3ea' : '#f6cfdb';
    g.fillRect(70 + i * 34, 240, 34, 560 - i * 16);
  }
  // sample strips
  for (const [x, tilt] of [[450, -0.05], [600, 0.06]]) {
    g.save();
    g.translate(x + 60, 520);
    g.rotate(tilt);
    g.fillStyle = '#ffffff';
    g.fillRect(-62, -250, 124, 500);
    for (let k = 0; k < 4; k++) {
      g.fillStyle = ['#ffe3a8', '#bfe3ff', '#d6f0c0', '#f3c8ff'][(k + (x > 500 ? 1 : 0)) % 4];
      g.fillRect(-52, -240 + k * 118, 104, 106);
      for (const dx of [-22, 22]) {
        g.fillStyle = '#f3d3bc';
        g.beginPath();
        g.arc(dx, -182 + k * 118, 19, 0, TAU);
        g.fill();
        g.fillStyle = k % 2 ? '#3b2a20' : '#141419';
        g.beginPath();
        g.arc(dx, -188 + k * 118, 19, Math.PI, TAU);
        g.fill();
      }
    }
    g.restore();
  }
  g.fillStyle = '#ffffff';
  g.font = "54px 'Gowun Dodum', sans-serif";
  g.fillText('4컷 4,000원', 560, 826);
});

const clawSign = () => paintTexture(384, 128, (g, w, h) => {
  g.fillStyle = '#ff4f86';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff9d6';
  g.font = '92px Jua, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('인형뽑기', w / 2, h / 2 + 5);
});

const tentSign = () => paintTexture(768, 200, (g, w, h) => {
  g.fillStyle = '#c8321e';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffd98a';
  g.lineWidth = 10;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#fff3d6';
  g.font = '132px Jua, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('포장마차', w / 2, h / 2 + 6);
});

const fingerBoard = (text, sub, bg) => paintTexture(640, 170, (g, w, h) => {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '82px Jua, sans-serif';
  g.fillText(text, w / 2, 66);
  g.font = "36px 'Gowun Dodum', sans-serif";
  g.fillText(sub, w / 2, 132);
});

const VERT_SIGNS = [
  ['코인노래방', '#ff4fa0', '#ffffff'], ['만화카페', '#ffd23f', '#3a2412'], ['당구장', '#2f9e6a', '#ffffff'], ['사진관', '#f4f1ea', '#c0392b'],
  ['떡볶이', '#e8472e', '#fff3d6'], ['네일', '#c48bff', '#ffffff'], ['약국', '#3a8ee6', '#ffffff'], ['치킨', '#f28c28', '#3a1a08'],
];
const vertAtlas = () => paintTexture(1024, 512, (g, w, h) => {
  VERT_SIGNS.forEach(([text, bg, fg], i) => {
    const x = i * 128;
    g.fillStyle = bg;
    g.fillRect(x, 0, 128, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 6;
    g.strokeRect(x + 3, 3, 122, h - 6);
    const chars = [...text];
    const size = Math.min(104, (h - 40) / chars.length);
    g.fillStyle = fg;
    g.font = `${size}px Jua, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    chars.forEach((ch, k) => g.fillText(ch, x + 64, 20 + (k + 0.5) * ((h - 40) / chars.length) + 4));
  });
});

/* ── Props ───────────────────────────────────────── */

function bike(B, x, z, ry, color, lean) {
  const o = (c) => ({ color: c });
  const g = new THREE.Group(); // only for maths: local → world
  g.position.set(x, 0, z);
  g.rotation.set(0, ry, 0);
  g.updateMatrix();
  const at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz + ly * lean).applyMatrix4(g.matrix);
  for (const lx of [-0.52, 0.52]) {
    const p = at(lx, 0.33, 0);
    B.put(P.paint, new THREE.TorusGeometry(0.31, 0.022, 6, 18), p.x, p.y, p.z, { ry, rx: lean, ...o('#25272c') });
  }
  const tube = (a, b, r, c, m = P.paint) => {
    const pa = at(...a);
    const pb = at(...b);
    const len = pa.distanceTo(pb);
    const geo = new THREE.CylinderGeometry(r, r, len, 6);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    B.put(m, geo, mid.x, mid.y, mid.z, { rx: e.x, ry: e.y, rz: e.z, color: c });
  };
  tube([-0.52, 0.33, 0], [-0.1, 0.36, 0], 0.02, color);
  tube([-0.1, 0.36, 0], [0.34, 0.8, 0], 0.024, color);
  tube([-0.1, 0.36, 0], [-0.22, 0.86, 0], 0.022, color);
  tube([-0.22, 0.8, 0], [0.34, 0.8, 0], 0.022, color);
  tube([-0.52, 0.33, 0], [-0.22, 0.8, 0], 0.016, color);
  tube([0.52, 0.33, 0], [0.36, 0.98, 0], 0.02, '#c9ced4', P.metal);
  tube([0.36, 0.98, -0.24], [0.36, 0.98, 0.24], 0.016, '#2b2d33');
  const seat = at(-0.24, 0.9, 0);
  B.box(P.paint, 0.24, 0.05, 0.12, seat.x, seat.y - 0.025, seat.z, { ry, color: '#2b2d33' });
  const basket = at(0.6, 0.84, 0);
  B.box(P.paint, 0.26, 0.2, 0.34, basket.x, basket.y - 0.1, basket.z, { ry, color: '#e9e4d8' });
}

function planter(B, x, z, w = 1.1, d = 0.5, flowers = '#ff8fb0') {
  B.box(P.paint, w, 0.42, d, x, 0, z, { color: '#9a6a44' });
  B.box(P.paint, w - 0.08, 0.05, d - 0.08, x, 0.4, z, { color: '#4a3a2c' });
  const rnd = seeded(Math.floor(x * 97 + z * 31) >>> 0);
  for (let i = 0; i < 5; i++) {
    const px = x + (i / 4 - 0.5) * (w - 0.3);
    B.sph(P.paint, 0.2 + rnd() * 0.07, px, 0.56 + rnd() * 0.06, z + (rnd() - 0.5) * 0.1, { color: ['#4f8a4a', '#5d9a55', '#437a44'][i % 3], sy: 0.85, seg: 8 });
    for (let k = 0; k < 3; k++) B.sph(P.paint, 0.045, px + (rnd() - 0.5) * 0.3, 0.7 + rnd() * 0.08, z + (rnd() - 0.5) * 0.3, { color: k ? flowers : '#fff3c4', seg: 6 });
  }
  collider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
}

function buildCart(B) {
  const { x, z } = SPOT.cart;
  // body, wheels, handle
  B.boxMM(P.paint, x - 0.9, x + 0.9, 0.34, 0.9, z - 0.42, z + 0.42, { color: '#f3e3c3' });
  B.boxMM(P.paint, x - 0.92, x + 0.92, 0.34, 0.5, z - 0.44, z + 0.44, { color: '#d9433a' });
  B.boxMM(P.metal, x - 0.95, x + 0.95, 0.9, 0.94, z - 0.47, z + 0.47, { color: '#c9ced4' });
  for (const s of [-1, 1]) {
    B.cyl(P.paint, 0.3, 0.3, 0.07, x + s * 0.98, 0.3 - 0.035, z - 0.1, { rz: Math.PI / 2, color: '#2b2d33', seg: 16 });
    B.cyl(P.metal, 0.09, 0.09, 0.08, x + s * 0.985, 0.3 - 0.04, z - 0.1, { rz: Math.PI / 2, color: '#c9ced4' });
  }
  B.cyl(P.metal, 0.03, 0.03, 0.32, x + 0.6, 0.02, z + 0.3, { color: '#8a8f96' });
  // cast-iron fish moulds (left) with a row cooking, and the open lid behind
  B.boxMM(P.paint, x - 0.82, x + 0.02, 0.94, 1.0, z - 0.3, z + 0.3, { color: '#2a2a2e' });
  B.boxMM(P.paint, x - 0.82, x + 0.02, 1.0, 1.3, z - 0.36, z - 0.31, { color: '#2a2a2e' });
  const fish = (fx, fy, fz, color, ry = 0, flat = 0.5) => {
    B.sph(P.paint, 0.085, fx, fy, fz, { sx: 1, sy: flat, sz: 0.62, ry, color, seg: 8 });
    B.put(P.paint, new THREE.ConeGeometry(0.055, 0.09, 4), fx - Math.cos(ry) * 0.1, fy, fz + Math.sin(ry) * 0.1, { rz: -Math.PI / 2, ry, sz: 0.5, color });
  };
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) fish(x - 0.7 + i * 0.2, 1.005, z - 0.14 + k * 0.26, i === 3 && k ? '#e9d9a8' : i % 2 ? '#c98636' : '#b87428', 0, 0.35);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) fish(x - 0.7 + i * 0.2, 1.08 + k * 0.14, z - 0.3, '#3a3a40', 0, 0.3);
  // wire rack of finished ones, paper bags, batter kettle and red-bean pot
  B.boxMM(P.metal, x + 0.1, x + 0.86, 0.96, 0.975, z - 0.3, z + 0.02, { color: '#d5d9de' });
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) fish(x + 0.2 + i * 0.19, 1.02, z - 0.23 + k * 0.17, k ? '#cf8f3c' : '#bd7a2c', 0.25, 0.42);
  for (let i = 0; i < 3; i++) B.box(P.paint, 0.2, 0.26, 0.09, x + 0.32 + i * 0.03, 0.94, z + 0.2 + i * 0.1, { color: i % 2 ? '#fff6e6' : '#e7cfa6', ry: 0.2 });
  B.cyl(P.metal, 0.1, 0.085, 0.2, x + 0.7, 0.94, z + 0.24, { color: '#f0c33a' });
  B.cyl(P.paint, 0.11, 0.1, 0.1, x + 0.1, 0.94, z + 0.26, { color: '#7a2a2a' });
  // posts and the striped awning
  for (const sx of [-0.92, 0.92]) for (const sz of [-0.44, 0.44]) B.cyl(P.metal, 0.02, 0.02, 1.25 + (sz < 0 ? 0.25 : 0), x + sx, 0.9, z + sz, { color: '#b9bec4' });
  const st = stripes();
  st.wrapS = THREE.RepeatWrapping;
  const awnM = new THREE.MeshStandardMaterial({ map: st, side: THREE.DoubleSide, roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.35), awnM);
  top.rotation.x = -Math.PI / 2 + 0.19;
  top.castShadow = true;
  place(top, x, 2.29, z + 0.1);
  const val = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.2), awnM);
  place(val, x, 2.08, z + 0.76);
  // warm bulb and the hand-lettered price
  B.cyl(P.paint, 0.006, 0.006, 0.3, x, 1.92, z + 0.1, { color: '#2a2a2e' });
  B.sph(P.bulb, 0.075, x, 1.88, z + 0.1);
  pointLight(0xffb86a, 5, 7, x, 1.8, z + 0.25, { day: 0.8 });
  const price = signPlane(cartSign(), 1.5, 0.586);
  place(price, x, 0.62, z + 0.445);
  const flag = signPlane(paintTexture(128, 400, (g, w, h) => {
    g.fillStyle = '#fff6df';
    g.fillRect(0, 0, w, h);
    [...'붕어빵'].forEach((ch, i) => hand(g, ch, w / 2, 76 + i * 124, 104, '#c63a2a'));
  }), 0.3, 0.94, { side: THREE.DoubleSide });
  place(flag, x - 1.1, 1.5, z + 0.44);
  collider(x - 1.0, x + 1.0, z - 1.15, z + 0.5);
}

function buildBusker(B) {
  const { x, z } = SPOT.busker;
  B.cyl(P.paint, 0.2, 0.17, 0.47, x, 0, z, { color: '#6b4a32', seg: 14 });
  // open guitar case with coins and notes
  B.box(P.paint, 0.42, 0.09, 1.08, x - 1.25, 0, z + 0.1, { color: '#2a2a2e', ry: 0.15 });
  B.box(P.paint, 0.36, 0.02, 1.0, x - 1.25, 0.08, z + 0.1, { color: '#9a2f3a', ry: 0.15 });
  B.box(P.paint, 0.06, 0.42, 1.08, x - 1.0, 0, z + 0.14, { color: '#2a2a2e', ry: 0.15, rz: -0.25 });
  const rnd = seeded(8);
  for (let i = 0; i < 9; i++) B.cyl(P.metal, 0.018, 0.018, 0.006, x - 1.25 + (rnd() - 0.5) * 0.24, 0.1, z + 0.1 + (rnd() - 0.5) * 0.8, { color: i % 3 ? '#e8c04a' : '#d9dde2' });
  for (let i = 0; i < 3; i++) B.box(P.paint, 0.07, 0.004, 0.15, x - 1.28 + i * 0.05, 0.1, z - 0.1 + i * 0.2, { color: '#8fb98a', ry: i * 0.7 });
  // amp, mic stand
  B.box(P.paint, 0.46, 0.5, 0.3, x + 0.1, 0, z - 0.85, { color: '#2b2d33', ry: 0.5 });
  B.box(P.paint, 0.4, 0.34, 0.02, x + 0.02, 0.1, z - 0.72, { color: '#8a7a5c', ry: 0.5 });
  B.sph(P.red, 0.018, x + 0.14, 0.47, z - 0.66);
  B.cyl(P.metal, 0.012, 0.012, 1.28, x - 0.42, 0, z + 0.34, { color: '#3a3d44' });
  B.cyl(P.metal, 0.11, 0.13, 0.03, x - 0.42, 0, z + 0.34, { color: '#3a3d44' });
  B.sph(P.paint, 0.045, x - 0.42, 1.3, z + 0.3, { color: '#55585f' });
  // the sign, leaning on a little easel
  const sign = signPlane(buskSign(), 0.5, 0.55, { side: THREE.DoubleSide });
  sign.rotation.x = -0.2;
  place(sign, x - 0.9, 0.34, z - 0.95, -Math.PI / 2 + 0.25);
  B.box(P.paint, 0.03, 0.62, 0.03, x - 0.86, 0, z - 0.95, { color: '#7a5a3c' });
  collider(x - 0.5, x + 0.6, z - 1.1, z + 0.4);
}

function buildTaxi(B) {
  const { x, z } = SPOT.taxi; // nose towards +z
  const orange = '#f28c28';
  B.boxMM(P.paint, x - 0.9, x + 0.9, 0.3, 0.92, z - 2.2, z + 2.2, { color: orange });
  B.boxMM(P.paint, x - 0.82, x + 0.82, 0.92, 1.44, z - 1.45, z + 0.75, { color: '#26303a' });
  B.boxMM(P.paint, x - 0.84, x + 0.84, 1.42, 1.5, z - 1.4, z + 0.7, { color: orange });
  for (const pz of [-1.45, -0.35, 0.72]) for (const s of [-1, 1]) B.boxMM(P.paint, x + s * 0.8 - 0.04, x + s * 0.8 + 0.04, 0.92, 1.44, z + pz - 0.05, z + pz + 0.05, { color: orange });
  B.boxMM(P.paint, x - 0.92, x + 0.92, 0.26, 0.42, z - 2.26, z + 2.26, { color: '#3a3d44' });
  for (const s of [-1, 1]) for (const wz of [-1.4, 1.4]) {
    B.cyl(P.paint, 0.32, 0.32, 0.22, x + s * 0.82, 0.32 - 0.11, z + wz, { rz: Math.PI / 2, color: '#1f2126', seg: 16 });
    B.cyl(P.metal, 0.17, 0.17, 0.24, x + s * 0.83, 0.32 - 0.12, z + wz, { rz: Math.PI / 2, color: '#c9ced4' });
  }
  for (const s of [-1, 1]) {
    B.box(P.lamp, 0.36, 0.14, 0.04, x + s * 0.6, 0.66, z + 2.2);
    B.box(P.red, 0.36, 0.12, 0.04, x + s * 0.6, 0.7, z - 2.2);
  }
  // roof sign and the 빈차 light on the dash
  B.box(P.paint, 0.56, 0.05, 0.22, x, 1.5, z - 0.2, { color: '#2a2a2e' });
  const sign = nightGlow(new THREE.MeshStandardMaterial({ map: taxiSign(), emissive: 0xffffff, emissiveIntensity: 1 }), 0.9, 2.2);
  sign.emissiveMap = sign.map;
  for (const s of [1, -1]) place(new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.19), sign), x, 1.645, z - 0.2 + s * 0.111, s > 0 ? 0 : Math.PI);
  B.box(P.paint, 0.52, 0.19, 0.22, x, 1.55, z - 0.2, { color: '#fff7d6' });
  B.box(P.red, 0.2, 0.07, 0.02, x - 0.4, 1.02, z + 0.76);
  const door = new THREE.MeshStandardMaterial({ map: taxiDoor(), roughness: 0.6 });
  for (const s of [1, -1]) place(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), door), x + s * 0.905, 0.68, z - 0.35, s * Math.PI / 2);
  // the bay and the stand sign
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 5), new THREE.MeshBasicMaterial({ map: taxiBay(), transparent: true, depthWrite: false }));
  bay.rotation.x = -Math.PI / 2;
  place(bay, x, 0.045, z);
  B.cyl(P.metal, 0.03, 0.03, 2.5, x + 1.25, 0, z + 2.9, { color: '#8a8f96' });
  place(signPlane(standSign(), 0.62, 0.62, { transparent: true, side: THREE.DoubleSide }), x + 1.25, 2.3, z + 2.92);
  collider(x - 0.95, x + 0.95, z - 2.3, z + 2.3);
  collider(x + 1.1, x + 1.4, z + 2.75, z + 3.05);
}

function buildPoster(B) {
  // Light box on the pavilion's east side, and the same ad large on the wall behind the taxi rank.
  const tex = dramaPosterTexture(768, 1024);
  const m = nightGlow(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.6 }), 0.45, 1.25);
  for (const [zc] of [[-23.45], [-21.75]]) {
    B.boxMM(P.metal, -1.86, -1.72, 0.35, 2.62, zc - 0.82, zc + 0.82, { color: '#30343c' });
    place(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.0), m), -1.712, 1.5, zc, Math.PI / 2);
  }
  B.boxMM(P.metal, -1.84, -1.74, 0, 0.35, -24.2, -24.0, { color: '#30343c' });
  B.boxMM(P.metal, -1.84, -1.74, 0, 0.35, -21.2, -21.0, { color: '#30343c' });
  collider(-1.95, -1.65, -24.3, -20.9);
  B.boxMM(P.metal, -9.99, -9.9, 3.75, 7.75, -26.6, -23.4, { color: '#30343c' });
  place(new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.86), m), -9.885, 5.75, -25, Math.PI / 2);
}

function buildArcade(B) {
  // 4-cut photo booth and a claw machine against the east wall of the food street
  B.boxMM(P.paint, 5.25, 6.15, 0, 2.5, 3.4, 5.6, { color: '#ff8fb0' });
  B.boxMM(P.paint, 5.2, 6.15, 2.5, 2.56, 3.35, 5.65, { color: '#ffffff' });
  const fm = nightGlow(new THREE.MeshStandardMaterial({ map: boothFront(), emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.7 }), 0.2, 0.95);
  fm.emissiveMap = fm.map;
  place(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.5), fm), 5.245, 1.25, 4.5, -Math.PI / 2);
  // claw machine
  B.boxMM(P.paint, 5.35, 6.15, 0, 0.85, 6.3, 7.3, { color: '#ffd23f' });
  B.boxMM(P.paint, 5.3, 5.36, 0.72, 0.9, 6.36, 7.24, { color: '#3a3d44' });
  B.cyl(P.paint, 0.015, 0.015, 0.1, 5.27, 0.9, 6.62, { color: '#2a2a2e' });
  B.sph(P.red, 0.03, 5.27, 1.02, 6.62);
  B.sph(P.red, 0.035, 5.29, 0.92, 7.0);
  B.boxMM(P.glass, 5.37, 6.13, 0.85, 1.68, 6.32, 7.28);
  for (const [cx, cz] of [[5.37, 6.32], [5.37, 7.28], [6.13, 6.32], [6.13, 7.28]]) B.boxMM(P.paint, cx - 0.025, cx + 0.025, 0.85, 1.68, cz - 0.025, cz + 0.025, { color: '#ff4f86' });
  B.boxMM(P.paint, 5.33, 6.15, 1.68, 2.0, 6.28, 7.32, { color: '#ff4f86' });
  B.boxMM(P.lamp, 5.45, 6.05, 1.655, 1.675, 6.4, 7.2);
  const rnd = seeded(77);
  const plush = ['#ffd6e3', '#bfe3ff', '#fff0a8', '#d6f0c0', '#f3c8ff', '#ffc9a0'];
  for (let i = 0; i < 14; i++) {
    const px = 5.5 + rnd() * 0.5;
    const pz = 6.45 + rnd() * 0.7;
    const py = 0.94 + rnd() * 0.14;
    const c = plush[i % plush.length];
    B.sph(P.paint, 0.085, px, py, pz, { color: c, seg: 8 });
    for (const s of [-1, 1]) B.sph(P.paint, 0.032, px, py + 0.07, pz + s * 0.055, { color: c, seg: 6 });
  }
  const cm = nightGlow(new THREE.MeshStandardMaterial({ map: clawSign(), emissive: 0xffffff, emissiveIntensity: 0.3 }), 0.3, 1.2);
  cm.emissiveMap = cm.map;
  place(new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.3), cm), 5.325, 1.84, 6.8, -Math.PI / 2);
  claw = new THREE.Group();
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), P.metal.clone());
  wire.material.vertexColors = false;
  wire.material.color.set('#c9ced4');
  wire.position.y = -0.15;
  const grab = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 3, 1, true), wire.material);
  grab.position.y = -0.34;
  claw.add(wire, grab);
  place(claw, 5.75, 1.66, 6.8);
  collider(5.2, 6.2, 3.3, 7.4);
}

/** Stacked vertical shop signs: one atlas, one mesh. */
function buildVerticalSigns() {
  const tex = vertAtlas();
  const m = nightGlow(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.7 }), 0.3, 1.35);
  const B = batcher();
  const board = (x, y, z, i, axis) => {
    for (const s of [1, -1]) {
      const geo = new THREE.PlaneGeometry(0.56, 1.5);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 8);
      const ry = axis === 'z' ? (s > 0 ? 0 : Math.PI) : s * Math.PI / 2;
      B.put(m, geo, x + (axis === 'x' ? s * 0.031 : 0), y, z + (axis === 'z' ? s * 0.031 : 0), { ry });
    }
    B.put(P.paint, new THREE.BoxGeometry(axis === 'z' ? 0.6 : 0.06, 1.54, axis === 'z' ? 0.06 : 0.6), x, y, z, { color: '#22242a' });
  };
  let n = 0;
  // perpendicular to the food-street walls, so they read along the street
  for (const [side, z, count] of [[1, 1.2, 3], [1, 17, 2], [1, 23, 3], [1, 28, 2], [-1, 12.6, 3], [-1, 18.4, 2], [-1, 24.5, 3]]) {
    for (let k = 0; k < count; k++) board(side * 5.74, 3.95 + k * 1.6, z, (n++ * 3) % 8, 'z');
    B.put(P.paint, new THREE.BoxGeometry(0.5, 0.05, 0.05), side * 6.0, 3.3, z, { color: '#22242a' });
  }
  // and two on the plaza faces
  for (const [x, z, count] of [[-9.6, -8.9, 2], [9.6, -27.2, 2]]) for (let k = 0; k < count; k++) board(x, 4.6 + k * 1.6, z, (n++ * 3) % 8, 'z');
  B.build(G.scene, { cast: false });
}

/** Warm bulbs on strings across the plaza and the food street: one instanced mesh. */
function buildStringLights() {
  const runs = [
    [-6.1, 5.0, 1.6, 6.1, 5.0, 2.2], [-6.1, 4.9, 12, 6.1, 4.9, 12.5], [-6.1, 5.0, 18.6, 6.1, 5.0, 18.2], [-6.1, 4.9, 26, 6.1, 4.9, 25.6],
    [-6.1, 4.8, -5.6, 6.1, 4.8, -5.2], [-9.9, 5.1, -17, 9.9, 5.1, -16.6], [-9.9, 5.3, -25.4, 9.9, 5.3, -25],
    [-5.9, 3.3, -19.3, -0.8, 4.3, -26.8], [-2.1, 3.3, -19.3, 0.8, 4.3, -9.6], [0.8, 4.3, -9.6, TX + 1.3, 3.25, TENT.minZ - 0.12],
  ];
  const per = 20;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.048, 8, 6), nightGlow(new THREE.MeshStandardMaterial({ color: 0xfff3d8, emissive: 0xffffff, emissiveIntensity: 1 }), 0.3, 1.5), runs.length * per);
  const tmp = new THREE.Object3D();
  const palette = [new THREE.Color(0xffc56b), new THREE.Color(0xffe3a3), new THREE.Color(0xffa98a), new THREE.Color(0xffd27a)];
  const pts = [];
  runs.forEach(([ax, ay, az, bx, by, bz], r) => {
    let prev = null;
    for (let i = 0; i < per; i++) {
      const k = i / (per - 1);
      const p = new THREE.Vector3(ax + (bx - ax) * k, ay + (by - ay) * k - 0.75 * (1 - (2 * k - 1) ** 2), az + (bz - az) * k);
      tmp.position.copy(p);
      tmp.updateMatrix();
      bulbs.setMatrixAt(r * per + i, tmp.matrix);
      bulbs.setColorAt(r * per + i, palette[(i + r) % palette.length]);
      if (prev) pts.push(prev.clone().setY(prev.y + 0.05), p.clone().setY(p.y + 0.05));
      prev = p;
    }
  });
  G.scene.add(bulbs);
  G.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a2630 })));
}

/** The pojangmacha, seen from the station: open, lit and steaming from mid-afternoon. */
function buildTentDressing(B) {
  const { minX, maxX, minZ, maxZ, wallH } = TENT;
  // bulbs along the back and side eaves
  for (let i = 0; i <= 8; i++) B.sph(P.bulb, 0.06, minX + 0.2 + (i * (maxX - minX - 0.4)) / 8, wallH + 0.02 - 0.1 * (1 - ((i - 4) / 4) ** 2), minZ - 0.12);
  for (const x of [minX - 0.12, maxX + 0.12]) for (let i = 1; i <= 4; i++) B.sph(P.bulb, 0.06, x, wallH - 0.05, minZ + (i * (maxZ - minZ)) / 5);
  for (let i = 0; i <= 7; i++) B.sph(P.bulb, 0.06, minX + 0.3 + (i * (maxX - minX - 0.6)) / 7, wallH + 0.06, maxZ + 0.14);
  // a lit sign above the back eave, readable from the plaza and from the street
  const tex = tentSign();
  const m = nightGlow(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55 }), 0.55, 1.3);
  B.boxMM(P.paint, TX - 1.3, TX + 1.3, wallH + 0.28, wallH + 0.98, minZ - 0.16, minZ - 0.08, { color: '#5a1a10' });
  for (const s of [-1, 1]) B.cyl(P.metal, 0.02, 0.02, 0.4, TX + s * 1.1, wallH - 0.1, minZ - 0.12, { color: '#b9bec4' });
  place(new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.65), m), TX, wallH + 0.63, minZ - 0.165, Math.PI);
  place(new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.65), m), TX, wallH + 0.63, minZ - 0.075, 0);
  // stove pipe at the back corner
  B.cyl(P.metal, 0.06, 0.06, 1.0, minX + 0.5, wallH - 0.2, minZ - 0.14, { color: '#8a8f96' });
  B.cyl(P.metal, 0.09, 0.09, 0.05, minX + 0.5, wallH + 0.8, minZ - 0.14, { color: '#6d727a' });
  // red lanterns on the back corners
  for (const x of [minX - 0.1, maxX + 0.1]) {
    B.sph(P.red, 0.2, x, wallH - 0.25, minZ - 0.2, { sy: 1.2, seg: 12 });
    B.cyl(P.paint, 0.09, 0.09, 0.05, x, wallH - 0.02, minZ - 0.2, { color: '#2a1a14' });
    B.cyl(P.paint, 0.09, 0.09, 0.05, x, wallH - 0.53, minZ - 0.2, { color: '#2a1a14' });
  }
  // an A-board out front and crates of bottles at the side
  B.box(P.paint, 0.55, 0.85, 0.05, TX + 2.75, 0, maxZ + 1.0, { color: '#3a2a22', rx: -0.16 });
  const menu = signPlane(paintTexture(256, 400, (g, w, h) => {
    g.fillStyle = '#2a332c';
    g.fillRect(0, 0, w, h);
    hand(g, '영업중', w / 2, 80, 78, '#ffe9a8');
    hand(g, '떡볶이', w / 2, 190, 62, '#ffffff', { font: "'Gowun Dodum'" });
    hand(g, '오뎅', w / 2, 270, 62, '#ffffff', { font: "'Gowun Dodum'" });
    hand(g, '어서 오세요', w / 2, 350, 40, '#ffb3a0');
  }), 0.5, 0.78);
  menu.rotation.x = -0.16;
  place(menu, TX + 2.75, 0.44, maxZ + 1.045);
  for (let i = 0; i < 2; i++) B.box(P.paint, 0.5, 0.3, 0.36, maxX + 0.45, i * 0.3, minZ + 0.6, { color: i ? '#3f7fd0' : '#e2b23a' });
  collider(maxX + 0.2, maxX + 0.7, minZ + 0.4, minZ + 0.8);
}

function buildWayfinding(B) {
  // finger-post in front of the exit: the tent ahead, Onsae up the stairs behind
  const [x, , z] = STREET.signpost;
  B.cyl(P.metal, 0.045, 0.05, 3.0, x, 0, z, { color: '#3a4048' });
  B.sph(P.metal, 0.07, x, 3.02, z, { color: '#3a4048' });
  const boards = [
    [fingerBoard('포장마차 ↑', '떡볶이 · 오뎅 · Food Street', '#c8421e'), 2.55],
    [fingerBoard('온새 ENT ↓', '계단 위 · up the stairs', '#2f5fa8'), 2.02],
  ];
  for (const [tex, y] of boards) {
    for (const s of [1, -1]) place(signPlane(tex, 1.5, 0.4, { glow: 0.25 }), x + 0.62, y, z + s * 0.022, s > 0 ? 0 : Math.PI);
    B.box(P.paint, 1.54, 0.44, 0.03, x + 0.62, y - 0.22, z, { color: '#22242a' });
  }
  collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
}

function buildDressing() {
  const B = batcher();
  buildCart(B);
  buildBusker(B);
  buildTaxi(B);
  buildPoster(B);
  buildArcade(B);
  buildTentDressing(B);
  buildWayfinding(B);

  // bikes on a rail by the convenience store wall
  B.cyl(P.metal, 0.025, 0.025, 3.0, -9.55, 0.8 - 1.5, -9.7, { rx: Math.PI / 2, color: '#8a8f96' });
  for (const z of [-11.15, -9.7, -8.25]) B.cyl(P.metal, 0.025, 0.025, 0.8, -9.55, 0, z, { color: '#8a8f96' });
  bike(B, -9.25, -10.45, Math.PI / 2, '#38a86a', -0.13);
  bike(B, -9.22, -8.95, -Math.PI / 2 + 0.06, '#e8c547', 0.12);
  collider(-9.7, -8.95, -11.3, -8.1);

  planter(B, -9.45, -18.4, 0.5, 1.4);
  planter(B, -9.45, -12.6, 0.5, 1.4, '#ffd23f');
  planter(B, 7.75, -27.45, 1.1, 0.5, '#ff9a5a');
  planter(B, -3.9, -27.4, 1.6, 0.5, '#c9a0ff');
  planter(B, -5.55, 22.9, 0.5, 1.2, '#ffd23f');
  planter(B, 5.6, -0.2, 0.5, 1.2);

  // café tables with cups outside Café Bom
  for (const [x, z] of [[9.15, -18.4], [9.15, -12.6]]) {
    B.cyl(P.paint, 0.36, 0.36, 0.04, x, 0.7, z, { color: '#f4ead8', seg: 18 });
    B.cyl(P.metal, 0.03, 0.03, 0.7, x, 0, z, { color: '#3a3d44' });
    B.cyl(P.metal, 0.2, 0.22, 0.03, x, 0, z, { color: '#3a3d44' });
    for (const s of [-1, 1]) {
      B.cyl(P.paint, 0.19, 0.19, 0.05, x, 0.42, z + s * 0.68, { color: '#e98aa6', seg: 14 });
      B.cyl(P.metal, 0.02, 0.02, 0.42, x, 0, z + s * 0.68, { color: '#3a3d44' });
      B.cyl(P.paint, 0.045, 0.035, 0.09, x + 0.08 * s, 0.74, z + s * 0.14, { color: '#ffffff' });
      B.cyl(P.paint, 0.038, 0.038, 0.004, x + 0.08 * s, 0.826, z + s * 0.14, { color: '#6b4226' });
    }
    collider(x - 0.36, x + 0.36, z - 0.36, z + 0.36);
  }

  // shop awnings and A-boards along the food street
  const awn = ['#d9534a', '#3f7f6a', '#e8a33a', '#5a78b8', '#c96a8a', '#7a5aa0'];
  [[1, 15.2], [1, 21], [1, 26.6], [-1, 14.4], [-1, 20.6], [-1, 26.4], [1, -1.4], [-1, 6.4]].forEach(([s, z], i) => {
    B.box(P.paint, 0.95, 0.05, 2.7, s * 5.76, 2.72, z, { rz: s * 0.32, color: awn[i % awn.length] });
    B.box(P.paint, 0.03, 0.2, 2.7, s * 5.31, 2.47, z, { color: awn[i % awn.length] });
  });
  for (const [x, z, ry, c] of [[5.35, 19.3, -0.3, '#2a332c'], [-5.35, 21.8, 0.3, '#5a2a22'], [-5.4, 13.2, 0.2, '#2a332c']]) {
    B.box(P.paint, 0.5, 0.8, 0.05, x, 0, z, { color: c, rx: -0.15, ry: ry + Math.PI / 2 });
    B.box(P.paint, 0.4, 0.1, 0.06, x, 0.56, z, { color: '#ffe9a8', rx: -0.15, ry: ry + Math.PI / 2 });
    B.box(P.paint, 0.34, 0.06, 0.06, x, 0.36, z, { color: '#ffffff', rx: -0.15, ry: ry + Math.PI / 2 });
  }
  // crates and a stack of stools by the shops
  for (const [x, z, c] of [[5.6, 9.2, '#e2b23a'], [5.6, 9.75, '#3f7fd0'], [-5.6, 24.0, '#d9534a']]) B.box(P.paint, 0.5, 0.32, 0.38, x, 0, z, { color: c });
  for (let i = 0; i < 4; i++) B.cyl(P.paint, 0.16, 0.19, 0.1, -5.55, 0.02 + i * 0.11, 19.2, { color: '#3f7fd0', seg: 12 });

  for (const m of B.build(G.scene, { cast: true })) if (m.material === P.bulb || m.material === P.lamp || m.material === P.red) m.castShadow = false;
}

/* ── Steam (one Points cloud for every pot, mould and cup) ── */

function buildSteam() {
  const emitters = [
    { p: [SPOT.cart.x - 0.4, 1.06, SPOT.cart.z], n: 9, rise: 0.95, size: 0.5, alpha: 0.34 },
    { p: [TX - 1.95, COUNTER_Y + 0.16, -1.08], n: 8, rise: 0.9, size: 0.55, alpha: 0.3, tent: true },
    { p: [TX - 1.15, COUNTER_Y + 0.34, -1.12], n: 8, rise: 1.0, size: 0.5, alpha: 0.3, tent: true },
    { p: [TENT.minX + 0.5, TENT.wallH + 0.9, TENT.minZ - 0.14], n: 10, rise: 1.7, size: 0.75, alpha: 0.3, tent: true },
    { p: [9.07, 0.85, -12.74], n: 3, rise: 0.3, size: 0.16, alpha: 0.3 },
    { p: [9.23, 0.85, -18.26], n: 3, rise: 0.3, size: 0.16, alpha: 0.3 },
  ];
  const N = emitters.reduce((s, e) => s + e.n, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 }, uColor: { value: new THREE.Color('#fff4e6') } },
    vertexShader: 'attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(uColor, a * a * vA); }',
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  G.scene.add(points);
  steam = { points, emitters, N };
}

function updateSteam(t, tentOpen, night) {
  const { points, emitters } = steam;
  const pos = points.geometry.attributes.position;
  const size = points.geometry.attributes.aSize;
  const alpha = points.geometry.attributes.aAlpha;
  let i = 0;
  for (const e of emitters) {
    const on = !e.tent || tentOpen;
    for (let k = 0; k < e.n; k++, i++) {
      const life = (t * 0.32 + k / e.n + i * 0.37) % 1;
      const drift = life * life;
      pos.setXYZ(i, e.p[0] + Math.sin(t * 0.7 + i * 2.1) * 0.12 * life + drift * 0.25, e.p[1] + life * e.rise, e.p[2] + Math.cos(t * 0.6 + i) * 0.1 * life);
      size.setX(i, e.size * (0.45 + life * 0.9));
      alpha.setX(i, on ? Math.sin(Math.PI * life) * e.alpha * (1 - night * 0.35) : 0);
    }
  }
  pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
  const cam = G.camera;
  if (cam && G.renderer) points.material.uniforms.uScale.value = G.renderer.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
}

/* ── Pigeons ─────────────────────────────────────── */

function buildPigeons(count) {
  const grey = toon('#8f97a3');
  const dark = toon('#5d6470');
  const bodyGeo = new THREE.SphereGeometry(0.1, 10, 8).scale(0.72, 0.8, 1.25);
  const headGeo = new THREE.SphereGeometry(0.052, 8, 6);
  const wingGeo = new THREE.BoxGeometry(0.2, 0.012, 0.13).translate(0.1, 0, 0);
  const rnd = seeded(41);
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, i % 3 ? grey : dark);
    body.position.y = 0.11;
    body.castShadow = true;
    const head = new THREE.Mesh(headGeo, i % 3 ? dark : grey);
    head.position.set(0, 0.2, 0.1);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 4), toon('#e8a04a'));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0, 0.06);
    head.add(beak);
    const wings = [-1, 1].map((s) => {
      const w = new THREE.Mesh(wingGeo, dark);
      w.position.set(s * 0.05, 0.15, -0.02);
      w.scale.x = s;
      w.visible = false;
      g.add(w);
      return w;
    });
    g.add(body, head);
    const home = new THREE.Vector3(SPOT.pigeons.x + (rnd() - 0.5) * 2.4, 0.04, SPOT.pigeons.z + (rnd() - 0.5) * 2.0);
    g.position.copy(home);
    g.rotation.y = rnd() * TAU;
    G.scene.add(g);
    pigeons.push({ g, head, wings, home, state: 'ground', k: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), wait: 0, hop: rnd() * 4, phase: rnd() * 6, target: home.clone() });
  }
}

function updatePigeons(dt, t, player, hour) {
  const day = hour >= 6.5 && hour < 19.2;
  for (const p of pigeons) {
    p.g.visible = day;
    if (!day) continue;
    if (p.state === 'ground') {
      // peck, and shuffle a step now and then
      p.head.position.y = 0.2 - Math.max(0, Math.sin(t * 5 + p.phase)) * 0.09 * (Math.sin(t * 0.9 + p.phase) > 0 ? 1 : 0);
      p.hop -= dt;
      if (p.hop < 0) {
        p.hop = 1.5 + Math.random() * 3.5;
        p.target.set(p.home.x + (Math.random() - 0.5) * 1.2, 0.04, p.home.z + (Math.random() - 0.5) * 1.2);
      }
      const dx = p.target.x - p.g.position.x;
      const dz = p.target.z - p.g.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.04) {
        p.g.position.x += (dx / d) * 0.5 * dt;
        p.g.position.z += (dz / d) * 0.5 * dt;
        p.g.position.y = 0.04 + Math.abs(Math.sin(t * 16 + p.phase)) * 0.015;
        p.g.rotation.y += wrapAngle(Math.atan2(dx, dz) - p.g.rotation.y) * damp(8, dt);
      }
      if (player && Math.hypot(player.x - p.g.position.x, player.z - p.g.position.z) < 2.4 && Math.abs(player.y - p.g.position.y) < 1.5) {
        const perch = perches[Math.floor(Math.random() * perches.length)];
        fly(p, new THREE.Vector3(perch[0] + (Math.random() - 0.5) * 0.8, perch[1], perch[2] + (Math.random() - 0.5) * 0.3), 'perched');
      }
    } else if (p.state === 'fly') {
      p.k = Math.min(1, p.k + dt / p.dur);
      const e = p.k * p.k * (3 - 2 * p.k);
      p.g.position.lerpVectors(p.from, p.to, e);
      p.g.position.y += Math.sin(Math.PI * p.k) * p.arc;
      p.g.rotation.y = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z);
      const flap = Math.sin(t * 34 + p.phase) * 0.9;
      p.wings[0].rotation.z = -flap;
      p.wings[1].rotation.z = flap;
      if (p.k >= 1) {
        p.state = p.next;
        p.wait = 7 + Math.random() * 8;
        for (const w of p.wings) w.visible = false;
        p.target.copy(p.home);
      }
    } else {
      // perched: wait until the player has moved on, then glide back down
      p.wait -= dt;
      const near = player && Math.hypot(player.x - p.home.x, player.z - p.home.z) < 4;
      if (p.wait < 0 && !near) fly(p, p.home, 'ground');
    }
  }
}
function fly(p, to, next) {
  p.state = 'fly';
  p.next = next;
  p.k = 0;
  p.from.copy(p.g.position);
  p.to.copy(to);
  p.dur = 0.9 + p.from.distanceTo(to) * 0.09 + Math.random() * 0.3;
  p.arc = next === 'perched' ? 1.2 : 0.4;
  for (const w of p.wings) w.visible = true;
}

/* ── People ──────────────────────────────────────── */

// Loops are [x, z] or [x, z, lookX, lookZ, seconds]: stop there and look at something.
// They keep off the stairs (x 3…7, z < −26.5), out of doorways and off the scene spots.
const LOOPS = [
  { seeds: [301, 302], pts: [[2.2, 26], [2.4, 10], [3.0, 2], [2.6, -6], [2.0, -12], [3.6, -6], [3.8, 8], [3.4, 26]] },
  { seeds: [311], pts: [[-3, 28], [-3.4, 8], [-2.3, 5.4, TX, 0, 4], [1.6, 4], [1.2, 14], [-1.5, 22]] },
  { seeds: [321], pts: [[4.6, 24], [4.3, 14.5, 6.2, 14.5, 3], [4.2, 8.8], [4.2, 4.6, 6, 4.5, 4.5], [4.4, -1.5, 6.2, -2.5, 2.5], [4.4, -7], [1.5, -7.2], [1.2, 6], [0.5, 20]] },
  { seeds: [331, 332], pts: [[-7.5, -10.5], [-1.5, -11.5], [3.2, -12], [7.6, -12.3], [7.8, -17.4], [3.4, -19.3, 8.5, -22.8, 6], [0.5, -16.2], [-1.6, -14.5], [-7.6, -14]] },
  { seeds: [341], weak: false, pts: [[-11.5, -6], [-7, -6.2], [-3, -7.5], [-2.6, -12.5], [-7.2, -17.6], [-7.4, -12], [-7, -8.6], [-11.5, -5.2]] },
  { seeds: [351, 352], pts: [[11.5, -6], [7, -6.4], [4.5, -9.5], [2.2, -15], [1.2, -20.6, -1.7, -22.6, 4.5], [2.4, -23.8], [3.2, -19], [2.9, -13], [6.4, -9.8], [11.5, -7.2]] },
  { seeds: [361], pts: [[-2.2, -18], [0, -14], [1.8, -8.5], [2.6, 2], [2.2, 14], [-1, 20], [-2.8, 10], [-3.6, 6.2], [1.4, 3.6], [1.6, -8], [-1, -13.5], [-2.2, -16.5]] },
  { seeds: [371], weak: false, phone: true, speed: 0.8, pts: [[-6.9, -19], [-7, -12.5], [-3, -10.2], [-1.2, -12.8], [-2, -15.2], [-6.2, -17.4]] },
  { seeds: [381, 382], weak: false, pts: [[-3.4, 27], [-3.6, 13], [-1, 9.4], [-11, 9.2], [-11, 10.4], [-3, 10.6], [-1.2, 18], [-2.6, 27]] },
  { seeds: [391], weak: false, pts: [[11, 9], [4.5, 9.2], [3.2, 16], [4.4, 22, 6.2, 21, 4], [3.6, 28], [1.8, 22], [2.6, 10.6], [11, 10.4]] },
  { seeds: [401, 402], kid: true, pts: [[-6.4, -9], [-0.6, -10.6], [6.9, -10.9], [7.1, -18.8, 8.5, -22.8, 7], [6.6, -11.6], [-0.4, -11.4], [-6.6, -10]] },
];

function buildWalkers(weak) {
  LOOPS.forEach((loop, li) => {
    if (weak && loop.weak === false) return;
    const pts = loop.pts.map(([x, z, lx, lz, wait]) => ({ x, z, look: lx === undefined ? null : new THREE.Vector3(lx, 0, lz), wait: wait ?? 0 }));
    const start = (li * 3) % pts.length;
    const members = loop.seeds.map((seed, k) => {
      const c = trimShadows(makePedestrian(seed));
      const scale = loop.kid && k === 1 ? 0.68 : 0.94 + ((seed * 7) % 10) / 100;
      c.root.scale.setScalar(scale);
      if (loop.phone) {
        addPhone(c);
        c.armPose = () => [-0.3, -1.25];
        c.head.rotation.x = 0.3;
      }
      return { c, off: loop.seeds.length > 1 ? (k ? 0.34 : -0.34) : 0, avoid: new THREE.Vector2(), scale };
    });
    const w = { members, pts, i: (start + 1) % pts.length, pos: new THREE.Vector2(pts[start].x, pts[start].z), heading: 0, speed: loop.speed ?? 1.0 + ((li * 37) % 5) / 10, pause: 0, face: null, chat: 2 + li, owl: li % 3 === 0 };
    for (const m of members) m.c.root.position.set(w.pos.x + m.off, heightAt(w.pos.x, w.pos.y), w.pos.y);
    walkers.push(w);
  });
}

function updateWalkers(dt, t, hour, player, talking) {
  const awake = hour >= 7 && hour < 23.5;
  for (const w of walkers) {
    const on = awake || (w.owl && (hour >= 23.5 || hour < 1.5));
    const far = player ? Math.hypot(player.x - w.pos.x, player.z - w.pos.y) : 0;
    const show = on && far < 48;
    for (const m of w.members) m.c.root.visible = show;
    if (!show) continue;
    let sp = 0;
    const held = talking && far < 4.5; // don't wander through a conversation
    if (w.pause > 0) w.pause -= dt;
    else if (!held) {
      const target = w.pts[w.i];
      const dx = target.x - w.pos.x;
      const dz = target.z - w.pos.y;
      const d = Math.hypot(dx, dz);
      if (d < 0.12) {
        w.face = target.look;
        w.pause = target.look ? target.wait : Math.random() < 0.12 ? 1 + Math.random() * 2 : 0;
        w.i = (w.i + 1) % w.pts.length;
      } else {
        const step = Math.min(d, w.speed * dt);
        w.pos.x += (dx / d) * step;
        w.pos.y += (dz / d) * step;
        w.heading = Math.atan2(dx, dz);
        sp = w.speed / 3.0;
        w.face = null;
      }
    }
    // couples talk as they go
    w.chat -= dt;
    if (w.members.length > 1 && w.chat < 0) {
      w.chat = 2.5 + Math.random() * 3;
      const who = w.members[Math.floor(Math.random() * 2)];
      who.c.talkT = 1.5;
      if (Math.random() < 0.3) setExpr(w.members[0].c, 'laugh', 1.2);
    }
    const rx = Math.cos(w.heading);
    const rz = -Math.sin(w.heading);
    w.members.forEach((m, k) => {
      const root = m.c.root;
      let wx = w.pos.x + rx * m.off;
      let wz = w.pos.y + rz * m.off;
      // step aside for the player
      let ax = 0;
      let az = 0;
      if (player) {
        const px = wx - player.x;
        const pz = wz - player.z;
        const pd = Math.hypot(px, pz);
        if (pd < 1.15 && Math.abs(player.y - root.position.y) < 1.2) {
          const push = (1.15 - pd) / Math.max(pd, 0.05);
          ax = (pd < 0.05 ? rx : px) * push;
          az = (pd < 0.05 ? rz : pz) * push;
        }
      }
      m.avoid.x += (ax - m.avoid.x) * damp(6, dt);
      m.avoid.y += (az - m.avoid.y) * damp(6, dt);
      wx += m.avoid.x;
      wz += m.avoid.y;
      const k2 = damp(12, dt);
      root.position.x += (wx - root.position.x) * k2;
      root.position.z += (wz - root.position.z) * k2;
      root.position.y = heightAt(root.position.x, root.position.z);
      const yaw = w.face && sp === 0 ? Math.atan2(w.face.x - root.position.x, w.face.z - root.position.z) : w.heading;
      root.rotation.y += wrapAngle(yaw - root.rotation.y) * damp(6, dt);
      if (w.members.length > 1) m.c.lookYaw = sp > 0 ? (k ? -0.45 : 0.45) : 0;
      animate(m.c, dt, t, sp);
    });
  }
}

/** Someone who stays put: `tick` drives them; `hours` is when they are out; `tent` ties them to the open tent. */
function fixture(c, x, z, yaw, { tick = null, hours = null, tent = false, sit = false } = {}) {
  trimShadows(c);
  c.root.position.set(x, heightAt(x, z), z);
  c.root.rotation.y = yaw;
  if (sit) c.pose = 'sit';
  const f = { c, tick, hours, tent, yaw, phase: statics.length * 1.7, next: 1 + statics.length * 0.6 };
  statics.push(f);
  return f;
}

function buildPeople(weak) {
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  // busker and listeners
  const busker = makeBusker();
  busker.armPose = (t) => [-0.95 + Math.sin(t * 9) * 0.16, -1.05];
  fixture(busker, SPOT.busker.x, SPOT.busker.z, -Math.PI / 2, {
    hours: [11, 22],
    tick: (f, dt, t, env) => {
      if (env.talking) return;
      busker.head.rotation.x = Math.sin(t * 2.4) * 0.06;
      busker.lookYaw = Math.sin(t * 0.5) * 0.35;
      if (busker.talkT <= 0 && Math.sin(t * 0.35) > -0.3) busker.talkT = 0.4; // singing
    },
  });
  STREET_CAST.busker = busker;
  const arc = [[-58, 2.5, 'clap'], [-33, 2.75, 'sway'], [21, 2.7, 'film'], [44, 2.5, 'clap'], [67, 2.85, 'sway']].slice(0, weak ? 4 : 5);
  arc.forEach(([deg, r, kind], i) => {
    const a = (deg * Math.PI) / 180;
    const x = SPOT.busker.x - Math.cos(a) * r;
    const z = SPOT.busker.z + Math.sin(a) * r;
    const c = makePedestrian(500 + i * 13);
    c.root.scale.setScalar(0.93 + (i % 3) * 0.04);
    if (kind === 'film') {
      addPhone(c);
      c.armPose = () => [-0.3, -1.5];
    } else if (kind === 'clap') c.armPose = (t) => [-1.15 + Math.sin(t * 7 + i) * 0.14, -1.15 + Math.sin(t * 7 + i) * 0.14];
    fixture(c, x, z, face(x, z, SPOT.busker.x, SPOT.busker.z), {
      hours: [11, 22],
      tick: (f, dt, t) => {
        c.body.rotation.z = Math.sin(t * 2.4 + f.phase) * (kind === 'sway' ? 0.07 : 0.03);
        if (f.next < 0) {
          f.next = 4 + Math.random() * 5;
          c.lookYaw = Math.random() < 0.3 ? (Math.random() - 0.5) * 1.2 : 0;
          if (Math.random() < 0.4) setExpr(c, 'happy', 1.6);
        }
      },
    });
  });

  // the 붕어빵 seller behind her cart
  const seller = makeSeller();
  seller.armPose = (t) => [-0.95 + Math.sin(t * 2.2) * 0.22, -0.8 + Math.sin(t * 2.2 + 1.4) * 0.18];
  fixture(seller, SPOT.cart.x + 0.4, SPOT.cart.z - 0.78, 0, {
    hours: [10, 23],
    tick: (f, dt, t, env) => {
      if (env.talking) return;
      if (env.player && env.player.distanceTo(seller.root.position) < 4.5) lookAtYaw(seller, env.player, 1);
      else seller.lookYaw = Math.sin(t * 0.4) * 0.3;
    },
  });
  STREET_CAST.seller = seller;
  // someone waiting for theirs, a step to the side of where the player stands
  const waiting = makePedestrian(533);
  waiting.armPose = () => [-0.2, -0.2];
  fixture(waiting, SPOT.cart.x - 1.25, SPOT.cart.z + 1.05, face(SPOT.cart.x - 1.25, SPOT.cart.z + 1.05, SPOT.cart.x - 0.4, SPOT.cart.z), { hours: [12, 21], tick: idleLook });

  // the taxi driver, leaning on his bonnet
  const driver = makeDriver();
  driver.armPose = () => [-0.5, -0.5];
  fixture(driver, SPOT.taxi.x + 0.1, SPOT.taxi.z + 2.62, 0.35, {
    tick: (f, dt, t, env) => {
      if (env.talking) return;
      if (env.player && env.player.distanceTo(driver.root.position) < 5) lookAtYaw(driver, env.player, 1.1);
      else idleLook(f);
    },
  });
  STREET_CAST.driver = driver;

  // two friends over coffee outside Café Bom
  const chatters = [0, 1].map((k) => {
    const c = makePedestrian(610 + k * 9);
    c.armPose = () => (k ? [-0.6, -1.1] : [-0.6, -0.6]);
    return fixture(c, 9.15, -12.6 + (k ? 0.68 : -0.68), k ? Math.PI : 0, { sit: true, hours: [9, 21.5], tick: (f, dt, t) => chatTick(f, chatters) });
  });

  // customers at the pojangmacha while it is open: the far stool at the counter
  // (the player's and Jin's stools, and the one beside Jin, stay free) and the table outside
  const eater = makePedestrian(707);
  eater.armPose = (t) => [-0.9 + Math.sin(t * 1.3) * 0.25, -0.5];
  fixture(eater, STOOLS[0].x, STOOLS[0].z, Math.PI, { sit: true, tent: true, tick: idleLook });
  const pair = [0, 1].map((k) => {
    const c = makePedestrian(720 + k * 11);
    c.armPose = (t) => (k ? [-0.6, -0.9 + Math.sin(t * 1.1) * 0.2] : [-0.7, -0.6]);
    return fixture(c, -4.7, k ? 5.3 : 3.7, k ? Math.PI : 0, { sit: true, tent: true, tick: (f, dt, t) => chatTick(f, pair) });
  });
  // their food
  const B = batcher();
  for (const [x, y, z] of [[-4.82, 0.64, 4.3], [-4.6, 0.64, 4.72], [STOOLS[0].x, COUNTER_Y + 0.01, -0.84]]) {
    B.cyl(P.paint, 0.11, 0.08, 0.05, x, y, z, { color: '#f4f1ea', seg: 14 });
    B.cyl(P.paint, 0.095, 0.095, 0.012, x, y + 0.045, z, { color: '#d4401f', seg: 14 });
  }
  tentFood = B.build(G.scene, { cast: false });
}
let tentFood = [];

function idleLook(f) {
  if (f.next < 0) {
    f.next = 3 + Math.random() * 5;
    f.c.lookYaw = [0, 0, 0.6, -0.6, 0.3][Math.floor(Math.random() * 5)];
  }
}
function chatTick(f, pair) {
  if (f.next < 0) {
    f.next = 2.4 + Math.random() * 2.5;
    const other = pair.find((p) => p !== f);
    f.c.talkT = 1.5;
    if (other) other.next = f.next * 0.5 + 1;
    if (Math.random() < 0.35 && other) setExpr(other.c, 'laugh', 1.3);
  }
}

function updateStatics(dt, t, hour, player, talking, tentOpen) {
  const env = { player, talking, hour };
  for (const f of statics) {
    const inHours = !f.hours || (hour >= f.hours[0] && hour < f.hours[1]);
    const show = inHours && (!f.tent || tentOpen) && (!player || player.distanceTo(f.c.root.position) < 48);
    f.c.root.visible = show;
    if (!show) continue;
    f.next -= dt;
    f.tick?.(f, dt, t, env);
    animate(f.c, dt, t, 0);
  }
  for (const m of tentFood) m.visible = tentOpen;
}

/* ── Entry points ────────────────────────────────── */

/**
 * Build once, inside Seoul's city build (so it hides with the city).
 * deps: { heightAt?: (x, z) => y }.
 */
export function buildHongdaeLife(deps = {}) {
  if (P) return;
  heightAt = deps.heightAt ?? coreHeightAt;
  // Fewer people on weak devices; the scene spots and their three people are always there.
  const nav = globalThis.navigator ?? {};
  const weak = deps.weak ?? ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3);
  materials();
  buildDressing();
  buildVerticalSigns();
  buildStringLights();
  buildSteam();
  buildPigeons(weak ? 4 : 7);
  buildWalkers(weak);
  buildPeople(weak);
  cat = makeCat(new THREE.Vector3(5.7, 2.56, 4.9));
  cat.g.rotation.y = Math.PI * 0.6;
  // a musical note that drifts up from the busker
  buskerNote = new THREE.Sprite(new THREE.SpriteMaterial({ map: paintTexture(64, 64, (g) => {
    g.fillStyle = '#ffffff';
    g.font = '54px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('♪', 32, 34);
  }), transparent: true, depthWrite: false }));
  buskerNote.scale.setScalar(0.34);
  G.scene.add(buskerNote);
}

/** Per frame while S.city === 'seoul'. `playerPos` is the player's root position. */
export function updateHongdaeLife(dt, t, { hour = 12, playerPos = null, talking = false } = {}) {
  if (!P) return;
  const tentOpen = tentMats.flap ? !tentMats.flap.visible : false;
  updateWalkers(dt, t, hour, playerPos, talking);
  updateStatics(dt, t, hour, playerPos, talking, tentOpen);
  updatePigeons(dt, t, playerPos, hour);
  updateSteam(t, tentOpen, G.night);
  if (cat) {
    cat.body.scale.y = 1 + Math.sin(t * 2.1) * 0.04;
    cat.tail.rotation.y = Math.sin(t * 1.2) * 0.5;
  }
  if (claw) claw.rotation.z = Math.sin(t * 1.4) * 0.12;
  const playing = STREET_CAST.busker?.root.visible;
  buskerNote.visible = !!playing;
  if (playing) {
    const k = (t * 0.45) % 1;
    buskerNote.position.set(SPOT.busker.x - 0.5 + Math.sin(t * 2) * 0.15 - k * 0.4, 1.7 + k * 1.1, SPOT.busker.z + 0.2);
    buskerNote.material.opacity = Math.sin(Math.PI * k) * 0.9;
  }
}

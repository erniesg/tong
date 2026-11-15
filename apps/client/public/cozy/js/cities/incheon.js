// Day one's opening set (docs/seoul-first-day.md): one car of the airport train,
// full of people, a minute from Hongdae at 4:20pm. Hidden from flights and the
// subway. The player never walks here: they are already seated, the scene plays,
// and the game fades to the street. Built to be looked at from the seat camera
// (INCHEON.cam), which sits outside the cut-away near wall.
import * as THREE from 'three';
import { G, mat, pointLight, seeded, damp } from '../util.js';
import { registerInterior } from '../interiors.js';
import { fabric } from '../textures.js';
import { makeChibi, makePedestrian, toon, animate, setExpr, chibiKit } from '../characters.js';
import { batcher, paintTexture, signPlane, dramaPosterTexture } from '../set-dressing.js';

// Every city shares one world space; the train sits west of Seoul (−62…62), clear of
// Tokyo (x 340…460) and Shanghai (x 725…875). The car is authored in local metres:
// x 0…16 along the car, z 0…3.2 across it, the player's bench on the z = 0 side.
const X0 = -400;
const Z0 = 20;
const LEN = 16;
const WID = 3.2;
const CEIL = 2.45;
const SEAT0 = 4.8; // the long bench runs x 4.8…11.2, eleven seats
const PITCH = 0.582;
const seatX = (i) => SEAT0 + PITCH * (i + 0.5);
const DOORS = [[3.0, 4.4], [11.6, 13.0]];
const WINDOWS = [[0.5, 2.7], [4.8, 7.85], [8.15, 11.2], [13.3, 15.5]];
const SPEED = 15; // metres a second, slowing for the station
const bounds = { minX: X0 - 3, maxX: X0 + LEN + 3, minZ: Z0 - 3, maxZ: Z0 + WID + 3 };
const TAU = Math.PI * 2;

export const INCHEON = {
  /** Where the player sits (feet on the floor, facing across the aisle). */
  seat: [X0 + seatX(5), 0, Z0 + 0.36],
  seatYaw: 0,
  /** The framing the car is dressed for. */
  // From the aisle side of the door end: you and the grandmother in profile, the student across from you.
  cam: { yaw: Math.PI + 0.5, pitch: 0.24, dist: 4.4 },
  spawn: [X0 + seatX(5), 0, Z0 + 0.36],
  /** The grandmother beside you and the student across the aisle (characters.js chibis). */
  grandma: null,
  student: null,
  /** Everyone else in the car: { c, kind }. */
  passengers: [],
  // The arrivals hall is gone. Kept only until main.js stops reading them.
  exitDoor: new THREE.Vector3(X0, -50, 0),
  board: new THREE.Vector3(X0, -50, 0),
};
/** @deprecated The hall and its doors were removed. */
export function setExitOpen() {}

let car;
const scrollers = []; // { tex, rate } in tiles per second
const strapPivots = [];
const riders = [];
let led = null;
let ledFrame = -1;
let stop = { ko: '홍대입구', en: 'Hongik Univ.' };
let shadowPole = null;

/** Change the stop on the LED strips above the doors. */
export function setTrainStop(textKo, textEn) {
  stop = { ko: textKo, en: textEn };
  ledFrame = -1;
}

/* ── Painted textures ─────────────────────────────── */

function floorTexture() {
  const rnd = seeded(31);
  const tex = paintTexture(128, 128, (g) => {
    g.fillStyle = '#a4a9a8';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = ['#8d9493', '#bfc3c0', '#7f8a8c', '#c9c4b8'][i % 4];
      g.fillRect(rnd() * 128, rnd() * 128, 1.6, 1.6);
    }
  }, { repeat: true });
  tex.repeat.set(20, 4);
  return tex;
}

function ledTexture() {
  return paintTexture(512, 96, (g, w, h) => {
    g.fillStyle = '#0d0f12';
    g.fillRect(0, 0, w, h);
    const text = ['이번 역', stop.ko, stop.en][Math.max(0, ledFrame) % 3];
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${text === stop.en ? 58 : 68}px Jua, sans-serif`;
    g.shadowColor = '#ff8a1e';
    g.shadowBlur = 14;
    g.fillStyle = text === '이번 역' ? '#7dff9a' : '#ffb640';
    g.fillText(text, w / 2, h / 2 + 4);
    g.shadowBlur = 0;
    // dot-matrix grid
    g.fillStyle = 'rgba(13,15,18,0.45)';
    for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 1.5, h);
    for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1.5);
  });
}

function lineMapTexture() {
  const stations = ['인천공항', '청라', '계양', '김포공항', '마곡나루', '디지털미디어시티', '홍대입구', '공덕', '서울역'];
  return paintTexture(1536, 200, (g, w, h) => {
    g.fillStyle = '#fbfaf5';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f6fc4';
    g.fillRect(0, 0, 150, h);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '44px Jua, sans-serif';
    g.fillText('공항', 75, 70);
    g.fillText('철도', 75, 128);
    const x0 = 230;
    const dx = (w - x0 - 90) / (stations.length - 1);
    g.strokeStyle = '#3aa0e8';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(x0, 70);
    g.lineTo(x0 + dx * (stations.length - 1), 70);
    g.stroke();
    stations.forEach((s, i) => {
      const here = s === '홍대입구';
      g.beginPath();
      g.arc(x0 + dx * i, 70, here ? 24 : 15, 0, TAU);
      g.fillStyle = here ? '#ff7a22' : '#ffffff';
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = here ? '#c94f08' : '#1f6fc4';
      g.stroke();
      g.fillStyle = here ? '#c94f08' : '#33404d';
      g.font = `${here ? 40 : s.length > 5 ? 26 : 32}px ${here ? 'Jua' : "'Gowun Dodum'"}, sans-serif`;
      g.fillText(s, x0 + dx * i, 142);
    });
  });
}

function adTexture(kind) {
  return paintTexture(768, 240, (g, w, h) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'tangerine') {
      g.fillStyle = '#ffe9b8';
      g.fillRect(0, 0, w, h);
      for (const [x, y, r] of [[110, 130, 78], [215, 165, 56], [668, 70, 44]]) {
        g.fillStyle = '#f7941d';
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.fillStyle = '#4c8a3a';
        g.beginPath();
        g.ellipse(x + r * 0.15, y - r * 0.92, r * 0.34, r * 0.14, -0.5, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#b3470a';
      g.font = '92px Jua, sans-serif';
      g.fillText('제주 감귤', 470, 100);
      g.fillStyle = '#6b4a2a';
      g.font = "44px 'Gowun Dodum', sans-serif";
      g.fillText('겨울 끝, 가장 달 때', 470, 186);
    } else {
      const bg = g.createLinearGradient(0, 0, w, 0);
      bg.addColorStop(0, '#ffd9e4');
      bg.addColorStop(1, '#fff3e0');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 46; i++) {
        g.fillStyle = i % 3 ? '#ffb3c8' : '#ffffff';
        g.beginPath();
        g.arc((i * 97) % w, (i * 53) % h, 7 + (i % 4) * 2, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#b23a62';
      g.font = '86px Jua, sans-serif';
      g.fillText('한강 봄꽃길', w / 2, 96);
      g.fillStyle = '#6d4353';
      g.font = "42px 'Gowun Dodum', sans-serif";
      g.fillText('3월 · 여의도에서 만나요', w / 2, 182);
    }
  });
}

/** Apartment blocks on the far bank in low sun. Tiles sideways; the bottom band is solid. */
function bankTexture() {
  const W = 2048;
  const H = 512;
  const rnd = seeded(77);
  const blocks = [];
  for (const cx of [260, 980, 1620]) {
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) blocks.push({ x: cx + (i - n / 2) * 105 + rnd() * 30, w: 84 + rnd() * 50, h: 170 + rnd() * 120, c: ['#f3e2c8', '#ecd0b2', '#f6e9d8', '#e2c9b4', '#edd9cc'][Math.floor(rnd() * 5)], seed: rnd() });
  }
  return paintTexture(W, H, (g) => {
    const base = H - 96;
    for (const b of blocks) {
      for (const ox of [0, -W, W]) {
        const x = b.x + ox;
        g.fillStyle = b.c;
        g.fillRect(x, base - b.h, b.w, b.h);
        g.fillStyle = 'rgba(255,236,200,0.75)'; // the sunlit end wall
        g.fillRect(x, base - b.h, b.w * 0.16, b.h);
        g.fillStyle = 'rgba(120,96,110,0.5)';
        g.fillRect(x, base - b.h - 7, b.w, 7);
        g.fillRect(x + b.w * 0.6, base - b.h - 17, 16, 10);
        const r2 = seeded(Math.floor(b.seed * 1e6));
        for (let wy = base - b.h + 14; wy < base - 12; wy += 13) {
          for (let wx = x + b.w * 0.2; wx < x + b.w - 8; wx += 11) {
            const lit = r2() < 0.12;
            g.fillStyle = lit ? '#ffd98a' : 'rgba(104,120,156,0.5)';
            g.fillRect(wx, wy, 7, 6);
          }
        }
      }
    }
    // embankment: trees, the riverside road, the bank itself
    for (let x = 0; x < W; x += 9) {
      const r = 10 + ((x * 37) % 11);
      g.fillStyle = ['#8f9a6c', '#a3a777', '#7f8f66'][(x / 9) % 3 | 0];
      g.beginPath();
      g.arc(x, base + 4, r, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#9d9a84';
    g.fillRect(0, base + 8, W, 26);
    g.fillStyle = '#e9dcc4';
    g.fillRect(0, base + 12, W, 5);
    g.fillStyle = '#8b9a86';
    g.fillRect(0, base + 34, W, H - base - 34);
    // warm haze
    const haze = g.createLinearGradient(0, 0, 0, H);
    haze.addColorStop(0, 'rgba(255,214,170,0.10)');
    haze.addColorStop(1, 'rgba(255,205,160,0.34)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = haze;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }, { repeat: true });
}

function hillsTexture() {
  const W = 1024;
  const H = 256;
  return paintTexture(W, H, (g) => {
    const ridge = (color, baseY, amp, f, ph) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const a = (x / W) * TAU;
        g.lineTo(x, baseY - amp * (0.55 + 0.3 * Math.sin(a * f + ph) + 0.15 * Math.sin(a * f * 3 + ph * 2)));
      }
      g.lineTo(W, H);
      g.fill();
    };
    ridge('#d6c2cc', 150, 80, 2, 0.4);
    // the tower on its hill
    g.fillStyle = '#c9b3c2';
    g.fillRect(608, 30, 4, 60);
    g.fillRect(602, 52, 16, 9);
    ridge('#c3b2c6', 190, 70, 3, 2.1);
    ridge('#b7adc0', 232, 40, 5, 1.2);
  }, { repeat: true });
}

/** The river from above: sky colour, long ripples and a scatter of low-sun glints. */
function riverTexture() {
  const S = 512;
  const rnd = seeded(5);
  const tex = paintTexture(S, S, (g) => {
    g.fillStyle = '#86a9b8';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 520; i++) {
      const y = rnd() * S;
      const x = rnd() * S;
      const w = 20 + rnd() * 90;
      const k = rnd();
      g.fillStyle = k < 0.45 ? 'rgba(210,228,232,0.35)' : k < 0.8 ? 'rgba(92,128,150,0.35)' : 'rgba(255,226,170,0.75)';
      for (const ox of [0, -S]) g.fillRect(x + ox, y, w, k < 0.8 ? 2.2 : 1.6);
    }
  }, { repeat: true });
  tex.repeat.set(24, 6);
  return tex;
}

/** The parallel road bridge in side elevation: deck, lamps, piers and shallow arches. */
function bridgeTexture() {
  const W = 1024;
  const H = 256;
  return paintTexture(W, H, (g) => {
    g.fillStyle = '#dccdb6';
    g.fillRect(0, 70, W, H - 70);
    g.globalCompositeOperation = 'destination-out';
    for (const cx of [256, 768]) {
      g.beginPath();
      g.ellipse(cx, H + 10, 214, 150, 0, 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#bfae98';
    g.fillRect(0, 70, W, 12);
    g.fillStyle = 'rgba(255,240,214,0.7)';
    g.fillRect(0, 82, W, 5);
    g.fillStyle = '#8f8a84';
    for (let x = 32; x < W; x += 128) {
      g.fillRect(x, 30, 3, 40);
      g.fillRect(x - 8, 30, 19, 3);
    }
    // traffic, blurred by distance
    ['#f2f0ea', '#f08a24', '#3d4654', '#c94b3c', '#f2f0ea', '#5a86c4', '#f08a24'].forEach((c, i) => {
      g.fillStyle = c;
      roundRectPath(g, 60 + i * 142 + (i % 2) * 30, 57, 30 + (i % 3) * 8, 13, 4);
      g.fill();
    });
  }, { repeat: true });
}
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** What rushes past the glass: the bridge parapet (speed-blurred) and a catenary mast per tile. */
function trackTexture() {
  const W = 512;
  const H = 256;
  return paintTexture(W, H, (g) => {
    g.strokeStyle = 'rgba(70,80,88,0.8)';
    g.lineWidth = 1.5;
    for (const y of [34, 58]) {
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(W / 2, y + 14, W, y);
      g.stroke();
    }
    g.fillStyle = '#5d6b70';
    g.fillRect(250, 18, 9, H);
    g.fillRect(170, 26, 90, 5);
    g.fillRect(176, 31, 3, 20);
    const y0 = H - 92;
    g.fillStyle = 'rgba(126,146,148,0.92)';
    g.fillRect(0, y0, W, 7);
    g.fillRect(0, H - 50, W, 50);
    g.fillStyle = 'rgba(126,146,148,0.42)';
    g.fillRect(0, y0 + 7, W, 36);
    g.fillStyle = 'rgba(255,238,205,0.8)';
    g.fillRect(0, y0, W, 2);
  }, { repeat: true });
}

/** Ballast and rails seen at speed: streaks, no countable sleepers (they would strobe). */
function deckTexture() {
  const W = 256;
  const H = 512;
  const rnd = seeded(12);
  const tex = paintTexture(W, H, (g) => {
    g.fillStyle = '#857b70';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = ['rgba(60,54,50,0.25)', 'rgba(190,180,165,0.22)'][i % 2];
      const x = rnd() * W;
      for (const ox of [0, -W]) g.fillRect(x + ox, rnd() * H, 30 + rnd() * 110, 1.5);
    }
    // deck z −4.6…4.2 maps to canvas y 0…H; tracks centred on z −2.6 and z 1.6
    const py = (z) => ((z + 4.6) / 8.8) * H;
    for (const zc of [-2.6, 1.6]) {
      g.fillStyle = 'rgba(70,58,50,0.55)';
      g.fillRect(0, py(zc - 1.25), W, py(2.5) - py(0));
      for (const dz of [-0.72, 0.72]) {
        g.fillStyle = '#d9d2c6';
        g.fillRect(0, py(zc + dz) - 2.5, W, 5);
        g.fillStyle = '#6a625c';
        g.fillRect(0, py(zc + dz) + 2.5, W, 2);
      }
    }
    g.fillStyle = '#b9b2a6';
    g.fillRect(0, 0, W, 10);
    g.fillRect(0, H - 10, W, 10);
  }, { repeat: true });
  tex.repeat.set(34, 1);
  return tex;
}

/* ── The car ─────────────────────────────────────── */

let P; // shared painted materials
function materials() {
  const f = fabric('#e4e4e4');
  P = {
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55 }),
    seat: new THREE.MeshStandardMaterial({ vertexColors: true, map: f.map, normalMap: f.normalMap, roughness: 0.95 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    floor: mat('#ffffff', { map: floorTexture(), roughness: 0.5 }),
    // Unseen stand-in for the cut-away wall and roof, so the sun still comes in through the windows only.
    shadow: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  };
}

/** One long side of the car as boxes, with its window and door-glass holes left open. */
function wallBoxes(B, m, zw, inn, color) {
  const z0 = Math.min(zw, zw - inn * 0.12);
  const z1 = Math.max(zw, zw - inn * 0.12);
  const o = { color };
  let x = 0;
  for (const [a, b] of [...DOORS, [LEN, LEN]]) {
    B.boxMM(m, x, a, 0, 1.05, z0, z1, o);
    x = b;
  }
  B.boxMM(m, 0, LEN, 1.95, CEIL, z0, z1, o);
  let px = 0;
  for (const [a, b] of [...WINDOWS, [LEN, LEN]].sort((u, v) => u[0] - v[0])) {
    // pillars between windows, skipping the door openings
    for (const [s, e] of splitAround(px, a, DOORS)) if (e - s > 0.01) B.boxMM(m, s, e, 1.05, 1.95, z0, z1, o);
    px = b;
  }
  // door leaves: kick panel, header and stiles around a glass pane
  for (const [a, b] of DOORS) {
    const mid = (a + b) / 2;
    const d = { color: m === P.shadow ? color : '#c9d0d5' };
    const dz0 = Math.min(zw, zw - inn * 0.07);
    const dz1 = Math.max(zw, zw - inn * 0.07);
    B.boxMM(m, a, b, 0, 0.95, dz0, dz1, d);
    B.boxMM(m, a, b, 1.72, 1.95, dz0, dz1, d);
    for (const sx of [a + 0.04, mid, b - 0.04]) B.boxMM(m, sx - 0.05, sx + 0.05, 0.95, 1.72, dz0, dz1, d);
  }
}
function splitAround(s, e, gaps) {
  let out = [[s, e]];
  for (const [a, b] of gaps) out = out.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, Math.min(v, a)], [Math.max(u, b), v]]));
  return out;
}

/** A dressed side wall as one group, so the camera's side fades as a whole (interiors.js). */
function sideWall(far, tex) {
  const zw = far ? WID : 0;
  const inn = far ? -1 : 1; // towards the aisle
  const grp = new THREE.Group();
  grp.userData.cutawaySide = far ? 3 : 2;
  car.add(grp);
  const B = batcher();
  wallBoxes(B, P.paint, zw, inn, '#eceef0');
  for (const [a, b] of WINDOWS) {
    B.boxMM(P.glass, a, b, 1.05, 1.95, zw - inn * 0.07 - 0.01, zw - inn * 0.07 + 0.01);
    B.boxMM(P.metal, a - 0.02, b + 0.02, 1.02, 1.06, Math.min(zw, zw + inn * 0.05), Math.max(zw, zw + inn * 0.05), { color: '#aeb6bc' });
  }
  for (const [a, b] of DOORS) {
    B.boxMM(P.glass, a + 0.09, b - 0.09, 0.95, 1.72, zw - inn * 0.035 - 0.01, zw - inn * 0.035 + 0.01);
    // LED strip housing over the door
    B.boxMM(P.paint, a + 0.02, b - 0.02, 2.02, 2.34, Math.min(zw, zw + inn * 0.06), Math.max(zw, zw + inn * 0.06), { color: '#20242a' });
  }
  // the roof edge the far wall carries, so the cut-away has thickness
  B.boxMM(P.paint, -0.1, LEN + 0.1, CEIL, CEIL + 0.07, Math.min(zw - inn * 0.2, zw + inn * 0.75), Math.max(zw - inn * 0.2, zw + inn * 0.75), { color: '#dfe3e6' });
  // overhead rack on the end bays, with bags
  for (const [a, b] of [WINDOWS[0], WINDOWS[3]]) {
    for (let k = 0; k < 4; k++) B.boxMM(P.metal, a, b, 1.9, 1.925, zw + inn * (0.06 + k * 0.1) - 0.012, zw + inn * (0.06 + k * 0.1) + 0.012, { color: '#c3cad0' });
    const cols = far ? ['#d9534a', '#3f6c8f', '#e8c547'] : ['#6b8f5a', '#c98a4a', '#8a6fb0'];
    cols.forEach((c, i) => {
      const x = a + 0.45 + i * 0.62;
      B.box(P.paint, 0.5, 0.26 + (i % 2) * 0.06, 0.3, x, 1.93, zw + inn * 0.22, { color: c, ry: (i - 1) * 0.08 });
    });
  }
  B.build(grp, { cast: true });

  // cards above the windows and the LED strips
  const face = far ? Math.PI : 0;
  const card = (t, x, w, h, y = 2.2, glow = 0) => {
    const s = signPlane(t, w, h, { glow });
    s.position.set(x, y, zw + inn * 0.012);
    s.rotation.y = face;
    grp.add(s);
    return s;
  };
  card(tex.drama, far ? 6.33 : 9.68, 1.42, 0.444);
  card(tex.map, far ? 9.68 : 6.33, 2.6, 0.34);
  card(tex.ads[far ? 0 : 1], 1.6, 1.28, 0.4);
  card(tex.ads[far ? 1 : 0], 14.4, 1.28, 0.4);
  for (const [a, b] of DOORS) card(tex.led, (a + b) / 2, 1.24, 0.232, 2.18, 1.6).position.z = zw + inn * 0.066;

  // what rushes past right outside this side
  const track = new THREE.Mesh(new THREE.PlaneGeometry(128, 7), tex.trackMat);
  track.position.set(LEN / 2, 2.5, zw - inn * 2.3);
  track.rotation.y = face;
  grp.add(track);
  return grp;
}

function endWall(x, sideIndex) {
  const grp = new THREE.Group();
  grp.userData.cutawaySide = sideIndex;
  car.add(grp);
  const B = batcher();
  const x0 = sideIndex === 0 ? x - 0.1 : x;
  const x1 = x0 + 0.1;
  const o = { color: '#e6e9eb' };
  B.boxMM(P.paint, x0, x1, 0, CEIL, 0, 0.95, o);
  B.boxMM(P.paint, x0, x1, 0, CEIL, 2.25, WID, o);
  B.boxMM(P.paint, x0, x1, 2.0, CEIL, 0.95, 2.25, o);
  B.boxMM(P.metal, x0 + 0.03, x1 - 0.03, 0, 0.9, 0.95, 2.25, { color: '#b9c0c6' });
  B.boxMM(P.glass, x0 + 0.04, x1 - 0.04, 0.9, 2.0, 0.95, 2.25);
  B.build(grp, { cast: true });
  return grp;
}

function bench(B, x0, x1, n, far, priority = []) {
  const z = (d) => (far ? WID - d : d);
  const zz = (a, b) => [Math.min(z(a), z(b)), Math.max(z(a), z(b))];
  const w = (x1 - x0) / n;
  B.boxMM(P.paint, x0, x1, 0, 0.3, ...zz(0.1, 0.52), { color: '#55606b' });
  for (let i = 0; i < n; i++) {
    const color = priority.includes(i) ? '#e07a9f' : i % 2 ? '#2f6fbd' : '#2a66b0';
    B.boxMM(P.seat, x0 + i * w + 0.02, x0 + (i + 1) * w - 0.02, 0.3, 0.42, ...zz(0.06, 0.6), { color });
    B.boxMM(P.seat, x0 + i * w + 0.02, x0 + (i + 1) * w - 0.02, 0.46, 0.98, ...zz(0.02, 0.14), { color });
  }
  for (const x of [x0, x1]) {
    B.boxMM(P.paint, x - 0.02, x + 0.02, 0.3, 1.22, ...zz(0.02, 0.64), { color: '#dde2e6' });
    B.cyl(P.metal, 0.022, 0.022, 2.09, x, 0, z(0.66), { color: '#f4c22a' });
  }
}

function suitcase(B, x, z, color, h = 0.62, ry = 0) {
  B.box(P.paint, 0.42, h, 0.26, x, 0.06, z, { color, ry });
  B.box(P.paint, 0.44, 0.03, 0.28, x, 0.06 + h * 0.5, z, { color: '#2b2f36', ry });
  B.box(P.metal, 0.2, 0.02, 0.03, x, 0.06 + h + 0.22, z, { color: '#b9c0c6', ry });
  for (const s of [-0.085, 0.085]) B.cyl(P.metal, 0.008, 0.008, 0.24, x + s * Math.cos(ry), 0.06 + h, z - s * Math.sin(ry), { color: '#b9c0c6' });
  for (const s of [-0.16, 0.16]) B.cyl(P.paint, 0.03, 0.03, 0.04, x + s * Math.cos(ry), 0.0, z - s * Math.sin(ry), { color: '#1d1f24' });
}

function buildCar() {
  car = new THREE.Group();
  car.name = 'airport-train-car';
  car.position.set(X0, 0, Z0);
  G.scene.add(car);

  const tex = {
    drama: dramaPosterTexture(1024, 320),
    map: lineMapTexture(),
    ads: [adTexture('tangerine'), adTexture('blossom')],
    led: (led = ledTexture()),
    trackMat: new THREE.MeshBasicMaterial({ map: trackTexture(), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }),
  };
  tex.trackMat.map.repeat.set(8, 1);
  scrollers.push({ tex: tex.trackMat.map, rate: -SPEED / 16 });

  // Static interior: one mesh per material.
  const B = batcher();
  B.boxMM(P.floor, 0, LEN, -0.06, 0, 0, WID);
  for (const [a, b] of DOORS) for (const z of [0.1, WID - 0.1]) B.boxMM(P.paint, a, b, 0, 0.006, z - 0.07, z + 0.07, { color: '#f4c22a' });
  for (const far of [false, true]) {
    bench(B, SEAT0, 11.2, 11, far, [0, 10]);
    bench(B, 0.5, 2.7, 3, far);
    if (!far) bench(B, 13.3, 15.5, 3, far);
    const z = far ? WID - 0.78 : 0.78;
    // grab rails over the bench fronts (cyl() anchors the base, so y0 = 2.07 − half the length), and mid-bench poles
    B.cyl(P.metal, 0.018, 0.018, 6.4, 8, 2.07 - 3.2, z, { color: '#c9d0d5', rz: Math.PI / 2, seg: 8 });
    B.cyl(P.metal, 0.018, 0.018, 2.2, 1.6, 2.07 - 1.1, z, { color: '#c9d0d5', rz: Math.PI / 2, seg: 8 });
    for (const x of [6.55, 9.45]) B.cyl(P.metal, 0.022, 0.022, 2.09, x, 0, far ? WID - 0.66 : 0.66, { color: '#f4c22a' });
  }

  // far end bay: the floor luggage shelves every airport train has
  const lz = [WID - 0.62, WID - 0.06];
  for (const y of [0.34, 1.02, 1.66]) B.boxMM(P.metal, 13.3, 15.5, y, y + 0.03, ...lz, { color: '#c3cad0' });
  for (const x of [13.3, 14.4, 15.5]) B.boxMM(P.metal, x - 0.02, x + 0.02, 0, 1.69, lz[0], lz[0] + 0.04, { color: '#c3cad0' });
  [['#d9534a', 0.56], ['#2e4a62', 0.5], ['#e8c547', 0.44], ['#7b9a6b', 0.56]].forEach(([c, h], i) => B.box(P.paint, 0.4, h, 0.44, 13.6 + i * 0.52, 0.37, WID - 0.34, { color: c }));
  [['#8a6fb0', 0.46], ['#e98aa6', 0.52], ['#3d4654', 0.42]].forEach(([c, h], i) => B.box(P.paint, 0.46, h, 0.44, 13.7 + i * 0.66, 1.05, WID - 0.34, { color: c }));
  // suitcases parked by their owners
  suitcase(B, 3.35, 2.3, '#e8873a', 0.66, 0.2);
  suitcase(B, 7.42, 0.95, '#c0392b', 0.58, Math.PI / 2 + 0.1);
  suitcase(B, 10.95, 2.22, '#2e7d6b', 0.62, Math.PI / 2);
  suitcase(B, 12.75, 1.25, '#f2f0ea', 0.7, -0.3);
  // the body below the floor line (what the cut-away shows of the outside), then the underframe
  B.boxMM(P.paint, 0, LEN, -0.42, -0.06, -0.12, WID + 0.12, { color: '#eef1f3' });
  B.boxMM(P.paint, 0, LEN, -0.3, -0.16, -0.13, WID + 0.13, { color: '#1d63b8' });
  B.boxMM(P.paint, 0, LEN, -0.8, -0.42, 0.05, WID - 0.05, { color: '#3a4048' });
  B.build(car, { cast: true });

  // hanging straps: four runs that swing a little out of step
  for (const far of [false, true]) {
    for (const [a, b] of [[5.1, 7.9], [8.1, 10.9]]) {
      const pivot = new THREE.Group();
      pivot.position.set(0, 2.07, far ? WID - 0.78 : 0.78);
      car.add(pivot);
      const S = batcher();
      for (let x = a + 0.15; x < b; x += PITCH) {
        if (Math.abs(x - 6.55) < 0.12 || Math.abs(x - 9.45) < 0.12) continue;
        S.box(P.paint, 0.035, 0.24, 0.008, x, -0.25, 0, { color: '#59636e' });
        S.put(P.paint, new THREE.TorusGeometry(0.058, 0.012, 6, 14), x, -0.3, 0, { color: '#f6f2e8' });
      }
      S.build(pivot, { cast: false });
      strapPivots.push({ pivot, phase: strapPivots.length * 1.3 });
    }
  }

  const walls = [sideWall(false, tex), sideWall(true, tex), endWall(0, 0), endWall(LEN, 1)];

  // Stand-in shadow casters for the cut-away near wall and the roof.
  const SH = batcher();
  wallBoxes(SH, P.shadow, 0, 1, '#000000');
  SH.boxMM(P.shadow, -0.2, LEN + 0.2, CEIL, CEIL + 0.1, -0.2, WID + 0.2);
  for (const x of [-0.1, LEN]) SH.boxMM(P.shadow, x, x + 0.1, 0, CEIL, 0, WID);
  for (const m of SH.build(car, { cast: true, receive: false })) m.frustumCulled = false;
  // Catenary masts flick their shadows through the car.
  shadowPole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7, 0.22), P.shadow);
  shadowPole.castShadow = true;
  shadowPole.position.set(0, 2, -2.6);
  car.add(shadowPole);

  for (const c of [[X0 - 0.2, X0 - 0.05, Z0, Z0 + WID], [X0 + LEN + 0.05, X0 + LEN + 0.2, Z0, Z0 + WID], [X0, X0 + LEN, Z0 - 0.2, Z0 - 0.05], [X0, X0 + LEN, Z0 + WID + 0.05, Z0 + WID + 0.2]]) {
    G.colliders.push({ minX: c[0], maxX: c[1], minZ: c[2], maxZ: c[3] });
  }
  pointLight(0xfff0dc, 2.6, 10, X0 + 5, 2.2, Z0 + 1.6, { day: 2.6 });
  pointLight(0xfff0dc, 2.6, 10, X0 + 11, 2.2, Z0 + 1.6, { day: 2.6 });

  registerInterior({
    id: 'incheon-train', city: 'incheon', category: 'train',
    bounds: { minX: X0, maxX: X0 + LEN, minZ: Z0, maxZ: Z0 + WID, minY: -0.25, maxY: 2.6 },
    ceilingAt: () => CEIL - 0.05,
    floorY: 0, center: [X0 + LEN / 2, 0, Z0 + WID / 2], door: [X0 + LEN / 2, 0, Z0], walls, roofs: [], furniture: [], occluders: [],
  });
}

/** The rest of the train, the bridge it is crossing, the river and the far bank. */
function buildOutside() {
  const out = new THREE.Group();
  out.position.set(X0, 0, Z0);
  G.scene.add(out);
  const B = batcher();
  for (const x0 of [-16.6, LEN + 0.6]) {
    B.boxMM(P.paint, x0, x0 + 16, -0.02, 2.62, -0.12, WID + 0.12, { color: '#eef1f3' });
    B.boxMM(P.paint, x0, x0 + 16, 0.22, 0.44, -0.13, WID + 0.13, { color: '#1d63b8' });
    B.boxMM(P.paint, x0, x0 + 16, 0.46, 0.52, -0.13, WID + 0.13, { color: '#f08a24' });
    B.boxMM(P.metal, x0 + 0.5, x0 + 15.5, 1.05, 1.95, -0.13, WID + 0.13, { color: '#2c3944' });
    for (const [a, b] of DOORS) B.boxMM(P.paint, x0 + a, x0 + b, 0.02, 2.0, -0.135, WID + 0.135, { color: '#dfe4e8' });
    for (const [a, b] of DOORS) B.boxMM(P.metal, x0 + a + 0.12, x0 + b - 0.12, 0.95, 1.72, -0.14, WID + 0.14, { color: '#2c3944' });
    for (const ax of [3, 11]) B.boxMM(P.paint, x0 + ax, x0 + ax + 2.4, 2.62, 2.86, 0.6, WID - 0.6, { color: '#cfd5da' });
    B.boxMM(P.paint, x0, x0 + 16, -0.8, -0.02, 0.05, WID - 0.05, { color: '#3a4048' });
  }
  for (const x0 of [-0.6, LEN]) B.boxMM(P.paint, x0, x0 + 0.6, -0.1, 2.2, 0.85, WID - 0.85, { color: '#2b2f36' });
  // bridge deck
  B.boxMM(P.paint, -60, 76, -1.7, -1.0, -4.6, 4.2, { color: '#b9b2a6' });
  for (const x of [-40, -8, 24, 56]) B.boxMM(P.paint, x - 1.5, x + 1.5, -9, -1.7, -3.4, 3.0, { color: '#a59c90' });
  B.build(out, { cast: false });

  const basic = (map, o = {}) => new THREE.MeshBasicMaterial({ map, fog: false, ...o });
  const flat = (w, d, m, y, zc = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2;
    p.position.set(LEN / 2, y, zc);
    out.add(p);
    return p;
  };
  const deck = deckTexture();
  flat(136, 8.8, basic(deck), -0.99, -0.2);
  scrollers.push({ tex: deck, rate: SPEED / 4 });
  const river = riverTexture();
  flat(1400, 340, basic(river), -9, WID / 2);
  scrollers.push({ tex: river, rate: SPEED / (1400 / 24) });

  // upright backdrops on both sides (the far side is what the seat camera sees)
  const layer = (texture, w, h, dist, repeat, y0 = -9) => {
    const tile = w / repeat;
    for (const far of [true, false]) {
      const t = far ? texture : texture.clone();
      t.repeat.set(repeat, 1);
      t.needsUpdate = true;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(t, { transparent: true, depthWrite: false }));
      p.position.set(LEN / 2, y0 + h / 2, far ? WID + dist : -dist);
      p.rotation.y = far ? Math.PI : 0;
      p.renderOrder = -5;
      out.add(p);
      scrollers.push({ tex: t, rate: (far ? -1 : 1) * SPEED / tile });
    }
  };
  layer(hillsTexture(), 2600, 210, 520, 2);
  layer(bankTexture(), 960, 80, 165, 3);
  layer(bridgeTexture(), 640, 10, 78, 10, -9);
  const road = paintTexture(256, 64, (g) => {
    g.fillStyle = '#8c8a86';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#f4efe2';
    for (let x = 0; x < 256; x += 64) g.fillRect(x, 30, 34, 4);
    g.fillStyle = '#d9cdb8';
    g.fillRect(0, 0, 256, 5);
    g.fillRect(0, 59, 256, 5);
  }, { repeat: true });
  road.repeat.set(40, 1);
  flat(640, 12, basic(road), -1.9, WID + 84);
  scrollers.push({ tex: road, rate: SPEED / 16 });
}

/* ── The people ──────────────────────────────────── */

const { lathe, FACE_BASE } = chibiKit;
const TORSO = [[0, 0.5], [0.2, 0.5], [0.21, 0.6], [0.2, 0.78], [0.205, 0.95], [0.215, 1.03], [0.185, 1.1], [0.1, 1.15], [0, 1.16]];
const HIPS = [[0, 0.4], [0.18, 0.4], [0.2, 0.5], [0.19, 0.6], [0, 0.6]];
const open = (pts) => pts.map(([r, y]) => [r + 0.028, y]);

/** The grandmother beside you: grey bun, cardigan, a bag of tangerines on her lap. */
export function makeGrandma() {
  const cardigan = toon('#b86f80', { side: THREE.DoubleSide });
  const slacks = toon('#5d4b66');
  const c = makeChibi({
    name: 'grandma', skin: '#f0d0b6', hair: '#cfcbc6', hairLight: 'rgba(255,255,255,0.75)', hairStyle: 'bun', expr: 'smile',
    face: { ...FACE_BASE, browStyle: 'soft', nose: 'soft', mouthShape: 'small', lid: 'hooded', iris: '#4a3428', brow: '#a39c96', eyeSize: 0.78, blush: 0.42, tilt: -0.04 },
    mats: { legs: slacks, shoes: toon('#7a5a4a'), sleeves: toon('#b86f80') },
    outfit: (ch, { body }) => {
      lathe(HIPS, slacks, body);
      lathe(TORSO, toon('#f3ead8'), body);
      lathe(open(TORSO.slice(1, 7)), cardigan, body, { phiStart: 0.42, phiLength: TAU - 0.84, ol: 0 });
    },
  });
  // the tangerines
  const bag = new THREE.Group();
  bag.position.set(0, 0.63, 0.3);
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), toon('#fff4dc', { transparent: true, opacity: 0.5, depthWrite: false }));
  sack.scale.set(1.05, 0.72, 0.9);
  bag.add(sack);
  const orange = toon('#f7941d');
  for (const [x, y, z] of [[-0.06, 0, 0.02], [0.06, -0.01, -0.02], [0, 0.0, 0.07], [0.01, 0.06, 0], [-0.03, 0.02, -0.06]]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), orange);
    o.position.set(x, y, z);
    o.castShadow = true;
    bag.add(o);
  }
  c.body.add(bag);
  c.tangerines = bag;
  c.root.scale.setScalar(0.93);
  c.armPose = () => [-0.72, -0.72];
  return c;
}

/** The student across the aisle (she turns up again in Hongdae for the creator origin). */
export function makeStudent() {
  const blazer = toon('#27304f', { side: THREE.DoubleSide });
  const c = makeChibi({
    name: 'student', skin: '#f6d6c2', hair: '#2a1c16', hairLight: 'rgba(190,150,130,0.7)', hairStyle: 'ponytail', expr: 'neutral',
    face: { ...FACE_BASE, lashes: true, browStyle: 'soft', nose: 'dot', mouthShape: 'small', lid: 'double', eyeSize: 1, blush: 0.25 },
    mats: { legs: toon('#f1dcc9'), shoes: toon('#f7f4ee'), sleeves: toon('#27304f') },
    outfit: (ch, { body }) => {
      lathe([[0, 0.36], [0.27, 0.36], [0.2, 0.6], [0, 0.6]], toon('#6f7686'), body);
      lathe(TORSO, toon('#fbfaf6'), body);
      lathe(open(TORSO.slice(1, 7)), blazer, body, { phiStart: 0.36, phiLength: TAU - 0.72, ol: 0 });
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.03), toon('#c0392b'));
      bow.position.set(0, 1.06, 0.21);
      body.add(bow);
    },
  });
  addPhone(c);
  c.armPose = () => POSES.phone();
  return c;
}

function addPhone(c) {
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, 0.014), toon('#22252b'));
  phone.position.set(0, -0.44, 0.07);
  phone.rotation.x = -0.5;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.122), new THREE.MeshBasicMaterial({ color: '#cfe8ff' }));
  screen.position.z = 0.008;
  phone.add(screen);
  c.arms[1].add(phone);
  c.phone = phone;
}

const POSES = {
  lap: () => [-0.6, -0.6],
  phone: () => [-0.35, -1.25],
  pole: () => [0.05, -1.35],
};

function board(c, x, far, kind, { standing = false, z, yaw } = {}) {
  car.add(c.root);
  c.root.position.set(x, 0, z ?? (far ? WID - 0.36 : 0.36));
  c.root.rotation.y = yaw ?? (far ? Math.PI : 0);
  c.pose = standing ? 'idle' : 'sit';
  c.armPose ??= POSES[kind === 'phone' ? 'phone' : standing ? 'pole' : 'lap'];
  if (kind === 'phone' && !c.phone) addPhone(c);
  if (kind === 'doze') {
    c.baseExpr = 'asleep';
    setExpr(c, 'asleep');
  }
  const r = { c, kind, far, next: 1 + riders.length * 0.7, headX: 0, partner: null, baseYaw: 0, phase: riders.length * 1.9 };
  riders.push(r);
  return r;
}

function buildPassengers() {
  // Fewer faces on weak devices; the two who matter always board.
  const weak = (globalThis.navigator?.hardwareConcurrency ?? 8) <= 4 || (globalThis.navigator?.deviceMemory ?? 8) <= 3;
  const grandma = makeGrandma();
  board(grandma, seatX(6), false, 'look').c.root.position.y = 0.03;
  const student = makeStudent();
  board(student, seatX(5), true, 'student');
  INCHEON.grandma = grandma;
  INCHEON.student = student;

  const list = [
    // seed, x, far side?, what they are doing, options
    [211, seatX(7), true, 'doze'],
    [347, seatX(2), true, 'chat'],
    [589, seatX(3), true, 'chat'],
    [423, seatX(9), true, 'look'],
    [118, seatX(1), false, 'phone'],
    [977, seatX(9), false, 'look'],
    [655, 3.72, true, 'window', { standing: true, z: 2.42, yaw: 0.25 }],
    [802, 12.3, true, 'phone', { standing: true, z: 2.1, yaw: Math.PI + 0.5 }],
    [266, 1.25, true, 'phone'],
    [731, seatX(10), true, 'look'],
    [154, 14.05, false, 'doze'],
    [498, 1.25, false, 'look'],
    [913, 2.0, true, 'look'],
  ].slice(0, weak ? 8 : 13);
  for (const [seed, x, far, kind, o] of list) board(makePedestrian(seed), x, far, kind, o);
  const chat = riders.filter((r) => r.kind === 'chat');
  if (chat.length === 2) {
    chat[0].partner = chat[1];
    chat[1].partner = chat[0];
    chat[0].baseYaw = 0.75; // far bench faces −z, so +x is to their right
    chat[1].baseYaw = -0.75;
    for (const r of chat) r.c.baseExpr = 'smile';
  }
  INCHEON.passengers = riders.map(({ c, kind }) => ({ c, kind }));
}

/**
 * Per frame while S.city === 'incheon': scenery, sway, straps, LED and every passenger.
 * It animates the grandmother and the student too; set `c.idle = false` on either to
 * stop their idle head turns while a scene directs them.
 */
export function updateTrain(dt, t) {
  if (!car) return;
  for (const s of scrollers) s.tex.offset.x = (s.tex.offset.x + s.rate * dt) % 1;
  const sway = Math.sin(t * 1.3) * 0.5 + Math.sin(t * 2.9 + 1) * 0.3;
  car.rotation.x = sway * 0.004;
  car.position.y = Math.sin(t * 7.3) * 0.0025;
  for (const s of strapPivots) s.pivot.rotation.x = Math.sin(t * 1.7 + s.phase) * 0.1 + sway * 0.05;
  shadowPole.position.x = 34 - ((t * SPEED) % 64);
  const frame = Math.floor(t / 1.8) % 3;
  if (frame !== ledFrame) {
    ledFrame = frame;
    led.userData.redraw();
  }

  for (const r of riders) {
    const c = r.c;
    const directed = c.idle === false;
    let headX = 0;
    r.next -= dt;
    if (r.kind === 'doze') {
      headX = 0.4 + Math.sin(t * 0.8 + r.phase) * 0.05 + (r.next < 0.25 ? -0.3 : 0);
      if (r.next < 0) r.next = 5 + Math.random() * 6;
    } else if (r.kind === 'phone' || r.kind === 'student') {
      const up = r.next < 1.4; // looks up now and then
      headX = up ? 0 : 0.34;
      if (!directed) c.lookYaw = up ? r.glance ?? 0 : 0;
      if (r.next < 0) {
        r.next = (r.kind === 'student' ? 3.5 : 6) + Math.random() * 6;
        r.glance = r.kind === 'student' ? 0 : (Math.random() - 0.5) * 1.6;
      }
      if (directed) headX = 0;
    } else if (r.kind === 'chat') {
      c.lookYaw = r.baseYaw;
      if (r.next < 0) {
        r.next = 2.2 + Math.random() * 2;
        const who = Math.random() < 0.5 ? r : r.partner;
        who.c.talkT = 1.6;
        r.partner.next = r.next;
        if (Math.random() < 0.3) setExpr(r.partner.c, 'laugh', 1.4);
      }
    } else if (!directed && r.next < 0) {
      r.next = 3 + Math.random() * 5;
      c.lookYaw = [0, 0, 0.8, -0.8, 0.35, -0.35][Math.floor(Math.random() * 6)];
    }
    r.headX += (headX - r.headX) * damp(5, dt);
    c.head.rotation.x = r.headX;
    animate(c, dt, t, 0);
  }
}

function build() {
  materials();
  buildCar();
  buildOutside();
  buildPassengers();
}

export default {
  id: 'incheon', name: 'Airport Railroad', nativeName: '공항철도',
  subtitle: 'The airport train into Seoul. Day one only.',
  hidden: true,
  bounds, spawn: INCHEON.spawn, yaw: Math.PI, places: [],
  home: null,
  vistas: [],
  airport: { spawn: INCHEON.spawn, name: 'Airport Railroad', nativeName: '공항철도' },
  roads: [],
  mapFeatures: [
    { type: 'block', points: [[X0, Z0], [X0 + LEN, Z0], [X0 + LEN, Z0 + WID], [X0, Z0 + WID]], color: '#8b97a3' },
  ],
  build,
  heightAt: () => 0,
  zoneAt: () => ({ id: 'incheon-train', indoor: true }),
};

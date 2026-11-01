// Day 1's opening level (docs/seoul-day1.md): Incheon arrivals and the airport
// railway. Hidden from flights and the subway; you only pass through it once.
// Hall (−x) → the 입구 / 출구 doors → the concourse with the departure board →
// ticket gates → the platform. A train car further north hosts the ride in.
import * as THREE from 'three';
import { G, add as addW, box as boxW, boxMM as boxMMW, mat, textTexture, nightGlow, pointLight as pointLightW } from '../util.js';
import { registerInterior } from '../interiors.js';

// Every city shares one world space; Incheon sits west of Seoul (−62…62), clear of
// Tokyo (x 340…460) and Shanghai (x 725…875). Local x is authored around 0.
const X0 = -400;
const box = (w, h, d, m, x, y, z, o) => boxW(w, h, d, m, X0 + x, y, z, o);
const boxMM = (a, b, y0, y1, c, d, m, o) => boxMMW(X0 + a, X0 + b, y0, y1, c, d, m, o);
const add = (g, m, x, y, z, parent, shadows) => addW(g, m, X0 + x, y, z, parent, shadows);
const pointLight = (color, i, dist, x, y, z, o) => pointLightW(color, i, dist, X0 + x, y, z, o);
const bounds = { minX: X0 - 22, maxX: X0 + 24, minZ: -10, maxZ: 25 };
const H = 6; // terminal ceiling
export const INCHEON = {
  spawn: [X0 - 16, 0, 0],
  exitDoor: new THREE.Vector3(X0 - 2, 0, 4),
  board: new THREE.Vector3(X0 + 10.6, 0, 0),
  seat: [X0 + 7, 0, 21.85],
};

let M;
let exitGlass = null, exitCollider = null;

function sign(text, sub, x, y, z, yaw, w, h, bg = '#1f4f8f', fg = '#ffffff') {
  const lines = [[text, sub ? 150 : 190, fg, sub ? 150 : 200, 'Jua']];
  if (sub) lines.push([sub, 70, '#d9e6f5', 300, 'Gowun Dodum']);
  const tex = textTexture(lines, 1024, 400, { bg, radius: 24 });
  const m = nightGlow(mat(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffffff, side: THREE.DoubleSide }), 0.35, 0.9);
  const mesh = add(new THREE.PlaneGeometry(w, h), m, x, y, z, G.scene, false);
  mesh.rotation.y = yaw;
  return mesh;
}

function departureBoard() {
  const tex = textTexture([
    ['출발', 96, '#ffd34d', 70, 'Jua'],
    ['직통 · 서울역 · 13:30 · 1', 78, '#ffffff', 210, 'Gowun Dodum'],
    ['일반 · 서울역 · 13:32 · 2', 78, '#ffffff', 330, 'Gowun Dodum'],
  ], 1024, 420, { bg: '#10151c', radius: 12 });
  const m = nightGlow(mat(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffffff }), 0.6, 1);
  const x = INCHEON.board.x - X0, z = INCHEON.board.z;
  const face = add(new THREE.PlaneGeometry(3.6, 1.48), m, x + 0.62, 2.55, z, G.scene, false);
  face.rotation.y = -Math.PI / 2;
  box(0.18, 1.7, 3.9, M.metal, x + 0.72, 1.7, z, { block: true });
  for (const dz of [-1.6, 1.6]) box(0.12, 1.75, 0.12, M.metal, x + 0.72, 0, z + dz, { collide: true });
}

function suitcase(x, z, color, yaw = 0) {
  const s = box(0.42, 0.6, 0.26, mat(color, { roughness: 0.5 }), x, 0.5, z);
  s.rotation.y = yaw;
}

function terminal() {
  const walls = [], roofs = [];
  const wall = (minX, maxX, minZ, maxZ, y0 = 0, y1 = H) => {
    const m = boxMM(minX, maxX, y0, y1, minZ, maxZ, M.wall, { collide: y0 < 1, block: true });
    walls.push(m);
    return m;
  };
  // Floor and outer shell.
  boxMM(-20, 22, -0.05, 0, -8, 8, M.floor, { cast: false, uv: 3 });
  wall(-20.3, -20, -8, 8);
  wall(22, 22.3, -8, 8);
  wall(-20, 22, -8.3, -8);
  wall(-20, 22, 8, 8.3);
  roofs.push(boxMM(-20.3, 22.3, H, H + 0.25, -8.3, 8.3, M.roof, { cast: false }));
  // Ceiling light strips and lights that stay on by day (it's indoors).
  for (const x of [-15, -8, 1, 8, 15]) {
    const strip = boxMM(x - 2.6, x + 2.6, H - 0.08, H - 0.02, -0.25, 0.25, M.lamp, { cast: false });
    roofs[0].attach(strip);
    pointLight(0xf4f2ea, 3.5, 14, x, H - 0.7, 0, { day: 3.5 });
  }

  // Partition with two doorways: 입구 (z −4, shut) and 출구 (z +4, opens after the sign).
  // An internal partition fades only when it is between you and the camera (interiors.js).
  for (const [a, b, y0] of [[-8, -5.2, 0], [-2.8, 2.8, 0], [5.2, 8, 0], [-5.2, -2.8, 2.9], [2.8, 5.2, 2.9]]) {
    wall(-2.15, -1.85, a, b, y0).userData.cutawayPlane = { axis: 'x', at: X0 - 2 };
  }
  boxMM(-2.05, -1.95, 0, 2.9, -5.2, -2.8, M.glass, { collide: true, cast: false });
  exitGlass = boxMM(-2.05, -1.95, 0, 2.9, 2.8, 5.2, M.glass, { collide: true, cast: false });
  exitCollider = G.colliders[G.colliders.length - 1];
  sign('입구', null, -2.25, 3.6, -4, -Math.PI / 2, 2.2, 0.86, '#2d3e52');
  sign('출구', null, -2.25, 3.6, 4, -Math.PI / 2, 2.2, 0.86, '#1f6b47');

  // Arrivals hall: belt, suitcases, 도착 and 화장실.
  box(1.4, 0.5, 10, M.belt, -13, 0, 0, { collide: true });
  box(1.5, 0.06, 10.2, M.metal, -13, 0.5, 0);
  suitcase(-13.1, -3, '#c0392b', 0.3);
  suitcase(-12.9, 1.5, '#2e4a62', -0.2);
  suitcase(-13, 3.8, '#e8c547', 0.5);
  sign('도착', 'ARRIVALS', -8, 4.4, 0, -Math.PI / 2, 3.4, 1.3);
  sign('화장실', 'RESTROOMS', -17, 3.4, -7.85, 0, 2.6, 1);
  sign('← 공항철도', 'AREX · Airport Railroad', -10, 4.2, 7.85, Math.PI, 4.2, 1.2);

  // Concourse: the way to the trains, the taxi rank and the bus doors.
  sign('공항철도 ↑', 'AREX · Airport Railroad', 3.5, 4.5, 0, -Math.PI / 2, 4.6, 1.3);
  sign('택시 · 버스', 'TAXI · BUS', 6, 3.6, 7.85, Math.PI, 3.4, 1.1, '#3f4b55');
  boxMM(4.6, 7.4, 0, 2.9, 7.8, 7.98, M.glass, { cast: false });
  departureBoard();

  // Ticket gates with walk-through gaps, then the platform screen doors and a train.
  for (const z of [-6.6, -3.6, -0.6, 2.4, 5.4]) box(0.5, 1.05, 1.6, M.gate, 16, 0, z, { collide: true });
  for (const z of [-5.1, -2.1, 0.9, 3.9]) box(0.06, 0.06, 0.9, M.amber, 16.26, 1.02, z, { cast: false });
  boxMM(19, 19.08, 0, 2.6, -7.5, 7.5, M.glass, { collide: true, cast: false });
  boxMM(19.08, 22, -0.4, 0, -8, 8, M.dark, { cast: false });
  const train = boxMM(19.4, 21.9, 0.1, 3.3, -7.6, 7.6, M.train, { block: true });
  walls.push(train);
  boxMM(19.38, 19.42, 1.2, 2.3, -7.2, 7.2, M.window, { cast: false });
  boxMM(19.38, 19.42, 0.5, 0.75, -7.6, 7.6, M.stripe, { cast: false });
  sign('일반 · 2', 'ALL-STOP · PLATFORM 2', 18.9, 3.6, -3, -Math.PI / 2, 3, 1, '#0f6db3');

  return registerInterior({
    id: 'incheon-terminal', city: 'incheon', category: 'airport',
    bounds: { minX: X0 - 20, maxX: X0 + 22, minZ: -8, maxZ: 8, minY: -0.25, maxY: H },
    ceilingAt: () => H - 0.1,
    floorY: 0, center: [X0 + 1, 0, 0], door: [X0 + 6, 0, 8], walls, roofs, furniture: [], occluders: [],
  });
}

/** The train car the player rides in on (cue 'ride'). Closed: you leave by the dialogue. */
function trainCar() {
  const walls = [], roofs = [];
  boxMM(0, 14, -0.05, 0, 20, 23.6, M.carFloor, { cast: false });
  for (const [a, b, c, d] of [[-0.2, 0, 20, 23.6], [14, 14.2, 20, 23.6], [0, 14, 19.8, 20], [0, 14, 23.6, 23.8]]) {
    walls.push(boxMM(a, b, 0, 2.6, c, d, M.carWall, { collide: true, block: true }));
  }
  roofs.push(boxMM(-0.2, 14.2, 2.6, 2.75, 19.8, 23.8, M.carWall, { cast: false }));
  for (let x = 1.2; x < 13; x += 2.4) {
    for (const z of [20.05, 23.55]) boxMM(x - 0.9, x + 0.9, 1.1, 2.0, z - 0.03, z + 0.03, M.window, { cast: false });
  }
  for (const z of [20.35, 23.25]) {
    box(13, 0.45, 0.6, M.seat, 7, 0, z, { collide: true });
    box(13, 0.55, 0.12, M.seat, 7, 0.45, z + (z < 21 ? -0.25 : 0.25));
  }
  for (let x = 2; x < 13; x += 3) add(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), M.metal, x, 1.3, 21.8, G.scene, false);
  const strip = boxMM(1, 13, 2.52, 2.58, 21.6, 22, M.lamp, { cast: false });
  roofs[0].attach(strip);
  pointLight(0xf6f3ea, 5, 10, 7, 2.3, 21.8, { day: 5 });
  registerInterior({
    id: 'incheon-train', city: 'incheon', category: 'train',
    bounds: { minX: X0, maxX: X0 + 14, minZ: 20, maxZ: 23.6, minY: -0.25, maxY: 2.6 },
    ceilingAt: () => 2.5,
    floorY: 0, center: [X0 + 7, 0, 21.8], door: [X0 + 7, 0, 20], walls, roofs, furniture: [], occluders: [],
  });
}

/** Opens the 출구 doors once the sign is read (d1_exit_done). */
export function setExitOpen(open) {
  if (!exitGlass) return;
  exitGlass.visible = !open;
  const i = G.colliders.indexOf(exitCollider);
  if (open && i >= 0) G.colliders.splice(i, 1);
  else if (!open && i < 0) G.colliders.push(exitCollider);
}

function build() {
  M = {
    floor: mat('#b9bec4', { roughness: 0.4, metalness: 0.05 }),
    wall: mat('#d8dcdf', { roughness: 0.8 }),
    roof: mat('#c9cdd1'),
    metal: mat('#59646e', { metalness: 0.5, roughness: 0.4 }),
    dark: mat('#262c33'),
    belt: mat('#2d3239', { roughness: 0.6 }),
    glass: mat('#b6d6e6', { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1 }),
    gate: mat('#7d8892', { metalness: 0.4, roughness: 0.35 }),
    amber: nightGlow(mat('#5fe08a', { emissive: '#3ad06d' }), 0.8, 1),
    train: mat('#f1f3f5', { roughness: 0.4 }),
    stripe: mat('#1d63b8'),
    window: nightGlow(mat('#9fc4d6', { emissive: '#8fbdd4', roughness: 0.1 }), 0.55, 0.3),
    lamp: nightGlow(mat('#ffffff', { emissive: '#fffbef' }), 1.2, 1.2),
    carFloor: mat('#8a9097'),
    carWall: mat('#e4e8ea'),
    seat: mat('#2f6db5', { roughness: 0.7 }),
  };
  terminal();
  trainCar();
}

export default {
  id: 'incheon', name: 'Incheon Airport', nativeName: '인천공항',
  subtitle: 'Arrivals and the airport railway. Day one only.',
  hidden: true,
  bounds, spawn: INCHEON.spawn, yaw: -Math.PI / 2, places: [],
  home: null,
  vistas: [],
  airport: { spawn: INCHEON.spawn, name: 'Incheon Airport', nativeName: '인천공항' },
  roads: [],
  mapFeatures: [
    { type: 'block', points: [[X0 - 20, -8], [X0 + 22, -8], [X0 + 22, 8], [X0 - 20, 8]], color: '#8b97a3' },
  ],
  build,
  heightAt: () => 0,
  zoneAt(x, z) {
    if (z > 19) return { id: 'incheon-train', indoor: true };
    return { id: x < X0 - 2 ? 'incheon-arrivals' : 'incheon-concourse', indoor: true };
  },
};

// Onsae Entertainment, built: the walkable shell comes from the shared
// apartment machinery (level-support.js `layout: 'agency'` + apartments.js);
// this adds what flat coloured boxes can't: the mirror, signs and posters,
// wood floors, plants and warm light. Everything added here is hung on its
// floor's cutaway (wall plane, ceiling or contents) so it hides with it.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, mat, makeCanvas, canvasTexture, roundRect, pointLight, textTexture, worldUV, damp } from './util.js';
import { wood } from './textures.js';
import { registerInterior } from './interiors.js';
import { apartments, buildApartment } from './apartments.js';
import { dramaPosterTexture } from './set-dressing.js';
import { ONSAE, FLOOR_Y, MOUNTS, roomBDoor } from './onsae.js';

const STYLE = {
  plaster: '#f3e4d0', trim: '#2c2a45', wood: '#a9744c', floor: '#c49a6c', accent: '#c9836a', stone: '#d3c9bb', linen: '#fff1dc', dark: '#34303a',
  glass: '#bfd8d6', roof: '#3b3650', white: '#f4f1ea', green: '#5d8a3c', bulb: '#ffe2a8', panel: '#fff3dc', gold: '#e0b24a', black: '#1f1f25',
  navy: '#27305c', rug: '#b45a4c', rug2: '#3f6f6c', rose: '#e8a79f', mustard: '#dba640', red: '#c9483d', blue: '#4a84c4', water: '#a9dcec',
  pot: '#d9c4a6', steel: '#b4b9bf', mirror: '#c9d6da', locker: '#6f8fa8', foam: '#454357',
};
const MATERIALS = {
  glass: { emissive: '#ffbf7a', glow: [0.05, 2.4] },
  panel: { emissive: '#ffe9c4', glow: [0.7, 1.6] },
  mirror: { roughness: 0.18, metalness: 0.15, emissive: '#5d6a70', emissiveIntensity: 0.35 },
  steel: { roughness: 0.35, metalness: 0.35 },
  gold: { roughness: 0.35, metalness: 0.3, emissive: '#6a4a10', emissiveIntensity: 0.4 },
  locker: { roughness: 0.5, metalness: 0.25 },
  water: { transparent: true, opacity: 0.7, roughness: 0.2 },
};

let building = null;
let mirror = null;
let doorB = null; // { pivot, open }
const ROOM_B_DOOR = { ajar: 0.5, open: 1.45 };

/** The live mirror only renders while you can see it (연습실 A or its corridor). */
export function studioMirrorVisible(on) {
  if (mirror) mirror.visible = on && !mirror.userData.cutawayHidden;
}

/** Framed posters on the lobby's artist wall; 0 is the largest (Jin's drama). */
export const posterMeshes = [];
export function setPoster(i, texture) {
  const mesh = posterMeshes[i];
  if (!mesh || !texture) return false;
  mesh.material.map = texture;
  if (mesh.material.emissiveMap) mesh.material.emissiveMap = texture;
  mesh.material.needsUpdate = true;
  return true;
}

const onsaeBuilding = () => building ?? apartments.find((b) => b.id === ONSAE.id) ?? null;

/**
 * Hang a mesh on the building so the cutaway treats it as part of a floor:
 *   { wall: { axis: 'x' | 'z', at } }  fades with that wall plane (signs, boards, the mirror)
 *   'roof'                              hides when you are on that floor (ceiling fittings)
 *   'content'                           stays with the floor's furniture
 * Returns false when the building isn't there (node tests, other cities).
 */
export function mountOnsae(mesh, level, where = 'content', { defer = false } = {}) {
  const room = onsaeBuilding()?.rooms?.[level];
  if (!room) return false;
  if (where?.wall) {
    const { axis, at } = where.wall;
    const host = room.walls.find((m) => m.userData.cutawayPlane?.axis === axis && Math.abs(m.userData.cutawayPlane.at - at) < 0.03);
    if (host) host.attach(mesh);
    else room.occluders.push(mesh);
  } else if (where === 'roof') room.roofs.push(mesh);
  else room.occluders.push(mesh);
  mesh.userData.buildingId = ONSAE.id;
  if (!defer) registerInterior(room);
  return true;
}

/** 연습실 B's door stands ajar and swings open as someone comes up to it. */
export function updateOnsae(position, dt) {
  if (!doorB) return;
  const near = Math.abs(position.y - roomBDoor[1]) < 1 && Math.hypot(position.x - (ONSAE.x - 1.7), position.z - (ONSAE.z - 3.85)) < 1.7;
  doorB.open += ((near ? 1 : 0) - doorB.open) * damp(5, Math.max(0, dt));
  doorB.pivot.rotation.y = -(ROOM_B_DOOR.ajar + (ROOM_B_DOOR.open - ROOM_B_DOOR.ajar) * doorB.open);
}

/* ── Painted textures ─────────────────────────────── */

function paint(w, h, draw) {
  const [c, g] = makeCanvas(w, h);
  draw(g, w, h);
  return canvasTexture(c, { repeat: false });
}

function floorGuide() {
  return paint(768, 640, (g, w, h) => {
    g.fillStyle = '#23254a';
    roundRect(g, 4, 4, w - 8, h - 8, 26);
    g.fill();
    g.strokeStyle = '#e0b24a';
    g.lineWidth = 5;
    roundRect(g, 16, 16, w - 32, h - 32, 18);
    g.stroke();
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#e0b24a';
    g.font = '40px "Gowun Dodum", sans-serif';
    g.fillText('ONSAE · 층별 안내', w / 2, 74);
    const rows = [['3층', '사물함 · 보컬실 · 휴게실'], ['2층', '연습실 A · B'], ['1층', '로비']];
    rows.forEach(([floor, rooms], i) => {
      const y = 190 + i * 150;
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(48, y - 74, w - 96, 2);
      g.textAlign = 'left';
      g.fillStyle = '#ffe9a8';
      g.font = '92px Jua, sans-serif';
      g.fillText(floor, 60, y);
      g.fillStyle = '#ffffff';
      g.font = '50px "Gowun Dodum", sans-serif';
      g.fillText(rooms, 240, y + 4);
    });
  });
}

function artistPoster(i) {
  const looks = [['#f3b8a4', '#7a3550', 'ONSAE GIRLS'], ['#a9cbe8', '#2c3f7a', 'ONSAE BAND'], ['#f1d79a', '#8a4a2a', 'ONSAE ACTORS'], ['#c7b3ea', '#3d2a6b', 'ONSAE TRAINEES']];
  const [a, b, label] = looks[i % looks.length];
  return paint(384, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, a);
    bg.addColorStop(1, b);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // Head-and-shoulders silhouettes: a group shot seen from across the lobby.
    g.fillStyle = 'rgba(20,16,40,0.55)';
    const n = [5, 4, 2, 6][i % 4];
    for (let k = 0; k < n; k++) {
      const cx = w * (0.5 + (k - (n - 1) / 2) * (0.62 / n) * 1.3);
      const cy = h * (0.5 - (k % 2) * 0.05);
      g.beginPath();
      g.arc(cx, cy, w * 0.07, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(cx, cy + w * 0.26, w * 0.11, w * 0.2, 0, Math.PI, 0);
      g.fill();
    }
    g.fillStyle = 'rgba(20,16,40,0.6)';
    g.fillRect(0, h * 0.78, w, h * 0.22);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.font = '44px Jua, sans-serif';
    g.fillText(label, w / 2, h * 0.86);
    g.fillStyle = '#ffe2b0';
    g.font = '24px "Gowun Dodum", sans-serif';
    g.fillText('온새 엔터테인먼트', w / 2, h * 0.94);
  });
}

function noticeboard() {
  return paint(640, 448, (g, w, h) => {
    g.fillStyle = '#8a5a34';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c99a62';
    g.fillRect(14, 14, w - 28, h - 28);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${90 + (i * 37) % 60},${60 + (i * 17) % 40},30,0.16)`;
      g.fillRect(14 + (i * 97) % (w - 30), 14 + (i * 61) % (h - 30), 3, 3);
    }
    const note = (x, y, nw, nh, tilt, bg, lines, pin) => {
      g.save();
      g.translate(x + nw / 2, y + nh / 2);
      g.rotate(tilt);
      g.shadowColor = 'rgba(0,0,0,0.3)';
      g.shadowBlur = 8;
      g.shadowOffsetY = 3;
      g.fillStyle = bg;
      g.fillRect(-nw / 2, -nh / 2, nw, nh);
      g.shadowColor = 'transparent';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      lines.forEach(([text, size, color], k) => {
        g.fillStyle = color;
        g.font = `${size}px ${k ? '"Gowun Dodum"' : 'Jua'}, sans-serif`;
        g.fillText(text, 0, -nh / 2 + (k + 0.75) * (nh / (lines.length + 0.5)));
      });
      g.fillStyle = pin;
      g.beginPath();
      g.arc(0, -nh / 2 + 12, 8, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    note(40, 44, 230, 150, -0.04, '#fff8e6', [['청소 당번', 40, '#2b3a8a'], ['월 A실 · 수 B실', 26, '#444'], ['금 휴게실', 26, '#444']], '#d0453a');
    note(310, 36, 280, 120, 0.03, '#ffe1e6', [['보컬실 예약', 40, '#b3445e'], ['이름 쓰고 30분씩', 26, '#444']], '#3f7fbf');
    note(60, 236, 210, 160, 0.05, '#e3f1ff', [['분실물', 40, '#27508a'], ['물병 · 수건', 28, '#444'], ['→ 로비 데스크', 24, '#444']], '#e0b24a');
    note(320, 200, 260, 190, -0.03, '#fff3a8', [['우리는 한 팀', 44, '#8a4a10'], ['화이팅!', 52, '#c0392b']], '#d0453a');
  });
}

/* ── Build ────────────────────────────────────────── */

/**
 * @param {object} deps
 * @param {(tex, w, h, x, y, z) => THREE.Mesh} deps.fascia  world.js's lit shop fascia, facing +z
 */
export function buildOnsae({ fascia } = {}) {
  building = buildApartment({ ...ONSAE, style: STYLE, materials: MATERIALS });
  const { x: X, z: Z, w, d } = ONSAE;
  const front = Z + d / 2, back = Z - d / 2, east = X + w / 2, divider = X - 1.7, partition = X + 0.3;
  const deferred = { defer: true };
  const plane = (tex, pw, ph, [px, py, pz], yaw, level, where, opts = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat(0xffffff, { map: tex, roughness: 0.6, ...opts }));
    m.position.set(px, py, pz);
    m.rotation.y = yaw;
    m.receiveShadow = true;
    G.scene.add(m);
    mountOnsae(m, level, where, deferred);
    return m;
  };
  const merged = (geos, material, level, where = 'content', shadows = false) => {
    const m = new THREE.Mesh(mergeGeometries(geos), material);
    m.castShadow = shadows;
    m.receiveShadow = true;
    G.scene.add(m);
    mountOnsae(m, level, where, deferred);
    return m;
  };
  const wallX = (at) => ({ wall: { axis: 'x', at } });
  const wallZ = (at) => ({ wall: { axis: 'z', at } });
  const E = Math.PI / 2, W = -Math.PI / 2;

  // Wood floors, one merged sheet per floor and tone, laid just over the slabs.
  const tone = (t, extra = {}) => mat(0xffffff, { map: t.map, normalMap: t.normalMap, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });
  const warmWood = tone(wood('#b98a58')), paleWood = tone(wood('#dcb886'));
  const sheet = (u0, u1, v0, v1, y) => {
    const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0);
    g.rotateX(-Math.PI / 2);
    g.translate(X + (u0 + u1) / 2, y + 0.046, Z + (v0 + v1) / 2);
    return worldUV(g, 2.4);
  };
  merged([sheet(-6.9, 6.9, -5.9, 5.9, FLOOR_Y[0])], warmWood, 0);
  // Upstairs the sheets leave the stairwell (u −6.55…−1.95, v −1.8…2.2) open.
  for (const level of [1, 2]) {
    const y = FLOOR_Y[level];
    const hall = [sheet(-6.9, -6.55, -1.8, 2.2, y), sheet(-6.9, -1.7, 2.2, 5.9, y), sheet(-1.95, -1.7, -1.8, 2.2, y), sheet(-1.7, 0.3, -5.9, 5.9, y)];
    const rooms = [sheet(0.3, 6.9, -5.9, 5.9, y), sheet(-6.9, -1.7, -5.9, -1.8, y)];
    if (level === 1) { merged(hall, warmWood, level); merged(rooms, paleWood, level); } else merged([...hall, ...rooms], warmWood, level);
  }

  // Plants: the pots are in the plan; the leaves are one merged mesh per floor.
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4f8a3e, flatShading: true, roughness: 0.9 });
  building.rooms.forEach((room, level) => {
    const geos = [];
    (room.plants ?? []).forEach(([px, py, pz], i) => {
      for (const [dx, dy, dz, r] of [[0, 0.32, 0, 0.34], [0.14, 0.62, 0.06, 0.26], [-0.12, 0.74, -0.08, 0.22], [0.02, 0.98, 0.02, 0.17]]) {
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.rotateY(i * 1.3 + dy * 4);
        g.translate(px + dx, py + dy, pz + dz);
        geos.push(g);
      }
    });
    if (geos.length) merged(geos, leaf, level, 'content', true);
  });

  // ── 1F: the front, the artist wall, the floor guide ──
  const signTex = textTexture([['온새 엔터테인먼트', 196, '#ffe9a8', 200], ['ONSAE ENTERTAINMENT', 92, '#ffe9a8', 398, 'Gowun Dodum']], 2048, 512, { bg: '#1d1b3a', radius: 36 });
  const sign = fascia?.(signTex, 5.8, 1.0, X, FLOOR_Y[0] + 3.16, front + 0.17);
  if (sign) mountOnsae(sign, 0, wallZ(front), deferred);

  const frame = mat(0x2a2430, { roughness: 0.5 });
  const frames = [];
  const hang = (tex, u, pw, ph, glow = 0.12) => {
    const g = new THREE.BoxGeometry(pw + 0.12, ph + 0.12, 0.05);
    g.translate(X + u, FLOOR_Y[0] + 1.72, back + 0.13);
    frames.push(g);
    const m = plane(tex, pw, ph, [X + u, FLOOR_Y[0] + 1.72, back + 0.16], 0, 0, wallZ(back), { emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow });
    posterMeshes.push(m);
    return m;
  };
  hang(dramaPosterTexture(512, 768), 2.4, 1.5, 2.25, 0.3);
  [-0.15, 0.95, 3.85, 4.95].forEach((u, i) => hang(artistPoster(i), u, 0.9, 1.2));
  merged(frames, frame, 0, wallZ(back));
  const guideTex = floorGuide();
  plane(guideTex, 1.2, 1.0, MOUNTS.guide.at, E, 0, wallX(divider), { emissive: 0xffffff, emissiveMap: guideTex, emissiveIntensity: 0.22 });
  // Brass lettering behind the empty desk, and the card on it.
  const logo = textTexture([['ONSAE', 150, '#c9973a', 110], ['온새 엔터테인먼트', 58, '#8a6a3a', 220, 'Gowun Dodum']], 768, 288);
  plane(logo, 2.6, 0.98, [east - 0.115, FLOOR_Y[0] + 2.05, Z - 1.2], W, 0, wallX(east), { transparent: true });
  const away = textTexture([['잠시 자리 비움', 44, '#3a2a20', 48], ['Back soon', 28, '#7a6a5a', 98, 'Gowun Dodum']], 320, 128, { bg: '#fff6e2', border: '#c9973a' });
  plane(away, 0.36, 0.145, [X + 4.3, FLOOR_Y[0] + 1.19, Z - 1.05], W, 0, 'content');

  // ── 2F: practice rooms ──
  mirror = new Reflector(new THREE.PlaneGeometry(...MOUNTS.mirror.size), { textureWidth: 768, textureHeight: 192, color: 0xb8c4c8 });
  mirror.position.set(...MOUNTS.mirror.at);
  mirror.rotation.y = MOUNTS.mirror.yaw;
  G.scene.add(mirror);
  mountOnsae(mirror, 1, wallX(east), deferred);
  // The daily word quiz (the schedule board beside it belongs to js/eval/index.js).
  const wb = textTexture([
    ['오늘의 단어', 72, '#2b3a8a', 80],
    ['Word of the day quiz', 40, '#555', 150, 'Gowun Dodum'],
    ['떡볶이 · 커피 · 지하철 · 한강', 44, '#c0392b', 240, 'Gowun Dodum'],
  ], 768, 320, { bg: '#ffffff', border: '#9aa0a8' });
  plane(wb, 2.4, 1.0, MOUNTS.whiteboard.at, MOUNTS.whiteboard.yaw, 1, wallZ(back), { roughness: 0.3 });
  // No countdowns on screen (docs/seoul-evals-tbc.md): a cheer, not a date.
  const cheer = (lines, bg, v) => plane(textTexture(lines, 384, 512, { bg }), 0.9, 1.2, [partition + 0.09, FLOOR_Y[1] + 1.9, Z + v], E, 1, wallX(partition));
  cheer([['우리는', 64, '#fff', 180], ['한 팀!', 120, '#ffd23f', 300], ['화이팅!', 60, '#fff', 420]], '#3b2a6b', -2.6);
  cheer([['연습', 100, '#3a1a10', 200], ['또 연습', 80, '#c0392b', 330]], '#fff3dc', -4);
  const plate = (text, level, pos, yaw, where) => plane(textTexture([[text, 62, '#ffe9a8', 62]], 384, 120, { bg: '#23254a', radius: 22 }), 0.56, 0.175, pos, yaw, level, where);
  plate('연습실 A', 1, [partition - 0.09, FLOOR_Y[1] + 1.62, Z + 2.12], W, wallX(partition));
  plate('연습실 B', 1, [divider + 0.1, FLOOR_Y[1] + 1.62, Z - 3], E, wallX(divider));
  for (const level of [1, 2]) {
    plane(textTexture([[`${level + 1}F`, 150, '#2c2a45', 104]], 256, 208), 0.62, 0.5, [divider - 0.1, FLOOR_Y[level] + 1.75, Z + 5], W, level, wallX(divider), { transparent: true });
  }
  // 연습실 B: the door ajar, and the late sun lying across the floor from the west window.
  const pivot = new THREE.Group();
  pivot.position.set(divider, FLOOR_Y[1], Z - 4.4);
  const leafMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.45, 1.08), mat(STYLE.wood, { roughness: 0.7 }));
  leafMesh.position.set(0, 1.265, 0.54);
  leafMesh.castShadow = leafMesh.receiveShadow = true;
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.14), mat(STYLE.steel, { roughness: 0.35 }));
  knob.position.set(0, 1.05, 0.96);
  pivot.add(leafMesh, knob);
  pivot.rotation.y = -ROOM_B_DOOR.ajar;
  G.scene.add(pivot);
  mountOnsae(pivot, 1, 'content', deferred);
  doorB = { pivot, open: 0 };
  const sunM = new THREE.MeshBasicMaterial({ color: 0xffb76a, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const sun = (level, pts) => {
    const g = new THREE.BufferGeometry();
    const y = FLOOR_Y[level] + 0.07;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([u, v]) => [X + u, y, Z + v]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  };
  // Window on the west wall (v −5.15…−2.75) → a long skewed patch reaching toward the mirror panel.
  merged([sun(1, [[-6.6, -2.9], [-6.6, -5.0], [-3.2, -5.6], [-3.2, -3.7]]), sun(1, [[-0.9, 5.0], [-0.5, 5.0], [-0.5, 3.6], [-0.9, 3.9]])], sunM, 1);
  merged([sun(0, [[3.2, 4.9], [5.6, 4.9], [4.6, 2.2], [2.6, 2.2]])], sunM, 0);

  // ── 3F: lockers, lounge, vocal booth ──
  // The middle locker is yours, with Su-a's half-scraped name label (H0).
  const label = textTexture([['ㅅ…아', 72, '#333', 70, 'Gowun Dodum']], 256, 112, { bg: '#f3ead2' });
  plane(label, 0.34, 0.15, MOUNTS.lockerLabel.at, MOUNTS.lockerLabel.yaw, 2, 'content');
  plate('사물함', 2, [partition - 0.09, FLOOR_Y[2] + 1.62, Z + 4.22], W, wallX(partition));
  plate('휴게실', 2, [partition - 0.09, FLOOR_Y[2] + 1.62, Z - 1.48], W, wallX(partition));
  plate('보컬실', 2, [divider + 0.1, FLOOR_Y[2] + 1.62, Z - 4.72], E, wallX(divider));
  plane(noticeboard(), 1.3, 0.91, [partition - 0.09, FLOOR_Y[2] + 1.55, Z + 0.9], W, 2, wallX(partition));

  // Warm pools: on in the day too, so no room is a dark box behind its windows.
  pointLight(0xffd9a8, 9, 13, X + 2.5, FLOOR_Y[0] + 2.7, Z + 0.5, { day: 5 });
  pointLight(0xfff0dc, 9, 13, X + 3.5, FLOOR_Y[1] + 2.8, Z, { day: 5 });
  pointLight(0xffc890, 5, 8, X - 3.6, FLOOR_Y[1] + 2.5, Z - 3.6, { day: 3 });
  pointLight(0xffdcb0, 8, 13, X + 3.4, FLOOR_Y[2] + 2.7, Z + 0.3, { day: 4 });

  building.rooms.forEach(registerInterior);
  return building;
}

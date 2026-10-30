// Additive Seoul neighbourhood. buildWorld() owns the six original activities.
// North = +z; east = +x. Distances to the Han and airports are compressed links.
import * as THREE from 'three';
import { G, add, box, collider, mat, textTexture, softTexture, worldUV, nightGlow, pointLight } from '../util.js';
import { asphalt, pavers, brick, plaster, wood } from '../textures.js';
import { makeTree } from '../nature.js';

const bounds = { minX: -62, maxX: 62, minZ: -45.5, maxZ: 72 };
const airportSpawn = [-53, 0, 42];
const roads = [
  // Existing activity core, including its only terrace ascent (the stairs).
  { points: [[2, -26], [2, -8], [2, 9.5], [0, 30], [0, 36]], width: 5.5 },
  { points: [[2, -26], [5, -26], [5, -32], [5, -37.5], [-4.6, -37.5]], width: 3 },
  { points: [[-32, 9.5], [0, 9.5], [33, 9.5]], width: 4, color: '#a89a89' },
  { points: [[-29, -6], [2, -6], [30, -6]], width: 3.6, color: '#a89a89' },
  { points: [[-31, -40], [-35, -24], [-29, -6], [-32, 9.5], [-37, 25], [-26, 37]], width: 6 },
  { points: [[31, -40], [35, -25], [30, -6], [33, 9.5], [39, 24], [32, 36]], width: 6 },
  { points: [[-26, 37], [-5, 43], [1, 53], [17, 59], [30, 65]], width: 3.6, color: '#c7b397' },
  { points: [[32, 36], [22, 43], [17, 59]], width: 3.6, color: '#c7b397' },
  { points: [[-26, 37], [0, 36], [32, 36]], width: 5.5 },
  { points: [[0, 36], [-5, 43]], width: 4, color: '#c7b397' },
  { points: [[-26, 37], [-18, 48], [-8, 57], [8, 65], [24, 63], [17, 59]], width: 3.5, color: '#c7b397' },
  { points: [[-37, 25], [-50, 29], [-53, 36], [-53, 42]], width: 5 },
  // Each riverside spur returns by a different lane, rather than a dead end.
  { points: [[-31, -40], [-26, -36], [-28, -30], [-29, -6]], width: 3.2, color: '#c7b397' },
  { points: [[31, -40], [26, -36], [28, -30], [30, -6]], width: 3.2, color: '#c7b397' },
];
const parkOutline = [[-24, 43], [-12, 39], [4, 44], [24, 55], [31, 67], [14, 71], [-4, 62], [-21, 55]];
const places = [
  {
    id: 'seoul-yeonnam', ko: '연남동 숲길', en: 'Yeonnam Forest Walk', icon: '🌳',
    spawn: [1, 0, 53], yaw: Math.PI, radius: 5,
    description: 'North of Hongdae, Yeonnam follows the former Gyeongui railway. This is a shortened neighbourhood interpretation, not a street survey.',
    phrase: { text: '공원에서 산책할까요?', rom: 'Gongwoneseo sanchaek halkkayo?', en: 'Shall we take a walk in the park?' },
  },
  {
    id: 'seoul-rail-park', ko: '경의선 숲길', en: 'Gyeongui Railway Trail', icon: '🛤️',
    spawn: [-8, 0, 57], yaw: -Math.PI / 2, radius: 4,
    description: 'The old railway corridor became a linear park. The paired rail inlays remember that history; these are not active tracks.',
    phrase: { text: '이 길은 어디로 가요?', rom: 'I gireun eodiro gayo?', en: 'Where does this path go?' },
  },
  {
    id: 'seoul-busking', ko: '홍대 버스킹 마당', en: 'Hongdae Busking Corner', icon: '🎸',
    spawn: [33, 0, 9.5], yaw: -Math.PI / 2, radius: 4,
    description: 'Hongdae’s small venues, practice rooms and street performances grow around Hongik University’s creative scene.',
    phrase: { text: '공연은 몇 시에 시작해요?', rom: 'Gongyeoneun myeot sie sijakhaeyo?', en: 'What time does the performance start?' },
  },
  {
    id: 'seoul-market', ko: '동네 분식 골목', en: 'Neighbourhood Snack Lane', icon: '🥟',
    spawn: [-32, 0, 9.5], yaw: Math.PI / 2, radius: 4,
    description: 'An everyday residential backstreet: a bunsik counter, laundry, brick villas and delivery scooters, not a palace district.',
    phrase: { text: '김밥 한 줄 주세요.', rom: 'Gimbap han jul juseyo.', en: 'One roll of gimbap, please.' },
  },
  {
    id: 'seoul-han-connection', ko: '망원 한강길 · 압축 연결', en: 'Mangwon · Han River Link', icon: '🌊',
    spawn: [-31, 0, -40], yaw: 0, radius: 4,
    description: 'The Han is south of Hongdae. Mangwon Hangang Park is a longer real journey: this signed southbound lane compresses that distance. The water is not walkable.',
    phrase: { text: '한강까지 얼마나 걸려요?', rom: 'Hangangkkaji eolmana geollyeoyo?', en: 'How long does it take to get to the Han River?' },
  },
  {
    id: 'seoul-river-east', ko: '한강 전망 산책길', en: 'Riverside Pocket Promenade', icon: '🌉',
    spawn: [31, 0, -40], yaw: 0, radius: 4,
    description: 'A scenic compressed river connection, separate from the original elevated lookout. Namsan is a distant eastern skyline landmark, not the opposite riverbank.',
    phrase: { text: '야경이 정말 예뻐요.', rom: 'Yagyeongi jeongmal yeppeoyo.', en: 'The night view is really beautiful.' },
  },
  {
    id: 'seoul-travel-board', ko: '서울 동네 안내', en: 'Seoul Neighbourhood Board', icon: '🗺️',
    spawn: [4, 0, 35], yaw: Math.PI, radius: 4,
    description: 'The existing Seoul concept artwork is displayed as artwork, not a literal map. North: Yeonnam; south: a compressed Han connection; west: AREX airport transfer.',
    phrase: { text: '지도를 볼 수 있을까요?', rom: 'Jidoreul bol su isseulkkayo?', en: 'Could I look at the map?' },
  },
  {
    id: 'seoul-airport-link', ko: '공항철도 연결 광장', en: 'AREX Airport Connection', icon: '✈️',
    spawn: airportSpawn, yaw: Math.PI, radius: 5,
    description: 'A compressed transfer plaza for Gimpo and Incheon via the Airport Railroad. Neither airport is in downtown Hongdae; flight selection is handled by the travel runtime.',
    phrase: { text: '공항철도는 어디서 타요?', rom: 'Gonghangcheoldoneun eodiseo tayo?', en: 'Where do I take the Airport Railroad?' },
  },
];

const surface = (texture, opts = {}) => mat(0xffffff, { map: texture.map, normalMap: texture.normalMap, ...opts });
let M;

function sign(lines, x, y, z, yaw, w = 3.8, h = 1, bg = '#254742') {
  const tex = textTexture(lines.map((line, i) => {
    const units = [...line].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? 0.58 : 1), 0);
    return [line, Math.min(i ? 64 : 112, Math.floor(1360 / units)), i ? '#e4d8ba' : '#fff9df', i ? 290 : 130, i ? 'Gowun Dodum' : 'Jua'];
  }), 1536, 400, { bg, border: '#a5b39a' });
  const material = nightGlow(mat(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffffff, side: THREE.DoubleSide }), 0.08, 0.85);
  const mesh = add(new THREE.PlaneGeometry(w, h), material, x, y, z, G.scene, false);
  mesh.rotation.y = yaw;
  return mesh;
}

function standingSign(lines, x, y, z, yaw, w = 3.8, h = 1) {
  sign(lines, x, y, z, yaw, w, h);
  for (const offset of [-w / 2 + 0.18, w / 2 - 0.18]) {
    box(0.07, y + h / 2, 0.07, M.metal,
      x + Math.cos(yaw) * offset, 0, z - Math.sin(yaw) * offset, { collide: true });
  }
}

function polygon(points, material, y) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const mesh = add(new THREE.ShapeGeometry(shape), material, 0, y, 0, G.scene, false);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function street(points, width, material) {
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az);
    const curb = box(width + 0.7, 0.025, length, M.pavers, (ax + bx) / 2, -0.01, (az + bz) / 2, { cast: false, uv: 2 });
    const mesh = box(width, 0.025, length, material, (ax + bx) / 2, 0.005, (az + bz) / 2, { cast: false, uv: 3 });
    curb.rotation.y = mesh.rotation.y = Math.atan2(bx - ax, bz - az);
  }
  // Rounded junctions seal acute turns instead of leaving triangular gaps.
  for (const [x, z] of points) {
    const geometry = new THREE.CircleGeometry(width / 2, 20);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(x, 0, z);
    worldUV(geometry, 3);
    add(geometry, material, 0, 0.032, 0, G.scene, false);
  }
}

function lamp(x, z, cool = false, real = false) {
  box(0.1, 3.9, 0.1, M.metal, x, 0, z);
  box(0.55, 0.12, 0.55, M.metal, x, 3.9, z);
  box(0.4, 0.05, 0.4, cool ? M.cool : M.warm, x, 3.86, z, { cast: false });
  collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
  if (real) pointLight(cool ? 0xc2e9ec : 0xffc58b, 7, 13, x, 3.6, z);
  // Soft ground pools make the whole route readable without dozens of lights.
  const glow = new THREE.MeshBasicMaterial({ map: M.pool, color: cool ? '#c1ecec' : '#ffcc8f', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  G.nightMats.push({ m: glow, day: 0, night: 0.3, prop: 'opacity' });
  const pool = add(new THREE.CircleGeometry(3.6, 20), glow, x, 0.07, z, G.scene, false);
  pool.rotation.x = -Math.PI / 2;
}

function tree(x, z, scale = 1, gold = false) {
  makeTree({ x, z, scale, kind: 'ginkgo', seed: Math.round(x * 71 + z * 31) });
}

function bench(x, z, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  G.scene.add(group);
  box(1.9, 0.09, 0.48, M.wood, 0, 0.44, 0, { parent: group });
  box(1.9, 0.45, 0.08, M.wood, 0, 0.52, -0.22, { parent: group });
  for (const dx of [-0.75, 0.75]) box(0.08, 0.44, 0.45, M.metal, dx, 0, 0, { parent: group });
  // All authored benches use 0 or pi, so their world footprint stays axial.
  collider(x - 1, x + 1, z - 0.3, z + 0.3);
}

function building(x, z, w, d, h, material, yaw, title, subtitle, accent = '#385a59', variant = 0) {
  box(w, h, d, material, x, 0, z, { collide: true, block: true, uv: 2 });
  box(w + 0.25, 0.25, d + 0.25, M.roof, x, h, z, { block: true });
  // Front is +z in local space; rotate only the facade, not its collision box.
  const frontDepth = Math.abs(Math.cos(yaw)) > 0.5 ? d / 2 : w / 2;
  const frontWidth = Math.abs(Math.cos(yaw)) > 0.5 ? w : d;
  const fx = x + Math.sin(yaw) * (frontDepth + 0.03);
  const fz = z + Math.cos(yaw) * (frontDepth + 0.03);
  const group = new THREE.Group();
  group.position.set(fx, 0, fz);
  group.rotation.y = yaw;
  G.scene.add(group);
  box(frontWidth - 0.5, 2.35, 0.08, M.shop, 0, 0.15, 0, { parent: group, cast: false });
  for (let u = -frontWidth / 2 + 0.7; u < frontWidth / 2; u += 1.8) {
    box(0.06, 2.35, 0.13, M.metal, u, 0.15, 0.07, { parent: group });
  }
  // Four-sided villa windows: turning a corner should not reveal blank cubes.
  // Batch panes/frames per block to avoid hundreds of extra draw calls.
  const panes = [[], []], frames = [], tmp = new THREE.Object3D();
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2, s = Math.sin(angle), c = Math.cos(angle);
    const depth = side % 2 ? w / 2 : d / 2, width = side % 2 ? d : w;
    for (let floor = 3.9; floor < h - 1; floor += 2.8) {
      for (let u = -width / 2 + 1.3; u < width / 2 - 0.6; u += 2.4) {
        tmp.rotation.y = angle;
        tmp.position.set(x + c * u + s * (depth + 0.025), floor + 0.775, z - s * u + c * (depth + 0.025));
        tmp.updateMatrix(); frames.push(tmp.matrix.clone());
        tmp.position.x += s * 0.06; tmp.position.z += c * 0.06;
        tmp.updateMatrix();
        const lit = (Math.round(u * 10) + Math.round(floor * 10) + side + variant) % 3 !== 0;
        panes[lit ? 0 : 1].push(tmp.matrix.clone());
      }
    }
  }
  for (const [matrices, geometry, material] of [
    [frames, new THREE.BoxGeometry(1.25, 1.55, 0.1), M.trim],
    [panes[0], new THREE.BoxGeometry(1.07, 1.35, 0.12), M.window],
    [panes[1], new THREE.BoxGeometry(1.07, 1.35, 0.12), M.unlit],
  ]) {
    const windows = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => windows.setMatrixAt(i, matrix));
    G.scene.add(windows);
  }
  box(frontWidth + 0.3, 0.15, 0.85, mat(accent), 0, 2.9, 0.3, { parent: group });
  sign([title, subtitle], fx + Math.sin(yaw) * 0.12, 3.2, fz + Math.cos(yaw) * 0.12, yaw, Math.min(frontWidth - 0.5, 6.5), 0.85, accent);
  // Seoul villa roof rooms, air conditioning and water tanks, not skyscrapers.
  box(2.3, 1.7, 2.4, M.concrete, x - w * 0.2, h + 0.25, z + d * 0.15, { block: true });
  if (variant % 2 === 0) {
    add(new THREE.CylinderGeometry(0.65, 0.65, 1.2, 12), M.tank, x + w * 0.22, h + 0.85, z - d * 0.2);
  } else {
    box(1.3, 0.65, 0.7, M.trim, x + w * 0.22, h + 0.25, z - d * 0.2);
  }
}

function neighbourhood() {
  const north = 0, south = Math.PI, east = Math.PI / 2, west = -Math.PI / 2;
  // Hand-placed irregular blocks leave both cross-streets and outer loops open.
  const blocks = [
    [20.5, 2.5, 9, 5, 9, M.red, north, '레코드 골목', 'VINYL · independent music', '#64495c'],
    [21.5, 18.5, 11, 9, 12, M.cream, west, '소리 작업실', 'MUSIC WORKSHOP', '#384d68'],
    [21, 28.5, 10, 5, 7, M.grey, north, '책방 느린', 'BOOKS & ZINES', '#466052'],
    [44, 1.5, 10, 9, 10, M.cream, west, '동네 세탁', 'LAUNDRY', '#557987'],
    [49.5, 19.5, 11, 11, 14, M.red, west, '홍대 라이브', 'LIVE CLUB · B1', '#704053'],
    [41.5, 43, 11, 8, 8, M.grey, west, '연남 공방', 'CRAFT STUDIO', '#8e6149'],
    [42.5, 57.5, 11, 9, 11, M.cream, west, '골목 사진관', 'NEIGHBOURHOOD PHOTO', '#4e6773'],
    [-20.5, 2.5, 9, 5, 8, M.cream, north, '모퉁이 분식', 'GIMBAP · TTEOKBOKKI', '#a04b38'],
    [-21.5, 19, 11, 10, 11, M.red, east, '연희 빌라', 'YEONHUI VILLA', '#536255'],
    [-21, 29.5, 10, 5, 8, M.grey, north, '오래된 문구점', 'STATIONERY', '#8b6046'],
    [-47.5, 8, 9, 16, 12, M.red, east, '동네 수선', 'REPAIR · ALTERATIONS', '#65634d'],
    [-44, -17.5, 8, 15, 10, M.cream, east, '망원 빌라', 'RESIDENTIAL LANE', '#6c6b61'],
    [-44, -34.5, 8, 9, 8, M.red, east, '한강 자전거', 'BICYCLE REPAIR', '#386768'],
    [47, -18.5, 12, 13, 11, M.grey, west, '인쇄소', 'PRINT WORKSHOP', '#42586c'],
    [47, -35, 12, 8, 9, M.cream, west, '강변 찻집', 'RIVERSIDE TEA', '#64744d'],
  ];
  blocks.forEach((args, i) => building(...args, i));

  // A busking pocket off the through route: stage and equipment do not block it.
  box(4.8, 0.18, 3.2, M.wood, 38, 0, 7, { collide: true });
  for (const x of [36.1, 39.9]) box(0.55, 1.1, 0.55, M.metal, x, 0.18, 6.3, { block: true });
  sign(['오늘도 음악', 'HONGDAE · street stage'], 38, 2.4, 5.5, 0, 4.6, 1.1, '#6c3f56');
  lamp(35.5, 5, false, true);
  // Low stools, delivery crates and a parked scooter sit beside, not in, lanes.
  for (const x of [-24, -22]) box(0.75, 0.55, 0.65, M.crate, x, 0, 6.5, { collide: true });
  box(0.6, 0.55, 1.5, M.scooter, -39, 0.35, 17, { collide: true });
  box(0.55, 0.12, 0.8, M.metal, -39, 0.9, 17);
  for (const z of [16.5, 17.5]) {
    const wheel = add(new THREE.CylinderGeometry(0.27, 0.27, 0.14, 12), M.metal, -39, 0.27, z);
    wheel.rotation.z = Math.PI / 2;
  }
  standingSign(['연남동 ↑    한강 ↓', 'NORTH: YEONNAM · SOUTH: HAN LINK'], -14, 3, 10.9, Math.PI, 4.3, 1);
  standingSign(['공항철도 연결 ↖', 'AREX · Gimpo / Incheon transfer'], -34, 3, 27.5, Math.PI, 4.5, 1);
}

function park() {
  polygon(parkOutline, M.grass, -0.002);
  // Paths are laid on top of this polygon by build(), preserving visible loops.
  for (const [x, z, s, gold] of [
    [-22, 48, 1, true], [-17, 53, 0.9, false], [-11, 61, 1.1, true],
    [-4, 65, 1, false], [6, 69, 0.9, true], [16, 68.5, 1, false],
    [26, 59, 1, true], [11, 54, 0.9, false], [-11, 46, 1, true],
    [4, 47, 0.9, false], [21, 49, 1, true],
  ]) tree(x, z, s, gold);
  for (const [x, z] of [[-17, 44], [-4, 59], [11, 61], [21, 67]]) bench(x, z);
  // Short rail fragments set flush into the old railway path.
  for (const [a, b] of [[[-18, 48], [-8, 57]], [[-8, 57], [8, 65]]]) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    for (const side of [-0.58, 0.58]) {
      const rail = box(0.045, 0.025, len, M.rail, (a[0] + b[0]) / 2 + side * dz / len, 0.04, (a[1] + b[1]) / 2 - side * dx / len, { cast: false });
      rail.rotation.y = Math.atan2(dx, dz);
    }
    for (let t = 1; t < len; t += 1.4) {
      const sleeper = box(1.6, 0.022, 0.16, M.wood, a[0] + dx * t / len, 0.035, a[1] + dz * t / len, { cast: false });
      sleeper.rotation.y = Math.atan2(dx, dz);
    }
  }
  standingSign(['경의선 숲길 · 연남동', 'Former railway → neighbourhood park'], 1, 2.4, 56, Math.PI, 5.4, 1.25);
  for (const [x, z] of [[-20, 49], [-6, 50], [8, 62], [24, 65]]) lamp(x, z, false, x === -6 || x === 24);
}

function airport() {
  box(18, 0.06, 16, M.pavers, -51, -0.02, 41, { cast: false });
  building(-53, 51, 14, 9, 5.5, M.concrete, Math.PI, '공항철도 · AREX', 'GIMPO / INCHEON · TRANSFER', '#255c78', 2);
  // Open-sided shelter with no invisible wall across the arrival/flight spawn.
  box(12, 0.18, 5, M.roof, -53, 3.5, 43, { block: true });
  for (const x of [-58.5, -47.5]) box(0.14, 3.5, 0.14, M.metal, x, 0, 44, { collide: true });
  sign(['김포 · 인천 공항 연결', 'Compressed AREX link · airports are not downtown'], -53, 4.3, 40.4, Math.PI, 10.8, 1.1, '#255c78');
  // Ground tactile line leads from the road to the shelter; no airport runway.
  box(0.22, 0.02, 7, M.tactile, -51, 0.05, 40.5, { cast: false });
  bench(-46, 41, Math.PI);
  lamp(-45, 36, true, true);
  lamp(-59, 40, true);
}

function travelBoard() {
  // Reuse actual native-city static art; keep its existing AI-art watermark.
  const texture = new THREE.TextureLoader().load('/assets/locations/seoul-static.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  const art = mat(0xffffff, { map: texture, side: THREE.DoubleSide, roughness: 0.9 });
  box(2.45, 4.15, 0.24, M.wood, 7, 0.5, 39, { collide: true, block: true });
  // Front normal is -z. Keep a real 10cm stand-off from the wood's -z face
  // (38.88), rather than a nearly coplanar/embedded image at grazing angles.
  const poster = add(new THREE.PlaneGeometry(2.16, 3.84), art, 7, 2.58, 38.78, G.scene, false);
  poster.rotation.y = Math.PI;
  sign(['서울 · 동네 여행', 'Concept art · stylised, not a literal map'], 7, 5, 38.85, Math.PI, 5.5, 0.8);
  standingSign(['북: 연남   남: 한강 연결', 'N: Yeonnam · S: Han link · W: AREX'], 1, 2.3, 40, Math.PI, 5.3, 1);
  pointLight(0xffdda4, 4, 9, 7, 4.4, 37.7);
}

function riverEdges() {
  // Never let an expanded bound expose the water or the original terrace drop.
  collider(bounds.minX, bounds.maxX, -50, -45.7);
  for (const x of [-16.4, 16.4]) {
    box(0.25, 3.4, 17.6, M.concrete, x, -0.1, -36.9, { collide: true, block: true });
  }
  for (const [a, b] of [[-62, -16.5], [16.5, 62]]) {
    box(b - a, 0.5, 0.3, M.concrete, (a + b) / 2, 0, -45.6, { collide: true, block: true });
    box(b - a, 0.06, 0.1, M.metal, (a + b) / 2, 1.05, -45.6);
    for (let x = a + 1; x < b; x += 2) box(0.05, 1.05, 0.05, M.metal, x, 0, -45.6);
  }
  for (const x of [-31, 31]) {
    bench(x, -43, Math.PI);
    lamp(x + 4, -42, false, true);
    standingSign(['한강 · 압축 연결', 'Real riverside is farther south · no water access'], x, 2.6, -44.2, 0, 6.8, 1.1);
  }
  sign(['한강 전망 · 거리 압축', 'Scenic link, not literal Hongdae adjacency'], 10, 4.6, -45.65, 0, 6.3, 0.9);
  standingSign(['남산타워 · 동쪽 원경 ↗', 'PHOTO · Namsan, distant north-bank skyline'], 35, 2.2, -40, Math.PI / 2, 5.6, 1);
  // Low photo medallions identify viewpoints without putting a board in-frame.
  for (const [x, z] of [[6, -41.5], [31, -40]]) {
    const spot = add(new THREE.RingGeometry(0.6, 0.72, 32), M.warm, x, z < -41 ? 2.45 : 0.05, z, G.scene, false);
    spot.rotation.x = -Math.PI / 2;
  }
}

function surroundingBlocks() {
  // Non-playable fabric beyond the property walls avoids a floating map edge.
  // These modest villas are scenery, not extra discoverable destinations.
  box(180, 0.08, 145.5, M.ground, 0, -0.23, 27.25, { cast: false, uv: 5 });
  for (const x of [-61.9, 61.9]) box(0.24, 0.8, 117.5, M.red, x, 0, 13.25, { collide: true, block: true });
  box(124, 0.8, 0.24, M.red, 0, 0, 71.85, { collide: true, block: true });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      building(side * 77, -29 + i * 28, 13, 16, 12 + (i % 3) * 4, i % 2 ? M.grey : M.cream,
        -side * Math.PI / 2, '서울 빌라', 'RESIDENTIAL BLOCK', '#5c6c64', i);
    }
  }
  for (let i = 0; i < 4; i++) {
    building(-48 + i * 31, 88, 20, 14, 13 + (i % 3) * 4, i % 2 ? M.red : M.grey,
      Math.PI, '연남 빌라', 'RESIDENTIAL BLOCK', '#53675f', i + 1);
  }
}

function build() {
  M = {
    asphalt: surface(asphalt()), pavers: surface(pavers()), ground: surface(plaster('#aaa99c')),
    pool: softTexture('rgba(255,230,190,0.8)', 'rgba(255,200,130,0)'),
    red: surface(brick('#88574b')), cream: surface(plaster('#d6c9b2')),
    grey: surface(plaster('#9ca3a1')), concrete: surface(plaster('#a9aca4')),
    wood: surface(wood('#9a744d')), roof: mat('#484f52'), metal: mat('#354149', { metalness: 0.45 }),
    trim: mat('#ccc7b9'), grass: mat('#778961'), rail: mat('#787165', { metalness: 0.5 }),
    tank: mat('#8babbc'), crate: mat('#bc693c'), scooter: mat('#b95445'), tactile: mat('#d9b543'),
    warm: nightGlow(mat('#fff0c7', { emissive: '#ffd38d' }), 0.05, 2.8),
    cool: nightGlow(mat('#dcf3ec', { emissive: '#b9edec' }), 0.05, 2.2),
    window: nightGlow(mat('#9caaa8', { emissive: '#ffc78d', roughness: 0.35 }), 0, 0.75),
    unlit: mat('#536b78', { roughness: 0.3 }),
    shop: nightGlow(mat('#7e9a96', { emissive: '#f4d5a3', roughness: 0.4 }), 0, 0.35),
  };
  surroundingBlocks();
  // Lower than the original paving, so there is no coplanar core overlay.
  box(124, 0.08, 117.5, M.ground, 0, -0.11, 13.25, { cast: false, uv: 5 });
  park();
  roads.slice(2).forEach((road) => street(road.points, road.width, road.color ? M.pavers : M.asphalt));
  neighbourhood();
  airport();
  travelBoard();
  riverEdges();
  for (const [x, z] of [[-33, -3], [-38, -23], [-34, 20], [30, 27], [35, -21], [28, -3], [-14, 34], [18, 34]]) lamp(x, z);
  for (const [x, z] of [[-40, 23], [-31, 32], [36, 31], [28, -16], [-28, -18], [55, 30], [-55, -4]]) tree(x, z, 1, true);
}

export default {
  id: 'seoul', name: 'Seoul', nativeName: '서울',
  subtitle: 'Hongdae → Yeonnam north (+z); Han River south (−z). Stylised blocks, compressed river / AREX connections.',
  bounds, spawn: [1.6, 0, 9], yaw: 0, places,
  vistas: [
    { id: 'seoul-hangang', title: 'Hangang bridge & waterfront', nativeName: '한강 전망', spawn: [6, 2.4, -41.5], position: [10, 8, -42], look: [0, -1, -185], description: 'Elevated, unobstructed view south over the compressed Han River connection.' },
    { id: 'seoul-namsan', title: 'Namsan skyline', nativeName: '남산 서울타워', spawn: [31, 0, -40], position: [28, 7, -43], look: [420, 118, -10], description: 'The distant eastern tower and hill remain on the north bank, not across the Han.' },
  ],
  airport: { spawn: airportSpawn, name: 'AREX · Gimpo / Incheon connection', nativeName: '공항철도 · 김포 / 인천 연결' },
  roads,
  mapFeatures: [
    { type: 'park', points: parkOutline, color: '#75895d' },
    { type: 'water', points: [[-62, -46], [62, -46], [62, -58], [-62, -58]], color: '#487c91' },
    { type: 'block', points: [[-60, 46.5], [-46, 46.5], [-46, 55.5], [-60, 55.5]], color: '#7397a0' },
  ],
  build,
  heightAt: () => 0, // Runtime dispatch preserves world.js's original terrace/stairs.
  zoneAt(x, z) {
    if (x < -43 && z > 33 && z < 57) return { id: 'seoul-airport-link', indoor: false };
    if (z > 42 && x > -25 && x < 33) return { id: 'seoul-yeonnam', indoor: false };
    return null;
  },
};

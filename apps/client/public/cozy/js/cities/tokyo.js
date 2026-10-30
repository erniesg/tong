// A compressed Asakusa / Sumida walking diorama, NOT a literal street map.
// North = -z. Sensō-ji and Nakamise are west of Sumida; Skytree is east.
// Two level pedestrian bridges are the only river crossings. The southern
// terminal represents connections TO Haneda / Narita, not an Asakusa airport.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, add, box, collider, mat, textTexture, makeCanvas, canvasTexture, softTexture, nightGlow, pointLight, seeded } from '../util.js';
import { pavers, wood, tiles } from '../textures.js';
import { makeTree } from '../nature.js';
import { buildRoom, registerInterior, interiorAt } from '../interiors.js';

const CX = 400;
const JP = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic"';
const at = (x, z) => [CX + x, 0, z];
const points = (ps) => ps.map(([x, z]) => [CX + x, z]);
const road = (ps, width, color = '#b9ac94') => ({ points: points(ps), width, color });
const bounds = { minX: 340, maxX: 460, minZ: -70, maxZ: 70 };
const roads = [
  road([[-42, 56], [-42, 40], [-20, 40]], 6),
  road([[-42, 56], [-20, 56], [-20, 40]], 4),
  road([[-20, 40], [-20, -30]], 7, '#d2c6b0'), // Nakamise ceremonial axis
  road([[-43, 40], [-43, 14], [-43, -9], [-46, -18], [-43, -30], [-20, -30]], 4),
  road([[-43, 14], [-20, 14], [-1, 14], [17, 14]], 6), // Shin-Nakamise cross lane
  road([[-43, 40], [-20, 40], [-3, 40], [17, 40], [17, 36]], 8),
  road([[-1, 40], [-1, 14], [-1, -30], [-20, -30]], 4),
  road([[-20, -30], [2, -30], [17, -30]], 7),
  road([[2, -30], [2, -49]], 4), // shrine approach, not through its building
  road([[17, 54], [17, 36], [17, 14], [17, -30], [17, -54]], 6, '#d4c9b3'),
  road([[17, 36], [44, 36]], 8, '#bb6651'), // Azuma-inspired footbridge
  road([[2, -42], [17, -42], [44, -42]], 8, '#6f9ca5'), // Kototoi-inspired footbridge
  road([[44, 54], [44, 36], [44, -12], [44, -42], [44, -54]], 5, '#d4c9b3'),
  road([[44, -12], [51, -12]], 4),
];
const place = (id, ko, en, icon, x, z, yaw, description, text, rom, english, radius = 4) => ({
  id: `tokyo-${id}`, ko, en, icon, spawn: at(x, z), yaw, radius, description,
  phrase: { text, rom, en: english },
  ...(['food', 'cafe', 'store', 'subway', 'studio'].includes(id) ? {
    category: id, interiorId: `tokyo-${id}-room`,
    entry: { food: at(-24.5, 4), cafe: at(13, -2), store: at(-46.5, 27), studio: at(-48, 5), subway: at(-3, 45) }[id],
  } : {}),
});
const places = [
  place('food', '仲見世の食べ歩き', 'Nakamise Food Street', '🍡', -20, 4, Math.PI / 2,
    'A compressed Nakamise-inspired shopping lane leading north toward Sensō-ji. Enjoy snacks beside the shop rather than while walking.',
    'お団子を一つください。', 'Odango o hitotsu kudasai.', 'One dango, please.'),
  place('cafe', '隅田川の喫茶店', 'Sumida Kissaten', '☕', 17, -2, Math.PI / 2,
    'A small kissaten faces the west-bank promenade, with views across Sumida toward the tower.',
    '窓際の席は空いていますか。', 'Madogiwa no seki wa aite imasu ka.', 'Is a window seat available?'),
  place('store', '浅草まちのコンビニ', 'Asakusa Convenience Store', '🏪', -43, 27, Math.PI / 2,
    'A neighbourhood convenience store on the quieter back lane, west of the temple shopping street.',
    '袋は要りません。', 'Fukuro wa irimasen.', 'I do not need a bag.'),
  place('subway', '浅草駅', 'Asakusa Transit Hub', '🚇', -3, 40, Math.PI,
    'A stylised street-level transit hall. Ginza / Asakusa lines serve Asakusa; airport connections run onward to Haneda and Narita.',
    '浅草線はどこですか。', 'Asakusa-sen wa doko desu ka.', 'Where is the Asakusa Line?'),
  place('studio', '路地の稽古場', 'Backstreet Practice Studio', '🎵', -43, 5, Math.PI / 2,
    'A small rehearsal room in the residential backstreets, away from the ceremonial temple axis.',
    'もう一度練習しましょう。', 'Mō ichido renshū shimashō.', 'Let’s practise one more time.'),
  place('gate', '雷門', 'Kaminarimon Gate', '🏮', -20, 34, 0,
    'The great lantern marks the southern entrance to the Sensō-ji approach. Architecture and distances here are deliberately compressed.',
    '雷門で会いましょう。', 'Kaminarimon de aimashō.', 'Let’s meet at Kaminarimon.'),
  place('temple', '浅草寺', 'Sensō-ji Forecourt', '⛩️', -20, -30, 0,
    'Sensō-ji is a Buddhist temple. The hall and five-storey pagoda anchor the north end of this shortened shopping lane.',
    '静かに歩きましょう。', 'Shizuka ni arukimashō.', 'Let’s walk quietly.'),
  place('shrine', '浅草神社', 'Asakusa Shrine Approach', '⛩️', 2, -49, 0,
    'The Shinto shrine sits beside the Buddhist temple, northeast of its hall; a separate torii distinguishes its approach.',
    'ここは神社です。', 'Koko wa jinja desu.', 'This is a Shinto shrine.'),
  place('bridge', '吾妻橋の眺め', 'Azuma Bridge View', '🌉', 30, 36, -Math.PI / 2,
    'A level pedestrian interpretation of the red Azuma Bridge links the temple side to the eastern bank. Keep to the railed deck.',
    '橋を渡りましょう。', 'Hashi o watarimashō.', 'Let’s cross the bridge.'),
  place('park', '隅田公園', 'Sumida Park Walk', '🌸', 44, -52, -Math.PI / 2,
    'A pocket interpretation of Sumida Park: riverside trees and a long view back toward the temple bank.',
    '川沿いを散歩しましょう。', 'Kawazoi o sanpo shimashō.', 'Let’s stroll along the river.'),
  place('skytree', '東京スカイツリー', 'Skytree View Garden', '🗼', 51, -12, 0,
    'Skytree stands east of Sumida in Oshiage. This small garden compresses that longer journey; the tower is an exterior landmark, not an observation-deck entrance.',
    'スカイツリーが見えます。', 'Sukaitsurī ga miemasu.', 'I can see Skytree.'),
];

// Helpers take local x; only world coordinates enter the shared registry.
function block(w, h, d, m, x, y, z, solid = false, cameraBlock = false) {
  return box(w, h, d, m, CX + x, y, z, { collide: solid, block: solid || cameraBlock });
}
function mesh(geo, m, x, y, z, shadows = true) {
  return add(geo, m, CX + x, y, z, G.scene, shadows);
}
function sign(title, sub, x, y, z, w, h, rot = 0, bg = '#f3e7cf', fg = '#302c29') {
  const tex = textTexture([
    [title, Math.min(100, 1050 / [...title].length), fg, sub ? 88 : 140, JP],
    ...(sub ? [[sub, Math.min(48, 1770 / [...sub].length), fg, 218, JP]] : []),
  ], 1536, 288, { bg, radius: 4, border: fg });
  const m = mat(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffffff, side: THREE.DoubleSide });
  nightGlow(m, 0.03, 0.7);
  const s = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false);
  s.rotation.y = rot;
  return s;
}
function surface(ps, width, m) {
  for (let i = 1; i < ps.length; i++) {
    const [ax, az] = ps[i - 1], [bx, bz] = ps[i];
    const length = Math.hypot(bx - ax, bz - az);
    const b = box(width, 0.025, length, m, (ax + bx) / 2, -0.01, (az + bz) / 2, { cast: false });
    b.rotation.y = Math.atan2(bx - ax, bz - az);
  }
  // Square junction pads close the small triangular gaps at alley bends.
  for (const [x, z] of ps) box(width, 0.025, width, m, x, -0.01, z, { cast: false });
}

function roof(x, z, w, d, y, M) {
  // Two pitched planes with generous eaves, ridge caps and upturned ends.
  const rise = Math.min(1.5, d * 0.24);
  const slope = Math.hypot(d / 2, rise);
  for (const side of [-1, 1]) {
    const r = mesh(new THREE.PlaneGeometry(w + 1, slope + 0.5), M.roof, x, y + rise / 2, z + side * d / 4);
    r.rotation.x = -Math.PI / 2 + side * Math.atan2(rise, d / 2);
    G.blockers.push(r);
    block(w + 1.3, 0.16, 0.28, M.roof, x, y - 0.1, z + side * (d / 2 + 0.15));
  }
  const gable = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(0, rise), new THREE.Vector2(d / 2, 0)]);
  for (const side of [-1, 1]) {
    const end = mesh(new THREE.ShapeGeometry(gable), M.gable, x + side * w / 2, y, z);
    end.rotation.y = side * Math.PI / 2;
    G.blockers.push(end);
  }
  block(w + 0.4, 0.25, 0.3, M.roof, x, y + rise - 0.08, z);
  for (const side of [-1, 1]) {
    const cap = block(0.9, 0.19, 0.31, M.roof, x + side * (w / 2 + 0.12), y + rise, z);
    cap.rotation.z = side * 0.22;
  }
}

function lanternMaterial(text, color = '#db4c39') {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(60,22,13,.35)';
  for (let y = 5; y < 256; y += 13) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = '#261d18';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${Math.floor(190 / [...text].length)}px ${JP}, sans-serif`;
  for (const x of [64, 192]) [...text].forEach((ch, i, a) => g.fillText(ch, x, (i + 0.5) * 220 / a.length + 18));
  const tex = canvasTexture(c, { repeat: false });
  return nightGlow(mat(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffffff }), 0.12, 1.35);
}
function lantern(x, y, z, scale, m, M) {
  const body = mesh(new THREE.SphereGeometry(0.34, 12, 10), m, x, y, z, false);
  body.scale.set(scale, scale * 1.4, scale);
  G.blockers.push(body);
  for (const side of [-1, 1]) {
    const cap = mesh(new THREE.CylinderGeometry(0.19 * scale, 0.19 * scale, 0.08 * scale, 10), M.dark, x, y + side * 0.46 * scale, z, false);
    G.blockers.push(cap);
  }
  block(0.018, 0.45, 0.018, M.dark, x, y + 0.48 * scale, z);
}

function shop(x, z, w, d, h, title, sub, color, M, face = 0, category = null) {
  if (category) {
    const initial = new Set(G.scene.children);
    roof(x, z, w, d, 3.8, M);
    const roofs = G.scene.children.filter(m => !initial.has(m));
    const room = buildRoom({ id: `tokyo-${category}-room`, city: 'tokyo', category,
      x: CX + x, z, w, d, h: 3.8, face, wallMaterial: M.plaster, roofMaterial: M.roof, roofs });
    const offset = new THREE.Vector3(0, 0, (Math.abs(Math.sin(face)) > 0.5 ? w : d) / 2 + 0.28).applyAxisAngle(new THREE.Vector3(0, 1, 0), face);
    const fascia = sign(title, sub, x + offset.x, 3.15, z + offset.z,
      (Math.abs(Math.sin(face)) > 0.5 ? d : w) - 0.5, 0.95, face, '#f6ecd5', color);
    // Signs/roof trim fade with the roof, never float across an occupied room.
    room.roofs[0].attach(fascia);
    registerInterior(room);
    return;
  }
  block(w, h, d, M.plaster, x, 0, z, true);
  roof(x, z, w, d, h, M);
  // Timber corners, skirt boards, rainpipes and side windows prevent the
  // loop routes from looking at featureless backs of shop-front boxes.
  for (const side of [-1, 1]) {
    block(w, 0.8, 0.1, M.wood, x, 0, z + side * (d / 2 + 0.02));
    block(0.1, 0.8, d, M.wood, x + side * (w / 2 + 0.02), 0, z);
    block(w, 0.15, 0.12, M.wood, x, h - 0.4, z + side * (d / 2 + 0.03));
    block(0.12, 0.15, d, M.wood, x + side * (w / 2 + 0.03), h - 0.4, z);
    for (const end of [-1, 1]) {
      block(0.15, h, 0.15, M.wood, x + side * (w / 2 - 0.05), 0, z + end * (d / 2 - 0.05));
      block(0.7, 1.05, 0.08, M.window, x + side * w * 0.28, h > 5 ? 4.5 : 1.3, z + end * (d / 2 + 0.07));
    }
    block(0.08, h, 0.08, M.dark, x + side * (w / 2 + 0.12), 0, z - d / 2);
  }
  // Front details live in a rotated group so the same joinery faces the alley.
  const g = new THREE.Group();
  g.position.set(CX + x, 0, z);
  g.rotation.y = face;
  G.scene.add(g);
  const frontW = Math.abs(Math.sin(face)) > 0.5 ? d : w;
  const frontD = Math.abs(Math.sin(face)) > 0.5 ? w : d;
  const b = (ww, hh, dd, m, xx, yy, zz) => box(ww, hh, dd, m, xx, yy, zz, { parent: g });
  b(frontW, 1, 0.12, M.wood, 0, 0, frontD / 2 + 0.03);
  b(frontW - 0.7, 1.7, 0.08, M.window, 0, 1.05, frontD / 2 + 0.12);
  for (let sx = -frontW / 2 + 0.45; sx < frontW / 2; sx += 0.65) b(0.055, 1.9, 0.11, M.wood, sx, 0.95, frontD / 2 + 0.18);
  for (const sy of [1.6, 2.2]) b(frontW - 0.6, 0.045, 0.11, M.wood, 0, sy, frontD / 2 + 0.18);
  b(frontW + 0.5, 0.18, 1.05, M.wood, 0, 3.05, frontD / 2 + 0.25);
  const curtain = mat(color, { side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) b((frontW - 1) / 5 - 0.04, 0.58, 0.035, curtain, (i - 2) * (frontW - 1) / 5, 2.38, frontD / 2 + 0.43);
  const offset = new THREE.Vector3(0, 0, frontD / 2 + 0.46).applyAxisAngle(new THREE.Vector3(0, 1, 0), face);
  sign(title, sub, x + offset.x, 3.55, z + offset.z, frontW - 0.6, 0.9, face, '#f6ecd5', color);
  if (h > 5) {
    for (const sx of [-frontW * 0.27, frontW * 0.27]) {
      b(frontW * 0.3, 1.1, 0.1, M.window, sx, 4.65, frontD / 2 + 0.07);
      b(0.06, 1.1, 0.12, M.wood, sx, 4.65, frontD / 2 + 0.13);
    }
  }
}

function tree(x, z, scale, M, pink = true) {
  const tree = makeTree({ x: CX + x, z, scale, kind: 'cherry', seed: Math.round(x * 71 + z * 31) });
  tree.traverse(m => { m.userData.keepSeparate = true; });
}
function bench(x, z, M) {
  block(2.4, 0.12, 0.65, M.wood, x, 0.46, z);
  block(2.4, 0.55, 0.1, M.wood, x, 0.5, z - 0.3);
  for (const dx of [-0.9, 0.9]) block(0.12, 0.46, 0.5, M.dark, x + dx, 0, z);
  collider(CX + x - 1.2, CX + x + 1.2, z - 0.4, z + 0.4);
}
function lamp(x, z, M) {
  block(0.12, 3.6, 0.12, M.dark, x, 0, z, true);
  block(0.55, 0.7, 0.55, M.lamp, x, 3.2, z);
  block(0.8, 0.12, 0.8, M.roof, x, 3.9, z);
  const pool = mesh(new THREE.CircleGeometry(2.5, 16), M.pool, x, 0.04, z, false);
  pool.rotation.x = -Math.PI / 2;
  pool.receiveShadow = false;
}

function buildTemple(M) {
  // Walk-through Kaminarimon: collision only at its two massive piers.
  for (const x of [-25.8, -14.2]) block(1.5, 6, 2.6, M.red, x, 0, 30, true);
  block(13.5, 0.8, 3.4, M.red, -20, 5.3, 30, false, true);
  roof(-20, 30, 14, 5.6, 6.1, M);
  lantern(-20, 3.5, 30, 3.4, lanternMaterial('雷門'), M);
  sign('雷門', 'KAMINARIMON', -20, 6.45, 33.1, 2.2, 1.1, 0, '#293f36', '#edcf84');
  // Main hall, with a ground-level forecourt. Decorative steps are solid,
  // not advertised as a traversable entrance or an elevated destination.
  block(22, 0.6, 13, M.stone, -20, 0, -43, true);
  block(19, 6.5, 10.5, M.red, -20, 0.6, -43, true);
  block(17, 4.1, 0.2, M.wood, -20, 1.2, -37.65);
  for (let x = -28; x <= -12; x += 2.7) block(0.45, 5, 0.55, M.red, x, 0.6, -37.3);
  for (const x of [-25.4, -20, -14.6]) block(3.7, 2.8, 0.08, M.window, x, 1.4, -37.45);
  roof(-20, -43, 23, 15, 7, M);
  roof(-20, -43, 15, 9, 10, M);
  for (let i = 0; i < 3; i++) block(9 - i * 0.6, 0.2 * (i + 1), 0.6, M.stone, -20, 0, -35.8 - i * 0.6, true);
  sign('浅草寺', 'SENSŌ-JI · 仏教寺院 / Buddhist temple', -20, 5.2, -37, 6.8, 1.1);
  // Five-storey pagoda, offset west: each tier has its own silhouette.
  for (let i = 0; i < 5; i++) {
    const w = 6.7 - i * 0.65, y = 1 + i * 3;
    block(w, 2.3, w, M.red, -37, y, -44, i === 0, true);
    block(w - 1, 0.85, 0.1, M.window, -37, y + 0.8, -44 + w / 2 + 0.02);
    roof(-37, -44, w + 1, w + 1, y + 2.15, M);
  }
  mesh(new THREE.CylinderGeometry(0.06, 0.16, 4, 8), M.gold, -37, 18.5, -44);
  for (let y = 17; y < 20; y += 0.45) mesh(new THREE.TorusGeometry(0.35, 0.04, 5, 10), M.gold, -37, y, -44).rotation.x = Math.PI / 2;
  // Separate Shinto shrine northeast of the temple.
  block(9, 4.2, 7, M.wood, 2, 0, -57, true);
  roof(2, -57, 10, 8, 4.2, M);
  sign('浅草神社', 'ASAKUSA SHRINE · 神道 / Shinto', 2, 2.8, -53.4, 6.3, 0.9);
  for (const x of [-0.8, 4.8]) block(0.45, 4.4, 0.5, M.stone, x, 0, -46.3, true);
  block(7.5, 0.45, 0.7, M.stone, 2, 4.1, -46.3);
  block(6.5, 0.25, 0.4, M.stone, 2, 3.1, -46.3);
  for (const [x, z] of [[-46, -52], [-8, -56], [10, -59], [-35, -58]]) tree(x, z, 1.1, M, false);
  pointLight(0xffac6c, 14, 16, CX - 20, 4.5, -34);
  pointLight(0xffbd79, 10, 14, CX - 20, 4, 31);
}

function buildShops(M) {
  const names = [
    ['団子', 'DANGO · お団子 200円', '#9b4636'], ['手焼きせんべい', 'SENBEI · 焼きたて', '#2e5148'],
    ['人形焼', 'NINGYŌ-YAKI · 浅草のおやつ', '#974d32'], ['お茶と甘味', 'TEA & SWEETS', '#42614a'],
  ];
  for (const [i, z] of [23, 4, -7, -18].entries()) {
    for (const side of [-1, 1]) {
      const [name, sub, color] = names[(i + (side > 0 ? 1 : 0)) % names.length];
      const x = side < 0 ? -30 : -10;
      shop(x, z, 11, 7, 4.3 + (i % 2) * 2, name, sub, color, M, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 && i === 1 ? 'food' : null);
      lantern(side < 0 ? -24.1 : -15.9, 2.65, z - 2.8, 0.8, M.lantern, M);
    }
  }
  shop(-51, 27, 9, 8, 6.5, 'まちのコンビニ', '24時間 · CONVENIENCE', '#226a7a', M, Math.PI / 2, 'store');
  shop(-52, 5, 8, 12, 7, '音の稽古場', 'PRACTICE STUDIO · 予約制', '#3e4a79', M, Math.PI / 2, 'studio');
  shop(8, -2, 10, 9, 6.4, '喫茶 すみだ', 'COFFEE · クリームソーダ', '#52604b', M, Math.PI / 2, 'cafe');
  // Backstreet homes vary in depth and height; the alley bends around them.
  shop(-53, -11, 7, 7, 6.3, '花屋', '季節の花 · FLOWERS', '#8b5363', M, Math.PI / 2);
  shop(-52, -26, 8, 6, 4.3, '小さな本屋', 'BOOKS · 古本', '#475a61', M, Math.PI / 2);
  shop(6, 26, 11, 9, 7.5, '和紙の店', 'WASHI · 紙と暮らし', '#625477', M);
  shop(6, 52, 12, 9, 6.5, 'そば処', 'SOBA · 温かいおそば', '#3c5267', M, Math.PI);
  // A few tangible snacks at the Nakamise stall, not just labelled boxes.
  // Dango display sits on the room's rear counter, not across its entrance.
  const rice = mat('#e4bca0');
  for (let i = 0; i < 5; i++) {
    block(0.55, 0.025, 0.025, M.wood, -33.5, 0.96, 3 + i * 0.45);
    for (let j = 0; j < 3; j++) mesh(new THREE.SphereGeometry(0.085, 8, 6), rice, -33.68 + j * 0.15, 1.03, 3 + i * 0.45, false);
  }
  // Vending machine: one emissive display, no dedicated point light.
  block(0.8, 1.9, 1.15, M.cream, -46.9, 0, 19, true);
  block(0.06, 1.2, 0.9, M.window, -46.46, 0.5, 19);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) block(0.07, 0.18, 0.1, col % 2 ? M.red : M.blue, -46.41, 0.64 + row * 0.32, 18.67 + col * 0.21);
  sign('つめたい', 'DRINKS', -46.39, 1.67, 19, 0.85, 0.27, Math.PI / 2);
  // Red postbox and small flower planters keep the side street domestic.
  block(0.6, 1.1, 0.6, M.red, -46.9, 0, 35, true);
  sign('〒', '', -46.58, 0.8, 35, 0.4, 0.4, Math.PI / 2, '#bb3a30', '#fff8df');
  for (const [x, z] of [[-46.9, 12], [-46.9, -2], [13.5, 7], [4, -24]]) {
    block(0.65, 0.45, 0.65, M.wood, x, 0, z, true);
    mesh(new THREE.IcosahedronGeometry(0.45, 0), M.leaf, x, 0.85, z);
  }
  pointLight(0xffcb8f, 10, 15, CX - 20, 3.4, 4);
  pointLight(0xffdcb1, 9, 13, CX + 14, 3.2, -2);
}

function buildTransit(M) {
  // Walk-in, level waiting hall in the original station footprint.
  const station = buildRoom({ id: 'tokyo-subway-room', city: 'tokyo', category: 'subway',
    x: CX - 3, z: 49, w: 14, d: 8, h: 3.8, face: Math.PI, wallMaterial: M.cream, roofMaterial: M.dark });
  station.roofs[0].attach(sign('浅草駅', 'G 銀座線 · A 浅草線 / ASAKUSA', -3, 3.15, 44.72, 10.8, 1.1, Math.PI, '#284b61', '#fff7dc'));
  registerInterior(station);
  // Compact transfer terminal, explicitly labelled as an airport connection.
  block(23, 5.4, 8, M.cream, -42, 0, 65, true);
  block(24, 0.4, 10, M.dark, -42, 5.4, 65);
  block(21, 2.8, 0.08, M.window, -42, 0.35, 60.94);
  sign('羽田・成田 空港連絡', 'CONNECTION TO HND / NRT · NOT AN AIRPORT', -42, 4.3, 60.8, 21, 1.4, Math.PI, '#243d54', '#fff0c5');
  for (const x of [-51, -33]) block(0.22, 3.4, 0.22, M.dark, x, 0, 59.7, true);
  block(22, 0.2, 3, M.dark, -42, 3.4, 60.1);
  sign('雷門 ↑  仲見世 ↑', 'WALK NORTH · 浅草の縮景 / COMPRESSED ASAKUSA', -32, 2, 57, 6, 1.15, Math.PI);
  // Existing travel illustration is a framed poster, never the world/map.
  const poster = new THREE.TextureLoader().load('/assets/locations/tokyo-static.png');
  poster.colorSpace = THREE.SRGBColorSpace;
  block(1.9, 3.2, 0.18, M.wood, -50.2, 0.4, 60.7);
  mesh(new THREE.PlaneGeometry(1.65, 2.94), mat(0xffffff, { map: poster }), -50.2, 2, 60.5, false).rotation.y = Math.PI;
  sign('東京・旅のイメージ', 'STYLISED TRAVEL ART · NOT A MAP', -50.2, 0.7, 60.5, 2, 0.4, Math.PI);
  pointLight(0xd8e9ff, 12, 16, CX - 42, 3.2, 58);
}

function buildRiver(M) {
  // The ground under the river is inaccessible. Solid banks are interrupted
  // only by the two railed, level bridge decks, each with eight metres width.
  block(16, 0.08, 140, M.water, 30, -0.7, 0);
  for (const [a, b] of [[-70, -46], [-38, 32], [40, 70]]) {
    collider(CX + 21.5, CX + 38.5, a, b);
    for (const x of [21.8, 38.2]) {
      block(0.4, 1.35, b - a, M.stone, x, -0.65, (a + b) / 2);
      block(0.12, 0.08, b - a, M.dark, x, 0.9, (a + b) / 2);
      for (let z = a + 1; z < b; z += 4) block(0.1, 0.9, 0.1, M.dark, x, 0, z);
    }
  }
  for (const [z, color] of [[36, M.red], [-42, M.blue]]) {
    block(20, 0.5, 8, M.stone, 30, -0.5, z);
    for (const side of [-1, 1]) {
      block(18, 0.15, 0.2, color, 30, 1.05, z + side * 3.85);
      block(18, 0.1, 0.16, color, 30, 0.45, z + side * 3.85);
      collider(CX + 21, CX + 39, z + side * 3.85 - 0.12, z + side * 3.85 + 0.12);
      for (let x = 21; x <= 39; x += 2) block(0.17, 1.15, 0.17, color, x, 0, z + side * 3.85);
    }
    sign(z > 0 ? '吾妻橋' : '言問橋', 'PEDESTRIAN DIORAMA CROSSING', 30, 1.65, z + 3.85, 4.2, 0.65);
    // Flattened arch beams visible below the level, collision-safe deck.
    const arch = mesh(new THREE.TorusGeometry(8.6, 0.18, 5, 20, Math.PI), color, 30, -0.6, z + 3.4, false);
    arch.scale.y = 0.17;
  }
  // Reuse one ripple mesh via instancing; animation has no per-frame allocation.
  const rippleM = nightGlow(mat('#6eacb7', { emissive: '#4085a6', transparent: true, opacity: 0.28, depthWrite: false }), 0.02, 0.25);
  const count = 70, rnd = seeded(834), matrix = new THREE.Object3D();
  const ripples = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.07), rippleM, count);
  const spots = Array.from({ length: count }, () => [23 + rnd() * 14, -68 + rnd() * 136, 0.6 + rnd() * 2]);
  const updateRipples = (t) => {
    spots.forEach(([x, z, s], i) => {
      matrix.position.set(CX + x, -0.6, z + Math.sin(t * 0.5 + i) * 0.3);
      matrix.rotation.set(-Math.PI / 2, 0, 0);
      matrix.scale.set(s, 1, 1);
      matrix.updateMatrix();
      ripples.setMatrixAt(i, matrix.matrix);
    });
    ripples.instanceMatrix.needsUpdate = true;
  };
  updateRipples(0);
  G.scene.add(ripples);
  G.updaters.push((dt, t) => updateRipples(t));
  // Moored riverboat: scenery only, inaccessible behind the bank collision.
  const hull = mesh(new THREE.CylinderGeometry(0.9, 0.6, 6.5, 8), M.cream, 28.8, -0.25, 1, false);
  hull.rotation.x = Math.PI / 2;
  block(1.5, 0.6, 3.5, M.blue, 28.8, 0, 1);
  block(1.25, 0.4, 3, M.window, 28.8, 0.6, 1);
  sign('隅田川', 'SUMIDA RIVER', 20.8, 1.5, 20, 4.5, 0.85, -Math.PI / 2, '#375967', '#fff5df');
  for (const [x, z, scale] of [[12, -50, 1], [11, -18, 0.8], [12, 21, 1], [12, 49, 1], [51, -53, 1.2], [51, -42, 0.9], [51, 3, 1], [51, 19, 1.1], [51, 50, 1]]) tree(x, z, scale, M);
  for (const [x, z] of [[12, -36], [12, 9], [49, 10], [49, -48], [49, 45]]) bench(x, z, M);
  for (const [x, z] of [[20.5, -24], [20.5, 8], [20.5, 46], [40, -50], [40, -18], [40, 20], [40, 49]]) lamp(x, z, M);
  sign('スカイツリー 撮影点', 'PHOTO · SUMIDA → OSHIAGE', 19.8, 1.8, -20, 4.5, 0.9, -Math.PI / 2);
  pointLight(0xffd3a1, 9, 14, CX + 20, 3.5, 8);
}

function buildSkytree(M) {
  // Oshiage is deliberately brought closer: a recognisable tapered lattice
  // and two observation bands, not a claim about real distance or scale.
  const x = 52, z = -27;
  block(8, 1.2, 8, M.stone, x, 0, z, true);
  G.blockers.push(mesh(new THREE.CylinderGeometry(0.85, 2.6, 30, 12), M.tower, x, 16.2, z));
  const tubeM = M.towerLattice;
  const v = (r, a, y) => new THREE.Vector3(CX + x + Math.cos(a) * r, y, z + Math.sin(a) * r);
  const line = (a, b) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const rod = add(new THREE.CylinderGeometry(0.045, 0.045, d.length(), 5), tubeM, 0, 0, 0);
    rod.position.copy(a).add(b).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };
  for (let y = 1.2; y < 28; y += 4.5) {
    const r = 2.7 - (y - 1.2) * 0.06, nextR = r - 0.27;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, b = (i + 1) * Math.PI / 3;
      line(v(r, a, y), v(nextR, b, y + 4.5));
      line(v(r, b, y), v(nextR, a, y + 4.5));
    }
  }
  for (const [y, r] of [[31, 3.5], [37, 2.5]]) {
    G.blockers.push(mesh(new THREE.CylinderGeometry(r, r * 0.83, 1.8, 16), M.cream, x, y, z));
    G.blockers.push(mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.6, 16), M.towerGlow, x, y + 0.1, z));
  }
  G.blockers.push(mesh(new THREE.CylinderGeometry(0.24, 0.65, 13, 8), M.cream, x, 39, z));
  mesh(new THREE.SphereGeometry(0.15, 8, 6), M.lamp, x, 45.5, z, false);
  sign('東京スカイツリー', 'OSHIAGE · 縮景 / COMPRESSED VIEW', 51, 2, -18, 7.5, 1.1);
  block(7.8, 0.15, 0.45, M.stone, 51, 0, -18, true);
}

// Merge static details by material, shadow mode and camera-blocking role.
// Collisions stay as small rectangles. Instanced ripples stay independently
// animated. Only meshes created by this builder are considered.
function batchDetails(roots) {
  G.scene.updateMatrixWorld(true);
  const blockers = new Set(G.blockers), groups = new Map();
  for (const root of roots) root.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.userData.interiorId || m.userData.keepSeparate || m.parent?.userData.interiorId) return;
    const key = `${m.material.id}:${m.castShadow}:${m.receiveShadow}:${!!m.geometry.index}:${blockers.has(m)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });
  const removed = new Set(), replacements = [];
  for (const ms of groups.values()) {
    if (ms.length < 2) continue;
    const copies = ms.map(m => m.geometry.clone().applyMatrix4(m.matrixWorld));
    const geo = mergeGeometries(copies);
    copies.forEach(g => g.dispose());
    const merged = new THREE.Mesh(geo, ms[0].material);
    merged.castShadow = ms[0].castShadow;
    merged.receiveShadow = ms[0].receiveShadow;
    G.scene.add(merged);
    if (blockers.has(ms[0])) replacements.push(merged);
    for (const m of ms) { m.removeFromParent(); m.geometry.dispose(); removed.add(m); }
  }
  G.blockers = G.blockers.filter(m => !removed.has(m));
  G.blockers.push(...replacements);
}

function build() {
  const initial = new Set(G.scene.children);
  const stoneTex = pavers(), woodTex = wood('#70503b'), roofTex = tiles('#414a50', '#31383e', 32);
  const M = {
    ground: mat('#b3ad99'), stone: mat('#9b9c91', { map: stoneTex.map, normalMap: stoneTex.normalMap }),
    wood: mat(0xffffff, { map: woodTex.map, normalMap: woodTex.normalMap }),
    roof: nightGlow(mat(0xffffff, { map: roofTex.map, normalMap: roofTex.normalMap, side: THREE.DoubleSide, emissive: '#667485' }), 0, 0.12),
    plaster: mat('#dfd5bd'), gable: mat('#d6c7aa', { side: THREE.DoubleSide }),
    cream: mat('#e6dfcc'), red: nightGlow(mat('#ad4435', { emissive: '#ad4435' }), 0, 0.2), blue: mat('#527e8b'),
    dark: mat('#303e40'), gold: mat('#b79750', { metalness: 0.55 }),
    window: nightGlow(mat('#e5c795', { emissive: '#ffb66d', roughness: 0.4 }), 0.04, 0.85),
    lamp: nightGlow(mat('#ffedbf', { emissive: '#ffce85' }), 0.05, 2),
    water: mat('#326d7c', { metalness: 0.35, roughness: 0.28 }),
    leaf: mat('#668675', { flatShading: true }),
    tower: mat('#687c8c', { metalness: 0.35 }),
    towerLattice: nightGlow(mat('#d4dfdf', { emissive: '#8eb9d4' }), 0, 0.6),
    pool: new THREE.MeshBasicMaterial({ map: softTexture('rgba(255,205,140,.65)', 'rgba(255,190,110,0)'), color: '#ffcf99', transparent: true, depthWrite: false, opacity: 0 }),
    towerGlow: nightGlow(mat('#adcbd2', { emissive: '#7ac5ee' }), 0.02, 1.5),
    lantern: lanternMaterial('浅草'),
  };
  G.nightMats.push({ m: M.pool, day: 0, night: 0.5, prop: 'opacity' });
  // Separate banks leave an actual opening over the lowered water surface.
  block(82, 0.2, 140, M.ground, -19, -0.2, 0);
  block(22, 0.2, 140, M.ground, 49, -0.2, 0);
  block(18, 0.009, 122, mat('#92a285'), 49, 0.001, 0);
  block(13, 0.009, 125, mat('#99a58a'), 13, 0.001, -3);
  block(56, 0.01, 32, M.stone, -20, 0.001, -45);
  const roadMats = new Map();
  for (const r of roads) {
    if (!roadMats.has(r.color)) roadMats.set(r.color, mat(r.color, { map: stoneTex.map, normalMap: stoneTex.normalMap }));
    surface(r.points, r.width, roadMats.get(r.color));
  }
  buildRiver(M);
  buildTemple(M);
  buildShops(M);
  buildTransit(M);
  buildSkytree(M);
  batchDetails(G.scene.children.filter(o => !initial.has(o)));
}

export default {
  id: 'tokyo', name: 'Tokyo', nativeName: '東京',
  subtitle: 'Compressed, stylised Asakusa–Sumida: temple west, river east, Oshiage beyond. Not a literal map.',
  bounds, spawn: at(-20, 40), yaw: 0, places,
  vistas: [
    { id: 'tokyo-sumida-skytree', title: 'Sumida & Skytree', nativeName: '隅田川とスカイツリー', spawn: at(17, -22), position: [CX + 12, 5, -15], look: [CX + 52, 20, -27], description: 'West-bank promenade across Sumida to Oshiage on the east bank.' },
    { id: 'tokyo-kaminarimon', title: 'Kaminarimon lantern', nativeName: '雷門', spawn: at(-20, 40), position: [CX - 20, 3.2, 44], look: [CX - 20, 4.4, 30], description: 'The great lantern frames the south entrance to Nakamise.' },
    { id: 'tokyo-sensoji', title: 'Sensō-ji & five-storey pagoda', nativeName: '浅草寺と五重塔', spawn: at(-20, -30), position: [CX - 15, 5, -25], look: [CX - 27, 7, -43], description: 'Temple hall and pagoda remain west of the Sumida.' },
  ],
  airport: { spawn: at(-42, 56), name: 'Haneda / Narita Connection', nativeName: '羽田・成田 空港連絡' },
  roads,
  mapFeatures: [
    { type: 'water', points: points([[22, -70], [38, -70], [38, 70], [22, 70]]), color: '#397c94' },
    { type: 'park', points: points([[39, -61], [59, -61], [59, 61], [39, 61]]), color: '#92a285' },
    { type: 'park', points: points([[7, -65], [20, -65], [20, 59], [7, 59]]), color: '#99a58a' },
    { type: 'block', points: points([[-48, -61], [8, -61], [8, -33], [-48, -33]]), color: '#b5a38e' },
  ],
  build,
  heightAt: () => 0,
  zoneAt(x, z) {
    const room = interiorAt({ x, y: 0, z }, 'tokyo');
    return room ? { id: `tokyo-${room.category}`, indoor: true } : null;
  },
};

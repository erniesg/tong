// A compressed Shanghai: lilong → old-city tea lanes → Bund → Huangpu → Pudong.
// +x is east; -z is north. All playable destinations are on the west bank.
import * as THREE from 'three';
import { G, add, box, collider, mat, makeCanvas, canvasTexture, textTexture, nightGlow, pointLight } from '../util.js';
import { brick, pavers, plaster } from '../textures.js';
import { makeTree } from '../nature.js';
import { buildRoom, registerInterior, interiorAt } from '../interiors.js';

const X = 800;
const pt = (x, z) => [X + x, z];
const road = (points, width = 5, color = '#89817b') => ({ points: points.map(([x, z]) => pt(x, z)), width, color });
const roads = [
  road([[-60, -60], [15, -60], [15, 60], [-60, 60], [-60, -60]], 6),
  road([[-60, -24], [15, -24]], 6),
  road([[-60, 16], [15, 16]], 6),
  road([[-60, 40], [15, 40]], 5),
  road([[-34, -60], [-34, 60]], 5),
  road([[-8, -60], [-8, 60]], 5),
  road([[-60, -41], [-8, -41]], 3.5, '#b8a38e'),
  road([[-60, -4], [-8, -4]], 3.5, '#b8a38e'),
  road([[15, -66], [15, 66]], 8, '#d0bda1'),
  road([[2, 16], [2, 40]], 2.8, '#d0bda1'),
  road([[-8, 34], [15, 34]], 2.8, '#d0bda1'),
  road([[-20, -62.8], [-20, -60]], 2.4, '#b8a38e'),
];

const place = (id, ko, en, icon, x, z, yaw, description, text, rom, english) => ({
  id: `shanghai-${id}`, ko, en, icon, spawn: [X + x, 0, z], yaw, radius: 4,
  description, phrase: { text, rom, en: english },
  ...(['food', 'cafe', 'store', 'subway', 'studio'].includes(id) ? {
    category: id, interiorId: `shanghai-${id}-room`,
    entry: { food: [X - 43.5, 0, 10], cafe: [X - 12.2, 0, -34], store: [X - 43.5, 0, 44], subway: [X - 25.5, 0, -29], studio: [X - 65, 0, -28] }[id],
  } : {}),
});
const places = [
  { ...place('home', '弄堂公寓', 'Lilong Apartments', '🏠', -20, -62.8, 0,
    'A jade-and-stone residential block beside the northern lane, west of the Huangpu. Real stairs connect furnished living rooms, kitchens, bedrooms and bathrooms.',
    '谢谢你邀请我。', 'Xièxie nǐ yāoqǐng wǒ.', 'Thank you for inviting me in.'), category: 'home', entry: [X - 20, 0, -64] },
  place('food', '小笼包弄堂', 'Xiaolongbao Lane', '🥟', -34, 16, Math.PI / 4,
    'Bamboo steamers and red-brick lanes evoke Shanghai breakfast culture; this is a stylised neighbourhood, not a literal street map.',
    '来一笼小笼包。', 'Lái yì lóng xiǎolóngbāo.', 'One basket of soup dumplings, please.'),
  place('cafe', '弄堂咖啡', 'Lilong Coffee', '☕', -8, -24, Math.PI / 2,
    'Small cafés tuck into the brick-and-stone shikumen lanes west of the Huangpu.',
    '一杯拿铁，谢谢。', 'Yì bēi nátiě, xièxie.', 'One latte, thank you.'),
  place('store', '便利店', 'Neighbourhood Store', '🏪', -34, 40, Math.PI,
    'A corner convenience shop serves the lane residents, a quieter contrast to the Bund.',
    '这个多少钱？', 'Zhège duōshao qián?', 'How much is this?'),
  place('subway', '人民广场 · 地铁联络', 'People’s Square Metro Link', '🚇', -23, -24, 0,
    'A compressed surface metro pavilion represents the inland People’s Square connection, not its actual distance from the Bund.',
    '地铁站怎么走？', 'Dìtiězhàn zěnme zǒu?', 'How do I get to the metro station?'),
  place('studio', '声动练习室', 'Shengdong Practice Studio', '🎵', -60, -24, Math.PI / 2,
    'A rehearsal space in a repurposed lane-side building: practise Mandarin and music before returning to the waterfront.',
    '我们一起练习吧。', 'Wǒmen yìqǐ liànxí ba.', 'Let’s practise together.'),
  place('bund', '外滩 · 西岸', 'The Bund · West Bank', '🏛️', 15, -24, -Math.PI / 2,
    'Historic stone façades stand on the WEST bank. Across the Huangpu, Pudong’s towers form a distant, non-playable EAST-bank skyline.',
    '对面是浦东。', 'Duìmiàn shì Pǔdōng.', 'Pudong is across the river.'),
  place('garden', '豫园茶巷', 'Yuyuan-inspired Tea Garden', '🍵', 2, 34, 0,
    'A small garden and tea pavilion evoke the old city south of the Bund; the loop is deliberately compressed and is not a model of Yuyuan itself.',
    '我想喝茶。', 'Wǒ xiǎng hē chá.', 'I’d like some tea.'),
  place('lilong', '石库门里弄', 'Shikumen Lanes', '🧱', -34, -4, Math.PI / 2,
    'Stone-framed entrances, red brick, tiled roofs and branching shared lanes are Shanghai’s shikumen vocabulary.',
    '这条弄堂很安静。', 'Zhè tiáo lòngtáng hěn ānjìng.', 'This lane is very quiet.'),
  place('airport', '机场联络站', 'Airport Transit Terminal', '✈️', -46, -60, 0,
    'A downtown transit terminal for onward connections to Pudong (PVG) and Hongqiao (SHA). Neither airport is literally on this downtown map.',
    '我要去浦东机场。', 'Wǒ yào qù Pǔdōng jīchǎng.', 'I need to go to Pudong Airport.'),
];

const blocks = [];
for (const x of [-48, -21]) {
  for (const [z, depth] of [[-48, 10], [-34, 10], [-12, 12], [4, 12], [28, 14], [50, 12]]) {
    blocks.push({ x, z, depth });
  }
}
const rect = (x0, x1, z0, z1) => [pt(x0, z0), pt(x1, z0), pt(x1, z1), pt(x0, z1)];

function build() {
  const textured = (t) => mat(0xffffff, { map: t.map, normalMap: t.normalMap });
  const M = {
    ground: textured(pavers()),
    red: textured(brick('#925b48')),
    brown: textured(brick('#765b50')),
    cream: textured(plaster('#dfcfb7')),
    roof: mat('#464b50'), stone: mat('#b4aa98'), dark: mat('#283637'),
    jade: mat('#397066'),
    gold: mat('#c5a164', { metalness: 0.25 }),
    warm: nightGlow(mat('#e7bd83', { emissive: '#ffd39b', emissiveIntensity: 0 }), 0, 1.6),
    cyan: nightGlow(mat('#81b9c9', { emissive: '#74e3ff', emissiveIntensity: 0 }), 0, 1.4),
    lantern: nightGlow(mat('#d15439', { emissive: '#ff7040', emissiveIntensity: 0 }), 0.05, 2),
  };
  // Local helpers use absolute x internally; box() always takes bottom y.
  const b = (w, h, d, material, x, y, z, opts = {}) => box(w, h, d, material, X + x, y, z, opts);
  const solid = (w, h, d, material, x, y, z) => b(w, h, d, material, x, y, z, { collide: true, block: true });
  const mesh = (geo, material, x, y, z, shadows = true) => add(geo, material, X + x, y, z, G.scene, shadows);
  const windows = [];
  const lights = [];
  const rooms = new Map();
  const panes = [];
  const stoneTrim = [];
  const doors = [];
  const pane = (x, y, z, w, h, rotation = 0, cool = false) => windows.push({ x, y, z, w, h, rotation, cool });

  function sign(title, sub, x, y, z, width = 6, rotation = 0, bg = '#274e4c', height = 1.3) {
    const tex = textTexture([
      [title, Math.min(120, 1330 / [...title].length), '#fff0d4', 110, '"Noto Sans SC", sans-serif'],
      [sub, Math.min(52, 2320 / [...sub].length), '#f2d4a5', 252, '"Noto Sans SC", sans-serif'],
    ], 1536, 320, { bg, border: '#ba9a64', radius: 6 });
    const material = nightGlow(mat(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffffff, side: THREE.DoubleSide }), 0.08, 0.9);
    const s = mesh(new THREE.PlaneGeometry(width, height), material, x, y, z, false);
    s.rotation.y = rotation;
    return s;
  }

  function tiledRoof(x, y, z, w, d) {
    // Two shallow pitched planes, with a projecting stone ridge and eaves.
    const rise = 1.3;
    const half = d / 2 + 0.4;
    for (const side of [-1, 1]) {
      const r = mesh(new THREE.PlaneGeometry(w + 0.7, Math.hypot(half, rise)), M.roof,
        x, y + rise / 2, z + side * half / 2);
      r.rotation.x = -Math.PI / 2 + side * Math.atan2(rise, half);
      // Plane back faces are visible from below the overhanging eave.
      r.material.side = THREE.DoubleSide;
      G.blockers.push(r);
    }
    stoneTrim.push([x, y + rise + 0.09, z, w + 0.9, 0.18, 0.25]);
  }

  function house(x, z, w, d, h, index) {
    const category = x === -43.5 && z === 4 ? 'food' : x === -16.5 && z === -34 ? 'cafe' :
      x === -43.5 && z === 50 ? 'store' : x === -25.5 && z === -34 ? 'subway' : null;
    if (category) {
      const initial = new Set(G.scene.children);
      // Roof trim must belong to the cutaway, not the static instanced trim.
      const trimStart = stoneTrim.length;
      tiledRoof(x, 3.8, z, w, d);
      for (const [xx, yy, zz, ww, hh, dd] of stoneTrim.splice(trimStart)) b(ww, hh, dd, M.stone, xx, yy - hh / 2, zz);
      const roofs = G.scene.children.filter(m => !initial.has(m));
      const room = buildRoom({ id: `shanghai-${category}-room`, city: 'shanghai', category,
        x: X + x, z, w, d, h: 3.8, face: category === 'cafe' ? Math.PI / 2 : category === 'store' ? Math.PI : 0,
        wallMaterial: M.red, roofMaterial: M.roof, roofs });
      rooms.set(category, room);
      return;
    }
    solid(w, h, d, index % 3 ? M.red : M.brown, x, 0, z);
    stoneTrim.push([x, h - 0.175, z, w + 0.15, 0.25, d + 0.15]);
    tiledRoof(x, h, z, w, d);
    // Both street-facing sides have windows; batched below, not individual meshes.
    for (const side of [-1, 1]) {
      for (let y = 2; y < h - 0.8; y += 2.7) {
        for (const dx of [-w * 0.28, w * 0.28]) pane(x + dx, y, z + side * (d / 2 + 0.03), 1.2, 1.5);
      }
    }
    // Distinctive pale stone door surround at the front of each shikumen house.
    const front = z + d / 2 + 0.1;
    doors.push([x, 1.15, front, 1.25, 2.3, 0.12]);
    for (const dx of [-0.78, 0.78]) stoneTrim.push([x + dx, 1.3, front, 0.25, 2.6, 0.3]);
    stoneTrim.push([x, 2.675, front, 1.85, 0.35, 0.35]);
  }

  function tree(x, z, size = 1) {
    makeTree({ x: X + x, z, scale: size, kind: 'camphor', seed: Math.round(x * 71 + z * 31) });
  }

  function lamp(x, z, real = false) {
    solid(0.12, 3.7, 0.12, M.dark, x, 0, z);
    b(0.6, 0.12, 0.6, M.dark, x, 3.7, z);
    lights.push([x, 3.58, z, 0.22, 0.35, 0.22, false]);
    if (real) pointLight('#ffd197', 8, 13, X + x, 3.45, z);
  }

  // Separate banks: no ground slab below the water, no fake walkable crossing.
  b(98, 0.25, 150, M.ground, -26, -0.26, 0, { cast: false });
  b(24, 0.25, 150, M.stone, 63, -0.26, 0, { cast: false });
  const water = nightGlow(mat('#326a76', { metalness: 0.4, roughness: 0.28, emissive: '#12394d' }), 0.04, 0.24);
  b(28, 0.16, 150, water, 37, -0.48, 0, { cast: false });
  // Block the entire east side including decorative Pudong; cannot walk round the river.
  // Extend past runtime bounds so clamp-after-collision cannot open a corner gap.
  collider(X + 23, X + 90, -90, 90);
  solid(0.55, 1.05, 154, M.stone, 22.7, -0.02, 0);
  b(0.7, 0.15, 154, M.cream, 22.7, 1.03, 0);
  b(13, 0.04, 150, mat('#d0bda1'), 16, -0.04, 0, { cast: false });
  // Garden lawn sits beneath the declared paths.
  b(19, 0.03, 23, mat('#748a65'), 4.5, -0.025, 28, { cast: false });
  const roadMaterials = new Map();
  for (const [layer, r] of roads.entries()) {
    if (!roadMaterials.has(r.color)) roadMaterials.set(r.color, mat(r.color));
    for (let i = 1; i < r.points.length; i++) {
      const [ax, az] = r.points[i - 1];
      const [bx, bz] = r.points[i];
      // Authored orthogonal paths: minimap width and visible walk surface agree.
      box(Math.abs(bx - ax) + r.width, 0.035, Math.abs(bz - az) + r.width,
        roadMaterials.get(r.color), (ax + bx) / 2, -0.025 + layer * 0.001, (az + bz) / 2, { cast: false });
    }
  }

  // Repeated attached houses form blocks, with two narrow cross-lanes and four loops.
  let index = 0;
  for (const { x, z, depth } of blocks) {
    for (const dx of [-4.5, 4.5]) house(x + dx, z, 8.6, depth, 6.2 + (index++ % 3) * 0.7, index);
  }
  // A stone gate over the through-lane: posts outside the five-metre road.
  for (const x of [-37.6, -30.4]) solid(0.6, 4.4, 0.7, M.cream, x, 0, -18);
  b(8, 0.5, 1, M.roof, -34, 4.35, -18, { block: true });
  sign('石库门里弄', 'SHIKUMEN · SHARED LANES', -34, 4.55, -17.45, 5.2, 0, '#633d30', 0.9);

  // Reuse primary shikumen shells, with genuine door gaps and furnished rooms.
  rooms.get('food').roofs[0].attach(sign('小笼包 · 生煎', 'SOUP DUMPLINGS · PAN-FRIED BUNS', -43.5, 3.15, 10.28, 7.5, 0, '#8d342c'));
  rooms.get('cafe').roofs[0].attach(sign('弄堂咖啡', 'LILONG COFFEE · 慢慢来', -11.92, 3.15, -34, 7.5, Math.PI / 2));
  rooms.get('store').roofs[0].attach(sign('便利店 24H', '水 · 零食 · EVERYDAY ESSENTIALS', -43.5, 3.15, 43.72, 7.5, Math.PI, '#255c79'));
  const studio = buildRoom({ id: 'shanghai-studio-room', city: 'shanghai', category: 'studio',
    x: X - 69, z: -28, w: 8, d: 16, h: 3.8, face: Math.PI / 2, wallMaterial: M.cream, roofMaterial: M.roof });
  rooms.set('studio', studio);
  studio.roofs[0].attach(sign('声动练习室', 'MUSIC · MANDARIN · PRACTICE', -64.72, 3.15, -28, 10, Math.PI / 2, '#433951'));
  // The former extra metro box overlapped a house; its waiting hall now uses that house.
  rooms.get('subway').roofs[0].attach(sign('人民广场 · 地铁', 'METRO LINK · 1 / 2 / 8', -25.5, 3.15, -28.72, 7.5, 0, '#9d3e3d'));
  for (const room of rooms.values()) registerInterior(room);

  // Historic Bund façades WEST of the river, facing the east-bank skyline.
  for (const [z, d, h] of [[-48, 12, 11], [-33, 10, 14], [-12, 12, 10], [5, 10, 12], [51, 12, 10]]) {
    solid(10, h, d, M.cream, 3, 0, z);
    b(10.8, 0.45, d + 0.8, M.stone, 3, h, z, { block: true });
    for (let y = 3.2; y < h - 1; y += 3.2) {
      for (let zz = z - d / 2 + 1.7; zz < z + d / 2 - 1; zz += 2.7) pane(8.04, y, zz, 1.1, 1.9, Math.PI / 2);
    }
    for (const dz of [-d / 2 + 0.6, d / 2 - 0.6]) b(0.45, h, 0.5, M.stone, 8.15, 0, z + dz);
    for (const y of [0.2, 5.6]) b(0.6, 0.3, d + 0.6, M.stone, 8.2, y, z);
  }
  solid(4, 4, 4, M.cream, 3, 14.4, -33);
  const dome = mesh(new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.jade, 3, 18.4, -33);
  G.blockers.push(dome);
  sign('外滩 · THE BUND', 'WEST 西岸 · 黄浦江 HUANGPU →', 8.6, 6.5, -33, 7, Math.PI / 2, '#635344');
  sign('浦东 · 远景', 'EAST BANK · DISTANT SKYLINE · NO CROSSING', 21.3, 2.7, -25, 8, -Math.PI / 2, '#2c535e');

  // Old-city tea garden, with a small open-sided pavilion and walkable loop.
  for (const x of [3.9, 10.1]) for (const z of [22.4, 27.6]) solid(0.3, 3.1, 0.3, M.red, x, 0, z);
  tiledRoof(7, 3.1, 25, 8, 7);
  b(8.8, 0.15, 0.3, M.gold, 7, 4.5, 25);
  sign('茶 · 慢慢来', 'TEA GARDEN · TAKE YOUR TIME', 7, 2.6, 28.2, 4.2, 0, '#5d3b32', 0.85);
  solid(1.3, 0.65, 1.3, M.stone, 7, 0, 25);
  mesh(new THREE.SphereGeometry(0.16, 10, 8), M.jade, 7, 0.84, 25);
  for (const [x, z] of [[-3, 22], [11, 20], [11, 38], [-3, 37]]) tree(x, z, 0.85);

  // Airport *connection*, not a downtown runway. Front plaza is the north loop.
  solid(24, 6.5, 10, M.cream, -46, 0, -68);
  b(25, 0.4, 11, M.jade, -46, 6.5, -68, { block: true });
  sign('机场联络站', 'PVG 浦东 · SHA 虹桥 · TRANSIT TERMINAL', -46, 4.4, -62.94, 18, 0, '#244f5f', 2);
  sign('市区 → 机场', 'ONWARD TRANSFER · NOT A DOWNTOWN AIRPORT', -46, 2.5, -62.9, 12, 0, '#244f5f', 0.8);
  for (const x of [-52, -46, -40]) pane(x, 1.2, -62.96, 3, 1.5, 0, true);
  // Reuse existing Shanghai art as a travel poster, not stretched world geometry.
  const poster = new THREE.TextureLoader().load('/assets/locations/shanghai-static.png');
  poster.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(1.5, 2.65), mat(0xffffff, { map: poster }), -56, 1.8, -62.88, false);
  sign('上海 · SHANGHAI', 'STYLISED CITY · DISTANCES COMPRESSED', -8, 3.6, 13.2, 9, 0, '#7e3e32');

  // Pudong silhouettes: all scenery, physically separated by the Huangpu.
  const glass = nightGlow(mat('#547d8a', { metalness: 0.4, roughness: 0.35, emissive: '#244459' }), 0, 0.45);
  const silver = mat('#a5b7b8', { metalness: 0.45, roughness: 0.4 });
  for (const [x, z, h, w] of [[62, -56, 18, 7], [69, -43, 23, 7], [69, 33, 22, 6], [59, 48, 16, 8], [70, 59, 21, 7]]) {
    solid(w, h, 7, glass, x, 0, z);
    for (let y = 3; y < h; y += 3) panes.push([x - w / 2 - 0.04, y, z, 0.08, 0.15, 6]);
  }
  // Oriental Pearl: two luminous spheres, tripod legs and a slender spire.
  for (const dz of [-1.8, 1.8]) {
    const leg = mesh(new THREE.CylinderGeometry(0.36, 0.65, 16, 8), silver, 59, 8, -25 + dz);
    leg.rotation.x = dz * 0.05;
    G.blockers.push(leg);
  }
  solid(0.7, 36, 0.7, silver, 59, 0, -25);
  const pearl = nightGlow(mat('#b98299', { emissive: '#eb699d' }), 0, 1.4);
  for (const [y, r] of [[12, 3.5], [25, 2.2]]) {
    const sphere = mesh(new THREE.SphereGeometry(r, 20, 12), pearl, 59, y, -25);
    G.blockers.push(sphere);
    const band = mesh(new THREE.TorusGeometry(r, 0.13, 6, 24), M.cyan, 59, y, -25, false);
    band.rotation.x = Math.PI / 2;
  }
  // Shanghai Tower: tapering, gently turning octagonal sections.
  for (let i = 0; i < 7; i++) {
    const part = mesh(new THREE.CylinderGeometry(3.6 - i * 0.32, 3.9 - i * 0.32, 6.6, 8), glass, 68, 3.3 + i * 6.5, 12);
    part.rotation.y = i * 0.13;
    G.blockers.push(part);
    panes.push([64.3 + i * 0.32, 3 + i * 6.5, 12, 0.08, 0.18, 4]);
  }
  collider(X + 64, X + 72, 8, 16);
  // World Financial Center: an open aperture gives the bottle-opener silhouette.
  solid(6, 31, 7, glass, 67, 0, -7);
  for (const z of [-9.7, -4.3]) solid(6, 6, 1.6, glass, 67, 31, z);
  solid(6, 1.4, 7, silver, 67, 37, -7);
  panes.push([63.96, 30.6, -7, 0.08, 0.25, 7]);

  // Street lighting: a shared emissive batch and only four local point lights.
  for (const z of [-56, -38, -16, 6, 28, 48, 65]) lamp(20.4, z, z === -16);
  for (const [x, z, real] of [[-59, -57, true], [-32, 13, true], [-5, 37, true], [-6, -21, false], [-58, 39, false]]) lamp(x, z, real);
  for (const z of [-53, -30, -8, 10, 46, 57]) tree(10.2, z);
  for (const [x, z] of [[-58, -8], [-58, 23], [-6, -50]]) tree(x, z, 0.9);
  // Lanterns over the market lane leave the pedestrian and camera corridor open.
  for (let i = 0; i < 7; i++) lights.push([-43 + i * 3, 4.8 - Math.sin(i / 6 * Math.PI) * 0.5, 16, 0.35, 0.45, 0.35, true]);
  G.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(X - 43, 4.9, 16), new THREE.Vector3(X - 34, 4.4, 16), new THREE.Vector3(X - 25, 4.9, 16),
  ]), new THREE.LineBasicMaterial({ color: '#383133' })));

  // Batch repeated details to keep mobile draw calls bounded.
  function instances(geometry, material, rows) {
    if (!rows.length) return;
    const inst = new THREE.InstancedMesh(geometry, material, rows.length);
    const transform = new THREE.Object3D();
    rows.forEach(([x, y, z, sx, sy, sz, ry = 0], i) => {
      transform.position.set(X + x, y, z);
      transform.rotation.set(0, ry, 0);
      transform.scale.set(sx, sy, sz);
      transform.updateMatrix();
      inst.setMatrixAt(i, transform.matrix);
    });
    inst.receiveShadow = true;
    G.scene.add(inst);
    return inst;
  }
  // Window mullions and curtains live in one tiny shared texture, not more meshes.
  for (const cool of [false, true]) {
    const [c, ctx] = makeCanvas(64, 96);
    ctx.fillStyle = '#394444';
    ctx.fillRect(0, 0, 64, 96);
    ctx.fillStyle = cool ? '#92c5d7' : '#e8c596';
    ctx.fillRect(5, 5, 54, 86);
    ctx.fillStyle = cool ? '#628c9e' : '#bb9366';
    ctx.fillRect(6, 6, 10, 84);
    ctx.fillStyle = '#4a4d48';
    ctx.fillRect(30, 4, 4, 88);
    ctx.fillRect(4, 37, 56, 4);
    const tex = canvasTexture(c, { repeat: false });
    const material = nightGlow(mat(0xffffff, { map: tex, emissiveMap: tex, emissive: 0xffffff }), 0, 1.25);
    instances(new THREE.BoxGeometry(1, 1, 0.06), material,
      windows.filter((w) => w.cool === cool).map((w) => [w.x, w.y, w.z, w.w, w.h, 1, w.rotation]));
  }
  instances(new THREE.BoxGeometry(1, 1, 1), M.stone, stoneTrim);
  instances(new THREE.BoxGeometry(1, 1, 1), M.dark, doors);
  instances(new THREE.BoxGeometry(1, 1, 1), M.cyan, panes);
  // Stylised skyline reflections, emissive only at night; no extra lights.
  const shimmer = mat('#aacad2', { emissive: '#70c9e3', emissiveIntensity: 0.8, transparent: true, opacity: 0, depthWrite: false });
  G.nightMats.push({ m: shimmer, day: 0, night: 0.35, prop: 'opacity' });
  const reflections = instances(new THREE.BoxGeometry(1, 1, 1), shimmer,
    Array.from({ length: 48 }, (_, i) => [27 + (i % 8) * 2.8, -0.305, (i < 24 ? -25 : 12) + Math.sin(i * 2.4) * 7, 0.18 + (i % 3) * 0.15, 0.01, 0.8 + i % 4]));
  for (let i = 0; i < 48; i++) reflections.setColorAt(i, new THREE.Color(i < 24 ? '#ef9bbb' : '#91d4e4'));
  for (const red of [false, true]) instances(new THREE.SphereGeometry(1, 10, 8), red ? M.lantern : M.warm,
    lights.filter((l) => l[6] === red).map((l) => l.slice(0, 6)));
  sign('拍照点 · 东方明珠', 'PHOTO VIEW · HUANGPU → PUDONG', 19.5, 1.8, -20.5, 4.8, -Math.PI / 2, '#2c535e', 0.9);
}

export default {
  id: 'shanghai', name: 'Shanghai', nativeName: '上海',
  subtitle: 'Compressed Shanghai · west-bank lanes, Bund & distant Pudong',
  bounds: { minX: X - 75, maxX: X + 75, minZ: -75, maxZ: 75 },
  spawn: [X - 8, 0, 16], yaw: -Math.PI / 2,
  home: { id: 'shanghai-home', city: 'shanghai', x: X - 20, z: -69, w: 14, d: 10, style: 'shanghai' },
  places,
  vistas: [
    { id: 'shanghai-pearl', title: 'Huangpu & Oriental Pearl', nativeName: '黄浦江与东方明珠', spawn: [X + 18, 0, -24], position: [X + 15, 11, -14], look: [X + 59, 12, -25], fov: 65, description: 'An elevated west-bank view includes the Huangpu foreground and the full Oriental Pearl on the east bank.' },
    { id: 'shanghai-pudong', title: 'Pudong skyline', nativeName: '浦东天际线', spawn: [X + 18, 0, 16], position: [X + 14, 5, 22], look: [X + 67, 22, 2], description: 'Shanghai Tower and the open-aperture Financial Center beyond the river.' },
    { id: 'shanghai-bund', title: 'Historic Bund waterfront', nativeName: '外滩', spawn: [X + 17, 0, -24], position: [X + 20, 5, -20], look: [X + 3, 12, -36], description: 'The west-bank stone façades and green dome, viewed from their own promenade.' },
  ],
  airport: { spawn: [X - 46, 0, -60], name: 'Pudong / Hongqiao Transit Terminal', nativeName: '浦东 / 虹桥机场联络站' },
  roads,
  mapFeatures: [
    { type: 'water', points: rect(23, 51, -75, 75), color: '#397c8c' },
    { type: 'block', points: rect(51, 75, -75, 75), color: '#536e80' },
    { type: 'park', points: rect(-5, 14, 16.5, 39.5), color: '#748a65' },
    ...blocks.map(({ x, z, depth }) => ({ type: 'block', points: rect(x - 9, x + 9, z - depth / 2, z + depth / 2), color: '#9a6954' })),
  ],
  build,
  heightAt: () => 0,
  zoneAt(x, z, feetY = 0) {
    const room = interiorAt({ x, y: feetY, z }, 'shanghai');
    if (room) return { id: `shanghai-${room.category}`, indoor: true };
    const p = places.find((p) => Math.hypot(x - p.spawn[0], z - p.spawn[2]) < p.radius);
    return p ? { id: p.id, indoor: false } : null;
  },
};

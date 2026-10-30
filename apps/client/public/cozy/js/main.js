// 홍대 한 바퀴 — a cozy, walkable Seoul neighbourhood with day/night,
// built on Tong's characters (Ha-eun, Jin, Tong) and pojangmacha curriculum.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { G, clamp, damp, lerp, rand, wrapAngle, makeCanvas, canvasTexture, roundRect, softTexture, hdr, shuffle } from './util.js';
import { DayNight, koreanTime, timeIcon } from './sky.js';
import {
  buildWorld, heightAt as seoulHeightAt, zoneAt as seoulZoneAt, setTentOpen, studioMirrorVisible, makeFood, water, tentMats, lanterns,
  SPOTS, PLACES as SEOUL_PLACES, TENT, TX, COUNTER_Y, TERRACE_Y,
} from './world.js';
import {
  makeHaeun, makeJin, makePlayer, makeAjusshi, makeBarista, makeCashier, makePedestrian, makeTong, makeCat,
  animate, animateTong, setExpr, lookAtYaw, headPos,
} from './characters.js';
import { initAudio, updateAudio, sfx, setMuted, audio, initVoice, speak as speakRaw, voice } from './audio.js';
import { buildNodes, tongHint, WORDS } from './story.js';
import { createDialogue } from './dialogue.js';
import seoul from './cities/seoul.js';
import tokyo from './cities/tokyo.js';
import shanghai from './cities/shanghai.js';
import { interiors, interiorAt, updateCutaways, isCameraOccluder, cutawaySnapshot } from './interiors.js';
import { MODES, overlaps, createTraversal, stopTraversal, resetTraversal, queueJump, stepTraversal } from './traversal.js';
import { createRides } from './rides.js';

const cities = { seoul, tokyo, shanghai };
const cityGroups = {};
const currentCity = () => cities[S.city];
const cityPlaces = () => S.city === 'seoul' ? [...SEOUL_PLACES, ...seoul.places] : currentCity().places;
const localHour = () => (S.hour + (S.city === 'shanghai' ? -1 : 0) + 24) % 24;
const inSeoulCore = (x, z) => x >= -18 && x <= 18 && z >= -46 && z <= 31;
function heightAt(x, z) {
  const room = interiors.find((i) => i.city === S.city && x >= i.bounds.minX && x <= i.bounds.maxX && z >= i.bounds.minZ && z <= i.bounds.maxZ);
  return room?.floorY ?? (S.city === 'seoul' && inSeoulCore(x, z) ? seoulHeightAt(x, z) : currentCity().heightAt(x, z));
}
function zoneAt(x, z) {
  const zone = (S.city === 'seoul' && inSeoulCore(x, z) ? seoulZoneAt(x, z) : null) ?? currentCity().zoneAt?.(x, z) ?? null;
  const room = interiorAt({ x, y: player?.root.position.y ?? heightAt(x, z), z }, S.city);
  return room ? { ...zone, id: zone?.id ?? room.id, indoor: true, interiorId: room.id, category: room.category } : zone;
}
const traversal = createTraversal();
let rides;
let runEnabled = false, braking = false, demoEnabled = false;
let overview = false, vistaIndex = -1;

/* ── State ───────────────────────────────────────── */

const SAVE_KEY = 'tong-cozy-seoul-v2';
const S = {
  name: '연습생',
  city: 'seoul',
  adventures: {},
  cityPositions: {},
  postcards: [],
  hour: 16.5,
  day: 1,
  speed: 1,
  aff: 0,
  maxAff: 8,
  jinAff: 0,
  maxJin: 2,
  words: new Set(),
  phrases: new Map(),
  visited: new Set(),
  quests: {},
  pettedCat: false,
  metHaeunStudio: false,
  jinTip: false,
  mistakes: 0,
  food: null,
  spicy: false,
  showEn: true,
  haeunStory: 'idle', // idle | talking | exit
  haeunHomeUntil: 0,
  started: false,
  benchSit: null,
  telescope: false,
  polaroids: [],
};

function save() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 3, city: S.city, position: safePose(), adventures: S.adventures,
        cityPositions: S.cityPositions, postcards: S.postcards,
        name: S.name, hour: S.hour, day: S.day, aff: S.aff, jinAff: S.jinAff,
        words: [...S.words], phrases: [...S.phrases], visited: [...S.visited], quests: S.quests,
        pettedCat: S.pettedCat, metHaeunStudio: S.metHaeunStudio, jinTip: S.jinTip, haeunHomeUntil: S.haeunHomeUntil,
      }),
    );
  } catch {
    /* storage unavailable */
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applySave(d) {
  Object.assign(S, { name: d.name, hour: d.hour, day: d.day, aff: d.aff, jinAff: d.jinAff, quests: d.quests ?? {}, pettedCat: d.pettedCat, metHaeunStudio: d.metHaeunStudio, jinTip: d.jinTip, haeunHomeUntil: d.haeunHomeUntil ?? 0 });
  S.city = Object.hasOwn(cities, d.city) ? d.city : 'seoul';
  S.hour = Number.isFinite(d.hour) ? ((d.hour % 24) + 24) % 24 : 16.5;
  S.day = Number.isFinite(d.day) && d.day >= 1 ? Math.floor(d.day) : 1;
  S.name = typeof d.name === 'string' ? d.name : '연습생';
  S.aff = clamp(Number(d.aff) || 0, 0, S.maxAff);
  S.jinAff = clamp(Number(d.jinAff) || 0, 0, S.maxJin);
  S.adventures = {};
  for (const id of Object.keys(cities)) {
    const a = d.adventures?.[id];
    S.adventures[id] = {
      discovered: Array.isArray(a?.discovered) ? a.discovered.filter((x) => typeof x === 'string') : [],
      mastered: Array.isArray(a?.mastered) ? a.mastered.filter((x) => typeof x === 'string') : [],
      step: clamp(Math.floor(Number(a?.step) || 0), 0, 3),
    };
  }
  S.cityPositions = d.cityPositions && typeof d.cityPositions === 'object' ? d.cityPositions : {};
  S.postcards = Array.isArray(d.postcards) ? d.postcards.filter((id) => Object.hasOwn(cities, id)) : [];
  S.words = new Set(d.words ?? []);
  S.phrases = new Map(d.phrases ?? []);
  S.visited = new Set(d.visited ?? []);
  placePlayer(d.position);
}

function validPose(pose) {
  if (!pose || !Array.isArray(pose.position) || pose.position.length !== 3 || !pose.position.every(Number.isFinite) || !Number.isFinite(pose.yaw)) return false;
  const [x, y, z] = pose.position;
  const b = currentCity().bounds;
  const radius = MODES[pose.mode]?.radius ?? 0.3;
  if (x < b.minX + radius || x > b.maxX - radius || z < b.minZ + radius || z > b.maxZ - radius || Math.abs(y - heightAt(x, z)) > 0.12) return false;
  return !G.colliders.some((c) => overlaps(x, z, radius, c));
}

function safePose() {
  const pose = { position: player.root.position.toArray(), yaw: cam.yaw, rotation: player.root.rotation.y, mode: traversal.mode };
  if (traversal.grounded && player.pose !== 'sit' && validPose(pose)) {
    pose.position[1] = heightAt(pose.position[0], pose.position[2]);
    S.cityPositions[S.city] = pose;
    return pose;
  }
  const previous = S.cityPositions[S.city];
  return validPose(previous) ? previous : { position: [...currentCity().spawn], yaw: currentCity().yaw };
}

function placePlayer(pose) {
  const safe = validPose(pose) ? pose : { position: currentCity().spawn, yaw: currentCity().yaw };
  player.root.position.set(...safe.position);
  player.root.position.y = heightAt(player.root.position.x, player.root.position.z);
  setTransport(interiorAt(player.root.position, S.city) ? 'walk' : safe.mode ?? 'walk', true);
  resetTraversal(traversal, traversal.mode);
  overview = false;
  vistaIndex = -1;
  cam.yaw = Number.isFinite(safe.yaw) ? safe.yaw : currentCity().yaw;
  player.root.rotation.y = Number.isFinite(safe.rotation) ? safe.rotation : cam.yaw + Math.PI;
  cam.snap = true;
  tong.root.position.copy(player.root.position).y += 1.6;
}

/* ── Renderer ────────────────────────────────────── */

const canvas = document.getElementById('scene');
const shell = document.getElementById('game-shell');
const stage = { width: 1, height: 1 };
function stageRect() { return (shell ?? canvas).getBoundingClientRect(); }
const initialRect = stageRect();
stage.width = Math.max(1, initialRect.width);
stage.height = Math.max(1, initialRect.height);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(stage.width, stage.height, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, stage.width / stage.height, 0.1, 2000);
camera.position.set(8, 6, 20);
G.scene = scene;
G.camera = camera;
// soft fill light that rides with the camera during conversations
const faceFill = new THREE.PointLight(0xffe6cc, 0, 7, 2);
scene.add(faceFill);
G.renderer = renderer;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(stage.width, stage.height), 0.5, 0.55, 0.92);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1.1 }, uVig: { value: 0.35 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uSat; uniform float uVig; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat);
      vec2 d = vUv - 0.5; col *= 1.0 - dot(d, d) * uVig * 1.6; gl_FragColor = vec4(col, c.a); }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

function resizeStage() {
  const rect = stageRect();
  stage.width = Math.max(1, rect.width);
  stage.height = Math.max(1, rect.height);
  camera.aspect = stage.width / stage.height;
  camera.updateProjectionMatrix();
  renderer.setSize(stage.width, stage.height, false);
  composer.setSize(stage.width, stage.height);
}
window.addEventListener('resize', resizeStage);
if (shell) new ResizeObserver(resizeStage).observe(shell);

/* ── UI handles ──────────────────────────────────── */

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'),
  questList: $('quest-list'),
  questHint: $('quest-hint'),
  clockIcon: $('clock-icon'),
  clockTime: $('clock-time'),
  clockKo: $('clock-ko'),
  heartsHaeun: $('hearts-haeun'),
  stageHaeun: $('stage-haeun'),
  heartsJin: $('hearts-jin'),
  stageJin: $('stage-jin'),
  prompt: $('prompt'),
  toast: $('toast'),
  banner: $('banner'),
  bubbles: $('bubbles'),
  book: $('book'),
  bookList: $('book-list'),
  bookCount: $('book-count'),
  vignette: $('vignette'),
  stick: $('stick'),
  knob: $('stick-knob'),
  minimap: $('minimap'),
  travel: $('travel'),
  fade: $('fade'),
};

/* ── World & cast ────────────────────────────────── */

let sky;
let player, haeun, jin, ajusshi, barista, cashier, tong, cat;
const peds = [];
const chars = {};

function buildCast() {
  player = makePlayer();
  rides = createRides(player);
  haeun = makeHaeun();
  jin = makeJin();
  ajusshi = makeAjusshi();
  barista = makeBarista();
  cashier = makeCashier();
  tong = makeTong();
  cat = makeCat(SPOTS.cat);
  Object.assign(chars, { player, haeun, jin, ajusshi, barista, cashier, tong });

  ajusshi.root.position.copy(SPOTS.ajusshi);
  ajusshi.armPose = (t) => (ajusshi.serveT > 0 ? [-1.4, -1.4] : [-0.9 + Math.sin(t * 3) * 0.25, -0.2]);
  barista.root.position.copy(SPOTS.barista);
  barista.root.rotation.y = -Math.PI / 2;
  barista.armPose = (t) => [-0.6 + Math.sin(t * 1.7) * 0.15, -0.4];
  cashier.root.position.copy(SPOTS.cashier);
  cashier.root.rotation.y = Math.PI / 2;

  const loops = [
    [[1.5, 27], [1.5, -6], [3, -14], [-2, -16], [-1.5, -6], [-1.5, 27]],
    [[-7, -11], [7, -11], [7, -24], [-7, -24]],
    [[-2, -34], [14, -34], [14, -42.5], [-4, -42.5]],
    [[-2.5, 24], [3.5, 12], [3.5, -2], [-1, -12], [4.5, -20], [3.5, -2], [-2.5, 24]],
  ];
  loops.forEach((loop, i) => {
    const p = makePedestrian(100 + i * 17);
    const pts = loop.map(([x, z]) => new THREE.Vector3(x, seoulHeightAt(x, z), z));
    p.root.position.copy(pts[0]);
    peds.push({ c: p, pts, i: 1, speed: rand(1.1, 1.5), pause: 0 });
  });
}

/* ── Schedules (who is where, when) ──────────────── */

const isOpen = (h) => h >= 19 || h < 3;
const where = {
  haeun(h) {
    if (S.haeunStory !== 'idle') return 'story';
    // after the night out she heads home until the next morning
    if (S.day * 24 + h < S.haeunHomeUntil) return 'away';
    if (h >= 9 && h < 19) return 'studio';
    if (isOpen(h)) return 'tent';
    return 'away';
  },
  jin(h) {
    if (h >= 8 && h < 18) return 'cafe';
    if (h >= 18) return 'lookout';
    return 'away';
  },
};
const loc = { haeun: null, jin: null, tent: null };
const eatPose = (t) => {
  const k = Math.max(0, Math.sin(t * 0.9)) ** 6;
  return [-0.25 - k * 1.9, -0.35];
};
const talkPose = () => [-0.25, -0.35];

function placeHaeun(l) {
  haeun.root.visible = l !== 'away';
  haeun.pose = 'idle';
  haeun.armPose = null;
  haeun.legSwing = false;
  if (l === 'studio') {
    haeun.root.position.copy(SPOTS.haeunStudio);
    haeun.root.rotation.y = -Math.PI / 2;
    haeun.pose = 'dance';
    haeun.baseExpr = 'smirk';
  } else if (l === 'tent') {
    haeun.root.position.copy(SPOTS.haeunTent);
    haeun.root.rotation.y = Math.PI;
    haeun.pose = 'sit';
    haeun.legSwing = true;
    haeun.baseExpr = 'cool';
    haeun.armPose = eatPose;
  }
  setExpr(haeun, haeun.baseExpr);
}

function placeJin(l) {
  jin.root.visible = l !== 'away';
  jin.pose = 'sit';
  if (l === 'cafe') {
    jin.root.position.copy(SPOTS.jinCafe);
    jin.root.rotation.y = -Math.PI / 2;
    jin.armPose = (t) => [-0.9 - Math.max(0, Math.sin(t * 0.5)) ** 8 * 0.8, -0.3];
  } else if (l === 'lookout') {
    jin.root.position.copy(SPOTS.jinLookout);
    jin.root.rotation.y = Math.PI;
    jin.armPose = () => [-0.3, -0.3];
  }
}

const frustum = new THREE.Frustum();
const projScreen = new THREE.Matrix4();
function onScreen(p) {
  projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreen);
  return frustum.containsPoint(tmpV.copy(p).setY(p.y + 1));
}

function updateSchedules(force = false) {
  const h = S.hour;
  const open = isOpen(h);
  if (open !== loc.tent || force) {
    loc.tent = open;
    setTentOpen(open);
    ajusshi.root.visible = open;
    for (const e of tentSteam) e.off = !open;
  }
  barista.root.visible = h >= 8 && h < 22;
  // NPCs change places when you aren't watching them
  const unseen = (c) => !c.root.visible || player.root.position.distanceTo(c.root.position) > 9 || !onScreen(c.root.position);
  const hl = where.haeun(h);
  if (hl !== 'story' && hl !== loc.haeun && !dlg.state.active && (force || unseen(haeun))) {
    loc.haeun = hl;
    placeHaeun(hl);
  }
  const jl = where.jin(h);
  if (jl !== loc.jin && !dlg.state.active && (force || unseen(jin))) {
    loc.jin = jl;
    placeJin(jl);
  }
}

/* ── Particles ───────────────────────────────────── */

const steamTex = softTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
const steamPool = [];
const emitters = [];
const tentSteam = [];

function initParticles() {
  for (let i = 0; i < 140; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0xfff0e0, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    scene.add(s);
    steamPool.push({ s, alive: false, life: 0, max: 1, v: new THREE.Vector3(), s0: 0.2, s1: 0.7, seed: 0, alpha: 0.3 });
  }
  tentSteam.push(emitter(new THREE.Vector3(TX - 1.95, COUNTER_Y + 0.12, -1.08), 5, { s0: 0.2, s1: 0.8 }));
  tentSteam.push(emitter(new THREE.Vector3(TX - 1.15, COUNTER_Y + 0.3, -1.12), 4, { s0: 0.2, s1: 0.75 }));
  emitter(new THREE.Vector3(16.6, 1.6, -18.6), 1.5, { s0: 0.08, s1: 0.4, alpha: 0.25, rise: 0.35 });
}

function emitter(pos, rate, opts = {}) {
  const e = { pos: pos.clone(), rate, acc: 0, s0: 0.15, s1: 0.65, alpha: 0.28, rise: 0.45, color: 0xfff0e0, ...opts };
  emitters.push(e);
  return e;
}

function updateParticles(dt, t) {
  if (S.city !== 'seoul') {
    for (const p of steamPool) { p.alive = false; p.s.visible = false; }
    return;
  }
  for (const e of emitters) {
    if (e.off) continue;
    e.acc += e.rate * dt;
    while (e.acc >= 1) {
      e.acc -= 1;
      const p = steamPool.find((q) => !q.alive);
      if (!p) break;
      p.alive = true;
      p.life = 0;
      p.max = rand(1.8, 2.8);
      p.s.position.set(e.pos.x + rand(-0.1, 0.1), e.pos.y, e.pos.z + rand(-0.1, 0.1));
      p.v.set(rand(-0.05, 0.05), e.rise * rand(0.8, 1.2), rand(-0.05, 0.05));
      p.s0 = e.s0;
      p.s1 = e.s1;
      p.alpha = e.alpha;
      p.seed = Math.random() * 10;
      p.s.material.color.set(e.color);
      p.s.visible = true;
    }
  }
  for (const p of steamPool) {
    if (!p.alive) continue;
    p.life += dt;
    const k = p.life / p.max;
    if (k >= 1) {
      p.alive = false;
      p.s.visible = false;
      continue;
    }
    p.s.position.addScaledVector(p.v, dt);
    p.s.position.x += Math.sin(t * 1.5 + p.seed) * 0.08 * dt;
    const sc = p.s0 + (p.s1 - p.s0) * k;
    p.s.scale.set(sc, sc, 1);
    p.s.material.opacity = Math.sin(Math.PI * k) * p.alpha;
  }
}

let motes;
function buildMotes() {
  const n = 220;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = rand(-10, 10);
    const z = rand(-45, 26);
    pos.set([x, heightAt(x, z) + rand(0.4, 4.5), z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTexture(), size: 0.09, color: hdr(0xffcf8a, 1.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);
}

function updateMotes(dt, t) {
  motes.material.opacity = G.night;
  const a = motes.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    a.setY(i, a.getY(i) + Math.sin(t * 0.8 + i) * dt * 0.08);
    a.setX(i, a.getX(i) + Math.cos(t * 0.6 + i * 1.3) * dt * 0.06);
  }
  a.needsUpdate = true;
}

/* ── Word pickups ────────────────────────────────── */

const pickups = [];
function buildPickups() {
  const glowTex = softTexture('rgba(255,200,120,0.8)', 'rgba(255,160,60,0)');
  for (const w of WORDS) {
    const W = 200 + [...w.ko].length * 90;
    const [c, g] = makeCanvas(W, 192);
    g.fillStyle = '#e8641c';
    roundRect(g, 12, 20, W - 24, 150, 60);
    g.fill();
    g.strokeStyle = '#ffd9a8';
    g.lineWidth = 8;
    g.stroke();
    g.font = '86px Jua, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff6e8';
    g.fillText(w.ko, W / 2, 100);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(c, { repeat: false }), depthWrite: false }));
    sprite.scale.set((W / 384) * 1.0, 0.5, 1);
    const y = heightAt(w.at[0], w.at[1]);
    sprite.position.set(w.at[0], y + 1.3, w.at[1]);
    scene.add(sprite);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(w.at[0], y + 0.03, w.at[1]);
    scene.add(glow);
    const p = { w, y, sprite, glow, taken: S.words.has(w.ko), fade: 0, phase: Math.random() * 6 };
    if (p.taken) sprite.visible = glow.visible = false;
    pickups.push(p);
  }
}

function updatePickups(dt, t) {
  for (const p of pickups) {
    if (p.taken) {
      if (p.fade < 1 && p.sprite.visible) {
        p.fade += dt * 2;
        p.sprite.position.y += dt * 1.5;
        p.sprite.material.opacity = 1 - p.fade;
        p.glow.material.opacity = 1 - p.fade;
        if (p.fade >= 1) p.sprite.visible = p.glow.visible = false;
      }
      continue;
    }
    p.sprite.position.y = p.y + 1.3 + Math.sin(t * 2 + p.phase) * 0.1;
    if (!S.started) continue;
    const pp = player.root.position;
    if (Math.hypot(pp.x - p.w.at[0], pp.z - p.w.at[1]) < 0.95 && Math.abs(pp.y - p.y) < 1) {
      p.taken = true;
      S.words.add(p.w.ko);
      learn(p.w.ko, p.w.rom, p.w.en);
      sfx.chime();
      tong.spin = 0.8;
      tong.expr = 'laugh';
      tong.exprT = 1.5;
      toast(`<b>${p.w.ko}</b><span>${p.w.rom} · ${p.w.en}</span>`, 2600);
      speak(p.w.ko, 'player');
      if (S.words.size >= WORDS.length) done('words');
      updateQuest();
      save();
    }
  }
}

/* ── UI helpers ──────────────────────────────────── */

let toastTimer = 0;
function toast(html, ms = 2200) {
  ui.toast.innerHTML = html;
  ui.toast.classList.remove('hidden');
  ui.toast.style.animation = 'none';
  void ui.toast.offsetWidth;
  ui.toast.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add('hidden'), ms);
}

let bannerTimer = 0;
function banner(ko, en) {
  ui.banner.innerHTML = `<b></b><span></span>`;
  ui.banner.children[0].textContent = ko;
  ui.banner.children[1].textContent = en;
  ui.banner.classList.remove('hidden', 'out');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => ui.banner.classList.add('out'), 2200);
}

function learn(ko, rom, en) {
  if (!S.phrases.has(ko)) S.phrases.set(ko, { rom, en });
  ui.bookCount.textContent = S.phrases.size;
  renderBook();
}

function renderBook() {
  if (!S.phrases.size) {
    ui.bookList.innerHTML = '<div class="book-empty">Glowing words are scattered around the neighbourhood. Walk into them!</div>';
    return;
  }
  ui.bookList.innerHTML = '';
  for (const [ko, { rom, en }] of S.phrases) {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.innerHTML = '<b></b><span class="rom"></span><span class="en"></span>';
    row.children[0].textContent = ko;
    row.children[1].textContent = rom ?? '';
    row.children[2].textContent = en ?? '';
    row.onclick = () => speak(ko, 'player');
    ui.bookList.appendChild(row);
  }
}

const HAEUN_STAGES = [[0, '낯선 사람 · strangers'], [2, '아는 사이 · acquaintances'], [4, '동료 · colleagues'], [6, '친구 · friends (almost)']];
const JIN_STAGES = [[0, '선배 · senior'], [1, '친한 선배 · close senior'], [2, '든든한 선배 · trusted mentor']];
const relationshipStage = (table, v) => [...table].reverse().find(([m]) => v >= m)[1];

function hearts(n, max) {
  return Array.from({ length: max }, (_, i) => (i < n ? '♥' : '<span class="off">♥</span>')).join('');
}

function updateHearts() {
  ui.heartsHaeun.innerHTML = hearts(S.aff, S.maxAff);
  ui.stageHaeun.textContent = relationshipStage(HAEUN_STAGES, S.aff);
  ui.heartsJin.innerHTML = hearts(S.jinAff, S.maxJin);
  ui.stageJin.textContent = relationshipStage(JIN_STAGES, S.jinAff);
}

function addAff(who, n) {
  if (who === 'jin') {
    S.jinAff = clamp(S.jinAff + n, 0, S.maxJin);
    bubble(jin, '+♥', { cls: 'heart', dur: 1.3 });
  } else {
    S.aff = clamp(S.aff + n, 0, S.maxAff);
    bubble(haeun, '+♥', { cls: 'heart', dur: 1.3 });
  }
  updateHearts();
  sfx.heart();
}

const QUESTS = [
  ['cafe', '☕ Order at 카페 봄 (8:00–22:00)'],
  ['jin', '🧑‍🎤 Say hi to Jin at the café'],
  ['haeunDay', '💃 Find 하은 at the studio (9:00–19:00)'],
  ['store', '🏪 Buy something at the 편의점'],
  ['haeun', '🏮 Share a night at the 포장마차 (19:00~)'],
  ['jinNight', '🌉 Find Jin by the Han River (night)'],
  ['explore', '🗺️ Visit all 6 places'],
  ['words', '✨ Collect 10 glowing words'],
  ['quiz', '📝 Ace Tong’s word quiz (studio)'],
];

function updateQuest() {
  $('quest-title-text').textContent = `${currentCity().nativeName} · Today`;
  $('city-title').textContent = `${currentCity().nativeName} · ${currentCity().name}`;
  $('map-title').textContent = `${currentCity().name} · compressed city map`;
  document.title = `Tong · ${currentCity().name}`;
  document.body.classList.toggle('remote-city', S.city !== 'seoul');
  if (S.city !== 'seoul') {
    ui.questList.replaceChildren();
    const a = adventure();
    for (const label of [errandLabel(), `Explore ${a.discovered.length}/${cityPlaces().length} places · ${a.mastered.length} phrases learned`]) {
      const li = document.createElement('li');
      li.textContent = label;
      ui.questList.appendChild(li);
    }
    $('quest-count').textContent = `${a.step}/3`;
    ui.questHint.textContent = 'E / tap at landmarks · Subway stays in this city · Flights leave from the airport.';
    return;
  }
  const open = QUESTS.filter(([id]) => !S.quests[id]);
  const doneCount = QUESTS.length - open.length;
  ui.questList.innerHTML = '';
  for (const [id, label] of open.slice(0, 4)) {
    const li = document.createElement('li');
    let txt = label;
    if (id === 'words') txt += ` ${S.words.size}/10`;
    if (id === 'explore') txt += ` ${S.visited.size}/6`;
    li.textContent = txt;
    ui.questList.appendChild(li);
  }
  if (!open.length) ui.questList.innerHTML = '<li class="done">모두 완료! Everything done 🎉</li>';
  const local = document.createElement('li');
  local.textContent = errandLabel();
  ui.questList.prepend(local);
  $('quest-count').textContent = `${doneCount}/${QUESTS.length}`;
}

function done(id) {
  if (S.quests[id]) return;
  S.quests[id] = true;
  const q = QUESTS.find(([qid]) => qid === id);
  if (q) toast(`<b>✓ 완료!</b><span>${q[1]}</span>`, 2400);
  sfx.chime();
  updateQuest();
  save();
}

const bubbles = [];
function bubble(target, text, { cls = '', dur = 2.4 } = {}) {
  if (!cls) bubbles.filter((b) => b.target === target && !b.el.className.includes('heart')).forEach((b) => (b.life = Math.min(b.life, 0.01)));
  const el = document.createElement('div');
  el.className = `bubble ${cls}`;
  el.textContent = text;
  ui.bubbles.appendChild(el);
  bubbles.push({ el, target, life: dur, rise: 0 });
}

const tmpV = new THREE.Vector3();
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.life -= dt;
    if (b.el.classList.contains('heart')) b.rise += dt * 40;
    if (b.life <= 0) {
      b.el.remove();
      bubbles.splice(i, 1);
      continue;
    }
    if (b.target.head) headPos(b.target, tmpV).y += 0.55;
    else if (b.target.root) tmpV.copy(b.target.root.position).add(b.target.body.position).y += 0.6;
    else tmpV.copy(b.target);
    tmpV.project(camera);
    b.el.style.display = tmpV.z > 1 ? 'none' : '';
    b.el.style.left = `${(tmpV.x * 0.5 + 0.5) * stage.width}px`;
    b.el.style.top = `${(-tmpV.y * 0.5 + 0.5) * stage.height - b.rise}px`;
    b.el.style.opacity = Math.min(1, b.life * 3);
  }
}

function speak(text, who) {
  if (!/\p{Script=Hangul}/u.test(text)) return;
  speakRaw(text, who);
}

function updateToggles() {
  $('btn-en').classList.toggle('off', !S.showEn);
  $('btn-mute').textContent = audio.muted ? '🔇' : '🔊';
  const v = $('btn-voice');
  v.classList.toggle('off', !voice.on || !voice.available());
  v.title = voice.available() ? 'Korean voice' : 'No Korean voice on this device';
  document.body.classList.toggle('no-en', !S.showEn);
  for (const [id, sp] of [['t-pause', 0], ['t-play', 1], ['t-fast', 8]]) $(id).classList.toggle('on', S.speed === sp);
}

/* ── Story actions ───────────────────────────────── */

let playerFood = null;
let foodSteam = null;
const STAND_SPOT = new THREE.Vector3(SPOTS.playerSeat.x, 0, 0.75);

function walkTo(path, onArrive) {
  setTransport('walk', true);
  stopTraversal(traversal);
  player.auto = { path: path.map((p) => p.clone()), onArrive };
}

function walkToCounter(onArrive) {
  const p = player.root.position;
  const path = [];
  if (p.z > TENT.maxZ - 0.2 || p.x < TENT.minX || p.x > TENT.maxX) path.push(new THREE.Vector3(clamp(p.x, TX - 1.8, TX + 1.8), 0, TENT.maxZ + 0.7));
  if (p.distanceTo(STAND_SPOT) > 0.1) path.push(STAND_SPOT);
  if (path.length) walkTo(path, onArrive);
  else onArrive?.();
}

function sitPlayer() {
  walkToCounter(() => {
    player.pose = 'sit';
    player.root.position.copy(SPOTS.playerSeat);
    player.root.rotation.y = Math.PI;
  });
}

function serveFood() {
  if (playerFood) return;
  playerFood = makeFood(S.food?.ko ?? '떡볶이', S.spicy);
  playerFood.position.set(SPOTS.playerSeat.x, COUNTER_Y, -0.86);
  playerFood.scale.setScalar(0.01);
  scene.add(playerFood);
  foodSteam = emitter(new THREE.Vector3(SPOTS.playerSeat.x, COUNTER_Y + 0.15, -0.86), 2.5, { s0: 0.06, s1: 0.22, alpha: 0.16, rise: 0.25 });
  ajusshi.serveT = 1.0;
  sfx.chime();
}

let hotSteam = null;
function spicyFx(on) {
  ui.vignette.classList.toggle('on', on);
  if (on) {
    sfx.thump();
    setExpr(player, 'spicy', 6);
    hotSteam = emitter(new THREE.Vector3(), 9, { s0: 0.1, s1: 0.45, alpha: 0.45, rise: 0.8, color: 0xffb0a0 });
  } else if (hotSteam) {
    hotSteam.off = true;
    setExpr(player, 'laugh', 2);
  }
}

function startExit() {
  S.haeunStory = 'exit';
  haeun.pose = 'idle';
  haeun.legSwing = false;
  haeun.armPose = null;
  haeun.path = [
    new THREE.Vector3(SPOTS.haeunTent.x, 0, 0.9),
    new THREE.Vector3(TX + 1.4, 0, TENT.maxZ + 0.9),
    new THREE.Vector3(2.4, 0, TENT.maxZ + 1.2),
    'wave',
    new THREE.Vector3(2.6, 0, -6),
    new THREE.Vector3(3.5, 0, -18),
  ];
}

function finishNight() {
  S.haeunStory = 'idle';
  S.quests.haeun = true;
  S.haeunHomeUntil = (S.hour >= 19 ? S.day + 1 : S.day) * 24 + 9;
  haeun.root.visible = false;
  loc.haeun = 'away';
  const st = relationshipStage(HAEUN_STAGES, S.aff);
  const lines = {
    '친구 · friends (almost)': 'Ha-eun almost smiled. Twice. Tomorrow at 7 in the practice room — don’t be late.',
    '동료 · colleagues': 'Grudging respect, earned over tteokbokki. She’ll pretend she didn’t enjoy tonight.',
    '아는 사이 · acquaintances': 'You’re not “the new trainee” anymore. That counts for something.',
    '낯선 사람 · strangers': 'She’ll remember the tteokbokki more than you. Maybe tomorrow.',
  };
  $('end-title').textContent = st;
  $('end-hearts').innerHTML = hearts(S.aff, S.maxAff);
  $('end-text').textContent = lines[st];
  const words = $('end-words');
  words.innerHTML = '';
  for (const [ko, { en }] of S.phrases) {
    const s = document.createElement('span');
    s.textContent = `${ko} · ${en}`;
    words.appendChild(s);
  }
  $('ending').classList.remove('hidden');
  ui.hud.classList.add('hidden');
  updateQuest();
  save();
}

function standUp() {
  player.pose = 'idle';
  player.root.position.set(SPOTS.playerSeat.x, 0, 0.8);
  player.root.rotation.y = Math.PI;
  cam.yaw = 0;
  if (playerFood) {
    scene.remove(playerFood);
    playerFood = null;
  }
  if (foodSteam) foodSteam.off = true;
  S.spicy = false;
  S.mistakes = 0;
}

let lookTower = false;
const quiz = { n: 0, score: 0, q: null };

function newQuizQ() {
  const pool = [...S.phrases].filter(([ko, v]) => v.en && /\p{Script=Hangul}/u.test(ko) && ko.length <= 8);
  const [ko, v] = pool[Math.floor(Math.random() * pool.length)];
  const others = shuffle([...S.phrases.values(), ...WORDS].map((x) => x.en).filter((e) => e && e !== v.en));
  quiz.q = { prompt: ko, answer: v.en, options: shuffle([v.en, ...new Set(others.slice(0, 6))].slice(0, 3)) };
  if (!quiz.q.options.includes(v.en)) quiz.q.options[0] = v.en;
  quiz.q.options = shuffle(quiz.q.options);
}

function quizChoices() {
  return quiz.q.options.map((o) => ({
    ko: o,
    en: '',
    hideEn: true,
    wrong: true,
    next: o === quiz.q.answer ? 'quiz_right' : 'quiz_wrong',
    do: () => {
      quiz.n++;
      if (o === quiz.q.answer) quiz.score++;
    },
  }));
}

let pendingPolaroid = null;
function polaroid(who) {
  pendingPolaroid = who;
  ui.fade.classList.add('flash');
  setTimeout(() => ui.fade.classList.remove('flash'), 400);
}

const A = {
  S,
  sitPlayer,
  serveFood,
  spicyFx,
  startExit,
  flipHair: (who) => (chars[who].hairFlip = 0.7),
  learn,
  done,
  toast,
  sfx,
  polaroid,
  lookAtTower: (on) => (lookTower = on),
  quiz,
  quizChoices,
  jinWave: () => {
    if (loc.jin === 'cafe' && !S.quests.jin) {
      jin.wave = 1.6;
      bubble(jin, '어, 여기야!', { dur: 2.4 });
    }
  },
};

const NODES = buildNodes(A);
NODES.quiz.enter = newQuizQ;
NODES.tent_again = { who: 'haeun', expr: 'smirk', ko: '…또 왔어? 오늘은 내가 살게. 약속했잖아.', en: '…You again? Tonight’s on me. I promised.', end: true };

const dlg = createDialogue({
  nodes: NODES,
  S,
  chars,
  addAff,
  learn,
  speak,
  sfx,
  bubble,
  onStart: () => {
    clearControls();
    setTransport('walk', true);
    overview = false;
    vistaIndex = -1;
    ui.prompt.classList.add('hidden');
    document.body.classList.add('talking');
  },
  onEnd: () => {
    document.body.classList.remove('talking');
    if (loc.haeun === 'studio' && S.haeunStory === 'idle') {
      haeun.pose = 'dance';
      haeun.root.rotation.y = -Math.PI / 2;
    }
    save();
  },
});

/* ── Interactions ────────────────────────────────── */

const BENCHES = [1.6, 9, 13.2].map((x) => new THREE.Vector3(x, TERRACE_Y, -44.35));

const interactables = [
  {
    label: '하은에게 말 걸기 · Talk to Ha-eun',
    pos: () => haeun.root.position,
    r: 2.1,
    on: () => loc.haeun === 'tent' && S.haeunStory === 'idle' && haeun.root.visible,
    act: () => {
      if (S.quests.haeun) return dlg.start('tent_again');
      S.haeunStory = 'talking';
      walkToCounter(() => (player.root.rotation.y = Math.atan2(SPOTS.haeunTent.x - STAND_SPOT.x, SPOTS.haeunTent.z - STAND_SPOT.z)));
      dlg.start('greet');
    },
  },
  {
    label: '하은 · Ha-eun',
    pos: () => haeun.root.position,
    r: 2.3,
    on: () => loc.haeun === 'studio' && haeun.root.visible,
    act: () => {
      haeun.pose = 'idle';
      haeun.root.rotation.y = Math.atan2(player.root.position.x - haeun.root.position.x, player.root.position.z - haeun.root.position.z);
      dlg.start(S.quests.haeun ? 'studio_after' : S.metHaeunStudio ? 'studio_tip' : 'studio_hi');
    },
  },
  {
    label: '아저씨 · Ajusshi',
    pos: () => SPOTS.ajusshi,
    r: 2.3,
    on: () => loc.tent && S.haeunStory === 'idle' && player.pose !== 'sit',
    act: () => dlg.start(S.quests.haeun ? 'ajusshi_later' : 'ajusshi_hello'),
  },
  { label: '간판 읽기 · Read the sign', pos: () => SPOTS.tentSign, r: 1.7, on: () => !loc.tent, act: () => dlg.start('tent_closed') },
  { label: '고양이 쓰다듬기 · Pet the cat', pos: () => SPOTS.cat, r: 1.4, on: () => true, act: petCat },
  { label: '자판기 · Vending machine', pos: () => SPOTS.vending, r: 1.3, on: () => true, act: vending },
  { label: '주문하기 · Order a drink', pos: () => new THREE.Vector3(15.6, 0, -16.5), r: 1.6, on: () => barista.root.visible, act: () => dlg.start('barista_hi') },
  {
    label: '진 · Jin',
    pos: () => jin.root.position,
    r: 2.0,
    on: () => jin.root.visible && loc.jin === 'cafe',
    act: () => dlg.start(S.quests.jin ? 'jin_again' : 'jin_hi'),
  },
  {
    label: '진 · Jin',
    pos: () => jin.root.position,
    r: 2.2,
    on: () => jin.root.visible && loc.jin === 'lookout',
    act: () => dlg.start(S.quests.jinNight ? 'jin_night_thanks' : 'jin_night'),
  },
  { label: '계산하기 · Buy something', pos: () => new THREE.Vector3(-11.6, 0, -12.6), r: 1.4, on: () => true, act: () => dlg.start('cashier_hi') },
  { label: '지하철 타기 · Take the subway', pos: () => SPOTS.subway, r: 1.6, on: () => true, act: openTravel },
  { label: '망원경 · Binoculars', pos: () => SPOTS.telescope, r: 1.2, on: () => true, act: () => dlg.start('telescope') },
  {
    label: '단어 퀴즈 · Word quiz',
    pos: () => SPOTS.whiteboard,
    r: 1.8,
    on: () => true,
    act: () => {
      quiz.n = 0;
      quiz.score = 0;
      const koreanPool = [...S.phrases].filter(([ko, v]) => v.en && /\p{Script=Hangul}/u.test(ko) && ko.length <= 8);
      dlg.start(koreanPool.length >= 4 ? 'quiz' : 'tong_quiz_empty');
    },
  },
  ...BENCHES.map((b) => ({
    label: '벤치에 앉기 · Sit & watch the river',
    pos: () => b,
    r: 1.3,
    on: () => !(loc.jin === 'lookout' && Math.abs(b.x - SPOTS.jinLookout.x) < 0.5),
    act: () => sitBench(b),
  })),
];

function petCat() {
  S.pettedCat = true;
  cat.purr = 1.5;
  sfx.meow();
  bubble(SPOTS.cat.clone().add(new THREE.Vector3(0, 0.5, 0)), '야옹~ ♥', { dur: 1.8 });
  if (!S.phrases.has('고양이')) {
    learn('고양이', 'goyangi', 'cat');
    toast('<b>고양이</b><span>goyangi · cat — her name tag says 떡이 (Tteok-i)</span>', 2800);
  }
}

function vending() {
  sfx.coin();
  learn('바나나우유', 'banana-uyu', 'banana milk');
  toast('<b>바나나우유</b><span>banana-uyu · banana milk. A Seoul essential.</span>', 2600);
}

function sitBench(b) {
  S.benchSit = b;
  player.pose = 'sit';
  player.root.position.copy(b);
  player.root.rotation.y = Math.PI;
  S.prevSpeed = S.speed;
  S.speed = 40;
  updateToggles();
  toast('<b>⏩</b><span>Time drifts by over the river… press E (or move) to stand up.</span>', 3000);
}

function standBench() {
  if (!S.benchSit) return;
  player.pose = 'idle';
  player.root.position.set(S.benchSit.x, TERRACE_Y, -43.4);
  S.benchSit = null;
  S.speed = S.prevSpeed ?? 1;
  updateToggles();
}

let activeInteract = null;
function updateInteract() {
  activeInteract = null;
  if (S.started && vistaIndex < 0 && !modalOpen() && !dlg.state.active && !player.auto && player.pose !== 'sit' && (S.city !== 'seoul' || S.haeunStory === 'idle')) {
    let best = Infinity;
    const p = player.root.position;
    const airport = currentCity().airport;
    const room = interiorAt(p, S.city);
    const local = cityPlaces().map((place) => ({
      label: `${place.icon} ${place.ko} · ${place.en}`,
      // Remote rooms retain their objective interaction throughout the room.
      // Seoul keeps its authored NPC/counter/quiz proximity and choreography.
      pos: () => S.city !== 'seoul' && room && room.id === place.interiorId ? p : new THREE.Vector3(...place.spawn), r: place.radius ?? 2.8,
      on: () => true, act: () => openPlace(place),
    }));
    local.unshift({ label: `✈ ${airport.name} · Flights`, pos: () => new THREE.Vector3(...airport.spawn), r: 4, on: () => true, act: () => openTravel('flights') });
    for (const it of [...(S.city === 'seoul' ? interactables : []), ...local]) {
      if (!it.on()) continue;
      const q = it.pos();
      if (Math.abs(q.y - p.y) > 1.5) continue;
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < it.r && d < best) {
        best = d;
        activeInteract = it;
      }
    }
  }
  if (activeInteract) {
    const label = `<kbd>E</kbd> ${activeInteract.label}`;
    if (ui.prompt.innerHTML !== label) ui.prompt.innerHTML = label;
    ui.prompt.classList.remove('hidden');
  } else if (S.benchSit) {
    const label = '<kbd>E</kbd> 일어나기 · Stand up';
    if (ui.prompt.innerHTML !== label) ui.prompt.innerHTML = label;
    ui.prompt.classList.remove('hidden');
  } else ui.prompt.classList.add('hidden');
}

function interact() {
  if (modalOpen() || dlg.state.active || !traversal.grounded) return;
  setTransport('walk', true);
  if (S.benchSit) return standBench();
  activeInteract?.act();
}

/* ── City adventures & travel ────────────────────── */

let transitioning = false;
let activityPlace = null;
function modalOpen() {
  return transitioning || !!document.querySelector('.overlay:not(.hidden)') || !ui.book.classList.contains('hidden');
}
function clearControls() {
  keys.clear();
  stopTraversal(traversal);
  braking = false;
  for (const [id] of lookPointers) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  if (stick.id !== null && ui.stick.hasPointerCapture(stick.id)) ui.stick.releasePointerCapture(stick.id);
  lookPointers.clear();
  pinchDistance = 0;
  stick.id = null;
  stick.x = stick.y = 0;
  ui.knob.style.transform = '';
  activeInteract = null;
  ui.prompt.classList.add('hidden');
}
function adventure() {
  return S.adventures[S.city] ??= { discovered: [], mastered: [], step: 0 };
}
function roleOf(p) {
  if (['food', 'cafe', 'store', 'subway', 'studio', 'scenic'].includes(p.category ?? p.role)) return p.category ?? p.role;
  const text = `${p.id} ${p.en}`.toLowerCase();
  if (/food|market|ramen|yatai|snack|pojang|tteok/.test(text)) return 'food';
  if (/cafe|café|coffee/.test(text)) return 'cafe';
  if (/subway|station|metro/.test(text)) return 'subway';
  if (/store|convenience/.test(text)) return 'store';
  if (/studio|practice/.test(text)) return 'studio';
  return 'scenic';
}
function errandPlaces() {
  const places = cityPlaces();
  return [places.find((p) => roleOf(p) === 'food'), places.find((p) => roleOf(p) === 'cafe'), places.find((p) => roleOf(p) === 'scenic')];
}
function errandLabel() {
  const a = adventure();
  const target = errandPlaces()[a.step];
  return a.step === 3 ? '✓ Postcard earned! Keep exploring and learning.' : `${['🥡 Pick up a snack', '☕ Deliver your snack', '📮 Collect a scenic postcard'][a.step]} · ${target?.en ?? currentCity().name}`;
}
const SEOUL_PHRASES = {
  food: { text: '포장해 주세요', rom: 'pojanghae juseyo', en: 'Please pack it to go' },
  cafe: { text: '여기 있어요', rom: 'yeogi isseoyo', en: 'Here it is' },
  store: { text: '얼마예요?', rom: 'eolmayeyo?', en: 'How much is it?' },
  subway: { text: '어디예요?', rom: 'eodiyeyo?', en: 'Where is it?' },
  studio: { text: '연습해요', rom: 'yeonseuphaeyo', en: 'Let’s practice' },
  scenic: { text: '정말 아름다워요', rom: 'jeongmal areumdawoyo', en: 'It is really beautiful' },
};
function phraseFor(p) { return p.phrase ?? SEOUL_PHRASES[roleOf(p)]; }
function discover(p) {
  const a = adventure();
  if (a.discovered.includes(p.id)) return;
  a.discovered.push(p.id);
  banner(`${p.icon} ${p.ko}`, p.en);
  updateQuest();
  save();
}
function closeActivity() {
  $('city-activity').classList.add('hidden');
  activityPlace = null;
  clearControls();
}
function openPlace(p) {
  if (transitioning || dlg.state.active) return;
  clearControls();
  activityPlace = p;
  discover(p);
  const phrase = phraseFor(p);
  $('activity-title').textContent = `${p.icon} ${p.ko} · ${p.en}`;
  $('activity-description').textContent = p.description ?? `A stop in ${currentCity().name}. Practice a local phrase with Tong.`;
  $('activity-objective').textContent = errandLabel();
  $('activity-native').textContent = phrase.text;
  $('activity-phonetic').textContent = phrase.rom;
  $('activity-feedback').textContent = `What does this phrase mean? Learn it to help with your local errand.`;
  const choices = $('activity-choices');
  choices.replaceChildren();
  const distractors = [...new Set(cityPlaces().map((q) => phraseFor(q).en))].filter((en) => en !== phrase.en);
  for (const fallback of ['Good night', 'Where is the station?', 'Thank you']) {
    if (fallback !== phrase.en && !distractors.includes(fallback)) distractors.push(fallback);
  }
  const options = [phrase.en, ...distractors.slice(0, 2)];
  const shift = [...p.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % options.length;
  const ordered = [...options.slice(shift), ...options.slice(0, shift)];
  ordered.forEach((answer) => {
    const b = document.createElement('button');
    b.className = 'place';
    b.textContent = answer;
    b.onclick = () => {
      if (activityPlace !== p || transitioning) return;
      if (answer !== phrase.en) {
        $('activity-feedback').textContent = 'Not quite. Look at the phonetic help and try another meaning. Your errand has not advanced.';
        b.disabled = true;
        return;
      }
      const a = adventure();
      if (!a.mastered.includes(p.id)) a.mastered.push(p.id);
      learn(phrase.text, phrase.rom, phrase.en);
      const targets = errandPlaces();
      let feedback = `✓ ${phrase.text} · ${phrase.en}. Phrase saved to your book.`;
      if (a.step < 3 && targets[a.step]?.id === p.id) {
        a.step++;
        feedback += [' Snack packed! Carry it to the café.', ' Delivered! Head to the scenic stop for your postcard.', ` Postcard unlocked: ${currentCity().nativeName} memory!`][a.step - 1];
        if (a.step === 3 && !S.postcards.includes(S.city)) {
          S.postcards.push(S.city);
          showPostcard(S.city);
        }
      } else if (a.step < 3) feedback += ` Next: ${errandLabel()}`;
      $('activity-feedback').textContent = feedback;
      $('activity-objective').textContent = errandLabel();
      choices.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      sfx.chime();
      tong.spin = 0.8;
      updateQuest();
      save();
    };
    choices.appendChild(b);
  });
  $('activity-transit').classList.toggle('hidden', roleOf(p) !== 'subway');
  $('activity-transit').onclick = () => { closeActivity(); openTravel('subway'); };
  $('city-activity').classList.remove('hidden');
  $('activity-close').focus();
}
function showPostcard(id) {
  closeActivity();
  const city = cities[id];
  $('polaroid-img').src = `/assets/locations/${id}-static.png`;
  $('polaroid-caption').textContent = `${city.nativeName} · Local errand complete`;
  $('polaroid-date').textContent = `Day ${S.day} · ${city.name} · Collectible postcard`;
  $('polaroid').classList.remove('hidden');
  $('polaroid-close').focus();
}
function advanceHours(hours) {
  const total = S.hour + hours;
  S.day += Math.floor(total / 24);
  S.hour = total % 24;
}
function syncCity() {
  for (const [id, group] of Object.entries(cityGroups)) group.visible = S.city === id;
  if (S.city === 'seoul') {
    loc.haeun = loc.jin = null;
    cashier.root.visible = true;
    updateSchedules(true);
  } else for (const c of [haeun, jin, ajusshi, barista, cashier]) c.root.visible = false;
  cat.g.visible = S.city === 'seoul';
  for (const pd of peds) pd.c.root.visible = S.city === 'seoul';
  motes.visible = S.city === 'seoul';
  for (const p of pickups) p.sprite.visible = p.glow.visible = S.city === 'seoul' && !p.taken;
  ui.questHint.textContent = '';
  lastZone = null;
  lastClock = '';
  drawMapBg();
  updateQuest();
  waypointId = null;
  populateLocations();
  updateCameraButtons();
}
function prepareTransition() {
  clearControls();
  setTransport('walk', true);
  resetTraversal(traversal);
  overview = false;
  vistaIndex = -1;
  standBench();
  player.auto = null;
  player.pose = 'idle';
  lookTower = false;
  if (playerFood) { scene.remove(playerFood); playerFood = null; }
  if (foodSteam) foodSteam.off = true;
  spicyFx(false);
  for (const b of bubbles) b.el.remove();
  bubbles.length = 0;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('city-activity').classList.add('hidden');
  activityPlace = null;
  ui.travel.classList.add('hidden');
  ui.book.classList.add('hidden');
  ui.fade.classList.add('on');
  sfx.whoosh();
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function changeCity(id, { skipAnimation = false, demo = false } = {}) {
  if (!Object.hasOwn(cities, id) || id === S.city || transitioning || (demo && !demoEnabled)) return false;
  const from = currentCity().name;
  S.cityPositions[S.city] = safePose();
  transitioning = true;
  clearControls();
  // A chosen Seoul response has a 750ms feedback callback. Let it settle
  // behind a hidden dialogue before ending it, so it cannot reopen abroad.
  $('dialogue').classList.add('hidden');
  if (dlg.state.locked) await wait(800);
  if (dlg.state.active) dlg.end();
  if (S.haeunStory !== 'idle') {
    S.haeunStory = 'idle';
    haeun.path = null;
    haeun.waveT = 0;
    loc.haeun = null;
  }
  prepareTransition();
  if (!skipAnimation) await wait(650);
  S.city = id;
  if (!demo) advanceHours(2);
  const destination = currentCity();
  placePlayer(demo ? S.cityPositions[id] : { position: destination.airport.spawn, yaw: destination.yaw });
  syncCity();
  save();
  if (!skipAnimation) await wait(250);
  ui.fade.classList.remove('on');
  transitioning = false;
  clearControls();
  banner(destination.nativeName, demo ? `Demo shortcut · ${destination.name} · Progress preserved` : `${from} → ${destination.name} · Arrived at ${destination.airport.name}`);
  toast(demo ? `<b>Demo · ${destination.name}</b><span>Immediate jump. Progress and clock preserved; turn Demo off for normal airport travel.</span>` : `<b>✈ ${destination.name}</b><span>Two hours later · ${koreanTime(localHour()).digital} local · Explore on foot or use this city’s subway.</span>`, 4200);
  return true;
}
function openTravel(mode = 'subway') {
  if (transitioning || dlg.state.active || S.haeunStory !== 'idle') return false;
  clearControls();
  const flights = mode === 'flights';
  $('travel-badge').textContent = flights ? '✈' : S.city === 'seoul' ? '2' : 'M';
  $('travel-title').textContent = flights ? `✈ ${currentCity().airport.nativeName}` : `🚇 ${currentCity().name} · Local transit`;
  $('travel-subtitle').textContent = flights ? 'Choose a real destination. Two-hour flight · progress stays saved. All cities are compressed interpretations.' : 'Local stops only. To fly, take the airport connection below or walk to the ✈ marker.';
  const list = $('travel-list');
  list.replaceChildren();
  list.classList.toggle('hidden', flights);
  const airport = { id: 'airport', icon: '✈', ko: currentCity().airport.nativeName, en: `${currentCity().airport.name} · airport connection`, spawn: currentCity().airport.spawn, yaw: currentCity().yaw };
  if (!flights) for (const p of [...cityPlaces(), airport]) {
    const b = document.createElement('button');
    b.className = 'place';
    b.innerHTML = '<span class="icon"></span><span class="txt"><b></b><small></small></span>';
    b.querySelector('.icon').textContent = p.icon;
    b.querySelector('b').textContent = p.ko;
    b.querySelector('small').textContent = p.en;
    b.onclick = () => travelTo(p);
    list.appendChild(b);
  }
  const cards = $('flight-cities');
  cards.replaceChildren();
  cards.classList.toggle('hidden', !flights);
  if (flights) for (const city of Object.values(cities)) {
    const b = document.createElement('button');
    b.className = 'city';
    b.disabled = city.id === S.city;
    b.innerHTML = '<img alt=""><span><b></b><small></small></span>';
    b.querySelector('img').src = `/assets/locations/${city.id}-static.png`;
    b.querySelector('b').textContent = `${city.nativeName} · ${city.name}`;
    b.querySelector('small').textContent = city.id === S.city ? 'You are here' : 'Fly · compressed city';
    b.onclick = () => changeCity(city.id);
    cards.appendChild(b);
  }
  ui.travel.classList.remove('hidden');
  $('travel-close').focus();
  sfx.whoosh();
  return true;
}
async function travelTo(p, { skipAnimation = false } = {}) {
  if (!p || transitioning || dlg.state.active || S.haeunStory !== 'idle') return false;
  transitioning = true;
  prepareTransition();
  if (!skipAnimation) await wait(650);
  placePlayer({ position: p.spawn, yaw: p.yaw });
  advanceHours(0.2);
  save();
  ui.fade.classList.remove('on');
  transitioning = false;
  clearControls();
  toast(`<b>${p.icon} ${p.ko}</b><span>${p.en} · ${p.id === 'airport' ? 'Airport connection arrived. Press E at the terminal to choose a flight.' : 'Local transit arrival — no flight taken.'}</span>`, 3400);
  return true;
}

/* ── Minimap ─────────────────────────────────────── */

const mm = { ctx: ui.minimap.getContext('2d'), bg: null };
function mapXY(x, z) {
  const b = currentCity().bounds;
  const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 12;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  // Original Seoul faces the Han River toward -z (south). Other cities use -z north.
  const north = S.city === 'seoul' ? -1 : 1;
  return [(0.5 + (x - cx) / size) * ui.minimap.width, (0.5 + north * (z - cz) / size) * ui.minimap.height];
}

function drawMapBg() {
  const [c, g] = makeCanvas(ui.minimap.width, ui.minimap.height);
  g.fillStyle = '#2b2f3f';
  g.fillRect(0, 0, c.width, c.height);
  const path = (points) => {
    g.beginPath();
    points.forEach(([x, z], i) => {
      const [px, py] = mapXY(x, z);
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    });
  };
  for (const feature of currentCity().mapFeatures ?? []) {
    path(feature.points);
    g.closePath();
    g.fillStyle = feature.color;
    g.fill();
  }
  const b = currentCity().bounds;
  const scale = c.width / (Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 12);
  const coreRoads = S.city === 'seoul' ? [
    { points: [[0, 29], [0, -19], [5, -28], [5, -41]], width: 7 },
    { points: [[-15, -16], [16, -16]], width: 6 },
    { points: [[-4, -37.5], [14, -37.5]], width: 5 },
  ] : [];
  for (const road of [...coreRoads, ...currentCity().roads]) {
    path(road.points);
    g.lineWidth = Math.max(2, road.width * scale);
    g.strokeStyle = road.color ?? '#8b8277';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }
  g.font = '15px sans-serif';
  g.textAlign = 'center';
  for (const p of cityPlaces()) {
    const [x, y] = mapXY(p.spawn[0], p.spawn[2]);
    g.fillText(p.icon, x, y);
  }
  const [ax, ay] = mapXY(currentCity().airport.spawn[0], currentCity().airport.spawn[2]);
  g.fillText('✈', ax, ay);
  g.textAlign = 'left';
  g.fillStyle = '#fff1da';
  g.font = 'bold 17px sans-serif';
  g.fillText('↑ N', 12, 24);
  mm.bg = c;
  const legend = $('map-legend');
  legend.replaceChildren();
  for (const p of cityPlaces()) {
    const row = document.createElement('span');
    row.textContent = `${p.icon} ${p.en}`;
    legend.appendChild(row);
  }
  const airportLabel = document.createElement('span');
  airportLabel.textContent = `✈ ${currentCity().airport.name} · Walk here for flights`;
  legend.appendChild(airportLabel);
}

function drawMinimap() {
  if ($('map-panel').classList.contains('hidden')) return;
  const g = mm.ctx;
  g.drawImage(mm.bg, 0, 0);
  for (const p of S.city === 'seoul' ? pickups : []) {
    if (p.taken) continue;
    const [x, y] = mapXY(p.w.at[0], p.w.at[1]);
    g.fillStyle = '#ffd23f';
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  const dot = (c, col) => {
    if (!c.root.visible) return;
    const [x, y] = mapXY(c.root.position.x, c.root.position.z);
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, 3.5, 0, Math.PI * 2);
    g.fill();
  };
  dot(haeun, '#ff6b8a');
  dot(jin, '#6bb6ff');
  const [px, py] = mapXY(player.root.position.x, player.root.position.z);
  g.save();
  g.translate(px, py);
  const yaw = player.root.rotation.y;
  g.rotate(Math.atan2(Math.sin(yaw), -(S.city === 'seoul' ? -1 : 1) * Math.cos(yaw)));
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.restore();
}

/* ── Input ───────────────────────────────────────── */

const keys = new Set();
const cam = { yaw: 0, pitch: 0.36, dist: 6.5, look: new THREE.Vector3(), pos: new THREE.Vector3(), snap: true, mode: 'follow' };
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const lookPointers = new Map();
let pinchDistance = 0;
const actionsAllowed = () => S.started && !modalOpen() && !dlg.state.active && !player.auto && S.haeunStory === 'idle';
function jump() {
  if (!actionsAllowed() || player.pose === 'sit') return;
  safePose();
  queueJump(traversal);
}
function zoom(factor) {
  if (!actionsAllowed()) return;
  vistaIndex = -1;
  cam.dist = clamp(cam.dist * factor, 2.5, 24);
  updateCameraButtons();
}
function followCamera() {
  overview = false;
  vistaIndex = -1;
  updateCameraButtons();
}
function orbit(dx, dy = 0) {
  if (!actionsAllowed()) return;
  vistaIndex = -1;
  cam.yaw = wrapAngle(cam.yaw - dx);
  cam.pitch = clamp(cam.pitch + dy, 0.08, 1.35);
  updateCameraButtons();
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (modalOpen()) {
    keys.clear();
    if (k === 'b' && !transitioning && !ui.book.classList.contains('hidden') && !e.target.closest('input, select, textarea')) ui.book.classList.add('hidden');
    if (k === 'escape' && !transitioning) {
      ui.travel.classList.add('hidden');
      ui.book.classList.add('hidden');
      $('polaroid').classList.add('hidden');
      $('tools-panel')?.classList.add('hidden');
      closeActivity();
      clearControls();
    }
    const modal = [...document.querySelectorAll('.overlay:not(.hidden)')].at(-1) ?? (!ui.book.classList.contains('hidden') ? ui.book : null);
    if (k === 'tab' && modal) {
      const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter((el) => !el.closest('.hidden'));
      const index = focusable.indexOf(document.activeElement);
      if (focusable.length) {
        e.preventDefault();
        focusable[(index + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
      }
    }
    if (!e.target.closest('input, select, textarea') && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    return;
  }
  if (e.target.closest('input, select, textarea, [contenteditable="true"]') || !S.started) return;
  if (dlg.state.active) {
    if (e.target.closest('#choices button') && [' ', 'enter'].includes(k)) return;
    if (k === ' ' || k === 'enter' || k === 'e') {
      e.preventDefault();
      if (!e.repeat) dlg.advance();
    }
    if (/^[1-4]$/.test(k) && !e.repeat) dlg.choose(Number(k) - 1);
    return;
  }
  if (e.target.closest('button') && [' ', 'enter'].includes(k)) return;
  keys.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === ' ') jump();
  if (k === 'e' || k === 'enter') interact();
  if (k === 'escape') { followCamera(); clearControls(); }
  if (k === 'b') { clearControls(); ui.book.classList.toggle('hidden'); }
  if (k === 't') toggleEn();
  if (k === 'm') toggleMute();
  if (k === 'n') toggleMap();
  if (k === 'h') tongTalk();
  if (k === 'f') setSpeed(S.speed === 8 ? 1 : 8);
  if (k === '+' || k === '=') zoom(0.85);
  if (k === '-') zoom(1 / 0.85);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', clearControls);
window.addEventListener('orientationchange', () => { clearControls(); resizeStage(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) clearControls(); });
const modalObserver = new MutationObserver(() => { if (modalOpen()) clearControls(); });
for (const el of [...document.querySelectorAll('.overlay'), ui.book]) modalObserver.observe(el, { attributes: true, attributeFilter: ['class'] });

ui.stick.style.touchAction = 'none';
canvas.style.touchAction = 'none';
ui.stick.addEventListener('pointerdown', (e) => {
  if (!actionsAllowed() || stick.id !== null) return;
  e.preventDefault();
  const r = ui.stick.getBoundingClientRect();
  stick.id = e.pointerId;
  stick.ox = r.left + r.width / 2;
  stick.oy = r.top + r.height / 2;
  ui.stick.setPointerCapture(e.pointerId);
  updateStick(e);
});
function updateStick(e) {
  if (e.pointerId !== stick.id) return;
  const r = ui.stick.getBoundingClientRect();
  const radius = Math.max(16, r.width * 0.34);
  const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
  const length = Math.hypot(dx, dy) || 1;
  const scale = Math.min(1, radius / length);
  stick.x = dx * scale / radius;
  stick.y = dy * scale / radius;
  ui.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
}
ui.stick.addEventListener('pointermove', (e) => { if (actionsAllowed()) updateStick(e); });
function endStick(e) {
  if (e.pointerId !== stick.id) return;
  stick.id = null;
  stick.x = stick.y = 0;
  ui.knob.style.transform = '';
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) ui.stick.addEventListener(event, endStick);

function pointerDistance() {
  const [a, b] = [...lookPointers.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}
canvas.addEventListener('pointerdown', (e) => {
  if (!actionsAllowed()) return;
  e.preventDefault();
  lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  pinchDistance = pointerDistance();
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!actionsAllowed() || !lookPointers.has(e.pointerId)) return;
  const previous = lookPointers.get(e.pointerId);
  lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (lookPointers.size >= 2) {
    const distance = pointerDistance();
    if (pinchDistance > 5 && distance > 5) zoom(pinchDistance / distance);
    pinchDistance = distance;
  } else {
    const r = stageRect();
    orbit((e.clientX - previous.x) * Math.PI * 2 / Math.max(240, r.width), (e.clientY - previous.y) * Math.PI / Math.max(240, r.height));
  }
});
const endPointer = (e) => {
  lookPointers.delete(e.pointerId);
  pinchDistance = pointerDistance();
};
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, endPointer);
canvas.addEventListener('wheel', (e) => {
  if (!actionsAllowed()) return;
  e.preventDefault();
  const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.height : 1);
  zoom(Math.exp(clamp(delta * 0.002, -0.5, 0.5)));
}, { passive: false });

ui.prompt.addEventListener('click', interact);
function toggleEn() {
  S.showEn = !S.showEn;
  updateToggles();
}
function toggleMute() {
  setMuted(!audio.muted);
  if (audio.muted && 'speechSynthesis' in window) speechSynthesis.cancel();
  updateToggles();
}
function setSpeed(s) {
  S.speed = s;
  updateToggles();
}
function setHour(h) {
  if (transitioning) return;
  S.hour = (h + (S.city === 'shanghai' ? 1 : 0)) % 24;
  sfx.whoosh();
}
function tongTalk() {
  if (modalOpen() || dlg.state.active) return;
  if (S.city !== 'seoul') {
    const greeting = S.city === 'tokyo' ? (localHour() < 17 ? 'こんにちは · Konnichiwa' : 'こんばんは · Konbanwa') : (localHour() < 17 ? '你好 · Nǐ hǎo' : '晚上好 · Wǎnshàng hǎo');
    bubble(tong, `${greeting}! ${errandLabel()}`, { dur: 5 });
    ui.questHint.textContent = `${currentCity().subtitle} · ${errandLabel()} · E / tap to practice at a landmark.`;
    tong.spin = 0.8;
    return;
  }
  const h = tongHint(S, S.hour);
  tong.expr = { cheerful: 'happy', excited: 'laugh', love: 'blush', thinking: 'neutral', proud: 'smile' }[h.expr] ?? 'happy';
  tong.exprT = 3;
  tong.talkT = 1.4;
  tong.spin = 0.8;
  bubble(tong, h.ko, { dur: 3.2 });
  speak(h.ko, 'tong');
  ui.questHint.innerHTML = `<img src="img/tong-${h.expr}.png" alt=""><span>${h.en}</span>`;
}
$('btn-en').onclick = toggleEn;
$('btn-mute').onclick = toggleMute;
$('btn-voice').onclick = () => {
  voice.on = !voice.on;
  updateToggles();
};
$('btn-book').onclick = () => ui.book.classList.toggle('hidden');
function toggleMap() {
  const panel = $('map-panel');
  if (stage.width <= 900) {
    panel.classList.remove('hidden');
    panel.classList.toggle('expanded');
  } else panel.classList.toggle('hidden');
}
$('btn-map').onclick = toggleMap;
$('map-expand').onclick = () => $('map-panel').classList.toggle('expanded');
ui.minimap.onclick = () => $('map-panel').classList.toggle('expanded');
$('map-close').onclick = () => $('map-panel').classList.add('hidden');
$('activity-close').onclick = closeActivity;
$('btn-postcards').onclick = () => {
  const id = S.postcards.includes(S.city) ? S.city : S.postcards[0];
  if (id && !transitioning) { clearControls(); showPostcard(id); }
  else toast('<b>📮 City postcards</b><span>Pick up a snack, deliver it to the café, then practice at the scenic stop. Earn a postcard in every city!</span>', 4000);
};
$('btn-tong').onclick = tongTalk;
$('book-close').onclick = () => ui.book.classList.add('hidden');
$('travel-close').onclick = () => { ui.travel.classList.add('hidden'); clearControls(); };
$('t-pause').onclick = () => setSpeed(0);
$('t-play').onclick = () => setSpeed(1);
$('t-fast').onclick = () => setSpeed(8);
$('t-dawn').onclick = () => setHour(6.2);
$('t-noon').onclick = () => setHour(12);
$('t-dusk').onclick = () => setHour(17.8);
$('t-night').onclick = () => setHour(20.5);
$('polaroid-close').onclick = () => $('polaroid').classList.add('hidden');

/* ── Play tools (normal travel remains airport/subway gated) ── */

function setTransport(mode, force = false) {
  if (!Object.hasOwn(MODES, mode)) return false;
  if (!force && (!S.started || transitioning || dlg.state.active || player.auto || player.pose === 'sit' || !traversal.grounded)) return false;
  const p = player?.root.position;
  if (mode !== 'walk' && p && interiorAt(p, S.city)) {
    mode = 'walk';
    if (!force) toast('<b>Walk indoors</b><span>Your ride stays packed while you explore the room.</span>');
  }
  if (mode !== 'walk' && p && G.colliders.some((b) => overlaps(p.x, p.z, MODES[mode].radius, b))) mode = 'walk';
  traversal.mode = mode;
  stopTraversal(traversal);
  rides?.resetPose();
  if ($('transport-select')) $('transport-select').value = mode;
  return true;
}
function updateCameraButtons() {
  if ($('camera-view')) {
    $('camera-view').textContent = overview ? 'Return to follow' : 'Overview';
    $('camera-view').setAttribute('aria-pressed', String(overview));
  }
  const vistas = currentCity().vistas ?? [];
  if ($('landmark-view')) {
    $('landmark-view').disabled = !vistas.length;
    $('landmark-view').textContent = vistaIndex >= 0 ? 'Return to player' : `Signature view · ${vistas[0]?.title ?? currentCity().name}`;
    $('landmark-view').setAttribute('aria-pressed', String(vistaIndex >= 0));
  }
}
function resetCamera() {
  if (!actionsAllowed()) return;
  followCamera();
  cam.yaw = currentCity().yaw;
  cam.pitch = 0.36;
  cam.dist = 6.5;
  cam.snap = true;
}
let waypointId = null;
const categoryNames = { food: 'Food Street', cafe: 'Cafe', store: 'Convenience Store', subway: 'Subway Hub', studio: 'Practice Studio', scenic: 'Landmark' };
function populateLocations() {
  const select = $('demo-place-select'), list = $('location-list');
  const selected = select?.value;
  select?.replaceChildren();
  list?.replaceChildren();
  const progress = adventure();
  for (const p of cityPlaces()) {
    if (select) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${categoryNames[roleOf(p)]} · ${p.en}`;
      select.appendChild(option);
    }
    if (list) {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'place';
      const room = interiors.find((i) => i.city === S.city && (i.id === p.interiorId || (i.category === roleOf(p) && p.category)));
      const target = p.entry ?? room?.door ?? p.spawn;
      const distance = player ? Math.round(Math.hypot(player.root.position.x - target[0], player.root.position.z - target[2])) : 0;
      button.textContent = `${p.icon} ${categoryNames[roleOf(p)]} · ${p.en} · ${distance}m${room ? ' · Walk-in room' : ''} · ${progress.mastered.includes(p.id) ? 'Learned ✓' : progress.discovered.includes(p.id) ? 'Explored ✓' : 'Explore'}`;
      button.onclick = () => {
        waypointId = p.id;
        if (select) select.value = p.id;
        $('tools-panel')?.classList.add('hidden');
        clearControls();
        toast('<b>Wayfinding</b><span>Follow the on-screen place label. Use Demo → Jump to place only if you want a shortcut.</span>', 3200);
      };
      row.appendChild(button);
      list.appendChild(row);
    }
  }
  for (const [index, vista] of (currentCity().vistas ?? []).entries()) {
    if (!list) break;
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place';
    button.textContent = `📷 View · ${vista.nativeName ?? ''} · ${vista.title} · Camera only`;
    button.onclick = () => {
      $('tools-panel')?.classList.add('hidden');
      clearControls();
      if (!actionsAllowed()) return;
      vistaIndex = index;
      overview = false;
      cam.snap = true;
      updateCameraButtons();
      banner(vista.nativeName ?? vista.title, `${vista.title} · Orbit or use Return to player to resume following`);
      canvas.focus();
    };
    row.appendChild(button);
    list.appendChild(row);
  }
  if (select && [...select.options].some((o) => o.value === selected)) select.value = selected;
  if ($('demo-city-select')) $('demo-city-select').value = S.city;
}
async function demoJump(id, placeId = null) {
  if (!demoEnabled || !S.started || transitioning || dlg.state.active || S.haeunStory !== 'idle') return false;
  clearControls();
  $('tools-panel')?.classList.add('hidden');
  if (id !== S.city && !await changeCity(id, { skipAnimation: true, demo: true })) return false;
  if (placeId) {
    const p = cityPlaces().find((place) => place.id === placeId);
    if (!p) return false;
    prepareTransition();
    placePlayer({ position: p.spawn, yaw: p.yaw });
    ui.fade.classList.remove('on');
    save();
    banner(p.ko, `Demo shortcut · ${p.en} · Progress preserved`);
  }
  return true;
}
function bindTools() {
  const cameraTools = ['orbit-left', 'orbit-right', 'camera-reset', 'camera-view', 'landmark-view'];
  const bind = (id, fn) => {
    if ($(id)) $(id).onclick = (e) => {
      if (cameraTools.includes(id) && !$('tools-panel')?.classList.contains('hidden')) {
        $('tools-panel').classList.add('hidden');
        clearControls();
        canvas.focus();
      }
      fn(e);
      if (!modalOpen() && !dlg.state.active) canvas.focus();
    };
  };
  canvas.tabIndex = 0;
  bind('btn-tools', () => {
    if (!S.started || transitioning || dlg.state.active) return;
    clearControls();
    populateLocations();
    $('tools-panel').classList.remove('hidden');
    $('tools-close').focus();
  });
  bind('tools-close', () => { $('tools-panel').classList.add('hidden'); clearControls(); canvas.focus(); });
  if ($('demo-enabled')) $('demo-enabled').onchange = (e) => {
    demoEnabled = e.target.checked;
    clearControls();
    for (const id of ['demo-go', 'demo-place-go', 'demo-city-select', 'demo-place-select']) if ($(id)) $(id).disabled = !demoEnabled;
  };
  for (const id of ['demo-go', 'demo-place-go', 'demo-city-select', 'demo-place-select']) if ($(id)) $(id).disabled = true;
  if ($('demo-enabled')) $('demo-enabled').checked = false;
  bind('demo-go', () => demoJump($('demo-city-select').value));
  bind('demo-place-go', () => demoJump(S.city, $('demo-place-select').value));
  bind('zoom-in', () => zoom(0.82));
  bind('zoom-out', () => zoom(1 / 0.82));
  bind('orbit-left', () => orbit(-Math.PI / 6));
  bind('orbit-right', () => orbit(Math.PI / 6));
  bind('camera-reset', resetCamera);
  bind('camera-view', () => {
    if (!actionsAllowed()) return;
    overview = !overview;
    vistaIndex = -1;
    updateCameraButtons();
  });
  bind('landmark-view', () => {
    if (!actionsAllowed() || !currentCity().vistas?.length) return;
    vistaIndex = vistaIndex >= 0 ? -1 : 0;
    overview = false;
    cam.snap = true;
    updateCameraButtons();
    if (vistaIndex >= 0) {
      const v = currentCity().vistas[vistaIndex];
      banner(v.nativeName ?? v.title, v.description ?? v.title);
    }
  });
  if ($('transport-select')) $('transport-select').onchange = (e) => {
    if (!setTransport(e.target.value)) e.target.value = traversal.mode;
  };
  bind('run-toggle', () => {
    if (!actionsAllowed()) return;
    runEnabled = !runEnabled;
    $('run-toggle').setAttribute('aria-pressed', String(runEnabled));
    $('run-toggle').textContent = runEnabled ? 'Run: on' : 'Run';
  });
  bind('jump-button', jump);
  const brake = $('brake-button');
  if (brake) {
    brake.style.touchAction = 'none';
    brake.onpointerdown = (e) => {
      if (!actionsAllowed()) return;
      e.preventDefault();
      braking = true;
      brake.setPointerCapture(e.pointerId);
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) brake.addEventListener(event, () => { braking = false; });
    brake.onkeydown = (e) => { if ((e.key === ' ' || e.key === 'Enter') && actionsAllowed()) braking = true; };
    brake.onkeyup = brake.onblur = () => { braking = false; };
  }
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('tong-cozy-layout') ?? '{}') ?? {}; } catch { /* local preferences only */ }
  function applySettings() {
    document.body.dataset.layout = ['portrait', 'landscape'].includes(settings.layout) ? settings.layout : 'auto';
    document.body.dataset.textScale = settings.textScale === 'large' ? 'large' : 'normal';
    if ($('view-layout')) $('view-layout').value = document.body.dataset.layout;
    if ($('text-scale')) $('text-scale').value = document.body.dataset.textScale;
    clearControls();
    requestAnimationFrame(resizeStage);
    try { localStorage.setItem('tong-cozy-layout', JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }
  if ($('view-layout')) $('view-layout').onchange = (e) => { settings.layout = e.target.value; applySettings(); };
  if ($('text-scale')) $('text-scale').onchange = (e) => { settings.textScale = e.target.value; applySettings(); };
  bind('fullscreen-button', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell?.requestFullscreen) await shell.requestFullscreen();
      else throw new Error('Unavailable');
    } catch { toast('<b>Fullscreen unavailable</b><span>You can still use Auto, Portrait or Landscape preview.</span>'); }
    resizeStage();
  });
  applySettings();
  updateCameraButtons();
}
bindTools();

/* ── Update ──────────────────────────────────────── */

let lastTraversalSpeed = 0;
function traversalEnvironment() {
  const colliders = [...G.colliders];
  for (const c of [haeun, jin, barista, cashier]) {
    if (!c.root.visible || Math.abs(c.root.position.y - player.root.position.y) > 1.5) continue;
    const q = c.root.position;
    colliders.push({ minX: q.x - 0.2, maxX: q.x + 0.2, minZ: q.z - 0.2, maxZ: q.z + 0.2 });
  }
  return {
    colliders, heightAt, bounds: currentCity().bounds,
    ceilingAt: (x, z) => {
      const floor = heightAt(x, z);
      const room = interiorAt({ x, y: floor, z }, S.city) ?? interiors.find((candidate) =>
        candidate.city === S.city && Math.abs(candidate.floorY - floor) < 0.3 && Math.hypot(x - candidate.door[0], z - candidate.door[2]) < 0.45);
      return room?.ceilingAt?.(x, z) ?? room?.bounds.maxY;
    },
  };
}
function updatePlayer(dt) {
  let speed = 0;
  const p = player.root.position;
  const blocked = modalOpen();
  if (S.benchSit && !blocked && (keys.has('w') || keys.has('s') || keys.has('a') || keys.has('d') || Math.hypot(stick.x, stick.y) > 0.3)) standBench();
  if (player.auto && !blocked) {
    // Keep the authored Seoul counter choreography, including dialogue walks.
    const target = player.auto.path[0];
    const dx = target.x - p.x, dz = target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) {
      player.auto.path.shift();
      if (!player.auto.path.length) {
        const fn = player.auto.onArrive;
        player.auto = null;
        fn?.();
      }
    } else {
      const step = Math.min(d, 2.6 * dt);
      p.x += dx / d * step;
      p.z += dz / d * step;
      player.root.rotation.y = Math.atan2(dx, dz);
      speed = 2.6;
    }
    if (player.pose !== 'sit') p.y = heightAt(p.x, p.z);
  } else if (player.pose !== 'sit') {
    let ix = stick.x, iz = stick.y;
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    const frozen = !S.started || blocked || dlg.state.active || S.haeunStory === 'exit';
    if (!frozen && vistaIndex >= 0 && Math.hypot(ix, iz) > 0.08) followCamera();
    // Camera-relative walking/steering; inertia and turning acceleration remain
    // in world coordinates when the player lets go to orbit the camera.
    const x = Math.cos(cam.yaw) * ix + Math.sin(cam.yaw) * iz;
    const z = -Math.sin(cam.yaw) * ix + Math.cos(cam.yaw) * iz;
    speed = stepTraversal(traversal, p, { x, z, run: runEnabled || keys.has('shift'), brake: braking || keys.has('x') || keys.has('control'), frozen }, traversalEnvironment(), dt);
    if (speed > 0.08) {
      const yaw = Math.atan2(traversal.vx, traversal.vz);
      player.root.rotation.y += wrapAngle(yaw - player.root.rotation.y) * damp(traversal.mode === 'walk' ? 12 : 7, dt);
    }
    const room = interiorAt(p, S.city);
    if (room && traversal.mode !== 'walk') setTransport('walk', true);
  } else stopTraversal(traversal);
  lastTraversalSpeed = speed;
  if (player.pose === 'sit' && dlg.state.active) lookAtYaw(player, headPos(haeun), 0.9);
  else player.lookYaw = 0;
  if (hotSteam && !hotSteam.off) headPos(player, hotSteam.pos).y += 0.35;
  return traversal.mode === 'walk' ? speed / 3.4 : 0;
}

function updateHaeun(dt, t) {
  if (S.city !== 'seoul') return 0;
  let speed = 0;
  const pp = player.root.position;
  if (haeun.path?.length) {
    const target = haeun.path[0];
    if (target === 'wave') {
      haeun.waveT = (haeun.waveT ?? 0) + dt;
      lookAtYaw(haeun, pp, 0.6);
      haeun.root.rotation.y += wrapAngle(Math.atan2(pp.x - haeun.root.position.x, pp.z - haeun.root.position.z) - haeun.root.rotation.y) * damp(6, dt);
      if (haeun.waveT < dt * 1.5) {
        haeun.wave = 1.6;
        setExpr(haeun, 'smile', 3);
        bubble(haeun, '내일 7시. 늦지 마!', { dur: 2.6 });
        speak('내일 일곱 시. 늦지 마!', 'haeun');
      }
      if (haeun.waveT > 2.4) haeun.path.shift();
    } else {
      const p = haeun.root.position;
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) {
        haeun.path.shift();
        if (!haeun.path.length) {
          haeun.waveT = 0;
          finishNight();
        }
      } else {
        const step = Math.min(d, 2.4 * dt);
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        haeun.root.rotation.y += wrapAngle(Math.atan2(dx, dz) - haeun.root.rotation.y) * damp(10, dt);
        haeun.lookYaw = 0;
        speed = 0.7;
      }
    }
    return speed;
  }
  if (!haeun.root.visible) return 0;
  const dist = haeun.root.position.distanceTo(pp);
  if (loc.haeun === 'tent') {
    const want = Math.PI + (dlg.state.active && dlg.state.node?.who !== 'ajusshi' ? 0.45 : 0);
    haeun.root.rotation.y += wrapAngle(want - haeun.root.rotation.y) * damp(5, dt);
    if (dist < 7) lookAtYaw(haeun, headPos(player), 1.3);
    else haeun.lookYaw = Math.sin(t * 0.4) * 0.2;
    if (!S.noticed && dist < 7 && S.haeunStory === 'idle' && !S.quests.haeun) {
      S.noticed = true;
      bubble(haeun, '!', { cls: 'big', dur: 1.6 });
      sfx.chime();
    }
    haeun.armPose = dlg.state.active ? talkPose : eatPose;
  } else if (loc.haeun === 'studio' && haeun.pose !== 'dance' && dlg.state.active) {
    lookAtYaw(haeun, headPos(player), 1);
  }
  return 0;
}

function updateNpcs(dt, t) {
  if (ajusshi.serveT > 0) ajusshi.serveT -= dt;
  if (!dlg.state.active) lookAtYaw(ajusshi, player.root.position, 0.8);
  if (playerFood && playerFood.scale.x < 1) playerFood.scale.setScalar(Math.min(1, playerFood.scale.x + dt * 3));
  for (const c of [barista, cashier, jin]) if (c.root.visible && c.root.position.distanceTo(player.root.position) < 5) lookAtYaw(c, headPos(player), 1);
  cat.body.scale.y = 1 + Math.sin(t * 2.4) * 0.04;
  cat.tail.rotation.y = Math.sin(t * (cat.purr > 0 ? 6 : 1.4)) * 0.5;
  if (cat.purr > 0) {
    cat.purr -= dt;
    cat.head.rotation.z = Math.sin(t * 8) * 0.12;
  }
  for (const l of lanterns) l.grp.rotation.z = Math.sin(t * 1.1 + l.phase) * 0.06;

  // pedestrians stroll their loops
  for (const pd of peds) {
    const c = pd.c;
    let sp = 0;
    if (pd.pause > 0) pd.pause -= dt;
    else {
      const target = pd.pts[pd.i];
      const p = c.root.position;
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) {
        pd.i = (pd.i + 1) % pd.pts.length;
        if (Math.random() < 0.3) pd.pause = rand(1, 3);
      } else {
        p.x += (dx / d) * pd.speed * dt;
        p.z += (dz / d) * pd.speed * dt;
        p.y = seoulHeightAt(p.x, p.z);
        c.root.rotation.y += wrapAngle(Math.atan2(dx, dz) - c.root.rotation.y) * damp(6, dt);
        sp = pd.speed / 3.4;
      }
    }
    animate(c, dt, t, sp);
  }

  // Tong floats at the player's shoulder
  const pr = player.root;
  // perch higher and out of shot during conversations
  const talking = dlg.state.active || S.haeunStory !== 'idle';
  const off = (talking ? new THREE.Vector3(-0.9, 2.3, 0.4) : new THREE.Vector3(0.75, 1.55, -0.35)).applyAxisAngle(new THREE.Vector3(0, 1, 0), pr.rotation.y);
  const want = pr.position.clone().add(off);
  tong.root.position.lerp(want, damp(3, dt));
  tong.root.visible = camera.position.distanceTo(tong.root.position) > 1.3;
  tong.root.rotation.y += wrapAngle(pr.rotation.y - tong.root.rotation.y) * damp(3, dt);
  if (dlg.state.active || tong.talkT > 0) tong.root.rotation.y += wrapAngle(Math.atan2(camera.position.x - tong.root.position.x, camera.position.z - tong.root.position.z) - tong.root.rotation.y) * damp(6, dt);
  animateTong(tong, dt, t);
}

/* ── Camera ──────────────────────────────────────── */

const ray = new THREE.Raycaster();
const camTargetPos = new THREE.Vector3();
const camTargetLook = new THREE.Vector3();
const hv = new THREE.Vector3();
const pv = new THREE.Vector3();

function inTent(p) {
  return S.city === 'seoul' && p.x > TENT.minX + 0.1 && p.x < TENT.maxX - 0.1 && p.z > TENT.minZ && p.z < TENT.maxZ;
}

function updateCamera(dt, t) {
  if (S.debugCam) {
    camera.position.copy(S.debugCam.pos);
    camera.lookAt(S.debugCam.look);
    return;
  }
  const p = player.root.position;
  let k = 4;
  let fov = 50;
  let mode = 'follow';
  const node = dlg.state.node;
  const atTent = S.city === 'seoul' && S.haeunStory !== 'idle';
  if (!S.started) {
    const a = t * 0.05;
    camTargetLook.set(0, 2.5, -22);
    camTargetPos.set(Math.sin(a) * 7.5, 6.5 + Math.sin(t * 0.2), -15 + Math.cos(a) * 7);
    k = 1.2;
    mode = 'title';
  } else if (S.city === 'seoul' && S.haeunStory === 'exit') {
    headPos(haeun, hv);
    camTargetLook.copy(hv).setY(1.1);
    camTargetPos.set(4.4, 2.1, 7.8);
    k = 2;
    mode = 'exit';
  } else if (lookTower) {
    camTargetPos.copy(SPOTS.telescope).add(new THREE.Vector3(0, 1.25, 0.2));
    camTargetLook.set(420, 120, -10);
    fov = 14;
    mode = 'tower';
  } else if (S.benchSit && !dlg.state.active) {
    camTargetPos.copy(S.benchSit).add(new THREE.Vector3(1.2, 1.9, 2.4));
    camTargetLook.set(S.benchSit.x - 4, 4, -120);
    fov = 55;
    k = 1.5;
    mode = 'bench';
  } else if (atTent && (dlg.state.active || player.auto)) {
    headPos(haeun, hv);
    headPos(player, pv);
    const who = node?.who;
    const mid = (SPOTS.playerSeat.x + SPOTS.haeunTent.x) / 2;
    if (player.pose === 'sit' && who === 'ajusshi') {
      headPos(ajusshi, hv);
      camTargetPos.set(SPOTS.playerSeat.x - 0.2, 2.25, 0.6);
      camTargetLook.copy(hv).y -= 0.9;
      mode = 'ajusshi';
    } else if (player.pose !== 'sit' && dlg.state.id?.startsWith('greet')) {
      const dir = new THREE.Vector3().subVectors(STAND_SPOT, SPOTS.haeunTent).setY(0).normalize();
      camTargetPos.copy(STAND_SPOT).addScaledVector(dir, 1.0).add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.42)).setY(1.68);
      camTargetLook.copy(hv).y -= 0.25;
      fov = 55;
      mode = 'greet';
    } else {
      camTargetLook.set(mid, 0.98, 0.3);
      camTargetPos.set(mid + 0.45, 1.68, -2.02);
      fov = 60;
      mode = 'counter';
    }
    k = 3;
  } else if (dlg.state.active && node && chars[node.who] && node.who !== 'tong' && node.who !== 'player') {
    // two-shot: both faces in frame, from whichever side isn't a wall
    const sp = chars[node.who];
    headPos(sp, hv);
    headPos(player, pv);
    const dir = new THREE.Vector3(hv.x - pv.x, 0, hv.z - pv.z);
    const len = Math.max(0.6, dir.length());
    dir.normalize();
    const mid = pv.clone().lerp(hv, 0.55);
    const dist = Math.max(2.0, len * 0.9 + 1.5);
    if (cam.talkSide === undefined || cam.mode !== `talk-${node.who}`) {
      let best = 1;
      let bestFree = -1;
      for (const sgn of [1, -1]) {
        const side = new THREE.Vector3(-dir.z * sgn, 0, dir.x * sgn);
        const want = mid.clone().addScaledVector(side, dist * 0.85).addScaledVector(dir, -dist * 0.45).setY(Math.max(pv.y, hv.y) + 0.35);
        updateCutaways(p, want, 0, S.city);
        const d = want.clone().sub(mid);
        ray.set(mid, d.clone().normalize());
        ray.far = d.length();
        const hit = ray.intersectObjects(G.blockers.filter(isCameraOccluder), false)[0];
        const free = hit ? hit.distance : d.length() + 1;
        if (free > bestFree) {
          bestFree = free;
          best = sgn;
        }
      }
      cam.talkSide = best;
    }
    const side = new THREE.Vector3(-dir.z * cam.talkSide, 0, dir.x * cam.talkSide);
    camTargetPos.copy(mid).addScaledVector(side, dist * 0.85).addScaledVector(dir, -dist * 0.45).setY(Math.max(pv.y, hv.y) + 0.35);
    updateCutaways(p, camTargetPos, dt, S.city);
    const d = camTargetPos.clone().sub(mid);
    ray.set(mid, d.clone().normalize());
    ray.far = d.length();
    const hit = ray.intersectObjects(G.blockers.filter(isCameraOccluder), false)[0];
    if (hit) camTargetPos.copy(mid).addScaledVector(d.normalize(), Math.max(0.9, hit.distance - 0.3));
    camTargetLook.copy(mid).y -= 0.45;
    fov = 50;
    k = 3;
    mode = `talk-${node.who}`;
  } else if (vistaIndex >= 0 && currentCity().vistas?.[vistaIndex]) {
    const vista = currentCity().vistas[vistaIndex];
    camTargetPos.set(...vista.position);
    camTargetLook.set(...vista.look);
    mode = 'vista';
    k = 5;
  } else {
    const dist = overview ? Math.max(18, cam.dist * 2.4) : cam.dist;
    const pitch = overview ? Math.max(0.95, cam.pitch) : cam.pitch;
    camTargetLook.set(p.x, p.y + 1.25, p.z);
    camTargetPos.set(p.x + Math.sin(cam.yaw) * dist * Math.cos(pitch), p.y + 1.25 + dist * Math.sin(pitch), p.z + Math.cos(cam.yaw) * dist * Math.cos(pitch));
    // Cutaway decisions use the DESIRED camera, before a wall can shorten it.
    // Fading never removes the corresponding physical collider.
    updateCutaways(p, camTargetPos, dt, S.city);
    const dir = new THREE.Vector3().subVectors(camTargetPos, camTargetLook);
    const len = dir.length();
    dir.normalize();
    ray.set(camTargetLook, dir);
    ray.far = len;
    const hit = ray.intersectObjects(G.blockers.filter(isCameraOccluder), false)[0];
    if (hit) camTargetPos.copy(camTargetLook).addScaledVector(dir, Math.max(0.6, hit.distance - 0.35));
    if (overview) mode = 'overview';
    k = 7;
  }
  if (!['follow', 'overview'].includes(mode) && !mode.startsWith('talk-')) updateCutaways(p, camTargetPos, dt, S.city);
  if (cam.snap || (mode !== cam.mode && !['follow', 'title'].includes(mode) && cam.mode !== 'title')) {
    cam.pos.copy(camTargetPos);
    cam.look.copy(camTargetLook);
    cam.snap = false;
  }
  if (!mode.startsWith('talk')) cam.talkSide = undefined;
  cam.mode = mode;
  cam.pos.lerp(camTargetPos, damp(k, dt));
  cam.look.lerp(camTargetLook, damp(k + 2, dt));
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  faceFill.position.copy(cam.pos).y += 0.4;
  faceFill.intensity += ((dlg.state.active ? 2.2 + G.night * 1.5 : 0) - faceFill.intensity) * damp(4, dt);
  if (camera.aspect < 0.8) fov = Math.min(80, fov * 1.35);
  // Binoculars focus on the distant skyline, past nearby foliage and props.
  const near = mode === 'tower' ? 30 : 0.1;
  if (camera.near !== near) {
    camera.near = near;
    camera.updateProjectionMatrix();
  }
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * damp(3, dt);
    camera.updateProjectionMatrix();
  }
  // see into the tent from outside
  const camIn = inTent(camera.position) && camera.position.y < TENT.wallH;
  const want = (inTent(p) || atTent) && !camIn ? 0.28 : 0.94;
  const tarp = tentMats.tarp;
  tarp.opacity += (want - tarp.opacity) * damp(6, dt);
  tarp.depthWrite = tarp.opacity > 0.8;
  tentMats.valance.opacity = clamp((tarp.opacity - 0.28) / 0.66, 0.08, 1);
}

/* ── HUD per frame ───────────────────────────────── */

const wayfindingLabel = document.createElement('div');
wayfindingLabel.className = 'place-wayfinding';
Object.assign(wayfindingLabel.style, { position: 'absolute', display: 'none', fontFamily: '"Gowun Dodum", sans-serif', fontWeight: '700', fontSize: 'var(--small, 14px)', lineHeight: '1.35', color: '#302921', background: '#fff6e8ed', padding: '5px 9px', borderRadius: '9px', maxWidth: 'min(260px, 75%)', textAlign: 'center', transform: 'translate(-50%, -100%)', pointerEvents: 'none' });
ui.bubbles.appendChild(wayfindingLabel);
function updateWayfinding() {
  wayfindingLabel.style.display = 'none';
  if (!S.started || modalOpen() || dlg.state.active || vistaIndex >= 0 || S.haeunStory !== 'idle') return;
  const p = player.root.position;
  const distanceTo = (place) => Math.hypot(p.x - (place.entry ?? place.spawn)[0], p.z - (place.entry ?? place.spawn)[2]);
  const target = cityPlaces().find((place) => place.id === waypointId) ?? [...cityPlaces()].sort((a, b) => distanceTo(a) - distanceTo(b))[0];
  if (!target) return;
  const distance = distanceTo(target);
  if (!waypointId && distance > 18) return;
  const at = target.entry ?? target.spawn;
  tmpV.set(at[0], at[1] + 2.3, at[2]).project(camera);
  const behind = tmpV.z > 1;
  wayfindingLabel.textContent = `${behind ? '↻ ' : ''}${target.ko} · ${categoryNames[roleOf(target)]} · ${Math.round(distance)}m`;
  wayfindingLabel.style.display = '';
  wayfindingLabel.style.left = `${clamp(behind ? stage.width / 2 : (tmpV.x * 0.5 + 0.5) * stage.width, Math.min(110, stage.width / 2), Math.max(stage.width / 2, stage.width - 110))}px`;
  wayfindingLabel.style.top = `${clamp(behind ? stage.height * 0.35 : (-tmpV.y * 0.5 + 0.5) * stage.height, Math.min(160, stage.height * 0.35), stage.height - 150)}px`;
}

let lastZone = null;
let lastClock = '';
function updateHud() {
  const tk = koreanTime(localHour());
  const key = `${S.city}:${tk.digital}`;
  if (key !== lastClock) {
    lastClock = key;
    ui.clockIcon.textContent = timeIcon(localHour());
    ui.clockTime.textContent = tk.digital;
    ui.clockKo.textContent = S.city === 'seoul' ? tk.ko : `${currentCity().name} · UTC+${S.city === 'shanghai' ? 8 : 9} · ${localHour() < 6 ? 'Night' : localHour() < 12 ? 'Morning' : localHour() < 18 ? 'Afternoon' : 'Evening'}`;
  }
  const p = player.root.position;
  const z = zoneAt(p.x, p.z);
  const places = cityPlaces();
  const nearby = places.find((pl) => Math.hypot(p.x - pl.spawn[0], p.z - pl.spawn[2]) < (pl.radius ?? 3.5) && Math.abs(p.y - pl.spawn[1]) < 1.5);
  const place = nearby ?? (z && places.find((pl) => pl.id === z.id));
  const zid = place?.id ?? null;
  if (zid !== lastZone) {
    lastZone = zid;
    if (place && S.started) {
      discover(place);
      if (S.city === 'seoul' && SEOUL_PLACES.some((pl) => pl.id === place.id) && !S.visited.has(place.id)) {
        S.visited.add(place.id);
        if (S.visited.size >= SEOUL_PLACES.length) done('explore');
        updateQuest();
      }
    }
  }
}

/* ── Main loop ───────────────────────────────────── */

const clock = new THREE.Clock();
let saveT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (S.started && !dlg.state.active && !modalOpen()) {
    const prev = S.hour;
    S.hour += (dt * S.speed) / 30;
    if (S.hour >= 24) {
      S.hour -= 24;
      S.day++;
    }
    if (S.benchSit && ((prev < 19 && S.hour >= 19) || (prev < 7 && S.hour >= 7))) {
      S.speed = 1;
      toast(S.hour >= 19 ? '<b>🌙 밤이 됐어요</b><span>Night has fallen. The 포장마차 is open!</span>' : '<b>☀️ 아침이에요</b><span>Good morning, Seoul.</span>', 3000);
      updateToggles();
    }
  }
  const L = sky.update(localHour(), t, player.root.position, camera);
  bloom.strength = L.bloom;
  renderer.toneMappingExposure = L.exposure;
  const warm = clamp(1 - Math.abs(localHour() - 18) / 2, 0, 1);
  grade.uniforms.uTint.value.setRGB(1 + warm * 0.06, 1 - warm * 0.01, 1 - warm * 0.08 + L.night * 0.04);
  water.material.uniforms.uSky.value.copy(L.top);
  water.material.uniforms.uHorizon.value.copy(L.horizon);
  water.material.uniforms.uSunDir.value.copy(sky.uniforms.uSunDir.value);
  water.material.uniforms.uSunColor.value.copy(L.sun).multiplyScalar(L.sunI > 0 ? 1 : 0);
  water.material.uniforms.uTime.value = t;
  water.material.uniforms.uNight.value = L.night;

  if (S.city === 'seoul') updateSchedules();
  const ps = updatePlayer(dt);
  const hs = updateHaeun(dt, t);
  updateNpcs(dt, t);
  animate(player, dt, t, ps);
  const yaw = player.root.rotation.y;
  const ppRide = player.root.position;
  const frontY = heightAt(ppRide.x + Math.sin(yaw) * 0.5, ppRide.z + Math.cos(yaw) * 0.5);
  const rearY = heightAt(ppRide.x - Math.sin(yaw) * 0.5, ppRide.z - Math.cos(yaw) * 0.5);
  rides.update(traversal, lastTraversalSpeed, t, Math.atan2(rearY - frontY, 1));
  animate(haeun, dt, t, hs);
  for (const c of [jin, ajusshi, barista, cashier]) if (c.root.visible) animate(c, dt, t, 0);
  for (const u of G.updaters) u(dt, t);
  updatePickups(dt, t);
  updateParticles(dt, t);
  updateMotes(dt, t);
  updateInteract();
  dlg.update(dt);
  updateCamera(dt, t);
  updateBubbles(dt);
  updateWayfinding();
  updateHud();
  drawMinimap();
  studioMirrorVisible(zoneAt(player.root.position.x, player.root.position.z)?.id === 'studio');

  const pp = player.root.position;
  updateAudio({
    night: L.night,
    distTent: Math.hypot(pp.x - (TX - 1), pp.z + 1),
    tentOpen: S.city === 'seoul' && loc.tent,
    distRiver: S.city === 'seoul' ? Math.max(0, pp.z + 46) + Math.max(0, TERRACE_Y - pp.y) * 6 : Infinity,
    distSubway: Math.min(...cityPlaces().filter((p) => roleOf(p) === 'subway').map((p) => Math.hypot(pp.x - p.spawn[0], pp.z - p.spawn[2]))),
    indoor: !!zoneAt(pp.x, pp.z)?.indoor,
  });

  composer.render();
  if (pendingPolaroid) {
    const url = renderer.domElement.toDataURL('image/jpeg', 0.85);
    $('polaroid-img').src = url;
    $('polaroid-caption').textContent = pendingPolaroid === 'jin' ? '진 선배와 한강에서 · Jin & me, Han River' : '홍대의 밤 · A night in Hongdae';
    $('polaroid-date').textContent = `Day ${S.day} · ${koreanTime(S.hour).digital}`;
    $('polaroid').classList.remove('hidden');
    S.polaroids.push(url);
    pendingPolaroid = null;
  }
  saveT += dt;
  if (saveT > 10 && S.started) {
    saveT = 0;
    save();
  }
  requestAnimationFrame(frame);
}

/* ── Boot ────────────────────────────────────────── */

async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('64px Jua', '포장마차'), document.fonts.load('32px "Gowun Dodum"', '떡볶이')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* system fonts */
  }
  sky = new DayNight();
  const buildCityGeometry = (id, build) => {
    const before = new Set(scene.children);
    build();
    const group = cityGroups[id] ??= new THREE.Group();
    for (const child of [...scene.children]) if (!before.has(child)) group.add(child);
    scene.add(group);
    group.visible = id === S.city;
  };
  buildCityGeometry('seoul', buildWorld);
  for (const city of Object.values(cities)) buildCityGeometry(city.id, () => city.build());
  buildCast();
  initParticles();
  buildMotes();
  const saved = loadSave();
  if (saved) $('continue').classList.remove('hidden');
  buildPickups();
  drawMapBg();
  updateHearts();
  updateQuest();
  renderBook();
  initVoice(updateToggles);
  updateToggles();
  updateSchedules(true);
  cam.pos.copy(camera.position);
  frame();

  $('loading').textContent = '';
  $('start').disabled = false;
  const begin = (resume) => {
    if (resume && saved) {
      applySave(saved);
      for (const p of pickups) {
        p.taken = S.words.has(p.w.ko);
        p.sprite.visible = p.glow.visible = !p.taken;
      }
      updateHearts();
      updateQuest();
      renderBook();
      ui.bookCount.textContent = S.phrases.size;
    } else {
      S.name = $('name').value.trim() || '연습생';
    }
    initAudio();
    audio.ctx?.resume();
    $('title').classList.add('hidden');
    ui.hud.classList.remove('hidden');
    S.started = true;
    if (!resume || !saved) placePlayer({ position: [1.6, 0, 18], yaw: 0 });
    syncCity();
    toast(`<b>${currentCity().nativeName} · ${currentCity().name}</b><span>Day ${S.day}, ${koreanTime(localHour()).digital} local. Tong floats beside you — press <kbd>H</kbd> for a hint. Walk to ✈ for flights.</span>`, 4200);
    setTimeout(tongTalk, 3800);
    save();
  };
  $('start').onclick = () => begin(false);
  $('continue').onclick = () => begin(true);
  $('name').addEventListener('keydown', (e) => e.key === 'Enter' && begin(false));
  $('stay').onclick = () => {
    $('ending').classList.add('hidden');
    ui.hud.classList.remove('hidden');
    standUp();
    updateQuest();
  };
  $('again').onclick = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  window.__cozy = {
    S, player, haeun, jin, dlg, renderer, bloom, scene, sky, G, THREE, setHour,
    travelTo: (id, options) => travelTo(id === 'airport' ? { id: 'airport', icon: '✈', ko: currentCity().airport.nativeName, en: currentCity().airport.name, spawn: currentCity().airport.spawn, yaw: currentCity().yaw } : cityPlaces().find((p) => p.id === id), options),
    cities, cityRegistry: cities, get currentCity() { return currentCity(); },
    changeCity, openTravel, save, localHour, heightAt, zoneAt,
    get bounds() { return currentCity().bounds; },
    get transitioning() { return transitioning; },
    openPlace: (id) => { const p = cityPlaces().find((p) => p.id === id); if (p) openPlace(p); },
    interact, loc, cam, camera, composer, stage, resizeStage, safePose, validPose,
    traversal, rides, jump, setTransport, demoJump,
    get demoEnabled() { return demoEnabled; },
    get controls() { return { keys: [...keys], joystick: { ...stick }, pointers: lookPointers.size, braking, runEnabled }; },
    get cameraDiagnostics() { return { mode: cam.mode, desired: camTargetPos.toArray(), actual: camera.position.toArray(), yaw: cam.yaw, pitch: cam.pitch, distance: cam.dist, overview, vistaIndex, near: camera.near }; },
    get interiorDiagnostics() { return { current: interiorAt(player.root.position, S.city)?.id ?? null, cutaways: cutawaySnapshot() }; },
  };
}

$('start').disabled = true;
boot();

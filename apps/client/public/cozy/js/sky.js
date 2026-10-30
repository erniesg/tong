// Sky dome, sun/moon, clouds and the keyframed day/night cycle.
import * as THREE from 'three';
import { G, lerp, makeCanvas, canvasTexture, seeded, clamp } from './util.js';

const C = (hex) => new THREE.Color(hex);

// hour → look. Colours are blended in linear space between keys.
const KEYS = [
  { h: 0.0, top: '#060a1c', horizon: '#18203f', sun: '#000000', sunI: 0.0, hemiSky: '#46578f', hemiGround: '#1a1420', hemiI: 0.75, fog: '#121831', night: 1, exposure: 1.15, bloom: 0.75 },
  { h: 4.8, top: '#0c1333', horizon: '#2a2c58', sun: '#000000', sunI: 0.0, hemiSky: '#4d5a92', hemiGround: '#1d1622', hemiI: 0.75, fog: '#1a1f3d', night: 0.95, exposure: 1.15, bloom: 0.75 },
  { h: 6.0, top: '#3d5a9a', horizon: '#f2a985', sun: '#ffb07a', sunI: 1.12, hemiSky: '#9aa7d6', hemiGround: '#4a3a3a', hemiI: 1.12, fog: '#c7a7a8', night: 0.45, exposure: 1.05, bloom: 0.5 },
  { h: 7.5, top: '#5a98de', horizon: '#cfe2f3', sun: '#fff0d8', sunI: 3.0, hemiSky: '#bcd6f2', hemiGround: '#6b5a48', hemiI: 1.58, fog: '#c6d8ea', night: 0, exposure: 1.0, bloom: 0.28 },
  { h: 12.0, top: '#4889dd', horizon: '#d4e7f7', sun: '#ffffff', sunI: 3.62, hemiSky: '#c2dcf6', hemiGround: '#6e5d4b', hemiI: 1.72, fog: '#cfe0f0', night: 0, exposure: 1.0, bloom: 0.25 },
  { h: 16.0, top: '#5690d6', horizon: '#f0dcc2', sun: '#ffe4bc', sunI: 3.12, hemiSky: '#c8d6ea', hemiGround: '#6e5a46', hemiI: 1.58, fog: '#e3d9cc', night: 0, exposure: 1.0, bloom: 0.3 },
  { h: 17.5, top: '#6a7ec0', horizon: '#ffae6c', sun: '#ff9c56', sunI: 2.38, hemiSky: '#c5b5c8', hemiGround: '#6a4a3a', hemiI: 1.27, fog: '#e6b08b', night: 0.12, exposure: 1.05, bloom: 0.4 },
  { h: 18.5, top: '#2f3b7c', horizon: '#e0736a', sun: '#ff6a48', sunI: 0.75, hemiSky: '#8b7fa8', hemiGround: '#3a2a34', hemiI: 0.9, fog: '#6d5272', night: 0.55, exposure: 1.1, bloom: 0.6 },
  { h: 19.5, top: '#121a44', horizon: '#3b305f', sun: '#000000', sunI: 0.0, hemiSky: '#56619c', hemiGround: '#221a28', hemiI: 0.75, fog: '#1d2142', night: 0.95, exposure: 1.15, bloom: 0.75 },
  { h: 24.0, top: '#060a1c', horizon: '#18203f', sun: '#000000', sunI: 0.0, hemiSky: '#46578f', hemiGround: '#1a1420', hemiI: 0.75, fog: '#121831', night: 1, exposure: 1.15, bloom: 0.75 },
];
for (const k of KEYS) for (const p of ['top', 'horizon', 'sun', 'hemiSky', 'hemiGround', 'fog']) k[p] = C(k[p]);

export function sample(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = (h - a.h) / (b.h - a.h);
  const out = { h };
  for (const p of Object.keys(a)) {
    if (p === 'h') continue;
    out[p] = a[p] instanceof THREE.Color ? a[p].clone().lerp(b[p], k) : lerp(a[p], b[p], k);
  }
  return out;
}

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uStars;
uniform float uTime;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5)) : uHorizon * (1.0 - clamp(-h * 3.0, 0.0, 0.6));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (smoothstep(0.9993, 0.9996, s) * 6.0 + pow(s, 14.0) * 0.45 + pow(s, 3.0) * 0.12);
  float m = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.95, 0.94, 0.86) * (smoothstep(0.99955, 0.99975, m) * 1.8 + pow(m, 80.0) * 0.18) * uStars;
  vec3 cell = floor(d * 260.0);
  float st = hash(cell);
  float tw = 0.55 + 0.45 * sin(uTime * 2.3 + st * 80.0);
  col += vec3(step(0.9972, st) * tw * uStars * smoothstep(0.02, 0.25, h)) * 1.4;
  gl_FragColor = vec4(col, 1.0);
}`;

function cloudTexture(rnd) {
  const [c, g] = makeCanvas(256, 128);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * 176;
    const y = 50 + rnd() * 40 - Math.abs(x - 128) * 0.15;
    const r = 18 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return canvasTexture(c, { repeat: false });
}

export class DayNight {
  constructor() {
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uStars: { value: 0 },
      uTime: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    G.scene.add(dome);
    this.dome = dome;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    G.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -26;
    sc.right = sc.top = 26;
    sc.near = 1;
    sc.far = 120;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    G.scene.add(this.sun);
    G.scene.add(this.sun.target);

    G.scene.fog = new THREE.Fog(0x000000, 40, 700);

    // drifting clouds
    const rnd = seeded(404);
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(rnd), transparent: true, depthWrite: false, fog: false }));
      const a = rnd() * Math.PI * 2;
      const r = 420 + rnd() * 260;
      s.position.set(Math.cos(a) * r, 120 + rnd() * 90, Math.sin(a) * r - 120);
      const sz = 140 + rnd() * 140;
      s.scale.set(sz, sz * 0.45, 1);
      s.renderOrder = -9;
      G.scene.add(s);
      this.clouds.push({ s, a, r, speed: 0.004 + rnd() * 0.004 });
    }
    this.look = sample(17);
  }

  /** Apply the look for `hour`, centring shadows on `focus`. */
  update(hour, t, focus, camera) {
    const L = sample(hour);
    this.look = L;
    const U = this.uniforms;
    U.uTop.value.copy(L.top);
    U.uHorizon.value.copy(L.horizon);
    U.uSunColor.value.copy(L.sun);
    U.uTime.value = t;
    U.uStars.value = clamp((L.night - 0.3) / 0.6, 0, 1);

    // Sun rises behind the alley (+z) and sets over the Han River (-z),
    // so golden hour lights the street lengthwise and the river view.
    const a = ((hour - 6) / 12) * Math.PI;
    const sunDir = new THREE.Vector3(0.38, Math.sin(a) * 0.95, Math.cos(a) * 0.85).normalize();
    U.uSunDir.value.copy(sunDir);
    const moonDir = new THREE.Vector3(-0.3, Math.max(0.3, -Math.sin(a) * 0.85), -0.75).normalize();
    U.uMoonDir.value.copy(moonDir);

    const sunUp = sunDir.y > 0.02;
    const lightDir = sunUp ? sunDir : moonDir;
    this.sun.color.copy(sunUp ? L.sun : new THREE.Color(0x9fb3ff));
    this.sun.intensity = sunUp ? L.sunI : 0.38 * L.night;
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(lightDir, 60);

    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiI;

    G.scene.fog.color.copy(L.fog);
    G.scene.fog.near = lerp(60, 26, L.night);
    G.scene.fog.far = lerp(900, 620, L.night);
    G.scene.background = L.horizon;

    for (const c of this.clouds) {
      c.a += c.speed * 0.016;
      c.s.position.x = focus.x + Math.cos(c.a) * c.r;
      c.s.position.z = focus.z + Math.sin(c.a) * c.r - 120;
      c.s.material.color.copy(L.horizon).lerp(L.sun.clone().addScalar(0.4), 0.35).multiplyScalar(lerp(1.05, 0.35, L.night));
      c.s.material.opacity = lerp(0.85, 0.35, L.night);
    }
    this.dome.position.copy(camera.position);

    G.night = L.night;
    for (const { m, day, night, prop = 'emissiveIntensity' } of G.nightMats) m[prop] = lerp(day, night, L.night);
    for (const { light, day, night } of G.nightLights) light.intensity = lerp(day, night, L.night);
    for (const v of G.nightVisible) v.obj.visible = v.on(L.night);
    return L;
  }
}

/** "오후 5시 42분" style clock text for the HUD. */
export function koreanTime(hour) {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((hour % 1) * 60);
  const period = h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '밤';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { ko: `${period} ${h12}시 ${String(m).padStart(2, '0')}분`, digital: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

export function timeIcon(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return '🌅';
  if (h >= 7 && h < 17) return '☀️';
  if (h >= 17 && h < 19.5) return '🌇';
  return '🌙';
}

// Shared set-dressing helpers for the airport train and the Hongdae street:
// merged static geometry (few draw calls), canvas signs, and Jin's drama ad.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvas, canvasTexture, roundRect } from './util.js';

/**
 * Collects static pieces per material and merges each material into one mesh.
 * Every piece carries a vertex colour, so one `vertexColors` material can paint
 * a whole prop set. Boxes and cylinders sit on `y0`; spheres are centred on `y`.
 */
export function batcher() {
  const bins = new Map();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  function put(material, geo, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, color = '#ffffff' } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(m4.compose(p.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(sx, sy, sz)));
    col.set(color);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (!bins.has(material)) bins.set(material, []);
    bins.get(material).push(g);
  }
  return {
    put,
    box: (material, w, h, d, x, y0, z, o) => put(material, new THREE.BoxGeometry(w, h, d), x, y0 + h / 2, z, o),
    boxMM: (material, x0, x1, y0, y1, z0, z1, o) => put(material, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o),
    cyl: (material, rTop, rBottom, h, x, y0, z, o = {}) => put(material, new THREE.CylinderGeometry(rTop, rBottom, h, o.seg ?? 10), x, y0 + h / 2, z, o),
    sph: (material, r, x, y, z, o = {}) => put(material, new THREE.SphereGeometry(r, o.seg ?? 10, Math.max(6, (o.seg ?? 10) - 2)), x, y, z, o),
    /** Merge and add to `parent`. Returns the meshes (one per material). */
    build(parent, { cast = true, receive = true } = {}) {
      const out = [];
      for (const [material, list] of bins) {
        const mesh = new THREE.Mesh(mergeGeometries(list, false), material);
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
        parent.add(mesh);
        out.push(mesh);
      }
      bins.clear();
      return out;
    },
  };
}

/** A canvas texture painted by `draw(g, w, h)`; repainted once web fonts arrive. */
export function paintTexture(w, h, draw, { repeat = false } = {}) {
  const [c, g] = makeCanvas(w, h);
  const tex = canvasTexture(c, { repeat });
  const redraw = () => {
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
    tex.needsUpdate = true;
  };
  redraw();
  globalThis.document?.fonts?.ready?.then(redraw).catch(() => {});
  tex.userData.redraw = redraw;
  return tex;
}

/** A flat sign: plane with a painted texture that glows a little by night (unlit signs pass glow 0). */
export function signPlane(tex, w, h, { glow = 0, side = THREE.FrontSide, transparent = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side, transparent, alphaTest: transparent ? 0.05 : 0 });
  if (glow) {
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveMap = tex;
    m.emissiveIntensity = glow;
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.receiveShadow = false;
  return mesh;
}

/* ── Jin's drama, 〈밤의 끝에서〉 (docs/seoul-first-day.md, Proposals) ── */

export const DRAMA = { actor: '진', title: '〈밤의 끝에서〉', slot: '토·일 밤 9시' };

let jinImg = null;
const jinWaiters = [];
function withJin(cb) {
  if (typeof Image === 'undefined') return;
  if (!jinImg) {
    jinImg = new Image();
    jinImg.onload = () => jinWaiters.splice(0).forEach((f) => f());
    jinImg.src = 'img/jin-portrait.jpg';
  }
  if (jinImg.complete && jinImg.naturalWidth) cb();
  else jinWaiters.push(cb);
}

function cover(g, img, x, y, w, h, focusY = 0.3) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / k;
  const sh = h / k;
  g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * focusY, sw, sh, x, y, w, h);
}

/** The poster for Jin's drama. Wide canvases get the train ad card layout, tall ones the station light box. */
function dramaPoster(w, h) {
  const wide = w > h;
  return paintTexture(w, h, (g) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#141a3c');
    bg.addColorStop(1, '#43264f');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // city lights out of focus
    const cols = ['255,190,120', '255,140,160', '150,190,255'];
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137) % 100) / 100 * w;
      const y = ((i * 71) % 100) / 100 * h;
      const r = (0.03 + ((i * 29) % 10) / 180) * Math.min(w, h) * 2;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${cols[i % 3]},0.34)`);
      gr.addColorStop(1, `rgba(${cols[i % 3]},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const img = jinImg?.complete && jinImg.naturalWidth ? jinImg : null;
    const iw = wide ? h * 0.82 : w;
    const ih = wide ? h : h * 0.66;
    if (img) cover(g, img, 0, 0, iw, ih);
    const fade = wide ? g.createLinearGradient(iw * 0.55, 0, iw, 0) : g.createLinearGradient(0, ih * 0.6, 0, ih);
    fade.addColorStop(0, 'rgba(30,24,60,0)');
    fade.addColorStop(1, wide ? '#2a2046' : '#33224c');
    g.fillStyle = fade;
    g.fillRect(0, 0, iw + 2, ih + 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cx = wide ? (iw + w) / 2 : w / 2;
    const u = wide ? h : w * 0.62;
    const ys = wide ? [0.25, 0.56, 0.83] : [0.725, 0.835, 0.93].map((k) => (k * h) / u);
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = u * 0.04;
    g.fillStyle = '#ffffff';
    g.font = `${u * 0.3}px Jua, sans-serif`;
    g.fillText(DRAMA.actor, cx, ys[0] * u);
    g.fillStyle = '#ffe2b0';
    g.font = `${u * 0.2}px Jua, sans-serif`;
    g.fillText(DRAMA.title, cx, ys[1] * u);
    g.shadowBlur = 0;
    g.font = `${u * 0.12}px 'Gowun Dodum', sans-serif`;
    const tw = g.measureText(DRAMA.slot).width + u * 0.16;
    g.fillStyle = '#ffcf4a';
    roundRect(g, cx - tw / 2, ys[2] * u - u * 0.095, tw, u * 0.19, u * 0.095);
    g.fill();
    g.fillStyle = '#2a1830';
    g.fillText(DRAMA.slot, cx, ys[2] * u + u * 0.008);
  });
}
/** As `dramaPoster`, repainted when Jin's portrait has loaded. */
export function dramaPosterTexture(w, h) {
  const tex = dramaPoster(w, h);
  withJin(() => tex.userData.redraw());
  return tex;
}

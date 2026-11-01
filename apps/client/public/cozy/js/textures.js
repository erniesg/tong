// Procedural, tileable textures (colour + normal maps) drawn on canvas.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, seeded } from './util.js';

const cache = new Map();
const memo = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

/** Tileable value noise over a lattice of `period` cells. */
function makeNoise(period, rnd) {
  const g = new Float32Array(period * period).map(() => rnd());
  const at = (x, y) => g[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const shade = (hex, k) => {
  const [r, g, b] = hexRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

/** Sobel-ish height → tangent-space normal map. */
export function normalFrom(hc, strength = 2) {
  const w = hc.width;
  const h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, g] = makeCanvas(w, h);
  const out = g.createImageData(w, h);
  const H = (x, y) => src[((((y + h) % h) * w + ((x + w) % w)) * 4)] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return canvasTexture(c, { srgb: false });
}

/** Fill colour + height canvases from a per-pixel function. */
function paint(S, fn) {
  const [c, g] = makeCanvas(S, S);
  const [hc, hg] = makeCanvas(S, S);
  const img = g.createImageData(S, S);
  const him = hg.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const [r, gg, b, hh] = fn(x, y);
      const i = (y * S + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
      him.data[i] = him.data[i + 1] = him.data[i + 2] = hh;
      him.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  hg.putImageData(him, 0, 0);
  return { c, g, hc, hg };
}

function finish({ c, hc }, strength) {
  return { map: canvasTexture(c), normalMap: normalFrom(hc, strength) };
}

export const asphalt = () =>
  memo('asphalt', () => {
    const rnd = seeded(11);
    const n1 = makeNoise(8, rnd);
    const n2 = makeNoise(64, rnd);
    const S = 512;
    const p = paint(S, (x, y) => {
      const v = 0.55 * n1(x / 64, y / 64) + 0.3 * n2(x / 8, y / 8) + 0.15 * rnd();
      const k = 74 + v * 38;
      return [k, k, k + 6, v * 255];
    });
    // patched squares and cracks
    for (let i = 0; i < 4; i++) {
      const [x, y, w, h] = [rnd() * S, rnd() * S, 60 + rnd() * 120, 40 + rnd() * 90];
      p.g.fillStyle = `rgba(28,28,34,${0.25 + rnd() * 0.2})`;
      p.g.fillRect(x, y, w, h);
      p.hg.strokeStyle = 'rgba(255,255,255,0.35)';
      p.hg.strokeRect(x, y, w, h);
    }
    for (let i = 0; i < 9; i++) {
      let x = rnd() * S;
      let y = rnd() * S;
      let a = rnd() * Math.PI * 2;
      p.g.strokeStyle = 'rgba(18,18,22,0.85)';
      p.hg.strokeStyle = '#000';
      p.g.lineWidth = p.hg.lineWidth = 1.4;
      p.g.beginPath();
      p.hg.beginPath();
      p.g.moveTo(x, y);
      p.hg.moveTo(x, y);
      for (let k = 0; k < 18; k++) {
        a += (rnd() - 0.5) * 1.2;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        p.g.lineTo(x, y);
        p.hg.lineTo(x, y);
      }
      p.g.stroke();
      p.hg.stroke();
    }
    return finish(p, 3);
  });

/** Seoul sidewalk: grey/rose interlocking pavers in running bond. */
export const pavers = () =>
  memo('pavers', () => {
    const rnd = seeded(23);
    const S = 512;
    const bw = 64;
    const bh = 32;
    const pal = ['#8f8b86', '#9b968f', '#86827e', '#a3918b', '#7f7b78', '#958c84'];
    const colors = [];
    for (let r = 0; r < S / bh; r++) {
      colors.push([]);
      for (let k = 0; k <= S / bw; k++) colors[r].push(hexRgb(pick(pal, rnd)));
    }
    const p = paint(S, (x, y) => {
      const row = Math.floor(y / bh);
      const off = row % 2 ? bw / 2 : 0;
      const col = Math.floor(((x + off) % S) / bw);
      const lx = (x + off) % bw;
      const ly = y % bh;
      const edge = Math.min(lx, bw - 1 - lx, ly, bh - 1 - ly);
      const [r, g, b] = colors[row][col];
      const n = (rnd() - 0.5) * 14;
      if (edge < 2) return [70, 68, 66, 20];
      const bevel = Math.min(1, edge / 5);
      return [r + n, g + n, b + n, 120 + bevel * 120];
    });
    return finish(p, 2.5);
  });

function pick(arr, rnd) {
  return arr[Math.floor(rnd() * arr.length)];
}

export const brick = (base = '#8a4a3a', key = 'brick') =>
  memo(key + base, () => {
    const rnd = seeded(base.length * 31 + 7);
    const S = 512;
    const bw = 64;
    const bh = 28;
    const [br, bg, bb] = hexRgb(base);
    const tones = [];
    for (let r = 0; r < Math.ceil(S / bh); r++) tones.push(Array.from({ length: 10 }, () => 0.8 + rnd() * 0.35));
    const p = paint(S, (x, y) => {
      const row = Math.floor(y / bh);
      const off = row % 2 ? bw / 2 : 0;
      const col = Math.floor(((x + off) % S) / bw);
      const lx = (x + off) % bw;
      const ly = y % bh;
      if (lx < 4 || ly < 4) return [178, 170, 160, 30];
      const k = tones[row % tones.length][col % 10] * (0.92 + rnd() * 0.12);
      return [br * k, bg * k, bb * k, 200 + rnd() * 30];
    });
    return finish(p, 2.5);
  });

/** Irregular fieldstone retaining wall, like the stairs in the key art. */
export const stone = () =>
  memo('stone', () => {
    const rnd = seeded(5);
    const S = 512;
    const [c, g] = makeCanvas(S, S);
    const [hc, hg] = makeCanvas(S, S);
    g.fillStyle = '#4e4a45';
    g.fillRect(0, 0, S, S);
    hg.fillStyle = '#202020';
    hg.fillRect(0, 0, S, S);
    const pal = ['#a59c8d', '#8f887c', '#b4ab9b', '#9d9587', '#7f796f', '#aaa08f'];
    for (let i = 0; i < 170; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const rx = 22 + rnd() * 26;
      const ry = 14 + rnd() * 16;
      const col = pick(pal, rnd);
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const cx = x + ox;
          const cy = y + oy;
          if (cx < -60 || cx > S + 60 || cy < -60 || cy > S + 60) continue;
          const gr = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, 2, cx, cy, Math.max(rx, ry));
          gr.addColorStop(0, shade(col, 1.08));
          gr.addColorStop(1, shade(col, 0.72));
          g.fillStyle = gr;
          g.beginPath();
          g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          g.fill();
          const hr = hg.createRadialGradient(cx, cy, 1, cx, cy, Math.max(rx, ry));
          hr.addColorStop(0, '#f0f0f0');
          hr.addColorStop(1, '#707070');
          hg.fillStyle = hr;
          hg.beginPath();
          hg.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          hg.fill();
        }
      }
    }
    return finish({ c, hc }, 4);
  });

export const plaster = (base = '#e9c7c9') =>
  memo('plaster' + base, () => {
    const rnd = seeded(base.charCodeAt(2) * 13);
    const n = makeNoise(32, rnd);
    const [r, g, b] = hexRgb(base);
    const p = paint(256, (x, y) => {
      const v = 0.85 + n(x / 8, y / 8) * 0.15 + (rnd() - 0.5) * 0.04;
      return [r * v, g * v, b * v, v * 200];
    });
    return finish(p, 1.2);
  });

export const wood = (base = '#b58b5c') =>
  memo('wood' + base, () => {
    const rnd = seeded(77);
    const [r, g, b] = hexRgb(base);
    const n = makeNoise(16, rnd);
    const ph = 64;
    const tones = Array.from({ length: 8 }, () => 0.82 + rnd() * 0.3);
    const p = paint(512, (x, y) => {
      const row = Math.floor(y / ph);
      const ly = y % ph;
      if (ly < 3) return [r * 0.35, g * 0.35, b * 0.35, 20];
      const grain = 0.9 + 0.1 * Math.sin((x / 512) * Math.PI * 2 * 6 + n(x / 32, y / 6) * 8);
      const k = tones[row % 8] * grain;
      return [r * k, g * k, b * k, 180 + grain * 40];
    });
    return finish(p, 1.6);
  });

export const tiles = (base = '#eeeae4', grout = '#b9b3aa', size = 64) =>
  memo('tiles' + base + size, () => {
    const rnd = seeded(3);
    const [r, g, b] = hexRgb(base);
    const [gr, gg, gb] = hexRgb(grout);
    const p = paint(512, (x, y) => {
      const lx = x % size;
      const ly = y % size;
      if (lx < 2 || ly < 2) return [gr, gg, gb, 40];
      const k = 0.97 + rnd() * 0.04;
      return [r * k, g * k, b * k, 220];
    });
    return finish(p, 2);
  });

export const fabric = (base = '#ff7a22') =>
  memo('fabric' + base, () => {
    const rnd = seeded(9);
    const [r, g, b] = hexRgb(base);
    const p = paint(256, (x, y) => {
      const w = (x % 4 < 2) !== (y % 4 < 2) ? 1 : 0.9;
      const k = w * (0.94 + rnd() * 0.08);
      return [r * k, g * k, b * k, w * 200];
    });
    return finish(p, 1);
  });

/** Knit stitches: little chevrons, for sweaters and beanies. */
export const knit = (base = '#f1e6d2') =>
  memo('knit' + base, () => {
    const [r, g, b] = hexRgb(base);
    const p = paint(128, (x, y) => {
      const lx = x % 16;
      const ly = y % 16;
      const half = lx < 8 ? lx : 15 - lx;
      const d = Math.abs(ly - half * 0.9 - 2);
      const v = Math.max(0, 1 - d / 5);
      const k = 0.78 + v * 0.3;
      return [r * k, g * k, b * k, v * 255];
    });
    return finish(p, 2.5);
  });

export const denim = (base = '#4f74ad') =>
  memo('denim' + base, () => {
    const rnd = seeded(41);
    const [r, g, b] = hexRgb(base);
    const p = paint(128, (x, y) => {
      const d = (x + y) % 6 < 3 ? 1 : 0.86;
      const k = d * (0.9 + rnd() * 0.14);
      return [r * k, g * k, b * k, d * 220];
    });
    return finish(p, 1.4);
  });

export const leather = () =>
  memo('leather', () => {
    const rnd = seeded(51);
    const n = makeNoise(32, rnd);
    const p = paint(128, (x, y) => {
      const v = n(x / 4, y / 4);
      const k = 22 + v * 14;
      return [k, k, k + 3, v * 255];
    });
    return finish(p, 1.5);
  });

export const bark = () =>
  memo('bark', () => {
    const rnd = seeded(61);
    const n = makeNoise(16, rnd);
    const p = paint(128, (x, y) => {
      const v = n(x / 4, y / 24) * 0.7 + rnd() * 0.3;
      const k = 0.7 + v * 0.4;
      return [92 * k, 74 * k, 58 * k, v * 255];
    });
    return finish(p, 3);
  });

/** Anime "angel ring" hair highlight. */
export function hairTexture(base, light) {
  return memo('hair' + base + light, () => {
    const [c, g] = makeCanvas(64, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 64, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0.0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.48, 'rgba(255,255,255,0)');
    gr.addColorStop(0.58, light);
    gr.addColorStop(0.66, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 256);
    // strand streaks
    g.globalAlpha = 0.25;
    for (let x = 0; x < 64; x += 3) {
      g.fillStyle = x % 2 ? light : base;
      g.fillRect(x, 0, 1, 256);
    }
    return canvasTexture(c, { repeat: false });
  });
}

/** Alpha mask with pointed strand tips along the bottom edge. */
export function strandAlpha(tips = 26, depth = 0.22) {
  return memo('strand' + tips + depth, () => {
    const W = 512;
    const H = 128;
    const [c, g] = makeCanvas(W, H);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W, 0);
    const step = W / tips;
    for (let i = tips; i >= 0; i--) {
      const x = i * step;
      g.lineTo(x, H * (1 - depth) + (i % 2 ? 0 : H * depth * 0.6));
      g.lineTo(x - step / 2, H);
    }
    g.closePath();
    g.fill();
    const t = canvasTexture(c, { srgb: false, repeat: false });
    t.flipY = true;
    return t;
  });
}

/** Fluffy fur colour + shell alpha for the Tong mascot. */
export function furTextures(base = '#d9a24a') {
  return memo('fur' + base, () => {
    const rnd = seeded(91);
    const [r, g, b] = hexRgb(base);
    const [c, gg] = makeCanvas(256, 256);
    gg.fillStyle = base;
    gg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
      const k = 0.8 + rnd() * 0.4;
      gg.strokeStyle = `rgba(${r * k},${g * k},${b * k},0.7)`;
      gg.lineWidth = 1;
      const x = rnd() * 256;
      const y = rnd() * 256;
      gg.beginPath();
      gg.moveTo(x, y);
      gg.lineTo(x + (rnd() - 0.5) * 4, y + 3 + rnd() * 4);
      gg.stroke();
    }
    const [a, ag] = makeCanvas(256, 256);
    const img = ag.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = rnd() ** 1.6 * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ag.putImageData(img, 0, 0);
    const alpha = canvasTexture(a, { srgb: false });
    alpha.repeat.set(3, 3);
    alpha.magFilter = THREE.NearestFilter;
    return { map: canvasTexture(c), alpha };
  });
}

/** Clone a {map, normalMap} pair with a specific repeat. */
export function tiled(tex, rx, ry = rx) {
  const map = tex.map.clone();
  map.repeat.set(rx, ry);
  map.needsUpdate = true;
  const normalMap = tex.normalMap.clone();
  normalMap.repeat.set(rx, ry);
  normalMap.needsUpdate = true;
  return { map, normalMap };
}

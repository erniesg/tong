// Fully synthesized audio: lo-fi pad, plucks, ambience and sound effects.
import { rand, pick, clamp } from './util.js';

export const audio = { ctx: null, master: null, music: null, fx: null, muted: false, nextBar: 0, bar: 0, beds: {} };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const NIGHT_CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const DAY_CHORDS = [
  [48, 52, 55, 62],
  [55, 59, 62, 66],
  [57, 60, 64, 67],
  [53, 57, 60, 65],
];

function noiseBuffer(ctx, crackle = 0) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (crackle && Math.random() < crackle ? 1 : 0.3);
  return buf;
}

function bed(ctx, { type = 'bandpass', freq = 1000, q = 0.7, crackle = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, crackle);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f);
  f.connect(g);
  g.connect(audio.master);
  src.start();
  return g;
}

export function initAudio() {
  if (audio.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  audio.master.gain.value = audio.muted ? 0 : 0.7;
  audio.master.connect(ctx.destination);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.36;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(audio.master);
  audio.fx = delay;

  audio.music = ctx.createGain();
  audio.music.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1500;
  audio.music.connect(lp);
  lp.connect(audio.master);
  lp.connect(delay);

  audio.beds.sizzle = bed(ctx, { freq: 4000, q: 0.6, crackle: 0.003 });
  audio.beds.river = bed(ctx, { type: 'lowpass', freq: 500, q: 0.4 });
  audio.beds.city = bed(ctx, { type: 'lowpass', freq: 220, q: 0.5 });
  audio.beds.rumble = bed(ctx, { type: 'lowpass', freq: 90, q: 1 });
  audio.nextBar = ctx.currentTime + 0.2;
  audio.nextCritter = ctx.currentTime + 1;
}

export function tone(freq, t, dur, { type = 'sine', gain = 0.1, attack = 0.01, dest = audio.music, detune = 0 } = {}) {
  const ctx = audio.ctx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

/** env: { night, distTent, distRiver, distSubway, indoor } */
export function updateAudio(env) {
  const ctx = audio.ctx;
  if (!ctx) return;
  while (audio.nextBar < ctx.currentTime + 0.6) {
    const t = audio.nextBar;
    const chords = env.night > 0.5 ? NIGHT_CHORDS : DAY_CHORDS;
    const chord = chords[audio.bar % chords.length];
    for (const n of chord) {
      tone(mtof(n), t, 4.4, { type: 'triangle', gain: 0.028, attack: 1.2, detune: -6 });
      tone(mtof(n), t, 4.4, { type: 'triangle', gain: 0.028, attack: 1.2, detune: 6 });
    }
    tone(mtof(chord[0] - 12), t, 3.8, { gain: 0.065, attack: 0.05 });
    const pent = env.night > 0.5 ? [72, 74, 76, 79, 81, 84] : [72, 74, 76, 79, 81, 83, 86];
    for (let k = 0; k < 8; k++) if (Math.random() < 0.42) tone(mtof(pick(pent)), t + k * 0.5 + rand(0, 0.03), 1.3, { gain: 0.032, attack: 0.005 });
    audio.nextBar += 4;
    audio.bar++;
  }
  const B = audio.beds;
  B.sizzle.gain.value = 0.09 * clamp(1 - env.distTent / 11, 0, 1) * (env.tentOpen ? 1 : 0);
  B.river.gain.value = 0.06 * clamp(1 - env.distRiver / 18, 0, 1);
  B.city.gain.value = env.indoor ? 0.02 : 0.05;
  B.rumble.gain.value = 0.25 * clamp(1 - env.distSubway / 7, 0, 1);

  // birds by day, crickets at night
  if (ctx.currentTime > audio.nextCritter) {
    audio.nextCritter = ctx.currentTime + rand(0.6, 2.4);
    if (!env.indoor) {
      if (env.night < 0.3 && Math.random() < 0.7) chirp();
      if (env.night > 0.7 && Math.random() < 0.8) cricket();
    }
  }
}

function chirp() {
  const t = audio.ctx.currentTime;
  const base = rand(2400, 3600);
  for (let i = 0; i < 3; i++) {
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    const s = t + i * 0.09;
    o.frequency.setValueAtTime(base, s);
    o.frequency.exponentialRampToValueAtTime(base * 1.4, s + 0.06);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(0.02, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.07);
    o.connect(g);
    g.connect(audio.master);
    o.start(s);
    o.stop(s + 0.1);
  }
}

function cricket() {
  const t = audio.ctx.currentTime;
  for (let i = 0; i < 4; i++) tone(4400, t + i * 0.05, 0.03, { gain: 0.01, dest: audio.master, type: 'square' });
}

export const sfx = {
  chime() {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    tone(1046.5, t, 0.9, { gain: 0.12, dest: audio.master });
    tone(1568, t + 0.09, 1.1, { gain: 0.1, dest: audio.master });
    tone(1568, t + 0.09, 1.1, { gain: 0.05, dest: audio.fx });
  },
  heart() {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => tone(mtof(n), t + i * 0.07, 0.6, { gain: 0.08, dest: audio.master }));
  },
  blip() {
    if (!audio.ctx) return;
    tone(rand(520, 640), audio.ctx.currentTime, 0.06, { gain: 0.016, dest: audio.master });
  },
  whoosh() {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const o = tone(220, t, 1.2, { type: 'sawtooth', gain: 0.04, dest: audio.master, attack: 0.3 });
    o.frequency.exponentialRampToValueAtTime(60, t + 1.2);
  },
  meow() {
    if (!audio.ctx) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.15);
    o.frequency.linearRampToValueAtTime(480, t + 0.5);
    f.type = 'bandpass';
    f.frequency.value = 1300;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(f);
    f.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + 0.6);
  },
  thump() {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    tone(110, t, 0.4, { gain: 0.2, dest: audio.master });
    tone(82, t + 0.12, 0.5, { gain: 0.15, dest: audio.master });
  },
  coin() {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    tone(1318, t, 0.15, { type: 'square', gain: 0.04, dest: audio.master });
    tone(1760, t + 0.08, 0.35, { type: 'square', gain: 0.04, dest: audio.master });
  },
};

export function setMuted(m) {
  audio.muted = m;
  if (audio.master) audio.master.gain.value = m ? 0 : 0.7;
}

/* ── Korean voice (Web Speech) ───────────────────── */

let koVoice = null;
export const voice = { on: true, available: () => !!koVoice };

export function initVoice(onChange) {
  if (!('speechSynthesis' in window)) return;
  const pickV = () => {
    koVoice = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ko')) ?? null;
    onChange?.();
  };
  pickV();
  speechSynthesis.addEventListener?.('voiceschanged', pickV);
}

const PITCH = { ajusshi: 0.6, haeun: 1.2, jin: 0.85, tong: 1.6, barista: 1.25, cashier: 0.95 };

export function speak(text, who) {
  if (!voice.on || !koVoice || audio.muted) return;
  const clean = text.replace(/[…"“”]/g, ' ').replace(/[^\p{Script=Hangul}\p{L}\p{N}\s,.!?~]/gu, '').trim();
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.voice = koVoice;
  u.lang = koVoice.lang;
  u.rate = 0.92;
  u.pitch = PITCH[who] ?? 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

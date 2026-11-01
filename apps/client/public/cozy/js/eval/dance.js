// Formation grid: "follow the call". Pure, seeded call generation and state checks.
// The UI (ui.js) runs the beat; this module decides what each call means.

import { rng, hashSeed } from './runner.js';

export const GRID = { cols: 5, rows: 3 };
export const START = { x: 2, y: 1, pose: 'stand' };
/** Beats per call (call on beat 0, move lands on the last beat). ~100 BPM. */
export const BEAT_MS = 600;
export const BEATS_PER_CALL = 6;

/** Native numbers for distances (TOPIK 1: 한/두/세 + 칸). */
const NUM = { 1: { ko: '한', en: 'one' }, 2: { ko: '두', en: 'two' }, 3: { ko: '세', en: 'three' } };
/** 앞 is toward the mirror (top of the grid); 오른쪽 is your right as you face it. */
const DIRS = {
  right: { ko: '오른쪽', en: 'right', dx: 1, dy: 0 },
  left: { ko: '왼쪽', en: 'left', dx: -1, dy: 0 },
  front: { ko: '앞', en: 'forward', dx: 0, dy: -1 },
  back: { ko: '뒤', en: 'back', dx: 0, dy: 1 },
};
export const POSES = {
  right_hand: { ko: '오른손 들어!', en: 'Right hand up!', button: '오른손', icon: '🫱', objective: 'ko-vocab-body' },
  left_hand: { ko: '왼손 들어!', en: 'Left hand up!', button: '왼손', icon: '🫲', objective: 'ko-vocab-body' },
  sit: { ko: '앉아!', en: 'Sit!', button: '앉아', icon: '🧎', objective: 'ko-vocab-actions' },
  stand: { ko: '일어나!', en: 'Stand up!', button: '일어나', icon: '🧍', objective: 'ko-vocab-actions' },
};
/** 들어 → 들고 when a hand call joins a move ("오른손 들고, 왼쪽으로 두 칸!"). */
const HAND_JOIN = { right_hand: '오른손 들고', left_hand: '왼손 들고' };

const inGrid = (x, y) => x >= 0 && x < GRID.cols && y >= 0 && y < GRID.rows;

function moveCall(dir, n) {
  const d = DIRS[dir];
  const particle = dir === 'back' ? '로' : '으로'; // 뒤 has no final consonant
  return { ko: `${d.ko}${particle} ${NUM[n].ko} 칸!`, en: `${n} step${n > 1 ? 's' : ''} ${d.en}!` };
}

/** All calls legal from a state. kind: move | pose | combo. */
export function legalCalls(state, { combos = true } = {}) {
  const out = [];
  if (state.pose !== 'sit') {
    for (const [dir, d] of Object.entries(DIRS)) {
      for (const n of [1, 2, 3]) {
        const x = state.x + d.dx * n;
        const y = state.y + d.dy * n;
        if (!inGrid(x, y)) continue;
        const m = moveCall(dir, n);
        out.push({ kind: 'move', ko: m.ko, en: m.en, target: { x, y, pose: state.pose }, objective: n > 1 ? 'ko-vocab-numbers' : 'ko-vocab-directions' });
        if (combos && n <= 2) {
          for (const hand of ['right_hand', 'left_hand']) {
            if (hand === state.pose) continue;
            out.push({ kind: 'combo', ko: `${HAND_JOIN[hand]}, ${m.ko}`, en: `${POSES[hand].en.replace('!', '')}, ${m.en}`, target: { x, y, pose: hand }, objective: 'ko-gram-go-join' });
          }
        }
      }
    }
    for (const pose of ['right_hand', 'left_hand', 'sit']) {
      if (pose !== state.pose) out.push({ kind: 'pose', ko: POSES[pose].ko, en: POSES[pose].en, target: { ...state, pose }, objective: POSES[pose].objective });
    }
    if (state.pose !== 'stand') out.push({ kind: 'pose', ko: POSES.stand.ko, en: POSES.stand.en, target: { ...state, pose: 'stand' }, objective: POSES.stand.objective });
  } else {
    out.push({ kind: 'pose', ko: POSES.stand.ko, en: POSES.stand.en, target: { ...state, pose: 'stand' }, objective: POSES.stand.objective });
  }
  return out;
}

/** A seeded sequence of n calls from START. Each call needs a change from the current formation. */
export function makeCalls(seed, n = 8, { combos = true } = {}) {
  const rand = rng(hashSeed(seed, 'dance'));
  let state = { ...START };
  const calls = [];
  for (let i = 0; i < n; i++) {
    const all = legalCalls(state, { combos: combos && i >= 2 });
    // Weight: moves 3, poses 2, combos 1 — directions and counts are the core.
    const weighted = all.flatMap((c) => Array(c.kind === 'move' ? 3 : c.kind === 'pose' ? 2 : 1).fill(c));
    let c = weighted[Math.floor(rand() * weighted.length)];
    if (calls.length && calls.at(-1).ko === c.ko) c = all.find((x) => x.ko !== c.ko) ?? c;
    calls.push({ id: `dance-${i + 1}`, skill: 'listening', ...c, from: state });
    state = c.target;
  }
  return calls;
}

export function matches(state, target) {
  return state.x === target.x && state.y === target.y && state.pose === target.pose;
}

/** Player input → next formation state. input: { cell: [x, y] } | { pose } */
export function applyInput(state, input) {
  if (input.cell) {
    const [x, y] = input.cell;
    if (!inGrid(x, y) || state.pose === 'sit') return state;
    return { ...state, x, y };
  }
  if (input.pose && POSES[input.pose]) return { ...state, pose: input.pose };
  return state;
}

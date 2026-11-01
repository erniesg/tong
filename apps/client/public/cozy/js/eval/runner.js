// Seoul eval runner: pure, deterministic scoring. No DOM, no clock, no Math.random.
// Design: docs/seoul-evals.md → "Eval day" (scoring, tiers, bands, two numbers).

export const SKILLS = ['listening', 'reading', 'writing', 'speaking'];
export const ROUNDS = ['vocal', 'dance', 'judges', 'field'];
/** Eval grade = Vocal 25% + Dance 25% + Judges 25% + Field quest 25%. */
export const ROUND_WEIGHTS = { vocal: 0.25, dance: 0.25, judges: 0.25, field: 0.25 };
/** Bands: S 95+, A 85+, B 70+, C 55+, D 40+, F below 40. */
export const BANDS = [['S', 95], ['A', 85], ['B', 70], ['C', 55], ['D', 40], ['F', -Infinity]];
/** Timing in rhythm sections: Perfect 1.0, Good 0.8, Miss 0. */
export const TIMING = { perfect: 1, good: 0.8, miss: 0 };
export const HINT_CAP = 0.5;
export const OPT_UP = 1.25;
export const OPT_DOWN = 0.8;
/** Timing windows in ms either side of the beat (proposal; tune in play). */
export const WINDOWS = { perfectMs: 150, goodMs: 400 };

/* ── Seeded randomness ───────────────────────────── */

/** FNV-1a over the joined parts: a stable 32-bit seed from any mix of strings and numbers. */
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.map(String).join('|')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: a small seeded PRNG returning [0, 1). */
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Items ───────────────────────────────────────── */

/**
 * Judge a rhythm input. dtMs = input time − beat time (negative is early); null = no input.
 * Early inputs inside the count still count as Good ("you were ready"); late past the window is a Miss.
 * windowScale < 1 tightens Perfect (the sleep branch's "tired" condition can pass it in).
 */
export function judgeTiming(dtMs, { perfectMs = WINDOWS.perfectMs, goodMs = WINDOWS.goodMs, windowScale = 1 } = {}) {
  if (dtMs == null || !Number.isFinite(dtMs)) return 'miss';
  if (Math.abs(dtMs) <= perfectMs * windowScale) return 'perfect';
  if (dtMs < 0 || dtMs <= goodMs) return 'good';
  return 'miss';
}

/** Item score in [0, 1]: accuracy × timing (rhythm sections only), capped at half when Tong hinted. */
export function scoreItem({ correct, accuracy, timing, hint } = {}) {
  let s = Number.isFinite(accuracy) ? Math.min(1, Math.max(0, accuracy)) : correct ? 1 : 0;
  if (timing) s *= TIMING[timing] ?? 0;
  if (hint) s = Math.min(s, HINT_CAP);
  return s;
}

/** Opting up a tier ×1.25, down ×0.8, relative to the suggested tier. */
export function tierMultiplier(tier, suggested) {
  return tier > suggested ? OPT_UP : tier < suggested ? OPT_DOWN : 1;
}

/** Suggested tier per skill from mastery (proposal: level ≥ 1 suggests tier 2, ≥ 2 tier 3 where allowed). */
export function suggestTier(mastery = {}, skill, maxTier = 2) {
  const m = Number(mastery[skill]) || 0;
  return Math.min(maxTier, m >= 2 ? 3 : m >= 1 ? 2 : 1);
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Round performance (0–100 within the chosen tier). results are item records
 * { itemId, skill, objective, correct|accuracy, timing?, hint? }.
 */
export function scoreRound(results, { tier = 1, suggested = tier } = {}) {
  const scored = results.map((r) => ({ ...r, score: scoreItem(r) }));
  const raw = scored.length ? (scored.reduce((s, r) => s + r.score, 0) / scored.length) * 100 : 0;
  const multiplier = tierMultiplier(tier, suggested);
  return { raw: round1(raw), multiplier, tier, suggested, score: round1(Math.min(100, raw * multiplier)), items: scored };
}

export function bandOf(score) {
  return BANDS.find(([, min]) => score >= min)[0];
}

/** Eval grade from the four round scores (missing rounds count 0). */
export function gradeEval(roundScores) {
  const grade = round1(ROUNDS.reduce((s, id) => s + (Number(roundScores[id]) || 0) * ROUND_WEIGHTS[id], 0));
  return { grade, band: bandOf(grade), probation: grade < 55 };
}

/** Per-objective accuracy; objectives under the threshold are weak (seed next month). */
export function objectiveAccuracy(items) {
  const acc = {};
  for (const r of items) {
    const a = (acc[r.objective] ??= { n: 0, sum: 0 });
    a.n++;
    a.sum += r.score ?? scoreItem(r);
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.sum / v.n]));
}

export function weakObjectives(items, threshold = 0.6) {
  return Object.entries(objectiveAccuracy(items))
    .filter(([, a]) => a < threshold)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k);
}

/** Per-skill performance (0–100) from scored items. */
export function skillPerformance(items) {
  const out = {};
  for (const r of items) {
    const a = (out[r.skill] ??= { n: 0, sum: 0 });
    a.n++;
    a.sum += r.score ?? scoreItem(r);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, round1((v.sum / v.n) * 100)]));
}

/**
 * Mastery (a TOPIK-style level per skill) only rises on success at the suggested tier or above.
 * rounds: [{ tier, suggested, items }]. Proposal: success = skill performance ≥ 70; gain 0.5 per eval, 0.25 per rehearsal.
 */
export function updateMastery(mastery = {}, rounds = [], { gain = 0.5, pass = 70, cap = 6 } = {}) {
  const next = Object.fromEntries(SKILLS.map((s) => [s, Number(mastery[s]) || 0]));
  const credited = new Set();
  for (const r of rounds) {
    if (r.tier < r.suggested) continue;
    for (const [skill, perf] of Object.entries(skillPerformance(r.items))) {
      if (perf >= pass && !credited.has(skill) && skill in next) {
        credited.add(skill);
        next[skill] = Math.min(cap, Math.round((next[skill] + gain) * 100) / 100);
      }
    }
  }
  return next;
}

/**
 * Stub ranking board: the player's grade against seeded NPC curves.
 * roster: [{ id, name, base, spread }]. Same seed + month → same board.
 */
export function rankBoard({ seed, month, player, roster }) {
  const rows = roster.map((t) => {
    const rand = rng(hashSeed(seed, 'rank', month, t.id));
    const jitter = (rand() + rand() - 1) * t.spread; // triangular, ±spread
    const grade = round1(Math.max(0, Math.min(100, t.base + jitter)));
    return { id: t.id, name: t.name, grade, band: bandOf(grade), npc: true, ...(t.placeholder ? { placeholder: t.placeholder } : {}) };
  });
  rows.push({ id: 'player', name: player.name, grade: player.grade, band: bandOf(player.grade), npc: false });
  rows.sort((a, b) => b.grade - a.grade || (a.npc ? 1 : -1));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

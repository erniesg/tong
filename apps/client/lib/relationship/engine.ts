/**
 * Deterministic relationship engine. No randomness outside `rng(seed, …)`, so
 * the same save seed and the same choices always replay the same night, and
 * the state harness can reproduce any outcome.
 *
 * Type-only imports: this file runs under Node type stripping for tests and
 * content export as well as inside Next.
 */
import type {
  Axes,
  Beat,
  Choice,
  Condition,
  Effects,
  ExerciseHook,
  InputTier,
  Line,
  Mood,
  MoodTag,
  Outcome,
  Preset,
  RelState,
  Scene,
  Stage,
  Variant,
  WorldCtx,
} from './types';

const STAGES: Stage[] = ['strangers', 'acquaintances', 'friends', 'close', 'romantic_tension', 'partners'];
export const stageIndex = (s: Stage) => STAGES.indexOf(s);

/* ── Seeded RNG ────────────────────────────────────────── */

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** mulberry32 seeded from save seed + a key ("mood:haeun:d12"). */
export function rng(seed: number, key: string): () => number {
  let a = (seed ^ hash(key)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Mood ──────────────────────────────────────────────── */

export interface MoodInputs {
  /** Scheduled causes for today, e.g. from the eval calendar: 'eval_top' | 'eval_passed' | 'eval_flagged'. */
  scheduled: string[];
  /** Effect of the last hangout: −1 bad, 0, +1 good. */
  lastHangout: number;
  volatility: number;
}

const CAUSE_SHIFT: Record<string, Partial<Mood>> = {
  eval_top: { valence: 2, energy: 1 },
  eval_passed: { valence: 1 },
  eval_flagged: { valence: -2, energy: -1 },
  homesick: { valence: -1 },
  // Hidden causes: nothing to do with the player.
  call_from_home: { valence: -1 },
  senior_snapped: { valence: -1, energy: 1 },
  no_sleep: { energy: -2 },
  good_sleep: { energy: 1 },
  small_win: { valence: 1 },
};

const HIDDEN_CAUSES = ['call_from_home', 'senior_snapped', 'no_sleep', 'good_sleep', 'small_win'];

/** Today's mood. Same seed + day + inputs = same mood. */
export function moodFor(characterId: string, day: number, seed: number, inputs: MoodInputs): Mood {
  const r = rng(seed, `mood:${characterId}:d${day}`);
  const causes = [...inputs.scheduled];
  // Volatile characters pick up hidden causes more often.
  if (r() < 0.25 + inputs.volatility * 0.35) causes.push(HIDDEN_CAUSES[Math.floor(r() * HIDDEN_CAUSES.length)]);
  let energy = 0;
  let valence = inputs.lastHangout * 0.5;
  for (const c of causes) {
    energy += CAUSE_SHIFT[c]?.energy ?? 0;
    valence += CAUSE_SHIFT[c]?.valence ?? 0;
  }
  const clamp = (n: number) => Math.max(-2, Math.min(2, Math.round(n)));
  return { energy: clamp(energy), valence: clamp(valence), causes };
}

export function moodTag(m: Mood): MoodTag {
  if (m.valence <= -2) return 'raw';
  if (m.valence < 0 || m.energy <= -2) return 'low';
  if (m.valence >= 2) return 'high';
  return 'ok';
}

/* ── Leak ──────────────────────────────────────────────── */

/** Typical warmth ceiling per stage; past it, the relationship leaks through (반말 slips, unprompted texts). */
const LEAK_AT: Record<Stage, number> = {
  strangers: 25,
  acquaintances: 40,
  friends: 60,
  close: 75,
  romantic_tension: 90,
  partners: 101,
};

export const leaks = (s: RelState) => s.axes.warmth >= LEAK_AT[s.stage];

/* ── Conditions ────────────────────────────────────────── */

export function month(day: number) {
  return Math.ceil(day / 28);
}

function inHours(hour: number, w: { from: number; to: number }) {
  return w.from <= w.to ? hour >= w.from && hour <= w.to : hour >= w.from || hour <= w.to;
}

export function matches(c: Condition | undefined, s: RelState, w: WorldCtx): boolean {
  if (!c) return true;
  const si = stageIndex(s.stage);
  if (c.stage && !c.stage.includes(s.stage)) return false;
  if (c.stageAtLeast && si < stageIndex(c.stageAtLeast)) return false;
  if (c.stageBelow && si >= stageIndex(c.stageBelow)) return false;
  for (const [k, v] of Object.entries(c.min ?? {})) if (s.axes[k as keyof Axes] < (v as number)) return false;
  for (const [k, v] of Object.entries(c.max ?? {})) if (s.axes[k as keyof Axes] > (v as number)) return false;
  if (c.flags?.some((f) => !s.flags[f])) return false;
  if (c.notFlags?.some((f) => s.flags[f])) return false;
  if (c.knows?.some((f) => !s.knows[f])) return false;
  if (c.notKnows?.some((f) => s.knows[f])) return false;
  if (c.memories?.some((t) => !s.memories.some((m) => m.tag === t))) return false;
  if (c.mood && !c.mood.includes(moodTag(s.mood))) return false;
  if (c.weather && !c.weather.includes(w.weather)) return false;
  if (c.hours && !inHours(w.hour, c.hours)) return false;
  if (c.month && (month(s.day) < c.month.from || month(s.day) > c.month.to)) return false;
  if (c.minLevel !== undefined && w.playerLevel < c.minLevel) return false;
  if (c.minTier !== undefined && w.inputTier < c.minTier) return false;
  if (c.leak !== undefined && leaks(s) !== c.leak) return false;
  if (c.any && !c.any.some((sub) => matches(sub, s, w))) return false;
  return true;
}

export function pick<T>(variants: Variant<T>[], s: RelState, w: WorldCtx): T | undefined {
  return variants.find((v) => matches(v.when, s, w))?.value;
}

/* ── Milestones ────────────────────────────────────────── */

/**
 * A stage only changes at a beat that asks for it (Effects.stageTo), and only
 * when that beat's milestone is eligible. Numbers make a transition possible;
 * a scene makes it happen.
 */
export const STAGE_MILESTONES: Record<Exclude<Stage, 'strangers'>, Condition> = {
  acquaintances: {},
  friends: { any: [{ min: { warmth: 30 }, flags: ['first_secret'] }, { min: { tension: 40 }, flags: ['outscored_her'] }] },
  close: { min: { trust: 50 }, flags: ['rooftop_done'] },
  romantic_tension: { min: { warmth: 65 }, flags: ['spark'], any: [{ flags: ['haeun_opened'] }, { flags: ['haeun_armored'] }] },
  partners: { flags: ['confessed'] },
};

export function canAdvanceTo(to: Stage, s: RelState, w: WorldCtx): boolean {
  if (to === 'strangers') return false;
  if (stageIndex(to) !== stageIndex(s.stage) + 1) return false;
  return matches(STAGE_MILESTONES[to], s, w);
}

/* ── Applying effects ──────────────────────────────────── */

export interface Applied {
  state: RelState;
  stageChanged?: { from: Stage; to: Stage };
  stageBlocked?: Stage;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

export function applyEffects(s: RelState, e: Effects, w: WorldCtx): Applied {
  const next: RelState = {
    ...s,
    axes: { ...s.axes },
    flags: { ...s.flags },
    knows: { ...s.knows },
    memories: [...s.memories],
  };
  for (const [k, v] of Object.entries(e.deltas ?? {})) {
    next.axes[k as keyof Axes] = clamp100(next.axes[k as keyof Axes] + (v as number));
  }
  for (const f of e.setFlags ?? []) next.flags[f] = true;
  for (const f of e.learn ?? []) next.knows[f] = true;
  if (e.memory) next.memories.push({ ...e.memory, day: s.day });
  const out: Applied = { state: next };
  if (e.stageTo) {
    if (canAdvanceTo(e.stageTo, next, w)) {
      out.stageChanged = { from: next.stage, to: e.stageTo };
      next.stage = e.stageTo;
    } else if (stageIndex(e.stageTo) > stageIndex(next.stage)) {
      out.stageBlocked = e.stageTo;
    }
  }
  return out;
}

/* ── Choices ───────────────────────────────────────────── */

/** Options the player can see right now. Tier-gated replies are hidden, not greyed out. */
export function availableChoices(b: Beat, s: RelState, w: WorldCtx): Choice[] {
  return (b.choices ?? []).filter((c) => matches(c.gate, s, w) && (c.minTier ?? 0) <= w.inputTier);
}

export interface Resolved extends Applied {
  outcome: Outcome;
  /** How the player produced the line; drives Haeun's "또 그거 써?" and quote callbacks. */
  tier: InputTier;
}

/**
 * Resolve a choice. `tier` is the tier the player actually used; tier 0
 * (Tong speaks) is marked so scenes and memories can react to it.
 */
export function resolveChoice(c: Choice, s: RelState, w: WorldCtx, tier: InputTier): Resolved {
  const usedTong = tier === 0;
  const probe: RelState = usedTong ? { ...s, flags: { ...s.flags, used_tong_last: true } } : { ...s, flags: { ...s.flags, used_tong_last: false } };
  const outcome = c.outcomes.find((o) => matches(o.when, probe, w)) ?? c.outcomes[c.outcomes.length - 1];
  const applied = applyEffects(probe, outcome, w);
  return { ...applied, outcome, tier };
}

/** The line Tong offers for a beat, or nothing once the player has outgrown it. */
export function tongFor(b: Beat, w: WorldCtx): Line | undefined {
  if (!b.tong) return undefined;
  if (b.tong.maxLevel !== undefined && w.playerLevel > b.tong.maxLevel) return undefined;
  return b.tong;
}

/* ── Scene walking (harness + tests) ───────────────────── */

export interface StepLog {
  beatId: string;
  speaker?: string;
  line?: Line;
  exercise?: { hook: ExerciseHook; passed: boolean };
  tong?: Line;
  choice?: string;
  reaction?: Line;
  deltas?: Partial<Axes>;
  stageChanged?: { from: Stage; to: Stage };
}

export type Picker = (choices: Choice[], beat: Beat) => Choice | undefined;

/** Walk a scene with a choice picker. Returns the transcript and final state. */
export type ExerciseResults = boolean | Record<string, boolean>;

const passed = (r: ExerciseResults | undefined, key: string) => (typeof r === 'object' ? r[key] ?? true : r ?? true);

const withFlag = (s: RelState, flag: string, v: boolean): RelState => ({ ...s, flags: { ...s.flags, [flag]: v } });

export function runScene(
  scene: Scene,
  start: RelState,
  w: WorldCtx,
  choose: Picker,
  tier: InputTier = w.inputTier,
  exercises?: ExerciseResults,
) {
  if (!matches(scene.gate, start, w)) return { gated: true as const, log: [] as StepLog[], state: start };
  const byId = new Map(scene.beats.map((b) => [b.id, b]));
  const log: StepLog[] = [];
  let s = start;
  let beat: Beat | undefined = scene.beats[0];
  for (let guard = 0; beat && guard < 200; guard++) {
    if (beat.when && !matches(beat.when, s, w)) {
      beat = beat.next ? byId.get(beat.next) : undefined;
      continue;
    }
    if (beat.exercise) {
      const ok = passed(exercises, beat.id);
      s = withFlag(s, `ex_${beat.id}`, ok);
    }
    const step: StepLog = { beatId: beat.id, speaker: beat.speaker, line: pick(beat.lines, s, w), tong: tongFor(beat, w) };
    if (beat.exercise) step.exercise = { hook: beat.exercise, passed: !!s.flags[`ex_${beat.id}`] };
    if (beat.effects) {
      const a = applyEffects(s, beat.effects, w);
      s = a.state;
      if (a.stageChanged) step.stageChanged = a.stageChanged;
    }
    let next = beat.next;
    const options = availableChoices(beat, s, w);
    const chosen = options.length ? choose(options, beat) : undefined;
    if (chosen) {
      if (chosen.exercise) {
        const key = `${beat.id}_${chosen.id}`;
        const ok = passed(exercises, key);
        s = withFlag(s, `ex_${key}`, ok);
        step.exercise = { hook: chosen.exercise, passed: ok };
      }
      const r = resolveChoice(chosen, s, w, Math.min(tier, w.inputTier) as InputTier);
      s = r.state;
      Object.assign(step, { choice: chosen.id, reaction: r.outcome.reaction, deltas: r.outcome.deltas });
      if (r.stageChanged) step.stageChanged = r.stageChanged;
      next = r.outcome.next ?? next;
    }
    log.push(step);
    if (beat.end) break;
    beat = next ? byId.get(next) : undefined;
  }
  return { gated: false as const, log, state: s };
}

/* ── Presets ───────────────────────────────────────────── */

export const DEFAULT_WORLD: WorldCtx = { hour: 21, weather: 'clear', playerLevel: 1, inputTier: 1, seed: 7 };

export function presetState(characterId: string, p: Preset): { state: RelState; world: WorldCtx } {
  const base = initialState(characterId);
  const state: RelState = {
    ...base,
    ...p.state,
    axes: { ...base.axes, ...p.state.axes },
    mood: { ...base.mood, ...p.state.mood },
  } as RelState;
  return { state, world: { ...DEFAULT_WORLD, ...p.world } };
}

/** Picker that follows a preset's path (choice ids in order), else the first option. */
export function pathPicker(path: string[] = []): Picker {
  const queue = [...path];
  return (choices) => {
    const i = choices.findIndex((c) => c.id === queue[0]);
    if (i >= 0) {
      queue.shift();
      return choices[i];
    }
    return choices[0];
  };
}

export function playPreset(scene: Scene, p: Preset) {
  const { state, world } = presetState(scene.characterId, p);
  return { ...runScene(scene, state, world, pathPicker(p.path), world.inputTier, p.exercises), start: state, world };
}

/* ── Ambient bids (between hangouts) ───────────────────── */

export type LoveLang = 'acts' | 'time' | 'words' | 'gift' | 'touch';

export interface Bid {
  id: string;
  label: Line;
  expresses: LoveLang[];
  /** Memory tags that make this bid specific ("she mentioned banana milk before evals"). */
  specificTo?: string[];
  base: Partial<Axes>;
  gate?: Condition;
  /** Lands badly when this matches (expensive gift → she feels indebted). */
  backfire?: { when: Condition; deltas: Partial<Axes>; reaction: Line };
  reaction: Line;
  specificReaction?: Line;
}

export interface CharacterNeeds {
  /** 0–1 weight per love language: how much this person feels it. */
  feels: Partial<Record<LoveLang, number>>;
}

const DIMINISH = [1, 0.5, 0.25, 0];

/**
 * An ambient bid's effect: need match × mood × specificity × diminishing returns.
 * Deterministic: no randomness, so players can learn her.
 */
export function resolveBid(bid: Bid, needs: CharacterNeeds, s: RelState, w: WorldCtx) {
  if (!matches(bid.gate, s, w)) return { allowed: false as const };
  if (bid.backfire && matches(bid.backfire.when, s, w)) {
    const a = applyEffects(s, { deltas: bid.backfire.deltas }, w);
    return { allowed: true as const, reaction: bid.backfire.reaction, state: bumpBid(a.state, bid.id), deltas: bid.backfire.deltas };
  }
  const fit = Math.max(0, ...bid.expresses.map((l) => needs.feels[l] ?? 0));
  const specific = !!bid.specificTo?.some((t) => s.memories.some((m) => m.tag === t));
  const tag = moodTag(s.mood);
  const moodMul = tag === 'raw' || tag === 'low' ? 1.5 : 1; // small kindnesses count more on bad days
  const n = s.bidsThisWeek[bid.id] ?? 0;
  const mul = fit * moodMul * (specific ? 2 : 1) * (DIMINISH[n] ?? 0);
  const deltas: Partial<Axes> = {};
  for (const [k, v] of Object.entries(bid.base)) deltas[k as keyof Axes] = Math.round((v as number) * mul);
  const a = applyEffects(s, { deltas }, w);
  const reaction = n >= 2 ? { ko: '또?', en: 'Again?' } : specific && bid.specificReaction ? bid.specificReaction : bid.reaction;
  return { allowed: true as const, reaction, state: bumpBid(a.state, bid.id), deltas };
}

function bumpBid(s: RelState, id: string): RelState {
  return { ...s, bidsThisWeek: { ...s.bidsThisWeek, [id]: (s.bidsThisWeek[id] ?? 0) + 1 } };
}

/* ── Defaults ──────────────────────────────────────────── */

export function initialState(characterId: string): RelState {
  return {
    characterId,
    stage: 'strangers',
    axes: { warmth: 10, tension: 10, trust: 10 },
    mood: { energy: 0, valence: 0, causes: [] },
    memories: [],
    flags: {},
    knows: {},
    day: 1,
    bidsThisWeek: {},
  };
}

/** Legacy single number for existing UI and the cozy bridge (affinity 0–100). */
export function legacyAffinity(s: RelState): number {
  const base = [5, 25, 45, 65, 80, 92][stageIndex(s.stage)];
  return Math.max(0, Math.min(100, Math.round(base + (s.axes.warmth + s.axes.trust - 2 * 50) / 20)));
}

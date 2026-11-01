/**
 * Relationship engine types (docs/relationship-plan.md).
 *
 * Stage is the label on a relationship and only changes at a milestone beat.
 * Warmth / tension / trust are what it feels like, hidden from the player and
 * shown only through reactions and register. Everything here is plain data so
 * scenes can be authored by people or agents and replayed deterministically.
 *
 * This file must stay free of runtime imports so content files (and node
 * scripts using type stripping) can import it with `import type` only.
 */
import type { ExerciseData } from '../types/hangout';

/* ── State ─────────────────────────────────────────────── */

export type Stage =
  | 'strangers'
  | 'acquaintances'
  | 'friends'
  | 'close'
  | 'romantic_tension'
  | 'partners';

export const STAGE_ORDER: readonly Stage[] = [
  'strangers',
  'acquaintances',
  'friends',
  'close',
  'romantic_tension',
  'partners',
];

export type Axis = 'warmth' | 'tension' | 'trust';
export type Axes = Record<Axis, number>; // each 0–100

/** Short-term layer on top of the relationship. energy/valence are −2…2. */
export interface Mood {
  energy: number;
  valence: number;
  /** Why, in authoring terms: 'eval_flagged', 'no_sleep', 'call_from_home'. Some are hidden from the player. */
  causes: string[];
}

export type MoodTag = 'raw' | 'low' | 'ok' | 'high';

export interface Memory {
  tag: string;
  day: number;
  note: string;
}

export interface RelState {
  characterId: string;
  stage: Stage;
  axes: Axes;
  mood: Mood;
  memories: Memory[];
  /** Things that happened ("first_secret", "h2_left_early"). */
  flags: Record<string, boolean>;
  /** Things the player has learned (canon facts revealed): "sua_name", "from_jeju". */
  knows: Record<string, boolean>;
  /** In-game day, 1-based. Month = ceil(day / 28) in the 12-month calendar. */
  day: number;
  /** Ambient bids this week, keyed by bid id, for diminishing returns. */
  bidsThisWeek: Record<string, number>;
}

/** Scene context that isn't relationship state. */
export interface WorldCtx {
  hour: number;
  weather: 'clear' | 'rain' | 'cold' | 'snow' | 'humid';
  /** Player's language level, 0–6 (matches computeTargetLangPercent). */
  playerLevel: number;
  /** Highest input tier the player has unlocked (see InputTier). */
  inputTier: InputTier;
  /** Deterministic seed for this save; same seed + same choices = same night. */
  seed: number;
  /**
   * Save-wide story flags. Every flag a scene or thread sets lands here too, so
   * any character's scene can read it (Haeun reads covered_for_haeun from
   * Manager Choi's thread). `flags` conditions match either map.
   */
  flags?: Record<string, boolean>;
  /** Save-wide counters, e.g. tally.jin_directives = Jin's directives you went along with. */
  tally?: Record<string, number>;
}

/* ── Conditions ────────────────────────────────────────── */

export interface Condition {
  stage?: Stage[];
  stageAtLeast?: Stage;
  stageBelow?: Stage;
  min?: Partial<Axes>;
  max?: Partial<Axes>;
  /** Matches the relationship's own flags or the save-wide story flags. */
  flags?: string[];
  notFlags?: string[];
  /** Inclusive bounds on save-wide counters: { jin_directives: { min: 3 } }. */
  tally?: Record<string, { min?: number; max?: number }>;
  knows?: string[];
  notKnows?: string[];
  memories?: string[];
  mood?: MoodTag[];
  weather?: WorldCtx['weather'][];
  /** Inclusive hour window; wraps past midnight when from > to. */
  hours?: { from: number; to: number };
  month?: { from: number; to: number };
  minLevel?: number;
  minTier?: InputTier;
  /** True when warmth runs ahead of stage: the relationship "leaks" (반말 slips, a second text). */
  leak?: boolean;
  any?: Condition[];
}

/* ── Authored lines ────────────────────────────────────── */

export interface Line {
  ko: string;
  en: string;
  rom?: string;
  /** Stage direction or Tong-facing note; never shown as dialogue. */
  note?: string;
  /** Lines that must be checked before shipping. */
  review?: 'native' | 'jeju-native';
}

export interface Variant<T> {
  when?: Condition;
  value: T;
}

export type Expr =
  | 'neutral' | 'cool' | 'smirk' | 'smile' | 'laugh' | 'surprised'
  | 'blush' | 'sad' | 'angry' | 'tired' | 'thinking';

/* ── Input ladder ──────────────────────────────────────── */

/**
 * 0 = pick an English intent, Tong says it (she notices).
 * 1 = pick from Korean lines (register traps are social, not "wrong").
 * 2 = build the line from chunks (sentence_builder / block_crush).
 * 3 = say or type it freely (free_input, speech later).
 */
export type InputTier = 0 | 1 | 2 | 3;

export type Intent =
  | 'tease' | 'comfort' | 'challenge' | 'defer' | 'decline' | 'confess'
  | 'ask' | 'presence' | 'deflect' | 'commit' | 'help' | 'apologize' | 'leave';

export interface ExerciseHook {
  type: ExerciseData['type'];
  objectiveId: string;
  targets: string[];
  distractors?: string[];
  framing: Line;
  /** What failing costs. 'assist' = Tong or a character helps and the scene goes on. */
  onFail: 'assist' | 'continue' | 'retry';
}

/**
 * Exercise results feed the scene through flags: when the exercise on beat
 * `b` (or on choice `c` of beat `b`) finishes, the runtime sets
 * `ex_<b>` (or `ex_<b>_<c>`) to true on a pass and false on a fail, before
 * the beat's choices and outcomes resolve. Branch on it with
 * `when: { flags: ['ex_h1_tags'] }` / `notFlags`. When the player closes the
 * exercise or it can't run (no Tong host), the cozy runtime also sets
 * `ex_<b>_skipped`, so a scene can offer a plain choice instead.
 */
export const exerciseFlag = (beatId: string, choiceId?: string) => (choiceId ? `ex_${beatId}_${choiceId}` : `ex_${beatId}`);

/* ── Scenes ────────────────────────────────────────────── */

export interface Effects {
  deltas?: Partial<Axes>;
  /** Set on this relationship and save-wide (see WorldCtx.flags). */
  setFlags?: string[];
  /** Save-wide counters to bump by one (see WorldCtx.tally). */
  tally?: string[];
  learn?: string[];
  memory?: { tag: string; note: string };
  /** Only applied when the milestone's eligibility holds (see STAGE_MILESTONES). */
  stageTo?: Stage;
  /** Unlocks a vocab/phrase entry tagged with this scene ("words Haeun taught you"). */
  vocab?: Line[];
}

export interface Outcome extends Effects {
  when?: Condition;
  reaction: Line;
  speaker?: string;
  expr?: Expr;
  next?: string;
}

/**
 * What the other person is asking you to accept (Jin's route). Generosity (he
 * pays, gives you a ride) is fine to take and never counts against you.
 * A directive (where you go, who you see, what you say, when you reply) is
 * what tally.jin_directives counts when you go along with it.
 */
export type Ask = 'generosity' | 'directive';

export interface Choice {
  id: string;
  intent: Intent;
  ask?: Ask;
  gate?: Condition;
  /** What the player says. Tier 0 shows `en`; tier 1+ shows `ko`. */
  say: Line;
  /** Lowest tier at which this option is offered at all (a mastery-gated reply). */
  minTier?: InputTier;
  /** Optional build/say exercise to actually produce the line at tier ≥ 2. */
  exercise?: ExerciseHook;
  /** First matching outcome wins; the last should have no `when`. */
  outcomes: Outcome[];
}

export interface TongLine extends Line {
  /** Tong speaks less as the player improves; above this level the line is dropped. */
  maxLevel?: number;
}

/**
 * Stage directions a runtime may act on (the lab ignores them): the cozy 3D
 * world sits the player down at 'sit', serves food at 'serve', and so on.
 */
export type Cue = 'sit' | 'serve' | 'phone_buzz' | 'stand' | 'leave' | 'photo' | 'ride';

export interface Beat {
  id: string;
  speaker: string;
  expr?: Expr;
  cue?: Cue;
  lines: Variant<Line>[];
  when?: Condition;
  tong?: TongLine;
  exercise?: ExerciseHook;
  choices?: Choice[];
  effects?: Effects;
  next?: string;
  end?: boolean;
}

export type SceneKind = 'story' | 'ambient';

export interface Scene {
  id: string;
  kind: SceneKind;
  title: Line;
  characterId: string;
  location: string;
  /** Story slot this scene fills, e.g. "m1.s1". Ambient scenes have none. */
  slot?: string;
  gate: Condition;
  /** Scene to run in this slot instead when the gate fails. */
  fallback?: string;
  /** Plain-language summary for the plan and the harness. */
  summary: string;
  /** What this scene plants for later payoffs. */
  seeds?: string[];
  beats: Beat[];
}

/* ── Harness presets ───────────────────────────────────── */

/** A named starting state for the harness: "friend, she bombed the eval, raining". */
export interface Preset {
  id: string;
  label: string;
  state: Partial<Omit<RelState, 'axes' | 'mood'>> & { axes?: Partial<Axes>; mood?: Partial<Mood> };
  world?: Partial<WorldCtx>;
  /** Choice ids to take in order for the scripted walkthrough; unspecified beats take the first option. */
  path?: string[];
  /** Exercise results for the replay: true = pass everything, or per beat id (default true). */
  exercises?: boolean | Record<string, boolean>;
}

export interface SceneModule {
  scene: Scene;
  presets: Preset[];
}

/* ── KakaoTalk ─────────────────────────────────────────── */

export interface KakaoMsg {
  from: 'them' | 'me';
  /** Display name in a group chat (단톡), e.g. "민지". */
  sender?: string;
  ko: string;
  en: string;
  /** "삭제된 메시지입니다" — the player sees only that it was deleted. */
  deleted?: boolean;
  photo?: string;
  /** Minutes after the previous message. */
  delay?: number;
}

export interface KakaoReply {
  id: string;
  intent: Intent;
  ask?: Ask;
  say: Line;
  gate?: Condition;
  minTier?: InputTier;
  /** Leaving it on read is a choice too: model it as a reply with intent 'leave'. */
  outcomes: (Effects & { when?: Condition; messages: KakaoMsg[] })[];
}

export interface KakaoThread {
  id: string;
  characterId: string;
  title: string;
  gate: Condition;
  /** Clock time the first message arrives, "01:12". */
  at: string;
  messages: KakaoMsg[];
  replies?: KakaoReply[];
  summary: string;
}

export interface KakaoModule {
  thread: KakaoThread;
  /** At least one preset that passes the gate; the harness plays each reply from it. */
  presets: Preset[];
}

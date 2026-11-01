/**
 * Host side of the cozy 3D game bridge (contracts: packages/contracts/types.ts,
 * "Cozy 3D game ↔ host page bridge"). Pure functions only, so they can be unit
 * tested without React or the browser: message validation, store snapshots,
 * world events → store actions, the legacy-save import and the in-world
 * exercises built from a cozy request.
 */
import type {
  CozyExerciseRequest,
  CozyExerciseStage,
  CozyItemCategory,
  CozyLegacyMigration,
  CozyProgressEvent,
  CozyProgressSnapshot,
  CozyRecordedItem,
  CozyToHostMessage,
  HostToCozyMessage,
} from '../../../../packages/contracts';
import type { GameAction, GameState } from '../store/game-store';
import type { BlockCrushExercise, BlockCrushCharStep, SentenceBuilderExercise } from '../types/hangout';
import type { ItemMastery } from '../types/mastery';

export const PROTOCOL = 'tong-cozy-bridge';
export const VERSION = 1;

/** One legacy cozy heart is worth this much shared affinity (0–100 scale). */
export const AFFINITY_PER_HEART = 5;
/** XP for an in-world exercise; SP stays a quest reward (#386). */
export const EXERCISE_XP = { correct: 10, incorrect: 2 } as const;
const MAX_AFFINITY_DELTA = 10;

const EXERCISE_TYPES = new Set(['block_crush', 'sentence_builder', 'multiple_choice', 'pronunciation_select', 'matching']);
const STAGES = new Set(['intro', 'recognition', 'recall']);
const CATEGORIES = new Set(['script', 'vocabulary', 'grammar']);
const CITIES = new Set(['seoul', 'tokyo', 'shanghai']);
const ID = /^[a-z][a-z0-9_]{0,39}$/;
const OBJECTIVE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SAVE_ID = /^[a-z0-9-]{1,64}$/;
const BEAT_ID = /^[\w:#.-]{1,80}$/;

type Parsed = { ok: true; message: CozyToHostMessage } | { ok: false; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Ids become store keys: refuse names that collide with Object.prototype (constructor, __proto__, …). */
const safeKey = (v: string) => v !== '__proto__' && !(v in Object.prototype);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && safeKey(v.trim());
const optText = (v: unknown, max: number) => v === undefined || text(v, max);
const textList = (v: unknown, min: number, max: number, len: number): v is string[] =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every((s) => text(s, len));

function exerciseError(p: Record<string, unknown>): string | null {
  if (!EXERCISE_TYPES.has(p.exerciseType as string)) return 'unknown exerciseType';
  if (!textList(p.targetItems, 1, 8, 40)) return 'targetItems must be 1–8 short strings';
  if (typeof p.objectiveId !== 'string' || !OBJECTIVE.test(p.objectiveId)) return 'bad objectiveId';
  if (p.stage !== undefined && !STAGES.has(p.stage as string)) return 'bad stage';
  if (!isObj(p.framing) || !text(p.framing.en, 240) || !optText(p.framing.ko, 240)) return 'bad framing';
  if (p.framing.speakerId !== undefined && !(typeof p.framing.speakerId === 'string' && ID.test(p.framing.speakerId))) return 'bad speakerId';
  if (!optText(p.meaning, 80)) return 'bad meaning';
  if (p.distractors !== undefined && !textList(p.distractors, 0, 6, 40)) return 'bad distractors';
  if (!CITIES.has(p.cityId as string)) return 'bad cityId';
  if (typeof p.locationId !== 'string' || !ID.test(p.locationId)) return 'bad locationId';
  if (p.characterId !== undefined && !(typeof p.characterId === 'string' && ID.test(p.characterId) && safeKey(p.characterId))) return 'bad characterId';
  return null;
}

function eventError(e: unknown): string | null {
  if (!isObj(e)) return 'bad event';
  if (e.beatId !== undefined && !(typeof e.beatId === 'string' && BEAT_ID.test(e.beatId))) return 'bad beatId';
  if (e.kind === 'affinity') {
    if (typeof e.characterId !== 'string' || !ID.test(e.characterId) || !safeKey(e.characterId)) return 'bad characterId';
    if (typeof e.delta !== 'number' || !Number.isFinite(e.delta)) return 'bad delta';
    return null;
  }
  if (e.kind === 'item_seen') return text(e.itemId, 40) && CATEGORIES.has(e.category as string) ? null : 'bad item_seen';
  if (e.kind === 'location_hangout') {
    return CITIES.has(e.cityId as string) && typeof e.locationId === 'string' && ID.test(e.locationId) ? null : 'bad location_hangout';
  }
  return 'unknown event kind';
}

function migrationError(p: Record<string, unknown>): string | null {
  if (typeof p.saveId !== 'string' || !SAVE_ID.test(p.saveId)) return 'bad saveId';
  if (!Array.isArray(p.hearts) || p.hearts.length > 2) return 'bad hearts';
  for (const h of p.hearts) {
    if (!isObj(h) || (h.characterId !== 'haeun' && h.characterId !== 'jin')) return 'bad hearts';
    if (!Number.isInteger(h.hearts) || (h.hearts as number) < 0 || (h.hearts as number) > 8) return 'bad hearts';
  }
  if (!Array.isArray(p.phrases) || p.phrases.length > 400) return 'bad phrases';
  for (const ph of p.phrases) if (!isObj(ph) || !text(ph.ko, 40) || !optText(ph.en, 120)) return 'bad phrases';
  return null;
}

function practiceError(p: Record<string, unknown>): string | null {
  if (p.mode !== 'learn' && p.mode !== 'review') return 'bad mode';
  if (!CITIES.has(p.cityId as string)) return 'bad cityId';
  if (typeof p.locationId !== 'string' || !ID.test(p.locationId)) return 'bad locationId';
  if (!Array.isArray(p.words) || p.words.length > 400) return 'words must be a list of at most 400';
  for (const w of p.words) if (!isObj(w) || !text(w.ko, 40) || !optText(w.rom, 80) || !optText(w.en, 120)) return 'bad words';
  return null;
}

/** Validate an untrusted postMessage payload from the cozy iframe. */
export function parseCozyMessage(data: unknown): Parsed {
  if (!isObj(data) || data.protocol !== PROTOCOL) return { ok: false, reason: 'not a cozy bridge message' };
  if (data.version !== VERSION) return { ok: false, reason: `unsupported version ${String(data.version)}` };
  if (data.requestId !== undefined && !(typeof data.requestId === 'string' && /^[\w-]{1,64}$/.test(data.requestId))) {
    return { ok: false, reason: 'bad requestId' };
  }
  const p = data.payload;
  if (!isObj(p)) return { ok: false, reason: 'missing payload' };
  let error: string | null;
  switch (data.type) {
    case 'cozy:hello':
      error = null;
      break;
    case 'cozy:exercise':
      error = exerciseError(p);
      break;
    case 'cozy:progress':
      error = Array.isArray(p.events) && p.events.length <= 50 ? p.events.map(eventError).find(Boolean) ?? null : 'events must be a list of at most 50';
      break;
    case 'cozy:migrate':
      error = migrationError(p);
      break;
    case 'cozy:practice':
      error = practiceError(p);
      break;
    default:
      error = `unknown type ${String(data.type)}`;
  }
  return error ? { ok: false, reason: error } : { ok: true, message: data as unknown as CozyToHostMessage };
}

type ReplyType = HostToCozyMessage['type'];
type ReplyPayload<T extends ReplyType> = Extract<HostToCozyMessage, { type: T }>['payload'];

export function envelope<T extends ReplyType>(type: T, payload: ReplyPayload<T>, requestId?: string): HostToCozyMessage {
  return { protocol: PROTOCOL, version: VERSION, type, payload, ...(requestId ? { requestId } : {}) } as HostToCozyMessage;
}

/* ── Store ⇄ bridge ──────────────────────────────────────── */

export function snapshotFromState(state: GameState): CozyProgressSnapshot {
  const relationships: CozyProgressSnapshot['relationships'] = {};
  for (const [id, r] of Object.entries(state.relationships)) relationships[id] = { affinity: r.affinity, stage: r.stage };
  const items: CozyProgressSnapshot['items'] = {};
  for (const [id, m] of Object.entries(state.itemMastery)) {
    items[id] = { masteryLevel: m.masteryLevel, correct: m.correct, incorrect: m.incorrect };
  }
  return {
    xp: state.xp,
    sp: state.sp,
    level: state.calibratedLevel ?? state.selfAssessedLevel,
    relationships,
    locationHangoutCounts: { ...state.locationHangoutCounts },
    items,
  };
}

/**
 * Store actions for validated world events. Unknown locations are dropped;
 * affinity steps are clamped; a beat already in `awarded` is skipped and new
 * beats are added to it (the caller persists it).
 *
 * Affinity deliberately does not count as an interaction: /game uses
 * interactionCount === 0 to play its first-meeting hangout.
 */
export function actionsForEvents(
  events: CozyProgressEvent[],
  isKnownLocation: (key: string) => boolean,
  awarded: Set<string> = new Set(),
): GameAction[] {
  const out: GameAction[] = [];
  for (const e of events) {
    if (e.kind !== 'item_seen' && e.beatId) {
      if (awarded.has(e.beatId)) continue;
      awarded.add(e.beatId);
    }
    if (e.kind === 'affinity') {
      const delta = Math.max(-MAX_AFFINITY_DELTA, Math.min(MAX_AFFINITY_DELTA, Math.round(e.delta)));
      if (delta) out.push({ type: 'UPDATE_AFFINITY', characterId: e.characterId, delta });
    } else if (e.kind === 'item_seen') {
      out.push({ type: 'RECORD_ITEM_SEEN', itemId: e.itemId.trim(), category: e.category });
    } else if (isKnownLocation(`${e.cityId}:${e.locationId}`)) {
      out.push({ type: 'INCREMENT_LOCATION_HANGOUT', cityId: e.cityId, locationId: e.locationId });
    }
  }
  return out;
}

/** Store actions that carry a legacy cozy save into the shared store. */
export function actionsForMigration(m: CozyLegacyMigration): GameAction[] {
  const out: GameAction[] = [];
  for (const h of m.hearts) {
    if (h.hearts > 0) out.push({ type: 'UPDATE_AFFINITY', characterId: h.characterId, delta: h.hearts * AFFINITY_PER_HEART });
  }
  const seen = new Set<string>();
  for (const p of m.phrases) {
    const ko = p.ko.trim();
    if (seen.has(ko)) continue;
    seen.add(ko);
    out.push({ type: 'RECORD_ITEM_SEEN', itemId: ko, category: 'vocabulary' });
  }
  return out;
}

/* ── Hangul ──────────────────────────────────────────────── */

const LEAD = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWEL = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const TAIL = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const LEAD_ROM = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const VOWEL_ROM = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const TAIL_ROM = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
// Same colours as the shared block-crush data: consonant gold, vowel green, final blue.
const SLOT_COLOUR = { C: '#f0c040', V: '#4ecdc4', F: '#7eb8da' };

export function decomposeHangul(syllable: string): { lead: string; vowel: string; tail: string; rom: string } | null {
  const code = syllable.codePointAt(0);
  if (syllable.length !== 1 || code === undefined || code < 0xac00 || code > 0xd7a3) return null;
  const n = code - 0xac00;
  const l = Math.floor(n / 588);
  const v = Math.floor((n % 588) / 28);
  const t = n % 28;
  return { lead: LEAD[l], vowel: VOWEL[v], tail: TAIL[t], rom: LEAD_ROM[l] + VOWEL_ROM[v] + TAIL_ROM[t] };
}

const MASTERY_RANK = { new: 0, seen: 0, learning: 1, familiar: 2, mastered: 3 } as const;

/** Intro until the syllables have been practised, recall once they are all familiar. */
export function stageFor(chars: string[], mastery: Record<string, ItemMastery>): CozyExerciseStage {
  const ranks = chars.map((c) => MASTERY_RANK[mastery[c]?.masteryLevel ?? 'new']);
  const lowest = Math.min(...ranks);
  if (lowest >= 2) return 'recall';
  if (lowest >= 1) return 'recognition';
  return 'intro';
}

const slug = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(36)).join('');

/** A block-crush over a whole Hangul word, one block per syllable. Null when the word is not plain Hangul. */
export function buildBlockCrush(req: CozyExerciseRequest, mastery: Record<string, ItemMastery>): BlockCrushExercise | null {
  const word = req.targetItems[0].trim();
  const chars = [...word];
  if (chars.length > 6) return null;
  const parts = chars.map(decomposeHangul);
  if (parts.some((p) => !p)) return null;
  const meaning = req.meaning ?? word;
  const steps: BlockCrushCharStep[] = parts.map((p, i) => ({
    targetChar: chars[i],
    components: [
      { piece: p!.lead, slot: 'C', colorHint: SLOT_COLOUR.C },
      { piece: p!.vowel, slot: 'V', colorHint: SLOT_COLOUR.V },
      ...(p!.tail ? [{ piece: p!.tail, slot: 'F', colorHint: SLOT_COLOUR.F }] : []),
    ],
    romanization: p!.rom,
    meaning,
  }));
  const first = steps[0];
  return {
    type: 'block_crush',
    id: `cozy-bc-${slug(word)}`,
    objectiveId: req.objectiveId,
    difficulty: chars.length > 2 ? 2 : 1,
    prompt: req.framing.en,
    language: 'ko',
    targetChar: first.targetChar,
    components: first.components,
    romanization: steps.map((s) => s.romanization).join('-'),
    meaning,
    stage: req.stage ?? stageFor(chars, mastery),
    ...(steps.length > 1 ? { sequence: steps, fullWord: word } : {}),
  };
}

/** Deterministic shuffle so a replayed request gives the same tiles. */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Never hand over the answer already in order.
  if (a.length > 1 && a.slice(0, items.length).every((x, i) => x === items[i])) a.push(a.shift()!);
  return a;
}

export function buildSentenceBuilder(req: CozyExerciseRequest): SentenceBuilderExercise {
  const order = req.targetItems.map((t) => t.trim());
  const distractors = (req.distractors ?? []).map((t) => t.trim()).filter((t) => !order.includes(t));
  return {
    type: 'sentence_builder',
    id: `cozy-sb-${slug(order.join(' '))}`,
    objectiveId: req.objectiveId,
    difficulty: order.length > 2 ? 2 : 1,
    prompt: req.framing.en,
    wordTiles: seededShuffle([...order, ...distractors], order.join(' ')),
    correctOrder: order,
    distractors,
    explanation: req.meaning ? `${order.join(' ')} = ${req.meaning}` : undefined,
  };
}

/**
 * What an in-world block-crush or sentence-builder result teaches the store:
 * block-crush records each syllable (script) and the word (vocabulary);
 * sentence-builder records each token: endings and particles as grammar, words as vocabulary.
 */
export function recordedItemsFor(req: CozyExerciseRequest, correct: boolean): CozyRecordedItem[] {
  if (req.exerciseType === 'block_crush') {
    const word = req.targetItems[0].trim();
    const chars = [...new Set([...word])];
    return [
      ...chars.map((c) => ({ itemId: c, category: 'script' as const, correct })),
      ...(chars.length > 1 || word.length > 1 ? [{ itemId: word, category: 'vocabulary' as const, correct }] : []),
    ];
  }
  if (req.exerciseType === 'sentence_builder') {
    return req.targetItems.map((t) => ({
      itemId: t.trim(),
      category: /주세요$|^[을를이가은는]$/.test(t.trim()) ? ('grammar' as const) : ('vocabulary' as const),
      correct,
    }));
  }
  return [];
}

import { useSyncExternalStore } from 'react';
import type { Relationship } from '../types/relationship';
import { getRelationshipStage, defaultRelationship } from '../types/relationship';
import type { ItemMastery, MasterySnapshot } from '../types/mastery';
import { computeMasteryLevel } from '../types/mastery';
import { sm2, qualityFromCorrect, defaultSRSFields } from '../curriculum/srs';
import type { Location } from '../types/objectives';
import type { AppLang, CityId } from '../api';

/* ── Player profile ────────────────────────────────────── */

export interface PlayerProfile {
  englishName: string;
  chineseName: string;
  dateOfBirth?: string;
  height?: string;
}

/* ── State shape ────────────────────────────────────────── */

export interface GameState {
  relationships: Record<string, Relationship>;
  itemMastery: Record<string, ItemMastery>;
  xp: number;
  sp: number;
  selfAssessedLevel: number | null;
  calibratedLevel: number | null;
  playerName: string;
  playerProfile: PlayerProfile;
  locationLevels: Record<string, { level: number }>;
  locationHangoutCounts: Record<string, number>;   // key: "seoul:food_street"
  unlockedLocations: Record<string, boolean>;       // key: "seoul:cafe"
  explainIn: Record<CityId, AppLang>;                // per-city language Tong explains in
}

/* ── Actions ────────────────────────────────────────────── */

export type GameAction =
  | { type: 'UPDATE_AFFINITY'; characterId: string; delta: number }
  | { type: 'RECORD_ITEM_RESULT'; itemId: string; category: 'script' | 'vocabulary' | 'grammar'; correct: boolean }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'ADD_SP'; amount: number }
  | { type: 'SET_CALIBRATED_LEVEL'; level: number }
  | { type: 'SET_SELF_ASSESSED_LEVEL'; level: number }
  | { type: 'SET_RELATIONSHIP'; characterId: string; relationship: Relationship }
  | { type: 'INCREMENT_INTERACTION'; characterId: string }
  | { type: 'INCREMENT_LOCATION_HANGOUT'; cityId: string; locationId: string }
  | { type: 'UNLOCK_LOCATION'; cityId: string; locationId: string }
  | { type: 'SET_EXPLAIN_LANGUAGE'; cityId: CityId; lang: AppLang }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'SET_PLAYER_PROFILE'; profile: PlayerProfile }
  | { type: 'RESET' };

/* ── Persistence ────────────────────────────────────────── */

const STORAGE_KEY = 'tong-game';

function loadState(): GameState {
  if (typeof window === 'undefined') return createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Backfill fields added after initial release
      const defaults = createInitialState();
      const state: GameState = {
        ...defaults,
        ...parsed,
        playerName: parsed.playerName ?? '',
        playerProfile: parsed.playerProfile ?? {
          englishName: parsed.playerName ?? '',
          chineseName: '',
          dateOfBirth: '',
          height: '',
        },
        locationHangoutCounts: parsed.locationHangoutCounts ?? defaults.locationHangoutCounts,
        unlockedLocations: parsed.unlockedLocations ?? defaults.unlockedLocations,
        explainIn: (parsed.explainIn && typeof parsed.explainIn === 'object')
          ? { ...defaults.explainIn, ...parsed.explainIn }
          : defaults.explainIn,
      };
      // Backfill SRS fields for existing mastery entries
      if (state.itemMastery) {
        for (const key of Object.keys(state.itemMastery)) {
          const m = state.itemMastery[key];
          if (m && m.easeFactor === undefined) {
            const srsDefaults = defaultSRSFields();
            state.itemMastery[key] = { ...m, ...srsDefaults };
          }
        }
      }
      return state;
    }
  } catch { /* ignore */ }
  return createInitialState();
}

function persistState(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function createInitialState(): GameState {
  return {
    relationships: {},
    itemMastery: {},
    xp: 0,
    sp: 0,
    selfAssessedLevel: null,
    calibratedLevel: null,
    playerName: '',
    playerProfile: { englishName: '', chineseName: '', dateOfBirth: '', height: '' },
    locationLevels: {},
    locationHangoutCounts: {},
    unlockedLocations: { 'seoul:food_street': true, 'shanghai:dumpling_shop': true, 'tokyo:ramen_shop': true },
    explainIn: { seoul: 'en', tokyo: 'en', shanghai: 'en' },
  };
}

/* ── Reducer ────────────────────────────────────────────── */

function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'UPDATE_AFFINITY': {
      const rel = state.relationships[action.characterId] ?? defaultRelationship(action.characterId);
      const newAffinity = Math.max(0, Math.min(100, rel.affinity + action.delta));
      const newStage = getRelationshipStage(newAffinity);
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [action.characterId]: { ...rel, affinity: newAffinity, stage: newStage },
        },
      };
    }
    case 'RECORD_ITEM_RESULT': {
      const existing = state.itemMastery[action.itemId];
      const correct = (existing?.correct ?? 0) + (action.correct ? 1 : 0);
      const incorrect = (existing?.incorrect ?? 0) + (action.correct ? 0 : 1);
      const total = correct + incorrect;

      // Compute SRS update
      const prevSRS = existing ?? { easeFactor: 2.5, interval: 0, repetitions: 0 };
      const quality = qualityFromCorrect(action.correct);
      const srsUpdate = sm2(action.correct, quality, prevSRS);

      return {
        ...state,
        itemMastery: {
          ...state.itemMastery,
          [action.itemId]: {
            itemId: action.itemId,
            category: action.category,
            correct,
            incorrect,
            lastSeen: Date.now(),
            masteryLevel: computeMasteryLevel(correct, total),
            ...srsUpdate,
          },
        },
      };
    }
    case 'ADD_XP':
      return { ...state, xp: state.xp + action.amount };
    case 'ADD_SP':
      return { ...state, sp: state.sp + action.amount };
    case 'SET_CALIBRATED_LEVEL':
      return { ...state, calibratedLevel: action.level };
    case 'SET_SELF_ASSESSED_LEVEL':
      return { ...state, selfAssessedLevel: action.level };
    case 'SET_RELATIONSHIP':
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [action.characterId]: action.relationship,
        },
      };
    case 'INCREMENT_INTERACTION': {
      const rel = state.relationships[action.characterId] ?? defaultRelationship(action.characterId);
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [action.characterId]: {
            ...rel,
            interactionCount: rel.interactionCount + 1,
            lastInteraction: Date.now(),
          },
        },
      };
    }
    case 'INCREMENT_LOCATION_HANGOUT': {
      const key = `${action.cityId}:${action.locationId}`;
      return {
        ...state,
        locationHangoutCounts: {
          ...state.locationHangoutCounts,
          [key]: (state.locationHangoutCounts[key] ?? 0) + 1,
        },
      };
    }
    case 'UNLOCK_LOCATION': {
      const key = `${action.cityId}:${action.locationId}`;
      return {
        ...state,
        unlockedLocations: {
          ...state.unlockedLocations,
          [key]: true,
        },
      };
    }
    case 'SET_EXPLAIN_LANGUAGE':
      return { ...state, explainIn: { ...state.explainIn, [action.cityId]: action.lang } };
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.name };
    case 'SET_PLAYER_PROFILE':
      return { ...state, playerProfile: action.profile, playerName: action.profile.englishName };
    case 'RESET':
      return createInitialState();
    default:
      return state;
  }
}

/* ── Singleton store ────────────────────────────────────── */

let state: GameState = loadState();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function dispatch(action: GameAction): void {
  state = reduce(state, action);
  persistState(state);
  notify();
}

export function getGameState(): GameState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): GameState {
  return state;
}

function getServerSnapshot(): GameState {
  return createInitialState();
}

/** React hook — re-renders when state changes. */
export function useGameState(): GameState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ── Computed helpers ───────────────────────────────────── */

export function getRelationship(characterId: string): Relationship {
  return state.relationships[characterId] ?? defaultRelationship(characterId);
}

export function getLocationHangoutCount(cityId: string, locationId: string): number {
  return state.locationHangoutCounts[`${cityId}:${locationId}`] ?? 0;
}

export function isLocationUnlocked(cityId: string, locationId: string): boolean {
  return state.unlockedLocations[`${cityId}:${locationId}`] ?? false;
}

export function isMissionAvailable(cityId: string, locationId: string): boolean {
  return getLocationHangoutCount(cityId, locationId) >= 3;
}

export function getMasterySnapshot(location: Location): MasterySnapshot {
  const scriptItems = location.vocabularyTargets
    .filter((v) => v.level === 0)
    .map((v) => v.word);
  const vocabItems = location.vocabularyTargets.map((v) => v.word);
  const grammarItems = location.grammarTargets.map((g) => g.id);

  const scriptLearned = scriptItems.filter((item) => {
    const m = state.itemMastery[item];
    return m && (m.masteryLevel === 'familiar' || m.masteryLevel === 'mastered');
  });

  const vocabStrong: string[] = [];
  const vocabWeak: string[] = [];
  let vocabMastered = 0;
  for (const word of vocabItems) {
    const m = state.itemMastery[word];
    if (!m) continue;
    if (m.masteryLevel === 'mastered' || m.masteryLevel === 'familiar') {
      vocabStrong.push(word);
      if (m.masteryLevel === 'mastered') vocabMastered++;
    } else if (m.masteryLevel === 'seen' || m.masteryLevel === 'learning') {
      vocabWeak.push(word);
    }
  }

  const grammarMastered: string[] = [];
  const grammarLearning: string[] = [];
  const grammarNotStarted: string[] = [];
  for (const gId of grammarItems) {
    const m = state.itemMastery[gId];
    if (!m || m.masteryLevel === 'new') grammarNotStarted.push(gId);
    else if (m.masteryLevel === 'mastered' || m.masteryLevel === 'familiar') grammarMastered.push(gId);
    else grammarLearning.push(gId);
  }

  return {
    script: { learned: scriptLearned, total: 24 },
    pronunciation: { accuracy: 0, weakSounds: [] },
    vocabulary: { strong: vocabStrong, weak: vocabWeak, total: vocabItems.length, mastered: vocabMastered },
    grammar: { mastered: grammarMastered, learning: grammarLearning, notStarted: grammarNotStarted },
  };
}

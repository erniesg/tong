import { useSyncExternalStore } from 'react';
import type { Relationship } from '../types/relationship';
import { getRelationshipStage, defaultRelationship } from '../types/relationship';
import type { ItemMastery, MasterySnapshot } from '../types/mastery';
import { computeMasteryLevel } from '../types/mastery';
import type { Location } from '../types/objectives';

/* ── State shape ────────────────────────────────────────── */

export interface GameState {
  relationships: Record<string, Relationship>;
  itemMastery: Record<string, ItemMastery>;
  xp: number;
  sp: number;
  selfAssessedLevel: number | null;
  calibratedLevel: number | null;
  locationLevels: Record<string, { level: number }>;
}

/* ── Actions ────────────────────────────────────────────── */

export type GameAction =
  | { type: 'UPDATE_AFFINITY'; characterId: string; delta: number }
  | { type: 'RECORD_ITEM_RESULT'; itemId: string; category: 'script' | 'vocabulary' | 'grammar'; correct: boolean }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'SET_CALIBRATED_LEVEL'; level: number }
  | { type: 'SET_SELF_ASSESSED_LEVEL'; level: number }
  | { type: 'SET_RELATIONSHIP'; characterId: string; relationship: Relationship }
  | { type: 'INCREMENT_INTERACTION'; characterId: string };

/* ── Persistence ────────────────────────────────────────── */

const STORAGE_KEY = 'tong-game';

function loadState(): GameState {
  if (typeof window === 'undefined') return createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as GameState;
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
    locationLevels: {},
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
          },
        },
      };
    }
    case 'ADD_XP':
      return { ...state, xp: state.xp + action.amount };
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

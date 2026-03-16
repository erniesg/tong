import { useSyncExternalStore } from 'react';
import type { ExerciseData } from '../types/hangout';

/* ── Types ───────────────────────────────────────────────── */

export interface ActiveSession {
  id: string;
  cityId: string;
  locationId: string;
  objectiveId?: string;
  exercisesCompleted: number;
  exercisesCorrect: number;
  startedAt: number;
}

export interface CompletedSession {
  id: string;
  cityId: string;
  locationId: string;
  objectiveId?: string;
  startedAt: number;
  endedAt: number;
  durationMinutes: number;
  exercisesCompleted: number;
  exercisesCorrect: number;
  summary: string;
  /** Serialized messages for replay (stored as JSON-safe objects). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  exerciseMap: Record<string, ExerciseData>;
}

export interface SessionState {
  activeSession: ActiveSession | null;
  completedSessions: CompletedSession[];
}

/* ── Actions ─────────────────────────────────────────────── */

export type SessionAction =
  | { type: 'START_SESSION'; cityId: string; locationId: string; objectiveId?: string }
  | { type: 'RECORD_EXERCISE_RESULT'; correct: boolean }
  | {
      type: 'SAVE_COMPLETED_SESSION';
      summary: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: any[];
      exerciseMap: Record<string, ExerciseData>;
    }
  | { type: 'CLEAR_ACTIVE_SESSION' }
  | { type: 'DELETE_SESSION'; sessionId: string };

/* ── Persistence ─────────────────────────────────────────── */

const STORAGE_KEY = 'tong-learn-sessions';
const MAX_SESSIONS = 30;

function loadState(): SessionState {
  if (typeof window === 'undefined') return createInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SessionState;
  } catch { /* ignore */ }
  return createInitialState();
}

function persistState(state: SessionState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function createInitialState(): SessionState {
  return {
    activeSession: null,
    completedSessions: [],
  };
}

/* ── Reducer ─────────────────────────────────────────────── */

function reduce(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_SESSION': {
      const session: ActiveSession = {
        id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        cityId: action.cityId,
        locationId: action.locationId,
        objectiveId: action.objectiveId,
        exercisesCompleted: 0,
        exercisesCorrect: 0,
        startedAt: Date.now(),
      };
      return { ...state, activeSession: session };
    }

    case 'RECORD_EXERCISE_RESULT': {
      if (!state.activeSession) return state;
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          exercisesCompleted: state.activeSession.exercisesCompleted + 1,
          exercisesCorrect: state.activeSession.exercisesCorrect + (action.correct ? 1 : 0),
        },
      };
    }

    case 'SAVE_COMPLETED_SESSION': {
      if (!state.activeSession) return state;
      const now = Date.now();
      const completed: CompletedSession = {
        id: state.activeSession.id,
        cityId: state.activeSession.cityId,
        locationId: state.activeSession.locationId,
        objectiveId: state.activeSession.objectiveId,
        startedAt: state.activeSession.startedAt,
        endedAt: now,
        durationMinutes: Math.round((now - state.activeSession.startedAt) / 60000),
        exercisesCompleted: state.activeSession.exercisesCompleted,
        exercisesCorrect: state.activeSession.exercisesCorrect,
        summary: action.summary,
        messages: action.messages,
        exerciseMap: action.exerciseMap,
      };

      const updated = [completed, ...state.completedSessions].slice(0, MAX_SESSIONS);
      return { activeSession: null, completedSessions: updated };
    }

    case 'CLEAR_ACTIVE_SESSION':
      return { ...state, activeSession: null };

    case 'DELETE_SESSION':
      return {
        ...state,
        completedSessions: state.completedSessions.filter((s) => s.id !== action.sessionId),
      };

    default:
      return state;
  }
}

/* ── Singleton store ─────────────────────────────────────── */

let state: SessionState = loadState();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function dispatchSession(action: SessionAction): void {
  state = reduce(state, action);
  persistState(state);
  notify();
}

export function getSessionState(): SessionState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SessionState {
  return state;
}

function getServerSnapshot(): SessionState {
  return createInitialState();
}

/** React hook — re-renders when session state changes. */
export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

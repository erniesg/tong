import type {
  DirectorState,
  LocationPipeline,
  DirectorStage,
  Proposal,
  LocationConcept,
  CharacterConcept,
  CurriculumConcept,
  BackdropConcept,
  LocationPlan,
} from '../types/director';

/* ── Initial state ─────────────────────────────────────────── */

const STORAGE_KEY = 'tong-director';
const EMPTY: DirectorState = { pipelines: {}, activePipelineId: null };

function loadState(): DirectorState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DirectorState;
      // Migrate old pipelines with legacy stages to new 'plan' stage
      for (const [id, p] of Object.entries(parsed.pipelines)) {
        const stage = p.currentStage as string;
        if (stage === 'concept' || stage === 'characters' || stage === 'curriculum') {
          parsed.pipelines[id] = { ...p, currentStage: 'plan' };
        }
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return EMPTY;
}

// Start with empty state — hydrate from localStorage after mount
let state: DirectorState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function emit() {
  persist();
  listeners.forEach((fn) => fn());
}

function ensureHydrated() {
  if (!hydrated && typeof window !== 'undefined') {
    hydrated = true;
    state = loadState();
  }
}

/* ── Public API ────────────────────────────────────────────── */

export function getDirectorState(): DirectorState {
  return state;
}

function getServerSnapshot(): DirectorState {
  return EMPTY;
}

export function subscribeDirector(fn: () => void): () => void {
  ensureHydrated();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDirectorState(): DirectorState {
  const { useSyncExternalStore, useEffect, useState } = require('react');
  const store = useSyncExternalStore(subscribeDirector, getDirectorState, getServerSnapshot);
  const [, setMounted] = useState(false);
  useEffect(() => {
    ensureHydrated();
    setMounted(true);
  }, []);
  return store;
}

/* ── Pipeline CRUD ─────────────────────────────────────────── */

export function createPipeline(cityId: string, locationId: string, locationStub?: Record<string, unknown>): LocationPipeline {
  const id = `${cityId}:${locationId}`;
  const now = new Date().toISOString();
  const pipeline: LocationPipeline = {
    id,
    cityId,
    currentStage: 'plan',
    locationStub,
    concepts: [],
    selectedConcept: undefined,
    characters: [],
    selectedCharacters: [],
    curriculum: [],
    selectedCurriculum: undefined,
    backdrops: [],
    selectedBackdrop: undefined,
    createdAt: now,
    updatedAt: now,
  };
  state = {
    ...state,
    pipelines: { ...state.pipelines, [id]: pipeline },
    activePipelineId: id,
  };
  emit();
  return pipeline;
}

export function getPipeline(id: string): LocationPipeline | undefined {
  return state.pipelines[id];
}

export function setActivePipeline(id: string | null) {
  state = { ...state, activePipelineId: id };
  emit();
}

export function deletePipeline(id: string) {
  const { [id]: _, ...rest } = state.pipelines;
  state = {
    ...state,
    pipelines: rest,
    activePipelineId: state.activePipelineId === id ? null : state.activePipelineId,
  };
  emit();
}

/* ── Stage mutations ───────────────────────────────────────── */

function updatePipeline(id: string, update: Partial<LocationPipeline>) {
  const existing = state.pipelines[id];
  if (!existing) return;
  state = {
    ...state,
    pipelines: {
      ...state.pipelines,
      [id]: { ...existing, ...update, updatedAt: new Date().toISOString() },
    },
  };
  emit();
}

// Plan (combined concept + characters + curriculum)
export function setPlan(pipelineId: string, plan: LocationPlan) {
  const proposal: Proposal<LocationPlan> = {
    id: `plan-${Date.now()}`,
    data: plan,
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
  updatePipeline(pipelineId, {
    plan: proposal,
    // Also set legacy fields for export compatibility
    selectedConcept: plan.concept,
    selectedCharacters: plan.characters,
    selectedCurriculum: plan.curriculum,
  });
}

export function approvePlan(pipelineId: string) {
  const p = state.pipelines[pipelineId];
  if (!p?.plan) return;
  updatePipeline(pipelineId, {
    plan: { ...p.plan, status: 'approved' },
    currentStage: 'backdrops',
  });
}

// Backdrops
export function addBackdropProposal(pipelineId: string, backdrop: BackdropConcept) {
  const p = state.pipelines[pipelineId];
  if (!p) return;
  const proposal: Proposal<BackdropConcept> = {
    id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    data: backdrop,
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
  updatePipeline(pipelineId, { backdrops: [...p.backdrops, proposal] });
}

export function selectBackdrop(pipelineId: string, proposalId: string) {
  const p = state.pipelines[pipelineId];
  if (!p) return;
  const backdrops = p.backdrops.map((b) => ({
    ...b,
    status: b.id === proposalId ? 'approved' as const : b.status === 'approved' ? 'proposed' as const : b.status,
  }));
  const selected = backdrops.find((b) => b.id === proposalId);
  updatePipeline(pipelineId, {
    backdrops,
    selectedBackdrop: selected?.data,
    currentStage: 'published',
  });
}

// Publish
export function markPublished(pipelineId: string) {
  updatePipeline(pipelineId, {
    currentStage: 'published',
    publishedAt: new Date().toISOString(),
  });
}

// Go back to a stage
export function goToStage(pipelineId: string, stage: DirectorStage) {
  updatePipeline(pipelineId, { currentStage: stage });
}

// Reset
export function resetDirectorState() {
  state = { pipelines: {}, activePipelineId: null };
  emit();
}

// Export pipeline as JSON (for saving to server)
export function exportPipeline(pipelineId: string) {
  const p = state.pipelines[pipelineId];
  if (!p) return null;
  return {
    concept: p.selectedConcept,
    characters: p.selectedCharacters,
    curriculum: p.selectedCurriculum,
    backdrop: p.selectedBackdrop,
  };
}

import type { Character } from './relationship';
import type { Location, VocabularyTarget, GrammarTarget, LearningObjective, LocationLevel } from './objectives';

/* ── Pipeline stages ───────────────────────────────────────── */

export type DirectorStage =
  | 'plan'          // Concept + characters + curriculum in one shot
  | 'backdrops'     // Visual assets
  | 'published';    // Live for players

export const DIRECTOR_STAGES: DirectorStage[] = [
  'plan', 'backdrops', 'published',
];

export const STAGE_LABELS: Record<DirectorStage, string> = {
  plan: 'Plan',
  backdrops: 'Backdrops',
  published: 'Published',
};

/* ── Proposals ─────────────────────────────────────────────── */

export interface LocationConcept {
  id: string;
  cityId: string;
  name: Record<string, string>;
  domain: string;
  order: number;
  ambientDescription: string;
  culturalHook: string;         // Why this location matters culturally
  narrativeHook: string;        // How it ties into the trainee story
  suggestedNpcCount: number;
}

export interface CharacterConcept {
  id: string;
  name: Record<string, string>;
  cityId: string;
  role: string;
  context: string;
  archetype: string;
  personality: Character['personality'];
  speechStyle: Character['speechStyle'];
  backstory: string;
  defaultLocationId: string;
  romanceable: boolean;
  voiceDescription: string;
}

export interface CurriculumConcept {
  levels: LocationLevel[];
  vocabularyTargets: VocabularyTarget[];
  grammarTargets: GrammarTarget[];
}

export interface BackdropConcept {
  prompt: string;
  timeOfDay: string;
  mood: string;
  imageUrl?: string;         // Set after generation
  videoUrl?: string;         // Optional video backdrop
  taskId?: string;           // Volcengine task ID if pending
}

/* ── Proposal wrapper ──────────────────────────────────────── */

export interface Proposal<T> {
  id: string;
  data: T;
  status: 'proposed' | 'approved' | 'rejected';
  feedback?: string;         // Dev feedback for regeneration
  createdAt: string;
}

/* ── Pipeline state for a single location ──────────────────── */

/** Full plan generated in one shot: concept + characters + curriculum. */
export interface LocationPlan {
  concept: LocationConcept;
  characters: CharacterConcept[];
  curriculum: CurriculumConcept;
}

export interface LocationPipeline {
  id: string;                // "cityId:locationId"
  cityId: string;
  currentStage: DirectorStage;

  /** The existing stub data from the location registry. */
  locationStub?: Record<string, unknown>;

  /** Plan stage: one combined proposal. */
  plan?: Proposal<LocationPlan>;

  // Legacy fields kept for compatibility during transition
  concepts: Proposal<LocationConcept>[];
  selectedConcept?: LocationConcept;
  characters: Proposal<CharacterConcept>[];
  selectedCharacters: CharacterConcept[];
  curriculum: Proposal<CurriculumConcept>[];
  selectedCurriculum?: CurriculumConcept;

  backdrops: Proposal<BackdropConcept>[];
  selectedBackdrop?: BackdropConcept;

  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/* ── Director store state ──────────────────────────────────── */

export interface DirectorState {
  pipelines: Record<string, LocationPipeline>;
  activePipelineId: string | null;
}

/* ── Director API tool calls ───────────────────────────────── */

export interface DirectorToolCall {
  tool: string;
  args: Record<string, unknown>;
}

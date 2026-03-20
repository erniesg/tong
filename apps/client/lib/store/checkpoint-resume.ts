import type { CityId, LocationId, ProficiencyLevel } from '@/lib/api';
import type { BlockCrushExercise, ExerciseData } from '@/lib/types/hangout';
import { getTargetByChar } from '@/lib/content/block-crush-data';
import { getLanguageForCity } from '@/lib/content/locations';

export interface ResumeObjectiveDescriptor {
  objectiveId?: string;
  summary?: string;
}

export interface ResumeActiveExerciseState {
  targetChar?: string;
  boardPieces?: string[];
  remainingLives?: number;
  requiredMatches?: number;
}

export interface ResumeActiveExercise {
  exerciseId?: string;
  exerciseType?: string;
  stepIndex?: number;
  prompt?: string;
  payloadVersion?: number;
  state?: ResumeActiveExerciseState;
}

export interface ResumeSceneSession {
  sceneSessionId?: string;
  cityId?: CityId;
  locationId?: LocationId;
  phase?: string;
  turn?: number;
  objective?: ResumeObjectiveDescriptor;
  activeExercise?: ResumeActiveExercise;
}

export interface ResumeCheckpoint {
  checkpointId?: string;
  phase?: string;
  turn?: number;
  objective?: ResumeObjectiveDescriptor;
  activeExercise?: ResumeActiveExercise;
}

export interface ResumeBootstrapPayload {
  sessionId?: string;
  city?: CityId;
  location?: LocationId;
  profile?: {
    proficiency?: Record<string, ProficiencyLevel>;
  };
  progression?: {
    xp?: number;
    sp?: number;
    rp?: number;
  };
  resumeSource?: string;
  sceneSession?: ResumeSceneSession;
  activeCheckpoint?: ResumeCheckpoint | null;
}

export interface HydratedResumeState {
  cityId: CityId;
  locationId: LocationId;
  phase: string;
  turn: number;
  exercise: ExerciseData | null;
  objectiveId: string | null;
  objectiveSummary: string | null;
}

function resolveActiveExercise(payload: ResumeBootstrapPayload): ResumeActiveExercise | null {
  return payload.activeCheckpoint?.activeExercise || payload.sceneSession?.activeExercise || null;
}

export function hydrateResumeState(payload: ResumeBootstrapPayload): HydratedResumeState | null {
  if (payload.resumeSource !== 'checkpoint') return null;

  const cityId = payload.sceneSession?.cityId || payload.city;
  const locationId = payload.sceneSession?.locationId || payload.location;
  if (!cityId || !locationId) return null;

  const phase = payload.sceneSession?.phase || payload.activeCheckpoint?.phase || 'hangout';
  const turn = payload.sceneSession?.turn || payload.activeCheckpoint?.turn || 1;
  const objective = payload.sceneSession?.objective || payload.activeCheckpoint?.objective || null;
  const exercise = buildResumeExercise(cityId, objective?.objectiveId || 'resume_objective', resolveActiveExercise(payload));

  return {
    cityId,
    locationId,
    phase,
    turn,
    exercise,
    objectiveId: objective?.objectiveId || null,
    objectiveSummary: objective?.summary || null,
  };
}

export function buildResumeExercise(
  cityId: CityId,
  objectiveId: string,
  activeExercise: ResumeActiveExercise | null,
): ExerciseData | null {
  if (!activeExercise?.exerciseType || activeExercise.exerciseType !== 'block_crush') return null;

  const targetChar = activeExercise.state?.targetChar;
  if (!targetChar) return null;

  const target = getTargetByChar(targetChar);
  if (!target || target.components.length < 2) return null;

  const exercise: BlockCrushExercise = {
    type: 'block_crush',
    id: activeExercise.exerciseId || `resume-${targetChar}`,
    objectiveId,
    difficulty: 2,
    prompt: activeExercise.prompt || `Resume building ${targetChar}.`,
    language: getLanguageForCity(cityId),
    targetChar: target.char,
    components: target.components,
    romanization: target.romanization,
    meaning: target.meaning,
    stage: 'recognition',
  };

  return exercise;
}

export function buildResumePrompt(context: {
  phase: string;
  turn: number;
  objectiveSummary?: string | null;
  exercise?: ExerciseData | null;
}): string {
  const parts = [
    'Resume from the persisted checkpoint.',
    `Keep the same scene phase (${context.phase}) and turn (${context.turn}).`,
  ];

  if (context.objectiveSummary) {
    parts.push(`Current objective: ${context.objectiveSummary}.`);
  }

  if (context.exercise?.type === 'block_crush') {
    parts.push(
      `The player is already inside the ${context.exercise.type} exercise for ${context.exercise.targetChar}; continue from that checkpoint instead of replaying the scene intro.`,
    );
  } else {
    parts.push('Do not replay the opening beats; continue from the checkpointed hangout state.');
  }

  return parts.join(' ');
}

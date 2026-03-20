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
  kind?: string;
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
  availableScenarioSeeds?: Array<{
    seedId?: string;
    label?: string;
  }>;
}

export interface HydratedResumeState {
  cityId: CityId;
  locationId: LocationId;
  resumeSource: 'checkpoint' | 'scenario_seed';
  phase: string;
  turn: number;
  exercise: ExerciseData | null;
  objectiveId: string | null;
  objectiveSummary: string | null;
  sceneSessionId: string | null;
  checkpointId: string | null;
  checkpointKind: string | null;
  availableScenarioSeedIds: string[];
}

function resolveActiveExercise(payload: ResumeBootstrapPayload): ResumeActiveExercise | null {
  return payload.activeCheckpoint?.activeExercise || payload.sceneSession?.activeExercise || null;
}

export function hydrateResumeState(payload: ResumeBootstrapPayload): HydratedResumeState | null {
  if (payload.resumeSource !== 'checkpoint' && payload.resumeSource !== 'scenario_seed') return null;

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
    resumeSource: payload.resumeSource,
    phase,
    turn,
    exercise,
    objectiveId: objective?.objectiveId || null,
    objectiveSummary: objective?.summary || null,
    sceneSessionId: payload.sceneSession?.sceneSessionId || null,
    checkpointId: payload.activeCheckpoint?.checkpointId || null,
    checkpointKind: payload.activeCheckpoint?.kind || null,
    availableScenarioSeedIds: (payload.availableScenarioSeeds || []).map((seed) => seed.seedId).filter((seed): seed is string => typeof seed === 'string' && seed.length > 0),
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
  const language = getLanguageForCity(cityId);
  const components = target?.components?.length
    ? target.components
    : buildFallbackComponents(language, activeExercise.state?.boardPieces || []);
  if (components.length < 2) return null;

  const exercise: BlockCrushExercise = {
    type: 'block_crush',
    id: activeExercise.exerciseId || `resume-${targetChar}`,
    objectiveId,
    difficulty: 2,
    prompt: activeExercise.prompt || `Resume building ${targetChar}.`,
    language,
    targetChar: target?.char || targetChar,
    components,
    romanization: target?.romanization || '',
    meaning: target?.meaning || activeExercise.prompt || 'Resume the current character exercise.',
    stage: 'recognition',
  };

  return exercise;
}

function buildFallbackComponents(
  language: BlockCrushExercise['language'],
  boardPieces: string[],
): BlockCrushExercise['components'] {
  const slotTemplates =
    language === 'ko'
      ? ['C', 'V', 'F']
      : language === 'ja' && boardPieces[1] === '゛'
        ? ['base', 'dakuten']
        : language === 'ja' && boardPieces[1] === '゜'
          ? ['base', 'handakuten']
          : language === 'ja' && boardPieces[1]?.includes('→')
            ? ['hiragana', 'convert']
            : ['left', 'right', 'bottom'];
  const colorHints = ['#f0c040', '#4ecdc4', '#7eb8da'];

  return boardPieces
    .slice(0, slotTemplates.length)
    .map((piece, index) => ({
      piece,
      slot: slotTemplates[index] || `slot_${index + 1}`,
      colorHint: colorHints[index] || colorHints[colorHints.length - 1],
    }));
}

export function buildResumePrompt(context: {
  resumeSource: 'checkpoint' | 'scenario_seed';
  phase: string;
  turn: number;
  objectiveSummary?: string | null;
  exercise?: ExerciseData | null;
}): string {
  const parts = [
    context.resumeSource === 'scenario_seed'
      ? 'Mount the deterministic scenario seed returned by the bootstrap response.'
      : 'Resume from the persisted checkpoint.',
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
    parts.push('Do not replay the opening beats; continue from the returned hangout state.');
  }

  return parts.join(' ');
}

import type { ExerciseData } from '@/lib/types/hangout';

/**
 * Validate that AI-provided exerciseData has the minimum required shape.
 * Rejects malformed data so the client falls back to local generation.
 */
export function isValidExerciseData(data: unknown): data is ExerciseData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.type === 'string'
    && typeof d.id === 'string'
    && typeof d.objectiveId === 'string';
}

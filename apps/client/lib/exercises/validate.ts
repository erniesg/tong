import type { ExerciseData } from '@/lib/types/hangout';

/**
 * Parse and validate AI-provided exerciseData.
 * Accepts a JSON string or object. Returns null if invalid.
 */
export function parseExerciseData(raw: unknown): ExerciseData | null {
  if (!raw) return null;

  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.type !== 'string' || typeof d.id !== 'string' || typeof d.objectiveId !== 'string') {
    return null;
  }

  return data as ExerciseData;
}

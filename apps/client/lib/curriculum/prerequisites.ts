import type { LearningObjective } from '../types/objectives';
import type { ItemMastery } from '../types/mastery';

/**
 * Check if an objective's items have been mastered enough to consider it complete.
 */
export function isObjectiveComplete(
  objective: LearningObjective,
  mastery: Record<string, ItemMastery>,
): boolean {
  if (objective.targetItems.length === 0) return false;
  let masteredCount = 0;
  for (const item of objective.targetItems) {
    const m = mastery[item];
    if (m && (m.masteryLevel === 'mastered' || m.masteryLevel === 'familiar')) {
      masteredCount++;
    }
  }
  return masteredCount / objective.targetItems.length >= objective.assessmentThreshold;
}

/**
 * Get all objectives whose prerequisites have been met.
 */
export function getUnlockedObjectives(
  allObjectives: LearningObjective[],
  mastery: Record<string, ItemMastery>,
): LearningObjective[] {
  const objectiveMap = new Map(allObjectives.map((o) => [o.id, o]));

  return allObjectives.filter((obj) => {
    // Already completed — still "unlocked" but not priority
    // Check prerequisites: all must be complete
    for (const prereqId of obj.prerequisites) {
      const prereq = objectiveMap.get(prereqId);
      if (!prereq) continue; // missing prerequisite — skip check
      if (!isObjectiveComplete(prereq, mastery)) return false;
    }
    return true;
  });
}

/**
 * Get the next best objective to work on:
 * - Unlocked (prerequisites met)
 * - Not yet completed
 * - Lowest level number first, then by position in objectives array
 */
export function getNextObjective(
  allObjectives: LearningObjective[],
  mastery: Record<string, ItemMastery>,
): LearningObjective | null {
  const unlocked = getUnlockedObjectives(allObjectives, mastery);
  const incomplete = unlocked.filter((o) => !isObjectiveComplete(o, mastery));

  if (incomplete.length === 0) return null;

  // Sort by level, then by order in the original array
  incomplete.sort((a, b) => {
    if (a.levelNumber !== b.levelNumber) return a.levelNumber - b.levelNumber;
    return allObjectives.indexOf(a) - allObjectives.indexOf(b);
  });

  return incomplete[0];
}

/**
 * Get all completed objectives.
 */
export function getCompletedObjectives(
  allObjectives: LearningObjective[],
  mastery: Record<string, ItemMastery>,
): LearningObjective[] {
  return allObjectives.filter((o) => isObjectiveComplete(o, mastery));
}

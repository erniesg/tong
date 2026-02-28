/** Summarize an exercise result into a string for the AI. */
export function summarizeExercise(exerciseId: string, correct: boolean): string {
  return `Exercise result: ${exerciseId} — ${correct ? 'correct' : 'incorrect'}`;
}

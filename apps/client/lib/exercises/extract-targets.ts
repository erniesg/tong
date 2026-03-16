import type { ExerciseData } from '@/lib/types/hangout';

/**
 * Extract actual target item words from an ExerciseData object.
 * These are the real words/characters being tested, not the ephemeral exercise ID.
 */
export function extractTargetItems(
  exercise: ExerciseData,
): Array<{ itemId: string; category: 'script' | 'vocabulary' | 'grammar' }> {
  const isScript =
    exercise.objectiveId.includes('script') ||
    exercise.objectiveId.includes('pron');
  const isGrammar = exercise.objectiveId.includes('gram');
  const category: 'script' | 'vocabulary' | 'grammar' = isScript
    ? 'script'
    : isGrammar
      ? 'grammar'
      : 'vocabulary';

  switch (exercise.type) {
    case 'matching':
      return exercise.pairs.map((p) => ({ itemId: p.left, category }));

    case 'multiple_choice': {
      // The target is the word in the prompt between quotes
      const match = exercise.prompt.match(/"([^"]+)"/);
      if (match) {
        return [{ itemId: match[1], category }];
      }
      // Fallback: try to find the correct option
      const correct = exercise.options.find(
        (o) => o.id === exercise.correctOptionId,
      );
      if (correct) {
        return [{ itemId: correct.text, category }];
      }
      return [];
    }

    case 'drag_drop':
      return exercise.items.map((item) => ({ itemId: item.text, category }));

    case 'pronunciation_select':
      return [{ itemId: exercise.targetText, category }];

    case 'sentence_builder':
      // Grammar exercises — track the pattern
      return exercise.correctOrder.map((word) => ({ itemId: word, category }));

    case 'fill_blank': {
      // Track the correct answer and key words in the sentence
      const correct = exercise.options.find(
        (o) => o.id === exercise.correctOptionId,
      );
      if (correct) {
        return [{ itemId: correct.text, category: 'grammar' }];
      }
      return [];
    }

    case 'pattern_recognition':
      return exercise.pairs.map((p) => ({ itemId: p.chars, category: 'script' as const }));

    case 'stroke_tracing':
      return [{ itemId: exercise.targetChar, category }];

    case 'block_crush':
      return [{ itemId: exercise.targetChar, category: 'script' as const }];

    case 'error_correction': {
      const correctOpt = exercise.options.find(
        (o) => o.id === exercise.correctOptionId,
      );
      if (correctOpt) {
        return [{ itemId: correctOpt.text, category: 'grammar' as const }];
      }
      return [];
    }

    case 'free_input':
      return exercise.expectedAnswers.map((ans) => ({ itemId: ans, category }));

    default:
      return [];
  }
}

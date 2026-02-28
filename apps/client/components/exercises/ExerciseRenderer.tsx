'use client';

import type { ExerciseData } from '@/lib/types/hangout';
import { MultipleChoice } from './MultipleChoice';
import { DragDrop } from './DragDrop';
import { Matching } from './Matching';

interface ExerciseRendererProps {
  exercise: ExerciseData;
  onResult: (correct: boolean) => void;
}

export function ExerciseRenderer({ exercise, onResult }: ExerciseRendererProps) {
  switch (exercise.type) {
    case 'multiple_choice':
      return <MultipleChoice exercise={exercise} onResult={onResult} />;
    case 'drag_drop':
      return <DragDrop exercise={exercise} onResult={onResult} />;
    case 'matching':
      return <Matching exercise={exercise} onResult={onResult} />;
    default:
      return (
        <div className="exercise-card p-4 text-center text-[var(--color-text-muted)]">
          Unknown exercise type
        </div>
      );
  }
}

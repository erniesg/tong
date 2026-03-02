'use client';

import type { ExerciseData } from '@/lib/types/hangout';
import { MultipleChoice } from './MultipleChoice';
import { DragDrop } from './DragDrop';
import { Matching } from './Matching';
import { SentenceBuilder } from './SentenceBuilder';
import { FillBlank } from './FillBlank';
import { PronunciationSelect } from './PronunciationSelect';
import { PatternRecognition } from './PatternRecognition';
import { StrokeTracing } from './StrokeTracing';
import { ErrorCorrection } from './ErrorCorrection';
import { FreeInput } from './FreeInput';

interface ExerciseRendererProps {
  exercise: ExerciseData;
  onResult: (correct: boolean, summary?: string) => void;
}

export function ExerciseRenderer({ exercise, onResult }: ExerciseRendererProps) {
  switch (exercise.type) {
    case 'multiple_choice':
      return <MultipleChoice exercise={exercise} onResult={onResult} />;
    case 'drag_drop':
      return <DragDrop exercise={exercise} onResult={onResult} />;
    case 'matching':
      return <Matching exercise={exercise} onResult={onResult} />;
    case 'sentence_builder':
      return <SentenceBuilder exercise={exercise} onResult={onResult} />;
    case 'fill_blank':
      return <FillBlank exercise={exercise} onResult={onResult} />;
    case 'pronunciation_select':
      return <PronunciationSelect exercise={exercise} onResult={onResult} />;
    case 'pattern_recognition':
      return <PatternRecognition exercise={exercise} onResult={onResult} />;
    case 'stroke_tracing':
      return <StrokeTracing exercise={exercise} onResult={onResult} />;
    case 'error_correction':
      return <ErrorCorrection exercise={exercise} onResult={onResult} />;
    case 'free_input':
      return <FreeInput exercise={exercise} onResult={onResult} />;
    default:
      return (
        <div className="exercise-card p-4 text-center text-[var(--color-text-muted)]">
          Unknown exercise type
        </div>
      );
  }
}

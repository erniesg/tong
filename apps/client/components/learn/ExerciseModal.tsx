'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExerciseData } from '@/lib/types/hangout';
import { ExerciseRenderer } from '@/components/exercises/ExerciseRenderer';

interface ExerciseModalProps {
  exercise: ExerciseData;
  onResult: (exerciseId: string, correct: boolean) => void;
  readOnly?: boolean;
}

export function ExerciseModal({ exercise, onResult, readOnly }: ExerciseModalProps) {
  const [dismissing, setDismissing] = useState(false);
  const [resultDone, setResultDone] = useState(false);

  const handleResult = useCallback(
    (correct: boolean) => {
      if (readOnly || resultDone) return;
      setResultDone(true);
      // Delay dismiss so user sees feedback
      setTimeout(() => {
        setDismissing(true);
        setTimeout(() => {
          onResult(exercise.id, correct);
        }, 300);
      }, 1500);
    },
    [exercise.id, onResult, readOnly, resultDone],
  );

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div
      className={`exercise-modal-backdrop ${dismissing ? 'exercise-modal-backdrop--dismissing' : ''}`}
    >
      <div
        className={`exercise-modal-content ${dismissing ? 'exercise-modal-content--dismissing' : ''}`}
      >
        <ExerciseRenderer
          exercise={exercise}
          onResult={readOnly ? () => {} : handleResult}
        />
      </div>
    </div>,
    document.body,
  );
}

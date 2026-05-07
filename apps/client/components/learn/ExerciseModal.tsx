'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExerciseData } from '@/lib/types/hangout';
import { ExerciseRenderer } from '@/components/exercises/ExerciseRenderer';

interface ExerciseModalProps {
  exercise: ExerciseData;
  onResult: (exerciseId: string, correct: boolean, summary?: string) => void;
  readOnly?: boolean;
  onClose?: () => void;
}

export function ExerciseModal({ exercise, onResult, readOnly, onClose }: ExerciseModalProps) {
  const [dismissing, setDismissing] = useState(false);
  const [resultDone, setResultDone] = useState(false);

  const handleResult = useCallback(
    (correct: boolean, summary?: string) => {
      if (readOnly || resultDone) return;
      setResultDone(true);
      // Delay dismiss so user sees feedback
      setTimeout(() => {
        setDismissing(true);
        setTimeout(() => {
          onResult(exercise.id, correct, summary);
        }, 300);
      }, 1500);
    },
    [exercise.id, onResult, readOnly, resultDone],
  );

  const handleClose = useCallback(() => {
    if (!onClose || resultDone || dismissing) return;
    setDismissing(true);
    setTimeout(onClose, 240);
  }, [dismissing, onClose, resultDone]);

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
        {onClose && !resultDone && (
          <button
            className="exercise-dismiss-btn"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleClose();
            }}
            aria-label="Minimize exercise"
          >
            &#x25BE;
          </button>
        )}
        <ExerciseRenderer
          exercise={exercise}
          onResult={readOnly ? () => {} : handleResult}
        />
      </div>
    </div>,
    document.body,
  );
}

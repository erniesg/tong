'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { PronunciationSelectExercise } from '@/lib/types/hangout';

interface Props {
  exercise: PronunciationSelectExercise;
  onResult: (correct: boolean) => void;
}

export function PronunciationSelect({ exercise, onResult }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === exercise.correctOptionId;

  const handleSubmit = () => {
    if (!selected || submitted) return;
    setSubmitted(true);
    onResult(isCorrect);
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      {/* Target character */}
      <div className="pron-select__target text-ko">{exercise.targetText}</div>

      {/* Audio options */}
      <div className="pron-select__options">
        {exercise.audioOptions.map((opt) => {
          const isThis = selected === opt.id;
          const isCorrectOpt = opt.id === exercise.correctOptionId;

          return (
            <button
              key={opt.id}
              onClick={() => !submitted && setSelected(opt.id)}
              disabled={submitted}
              className={cn(
                'pron-select__option',
                !submitted && isThis && 'pron-select__option--selected',
                submitted && isCorrectOpt && 'pron-select__option--correct',
                submitted && isThis && !isCorrect && 'pron-select__option--incorrect',
              )}
            >
              <span className="pron-select__play-icon">
                <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                  <path d="M0 0l12 7-12 7z" />
                </svg>
              </span>
              <span className="text-ko">{opt.label}</span>
              <span className="text-sm text-[var(--color-text-muted)] ml-auto">{opt.romanization}</span>
            </button>
          );
        })}
      </div>

      {submitted && exercise.explanation && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)] m-0">{exercise.explanation}</p>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className={cn(
            'mt-4 w-full rounded-lg py-3 font-semibold transition',
            selected
              ? 'bg-[var(--color-accent-gold)] text-[#1a1a2e] hover:brightness-110'
              : 'bg-white/10 text-[var(--color-text-muted)] cursor-not-allowed',
          )}
        >
          Check
        </button>
      )}

      {submitted && (
        <div
          className={cn(
            'mt-4 rounded-lg px-4 py-3 text-center text-sm',
            isCorrect
              ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {isCorrect ? 'Correct!' : `The correct pronunciation is "${exercise.audioOptions.find((o) => o.id === exercise.correctOptionId)?.label}"`}
        </div>
      )}
    </div>
  );
}

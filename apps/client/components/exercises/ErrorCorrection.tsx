'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ErrorCorrectionExercise } from '@/lib/types/hangout';

interface Props {
  exercise: ErrorCorrectionExercise;
  onResult: (correct: boolean) => void;
}

export function ErrorCorrection({ exercise, onResult }: Props) {
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [selectedCorrection, setSelectedCorrection] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const words = exercise.sentence.split(/\s+/);
  const isCorrect =
    selectedWord === exercise.errorWordIndex &&
    selectedCorrection === exercise.correctOptionId;

  const handleSubmit = () => {
    if (selectedWord === null || !selectedCorrection || submitted) return;
    setSubmitted(true);
    onResult(isCorrect);
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 m-0">{exercise.prompt}</p>

      {/* Sentence with tappable words */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {words.map((word, idx) => (
          <button
            key={idx}
            onClick={() => !submitted && setSelectedWord(idx)}
            disabled={submitted}
            className={cn(
              'px-3 py-2 rounded-lg text-lg font-medium transition text-ko',
              !submitted && selectedWord === idx && 'bg-red-500/30 text-red-300 ring-2 ring-red-400',
              !submitted && selectedWord !== idx && 'bg-white/10 text-[var(--color-text)]',
              submitted && idx === exercise.errorWordIndex && 'bg-red-500/30 text-red-300 line-through',
              submitted && idx !== exercise.errorWordIndex && 'bg-white/5 text-[var(--color-text-muted)]',
            )}
          >
            {word}
          </button>
        ))}
      </div>

      {/* Correction options */}
      {selectedWord !== null && (
        <>
          <p className="text-sm text-[var(--color-text-muted)] mb-2 m-0">Replace with:</p>
          <div className="pron-select__options">
            {exercise.options.map((opt) => {
              const isThis = selectedCorrection === opt.id;
              const isCorrectOpt = opt.id === exercise.correctOptionId;

              return (
                <button
                  key={opt.id}
                  onClick={() => !submitted && setSelectedCorrection(opt.id)}
                  disabled={submitted}
                  className={cn(
                    'pron-select__option',
                    !submitted && isThis && 'pron-select__option--selected',
                    submitted && isCorrectOpt && 'pron-select__option--correct',
                    submitted && isThis && !isCorrect && 'pron-select__option--incorrect',
                  )}
                >
                  <span className="text-ko">{opt.text}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {submitted && exercise.explanation && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)] m-0">{exercise.explanation}</p>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={selectedWord === null || !selectedCorrection}
          className={cn(
            'mt-4 w-full rounded-lg py-3 font-semibold transition',
            selectedWord !== null && selectedCorrection
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
          {isCorrect ? 'Correct!' : `The error was "${words[exercise.errorWordIndex]}" — correct: "${exercise.options.find((o) => o.id === exercise.correctOptionId)?.text}"`}
        </div>
      )}
    </div>
  );
}

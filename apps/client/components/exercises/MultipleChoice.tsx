'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { MultipleChoiceExercise } from '@/lib/types/hangout';

interface Props {
  exercise: MultipleChoiceExercise;
  onResult: (correct: boolean) => void;
}

export function MultipleChoice({ exercise, onResult }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === exercise.correctOptionId;

  const handleSelect = (optionId: string) => {
    if (submitted) return;
    setSelected(optionId);
  };

  const handleSubmit = () => {
    if (!selected || submitted) return;
    setSubmitted(true);
    onResult(isCorrect);
  };

  const correctOption = exercise.options.find((o) => o.id === exercise.correctOptionId);

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      <div className="flex flex-col gap-3">
        {exercise.options.map((opt) => {
          const isThis = selected === opt.id;
          const isCorrectOption = opt.id === exercise.correctOptionId;
          const showCorrect = submitted && isCorrectOption;
          const showWrong = submitted && isThis && !isCorrect;

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                'rounded-lg px-4 py-3 text-left transition-all border flex items-center justify-between',
                'text-ko',
                !submitted && !isThis && 'border-white/10 hover:border-white/30',
                !submitted && isThis && 'border-[var(--color-accent-gold)] bg-[var(--color-accent-gold)]/10',
                showCorrect && 'border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10',
                showWrong && 'border-red-500 bg-red-500/10',
                submitted && !isCorrectOption && !isThis && 'opacity-40',
              )}
            >
              <span>{opt.text}</span>
              {submitted && isCorrectOption && (
                <span className="text-[var(--color-accent-green)] text-xs font-semibold ml-2">
                  Correct answer
                </span>
              )}
              {submitted && showWrong && (
                <span className="text-red-400 text-xs font-semibold ml-2">
                  Your pick
                </span>
              )}
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
              : 'bg-white/10 text-[var(--color-text-muted)] cursor-not-allowed'
          )}
        >
          Check
        </button>
      )}

      {submitted && (
        <div
          className={cn(
            'mt-4 rounded-lg px-4 py-3 text-center text-sm',
            isCorrect ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]' : 'bg-red-500/20 text-red-400'
          )}
        >
          {isCorrect
            ? 'Correct!'
            : `The answer is "${correctOption?.text ?? ''}"`}
        </div>
      )}
    </div>
  );
}

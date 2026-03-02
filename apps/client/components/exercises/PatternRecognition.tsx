'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { PatternRecognitionExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface Props {
  exercise: PatternRecognitionExercise;
  onResult: (correct: boolean) => void;
}

export function PatternRecognition({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === exercise.correctPairIndex;

  const handleSubmit = () => {
    if (selected === null || submitted) return;
    setSubmitted(true);
    onResult(isCorrect);
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      <div className="pron-select__options">
        {exercise.pairs.map((pair, idx) => {
          const isThis = selected === idx;
          const isCorrectOpt = idx === exercise.correctPairIndex;

          return (
            <button
              key={idx}
              onClick={() => !submitted && setSelected(idx)}
              disabled={submitted}
              className={cn(
                'pron-select__option',
                !submitted && isThis && 'pron-select__option--selected',
                submitted && isCorrectOpt && 'pron-select__option--correct',
                submitted && isThis && !isCorrect && 'pron-select__option--incorrect',
              )}
            >
              <span className="text-ko" style={{ fontSize: 24, marginRight: 12 }}>{pair.chars}</span>
              <span className="text-sm text-[var(--color-text-muted)]">{pair.explanation}</span>
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
          disabled={selected === null}
          className={cn(
            'mt-4 w-full rounded-lg py-3 font-semibold transition',
            selected !== null
              ? 'bg-[var(--color-accent-gold)] text-[#1a1a2e] hover:brightness-110'
              : 'bg-white/10 text-[var(--color-text-muted)] cursor-not-allowed',
          )}
        >
          {t('check', lang)}
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
          {isCorrect ? t('correct', lang) : `${t('answer_is', lang)} "${exercise.pairs[exercise.correctPairIndex]?.chars}"`}
        </div>
      )}
    </div>
  );
}

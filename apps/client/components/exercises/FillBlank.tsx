'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { FillBlankExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface Props {
  exercise: FillBlankExercise;
  onResult: (correct: boolean) => void;
}

export function FillBlank({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === exercise.correctOptionId;

  const words = exercise.sentence.split('___');
  const correctText = exercise.options.find((o) => o.id === exercise.correctOptionId)?.text ?? '';
  const selectedText = exercise.options.find((o) => o.id === selected)?.text ?? '';

  const handleSubmit = () => {
    if (!selected || submitted) return;
    setSubmitted(true);
    onResult(isCorrect);
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      {/* Sentence with blank */}
      <div className="fill-blank__sentence text-ko">
        {words[0]}
        <span className="fill-blank__blank">
          {submitted ? (isCorrect ? selectedText : correctText) : selectedText || '\u00A0\u00A0\u00A0'}
        </span>
        {words[1] ?? ''}
      </div>

      {/* Options */}
      <div className="fill-blank__options">
        {exercise.options.map((opt) => {
          const isThis = selected === opt.id;
          const isCorrectOpt = opt.id === exercise.correctOptionId;
          const showCorrect = submitted && isCorrectOpt;
          const showWrong = submitted && isThis && !isCorrect;

          return (
            <button
              key={opt.id}
              onClick={() => !submitted && setSelected(opt.id)}
              className={cn(
                'rounded-lg px-4 py-3 text-center transition-all border text-ko',
                !submitted && !isThis && 'border-white/10 hover:border-white/30',
                !submitted && isThis && 'border-[var(--color-accent-gold)] bg-[var(--color-accent-gold)]/10',
                showCorrect && 'border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10',
                showWrong && 'border-red-500 bg-red-500/10',
                submitted && !isCorrectOpt && !isThis && 'opacity-40',
              )}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {submitted && exercise.grammarNote && (
        <div className="fill-blank__grammar-note">{exercise.grammarNote}</div>
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
          {isCorrect ? t('correct', lang) : `${t('answer_is', lang)} "${correctText}"`}
        </div>
      )}
    </div>
  );
}

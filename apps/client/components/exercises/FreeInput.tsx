'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { FreeInputExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface Props {
  exercise: FreeInputExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

export function FreeInput({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Normalize for comparison: trim, lowercase, remove extra spaces
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const isCorrect = exercise.expectedAnswers.some(
    (ans) => normalize(input) === normalize(ans),
  );

  const handleSubmit = () => {
    if (!input.trim() || submitted) return;
    setSubmitted(true);
    onResult(isCorrect, JSON.stringify({ kind: 'pick', selected: input.trim(), answer: exercise.expectedAnswers[0] ?? '' }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-[length:var(--game-text-lg)] font-medium mb-4 m-0">{exercise.prompt}</p>

      {exercise.hint && (
        <p className="text-[length:var(--game-text-base)] text-[var(--color-text-muted)] mb-3 m-0">{exercise.hint}</p>
      )}

      <input
        type="text"
        value={input}
        onChange={(e) => !submitted && setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={submitted}
        placeholder={t('type_answer', lang)}
        className="w-full min-h-[44px] rounded-lg px-4 py-3 text-[length:var(--game-text-lg)] text-ko"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '2px solid rgba(255,255,255,0.15)',
          color: 'var(--color-text)',
          outline: 'none',
        }}
        autoFocus
        lang="ko"
      />

      {submitted && exercise.explanation && (
        <p className="mt-3 text-[length:var(--game-text-base)] text-[var(--color-text-muted)] m-0">{exercise.explanation}</p>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={cn(
            'mt-4 w-full min-h-[44px] rounded-lg py-3 text-[length:var(--game-text-base)] font-semibold transition',
            input.trim()
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
            'mt-4 rounded-lg px-4 py-3 text-center text-[length:var(--game-text-base)]',
            isCorrect
              ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {isCorrect
            ? t('correct', lang)
            : `${t('expected', lang)} ${exercise.expectedAnswers.join(` ${t('or', lang)} `)}`}
        </div>
      )}
    </div>
  );
}

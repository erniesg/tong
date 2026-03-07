'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { SentenceBuilderExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface Props {
  exercise: SentenceBuilderExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

export function SentenceBuilder({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [placed, setPlaced] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const allTiles = exercise.wordTiles;
  const placedSet = new Set(placed);

  const handleTileTap = (tile: string) => {
    if (submitted) return;
    if (placedSet.has(tile)) {
      setPlaced((prev) => prev.filter((t) => t !== tile));
    } else {
      setPlaced((prev) => [...prev, tile]);
    }
  };

  const handleSubmit = () => {
    if (placed.length === 0 || submitted) return;
    const isCorrect =
      placed.length === exercise.correctOrder.length &&
      placed.every((t, i) => t === exercise.correctOrder[i]);
    setSubmitted(true);
    onResult(isCorrect, JSON.stringify({ kind: 'pick', selected: placed.join(' '), answer: exercise.correctOrder.join(' ') }));
  };

  const isCorrect =
    placed.length === exercise.correctOrder.length &&
    placed.every((t, i) => t === exercise.correctOrder[i]);

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      {/* Answer area */}
      <div className="sentence-builder__tiles">
        {placed.map((tile, i) => (
          <button
            key={`placed-${i}`}
            className="sentence-builder__tile sentence-builder__tile--answer"
            onClick={() => handleTileTap(tile)}
          >
            {tile}
          </button>
        ))}
        {placed.length === 0 && (
          <span className="text-sm text-[var(--color-text-muted)] py-1">{t('tap_tiles', lang)}</span>
        )}
      </div>

      {/* Available tiles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {allTiles.map((tile, i) => (
          <button
            key={`tile-${i}`}
            className={cn(
              'sentence-builder__tile',
              placedSet.has(tile) && 'sentence-builder__tile--placed',
            )}
            onClick={() => handleTileTap(tile)}
            disabled={submitted}
          >
            {tile}
          </button>
        ))}
      </div>

      {submitted && exercise.explanation && (
        <p className="mt-1 text-sm text-[var(--color-text-muted)] m-0">{exercise.explanation}</p>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={placed.length === 0}
          className={cn(
            'mt-2 w-full rounded-lg py-3 font-semibold transition',
            placed.length > 0
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
          {isCorrect ? t('correct', lang) : `${t('correct_order', lang)} ${exercise.correctOrder.join(' ')}`}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { MatchingExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface Props {
  exercise: MatchingExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

export function Matching({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Shuffle both sides once
  const [shuffledRight] = useState(() => {
    const indices = exercise.pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });
  const [shuffledLeft] = useState(() => {
    const indices = exercise.pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });

  const matchCount = Object.keys(matches).length;
  const allFilled = matchCount === exercise.pairs.length;
  const isAllCorrect =
    allFilled &&
    Object.entries(matches).every(([l, r]) => Number(l) === Number(r));

  const placedRight = new Set(Object.values(matches));

  const placeWord = (leftIdx: number, rightIdx: number) => {
    const updated = { ...matches };
    for (const [k, v] of Object.entries(updated)) {
      if (v === rightIdx) delete updated[Number(k)];
    }
    updated[leftIdx] = rightIdx;
    setMatches(updated);
    setSelectedWord(null);
    setSelectedSlot(null);
  };

  const handleWordBankClick = (rightIdx: number) => {
    if (submitted) return;
    const existingSlot = Object.entries(matches).find(([, r]) => r === rightIdx);
    if (existingSlot) {
      const { [Number(existingSlot[0])]: _, ...rest } = matches;
      setMatches(rest);
      setSelectedWord(rightIdx);
      setSelectedSlot(null);
      return;
    }
    if (selectedSlot !== null) {
      placeWord(selectedSlot, rightIdx);
      return;
    }
    setSelectedWord(selectedWord === rightIdx ? null : rightIdx);
    setSelectedSlot(null);
  };

  const handleSlotClick = (leftIdx: number) => {
    if (submitted) return;
    if (leftIdx in matches) {
      const { [leftIdx]: _, ...rest } = matches;
      setMatches(rest);
      if (selectedSlot === leftIdx) setSelectedSlot(null);
      return;
    }
    if (selectedWord !== null) {
      placeWord(leftIdx, selectedWord);
      return;
    }
    setSelectedSlot(selectedSlot === leftIdx ? null : leftIdx);
    setSelectedWord(null);
  };

  const handleSubmit = () => {
    if (submitted || !allFilled) return;
    setSubmitted(true);
    const details = Object.entries(matches).map(([leftIdx, rightIdx]) => ({
      left: exercise.pairs[Number(leftIdx)].left,
      right: exercise.pairs[Number(rightIdx)].right,
      ok: Number(leftIdx) === Number(rightIdx),
    }));
    onResult(isAllCorrect, JSON.stringify({ kind: 'pairs', items: details }));
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-3 m-0">{exercise.prompt}</p>

      {/* Word bank */}
      <div className="flex flex-wrap gap-2 mb-4">
        {shuffledRight.map((rightIdx) => {
          const pair = exercise.pairs[rightIdx];
          const isPlaced = placedRight.has(rightIdx);
          const isSelected = selectedWord === rightIdx;
          return (
            <button
              key={`word-${rightIdx}`}
              onClick={() => handleWordBankClick(rightIdx)}
              disabled={submitted}
              className={cn(
                'rounded-lg px-3 py-2 font-medium transition border text-white text-base',
                !isPlaced && !isSelected && 'border-white/40 bg-white/8 hover:border-white/60 hover:bg-white/12',
                isSelected && 'border-[var(--color-primary)] bg-[var(--color-primary)]/20 scale-105',
                isPlaced && 'opacity-30 border-white/10 bg-transparent cursor-default',
                submitted && 'pointer-events-none'
              )}
            >
              {pair.right}
            </button>
          );
        })}
      </div>

      {/* Match slots */}
      <div className="flex flex-col gap-2 mb-4">
        {shuffledLeft.map((leftIdx) => {
          const pair = exercise.pairs[leftIdx];
          const matchedRightIdx = matches[leftIdx];
          const hasMatch = matchedRightIdx !== undefined;
          const matchedText = hasMatch ? exercise.pairs[matchedRightIdx].right : null;
          const isCorrect = submitted && hasMatch && matchedRightIdx === leftIdx;
          const isWrong = submitted && hasMatch && matchedRightIdx !== leftIdx;
          const isSlotSelected = selectedSlot === leftIdx;

          return (
            <div
              key={`slot-${leftIdx}`}
              onClick={() => handleSlotClick(leftIdx)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-3 transition cursor-pointer',
                !submitted && !hasMatch && 'border-white/10 hover:border-white/30',
                !submitted && !hasMatch && selectedWord !== null && 'hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5',
                !submitted && !hasMatch && isSlotSelected && 'border-[var(--color-primary)] bg-[var(--color-primary)]/10',
                !submitted && hasMatch && 'border-white/30 bg-white/5',
                isCorrect && 'border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10',
                isWrong && 'border-red-500 bg-red-500/10',
                submitted && 'cursor-default'
              )}
            >
              <span className="text-ko text-base text-white font-medium min-w-[80px]">
                {pair.left}
              </span>
              <div className={cn(
                'flex-1 rounded border border-dashed px-3 py-2 text-center min-h-[36px] flex items-center justify-center',
                !hasMatch && !isSlotSelected && 'border-white/15',
                !hasMatch && isSlotSelected && 'border-[var(--color-primary)] border-solid bg-[var(--color-primary)]/5',
                hasMatch && !submitted && 'border-white/30 border-solid',
                isCorrect && 'border-[var(--color-accent-green)] border-solid',
                isWrong && 'border-red-500 border-solid'
              )}>
                {matchedText ? (
                  <span className={cn(
                    'text-ko font-medium text-white text-base',
                    isWrong && 'line-through text-red-400'
                  )}>{matchedText}</span>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {isSlotSelected ? t('pick_word', lang) : selectedWord !== null ? t('tap_to_place', lang) : ''}
                  </span>
                )}
              </div>
              {isWrong && (
                <span className="text-xs text-[var(--color-accent-green)] whitespace-nowrap flex items-center gap-1">
                  → {exercise.pairs[leftIdx].right}
                </span>
              )}
              {isCorrect && (
                <span className="text-[var(--color-accent-green)] text-sm">✓</span>
              )}
            </div>
          );
        })}
      </div>

      {submitted && (
        <div className={cn(
          'rounded-lg px-4 py-3 text-center font-semibold mb-3',
          isAllCorrect
            ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
            : 'bg-red-500/20 text-red-400'
        )}>
          {isAllCorrect
            ? t('perfect_match', lang)
            : `${Object.entries(matches).filter(([l, r]) => Number(l) === Number(r)).length}/${exercise.pairs.length} ${t('n_of_total_correct', lang)}`
          }
        </div>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allFilled}
          className={cn(
            'w-full rounded-lg py-3 font-semibold transition',
            allFilled
              ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]'
              : 'bg-white/10 text-[var(--color-text-muted)] cursor-not-allowed'
          )}
        >
          {`${t('check', lang)} (${matchCount}/${exercise.pairs.length})`}
        </button>
      )}
    </div>
  );
}

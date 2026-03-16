'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import type { MatchingExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

/** Map bare jamo to their full names for TTS — more distinguishable. */
const JAMO_TO_TTS: Record<string, string> = {
  'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음',
  'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅊ': '치읓',
  'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗',
  'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
  'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
};

function detectTtsLang(text: string): string {
  if (/[\uAC00-\uD7AF\u3131-\u318E]/.test(text)) return 'ko-KR';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
  return 'ko-KR';
}

interface Props {
  exercise: MatchingExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

export function Matching({ exercise, onResult }: Props) {
  const lang = useUILang();
  const isAudioMode = exercise.mode === 'audio';
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);

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

  const playTTS = useCallback((text: string, idx: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const ttsText = JAMO_TO_TTS[text] || text;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(ttsText);
    utter.lang = detectTtsLang(ttsText);
    utter.rate = 0.8;
    setPlaying(idx);
    utter.onend = () => setPlaying(null);
    window.speechSynthesis.speak(utter);
  }, []);

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
    // In audio mode, always play sound on tap
    if (isAudioMode) {
      const pair = exercise.pairs[rightIdx];
      playTTS(pair.rightAudio || pair.left, rightIdx);
    }
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

  /* Speaker icon SVG */
  const SpeakerIcon = ({ size = 20, active = false }: { size?: number; active?: boolean }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ opacity: active ? 1 : 0.6 }}>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );

  return (
    <div className="exercise-card p-5">
      <p className="text-[length:var(--game-text-lg)] font-medium mb-3 m-0">{exercise.prompt}</p>

      {/* Word bank — audio mode shows speaker icons, text mode shows text */}
      <div className="flex flex-wrap gap-2 mb-4">
        {shuffledRight.map((rightIdx) => {
          const pair = exercise.pairs[rightIdx];
          const isPlaced = placedRight.has(rightIdx);
          const isSelected = selectedWord === rightIdx;
          const isThisPlaying = playing === rightIdx;
          return (
            <button
              key={`word-${rightIdx}`}
              onClick={() => handleWordBankClick(rightIdx)}
              disabled={submitted}
              className={cn(
                'rounded-lg font-medium transition border text-white',
                isAudioMode ? 'min-h-[44px] px-4 py-3 flex items-center gap-2 text-[length:var(--game-text-base)]' : 'min-h-[44px] px-3 py-2 text-[length:var(--game-text-base)]',
                !isPlaced && !isSelected && 'border-white/40 bg-white/8 hover:border-white/60 hover:bg-white/12',
                isSelected && 'border-[var(--color-primary)] bg-[var(--color-primary)]/20 scale-105',
                isPlaced && 'opacity-30 border-white/10 bg-transparent cursor-default',
                isThisPlaying && !isPlaced && 'border-[var(--color-accent-gold)] bg-[var(--color-accent-gold)]/15',
                submitted && 'pointer-events-none'
              )}
            >
              {isAudioMode ? (
                <>
                  <SpeakerIcon active={isThisPlaying} />
                  {submitted && <span className="text-[length:var(--game-text-sm)]">{pair.right}</span>}
                </>
              ) : (
                pair.right
              )}
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
          const isCorrect = submitted && hasMatch && matchedRightIdx === leftIdx;
          const isWrong = submitted && hasMatch && matchedRightIdx !== leftIdx;
          const isSlotSelected = selectedSlot === leftIdx;

          // In audio mode, matched slot shows a speaker icon; in text mode, shows text
          const matchedPair = hasMatch ? exercise.pairs[matchedRightIdx] : null;

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
              <span className="text-ko text-[length:var(--game-text-base)] text-white font-medium min-w-[80px]">
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
                {hasMatch ? (
                  isAudioMode ? (
                    <span className={cn('flex items-center gap-2', isWrong && 'text-red-400')}>
                      <SpeakerIcon size={18} active={playing === matchedRightIdx} />
                      {submitted && <span className="text-[length:var(--game-text-sm)]">{matchedPair?.right}</span>}
                    </span>
                  ) : (
                    <span className={cn(
                      'text-ko font-medium text-white text-[length:var(--game-text-base)]',
                      isWrong && 'line-through text-red-400'
                    )}>{matchedPair?.right}</span>
                  )
                ) : (
                  <span className="text-[length:var(--game-text-sm)] text-[var(--color-text-muted)]">
                    {isSlotSelected ? t('pick_word', lang) : selectedWord !== null ? t('tap_to_place', lang) : ''}
                  </span>
                )}
              </div>
              {isWrong && (
                <span className="text-[length:var(--game-text-sm)] text-[var(--color-accent-green)] whitespace-nowrap flex items-center gap-1">
                  {isAudioMode ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); playTTS(pair.rightAudio || pair.left, leftIdx + 1000); }}
                      className="flex items-center gap-1"
                    >
                      → <SpeakerIcon size={16} /> {pair.right}
                    </button>
                  ) : (
                    <>→ {exercise.pairs[leftIdx].right}</>
                  )}
                </span>
              )}
              {isCorrect && (
                <span className="text-[var(--color-accent-green)] text-[length:var(--game-text-base)]">✓</span>
              )}
            </div>
          );
        })}
      </div>

      {submitted && (
        <div className={cn(
          'rounded-lg px-4 py-3 text-center text-[length:var(--game-text-base)] font-semibold mb-3',
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
            'w-full min-h-[44px] rounded-lg py-3 text-[length:var(--game-text-base)] font-semibold transition',
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

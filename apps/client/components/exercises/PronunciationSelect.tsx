'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { PronunciationSelectExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

/** Map bare jamo to pronounceable syllables for TTS. */
const JAMO_TO_SYLLABLE: Record<string, string> = {
  'ㄱ': '가', 'ㄴ': '나', 'ㄷ': '다', 'ㄹ': '라', 'ㅁ': '마',
  'ㅂ': '바', 'ㅅ': '사', 'ㅇ': '아', 'ㅈ': '자', 'ㅊ': '차',
  'ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하',
  'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
  'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
};

interface Props {
  exercise: PronunciationSelectExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

export function PronunciationSelect({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Guard: if AI didn't provide audioOptions, auto-generate from targetText
  if (!exercise.audioOptions || exercise.audioOptions.length === 0) {
    const target = exercise.targetText || '하';
    exercise = {
      ...exercise,
      audioOptions: [
        { id: 'correct', text: target },
        { id: 'wrong1', text: target === '하' ? '가' : '하' },
        { id: 'wrong2', text: target === '은' ? '운' : '은' },
      ].sort(() => Math.random() - 0.5),
      correctOptionId: 'correct',
    };
  }

  const isCorrect = selected === exercise.correctOptionId;

  const playSound = useCallback((text: string) => {
    const utterText = JAMO_TO_SYLLABLE[text] ?? text;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(utterText);
      utter.lang = 'ko-KR';
      utter.rate = 0.8;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }, []);

  // Auto-play sound on mount
  useEffect(() => {
    const timer = setTimeout(() => playSound(exercise.targetText), 400);
    return () => clearTimeout(timer);
  }, [exercise.targetText, playSound]);

  const handleSubmit = () => {
    if (!selected || submitted) return;
    setSubmitted(true);
    // Auto-play correct answer sound on submit
    const correctOpt = exercise.audioOptions.find((o) => o.id === exercise.correctOptionId);
    if (correctOpt) playSound(correctOpt.label);
    onResult(isCorrect);
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      {/* Play sound button — tap to hear the target pronunciation */}
      <div
        className="pron-select__target"
        onClick={() => playSound(exercise.targetText)}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && playSound(exercise.targetText)}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}>
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
        <span className="pron-select__target-label">{t('tap_to_play', lang)}</span>
      </div>

      {/* Character options — player picks which hangul matches the sound */}
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
              <span className="text-ko text-3xl">{opt.label}</span>
              {submitted && (
                <span className="text-sm text-[var(--color-text-muted)] ml-auto">
                  {opt.romanization}{opt.meaning ? ` — ${opt.meaning}` : ''}
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
          {isCorrect ? t('correct', lang) : `${t('correct_pronunciation', lang)} "${exercise.audioOptions.find((o) => o.id === exercise.correctOptionId)?.label}"`}
        </div>
      )}
    </div>
  );
}

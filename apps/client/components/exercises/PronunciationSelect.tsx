'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { PronunciationSelectExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

/** Map bare jamo to their full names for TTS — more distinguishable than simple CV syllables. */
const JAMO_TO_TTS: Record<string, string> = {
  'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음',
  'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅊ': '치읓',
  'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗',
  'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
  'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
};

/** Detect TTS language from text content. */
function detectTtsLang(text: string): string {
  if (/[\uAC00-\uD7AF\u3131-\u318E]/.test(text)) return 'ko-KR';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
  return 'ko-KR';
}

interface Props {
  exercise: PronunciationSelectExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

export function PronunciationSelect({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  // Guard: if AI didn't provide audioOptions, auto-generate from targetText
  if (!exercise.audioOptions || exercise.audioOptions.length === 0) {
    const target = exercise.targetText || '하';
    exercise = {
      ...exercise,
      audioOptions: [
        { id: 'correct', label: target, romanization: '', meaning: '' },
        { id: 'wrong1', label: target === '하' ? '가' : '하', romanization: '', meaning: '' },
        { id: 'wrong2', label: target === '은' ? '운' : '은', romanization: '', meaning: '' },
      ].sort(() => Math.random() - 0.5),
      correctOptionId: 'correct',
    };
  }

  const isCorrect = selected === exercise.correctOptionId;

  const playSound = useCallback((text: string, ttsText?: string, optId?: string) => {
    // Priority: explicit ttsText > JAMO_TO_TTS mapping > raw text
    const utterText = ttsText || JAMO_TO_TTS[text] || text;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(utterText);
      utter.lang = detectTtsLang(utterText);
      utter.rate = 0.8;
      if (optId) setPlaying(optId);
      utter.onend = () => setPlaying(null);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }, []);

  // Auto-play correct sound on mount so user hears it once — without visual highlight
  useEffect(() => {
    const correctOpt = exercise.audioOptions.find((o) => o.id === exercise.correctOptionId);
    if (correctOpt) {
      const timer = setTimeout(() => playSound(correctOpt.label, correctOpt.ttsText), 400);
      return () => clearTimeout(timer);
    }
  }, [exercise.audioOptions, exercise.correctOptionId, playSound]);

  const [readyToDismiss, setReadyToDismiss] = useState(false);

  const handleSubmit = () => {
    if (!selected || submitted) return;
    setSubmitted(true);
    setReadyToDismiss(true);
    // Play the correct answer sound on submit
    const correctOpt = exercise.audioOptions.find((o) => o.id === exercise.correctOptionId);
    if (correctOpt) playSound(correctOpt.label, correctOpt.ttsText);
  };

  const handleDismiss = () => {
    const selectedOpt = exercise.audioOptions.find((o) => o.id === selected);
    const correctOpt = exercise.audioOptions.find((o) => o.id === exercise.correctOptionId);
    onResult(isCorrect, JSON.stringify({ kind: 'pick', selected: selectedOpt?.label ?? '?', answer: correctOpt?.label ?? '?' }));
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-[length:var(--game-text-lg)] font-medium mb-3 m-0">{exercise.prompt}</p>

      {/* Target character displayed prominently */}
      <div className="pron-select__target" style={{ cursor: 'default' }}>
        <span className="text-ko" style={{ fontSize: '3.5rem', lineHeight: 1 }}>{exercise.targetText}</span>
      </div>

      {/* Audio options — each plays a different sound, user picks the match */}
      <div className="pron-select__options">
        {exercise.audioOptions.map((opt) => {
          const isThis = selected === opt.id;
          const isCorrectOpt = opt.id === exercise.correctOptionId;
          const isPlaying = playing === opt.id;

          return (
            <button
              key={opt.id}
              onClick={() => {
                playSound(opt.label, opt.ttsText, opt.id);
                if (!submitted) setSelected(opt.id);
              }}
              className={cn(
                'pron-select__option',
                !submitted && isThis && 'pron-select__option--selected',
                submitted && isCorrectOpt && 'pron-select__option--correct',
                submitted && isThis && !isCorrect && 'pron-select__option--incorrect',
              )}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: isPlaying ? 1 : 0.5, flexShrink: 0 }}>
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>

              {/* Before submit: "Tap to play" / After submit: show the actual label + details */}
              {submitted ? (
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1 }}>
                  <span className="text-ko" style={{ fontSize: '1.25rem' }}>{opt.label}</span>
                  {opt.romanization && (
                    <span style={{ fontSize: 'var(--game-text-sm)', opacity: 0.5 }}>{opt.romanization}</span>
                  )}
                  {opt.meaning && (
                    <span style={{ fontSize: 'var(--game-text-sm)', opacity: 0.4, marginLeft: 'auto' }}>{opt.meaning}</span>
                  )}
                </span>
              ) : (
                <span className="text-ko ml-2" style={{ fontSize: 'var(--game-text-base)', opacity: 0.6 }}>
                  {t('tap_to_play', lang)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {submitted && exercise.explanation && (
        <p className="mt-3 text-[length:var(--game-text-base)] text-[var(--color-text-muted)] m-0">{exercise.explanation}</p>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className={cn(
            'mt-4 w-full min-h-[44px] rounded-lg py-3 text-[length:var(--game-text-base)] font-semibold transition',
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
            'mt-4 rounded-lg px-4 py-3 text-center text-[length:var(--game-text-base)]',
            isCorrect
              ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
              : 'bg-red-500/20 text-red-400',
          )}
          onClick={readyToDismiss ? handleDismiss : undefined}
          style={readyToDismiss ? { cursor: 'pointer' } : undefined}
        >
          {isCorrect ? t('correct', lang) : `${t('correct_pronunciation', lang)} "${exercise.audioOptions.find((o) => o.id === exercise.correctOptionId)?.label}"`}
          {readyToDismiss && (
            <div className="scene-continue-label animate-pulse" style={{ marginTop: 8 }}>
              {t('tap_to_continue', lang)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

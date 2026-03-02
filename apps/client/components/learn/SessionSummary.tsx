'use client';

import { useCallback } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface LearnedItem {
  char: string;
  romanization?: string;
}

/** Map single jamo to a short pronounceable sound for TTS.
 *  Consonants → consonant + ㅏ (가, 나, 다…) to match lesson audio.
 *  Vowels → vowel syllable (아, 야, 어…). */
const JAMO_TO_SYLLABLE: Record<string, string> = {
  'ㄱ': '가', 'ㄴ': '나', 'ㄷ': '다', 'ㄹ': '라', 'ㅁ': '마',
  'ㅂ': '바', 'ㅅ': '사', 'ㅇ': '아', 'ㅈ': '자', 'ㅊ': '차',
  'ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하',
  'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
  'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
};

interface SessionSummaryProps {
  summary: string;
  exercisesCompleted: number;
  exercisesCorrect: number;
  xpEarned: number;
  learnedItems?: LearnedItem[];
  levelUp?: boolean;
  /** Save & go to review mode for this session */
  onReview?: () => void;
  /** Save & start a new session */
  onNewSession?: () => void;
}

export function SessionSummary({
  summary,
  exercisesCompleted,
  exercisesCorrect,
  xpEarned,
  learnedItems,
  levelUp,
  onReview,
  onNewSession,
}: SessionSummaryProps) {
  const lang = useUILang();
  const accuracy = exercisesCompleted > 0
    ? Math.round((exercisesCorrect / exercisesCompleted) * 100)
    : 0;

  const playSound = useCallback((char: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const text = JAMO_TO_SYLLABLE[char] ?? char;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  return (
    <div className="session-summary">
      <div className="session-summary__title">{t('session_complete', lang)}</div>

      <div className="session-summary__stats">
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">{accuracy}%</div>
          <div className="session-summary__stat-label">{t('accuracy', lang)}</div>
        </div>
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">{exercisesCompleted}</div>
          <div className="session-summary__stat-label">{t('exercises_label', lang)}</div>
        </div>
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">{exercisesCorrect}</div>
          <div className="session-summary__stat-label">{t('correct_count', lang)}</div>
        </div>
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">+{xpEarned}</div>
          <div className="session-summary__stat-label">XP</div>
        </div>
      </div>

      {summary && <p className="session-summary__text">{summary}</p>}

      {learnedItems && learnedItems.length > 0 && (
        <div className="session-summary__items">
          {learnedItems.map((item, i) => (
            <button
              key={`${item.char}-${i}`}
              className="session-summary__item text-ko"
              onClick={() => playSound(item.char)}
              type="button"
            >
              <span className="session-summary__item-char">{item.char}</span>
              <span className="session-summary__item-sound">&#x1f50a;</span>
              {item.romanization && <span className="session-summary__item-rom">{item.romanization}</span>}
            </button>
          ))}
        </div>
      )}

      {levelUp && (
        <div className="session-summary__level-up">{t('level_up', lang)}</div>
      )}

      {(onReview || onNewSession) && (
        <div className="session-summary__actions">
          {onReview && (
            <button
              className="session-summary__btn session-summary__btn--secondary"
              onClick={onReview}
              type="button"
            >
              {t('review_session', lang)}
            </button>
          )}
          {onNewSession && (
            <button
              className="session-summary__btn session-summary__btn--primary"
              onClick={onNewSession}
              type="button"
            >
              {t('new_session', lang)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

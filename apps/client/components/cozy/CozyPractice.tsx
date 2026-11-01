'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CozyPracticeRequest } from '../../../../packages/contracts';
import { ExerciseModal } from '@/components/learn/ExerciseModal';
import { LearnPanel } from '@/components/learn/LearnPanel';
import { dispatch, getGameState } from '@/lib/store/game-store';
import { getSessionState } from '@/lib/store/session-store';
import { UILangProvider } from '@/lib/i18n/UILangContext';
import type { UILang } from '@/lib/i18n/ui-strings';
import { tongExpressionUrl } from '@/lib/content/tong-expressions';
import { EXERCISE_XP } from '@/lib/cozy/bridge';
import {
  FORMAT_LABEL, buildReviewExercise, planReview, reviewRecords, reviewWords, withAttempt,
  type ReviewHistory, type ReviewItem,
} from '@/lib/cozy/review';

const HISTORY_KEY = 'tong-cozy-review-formats';

export interface PracticeTally {
  exercises: number;
  correct: number;
  xpAwarded: number;
}

function loadHistory(): ReviewHistory {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function saveHistory(h: ReviewHistory) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* storage unavailable */ }
}

const PLACE_NAMES: Record<string, string> = {
  food_street: '포장마차 거리', cafe: '카페 봄', convenience_store: '편의점', subway_hub: '홍대입구역', practice_studio: '연습실',
};

/** Tap Tong → Learn: a Tong lesson for the place the player is at. */
function LearnOverlay({ request, onClose }: { request: CozyPracticeRequest; onClose: (t: PracticeTally) => void }) {
  const start = useRef({ xp: getGameState().xp, done: 0, correct: 0 });
  useEffect(() => {
    const s = getSessionState().activeSession;
    start.current.done = s?.exercisesCompleted ?? 0;
    start.current.correct = s?.exercisesCorrect ?? 0;
  }, []);
  const close = () => {
    const s = getSessionState().activeSession;
    onClose({
      exercises: Math.max(0, (s?.exercisesCompleted ?? 0) - start.current.done),
      correct: Math.max(0, (s?.exercisesCorrect ?? 0) - start.current.correct),
      xpAwarded: Math.max(0, getGameState().xp - start.current.xp),
    });
  };
  const lang = (getGameState().explainIn[request.cityId] ?? 'en') as UILang;
  return (
    <UILangProvider value={lang}>
      <div className="cozy-practice" role="dialog" aria-label="Learn with Tong">
        <div className="cozy-practice__panel cozy-practice__panel--learn">
          <header className="cozy-practice__bar">
            <img src={tongExpressionUrl('cheerful')} alt="" />
            <span className="cozy-practice__title"><b lang="ko">배우기</b> Learn</span>
            {PLACE_NAMES[request.locationId] && <span className="cozy-practice__place" lang="ko">{PLACE_NAMES[request.locationId]}</span>}
            <button type="button" className="cozy-practice__close" onClick={close} aria-label="Back to the game">✕</button>
          </header>
          <div className="cozy-practice__body">
            <LearnPanel cityId={request.cityId} locationId={request.locationId} userId="local" lang="ko" autoStart />
          </div>
        </div>
      </div>
    </UILangProvider>
  );
}

interface Round {
  seed: string;
  items: ReviewItem[];
  /** Formats each word had tried before this round, to badge new ones. */
  before: ReviewHistory;
}

function newRound(request: CozyPracticeRequest): Round | null {
  const seed = Date.now().toString(36);
  const before = loadHistory();
  const items = planReview(request.words, getGameState().itemMastery, before, { seed });
  return items ? { seed, items, before } : null;
}

/** Tap Tong → Review: fresh exercises on the player's words, harder as they stick. */
function ReviewOverlay({ request, onClose }: { request: CozyPracticeRequest; onClose: (t: PracticeTally) => void }) {
  const pool = useMemo(() => reviewWords(request.words), [request.words]);
  const [round, setRound] = useState<Round | null>(() => newRound(request));
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState<PracticeTally>({ exercises: 0, correct: 0, xpAwarded: 0 });
  const [roundScore, setRoundScore] = useState(0);
  const item = round?.items[index];
  const exercise = useMemo(
    () => (round && item ? buildReviewExercise(item, pool, getGameState().itemMastery, round.seed) : null),
    // Build once per item; mastery changes from answering must not rebuild the open exercise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round, index],
  );

  const answer = useCallback((correct: boolean) => {
    if (!item || !exercise) return;
    for (const r of reviewRecords(item, exercise, correct)) dispatch({ type: 'RECORD_ITEM_RESULT', itemId: r.itemId, category: r.category, correct: r.correct });
    const xp = correct ? EXERCISE_XP.correct : EXERCISE_XP.incorrect;
    dispatch({ type: 'ADD_XP', amount: xp });
    saveHistory(withAttempt(loadHistory(), item));
    setTally((t) => ({ exercises: t.exercises + 1, correct: t.correct + (correct ? 1 : 0), xpAwarded: t.xpAwarded + xp }));
    if (correct) setRoundScore((s) => s + 1);
    setIndex((i) => i + 1);
  }, [item, exercise]);

  const again = () => {
    setRound(newRound(request));
    setIndex(0);
    setRoundScore(0);
  };

  if (!round) {
    return (
      <div className="cozy-practice" role="dialog" aria-label="Review with Tong">
        <div className="cozy-practice__panel cozy-practice__card">
          <img className="cozy-practice__tong" src={tongExpressionUrl('thinking')} alt="" />
          <p className="cozy-practice__ko" lang="ko">단어를 더 모아 와!</p>
          <p className="cozy-practice__en">Collect a few more words first.</p>
          <button type="button" className="cozy-practice__btn" onClick={() => onClose(tally)}>OK</button>
        </div>
      </div>
    );
  }

  if (!item || !exercise) {
    const perfect = roundScore === round.items.length;
    return (
      <div className="cozy-practice" role="dialog" aria-label="Review done">
        <div className="cozy-practice__panel cozy-practice__card">
          <img className="cozy-practice__tong" src={tongExpressionUrl(perfect ? 'proud' : 'cheerful')} alt="" />
          <p className="cozy-practice__ko" lang="ko">{perfect ? '완벽해!' : '잘했어!'}</p>
          <p className="cozy-practice__score">{roundScore}/{round.items.length}</p>
          <ul className="cozy-practice__words">
            {round.items.map((it, i) => (
              <li key={`${it.word.ko}-${i}`}><b lang="ko">{it.word.ko}</b> {it.word.en}</li>
            ))}
          </ul>
          <div className="cozy-practice__actions">
            <button type="button" className="cozy-practice__btn" onClick={again}>Again</button>
            <button type="button" className="cozy-practice__btn cozy-practice__btn--quiet" onClick={() => onClose(tally)}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  const isNew = !(round.before[item.word.ko] ?? []).includes(item.format);
  return (
    <ExerciseModal
      key={`${round.seed}-${index}`}
      exercise={exercise}
      onResult={(_id, correct) => answer(correct)}
      onClose={() => onClose(tally)}
      header={
        <div className="cozy-exercise-frame" role="status" tabIndex={-1}>
          <span className="cozy-exercise-speaker">복습 · Review {index + 1}/{round.items.length}</span>
          <p className="cozy-exercise-en">
            {FORMAT_LABEL[item.format]}
            {item.stretch ? <span className="cozy-practice__tag">Harder</span> : isNew ? <span className="cozy-practice__tag">New</span> : null}
          </p>
        </div>
      }
    />
  );
}

export function CozyPractice({ request, onClose }: { request: CozyPracticeRequest; onClose: (t: PracticeTally) => void }) {
  return request.mode === 'learn'
    ? <LearnOverlay request={request} onClose={onClose} />
    : <ReviewOverlay request={request} onClose={onClose} />;
}

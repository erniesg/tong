'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CozyExerciseRequest, CozyExerciseResult, CozyPracticeRequest, CozyRecordedItem, HostToCozyMessage } from '../../../../packages/contracts';
import { ExerciseModal } from '@/components/learn/ExerciseModal';
import { CozyPractice, type PracticeTally } from './CozyPractice';
import { dispatch, getGameState, useGameState } from '@/lib/store/game-store';
import { generateExercise } from '@/lib/exercises/generators';
import { extractTargetItems } from '@/lib/exercises/extract-targets';
import { getRegisteredLocationKeys } from '@/lib/content/locations';
import type { ExerciseData } from '@/lib/types/hangout';
import {
  EXERCISE_XP, actionsForEvents, actionsForMigration, buildBlockCrush, buildSentenceBuilder, envelope,
  parseCozyMessage, recordedItemsFor, snapshotFromState, PROTOCOL,
} from '@/lib/cozy/bridge';

const IMPORTS_KEY = 'tong-cozy-imports';
const AWARDED_KEY = 'tong-cozy-awarded'; // story beats already applied to the shared store
const MAX_AWARDED = 4000;
const SPEAKERS: Record<string, string> = {
  cashier: '직원 · Clerk', ajusshi: '아저씨 · Ajusshi', barista: '바리스타 · Barista',
  haeun: '하은 · Ha-eun', jin: '진 · Jin', tong: '통 · Tong',
};

interface Practice {
  requestId: string;
  request: CozyPracticeRequest;
}

interface Active {
  requestId: string;
  request: CozyExerciseRequest;
  exercise: ExerciseData;
}

const isKnownLocation = (key: string) => getRegisteredLocationKeys().includes(key);

function storedList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function storeList(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

const importedSaves = () => storedList(IMPORTS_KEY);

/**
 * Scale the exercise card (CSS zoom keeps pointer hit-testing consistent) so it
 * fits without scrolling, e.g. a block-crush on a phone held in landscape.
 */
function fitExercise() {
  const content = document.querySelector<HTMLElement>('.exercise-modal-content');
  const card = content?.querySelector<HTMLElement>(':scope > .exercise-card');
  const frame = content?.querySelector<HTMLElement>('.cozy-exercise-frame');
  if (!content || !card) return;
  card.style.zoom = '1';
  const natural = card.getBoundingClientRect().height;
  const backdrop = content.parentElement ? getComputedStyle(content.parentElement) : null;
  const pad = backdrop ? parseFloat(backdrop.paddingTop) + parseFloat(backdrop.paddingBottom) : 24;
  const beside = matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
  const avail = window.innerHeight - pad - (beside || !frame ? 0 : frame.offsetHeight + 10);
  const zoom = Math.max(0.55, Math.min(1, avail / natural));
  card.style.zoom = zoom < 0.99 ? zoom.toFixed(3) : '';
}

function buildExercise(req: CozyExerciseRequest): ExerciseData {
  const state = getGameState();
  if (req.exerciseType === 'block_crush') {
    const built = buildBlockCrush(req, state.itemMastery);
    if (built) return built;
  }
  if (req.exerciseType === 'sentence_builder') return buildSentenceBuilder(req);
  return generateExercise(req.exerciseType, {
    hintItems: req.targetItems,
    objectiveId: req.objectiveId,
    mastery: state.itemMastery,
    language: 'ko',
    cityId: req.cityId,
    locationId: req.locationId,
    explainIn: state.explainIn[req.cityId],
  });
}

/** Read the page's safe-area insets; the iframe sees zero on iOS. */
function safeArea() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => Math.max(0, Math.round(parseFloat(v) || 0));
  const out = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  probe.remove();
  return out;
}

/**
 * Hosts the cozy 3D game and bridges it to the shared Tong progress store and
 * exercise components. Same-origin only; see "Cozy 3D game ↔ host page bridge"
 * in packages/contracts.
 */
export function CozyHost() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  const practiceRef = useRef<Practice | null>(null);
  const connected = useRef(false);
  const game = useGameState();

  const post = useCallback((message: HostToCozyMessage) => {
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  const progress = () => snapshotFromState(getGameState());

  const finish = useCallback((outcome: 'completed' | 'dismissed', correct: boolean | null) => {
    const a = activeRef.current;
    if (!a) return;
    let recorded: CozyRecordedItem[] = [];
    let xp = 0;
    if (outcome === 'completed' && correct !== null) {
      const fromRequest = recordedItemsFor(a.request, correct);
      recorded = fromRequest.length ? fromRequest : extractTargetItems(a.exercise).map((t) => ({ ...t, correct }));
      for (const r of recorded) dispatch({ type: 'RECORD_ITEM_RESULT', itemId: r.itemId, category: r.category, correct: r.correct });
      xp = correct ? EXERCISE_XP.correct : EXERCISE_XP.incorrect;
      dispatch({ type: 'ADD_XP', amount: xp });
    }
    const result: CozyExerciseResult = {
      outcome, correct: outcome === 'completed' ? correct : null, exerciseId: a.exercise.id,
      exerciseType: a.request.exerciseType, recordedItems: recorded, xpAwarded: xp, progress: progress(),
    };
    activeRef.current = null;
    setActive(null);
    post(envelope('host:exercise-result', result, a.requestId));
    const frame = frameRef.current;
    if (frame) {
      frame.removeAttribute('inert');
      frame.focus();
    }
  }, [post]);

  const finishPractice = useCallback((tally: PracticeTally) => {
    const p = practiceRef.current;
    if (!p) return;
    practiceRef.current = null;
    setPractice(null);
    post(envelope('host:practice-result', { outcome: 'completed', mode: p.request.mode, ...tally, progress: progress() }, p.requestId));
    const frame = frameRef.current;
    if (frame) {
      frame.removeAttribute('inert');
      frame.focus();
    }
  }, [post]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const frame = frameRef.current;
      if (e.origin !== window.location.origin || !frame || e.source !== frame.contentWindow) return;
      const requestId = typeof e.data?.requestId === 'string' ? e.data.requestId : undefined;
      const parsed = parseCozyMessage(e.data);
      if (!parsed.ok) {
        if (e.data?.protocol === PROTOCOL) post(envelope('host:error', { reason: parsed.reason }, requestId));
        return;
      }
      const m = parsed.message;
      switch (m.type) {
        case 'cozy:hello':
          connected.current = true;
          post(envelope('host:ready', { progress: progress() }, requestId));
          post(envelope('host:viewport', { safeArea: safeArea() }));
          break;
        case 'cozy:progress': {
          const awarded = new Set(storedList(AWARDED_KEY));
          const before = awarded.size;
          for (const action of actionsForEvents(m.payload.events, isKnownLocation, awarded)) dispatch(action);
          if (awarded.size !== before) storeList(AWARDED_KEY, [...awarded].slice(-MAX_AWARDED));
          post(envelope('host:progress', { progress: progress() }, requestId));
          break;
        }
        case 'cozy:migrate': {
          const done = importedSaves();
          const applied = !done.includes(m.payload.saveId);
          if (applied) {
            for (const action of actionsForMigration(m.payload)) dispatch(action);
            storeList(IMPORTS_KEY, [...done, m.payload.saveId]);
          }
          post(envelope('host:migrated', { applied, progress: progress() }, requestId));
          break;
        }
        case 'cozy:exercise': {
          const base = { correct: null, exerciseId: null, exerciseType: m.payload.exerciseType, recordedItems: [], xpAwarded: 0 };
          if (activeRef.current || practiceRef.current || !requestId) {
            post(envelope('host:exercise-result', { ...base, outcome: 'unavailable', reason: requestId ? 'busy' : 'missing requestId', progress: progress() }, requestId));
            break;
          }
          let exercise: ExerciseData;
          try {
            exercise = buildExercise(m.payload);
          } catch (err) {
            post(envelope('host:exercise-result', { ...base, outcome: 'unavailable', reason: String(err), progress: progress() }, requestId));
            break;
          }
          const next = { requestId, request: m.payload, exercise };
          activeRef.current = next;
          // The game pauses itself while waiting; inert also keeps focus and taps out of it.
          frame.setAttribute('inert', '');
          setActive(next);
          break;
        }
        case 'cozy:practice': {
          if (activeRef.current || practiceRef.current || !requestId) {
            const reason = requestId ? 'busy' : 'missing requestId';
            post(envelope('host:practice-result', { outcome: 'unavailable', mode: m.payload.mode, exercises: 0, correct: 0, xpAwarded: 0, reason, progress: progress() }, requestId));
            break;
          }
          const next = { requestId, request: m.payload };
          practiceRef.current = next;
          frame.setAttribute('inert', '');
          setPractice(next);
          break;
        }
      }
    }
    window.addEventListener('message', onMessage);
    const onResize = () => connected.current && post(envelope('host:viewport', { safeArea: safeArea() }));
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onResize);
    };
  }, [post]);

  // While an exercise or practice is open: fit exercises to the screen, take focus from the inert game, Escape dismisses.
  const overlay = !!active || !!practice;
  useEffect(() => {
    if (!overlay) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const refit = () => {
      timers.forEach(clearTimeout);
      timers = [0, 120, 400].map((ms) => setTimeout(fitExercise, ms));
    };
    refit();
    window.addEventListener('resize', refit);
    // Review opens one exercise after another; refit and refocus each one.
    const seen = new WeakSet<Element>();
    const observer = new MutationObserver(() => {
      const frameEl = document.querySelector<HTMLElement>('.cozy-exercise-frame');
      if (!frameEl || seen.has(frameEl)) return;
      seen.add(frameEl);
      frameEl.focus();
      refit();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelector<HTMLElement>('.cozy-exercise-frame')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const btn = document.querySelector<HTMLButtonElement>('.exercise-dismiss-btn') ?? document.querySelector<HTMLButtonElement>('.cozy-practice__close');
      btn?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
      window.removeEventListener('resize', refit);
      window.removeEventListener('keydown', onKey);
    };
  }, [overlay]);

  // Push store changes (including ones made by the exercise overlay) to the game.
  useEffect(() => {
    if (connected.current) post(envelope('host:progress', { progress: snapshotFromState(game) }));
  }, [game, post]);

  const req = active?.request;
  return (
    <>
      <iframe ref={frameRef} className="cozy-frame" src="/cozy/index.html" title="홍대 한 바퀴 — cozy 3D Seoul" allow="autoplay; fullscreen" />
      {practice && <CozyPractice key={practice.requestId} request={practice.request} onClose={finishPractice} />}
      {active && req && (
        <ExerciseModal
          key={active.requestId}
          exercise={active.exercise}
          onResult={(_id, correct) => finish('completed', correct)}
          onClose={() => finish('dismissed', null)}
          header={
            <div className="cozy-exercise-frame" role="status" tabIndex={-1}>
              {req.framing.speakerId && <span className="cozy-exercise-speaker">{SPEAKERS[req.framing.speakerId] ?? req.framing.speakerId}</span>}
              {req.framing.ko && <p className="cozy-exercise-ko" lang="ko">{req.framing.ko}</p>}
              <p className="cozy-exercise-en">{req.framing.en}</p>
            </div>
          }
        />
      )}
    </>
  );
}

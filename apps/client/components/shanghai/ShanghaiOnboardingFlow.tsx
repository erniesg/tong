'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SHANGHAI_ONBOARDING_PANORAMA, getShanghaiOnboardingTongCopy } from '@/lib/content/shanghai/onboarding-flow';
import { getWebtoonFixture } from '@/lib/content/shanghai/fixtures';
import { WebtoonStrip } from '@/components/scene/WebtoonStrip';
import { GameHUD } from '@/components/hud/GameHUD';
import { TongOverlay } from '@/components/scene/TongOverlay';
import { ExerciseModal } from '@/components/learn/ExerciseModal';
import { KoreanText } from '@/components/shared/KoreanText';
import type { ExerciseData } from '@/lib/types/hangout';
import type { WebtoonPanel } from '@/lib/hangout/fixture-types';
import { dispatch, useGameState } from '@/lib/store/game-store';

type OnboardingPhase = 'panorama' | 'webtoon' | 'webtoon-interlude' | 'complete';
type SetupStep = 'intro' | 'prelisten-exercise' | 'prelisten-transition' | 'post-exercise' | 'pan';

interface PanoramaMetrics {
  width: number;
  height: number;
  y: number;
  maxOffsetX: number;
}

interface StoredCheckpoint {
  phase: OnboardingPhase;
  setupStep?: SetupStep;
  introIndex?: number;
  preListeningIndex?: number;
  preListeningTransitionIndex?: number;
  postExerciseIndex?: number;
  webtoonStepIndex?: number;
  webtoonInterludeLineIndex?: number;
  webtoonInterludeExerciseIndex?: number;
  pan?: number;
  webtoonComplete?: boolean;
}

const CHECKPOINT_KEY = 'tong:shanghai:onboarding:h1';
const WEBTOON_ENTRY_PAN = 0.08;
const SHANGHAI_H1_XP = 80;
const SHANGHAI_H1_SP = 40;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function isStoredCheckpoint(value: unknown): value is StoredCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const phase = (value as { phase?: unknown }).phase;
  return phase === 'panorama' || phase === 'webtoon' || phase === 'webtoon-interlude' || phase === 'complete';
}

export function ShanghaiOnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameState = useGameState();
  const shouldReset = searchParams.get('reset') === '1';
  const focus = searchParams.get('focus');
  const fixture = useMemo(() => getWebtoonFixture(SHANGHAI_ONBOARDING_PANORAMA.webtoonFixtureId), []);
  const explainLang = gameState.explainIn.shanghai ?? 'en';
  const tongCopy = useMemo(
    () => getShanghaiOnboardingTongCopy(explainLang, gameState.selfAssessedLevel),
    [explainLang, gameState.selfAssessedLevel],
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startPan: SHANGHAI_ONBOARDING_PANORAMA.presentation.initialFocus,
  });
  const [phase, setPhase] = useState<OnboardingPhase>('panorama');
  const [setupStep, setSetupStep] = useState<SetupStep>('intro');
  const [introIndex, setIntroIndex] = useState(0);
  const [preListeningIndex, setPreListeningIndex] = useState(0);
  const [preListeningTransitionIndex, setPreListeningTransitionIndex] = useState(0);
  const [postExerciseIndex, setPostExerciseIndex] = useState(0);
  const [webtoonStepIndex, setWebtoonStepIndex] = useState(0);
  const [webtoonInterludeLineIndex, setWebtoonInterludeLineIndex] = useState(0);
  const [webtoonInterludeExerciseIndex, setWebtoonInterludeExerciseIndex] = useState(0);
  const [tongVisible, setTongVisible] = useState(true);
  const [currentExercise, setCurrentExercise] = useState<ExerciseData | null>(null);
  const [suspendedExercise, setSuspendedExercise] = useState<ExerciseData | null>(null);
  const [webtoonReadyToContinue, setWebtoonReadyToContinue] = useState(false);
  const [webtoonComplete, setWebtoonComplete] = useState(false);
  const [pan, setPan] = useState(SHANGHAI_ONBOARDING_PANORAMA.presentation.initialFocus);
  const [metrics, setMetrics] = useState<PanoramaMetrics>({ width: 0, height: 0, y: 0, maxOffsetX: 0 });

  const activeTongLines = setupStep === 'post-exercise'
    ? tongCopy.postExerciseTongLines
    : setupStep === 'prelisten-transition'
      ? tongCopy.preListeningTransitionTongLines[preListeningIndex] ?? []
      : tongCopy.introTongLines;
  const activeTongIndex = setupStep === 'post-exercise'
    ? postExerciseIndex
    : setupStep === 'prelisten-transition'
      ? preListeningTransitionIndex
      : introIndex;
  const activeTongLine = activeTongLines[Math.min(activeTongIndex, Math.max(activeTongLines.length - 1, 0))];
  const panUnlocked = setupStep === 'pan' && phase === 'panorama';
  const webtoonSteps = SHANGHAI_ONBOARDING_PANORAMA.webtoonSteps;
  const activeWebtoonStep = webtoonSteps[webtoonStepIndex] ?? webtoonSteps[0];
  const getStepTongLines = useCallback((step: typeof activeWebtoonStep | undefined) => (
    step ? tongCopy.webtoonStepTongLines[step.id] ?? step.afterTongLines ?? [] : []
  ), [tongCopy]);
  const panelById = useMemo(
    () => new Map((fixture?.spec.panels ?? []).map((panel) => [panel.id, panel])),
    [fixture],
  );
  const activeWebtoonPanels = useMemo(() => {
    if (!fixture) return [];
    if (!activeWebtoonStep) return fixture.spec.panels;
    const panels = activeWebtoonStep.panelIds
      .map((id) => panelById.get(id))
      .filter((panel): panel is WebtoonPanel => Boolean(panel));
    return panels.length > 0 ? panels : fixture.spec.panels;
  }, [activeWebtoonStep, fixture, panelById]);
  const visibleWebtoonPanels = useMemo(() => {
    if (!fixture) return [];
    const visiblePanelIds = webtoonSteps
      .slice(0, webtoonStepIndex + 1)
      .flatMap((step) => step.panelIds);
    const panels = visiblePanelIds
      .map((id) => panelById.get(id))
      .filter((panel): panel is WebtoonPanel => Boolean(panel));
    return panels.length > 0 ? panels : activeWebtoonPanels;
  }, [activeWebtoonPanels, fixture, panelById, webtoonStepIndex, webtoonSteps]);
  const activeInterludeLines = getStepTongLines(activeWebtoonStep);
  const activeInterludeLine = webtoonInterludeLineIndex < activeInterludeLines.length
    ? activeInterludeLines[webtoonInterludeLineIndex]
    : undefined;

  const hud = (
    <GameHUD
      xp={0}
      sp={0}
      rp={10}
      cityId="shanghai"
      explainLang={explainLang}
      locationLabel={<>Shanghai <span className="korean">上海</span><span className="scene-hud-dot">&middot;</span> Xiaolongbao Shop</>}
    />
  );

  const writeCheckpoint = useCallback((checkpoint: StoredCheckpoint) => {
    try {
      window.localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
    } catch {
      // LocalStorage is a resume nicety, not a route blocker.
    }
  }, []);

  useEffect(() => {
    if (shouldReset) {
      window.localStorage.removeItem(CHECKPOINT_KEY);
      const startInWebtoon = focus === 'webtoon';
      setPhase(startInWebtoon ? 'webtoon' : 'panorama');
      setSetupStep(startInWebtoon ? 'pan' : 'intro');
      setIntroIndex(0);
      setPreListeningIndex(0);
      setPreListeningTransitionIndex(0);
      setPostExerciseIndex(0);
      setWebtoonStepIndex(0);
      setWebtoonInterludeLineIndex(0);
      setWebtoonInterludeExerciseIndex(0);
      setTongVisible(!startInWebtoon);
      setCurrentExercise(null);
      setSuspendedExercise(null);
      setWebtoonReadyToContinue(false);
      setWebtoonComplete(false);
      setPan(startInWebtoon ? 0 : SHANGHAI_ONBOARDING_PANORAMA.presentation.initialFocus);
      return;
    }

    try {
      const raw = window.localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isStoredCheckpoint(parsed)) return;
      setPhase(parsed.phase);
      setSetupStep(parsed.setupStep ?? (parsed.phase === 'panorama' ? 'intro' : 'pan'));
      setIntroIndex(parsed.introIndex ?? 0);
      const restoredPreListeningIndex = parsed.preListeningIndex ?? 0;
      setPreListeningIndex(restoredPreListeningIndex);
      setPreListeningTransitionIndex(parsed.preListeningTransitionIndex ?? 0);
      setPostExerciseIndex(parsed.postExerciseIndex ?? 0);
      const restoredWebtoonStepIndex = parsed.webtoonStepIndex ?? 0;
      const restoredInterludeLineIndex = parsed.webtoonInterludeLineIndex ?? 0;
      const restoredInterludeExerciseIndex = parsed.webtoonInterludeExerciseIndex ?? 0;
      setWebtoonStepIndex(restoredWebtoonStepIndex);
      setWebtoonInterludeLineIndex(restoredInterludeLineIndex);
      setWebtoonInterludeExerciseIndex(restoredInterludeExerciseIndex);
      setSuspendedExercise(null);
      setWebtoonReadyToContinue(false);
      setPan(typeof parsed.pan === 'number' ? parsed.pan : SHANGHAI_ONBOARDING_PANORAMA.presentation.initialFocus);
      setWebtoonComplete(parsed.webtoonComplete ?? parsed.phase === 'complete');
      setTongVisible(parsed.phase === 'panorama' && (
        parsed.setupStep === 'intro'
        || parsed.setupStep === 'prelisten-transition'
        || parsed.setupStep === 'post-exercise'
      ));
      const restoredWebtoonStep = SHANGHAI_ONBOARDING_PANORAMA.webtoonSteps[restoredWebtoonStepIndex];
      const interludeLinesDone = restoredInterludeLineIndex >= getStepTongLines(restoredWebtoonStep).length;
      setCurrentExercise(
        parsed.phase === 'panorama' && parsed.setupStep === 'prelisten-exercise'
          ? SHANGHAI_ONBOARDING_PANORAMA.preListeningExercises[restoredPreListeningIndex] ?? null
          : parsed.phase === 'webtoon-interlude' && interludeLinesDone
            ? restoredWebtoonStep?.afterExercises?.[restoredInterludeExerciseIndex] ?? null
          : null,
      );
    } catch {
      window.localStorage.removeItem(CHECKPOINT_KEY);
    }
  }, [focus, getStepTongLines, shouldReset]);

  const updateMetrics = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const { width: mediaWidth, height: mediaHeight } = SHANGHAI_ONBOARDING_PANORAMA.media;
    const scale = Math.max(rect.width / mediaWidth, rect.height / mediaHeight);
    const width = mediaWidth * scale;
    const height = mediaHeight * scale;

    setMetrics({
      width,
      height,
      y: (rect.height - height) / 2,
      maxOffsetX: Math.max(0, width - rect.width),
    });
  }, []);

  useEffect(() => {
    updateMetrics();
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [updateMetrics]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.tong-whisper,.scene-hud,.scene-hud-pull-tab,.dialogue-subtitle,a')) return;
    if (!panUnlocked) return;
    dragRef.current = { active: true, moved: false, startX: event.clientX, startPan: pan };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pan, panUnlocked]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!panUnlocked || !dragRef.current.active || metrics.maxOffsetX <= 0) return;
    const deltaX = event.clientX - dragRef.current.startX;
    if (Math.abs(deltaX) > 6) {
      dragRef.current.moved = true;
    }
    setPan(clamp(dragRef.current.startPan + deltaX / metrics.maxOffsetX));
  }, [metrics.maxOffsetX, panUnlocked]);

  const handlePointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragRef.current.moved) {
      window.setTimeout(() => {
        dragRef.current.moved = false;
      }, 180);
    }
  }, []);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!panUnlocked || metrics.maxOffsetX <= 0) return;
    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : -event.deltaY;
    setPan((current) => clamp(current + dominantDelta / Math.max(metrics.maxOffsetX, 480)));
  }, [metrics.maxOffsetX, panUnlocked]);

  const dismissTong = useCallback(() => {
    if (setupStep === 'intro' && introIndex < tongCopy.introTongLines.length - 1) {
      setIntroIndex((current) => current + 1);
      return;
    }
    if (setupStep === 'intro') {
      setTongVisible(false);
      setSetupStep('prelisten-exercise');
      setPreListeningIndex(0);
      setPreListeningTransitionIndex(0);
      setCurrentExercise(SHANGHAI_ONBOARDING_PANORAMA.preListeningExercises[0] ?? null);
      writeCheckpoint({ phase: 'panorama', setupStep: 'prelisten-exercise', introIndex, preListeningIndex: 0, preListeningTransitionIndex: 0, pan });
      return;
    }

    if (setupStep === 'prelisten-transition') {
      const transitionLines = tongCopy.preListeningTransitionTongLines[preListeningIndex] ?? [];
      if (preListeningTransitionIndex < transitionLines.length - 1) {
        setPreListeningTransitionIndex((current) => current + 1);
        return;
      }
      setTongVisible(false);
      setSetupStep('prelisten-exercise');
      setCurrentExercise(SHANGHAI_ONBOARDING_PANORAMA.preListeningExercises[preListeningIndex] ?? null);
      writeCheckpoint({
        phase: 'panorama',
        setupStep: 'prelisten-exercise',
        introIndex,
        preListeningIndex,
        preListeningTransitionIndex,
        postExerciseIndex,
        pan,
      });
      return;
    }

    if (setupStep === 'post-exercise' && postExerciseIndex < tongCopy.postExerciseTongLines.length - 1) {
      setPostExerciseIndex((current) => current + 1);
      return;
    }

    if (setupStep === 'post-exercise') {
      setTongVisible(false);
      setSetupStep('pan');
      writeCheckpoint({ phase: 'panorama', setupStep: 'pan', introIndex, postExerciseIndex, pan });
      return;
    }

    setTongVisible(false);
  }, [
    introIndex,
    pan,
    postExerciseIndex,
    preListeningIndex,
    preListeningTransitionIndex,
    setupStep,
    tongCopy.introTongLines.length,
    tongCopy.postExerciseTongLines.length,
    tongCopy.preListeningTransitionTongLines,
    writeCheckpoint,
  ]);

  const finishOnboarding = useCallback(() => {
    if (webtoonComplete || phase === 'complete') return;
    setWebtoonComplete(true);
    setPhase('complete');
    setCurrentExercise(null);
    setSuspendedExercise(null);
    setWebtoonReadyToContinue(false);
    dispatch({ type: 'ADD_XP', amount: SHANGHAI_H1_XP });
    dispatch({ type: 'ADD_SP', amount: SHANGHAI_H1_SP });
    dispatch({ type: 'INCREMENT_LOCATION_HANGOUT', cityId: 'shanghai', locationId: 'dumpling_shop' });
    writeCheckpoint({
      phase: 'complete',
      setupStep: 'pan',
      introIndex,
      postExerciseIndex,
      webtoonStepIndex,
      pan,
      webtoonComplete: true,
    });
  }, [introIndex, pan, phase, postExerciseIndex, webtoonComplete, webtoonStepIndex, writeCheckpoint]);

  const advanceToNextWebtoonStep = useCallback(() => {
    const nextStepIndex = webtoonStepIndex + 1;
    setCurrentExercise(null);
    setSuspendedExercise(null);
    setWebtoonReadyToContinue(false);
    setWebtoonInterludeLineIndex(0);
    setWebtoonInterludeExerciseIndex(0);

    if (nextStepIndex < webtoonSteps.length) {
      setPhase('webtoon');
      setWebtoonStepIndex(nextStepIndex);
      writeCheckpoint({
        phase: 'webtoon',
        setupStep: 'pan',
        introIndex,
        postExerciseIndex,
        webtoonStepIndex: nextStepIndex,
        pan,
        webtoonComplete: false,
      });
      return;
    }

    finishOnboarding();
  }, [finishOnboarding, introIndex, pan, postExerciseIndex, webtoonStepIndex, webtoonSteps.length, writeCheckpoint]);

  const startWebtoonInterlude = useCallback(() => {
    const lines = getStepTongLines(activeWebtoonStep);
    const exercises = activeWebtoonStep?.afterExercises ?? [];
    const lineIndex = lines.length > 0 ? 0 : lines.length;
    setWebtoonReadyToContinue(false);
    setSuspendedExercise(null);
    setPhase('webtoon-interlude');
    setWebtoonInterludeLineIndex(lineIndex);
    setWebtoonInterludeExerciseIndex(0);
    setCurrentExercise(lines.length === 0 ? exercises[0] ?? null : null);
    writeCheckpoint({
      phase: 'webtoon-interlude',
      setupStep: 'pan',
      introIndex,
      postExerciseIndex,
      webtoonStepIndex,
      webtoonInterludeLineIndex: lineIndex,
      webtoonInterludeExerciseIndex: 0,
      pan,
      webtoonComplete: false,
    });
  }, [activeWebtoonStep, getStepTongLines, introIndex, pan, postExerciseIndex, webtoonStepIndex, writeCheckpoint]);

  const completeWebtoonSegment = useCallback(() => {
    const hasInterlude = Boolean(
      getStepTongLines(activeWebtoonStep).length
      || activeWebtoonStep?.afterExercises?.length,
    );
    if (hasInterlude) {
      startWebtoonInterlude();
      return;
    }
    advanceToNextWebtoonStep();
  }, [activeWebtoonStep, advanceToNextWebtoonStep, getStepTongLines, startWebtoonInterlude]);

  const handleWebtoonScrollEnd = useCallback(() => {
    setWebtoonReadyToContinue(true);
  }, []);

  const handleExerciseClose = useCallback(() => {
    if (!currentExercise || phase !== 'webtoon-interlude') return;
    setSuspendedExercise(currentExercise);
    setCurrentExercise(null);
  }, [currentExercise, phase]);

  const resumeSuspendedExercise = useCallback(() => {
    if (!suspendedExercise || phase !== 'webtoon-interlude') return;
    setCurrentExercise(suspendedExercise);
    setSuspendedExercise(null);
  }, [phase, suspendedExercise]);

  const handleInterludeContinue = useCallback(() => {
    const lines = getStepTongLines(activeWebtoonStep);
    const exercises = activeWebtoonStep?.afterExercises ?? [];
    const nextLineIndex = webtoonInterludeLineIndex + 1;

    if (nextLineIndex < lines.length) {
      setWebtoonInterludeLineIndex(nextLineIndex);
      writeCheckpoint({
        phase: 'webtoon-interlude',
        setupStep: 'pan',
        introIndex,
        postExerciseIndex,
        webtoonStepIndex,
        webtoonInterludeLineIndex: nextLineIndex,
        webtoonInterludeExerciseIndex,
        pan,
        webtoonComplete: false,
      });
      return;
    }

    if (exercises.length > 0) {
      setWebtoonInterludeLineIndex(lines.length);
      setWebtoonInterludeExerciseIndex(0);
      setCurrentExercise(exercises[0] ?? null);
      writeCheckpoint({
        phase: 'webtoon-interlude',
        setupStep: 'pan',
        introIndex,
        postExerciseIndex,
        webtoonStepIndex,
        webtoonInterludeLineIndex: lines.length,
        webtoonInterludeExerciseIndex: 0,
        pan,
        webtoonComplete: false,
      });
      return;
    }

    advanceToNextWebtoonStep();
  }, [
    activeWebtoonStep,
    advanceToNextWebtoonStep,
    getStepTongLines,
    introIndex,
    pan,
    postExerciseIndex,
    webtoonInterludeExerciseIndex,
    webtoonInterludeLineIndex,
    webtoonStepIndex,
    writeCheckpoint,
  ]);

  const handleExerciseResult = useCallback((_exerciseId: string, correct: boolean) => {
    if (phase === 'webtoon-interlude') {
      setSuspendedExercise(null);
      for (const itemId of activeWebtoonStep?.masteryItems ?? []) {
        dispatch({ type: 'RECORD_ITEM_RESULT', itemId, category: 'vocabulary', correct });
      }
      const nextExerciseIndex = webtoonInterludeExerciseIndex + 1;
      const nextExercise = activeWebtoonStep?.afterExercises?.[nextExerciseIndex];
      if (nextExercise) {
        setWebtoonInterludeExerciseIndex(nextExerciseIndex);
        setCurrentExercise(nextExercise);
        writeCheckpoint({
          phase: 'webtoon-interlude',
          setupStep: 'pan',
          introIndex,
          postExerciseIndex,
          webtoonStepIndex,
          webtoonInterludeLineIndex,
          webtoonInterludeExerciseIndex: nextExerciseIndex,
          pan,
          webtoonComplete: false,
        });
        return;
      }

      advanceToNextWebtoonStep();
      return;
    }

    const practicedItems = ['小'];
    for (const itemId of practicedItems) {
      dispatch({ type: 'RECORD_ITEM_RESULT', itemId, category: 'vocabulary', correct });
    }

    const nextPreListeningIndex = preListeningIndex + 1;
    const nextExercise = SHANGHAI_ONBOARDING_PANORAMA.preListeningExercises[nextPreListeningIndex];
    if (nextExercise) {
      setPreListeningIndex(nextPreListeningIndex);
      setPreListeningTransitionIndex(0);
      const transitionLines = tongCopy.preListeningTransitionTongLines[nextPreListeningIndex] ?? [];
      if (transitionLines.length > 0) {
        setCurrentExercise(null);
        setSetupStep('prelisten-transition');
        setTongVisible(true);
        writeCheckpoint({
          phase: 'panorama',
          setupStep: 'prelisten-transition',
          introIndex,
          preListeningIndex: nextPreListeningIndex,
          preListeningTransitionIndex: 0,
          postExerciseIndex,
          pan,
        });
        return;
      }
      setCurrentExercise(nextExercise);
      writeCheckpoint({
        phase: 'panorama',
        setupStep: 'prelisten-exercise',
        introIndex,
        preListeningIndex: nextPreListeningIndex,
        preListeningTransitionIndex: 0,
        postExerciseIndex,
        pan,
      });
      return;
    }

    setCurrentExercise(null);
    setSetupStep('post-exercise');
    setPostExerciseIndex(0);
    setTongVisible(true);
    writeCheckpoint({ phase: 'panorama', setupStep: 'post-exercise', introIndex, preListeningIndex, preListeningTransitionIndex, postExerciseIndex: 0, pan });
  }, [
    activeWebtoonStep,
    advanceToNextWebtoonStep,
    introIndex,
    pan,
    phase,
    postExerciseIndex,
    preListeningIndex,
    preListeningTransitionIndex,
    tongCopy.preListeningTransitionTongLines,
    webtoonInterludeExerciseIndex,
    webtoonInterludeLineIndex,
    webtoonStepIndex,
    writeCheckpoint,
  ]);

  useEffect(() => {
    if (!panUnlocked || phase !== 'panorama' || pan > WEBTOON_ENTRY_PAN) return;
    setPhase('webtoon');
    setWebtoonStepIndex(0);
    setWebtoonInterludeLineIndex(0);
    setWebtoonInterludeExerciseIndex(0);
    setSuspendedExercise(null);
    setWebtoonReadyToContinue(false);
    setWebtoonComplete(false);
    writeCheckpoint({ phase: 'webtoon', setupStep: 'pan', introIndex, postExerciseIndex, webtoonStepIndex: 0, pan });
  }, [introIndex, pan, panUnlocked, phase, postExerciseIndex, writeCheckpoint]);

  const worldStyle: CSSProperties = {
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    transform: `translate3d(${-pan * metrics.maxOffsetX}px, ${metrics.y}px, 0)`,
  };

  if ((phase === 'webtoon' || phase === 'webtoon-interlude') && fixture) {
    return (
      <main className="scene-root">
        <div className="game-frame">
          {hud}
          <div className="shanghai-onboarding shanghai-onboarding--webtoon">
            <WebtoonStrip
              panels={visibleWebtoonPanels}
              theme={webtoonStepIndex >= 2 || activeWebtoonStep?.id === 'beat-3-exit-register' ? 'dark' : 'warm'}
              showHelp={false}
              scrollRoot="self"
              onComplete={phase === 'webtoon' ? handleWebtoonScrollEnd : undefined}
            />
            {phase === 'webtoon' && webtoonReadyToContinue && !currentExercise && (
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{ padding: '20px 20px calc(20px + var(--safe-bottom, 0px))', pointerEvents: 'none' }}
              >
                <button
                  className="scene-continue-label animate-pulse"
                  type="button"
                  onClick={completeWebtoonSegment}
                  style={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  Tap to continue
                </button>
              </div>
            )}
            {phase === 'webtoon-interlude' && activeInterludeLine && !currentExercise && (
              <TongOverlay
                message={activeInterludeLine}
                visible
                targetLang="zh"
                interactiveText
                speakerName={tongCopy.tongName}
                onDismiss={handleInterludeContinue}
              />
            )}
            {phase === 'webtoon-interlude' && !activeInterludeLine && !currentExercise && suspendedExercise && (
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{ padding: '20px 20px calc(20px + var(--safe-bottom, 0px))', pointerEvents: 'none' }}
              >
                <button
                  className="scene-continue-label animate-pulse"
                  type="button"
                  onClick={resumeSuspendedExercise}
                  style={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  Tap to resume exercise
                </button>
              </div>
            )}
            {phase === 'webtoon-interlude' && currentExercise && (
              <ExerciseModal
                exercise={currentExercise}
                onResult={handleExerciseResult}
                onClose={handleExerciseClose}
              />
            )}
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'complete') {
    return (
      <main className="scene-root">
        <div className="game-frame summary-screen">
          <img className="summary-scene-bg" src={SHANGHAI_ONBOARDING_PANORAMA.posterUrl} alt="" />
          <div className="summary-overlay" />
          <div className="summary-content">
            <h2 className="summary-title">Hangout complete</h2>
            <p className="summary-text">
              <KoreanText text={tongCopy.completionTongLine} targetLang="zh" />
            </p>
            <div className="summary-stats">
              <div className="summary-stat">
                <div className="summary-stat-value summary-stat-xp">+{SHANGHAI_H1_XP}</div>
                <div className="summary-stat-label">XP earned</div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-value summary-stat-positive">+{SHANGHAI_H1_SP}</div>
                <div className="summary-stat-label">SP earned</div>
              </div>
            </div>
            <button
              className="btn-go"
              type="button"
              onClick={() => router.push('/game?phase=city_map&city=shanghai')}
            >
              Done
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="scene-root">
      <div className="game-frame">
        <section
          ref={stageRef}
          className={`shanghai-onboarding shanghai-onboarding__stage${panUnlocked ? ' shanghai-onboarding__stage--pan' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
          aria-label="Shanghai xiaolongbao shop panorama"
        >
          {hud}
          <div className="shanghai-onboarding__world" style={worldStyle}>
            <video
              className="shanghai-onboarding__video"
              src={SHANGHAI_ONBOARDING_PANORAMA.videoUrl}
              poster={SHANGHAI_ONBOARDING_PANORAMA.posterUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>

          <div className="shanghai-onboarding__scrim" aria-hidden="true" />

          <TongOverlay
            message={activeTongLine ?? ''}
            visible={tongVisible && Boolean(activeTongLine)}
            targetLang="zh"
            speakerName={tongCopy.tongName}
            interactiveText
            onDismiss={dismissTong}
          />

          {panUnlocked && (
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{ padding: '20px 20px calc(20px + var(--safe-bottom, 0px))' }}
            >
              <div className="scene-continue-label animate-pulse">
                {tongCopy.panPrompt}
              </div>
            </div>
          )}
          {currentExercise && (
            <ExerciseModal
              exercise={currentExercise}
              onResult={handleExerciseResult}
            />
          )}
        </section>
      </div>
    </main>
  );
}

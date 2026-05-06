'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SHANGHAI_ONBOARDING_PANORAMA } from '@/lib/content/shanghai/onboarding-flow';
import { getWebtoonFixture } from '@/lib/content/shanghai/fixtures';
import { WebtoonStrip } from '@/components/scene/WebtoonStrip';
import { GameHUD } from '@/components/hud/GameHUD';
import { TongOverlay } from '@/components/scene/TongOverlay';
import { DialogueBox } from '@/components/scene/DialogueBox';
import { ExerciseModal } from '@/components/learn/ExerciseModal';
import type { ExerciseData } from '@/lib/types/hangout';
import type { WebtoonPanel } from '@/lib/hangout/fixture-types';
import { dispatch } from '@/lib/store/game-store';

type OnboardingPhase = 'panorama' | 'webtoon' | 'webtoon-interlude' | 'complete';
type SetupStep = 'intro' | 'prelisten-exercise' | 'post-exercise' | 'pan';

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
  postExerciseIndex?: number;
  webtoonStepIndex?: number;
  webtoonInterludeLineIndex?: number;
  webtoonInterludeExerciseIndex?: number;
  pan?: number;
  webtoonComplete?: boolean;
}

const CHECKPOINT_KEY = 'tong:shanghai:onboarding:h1';
const WEBTOON_ENTRY_PAN = 0.08;

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
  const shouldReset = searchParams.get('reset') === '1';
  const focus = searchParams.get('focus');
  const fixture = useMemo(() => getWebtoonFixture(SHANGHAI_ONBOARDING_PANORAMA.webtoonFixtureId), []);
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
  const [postExerciseIndex, setPostExerciseIndex] = useState(0);
  const [webtoonStepIndex, setWebtoonStepIndex] = useState(0);
  const [webtoonInterludeLineIndex, setWebtoonInterludeLineIndex] = useState(0);
  const [webtoonInterludeExerciseIndex, setWebtoonInterludeExerciseIndex] = useState(0);
  const [tongVisible, setTongVisible] = useState(true);
  const [currentExercise, setCurrentExercise] = useState<ExerciseData | null>(null);
  const [webtoonComplete, setWebtoonComplete] = useState(false);
  const [pan, setPan] = useState(SHANGHAI_ONBOARDING_PANORAMA.presentation.initialFocus);
  const [metrics, setMetrics] = useState<PanoramaMetrics>({ width: 0, height: 0, y: 0, maxOffsetX: 0 });

  const activeTongLines = setupStep === 'post-exercise'
    ? SHANGHAI_ONBOARDING_PANORAMA.postExerciseTongLines
    : SHANGHAI_ONBOARDING_PANORAMA.introTongLines;
  const activeTongIndex = setupStep === 'post-exercise' ? postExerciseIndex : introIndex;
  const introLine = activeTongLines[Math.min(activeTongIndex, activeTongLines.length - 1)];
  const panUnlocked = setupStep === 'pan' && phase === 'panorama';
  const webtoonSteps = SHANGHAI_ONBOARDING_PANORAMA.webtoonSteps;
  const activeWebtoonStep = webtoonSteps[webtoonStepIndex] ?? webtoonSteps[0];
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
  const activeInterludeLines = activeWebtoonStep?.afterTongLines ?? [];
  const activeInterludeLine = activeInterludeLines[Math.min(webtoonInterludeLineIndex, activeInterludeLines.length - 1)];

  const hud = (
    <GameHUD
      xp={0}
      sp={0}
      rp={10}
      cityId="shanghai"
      explainLang="en"
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
      setPostExerciseIndex(0);
      setWebtoonStepIndex(0);
      setWebtoonInterludeLineIndex(0);
      setWebtoonInterludeExerciseIndex(0);
      setTongVisible(!startInWebtoon);
      setCurrentExercise(null);
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
      setPostExerciseIndex(parsed.postExerciseIndex ?? 0);
      const restoredWebtoonStepIndex = parsed.webtoonStepIndex ?? 0;
      const restoredInterludeLineIndex = parsed.webtoonInterludeLineIndex ?? 0;
      const restoredInterludeExerciseIndex = parsed.webtoonInterludeExerciseIndex ?? 0;
      setWebtoonStepIndex(restoredWebtoonStepIndex);
      setWebtoonInterludeLineIndex(restoredInterludeLineIndex);
      setWebtoonInterludeExerciseIndex(restoredInterludeExerciseIndex);
      setPan(typeof parsed.pan === 'number' ? parsed.pan : SHANGHAI_ONBOARDING_PANORAMA.presentation.initialFocus);
      setWebtoonComplete(parsed.webtoonComplete ?? parsed.phase === 'complete');
      setTongVisible(parsed.phase === 'panorama' && (parsed.setupStep === 'intro' || parsed.setupStep === 'post-exercise'));
      const restoredWebtoonStep = SHANGHAI_ONBOARDING_PANORAMA.webtoonSteps[restoredWebtoonStepIndex];
      const interludeLinesDone = restoredInterludeLineIndex >= (restoredWebtoonStep?.afterTongLines?.length ?? 0);
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
  }, [focus, shouldReset]);

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
    if (setupStep === 'intro' && introIndex < SHANGHAI_ONBOARDING_PANORAMA.introTongLines.length - 1) {
      setIntroIndex((current) => current + 1);
      return;
    }
    if (setupStep === 'intro') {
      setTongVisible(false);
      setSetupStep('prelisten-exercise');
      setPreListeningIndex(0);
      setCurrentExercise(SHANGHAI_ONBOARDING_PANORAMA.preListeningExercises[0] ?? null);
      writeCheckpoint({ phase: 'panorama', setupStep: 'prelisten-exercise', introIndex, preListeningIndex: 0, pan });
      return;
    }

    if (setupStep === 'post-exercise' && postExerciseIndex < SHANGHAI_ONBOARDING_PANORAMA.postExerciseTongLines.length - 1) {
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
  }, [introIndex, pan, postExerciseIndex, setupStep, writeCheckpoint]);

  const finishOnboarding = useCallback(() => {
    if (webtoonComplete || phase === 'complete') return;
    setWebtoonComplete(true);
    setPhase('complete');
    setCurrentExercise(null);
    dispatch({ type: 'ADD_XP', amount: 80 });
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
    const lines = activeWebtoonStep?.afterTongLines ?? [];
    const exercises = activeWebtoonStep?.afterExercises ?? [];
    const lineIndex = lines.length > 0 ? 0 : lines.length;
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
  }, [activeWebtoonStep, introIndex, pan, postExerciseIndex, webtoonStepIndex, writeCheckpoint]);

  const completeWebtoonSegment = useCallback(() => {
    const hasInterlude = Boolean(
      activeWebtoonStep?.afterTongLines?.length
      || activeWebtoonStep?.afterExercises?.length,
    );
    if (hasInterlude) {
      startWebtoonInterlude();
      return;
    }
    advanceToNextWebtoonStep();
  }, [activeWebtoonStep, advanceToNextWebtoonStep, startWebtoonInterlude]);

  const handleInterludeContinue = useCallback(() => {
    const lines = activeWebtoonStep?.afterTongLines ?? [];
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

    const practicedItems = preListeningIndex === 0
      ? ['方案', '看过了', '想法', '不一样']
      : ['方案'];
    for (const itemId of practicedItems) {
      dispatch({ type: 'RECORD_ITEM_RESULT', itemId, category: 'vocabulary', correct });
    }

    const nextPreListeningIndex = preListeningIndex + 1;
    const nextExercise = SHANGHAI_ONBOARDING_PANORAMA.preListeningExercises[nextPreListeningIndex];
    if (nextExercise) {
      setPreListeningIndex(nextPreListeningIndex);
      setCurrentExercise(nextExercise);
      writeCheckpoint({
        phase: 'panorama',
        setupStep: 'prelisten-exercise',
        introIndex,
        preListeningIndex: nextPreListeningIndex,
        postExerciseIndex,
        pan,
      });
      return;
    }

    setCurrentExercise(null);
    setSetupStep('post-exercise');
    setPostExerciseIndex(0);
    setTongVisible(true);
    writeCheckpoint({ phase: 'panorama', setupStep: 'post-exercise', introIndex, preListeningIndex, postExerciseIndex: 0, pan });
  }, [
    activeWebtoonStep,
    advanceToNextWebtoonStep,
    introIndex,
    pan,
    phase,
    postExerciseIndex,
    preListeningIndex,
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
    setWebtoonComplete(false);
    writeCheckpoint({ phase: 'webtoon', setupStep: 'pan', introIndex, postExerciseIndex, webtoonStepIndex: 0, pan });
  }, [introIndex, pan, panUnlocked, phase, postExerciseIndex, writeCheckpoint]);

  const worldStyle: CSSProperties = {
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    transform: `translate3d(${-pan * metrics.maxOffsetX}px, ${metrics.y}px, 0)`,
  };

  if (phase === 'webtoon' && fixture) {
    return (
      <main className="scene-root">
        <div className="game-frame">
          {hud}
          <div className="shanghai-onboarding shanghai-onboarding--webtoon">
            <WebtoonStrip
              key={activeWebtoonStep?.id ?? `webtoon-step-${webtoonStepIndex}`}
              panels={activeWebtoonPanels}
              theme={webtoonStepIndex >= 2 ? 'dark' : 'warm'}
              showHelp={false}
              scrollRoot="self"
              onComplete={completeWebtoonSegment}
            />
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'webtoon-interlude') {
    return (
      <main className="scene-root">
        <div className="game-frame">
          <div className="shanghai-onboarding shanghai-onboarding--complete">
            {hud}
            <img className="shanghai-onboarding__complete-bg" src={SHANGHAI_ONBOARDING_PANORAMA.posterUrl} alt="" />
            <div className="shanghai-onboarding__scrim" aria-hidden="true" />
            {activeInterludeLine && !currentExercise && (
              <DialogueBox
                speakerName="Tong"
                speakerColor="var(--color-accent-gold)"
                content={activeInterludeLine}
                targetLang="zh"
                interactiveText={false}
                continueLabel="Continue"
                onContinue={handleInterludeContinue}
              />
            )}
            {currentExercise && (
              <ExerciseModal
                exercise={currentExercise}
                onResult={handleExerciseResult}
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
        <div className="game-frame">
          <div className="shanghai-onboarding shanghai-onboarding--complete">
            {hud}
            <img className="shanghai-onboarding__complete-bg" src={SHANGHAI_ONBOARDING_PANORAMA.posterUrl} alt="" />
            <div className="shanghai-onboarding__scrim" aria-hidden="true" />
            <DialogueBox
              speakerName="Tong"
              speakerColor="var(--color-accent-gold)"
              content={SHANGHAI_ONBOARDING_PANORAMA.completionTongLine}
              targetLang="zh"
              interactiveText={false}
              continueLabel="Exit"
              onContinue={() => router.push('/game?phase=city_map&city=shanghai')}
            />
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
            message={introLine}
            visible={tongVisible}
            targetLang="zh"
            speakerName="Tong"
            interactiveText={false}
            onDismiss={dismissTong}
          />

          {panUnlocked && (
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{ padding: '20px 20px calc(20px + var(--safe-bottom, 0px))' }}
            >
              <div className="scene-continue-label animate-pulse">
                {SHANGHAI_ONBOARDING_PANORAMA.panPrompt}
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

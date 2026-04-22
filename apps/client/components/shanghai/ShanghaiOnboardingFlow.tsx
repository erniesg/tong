'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExerciseModal } from '@/components/learn/ExerciseModal';
import { WebtoonBubble } from '@/components/scene/WebtoonBubble';
import {
  SHANGHAI_ONBOARDING_BRIEFING,
  SHANGHAI_ONBOARDING_HOTSPOTS,
  SHANGHAI_ONBOARDING_PANORAMA,
  SHANGHAI_ONBOARDING_WEBTOON,
  buildShanghaiOnboardingExercises,
  type ShanghaiOnboardingHotspotId,
} from '@/lib/content/shanghai/onboarding-flow';
import type { ExerciseData } from '@/lib/types/hangout';
import { resolveRuntimeAssetUrl } from '@/lib/runtime-assets';
import { dispatch, useGameState } from '@/lib/store/game-store';
import styles from './ShanghaiOnboardingFlow.module.css';

const ONBOARDING_SCENE_ID = 'shanghai:h1';
const HANGOUT_SCENE_ID = 'shanghai/h1-negotiation';
const RETURN_FALLBACK = '/game?phase=city_map&city=shanghai';
const ONBOARDING_PROGRESS_PREFIX = 'tong:shanghai:onboarding:progress';
const XP_REWARD = 60;

const TONG_PORTRAITS: Record<string, string> = {
  neutral: '/assets/characters/tong/tong_neutral.png',
  thinking: '/assets/characters/tong/tong_thinking.png',
  amazed: '/assets/characters/tong/tong_amazed.png',
  proud: '/assets/characters/tong/tong_proud.png',
};

type OnboardingStage = 'briefing' | 'panorama' | 'webtoon' | 'complete';

interface OnboardingProgressSnapshot {
  stage: OnboardingStage;
  briefingIndex: number;
  completedExerciseIds: string[];
  selectedFocus: ShanghaiOnboardingHotspotId | null;
  webtoonFinished: boolean;
}

function widthClass(widthType: string) {
  switch (widthType) {
    case 'full-bleed':
      return styles.webtoonFullBleed;
    case 'inset-wide':
      return styles.webtoonInsetWide;
    case 'inset-narrow':
      return styles.webtoonInsetNarrow;
    case 'floating':
      return styles.webtoonFloating;
    default:
      return styles.webtoonFullWidth;
  }
}

function progressStorageKey(qaRunId: string | null) {
  return `${ONBOARDING_PROGRESS_PREFIX}:${qaRunId || 'default'}`;
}

function clampBriefingIndex(value: number) {
  return Math.max(0, Math.min(value, SHANGHAI_ONBOARDING_BRIEFING.length - 1));
}

function readProgressSnapshot(key: string): OnboardingProgressSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<OnboardingProgressSnapshot>;
    const stage = parsed.stage;
    const validStage = stage === 'briefing' || stage === 'panorama' || stage === 'webtoon' || stage === 'complete'
      ? stage
      : 'briefing';
    const selectedFocus = parsed.selectedFocus === 'shoucheng' || parsed.selectedFocus === 'dingman'
      ? parsed.selectedFocus
      : null;

    return {
      stage: validStage,
      briefingIndex: clampBriefingIndex(Number(parsed.briefingIndex) || 0),
      completedExerciseIds: Array.isArray(parsed.completedExerciseIds)
        ? parsed.completedExerciseIds.filter((id): id is string => typeof id === 'string')
        : [],
      selectedFocus,
      webtoonFinished: Boolean(parsed.webtoonFinished),
    };
  } catch {
    return null;
  }
}

export function ShanghaiOnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameState = useGameState();
  const returnHref = searchParams.get('return') || RETURN_FALLBACK;
  const qaRunId = searchParams.get('qa_run_id');
  const freshStart = searchParams.get('fresh') === '1';
  const progressKey = progressStorageKey(qaRunId);
  const alreadyCompleted = gameState.onboardingStatus[ONBOARDING_SCENE_ID] === 'completed';
  const storedSeat = gameState.hangoutSeat[HANGOUT_SCENE_ID] ?? null;

  const [stage, setStage] = useState<OnboardingStage>('briefing');
  const [briefingIndex, setBriefingIndex] = useState(0);
  const [activeExercise, setActiveExercise] = useState<ExerciseData | null>(null);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<string[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<ShanghaiOnboardingHotspotId | null>(null);
  const [webtoonFinished, setWebtoonFinished] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [hydratedProgress, setHydratedProgress] = useState(false);

  const hydrationSignatureRef = useRef<string | null>(null);
  const exerciseQueue = useMemo(() => buildShanghaiOnboardingExercises(), []);
  const beat = SHANGHAI_ONBOARDING_BRIEFING[briefingIndex] ?? SHANGHAI_ONBOARDING_BRIEFING[SHANGHAI_ONBOARDING_BRIEFING.length - 1];
  const heroVideoUrl = resolveRuntimeAssetUrl(SHANGHAI_ONBOARDING_PANORAMA.videoUrl);
  const heroPosterUrl = resolveRuntimeAssetUrl(SHANGHAI_ONBOARDING_PANORAMA.posterUrl);
  const heroMediaStyle = useMemo(
    () => ({ objectPosition: `${Math.round(SHANGHAI_ONBOARDING_PANORAMA.introFocus * 100)}% center` }),
    [],
  );
  const replayHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('entry', 'panorama');
    params.set('fresh', '1');
    return `/onboarding/shanghai?${params.toString()}`;
  }, [searchParams]);
  const hydrationSignature = `${progressKey}:${freshStart ? 'fresh' : 'resume'}`;

  useEffect(() => {
    if (hydrationSignatureRef.current === hydrationSignature) return;
    hydrationSignatureRef.current = hydrationSignature;

    setStage('briefing');
    setBriefingIndex(0);
    setActiveExercise(null);
    setCompletedExerciseIds([]);
    setSelectedFocus(null);
    setWebtoonFinished(false);

    if (typeof window === 'undefined') {
      setHydratedProgress(true);
      return;
    }

    if (freshStart) {
      window.sessionStorage.removeItem(progressKey);
    }

    const saved = freshStart ? null : readProgressSnapshot(progressKey);

    if (saved) {
      setStage(saved.stage);
      setBriefingIndex(saved.briefingIndex);
      setCompletedExerciseIds(saved.completedExerciseIds);
      setSelectedFocus(saved.selectedFocus);
      setWebtoonFinished(saved.webtoonFinished || saved.stage === 'complete');
    } else if (alreadyCompleted) {
      setStage('complete');
      setSelectedFocus(storedSeat);
      setWebtoonFinished(true);
    }

    setHydratedProgress(true);
  }, [alreadyCompleted, freshStart, hydrationSignature, progressKey, storedSeat]);

  useEffect(() => {
    if (!hydratedProgress || typeof window === 'undefined') return;
    if (hydrationSignatureRef.current !== hydrationSignature) return;

    const snapshot: OnboardingProgressSnapshot = {
      stage,
      briefingIndex,
      completedExerciseIds,
      selectedFocus,
      webtoonFinished,
    };

    window.sessionStorage.setItem(progressKey, JSON.stringify(snapshot));
  }, [briefingIndex, completedExerciseIds, hydratedProgress, hydrationSignature, progressKey, selectedFocus, stage, webtoonFinished]);

  useEffect(() => {
    if (!hydratedProgress || alreadyCompleted) return;
    dispatch({ type: 'SET_ONBOARDING_STATUS', sceneId: ONBOARDING_SCENE_ID, status: 'started' });
  }, [alreadyCompleted, hydratedProgress]);

  const openExercise = useCallback(() => {
    const nextExercise = exerciseQueue[Math.min(briefingIndex, exerciseQueue.length - 1)];
    if (nextExercise) {
      setActiveExercise(nextExercise);
      return;
    }
    setStage('panorama');
  }, [briefingIndex, exerciseQueue]);

  const handleExerciseResult = useCallback((exerciseId: string) => {
    setCompletedExerciseIds((current) => current.includes(exerciseId) ? current : [...current, exerciseId]);
    setActiveExercise(null);
    setBriefingIndex((current) => clampBriefingIndex(current + 1));
  }, []);

  const handleContinueFromBriefing = useCallback(() => {
    if (briefingIndex < exerciseQueue.length) {
      openExercise();
      return;
    }
    setStage('panorama');
  }, [briefingIndex, exerciseQueue.length, openExercise]);

  const handleHotspot = useCallback((hotspotId: ShanghaiOnboardingHotspotId) => {
    setSelectedFocus(hotspotId);
    dispatch({ type: 'SET_HANGOUT_SEAT', sceneId: HANGOUT_SCENE_ID, seat: hotspotId });
    setStage('webtoon');
  }, []);

  const handleFinishOnboarding = useCallback(() => {
    const seat = selectedFocus ?? storedSeat ?? 'dingman';

    dispatch({ type: 'SET_HANGOUT_SEAT', sceneId: HANGOUT_SCENE_ID, seat });
    dispatch({ type: 'SET_ONBOARDING_STATUS', sceneId: ONBOARDING_SCENE_ID, status: 'completed' });

    if (!alreadyCompleted) {
      dispatch({ type: 'ADD_XP', amount: XP_REWARD });
      dispatch({ type: 'UPDATE_AFFINITY', characterId: 'fangayi', delta: 3 });
      dispatch({ type: 'INCREMENT_LOCATION_HANGOUT', cityId: 'shanghai', locationId: 'dumpling_shop' });
    }

    setSelectedFocus(seat);
    setWebtoonFinished(true);
    setStage('complete');
  }, [alreadyCompleted, selectedFocus, storedSeat]);

  if (!hydratedProgress) {
    return <main className={styles.shell} />;
  }

  const seatLabel = (selectedFocus ?? storedSeat) === 'shoucheng' ? '守成 side' : '丁漫 side';

  return (
    <main className={styles.shell}>
      {stage === 'briefing' ? (
        <section className={styles.briefing}>
          {!videoFailed ? (
            <video
              className={styles.heroVideo}
              style={heroMediaStyle}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={heroPosterUrl}
              onError={() => setVideoFailed(true)}
            >
              <source src={heroVideoUrl} />
            </video>
          ) : null}
          {videoFailed ? (
            <img
              className={styles.heroPoster}
              style={heroMediaStyle}
              src={heroPosterUrl}
              alt=""
            />
          ) : null}
          <div className={styles.heroWash} />
          <div className={styles.briefingContent}>
            <div className={styles.briefingCopy}>
              <p className={styles.eyebrow}>{beat.eyebrow}</p>
              <h1 className={styles.title}>{beat.title}</h1>
              <p className={styles.body}>{beat.body}</p>
              <p className={styles.kicker}>{beat.kicker}</p>

              <div className={styles.progressPills}>
                {SHANGHAI_ONBOARDING_BRIEFING.map((entry, index) => (
                  <span
                    key={entry.id}
                    className={`${styles.progressPill}${index === briefingIndex ? ` ${styles.progressPillActive}` : ''}`}
                  >
                    {index < exerciseQueue.length ? `Check ${index + 1}` : 'Look around'}
                  </span>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={handleContinueFromBriefing}>
                  {briefingIndex < exerciseQueue.length ? 'Run the next quick check' : 'Open the room'}
                </button>
                <button type="button" className={styles.ghostButton} onClick={() => router.push(returnHref)}>
                  Return to map
                </button>
              </div>
            </div>

            <aside className={styles.tongRail}>
              <img className={styles.tongPortrait} src={TONG_PORTRAITS[beat.expression]} alt="Tong" />
              <p className={styles.tongName}>Tong Companion Feed</p>
              <p className={styles.tongQuote}>
                {briefingIndex < exerciseQueue.length
                  ? 'Quick ears first. Then eyes.'
                  : 'Good. Now pan left and pick the table that breaks the room.'}
              </p>
              <p className={styles.tongMeta}>
                {gameState.playerProfile.englishName
                  ? `I’m cueing this for ${gameState.playerProfile.englishName}.`
                  : 'I’m cueing this for you.'} Shanghai onboarding now enters through the shop itself, so you learn the room before you inherit the negotiation.
              </p>
            </aside>
          </div>
        </section>
      ) : null}

      {stage === 'panorama' ? (
        <PanoramaStage
          selectedFocus={selectedFocus}
          onHotspot={handleHotspot}
          onBack={() => setStage('briefing')}
          panoramaVideoUrl={heroVideoUrl}
          panoramaPosterUrl={heroPosterUrl}
          videoFailed={videoFailed}
          onVideoError={() => setVideoFailed(true)}
        />
      ) : null}

      {stage === 'webtoon' ? (
        <WebtoonStripStage
          selectedFocus={selectedFocus ?? storedSeat}
          webtoonFinished={webtoonFinished}
          onFinished={() => setWebtoonFinished(true)}
          onBack={() => setStage('panorama')}
          onComplete={handleFinishOnboarding}
        />
      ) : null}

      {stage === 'complete' ? (
        <section className={styles.completeStage}>
          <div className={styles.completeCard}>
            <p className={styles.eyebrow}>Tong Holds The Landing</p>
            <h2>Return to the world map. The dumpling shop is in your ear now.</h2>
            <p>
              You entered through the room, chose the {seatLabel}, and stayed long enough to hear 方阿姨 say the line that changes the scene. Next time Shanghai goes quiet first, pay attention before anyone explains themselves.
            </p>
            <div className={styles.rewardStrip}>
              <div className={styles.rewardStat}>
                <span className={styles.rewardLabel}>XP</span>
                <span className={styles.rewardValue}>+{alreadyCompleted ? 0 : XP_REWARD}</span>
              </div>
              <div className={styles.rewardStat}>
                <span className={styles.rewardLabel}>Seat State</span>
                <span className={styles.rewardValue}>{seatLabel}</span>
              </div>
              <div className={styles.rewardStat}>
                <span className={styles.rewardLabel}>Shop Words</span>
                <span className={styles.rewardValue}>小笼包 · 阿姨</span>
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={() => router.push(returnHref)}>
                Return to world map
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => router.push(replayHref)}>
                Replay onboarding
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activeExercise ? (
        <ExerciseModal
          exercise={activeExercise}
          onResult={(exerciseId) => handleExerciseResult(exerciseId)}
        />
      ) : null}
    </main>
  );
}

function PanoramaStage({
  selectedFocus,
  onHotspot,
  onBack,
  panoramaVideoUrl,
  panoramaPosterUrl,
  videoFailed,
  onVideoError,
}: {
  selectedFocus: ShanghaiOnboardingHotspotId | null;
  onHotspot: (hotspotId: ShanghaiOnboardingHotspotId) => void;
  onBack: () => void;
  panoramaVideoUrl: string;
  panoramaPosterUrl: string;
  videoFailed: boolean;
  onVideoError: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; originX: number; moved: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [panX, setPanX] = useState(0);
  const [hasManualPan, setHasManualPan] = useState(false);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewportWidth(entry.contentRect.width);
      setViewportHeight(entry.contentRect.height);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const trackWidth = Math.max(
    viewportWidth,
    Math.round(viewportHeight * SHANGHAI_ONBOARDING_PANORAMA.authoredAspect),
  );
  const minPan = Math.min(0, viewportWidth - trackWidth);

  useEffect(() => {
    if (!hasManualPan) {
      setPanX(Math.round(minPan * SHANGHAI_ONBOARDING_PANORAMA.introFocus));
      return;
    }
    setPanX((current) => Math.max(minPan, Math.min(0, current)));
  }, [hasManualPan, minPan]);

  const activeHotspot = selectedFocus
    ? SHANGHAI_ONBOARDING_HOTSPOTS.find((hotspot) => hotspot.id === selectedFocus) ?? null
    : null;

  return (
    <section className={styles.panoramaStage}>
      <div className={styles.stageHeader}>
        <div className={styles.stageTitleWrap}>
          <p className={styles.stageTitle}>Look Around</p>
          <p className={styles.stageSubtitle}>{SHANGHAI_ONBOARDING_PANORAMA.subtitle}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={onBack}>Back</button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={styles.panoramaViewport}
        onPointerDown={(event) => {
          dragRef.current = { startX: event.clientX, originX: panX, moved: 0 };
          (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const delta = event.clientX - drag.startX;
          drag.moved = Math.max(drag.moved, Math.abs(delta));
          setHasManualPan(true);
          setPanX(Math.max(minPan, Math.min(0, drag.originX + delta)));
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onWheel={(event) => {
          if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            setHasManualPan(true);
            setPanX((current) => Math.max(minPan, Math.min(0, current - event.deltaY)));
          }
        }}
      >
        <div
          className={styles.panoramaTrack}
          style={{ width: `${trackWidth}px`, transform: `translate3d(${panX}px, 0, 0)` }}
        >
          {!videoFailed ? (
            <video
              className={styles.panoramaImage}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={panoramaPosterUrl}
              onError={onVideoError}
            >
              <source src={panoramaVideoUrl} />
            </video>
          ) : (
            <img className={styles.panoramaImage} src={panoramaPosterUrl} alt="" draggable={false} />
          )}

          {SHANGHAI_ONBOARDING_HOTSPOTS.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              className={`${styles.hotspot}${selectedFocus === hotspot.id ? ` ${styles.hotspotSeen}` : ''}`}
              style={{
                left: `${hotspot.x * 100}%`,
                top: `${hotspot.y * 100}%`,
                width: `${hotspot.width * 100}%`,
                height: `${hotspot.height * 100}%`,
              }}
              onClick={(event) => {
                event.stopPropagation();
                onHotspot(hotspot.id);
              }}
            >
              {hotspot.label}
            </button>
          ))}
          <div className={styles.panoramaOverlay} />
        </div>

        <div className={styles.panoramaPanel}>
          <div className={styles.panoramaCopy}>
            <p className={styles.eyebrow}>{activeHotspot ? `Following ${activeHotspot.label}` : 'Tong Prompt'}</p>
            <h2>
              {activeHotspot
                ? activeHotspot.headline
                : 'Pan left until one table stops feeling like background.'}
            </h2>
            <p>
              {activeHotspot
                ? activeHotspot.detail
                : 'You start on the quiet side of the shop for a reason. Drag left, find 丁漫 and 守成, then tap the person whose side of the scene you want to carry into the eavesdrop.'}
            </p>
            <p>
              {activeHotspot
                ? activeHotspot.tongLine
                : 'Tong has already done the scene-setting. The click is the handoff.'}
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onBack}>Back to Tong intro</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WebtoonStripStage({
  selectedFocus,
  webtoonFinished,
  onFinished,
  onBack,
  onComplete,
}: {
  selectedFocus: ShanghaiOnboardingHotspotId | null;
  webtoonFinished: boolean;
  onFinished: () => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  const finalPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = finalPanelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onFinished();
        }
      },
      { threshold: 0.55 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onFinished]);

  return (
    <section className={styles.webtoonStage}>
      <div className={styles.stageHeader}>
        <div className={styles.stageTitleWrap}>
          <p className={styles.stageTitle}>Eavesdrop</p>
          <p className={styles.stageSubtitle}>Scroll until 方阿姨 says the line that reframes the whole lunch.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={onBack}>Back to panorama</button>
          <button type="button" className={styles.primaryButton} disabled={!webtoonFinished} onClick={onComplete}>
            Tong wraps it up
          </button>
        </div>
      </div>

      <div className={styles.webtoonIntro}>
        <p className={styles.eyebrow}>{selectedFocus === 'shoucheng' ? '守成 side' : '丁漫 side'}</p>
        <h1 className={styles.title}>Scroll through the negotiation until the cliffhanger lands.</h1>
      </div>

      <div className={styles.webtoonPanels}>
        {SHANGHAI_ONBOARDING_WEBTOON.map((panel, index) => {
          const isFinal = index === SHANGHAI_ONBOARDING_WEBTOON.length - 1;
          return (
            <section
              key={panel.id}
              ref={isFinal ? finalPanelRef : undefined}
              className={styles.webtoonPanelWrap}
            >
              <div className={styles.webtoonPanelGap} style={{ height: `${panel.gapBefore.px}px`, background: panel.gapBefore.color }} />
              <figure className={`${styles.webtoonPanelFigure} ${widthClass(panel.widthType)}`}>
                <img className={styles.webtoonPanelImage} src={panel.imageUrl} alt={panel.shotType} />
                {panel.bubble ? <WebtoonBubble {...panel.bubble} visible /> : null}
              </figure>
            </section>
          );
        })}
      </div>

      <div className={styles.webtoonFooter}>
        <p className={styles.eyebrow}>{webtoonFinished ? 'Tong has the exit.' : 'Keep scrolling.'}</p>
        <h2>{webtoonFinished ? 'You have the reveal. Let Tong close the loop.' : 'The last reveal panel is still below.'}</h2>
        <p>
          {webtoonFinished
            ? 'Once you hand this back to Tong, the onboarding closes and you return to the world map with the shop context, the seat state, and the cliffhanger intact.'
            : 'The scroll is the eavesdrop. Do not stop until 方阿姨 names what the room knew before you did.'}
        </p>
      </div>
    </section>
  );
}

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
import { dispatch, useGameState } from '@/lib/store/game-store';
import { runtimeAssetUrl } from '@/lib/runtime-assets';
import styles from './ShanghaiOnboardingFlow.module.css';

const ONBOARDING_SCENE_ID = 'shanghai:h1';
const RETURN_FALLBACK = '/game?phase=city_map&city=shanghai&openAuction=1';
const AUCTION_STARTER_SP = 160;

const TONG_PORTRAITS: Record<string, string> = {
  neutral: '/assets/characters/tong/tong_neutral.png',
  thinking: '/assets/characters/tong/tong_thinking.png',
  amazed: '/assets/characters/tong/tong_amazed.png',
  proud: '/assets/characters/tong/tong_proud.png',
};

const HERO_VIDEO = runtimeAssetUrl('city.shanghai.map.video.default', SHANGHAI_ONBOARDING_PANORAMA.imageUrl);

type OnboardingStage = 'briefing' | 'panorama' | 'webtoon' | 'complete';

function formatCountdown(iso: string) {
  const remaining = Math.max(0, new Date(iso).getTime() - Date.now());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

export function ShanghaiOnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameState = useGameState();
  const returnHref = searchParams.get('return') || RETURN_FALLBACK;
  const alreadyCompleted = gameState.onboardingStatus[ONBOARDING_SCENE_ID] === 'completed';
  const [stage, setStage] = useState<OnboardingStage>('briefing');
  const [briefingIndex, setBriefingIndex] = useState(0);
  const [activeExercise, setActiveExercise] = useState<ExerciseData | null>(null);
  const [seenHotspots, setSeenHotspots] = useState<Record<string, true>>({});
  const [selectedFocus, setSelectedFocus] = useState<ShanghaiOnboardingHotspotId | null>(null);
  const [webtoonFinished, setWebtoonFinished] = useState(false);
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);
  const [auctionOpensAt, setAuctionOpensAt] = useState<string | null>(null);
  const exerciseQueue = useMemo(() => buildShanghaiOnboardingExercises(), []);
  const beat = SHANGHAI_ONBOARDING_BRIEFING[briefingIndex] ?? SHANGHAI_ONBOARDING_BRIEFING[SHANGHAI_ONBOARDING_BRIEFING.length - 1];

  useEffect(() => {
    if (!alreadyCompleted) {
      dispatch({ type: 'SET_ONBOARDING_STATUS', sceneId: ONBOARDING_SCENE_ID, status: 'started' });
    }
  }, [alreadyCompleted]);

  const openExercise = useCallback(() => {
    const nextExercise = exerciseQueue[Math.min(briefingIndex, exerciseQueue.length - 1)];
    if (nextExercise) {
      setActiveExercise(nextExercise);
    } else {
      setStage('panorama');
    }
  }, [briefingIndex, exerciseQueue]);

  const handleExerciseResult = useCallback((exerciseId: string) => {
    setActiveExercise(null);
    setBriefingIndex((current) => Math.min(current + 1, SHANGHAI_ONBOARDING_BRIEFING.length - 1));
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
    setSeenHotspots((current) => ({ ...current, [hotspotId]: true }));
  }, []);

  const handleFinishOnboarding = useCallback(async () => {
    dispatch({ type: 'SET_HANGOUT_SEAT', sceneId: 'shanghai/h1-negotiation', seat: selectedFocus ?? 'dingman' });
    dispatch({ type: 'SET_ONBOARDING_STATUS', sceneId: ONBOARDING_SCENE_ID, status: 'completed' });

    if (!alreadyCompleted) {
      dispatch({ type: 'ADD_XP', amount: 60 });
      dispatch({ type: 'ADD_SP', amount: AUCTION_STARTER_SP });
      dispatch({ type: 'UPDATE_AFFINITY', characterId: 'fangayi', delta: 3 });
      dispatch({ type: 'INCREMENT_LOCATION_HANGOUT', cityId: 'shanghai', locationId: 'dumpling_shop' });
    }

    try {
      const response = await fetch('/api/live-auction/state', { cache: 'no-store' });
      if (response.ok) {
        const snapshot = await response.json() as { nextTransitionAtIso?: string };
        if (snapshot.nextTransitionAtIso) {
          setAuctionOpensAt(snapshot.nextTransitionAtIso);
        }
      }
    } catch {
      // ignore network bootstrapping errors in demo mode
    }

    setStage('complete');
  }, [alreadyCompleted, selectedFocus]);

  const seenCount = Object.keys(seenHotspots).length;

  return (
    <main className={styles.shell}>
      {stage === 'briefing' ? (
        <section className={styles.briefing}>
          {!heroVideoFailed ? (
            <video
              className={styles.heroVideo}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setHeroVideoFailed(true)}
            >
              <source src={HERO_VIDEO} />
            </video>
          ) : null}
          <img
            className={styles.heroPoster}
            src={SHANGHAI_ONBOARDING_PANORAMA.imageUrl}
            alt=""
          />
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
                    {index < exerciseQueue.length ? `Check ${index + 1}` : 'Scan'}
                  </span>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.primaryButton} onClick={handleContinueFromBriefing}>
                  {briefingIndex < exerciseQueue.length ? 'Run the next quick check' : 'Pan across the room'}
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
                  : 'Now tag both leads. Do not lose the thread.'}
              </p>
              <p className={styles.tongMeta}>
                {gameState.playerProfile.englishName
                  ? `I’m cueing this for ${gameState.playerProfile.englishName}.`
                  : 'I’m cueing this for you.'} Shanghai onboarding is now a real handoff into the live room, so I am front-loading the useful context instead of dropping you cold.
              </p>
            </aside>
          </div>
        </section>
      ) : null}

      {stage === 'panorama' ? (
        <PanoramaStage
          seenCount={seenCount}
          seenHotspots={seenHotspots}
          selectedFocus={selectedFocus}
          onHotspot={handleHotspot}
          onAdvance={() => setStage('webtoon')}
          onBack={() => setStage('briefing')}
        />
      ) : null}

      {stage === 'webtoon' ? (
        <WebtoonStripStage
          webtoonFinished={webtoonFinished}
          onFinished={() => setWebtoonFinished(true)}
          onBack={() => setStage('panorama')}
          onComplete={handleFinishOnboarding}
        />
      ) : null}

      {stage === 'complete' ? (
        <section className={styles.completeStage}>
          <div className={styles.completeCard}>
            <p className={styles.eyebrow}>Shanghai H1 Complete</p>
            <h2>Return to the map. The live auction countdown is waiting.</h2>
            <p>
              Tong has staged the next handoff. You now have enough context to enter the rooftop room, watch the countdown flip, and start bidding with a usable SP stack.
            </p>
            <div className={styles.rewardStrip}>
              <div className={styles.rewardStat}>
                <span className={styles.rewardLabel}>Starter SP</span>
                <span className={styles.rewardValue}>+{alreadyCompleted ? 0 : AUCTION_STARTER_SP}</span>
              </div>
              <div className={styles.rewardStat}>
                <span className={styles.rewardLabel}>Seat State</span>
                <span className={styles.rewardValue}>{selectedFocus === 'shoucheng' ? '守成 side' : '丁漫 side'}</span>
              </div>
              <div className={styles.rewardStat}>
                <span className={styles.rewardLabel}>Auction Opens</span>
                <span className={styles.rewardValue}>{auctionOpensAt ? formatCountdown(auctionOpensAt) : 'soon'}</span>
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={() => router.push(returnHref)}>
                Return to world map
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
  seenCount,
  seenHotspots,
  selectedFocus,
  onHotspot,
  onAdvance,
  onBack,
}: {
  seenCount: number;
  seenHotspots: Record<string, true>;
  selectedFocus: ShanghaiOnboardingHotspotId | null;
  onHotspot: (hotspotId: ShanghaiOnboardingHotspotId) => void;
  onAdvance: () => void;
  onBack: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; originX: number; moved: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [panX, setPanX] = useState(0);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewportWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const trackWidth = Math.max(viewportWidth * 1.82, viewportWidth + 320);
  const minPan = Math.min(0, viewportWidth - trackWidth);

  useEffect(() => {
    setPanX((current) => Math.max(minPan, Math.min(0, current)));
  }, [minPan]);

  return (
    <section className={styles.panoramaStage}>
      <div className={styles.stageHeader}>
        <div className={styles.stageTitleWrap}>
          <p className={styles.stageTitle}>Panorama Scan</p>
          <p className={styles.stageSubtitle}>{SHANGHAI_ONBOARDING_PANORAMA.subtitle}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={onBack}>Back</button>
          <button type="button" className={styles.primaryButton} disabled={seenCount < 2} onClick={onAdvance}>
            Launch the webtoon
          </button>
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
          setPanX(Math.max(minPan, Math.min(0, drag.originX + delta)));
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
        }}
        onWheel={(event) => {
          if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            setPanX((current) => Math.max(minPan, Math.min(0, current - event.deltaY)));
          }
        }}
      >
        <div
          className={styles.panoramaTrack}
          style={{ width: `${trackWidth}px`, transform: `translate3d(${panX}px, 0, 0)` }}
        >
          <video
            className={styles.panoramaImage}
            src={SHANGHAI_ONBOARDING_PANORAMA.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            poster={SHANGHAI_ONBOARDING_PANORAMA.imageUrl}
          />
          {SHANGHAI_ONBOARDING_HOTSPOTS.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              className={`${styles.hotspot}${selectedFocus === hotspot.id || seenHotspots[hotspot.id] ? ` ${styles.hotspotSeen}` : ''}`}
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
            <p className={styles.eyebrow}>Observed: {seenCount}/2</p>
            <h2>
              {selectedFocus
                ? SHANGHAI_ONBOARDING_HOTSPOTS.find((hotspot) => hotspot.id === selectedFocus)?.headline
                : 'Tag 守成 and 丁漫 once each.'}
            </h2>
            <p>
              {selectedFocus
                ? SHANGHAI_ONBOARDING_HOTSPOTS.find((hotspot) => hotspot.id === selectedFocus)?.detail
                : 'Drag horizontally or use a trackpad scroll. The hotspot state determines which side of the room you carry into H1.'}
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={onBack}>Reset briefing</button>
            <button type="button" className={styles.primaryButton} disabled={seenCount < 2} onClick={onAdvance}>
              Drop into negotiation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WebtoonStripStage({
  webtoonFinished,
  onFinished,
  onBack,
  onComplete,
}: {
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
          <p className={styles.stageTitle}>Negotiation Strip</p>
          <p className={styles.stageSubtitle}>Scroll all the way to 方阿姨’s reveal to finish the onboarding handoff.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={onBack}>Back to panorama</button>
          <button type="button" className={styles.primaryButton} disabled={!webtoonFinished} onClick={onComplete}>
            Tong wraps it up
          </button>
        </div>
      </div>

      <div className={styles.webtoonIntro}>
        <p className={styles.eyebrow}>Vertical Read</p>
        <h1 className={styles.title}>Scroll through the room until the cliffhanger lands.</h1>
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
        <p className={styles.eyebrow}>{webtoonFinished ? 'Tong has the landing.' : 'Keep scrolling.'}</p>
        <h2>{webtoonFinished ? 'You have the cliffhanger. Now take the handoff.' : 'The final reveal is still below.'}</h2>
        <p>
          {webtoonFinished
            ? 'Return to the map and the Shanghai live-auction countdown will already be running.'
            : 'Once the last reveal panel is visible, Tong will clear you to return to the world map.'}
        </p>
      </div>
    </section>
  );
}

'use client';

import { useRef, useCallback, useState, useEffect, useMemo, type PointerEvent } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';
import { fallbackRuntimeAssetCandidates } from '@/lib/runtime-assets';
import type { CinematicPresentation, CinematicWorldOverlayItem } from '@/lib/types/hangout';

const CAPTION_CHARS_PER_TICK = 2;
const CAPTION_TICK_MS = 35;

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  captionTranslation?: string;
  autoAdvance: boolean;
  muted?: boolean;
  presentation?: CinematicPresentation;
  targetLang?: TargetLang;
  onEnd: () => void;
}

interface Bounds {
  minX: number;
  maxX: number;
}

export function CinematicOverlay({
  videoUrl,
  caption,
  captionTranslation,
  autoAdvance,
  muted = false,
  presentation,
  targetLang = 'ko',
  onEnd,
}: CinematicOverlayProps) {
  const lang = useUILang();
  const viewportRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [mediaSize, setMediaSize] = useState({ width: presentation?.mediaWidth ?? 1, height: presentation?.mediaHeight ?? 1 });
  const [panX, setPanX] = useState(0);
  const panXRef = useRef(0);
  const panDraggedRef = useRef(false);
  const panDragRef = useRef<{ pointerId: number; startClientX: number; originPanX: number } | null>(null);
  const videoCandidates = useMemo(() => fallbackRuntimeAssetCandidates(videoUrl), [videoUrl]);
  const activeVideoUrl = videoCandidates[candidateIndex] ?? '';
  const mode = presentation?.mode ?? 'cover';
  const panoramaScale = useMemo(
    () => Math.max(viewportSize.width / Math.max(1, mediaSize.width), viewportSize.height / Math.max(1, mediaSize.height)),
    [mediaSize.height, mediaSize.width, viewportSize.height, viewportSize.width],
  );

  // Typewriter state for caption
  const [captionChars, setCaptionChars] = useState(0);
  const [captionTypewriterDone, setCaptionTypewriterDone] = useState(false);
  const captionTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const triggerEnd = useCallback(() => {
    if (fadingOut) return;
    setFadingOut(true);
    setTimeout(() => onEnd(), 500);
  }, [fadingOut, onEnd]);

  const handleEnded = useCallback(() => {
    if (autoAdvance) triggerEnd();
  }, [autoAdvance, triggerEnd]);

  const handleTap = useCallback(() => {
    if (!autoAdvance) triggerEnd();
  }, [autoAdvance, triggerEnd]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [videoUrl]);

  useEffect(() => {
    setMediaSize({
      width: presentation?.mediaWidth ?? 1,
      height: presentation?.mediaHeight ?? 1,
    });
  }, [presentation?.mediaHeight, presentation?.mediaWidth]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    const updateSize = () => {
      setViewportSize({
        width: viewportEl.clientWidth || 1,
        height: viewportEl.clientHeight || 1,
      });
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(viewportEl);
    return () => resizeObserver.disconnect();
  }, []);

  const getPanBounds = useCallback((): Bounds => {
    if (mode !== 'panorama') return { minX: 0, maxX: 0 };
    const renderedWidth = mediaSize.width * panoramaScale;
    const overflowX = Math.max(0, renderedWidth - viewportSize.width);
    return { minX: -overflowX, maxX: 0 };
  }, [mediaSize.width, mode, panoramaScale, viewportSize.width]);

  useEffect(() => {
    if (mode !== 'panorama') {
      panXRef.current = 0;
      setPanX(0);
      return;
    }
    const bounds = getPanBounds();
    const clamped = Math.max(bounds.minX, Math.min(bounds.maxX, panXRef.current));
    if (clamped !== panXRef.current) {
      panXRef.current = clamped;
      setPanX(clamped);
    }
  }, [getPanBounds, mode, viewportSize.height, viewportSize.width]);

  const updatePan = useCallback((nextPan: number) => {
    const bounds = getPanBounds();
    const clamped = Math.max(bounds.minX, Math.min(bounds.maxX, nextPan));
    panXRef.current = clamped;
    setPanX(clamped);
  }, [getPanBounds]);

  const handlePanPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (mode !== 'panorama') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panDraggedRef.current = false;
    panDragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, originPanX: panXRef.current };
  }, [mode]);

  const handlePanPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.startClientX) > 4) panDraggedRef.current = true;
    updatePan(drag.originPanX + (event.clientX - drag.startClientX));
  }, [updatePan]);

  const handlePanPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      panDragRef.current = null;
    }
  }, []);

  const mediaTransformStyle = mode === 'panorama'
    ? {
      transform: `translate3d(${panX}px, 0, 0) scale(${panoramaScale})`,
      transformOrigin: 'top left',
      transition: prefersReducedMotion ? 'none' : 'transform 180ms ease-out',
      width: `${Math.max(1, mediaSize.width)}px`,
      height: `${Math.max(1, mediaSize.height)}px`,
    }
    : undefined;

  const renderWorldOverlay = (overlay: CinematicWorldOverlayItem) => {
    const xPercent = Math.max(0, Math.min(100, (overlay.x / Math.max(1, mediaSize.width)) * 100));
    const yPercent = Math.max(0, Math.min(100, (overlay.y / Math.max(1, mediaSize.height)) * 100));
    return (
      <button
        key={overlay.id}
        type="button"
        className="cinematic-world-overlay-item"
        style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      >
        {overlay.label}
      </button>
    );
  };

  // Autoplay with unmute fallback + audio fade-in
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Start at zero volume for fade-in
    v.volume = 0;
    v.muted = muted;
    const playPromise = v.play();
    if (playPromise) {
      playPromise.catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
    }
    // Fade in audio over 800ms
    if (!muted) {
      let vol = 0;
      const fadeIn = setInterval(() => {
        vol = Math.min(1, vol + 0.05);
        v.volume = vol;
        if (vol >= 1) clearInterval(fadeIn);
      }, 40);
      return () => clearInterval(fadeIn);
    }
  }, [activeVideoUrl, muted]);

  // Fade out audio before video ends
  useEffect(() => {
    const v = videoRef.current;
    if (!v || muted) return;
    const handleTimeUpdate = () => {
      if (v.duration && v.currentTime > v.duration - 1.5) {
        const remaining = v.duration - v.currentTime;
        v.volume = Math.max(0, remaining / 1.5);
      }
    };
    v.addEventListener('timeupdate', handleTimeUpdate);
    return () => v.removeEventListener('timeupdate', handleTimeUpdate);
  }, [activeVideoUrl, muted]);

  // Fade in caption shortly after video starts playing, then start typewriter
  useEffect(() => {
    if (!caption) return;
    setCaptionVisible(false);
    setCaptionChars(0);
    setCaptionTypewriterDone(false);
    if (captionTimerRef.current) clearInterval(captionTimerRef.current);

    const fadeTimer = setTimeout(() => {
      setCaptionVisible(true);
      // Start typewriter after caption bar fades in
      const twTimer = setInterval(() => {
        setCaptionChars((prev) => {
          const next = prev + CAPTION_CHARS_PER_TICK;
          if (next >= caption.length) {
            clearInterval(twTimer);
            setCaptionTypewriterDone(true);
            return caption.length;
          }
          return next;
        });
      }, CAPTION_TICK_MS);
      captionTimerRef.current = twTimer;
    }, 600);

    return () => {
      clearTimeout(fadeTimer);
      if (captionTimerRef.current) clearInterval(captionTimerRef.current);
    };
  }, [activeVideoUrl, caption]);

  return (
    <div
      className={`cinematic-overlay ${fadingOut ? 'cinematic-fade-out' : ''}`}
      onClick={(e) => {
        if (mode === 'panorama' && panDraggedRef.current) {
          panDraggedRef.current = false;
          return;
        }
        const v = videoRef.current;
        if (v && v.muted && !muted) {
          // First tap unmutes if autoplay was forced muted
          v.muted = false;
          return;
        }
        handleTap();
      }}
      role={autoAdvance ? undefined : 'button'}
      tabIndex={autoAdvance ? undefined : 0}
    >
      <div
        ref={viewportRef}
        className={`cinematic-viewport cinematic-viewport--${mode}`}
        onPointerDown={handlePanPointerDown}
        onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerUp}
        onPointerCancel={handlePanPointerUp}
      >
        <div className="cinematic-media-track" style={mediaTransformStyle}>
          <video
            ref={videoRef}
            src={activeVideoUrl}
            playsInline
            muted={muted}
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.videoWidth && v.videoHeight) {
                setMediaSize({ width: v.videoWidth, height: v.videoHeight });
              }
            }}
            onEnded={handleEnded}
            onError={() => {
              if (candidateIndex + 1 < videoCandidates.length) {
                setCandidateIndex(candidateIndex + 1);
              } else {
                triggerEnd();
              }
            }}
            className="cinematic-video"
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate"
          />
          {presentation?.overlays?.filter((overlay) => overlay.anchor === 'world').map(renderWorldOverlay)}
        </div>
      </div>
      {caption && (
        <div
          className={`cinematic-subtitle-bar cinematic-subtitle-bar--viewport ${captionVisible ? 'cinematic-subtitle-visible' : ''}`}
          style={captionTypewriterDone ? { pointerEvents: 'auto' } : undefined}
        >
          <p className="cinematic-subtitle-text">
            {captionTypewriterDone ? (
              <KoreanText text={caption} targetLang={targetLang} />
            ) : (
              <>
                {caption.slice(0, captionChars)}
                <span className="typewriter-cursor" />
              </>
            )}
          </p>
          {captionTypewriterDone && captionTranslation && (
            <p className="cinematic-subtitle-translation">{captionTranslation}</p>
          )}
        </div>
      )}
      {!autoAdvance && !fadingOut && (
        <div className="cinematic-tap-hint">{t('tap_to_skip', lang)}</div>
      )}
    </div>
  );
}

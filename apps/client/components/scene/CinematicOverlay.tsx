'use client';

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';
import { fallbackRuntimeAssetCandidates } from '@/lib/runtime-assets';
import type { CinematicOverlayHotspot, CinematicPresentationMode } from '@/lib/types/hangout';

const CAPTION_CHARS_PER_TICK = 2;
const CAPTION_TICK_MS = 35;

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  captionTranslation?: string;
  autoAdvance: boolean;
  muted?: boolean;
  mode?: CinematicPresentationMode;
  initialPan?: number;
  overlays?: CinematicOverlayHotspot[];
  targetLang?: TargetLang;
  onEnd: () => void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function CinematicOverlay({
  videoUrl,
  caption,
  captionTranslation,
  autoAdvance,
  muted = false,
  mode = 'cover',
  initialPan = 0.5,
  overlays = [],
  targetLang = 'ko',
  onEnd,
}: CinematicOverlayProps) {
  const lang = useUILang();
  const isPanorama = mode === 'panorama';
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const videoCandidates = useMemo(() => fallbackRuntimeAssetCandidates(videoUrl), [videoUrl]);
  const activeVideoUrl = videoCandidates[candidateIndex] ?? '';
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [panPixels, setPanPixels] = useState(0);
  const [panBounds, setPanBounds] = useState(0);
  const dragStateRef = useRef<{ active: boolean; moved: boolean; startX: number; startPan: number }>({
    active: false,
    moved: false,
    startX: 0,
    startPan: 0,
  });

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
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    syncPreference();
    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    setPanPixels(0);
    setPanBounds(0);
  }, [activeVideoUrl, mode]);

  useEffect(() => {
    if (!isPanorama) return;
    const frameEl = frameRef.current;
    const videoEl = videoRef.current;
    if (!frameEl || !videoEl) return;

    const updatePanGeometry = () => {
      const viewportWidth = frameEl.clientWidth;
      const viewportHeight = frameEl.clientHeight;
      const intrinsicWidth = videoEl.videoWidth;
      const intrinsicHeight = videoEl.videoHeight;
      if (!viewportWidth || !viewportHeight || !intrinsicWidth || !intrinsicHeight) return;

      const renderWidth = (viewportHeight * intrinsicWidth) / intrinsicHeight;
      const nextBounds = Math.max(0, Math.round(renderWidth - viewportWidth));
      setPanBounds(nextBounds);
      setPanPixels(clamp01(initialPan) * nextBounds);
    };

    videoEl.addEventListener('loadedmetadata', updatePanGeometry);
    window.addEventListener('resize', updatePanGeometry);
    updatePanGeometry();
    return () => {
      videoEl.removeEventListener('loadedmetadata', updatePanGeometry);
      window.removeEventListener('resize', updatePanGeometry);
    };
  }, [activeVideoUrl, initialPan, isPanorama]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanorama || panBounds <= 0) return;
    dragStateRef.current = { active: true, moved: false, startX: event.clientX, startPan: panPixels };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [isPanorama, panBounds, panPixels]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active || panBounds <= 0) return;
    const deltaX = event.clientX - dragStateRef.current.startX;
    if (Math.abs(deltaX) > 4) {
      dragStateRef.current.moved = true;
    }
    const nextPan = dragStateRef.current.startPan - deltaX;
    setPanPixels(Math.min(panBounds, Math.max(0, nextPan)));
  }, [panBounds]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return false;
    const moved = dragStateRef.current.moved;
    dragStateRef.current = { active: false, moved: false, startX: 0, startPan: panPixels };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    return moved;
  }, [panPixels]);

  const worldOverlays = overlays.filter((overlay) => overlay.anchor === 'world');
  const viewportOverlays = overlays.filter((overlay) => overlay.anchor === 'viewport');

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
        if (dragStateRef.current.moved) return;
        const v = videoRef.current;
        if (v && v.muted && !muted) {
          // First tap unmutes if autoplay was forced muted
          v.muted = false;
          return;
        }
        handleTap();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role={autoAdvance ? undefined : 'button'}
      tabIndex={autoAdvance ? undefined : 0}
    >
      <div ref={frameRef} className={`cinematic-frame cinematic-frame--${mode}`}>
        <div
          className="cinematic-world-layer"
          style={isPanorama ? {
            transform: `translate3d(${-panPixels}px, 0, 0)`,
            transition: prefersReducedMotion ? 'none' : 'transform 220ms ease-out',
          } : undefined}
        >
          <video
            ref={videoRef}
            src={activeVideoUrl}
            playsInline
            muted={muted}
            onEnded={handleEnded}
            onError={() => {
              if (candidateIndex + 1 < videoCandidates.length) {
                setCandidateIndex(candidateIndex + 1);
              } else {
                triggerEnd();
              }
            }}
            className={`cinematic-video cinematic-video--${mode}`}
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate"
          />
          {worldOverlays.map((overlay) => (
            <div
              key={overlay.id}
              className="cinematic-hotspot cinematic-hotspot--world"
              style={{
                left: `${clamp01(overlay.x) * 100}%`,
                top: `${clamp01(overlay.y) * 100}%`,
              }}
            >
              {overlay.label}
            </div>
          ))}
        </div>
      </div>
      {caption && (
        <div
          className={`cinematic-subtitle-bar ${captionVisible ? 'cinematic-subtitle-visible' : ''}`}
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
      {viewportOverlays.map((overlay) => (
        <div
          key={overlay.id}
          className="cinematic-hotspot cinematic-hotspot--viewport"
          style={{
            left: `${clamp01(overlay.x) * 100}%`,
            top: `${clamp01(overlay.y) * 100}%`,
          }}
        >
          {overlay.label}
        </div>
      ))}
      {!autoAdvance && !fadingOut && (
        <div className="cinematic-tap-hint">{t('tap_to_skip', lang)}</div>
      )}
    </div>
  );
}

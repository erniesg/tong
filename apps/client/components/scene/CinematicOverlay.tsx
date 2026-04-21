'use client';

import { useRef, useCallback, useState, useEffect, useMemo, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';
import { fallbackRuntimeAssetCandidates } from '@/lib/runtime-assets';

const CAPTION_CHARS_PER_TICK = 2;
const CAPTION_TICK_MS = 35;

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  captionTranslation?: string;
  autoAdvance: boolean;
  muted?: boolean;
  mode?: 'cover' | 'panorama';
  panoramaImageUrl?: string;
  panoramaWidth?: number;
  panoramaHeight?: number;
  onPanoramaTransformChange?: (transformX: number) => void;
  targetLang?: TargetLang;
  onEnd: () => void;
}

const PANORAMA_DEFAULT_WIDTH = 2400;
const PANORAMA_DEFAULT_HEIGHT = 1200;

export function CinematicOverlay({
  videoUrl,
  caption,
  captionTranslation,
  autoAdvance,
  muted = false,
  mode = 'cover',
  panoramaImageUrl,
  panoramaWidth,
  panoramaHeight,
  onPanoramaTransformChange,
  targetLang = 'ko',
  onEnd,
}: CinematicOverlayProps) {
  const lang = useUILang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const panoramaViewportRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<HTMLDivElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [panoramaOffset, setPanoramaOffset] = useState(0);
  const [draggingPanorama, setDraggingPanorama] = useState(false);
  const videoCandidates = useMemo(() => fallbackRuntimeAssetCandidates(videoUrl), [videoUrl]);
  const activeVideoUrl = videoCandidates[candidateIndex] ?? '';
  const panoramaIsActive = mode === 'panorama';
  const panoramaImageSrc = panoramaImageUrl || activeVideoUrl;
  const [panoramaImageFailed, setPanoramaImageFailed] = useState(false);
  const authoredPanoramaWidth = panoramaWidth ?? PANORAMA_DEFAULT_WIDTH;
  const authoredPanoramaHeight = panoramaHeight ?? PANORAMA_DEFAULT_HEIGHT;
  const [panoramaContentWidth, setPanoramaContentWidth] = useState(authoredPanoramaWidth);
  const dragStateRef = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);
  const onPanoramaTransformChangeRef = useRef(onPanoramaTransformChange);

  useEffect(() => {
    onPanoramaTransformChangeRef.current = onPanoramaTransformChange;
  }, [onPanoramaTransformChange]);

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
    if (!panoramaIsActive) return;
    setPanoramaOffset(0);
    setPanoramaImageFailed(false);
    onPanoramaTransformChangeRef.current?.(0);
  }, [panoramaIsActive, panoramaImageSrc]);

  useEffect(() => {
    if (!panoramaIsActive) return;
    const viewport = panoramaViewportRef.current;
    if (!viewport) return;
    const viewportWidth = viewport.clientWidth;
    const computedByRatio = (viewportWidth * authoredPanoramaWidth) / authoredPanoramaHeight;
    const nextWidth = Math.max(authoredPanoramaWidth, computedByRatio);
    setPanoramaContentWidth(nextWidth);
  }, [authoredPanoramaHeight, authoredPanoramaWidth, panoramaIsActive]);

  const clampPanoramaOffset = useCallback((next: number) => {
    const viewportWidth = panoramaViewportRef.current?.clientWidth ?? 0;
    const maxOverflow = Math.max(0, panoramaContentWidth - viewportWidth);
    return Math.min(0, Math.max(next, -maxOverflow));
  }, [panoramaContentWidth]);

  const applyPanoramaOffset = useCallback((next: number) => {
    const clamped = clampPanoramaOffset(next);
    setPanoramaOffset(clamped);
    onPanoramaTransformChangeRef.current?.(clamped);
  }, [clampPanoramaOffset]);

  const handlePanoramaDragStart = useCallback((clientX: number) => {
    if (!panoramaIsActive) return;
    dragStateRef.current = {
      startX: clientX,
      startOffset: panoramaOffset,
      moved: false,
    };
    setDraggingPanorama(true);
  }, [panoramaIsActive, panoramaOffset]);

  const handlePanoramaDragMove = useCallback((clientX: number) => {
    const drag = dragStateRef.current;
    if (!panoramaIsActive || !drag) return;
    const deltaX = clientX - drag.startX;
    if (Math.abs(deltaX) > 6) {
      drag.moved = true;
    }
    applyPanoramaOffset(drag.startOffset + deltaX);
  }, [applyPanoramaOffset, panoramaIsActive]);

  const handlePanoramaDragEnd = useCallback(() => {
    const drag = dragStateRef.current;
    if (!drag) return;
    dragStateRef.current = null;
    setDraggingPanorama(false);
    if (!drag.moved && !autoAdvance) {
      triggerEnd();
    }
  }, [autoAdvance, triggerEnd]);

  const handlePanoramaMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    handlePanoramaDragStart(event.clientX);
  }, [handlePanoramaDragStart]);

  const handlePanoramaTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 1) return;
    handlePanoramaDragStart(event.touches[0].clientX);
  }, [handlePanoramaDragStart]);

  useEffect(() => {
    if (!draggingPanorama) return;
    const onMouseMove = (event: MouseEvent) => handlePanoramaDragMove(event.clientX);
    const onMouseUp = () => handlePanoramaDragEnd();
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 1) return;
      handlePanoramaDragMove(event.touches[0].clientX);
    };
    const onTouchEnd = () => handlePanoramaDragEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [draggingPanorama, handlePanoramaDragEnd, handlePanoramaDragMove]);

  // Autoplay with unmute fallback + audio fade-in
  useEffect(() => {
    if (panoramaIsActive) return;
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
  }, [activeVideoUrl, muted, panoramaIsActive]);

  // Fade out audio before video ends
  useEffect(() => {
    if (panoramaIsActive) return;
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
  }, [activeVideoUrl, muted, panoramaIsActive]);

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
        if (panoramaIsActive) return;
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
      {panoramaIsActive ? (
        <div
          ref={panoramaViewportRef}
          className="absolute inset-0 overflow-hidden touch-none"
          onMouseDown={handlePanoramaMouseDown}
          onTouchStart={handlePanoramaTouchStart}
          onDoubleClick={(event) => event.preventDefault()}
          style={{ cursor: draggingPanorama ? 'grabbing' : 'grab' }}
        >
          <div
            ref={panoramaRef}
            className="absolute top-0 left-0 h-full"
            style={{
              width: `${panoramaContentWidth}px`,
              transform: `translate3d(${panoramaOffset}px, 0px, 0px)`,
              transition: draggingPanorama ? 'none' : 'transform 120ms ease-out',
              willChange: 'transform',
            }}
          >
            {!panoramaImageFailed ? (
              <img
                src={panoramaImageSrc}
                alt="Panorama cinematic backdrop"
                className="h-full w-full select-none"
                draggable={false}
                style={{ objectFit: 'fill' }}
                onError={() => setPanoramaImageFailed(true)}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background:
                    'linear-gradient(90deg, #1a2242 0%, #2f4f87 18%, #8f5f8d 36%, #e58f5c 54%, #4b8b84 72%, #25253f 100%)',
                }}
              />
            )}
          </div>
        </div>
      ) : (
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
          className="cinematic-video"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate"
        />
      )}
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
      {!autoAdvance && !fadingOut && (
        <div className="cinematic-tap-hint">{t('tap_to_skip', lang)}</div>
      )}
    </div>
  );
}

'use client';

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
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
  panoramaAuthoredWidth?: number;
  panoramaAuthoredHeight?: number;
  panoramaMinOverflowPx?: number;
  onPanoramaTransformChange?: (deltaX: number) => void;
  targetLang?: TargetLang;
  onEnd: () => void;
}

export function CinematicOverlay({
  videoUrl,
  caption,
  captionTranslation,
  autoAdvance,
  muted = false,
  mode = 'cover',
  panoramaAuthoredWidth,
  panoramaAuthoredHeight,
  panoramaMinOverflowPx = 120,
  onPanoramaTransformChange,
  targetLang = 'ko',
  onEnd,
}: CinematicOverlayProps) {
  const lang = useUILang();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const videoCandidates = useMemo(() => fallbackRuntimeAssetCandidates(videoUrl), [videoUrl]);
  const activeVideoUrl = videoCandidates[candidateIndex] ?? '';
  const isPanoramaMode = mode === 'panorama';
  const [viewportWidth, setViewportWidth] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [panX, setPanX] = useState(0);
  const dragStateRef = useRef<{ startX: number; originPanX: number; movedPx: number } | null>(null);
  const suppressTapRef = useRef(false);

  const authoredAspect =
    panoramaAuthoredWidth && panoramaAuthoredHeight && panoramaAuthoredWidth > 0 && panoramaAuthoredHeight > 0
      ? panoramaAuthoredWidth / panoramaAuthoredHeight
      : null;
  const naturalAspect = naturalSize && naturalSize.width > 0 && naturalSize.height > 0
    ? naturalSize.width / naturalSize.height
    : null;
  const panoramaAspect = authoredAspect ?? naturalAspect ?? (21 / 9);
  const panoramaTrackWidth = viewportWidth > 0
    ? Math.max(viewportWidth * panoramaAspect, viewportWidth + panoramaMinOverflowPx)
    : 0;
  const panoramaMinPanX = Math.min(0, viewportWidth - panoramaTrackWidth);

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
    if (!isPanoramaMode) return;
    const node = rootRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewportWidth(entry.contentRect.width);
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [isPanoramaMode]);

  useEffect(() => {
    if (!isPanoramaMode) {
      setPanX(0);
      return;
    }
    setPanX((current) => Math.max(panoramaMinPanX, Math.min(0, current)));
  }, [isPanoramaMode, panoramaMinPanX]);

  useEffect(() => {
    onPanoramaTransformChange?.(isPanoramaMode ? panX : 0);
  }, [isPanoramaMode, onPanoramaTransformChange, panX]);

  // Autoplay with unmute fallback + audio fade-in
  useEffect(() => {
    if (isPanoramaMode) return;
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
  }, [activeVideoUrl, isPanoramaMode, muted]);

  // Fade out audio before video ends
  useEffect(() => {
    if (isPanoramaMode) return;
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
  }, [activeVideoUrl, isPanoramaMode, muted]);

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
      ref={rootRef}
      className={`cinematic-overlay ${fadingOut ? 'cinematic-fade-out' : ''}`}
      onClick={(e) => {
        if (suppressTapRef.current) {
          suppressTapRef.current = false;
          return;
        }
        if (isPanoramaMode) {
          handleTap();
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
      data-panorama-delta={isPanoramaMode ? panX.toFixed(2) : undefined}
    >
      {isPanoramaMode ? (
        <div
          className="absolute inset-0 touch-none"
          onPointerDown={(event) => {
            if (panoramaTrackWidth <= viewportWidth) return;
            dragStateRef.current = { startX: event.clientX, originPanX: panX, movedPx: 0 };
            (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const dragState = dragStateRef.current;
            if (!dragState) return;
            const delta = event.clientX - dragState.startX;
            dragState.movedPx = Math.max(dragState.movedPx, Math.abs(delta));
            const nextPanX = Math.max(panoramaMinPanX, Math.min(0, dragState.originPanX + delta));
            setPanX(nextPanX);
          }}
          onPointerUp={(event) => {
            if (dragStateRef.current?.movedPx && dragStateRef.current.movedPx > 6) {
              suppressTapRef.current = true;
            }
            dragStateRef.current = null;
            (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            dragStateRef.current = null;
            (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
          }}
        >
          <div
            className="absolute inset-y-0 left-0 will-change-transform"
            style={{ width: `${panoramaTrackWidth}px`, transform: `translate3d(${panX}px, 0, 0)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeVideoUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
              onLoad={(event) => {
                const media = event.currentTarget;
                if (media.naturalWidth && media.naturalHeight) {
                  setNaturalSize({ width: media.naturalWidth, height: media.naturalHeight });
                }
              }}
              onError={() => {
                if (candidateIndex + 1 < videoCandidates.length) {
                  setCandidateIndex(candidateIndex + 1);
                } else {
                  triggerEnd();
                }
              }}
            />
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

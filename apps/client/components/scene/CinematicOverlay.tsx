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
  mediaFit?: 'cover' | 'panorama';
  authoredDimensions?: { width: number; height: number };
  onPanoramaDeltaChange?: (deltaX: number) => void;
  targetLang?: TargetLang;
  onEnd: () => void;
}

export function CinematicOverlay({
  videoUrl,
  caption,
  captionTranslation,
  autoAdvance,
  muted = false,
  mediaFit = 'cover',
  authoredDimensions,
  onPanoramaDeltaChange,
  targetLang = 'ko',
  onEnd,
}: CinematicOverlayProps) {
  const lang = useUILang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [intrinsicAspectRatio, setIntrinsicAspectRatio] = useState<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const draggingRef = useRef(false);
  const draggedDistanceRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const hasInitializedPanRef = useRef(false);
  const videoCandidates = useMemo(() => fallbackRuntimeAssetCandidates(videoUrl), [videoUrl]);
  const activeVideoUrl = videoCandidates[candidateIndex] ?? '';
  const useImageElement = /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(activeVideoUrl);
  const panoramaEnabled = mediaFit === 'panorama';
  const mediaAspectRatio = useMemo(() => {
    if (authoredDimensions && authoredDimensions.width > 0 && authoredDimensions.height > 0) {
      return authoredDimensions.width / authoredDimensions.height;
    }
    if (intrinsicAspectRatio && intrinsicAspectRatio > 0) return intrinsicAspectRatio;
    // Wide fallback gives deterministic horizontal overflow even when temporary media is 16:9.
    return 21 / 9;
  }, [authoredDimensions, intrinsicAspectRatio]);
  const panoramaRenderWidth = useMemo(() => {
    if (!panoramaEnabled || viewportSize.width <= 0 || viewportSize.height <= 0) return viewportSize.width;
    return Math.max(viewportSize.width, viewportSize.height * mediaAspectRatio);
  }, [mediaAspectRatio, panoramaEnabled, viewportSize.height, viewportSize.width]);
  const panoramaOverflow = Math.max(0, panoramaRenderWidth - viewportSize.width);

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
    if (panoramaEnabled) return;
    if (!autoAdvance) triggerEnd();
  }, [autoAdvance, panoramaEnabled, triggerEnd]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [videoUrl]);

  useEffect(() => {
    setDragOffsetX(0);
    hasInitializedPanRef.current = false;
  }, [activeVideoUrl, panoramaEnabled]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !panoramaEnabled) return;
    const updateSize = () => {
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [panoramaEnabled]);

  useEffect(() => {
    if (!panoramaEnabled) {
      onPanoramaDeltaChange?.(0);
      return;
    }
    setDragOffsetX((current) => {
      if (panoramaOverflow <= 0) return 0;
      if (!hasInitializedPanRef.current) {
        hasInitializedPanRef.current = true;
        return -panoramaOverflow / 2;
      }
      return Math.min(0, Math.max(-panoramaOverflow, current));
    });
  }, [onPanoramaDeltaChange, panoramaEnabled, panoramaOverflow]);

  useEffect(() => {
    onPanoramaDeltaChange?.(dragOffsetX);
  }, [dragOffsetX, onPanoramaDeltaChange]);

  // Autoplay with unmute fallback + audio fade-in
  useEffect(() => {
    if (useImageElement) return;
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
  }, [activeVideoUrl, muted, useImageElement]);

  // Fade out audio before video ends
  useEffect(() => {
    if (useImageElement) return;
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
  }, [activeVideoUrl, muted, useImageElement]);

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
      ref={viewportRef}
      className={`cinematic-overlay ${fadingOut ? 'cinematic-fade-out' : ''}`}
      style={panoramaEnabled ? { overflow: 'hidden' } : undefined}
      onClick={(e) => {
        if (panoramaEnabled && draggedDistanceRef.current > 4) {
          draggedDistanceRef.current = 0;
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
      {useImageElement ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeVideoUrl}
          alt=""
          onLoad={(event) => {
            const target = event.currentTarget;
            if (target.naturalWidth > 0 && target.naturalHeight > 0) {
              setIntrinsicAspectRatio(target.naturalWidth / target.naturalHeight);
            }
          }}
          onError={() => {
            if (candidateIndex + 1 < videoCandidates.length) {
              setCandidateIndex(candidateIndex + 1);
            } else {
              triggerEnd();
            }
          }}
          onPointerDown={(event) => {
            if (!panoramaEnabled || panoramaOverflow <= 0) return;
            draggingRef.current = true;
            draggedDistanceRef.current = 0;
            dragStartXRef.current = event.clientX;
            dragStartOffsetRef.current = dragOffsetX;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!panoramaEnabled || !draggingRef.current) return;
            const delta = event.clientX - dragStartXRef.current;
            draggedDistanceRef.current = Math.max(draggedDistanceRef.current, Math.abs(delta));
            const nextOffset = Math.min(0, Math.max(-panoramaOverflow, dragStartOffsetRef.current + delta));
            setDragOffsetX(nextOffset);
          }}
          onPointerUp={(event) => {
            if (!panoramaEnabled) return;
            draggingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (!panoramaEnabled) return;
            draggingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          className="cinematic-video"
          style={panoramaEnabled ? {
            width: `${panoramaRenderWidth}px`,
            height: '100%',
            maxWidth: 'none',
            objectFit: 'fill',
            transform: `translate3d(${dragOffsetX}px, 0, 0)`,
            touchAction: 'none',
            cursor: panoramaOverflow > 0 ? (draggingRef.current ? 'grabbing' : 'grab') : 'default',
          } : undefined}
        />
      ) : (
        <video
          ref={videoRef}
          src={activeVideoUrl}
          playsInline
          muted={muted}
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            if (videoWidth > 0 && videoHeight > 0) {
              setIntrinsicAspectRatio(videoWidth / videoHeight);
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
          onPointerDown={(event) => {
            if (!panoramaEnabled || panoramaOverflow <= 0) return;
            draggingRef.current = true;
            draggedDistanceRef.current = 0;
            dragStartXRef.current = event.clientX;
            dragStartOffsetRef.current = dragOffsetX;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!panoramaEnabled || !draggingRef.current) return;
            const delta = event.clientX - dragStartXRef.current;
            draggedDistanceRef.current = Math.max(draggedDistanceRef.current, Math.abs(delta));
            const nextOffset = Math.min(0, Math.max(-panoramaOverflow, dragStartOffsetRef.current + delta));
            setDragOffsetX(nextOffset);
          }}
          onPointerUp={(event) => {
            if (!panoramaEnabled) return;
            draggingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (!panoramaEnabled) return;
            draggingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          className="cinematic-video"
          style={panoramaEnabled ? {
            width: `${panoramaRenderWidth}px`,
            height: '100%',
            maxWidth: 'none',
            objectFit: 'fill',
            transform: `translate3d(${dragOffsetX}px, 0, 0)`,
            touchAction: 'none',
            cursor: panoramaOverflow > 0 ? (draggingRef.current ? 'grabbing' : 'grab') : 'default',
          } : undefined}
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

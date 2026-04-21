'use client';

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';
import { fallbackRuntimeAssetCandidates } from '@/lib/runtime-assets';
import type { CinematicPresentationMode, CinematicWorldOverlay } from '@/lib/types/hangout';

const CAPTION_CHARS_PER_TICK = 2;
const CAPTION_TICK_MS = 35;

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  captionTranslation?: string;
  autoAdvance: boolean;
  muted?: boolean;
  presentationMode?: CinematicPresentationMode;
  worldOverlays?: CinematicWorldOverlay[];
  targetLang?: TargetLang;
  onEnd: () => void;
}

const DRAG_THRESHOLD_PX = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function CinematicOverlay({
  videoUrl,
  caption,
  captionTranslation,
  autoAdvance,
  muted = false,
  presentationMode = 'cover',
  worldOverlays = [],
  targetLang = 'ko',
  onEnd,
}: CinematicOverlayProps) {
  const lang = useUILang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const suppressTapRef = useRef(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startOffset: number } | null>(null);
  const videoCandidates = useMemo(() => fallbackRuntimeAssetCandidates(videoUrl), [videoUrl]);
  const activeVideoUrl = videoCandidates[candidateIndex] ?? '';
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [panOffset, setPanOffset] = useState(0);

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
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    if (!autoAdvance) triggerEnd();
  }, [autoAdvance, triggerEnd]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [videoUrl]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const target = viewportRef.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewportSize({ width: rect.width, height: rect.height });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const mediaWidth = useMemo(() => {
    if (!viewportSize.height) return 0;
    return viewportSize.height * videoAspectRatio;
  }, [viewportSize.height, videoAspectRatio]);
  const minOffset = Math.min(0, viewportSize.width - mediaWidth);
  const maxOffset = 0;
  const panoramaActive = presentationMode === 'panorama' && mediaWidth > viewportSize.width + 0.5;

  useEffect(() => {
    if (!panoramaActive) {
      setPanOffset(0);
      return;
    }
    setPanOffset((prev) => clamp(prev || (viewportSize.width - mediaWidth) / 2, minOffset, maxOffset));
  }, [panoramaActive, viewportSize.width, mediaWidth, minOffset, maxOffset]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panoramaActive || event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startOffset: panOffset };
    setIsDragging(true);
  }, [panOffset, panoramaActive]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) suppressTapRef.current = true;
    setPanOffset(clamp(drag.startOffset + delta, minOffset, maxOffset));
  }, [minOffset, maxOffset]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

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
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(e) => {
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
        className={`cinematic-world-stage ${panoramaActive ? 'cinematic-world-stage--panorama' : ''}`}
        style={panoramaActive ? {
          width: `${mediaWidth}px`,
          transform: `translate3d(${panOffset}px, 0, 0)`,
          transition: isDragging || prefersReducedMotion ? 'none' : 'transform 220ms ease-out',
        } : undefined}
      >
      <video
        ref={videoRef}
        src={activeVideoUrl}
        playsInline
        muted={muted}
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth > 0 && videoHeight > 0) {
            setVideoAspectRatio(videoWidth / videoHeight);
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
        className={`cinematic-video ${panoramaActive ? 'cinematic-video--panorama' : ''}`}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate"
      />
        {worldOverlays.map((overlay) => (
          <span
            key={overlay.id}
            className="cinematic-world-overlay"
            style={{ left: `${overlay.x}%`, top: `${overlay.y}%` }}
          >
            {overlay.content}
          </span>
        ))}
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
      {!autoAdvance && !fadingOut && (
        <div className="cinematic-tap-hint">{t('tap_to_skip', lang)}</div>
      )}
    </div>
  );
}

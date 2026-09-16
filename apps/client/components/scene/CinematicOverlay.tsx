'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';

const CAPTION_CHARS_PER_TICK = 2;
const CAPTION_TICK_MS = 35;

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  captionTranslation?: string;
  autoAdvance: boolean;
  muted?: boolean;
  targetLang?: TargetLang;
  onEnd: () => void;
}

export function CinematicOverlay({ videoUrl, caption, captionTranslation, autoAdvance, muted = false, targetLang = 'ko', onEnd }: CinematicOverlayProps) {
  const lang = useUILang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);
  const audioFadeDelayRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const audioFadeIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

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

  const clearAudioFade = useCallback(() => {
    if (audioFadeDelayRef.current) clearTimeout(audioFadeDelayRef.current);
    if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current);
    audioFadeDelayRef.current = undefined;
    audioFadeIntervalRef.current = undefined;
  }, []);

  const startAudioFade = useCallback(() => {
    const v = videoRef.current;
    if (!v || muted || v.muted) return;
    clearAudioFade();
    audioFadeDelayRef.current = setTimeout(() => {
      let vol = Math.max(0, v.volume);
      audioFadeIntervalRef.current = setInterval(() => {
        vol = Math.min(1, vol + 0.05);
        v.volume = vol;
        if (vol >= 1 && audioFadeIntervalRef.current) {
          clearInterval(audioFadeIntervalRef.current);
          audioFadeIntervalRef.current = undefined;
        }
      }, 40);
    }, 180);
  }, [clearAudioFade, muted]);

  // Autoplay with unmute fallback. Audio starts fading only after playback is visibly underway.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0;
    v.muted = muted;
    const handlePlaying = () => startAudioFade();
    v.addEventListener('playing', handlePlaying);
    const playPromise = v.play();
    if (playPromise) {
      playPromise.catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
    }
    return () => {
      clearAudioFade();
      v.removeEventListener('playing', handlePlaying);
    };
  }, [videoUrl, muted, startAudioFade, clearAudioFade]);

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
  }, [videoUrl, muted]);

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
  }, [videoUrl, caption]);

  return (
    <div
      className={`cinematic-overlay ${fadingOut ? 'cinematic-fade-out' : ''}`}
      onClick={(e) => {
        const v = videoRef.current;
        if (v && v.muted && !muted) {
          // First tap unmutes if autoplay was forced muted
          v.muted = false;
          startAudioFade();
          return;
        }
        handleTap();
      }}
      role={autoAdvance ? undefined : 'button'}
      tabIndex={autoAdvance ? undefined : 0}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        playsInline
        preload="auto"
        muted={muted}
        onEnded={handleEnded}
        className="cinematic-video"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate"
      />
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

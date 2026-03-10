'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  captionTranslation?: string;
  autoAdvance: boolean;
  muted?: boolean;
  onEnd: () => void;
}

export function CinematicOverlay({ videoUrl, caption, captionTranslation, autoAdvance, muted = false, onEnd }: CinematicOverlayProps) {
  const lang = useUILang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(false);

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

  // Autoplay with unmute fallback: browsers block unmuted autoplay without user gesture
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    const playPromise = v.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Blocked — start muted, then unmute on first tap
        v.muted = true;
        v.play().catch(() => {});
      });
    }
  }, [videoUrl, muted]);

  // Fade in caption shortly after video starts playing
  useEffect(() => {
    if (!caption) return;
    setCaptionVisible(false);
    const timer = setTimeout(() => setCaptionVisible(true), 600);
    return () => clearTimeout(timer);
  }, [videoUrl, caption]);

  return (
    <div
      className={`cinematic-overlay ${fadingOut ? 'cinematic-fade-out' : ''}`}
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
      <video
        ref={videoRef}
        src={videoUrl}
        playsInline
        muted={muted}
        onEnded={handleEnded}
        className="cinematic-video"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate"
      />
      {caption && (
        <div className={`cinematic-subtitle-bar ${captionVisible ? 'cinematic-subtitle-visible' : ''}`}>
          <p className="cinematic-subtitle-text">{caption}</p>
          {captionTranslation && (
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

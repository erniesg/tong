'use client';

import { useRef, useCallback, useState } from 'react';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  autoAdvance: boolean;
  muted?: boolean;
  onEnd: () => void;
}

export function CinematicOverlay({ videoUrl, autoAdvance, muted = false, onEnd }: CinematicOverlayProps) {
  const lang = useUILang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadingOut, setFadingOut] = useState(false);

  const triggerEnd = useCallback(() => {
    if (fadingOut) return;
    setFadingOut(true);
    // Wait for fade-out animation to finish before unmounting
    setTimeout(() => onEnd(), 500);
  }, [fadingOut, onEnd]);

  const handleEnded = useCallback(() => {
    if (autoAdvance) triggerEnd();
  }, [autoAdvance, triggerEnd]);

  const handleTap = useCallback(() => {
    if (!autoAdvance) triggerEnd();
  }, [autoAdvance, triggerEnd]);

  return (
    <div
      className={`cinematic-overlay ${fadingOut ? 'cinematic-fade-out' : ''}`}
      onClick={handleTap}
      role={autoAdvance ? undefined : 'button'}
      tabIndex={autoAdvance ? undefined : 0}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        playsInline
        muted={muted}
        onEnded={handleEnded}
        className="cinematic-video"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate"
      />
      {!autoAdvance && !fadingOut && (
        <div className="cinematic-tap-hint">{t('tap_to_skip', lang)}</div>
      )}
    </div>
  );
}

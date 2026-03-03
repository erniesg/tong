'use client';

import { useRef, useCallback } from 'react';

interface CinematicOverlayProps {
  videoUrl: string;
  caption?: string;
  autoAdvance: boolean;
  muted?: boolean;
  onEnd: () => void;
}

export function CinematicOverlay({ videoUrl, caption, autoAdvance, muted = true, onEnd }: CinematicOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleEnded = useCallback(() => {
    if (autoAdvance) {
      onEnd();
    }
  }, [autoAdvance, onEnd]);

  const handleTap = useCallback(() => {
    if (!autoAdvance) {
      onEnd();
    }
  }, [autoAdvance, onEnd]);

  return (
    <div
      className="cinematic-overlay"
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
      />
      {caption && (
        <div className="cinematic-caption">{caption}</div>
      )}
      {!autoAdvance && (
        <div className="cinematic-tap-hint">Tap to skip</div>
      )}
    </div>
  );
}

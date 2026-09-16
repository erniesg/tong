'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface CharacterSpriteProps {
  spriteUrl: string;
  idleVideoUrl?: string;
  name: string;
  nameColor?: string;
  position?: 'left' | 'center' | 'right';
  active?: boolean;
}

export function CharacterSprite({
  spriteUrl,
  idleVideoUrl,
  name,
  nameColor = '#e8485c',
  position = 'center',
  active = true,
}: CharacterSpriteProps) {
  const [mounted, setMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { setMounted(true); }, []);

  const handleCanPlay = useCallback(() => { setVideoReady(true); }, []);
  const handleVideoError = useCallback(() => {
    setVideoFailed(true);
    setVideoReady(false);
  }, []);

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
  }, [idleVideoUrl]);

  // Keep idle video playing — mobile Safari can pause it on DOM changes or throttling
  useEffect(() => {
    if (!idleVideoUrl) return;
    const ensurePlaying = () => {
      const v = videoRef.current;
      if (v && v.paused && v.readyState >= 2) {
        v.play().catch(() => {});
      }
    };
    // Check on visibility change (tab switch, overlay dismiss)
    const onVisibility = () => { if (!document.hidden) ensurePlaying(); };
    document.addEventListener('visibilitychange', onVisibility);
    // Periodic check as safety net
    const interval = setInterval(ensurePlaying, 2000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [idleVideoUrl]);

  if (!mounted || (!spriteUrl && !idleVideoUrl)) return null;

  const hasIdleVideo = Boolean(idleVideoUrl) && !videoFailed;
  const showVideo = hasIdleVideo && videoReady;
  const showPortrait = Boolean(spriteUrl) && (!hasIdleVideo || !videoReady);

  return (
    <div
      className={cn(
        'absolute inset-0',
        'transition-all duration-500 ease-out',
        active ? 'opacity-100 scale-100' : 'opacity-40 scale-90 brightness-50',
        position === 'left' && 'slide-in-left',
        position === 'right' && 'slide-in-right',
      )}
    >
      {showPortrait && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={spriteUrl}
          alt={name}
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300',
            showVideo ? 'opacity-0' : 'opacity-100',
          )}
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 10px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 10px), transparent 100%)',
          }}
        />
      )}
      {hasIdleVideo && (
        <video
          ref={videoRef}
          src={idleVideoUrl}
          preload="auto"
          autoPlay
          loop
          muted
          playsInline
          onCanPlayThrough={handleCanPlay}
          onError={handleVideoError}
          className={cn(
            'h-full w-full object-cover object-top transition-opacity duration-300',
            showVideo ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}

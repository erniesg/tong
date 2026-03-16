'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { fallbackRuntimeAssetCandidates } from '@/lib/runtime-assets';

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
  const [videoCandidateIndex, setVideoCandidateIndex] = useState(0);
  const [spriteCandidateIndex, setSpriteCandidateIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleVideoCandidates = useMemo(() => fallbackRuntimeAssetCandidates(idleVideoUrl), [idleVideoUrl]);
  const spriteCandidates = useMemo(() => fallbackRuntimeAssetCandidates(spriteUrl), [spriteUrl]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    setVideoReady(false);
    setVideoCandidateIndex(0);
  }, [idleVideoUrl]);
  useEffect(() => {
    setSpriteCandidateIndex(0);
  }, [spriteUrl]);

  const handleCanPlay = useCallback(() => { setVideoReady(true); }, []);

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

  const activeIdleVideoUrl = idleVideoCandidates[videoCandidateIndex] ?? '';
  const activeSpriteUrl = spriteCandidates[spriteCandidateIndex] ?? '';
  const videoAvailable = Boolean(activeIdleVideoUrl);
  const spriteAvailable = Boolean(activeSpriteUrl);

  if (!mounted || (!spriteAvailable && !videoAvailable)) return null;

  const showVideo = videoAvailable && videoReady;

  return (
    <div
      className={cn(
        'absolute inset-0',
        'transition-all duration-500 ease-out',
        active && showVideo ? 'opacity-100 scale-100' : active && !idleVideoUrl ? 'opacity-100 scale-100' : !active ? 'opacity-40 scale-90 brightness-50' : 'opacity-0',
        position === 'left' && 'slide-in-left',
        position === 'right' && 'slide-in-right',
      )}
    >
      {videoAvailable ? (
        <video
          ref={videoRef}
          src={activeIdleVideoUrl}
          preload="auto"
          autoPlay
          loop
          muted
          playsInline
          onCanPlayThrough={handleCanPlay}
          onError={() => {
            setVideoReady(false);
            if (videoCandidateIndex + 1 < idleVideoCandidates.length) {
              setVideoCandidateIndex(videoCandidateIndex + 1);
            } else {
              setVideoCandidateIndex(idleVideoCandidates.length);
            }
          }}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={activeSpriteUrl}
          alt={name}
          className="h-full w-full object-cover object-top"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 10px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 10px), transparent 100%)',
          }}
          onError={() => {
            if (spriteCandidateIndex + 1 < spriteCandidates.length) {
              setSpriteCandidateIndex(spriteCandidateIndex + 1);
            }
          }}
        />
      )}
    </div>
  );
}

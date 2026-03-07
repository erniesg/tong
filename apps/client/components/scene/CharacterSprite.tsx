'use client';

import { useState, useEffect } from 'react';
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
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || (!spriteUrl && !idleVideoUrl)) return null;

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
      {idleVideoUrl ? (
        <video
          src={idleVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover object-top"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={spriteUrl}
          alt={name}
          className="h-full w-full object-cover object-top"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 10px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 10px), transparent 100%)',
          }}
        />
      )}
    </div>
  );
}

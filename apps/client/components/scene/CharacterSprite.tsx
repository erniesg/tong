'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface CharacterSpriteProps {
  spriteUrl: string;
  name: string;
  nameColor?: string;
  position?: 'left' | 'center' | 'right';
  active?: boolean;
}

export function CharacterSprite({
  spriteUrl,
  name,
  nameColor = '#e8485c',
  position = 'center',
  active = true,
}: CharacterSpriteProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !spriteUrl) return null;

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={spriteUrl}
        alt={name}
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}

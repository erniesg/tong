'use client';

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
  return (
    <div
      className={cn(
        'absolute bottom-[35%] left-1/2 -translate-x-1/2',
        'h-[45%] w-auto',
        'transition-all duration-500 ease-out',
        active ? 'opacity-100 scale-100' : 'opacity-40 scale-90 brightness-50',
        position === 'left' && 'slide-in-left',
        position === 'right' && 'slide-in-right',
      )}
    >
      {spriteUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={spriteUrl}
          alt={name}
          className="h-full w-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
        />
      ) : (
        <div className="flex h-full w-32 flex-col items-center justify-end">
          <div className="relative h-full w-full rounded-t-full bg-gradient-to-t from-white/15 via-white/8 to-transparent">
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: nameColor, color: '#fff' }}
            >
              {name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

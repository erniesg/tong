'use client';

import { useEffect, useMemo, useState } from 'react';
import { fallbackRuntimeAssetCandidates } from '@/lib/runtime-assets';

interface BackgroundProps {
  imageUrl: string;
  ambientDescription?: string;
  fade?: boolean;
}

export function Background({ imageUrl, ambientDescription, fade = false }: BackgroundProps) {
  const candidates = useMemo(() => fallbackRuntimeAssetCandidates(imageUrl), [imageUrl]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageUrl]);

  const activeImageUrl = candidates[candidateIndex] ?? '';

  return (
    <div className="absolute inset-0 overflow-hidden">
      {activeImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: 'center bottom',
            transition: fade ? 'opacity 0.5s ease-in-out' : undefined,
            animation: fade ? 'backdrop-fade-in 0.5s ease-in-out' : undefined,
          }}
          onError={(e) => {
            if (candidateIndex + 1 < candidates.length) {
              setCandidateIndex(candidateIndex + 1);
              return;
            }
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : ambientDescription ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-dark)] p-8">
          <p className="max-w-xs text-center italic text-[length:var(--game-text-base)] text-[var(--color-text-muted)]">
            {ambientDescription}
          </p>
        </div>
      ) : null}
      {/* Subtle bottom gradient — just enough for subtitle legibility */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
}

'use client';

import { memo } from 'react';

interface Props {
  id: string;
  piece: string;
  y: number;           // 0-1 normalized vertical position
  selected: boolean;
  isDistractor: boolean;
  colorHint?: string;
  onTap: (id: string) => void;
}

export const FallingPiece = memo(function FallingPiece({
  id,
  piece,
  y,
  selected,
  isDistractor,
  colorHint,
  onTap,
}: Props) {
  const topPercent = y * 100;

  const className = [
    'block-crush__piece',
    selected && 'block-crush__piece--selected',
    isDistractor && 'block-crush__piece--distractor',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{
        top: `${topPercent}%`,
        borderColor: selected
          ? '#f0c040'
          : colorHint
            ? `${colorHint}66`
            : undefined,
      }}
      onClick={() => onTap(id)}
    >
      {piece}
    </div>
  );
});

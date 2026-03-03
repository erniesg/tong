'use client';

interface HeartMeterProps {
  progress: number; // 0-100
  videoReady: boolean;
  characterName?: string;
}

export function HeartMeter({ progress, videoReady, characterName }: HeartMeterProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  // Fill rises from bottom: clipY goes from 100% (empty) to 0% (full)
  const fillY = 100 - clampedProgress;
  const isComplete = videoReady && clampedProgress >= 100;

  return (
    <div className={`heart-meter${isComplete ? ' heart-meter--complete' : ''}`}>
      <svg
        viewBox="0 0 32 30"
        width="32"
        height="30"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="heart-clip">
            <path d="M16 28 C16 28 2 20 2 10 C2 5 6 2 10 2 C12.5 2 14.8 3.5 16 5.5 C17.2 3.5 19.5 2 22 2 C26 2 30 5 30 10 C30 20 16 28 16 28Z" />
          </clipPath>
        </defs>
        {/* Background heart (dim) */}
        <path
          d="M16 28 C16 28 2 20 2 10 C2 5 6 2 10 2 C12.5 2 14.8 3.5 16 5.5 C17.2 3.5 19.5 2 22 2 C26 2 30 5 30 10 C30 20 16 28 16 28Z"
          fill="rgba(255,255,255,0.15)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />
        {/* Fill rect clipped to heart shape */}
        <g clipPath="url(#heart-clip)">
          <rect
            className="heart-meter__fill"
            x="0"
            y={`${fillY}%`}
            width="32"
            height="30"
            fill="var(--color-heart-fill, #e8485c)"
          />
        </g>
      </svg>
      {characterName && (
        <span className="heart-meter__label">{characterName}</span>
      )}
    </div>
  );
}

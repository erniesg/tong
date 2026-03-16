'use client';

interface HeartMeterProps {
  progress: number; // 0-100
  videoReady: boolean;
  characterName?: string;
}

export function HeartMeter({ progress, videoReady, characterName }: HeartMeterProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const isComplete = videoReady && clamped >= 100;

  return (
    <div className={`charge-bar${isComplete ? ' charge-bar--complete' : ''}`}>
      <div className="charge-bar__track">
        <div
          className="charge-bar__fill"
          style={{ width: `${clamped}%` }}
        />
        {isComplete && <div className="charge-bar__shimmer" />}
      </div>
      <div className="charge-bar__label">
        {isComplete
          ? `✦ ${characterName ?? 'Memory'} unlocked`
          : `${characterName ?? 'Bond'} · ${clamped}%`
        }
      </div>
    </div>
  );
}

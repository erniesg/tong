'use client';

import type { LocationId } from '@/lib/api';
import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';

interface LocationPinProps {
  locationId: LocationId;
  label: string;
  top: string;
  left: string;
  unlocked: boolean;
  active: boolean;
  onTap: (locationId: LocationId) => void;
  targetLang?: TargetLang;
}

export function LocationPin({ locationId, label, top, left, unlocked, active, onTap, targetLang = 'ko' }: LocationPinProps) {
  const handleClick = () => {
    if (unlocked) onTap(locationId);
  };

  return (
    <div
      className={`location-pin${unlocked ? ' location-pin--unlocked' : ' location-pin--locked'}${active ? ' location-pin--active' : ''}`}
      style={{ top, left }}
      role={unlocked ? 'button' : undefined}
    >
      <div className="location-pin__dot" onClick={handleClick} />
      <span className="location-pin__label" onClick={handleClick}>
        <KoreanText text={label} targetLang={targetLang} onWordTap={unlocked ? handleClick : undefined} />
      </span>
    </div>
  );
}

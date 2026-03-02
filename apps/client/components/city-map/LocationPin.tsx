'use client';

import type { LocationId } from '@/lib/api';
import { KoreanText } from '@/components/shared/KoreanText';

interface LocationPinProps {
  locationId: LocationId;
  label: string;
  labelKo: string;
  top: string;
  left: string;
  unlocked: boolean;
  active: boolean;
  onTap: (locationId: LocationId) => void;
}

export function LocationPin({ locationId, label, labelKo, top, left, unlocked, active, onTap }: LocationPinProps) {
  const handleClick = () => {
    if (unlocked) onTap(locationId);
  };

  return (
    <div
      className={`location-pin${unlocked ? ' location-pin--unlocked' : ' location-pin--locked'}${active ? ' location-pin--active' : ''}`}
      style={{ top, left }}
      role={unlocked ? 'button' : undefined}
      title={!unlocked ? `${label} (locked)` : undefined}
    >
      <div className="location-pin__dot" onClick={handleClick} />
      <span className="location-pin__label" onClick={handleClick}>
        <KoreanText text={labelKo} />
      </span>
    </div>
  );
}

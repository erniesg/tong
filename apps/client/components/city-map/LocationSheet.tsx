'use client';

import type { LocationId } from '@/lib/api';

interface LocationSheetProps {
  locationId: LocationId;
  locationName: string;
  locationNameKo: string;
  hangoutCount: number;
  missionAvailable: boolean;
  comingSoon: boolean;
  onHangout: () => void;
  onLearn: () => void;
  onDismiss: () => void;
}

export function LocationSheet({
  locationName,
  locationNameKo,
  hangoutCount,
  missionAvailable,
  comingSoon,
  onHangout,
  onLearn,
  onDismiss,
}: LocationSheetProps) {
  const missionsNeeded = Math.max(0, 3 - hangoutCount);

  return (
    <>
      <div className="location-sheet-backdrop" onClick={onDismiss} />
      <div className="location-sheet">
        <div className="location-sheet__handle" />

        {/* Header: Korean name big, English small */}
        <div className="location-sheet__header">
          <div className="location-sheet__names">
            <span className="location-sheet__name-ko">{locationNameKo}</span>
            <span className="location-sheet__name-en">{locationName}</span>
          </div>
          {hangoutCount > 0 && (
            <span className="location-sheet__badge">
              {hangoutCount}x
            </span>
          )}
        </div>

        {comingSoon ? (
          <div className="location-sheet__actions">
            <p className="location-sheet__hint">This city is coming soon!</p>
          </div>
        ) : (
          <div className="location-sheet__actions">
            {/* Primary: Hangout */}
            <button
              className="location-sheet__btn location-sheet__btn--hangout"
              onClick={onHangout}
              type="button"
            >
              <span className="location-sheet__btn-icon" role="img" aria-label="hangout">🤜</span>
              <span className="location-sheet__btn-text">
                <span className="location-sheet__btn-label">Hangout</span>
                <span className="location-sheet__btn-desc">Practice conversation with locals</span>
              </span>
            </button>

            {/* Secondary: Learn */}
            <button
              className="location-sheet__btn location-sheet__btn--learn"
              onClick={onLearn}
              type="button"
            >
              <span className="location-sheet__btn-icon" role="img" aria-label="learn">📖</span>
              <span className="location-sheet__btn-text">
                <span className="location-sheet__btn-label">Learn</span>
                <span className="location-sheet__btn-desc">Study vocabulary & grammar</span>
              </span>
            </button>

            {/* Mission: always visible, locked until mastery */}
            <button
              className={`location-sheet__btn location-sheet__btn--mission${missionAvailable ? '' : ' location-sheet__btn--locked'}`}
              type="button"
              disabled={!missionAvailable}
            >
              <span className="location-sheet__btn-icon" role="img" aria-label="mission">{missionAvailable ? '⭐' : '🔒'}</span>
              <span className="location-sheet__btn-text">
                <span className="location-sheet__btn-label">Mission</span>
                <span className="location-sheet__btn-desc">
                  {missionAvailable
                    ? 'Clear this location!'
                    : missionsNeeded > 0
                      ? `Complete ${missionsNeeded} more hangout${missionsNeeded !== 1 ? 's' : ''} to unlock`
                      : 'Demonstrate mastery to unlock'}
                </span>
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

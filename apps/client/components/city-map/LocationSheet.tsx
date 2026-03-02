'use client';

import { useRef, useCallback } from 'react';
import type { LocationId } from '@/lib/api';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import { KoreanText } from '@/components/shared/KoreanText';

/** SP cost scales with hangout count (first is free, then 10, 25, 50). */
const SP_COSTS = [0, 10, 25, 50];

function getSpCost(hangoutCount: number): number {
  return SP_COSTS[Math.min(hangoutCount, SP_COSTS.length - 1)] ?? 50;
}

interface LocationSheetProps {
  locationId: LocationId;
  locationName: string;
  locationNameKo: string;
  targetLang?: 'ko' | 'ja' | 'zh';
  hangoutCount: number;
  missionAvailable: boolean;
  comingSoon: boolean;
  playerSp: number;
  onHangout: () => void;
  onLearn: () => void;
  onDismiss: () => void;
}

export function LocationSheet({
  locationName,
  locationNameKo,
  targetLang = 'ko',
  hangoutCount,
  missionAvailable,
  comingSoon,
  playerSp,
  onHangout,
  onLearn,
  onDismiss,
}: LocationSheetProps) {
  const lang = useUILang();
  const missionsNeeded = Math.max(0, 3 - hangoutCount);
  const spCost = getSpCost(hangoutCount);
  const canAfford = playerSp >= spCost;

  /* Swipe down to dismiss */
  const touchStartRef = useRef<number>(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - touchStartRef.current;
    if (dy > 40) onDismiss();
  }, [onDismiss]);

  return (
    <>
      <div className="location-sheet-backdrop" onClick={onDismiss} />
      <div
        className="location-drawer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar */}
        <div className="location-drawer__handle-bar" />

        {/* Header: local name + English + badge */}
        <div className="location-drawer__header">
          <div className="location-drawer__names">
            <span className="location-drawer__name-local"><KoreanText text={locationNameKo} targetLang={targetLang} /></span>
            <span className="location-drawer__name-en">{locationName}</span>
          </div>
          {hangoutCount > 0 && (
            <span className="location-drawer__badge">{hangoutCount}x</span>
          )}
        </div>

        {comingSoon ? (
          <p className="location-drawer__hint">{t('coming_soon', lang)}</p>
        ) : (
          <div className="location-drawer__actions">
            {/* Learn: primary, on top */}
            <button
              className="location-drawer__btn location-drawer__btn--learn"
              onClick={onLearn}
              type="button"
            >
              <span className="location-drawer__btn-icon" role="img" aria-label="learn">📖</span>
              <span className="location-drawer__btn-text">
                <span className="location-drawer__btn-label">{t('learn', lang)}</span>
                <span className="location-drawer__btn-desc">{t('learn_desc', lang)}</span>
              </span>
            </button>

            {/* Hangout: secondary */}
            <button
              className={`location-drawer__btn location-drawer__btn--hangout${!canAfford ? ' location-drawer__btn--locked' : ''}`}
              onClick={canAfford ? onHangout : undefined}
              disabled={!canAfford}
              type="button"
            >
              <span className="location-drawer__btn-icon" role="img" aria-label="hangout">🤜</span>
              <span className="location-drawer__btn-text">
                <span className="location-drawer__btn-label">
                  {t('hangout', lang)}
                  {spCost > 0 && (
                    <span className="location-drawer__sp-cost">{spCost} SP</span>
                  )}
                  {spCost === 0 && (
                    <span className="location-drawer__sp-cost">{t('free', lang)}</span>
                  )}
                </span>
                <span className="location-drawer__btn-desc">
                  {canAfford
                    ? t('hangout_desc', lang)
                    : `${t('need_sp', lang)} ${spCost} SP (${t('you_have', lang)} ${playerSp})`}
                </span>
              </span>
            </button>

            {/* Mission: always greyed out for now */}
            <button
              className="location-drawer__btn location-drawer__btn--mission location-drawer__btn--locked"
              type="button"
              disabled
            >
              <span className="location-drawer__btn-icon" role="img" aria-label="mission">🔒</span>
              <span className="location-drawer__btn-text">
                <span className="location-drawer__btn-label">{t('mission', lang)}</span>
                <span className="location-drawer__btn-desc">
                  {missionsNeeded > 0
                    ? `${missionsNeeded} ${t('mission_hangouts_needed', lang)}`
                    : t('mission_mastery', lang)}
                </span>
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

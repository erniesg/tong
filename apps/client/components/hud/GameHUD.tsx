'use client';

import { useRef, useState, useCallback } from 'react';
import type { CityId, AppLang } from '@/lib/api';
import { dispatch } from '@/lib/store/game-store';

const EXPLAIN_LANG_OPTIONS: { value: AppLang; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
];

interface GameHUDProps {
  xp: number;
  sp: number;
  /** Optional RP score (shown in hangout, hidden on map) */
  rp?: number;
  /** Optional location line e.g. "Seoul 서울 · Food Street" */
  locationLabel?: React.ReactNode;
  /** Current city for language toggle */
  cityId: CityId;
  /** Current explainIn language for this city */
  explainLang: AppLang;
  /** Optional charge bar progress 0-100 (hidden when undefined) */
  chargeProgress?: number;
  /** Label shown on the charge bar */
  chargeLabel?: string;
  /** Whether the charge is complete (triggers shimmer) */
  chargeComplete?: boolean;
}

/**
 * Reusable swipe-down HUD drawer.
 * Render this inside a `.game-frame` — it positions itself absolutely.
 * The parent must forward touch events via the returned swipe handlers,
 * OR just wrap with `<GameHUD.SwipeZone>`.
 */
export function GameHUD({ xp, sp, rp, locationLabel, cityId, explainLang, chargeProgress, chargeLabel, chargeComplete }: GameHUDProps) {
  const [open, setOpen] = useState(false);
  const touchStartRef = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - touchStartRef.current;
    if (touchStartRef.current < 80) {
      if (dy > 40) setOpen(true);
      if (dy < -40) setOpen(false);
    } else if (open && dy < -40) {
      setOpen(false);
    }
  }, [open]);

  return (
    <>
      {/* Pull tab — always visible */}
      <div
        className="scene-hud-pull-tab"
        onClick={() => setOpen((o) => !o)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <span className="scene-hud-pull-tab-chevron">{open ? '▲' : '▼'}</span>
      </div>
      {/* HUD drawer */}
      <div className={`scene-hud ${open ? 'scene-hud--open' : ''}`}>
        {locationLabel && (
          <div className="scene-hud-location">{locationLabel}</div>
        )}
        <div className="scene-hud-scores">
          <span className="scene-hud-score"><b>{xp}</b> XP</span>
          <span className="scene-hud-score"><b>{sp}</b> SP</span>
          {rp !== undefined && (
            <span className="scene-hud-score"><b>{Math.round(rp)}</b> RP</span>
          )}
        </div>
        <div className="scene-hud-flags">
          {EXPLAIN_LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`scene-hud-flag-btn${explainLang === opt.value ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId, lang: opt.value })}
              type="button"
              title={opt.label}
            >
              {opt.flag}
            </button>
          ))}
        </div>
        {chargeProgress !== undefined && (
          <div className={`charge-bar-inline${chargeComplete ? ' charge-bar-inline--complete' : ''}`}>
            <div className="charge-bar__track">
              <div
                className="charge-bar__fill"
                style={{ width: `${Math.max(0, Math.min(100, chargeProgress))}%` }}
              />
              {chargeComplete && <div className="charge-bar__shimmer" />}
            </div>
            {chargeLabel && <div className="charge-bar__label">{chargeLabel}</div>}
          </div>
        )}
      </div>
    </>
  );
}

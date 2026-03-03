'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CityId, LocationId } from '@/lib/api';
import type { GameState } from '@/lib/store/game-store';
import { getLocationHangoutCount, isLocationUnlocked, isMissionAvailable } from '@/lib/store/game-store';
import { LocationPin } from './LocationPin';
import { LocationSheet } from './LocationSheet';
import { KoreanText } from '@/components/shared/KoreanText';
import { getLanguageForCity } from '@/lib/content/locations';

/* ── Constants ──────────────────────────────────────────────── */

const CITY_ORDER: CityId[] = ['tokyo', 'seoul', 'shanghai'];

const CITY_META: Record<CityId, { en: string; local: string; hasVideo: boolean }> = {
  tokyo:    { en: 'Tokyo',    local: '東京', hasVideo: true },
  seoul:    { en: 'Seoul',    local: '서울', hasVideo: true },
  shanghai: { en: 'Shanghai', local: '上海', hasVideo: true },
};

/* ── Per-city location configs ────────────────────────────────── */

interface LocationConfig {
  id: LocationId;
  en: string;
  local: string;
  top: string;
  left: string;
}

const CITY_LOCATIONS: Record<CityId, LocationConfig[]> = {
  seoul: [
    // Positions matched to Seoul video landmarks
    { id: 'practice_studio',   en: 'Chimaek Place',      local: '치맥',       top: '22%', left: '25%' },
    { id: 'convenience_store', en: 'Convenience Store',   local: '편의점',     top: '48%', left: '22%' },
    { id: 'subway_hub',        en: 'Subway Hub',          local: '지하철',     top: '68%', left: '48%' },
    { id: 'cafe',              en: 'Cafe',                local: '카페',       top: '52%', left: '82%' },
    { id: 'food_street',       en: 'Food Street',         local: '먹자골목',   top: '88%', left: '25%' },
  ],
  shanghai: [
    // Positions matched to Shanghai video landmarks (generic local names)
    { id: 'metro_station',     en: 'Metro Station',       local: '地铁站',     top: '28%', left: '18%' },
    { id: 'bbq_stall',         en: 'BBQ Stall',           local: '烧烤摊',     top: '22%', left: '82%' },
    { id: 'convenience_store', en: 'Convenience Store',   local: '便利店',     top: '58%', left: '72%' },
    { id: 'milk_tea_shop',     en: 'Milk Tea Shop',       local: '奶茶店',     top: '75%', left: '22%' },
    { id: 'dumpling_shop',     en: 'Dumpling Shop',       local: '小笼包店',   top: '88%', left: '75%' },
  ],
  tokyo: [
    { id: 'train_station', en: 'Train Station',      local: '駅',         top: '22%', left: '18%' },
    { id: 'izakaya',       en: 'Izakaya',             local: '居酒屋',     top: '18%', left: '72%' },
    { id: 'konbini',       en: 'Convenience Store',   local: 'コンビニ',   top: '40%', left: '75%' },
    { id: 'tea_house',     en: 'Tea House',            local: '茶屋',       top: '55%', left: '18%' },
    { id: 'ramen_shop',    en: 'Ramen Shop',           local: 'ラーメン屋', top: '82%', left: '72%' },
  ],
};

const SWIPE_THRESHOLD = 50;
const DISSOLVE_SECONDS = 1.5;

/* ── Props ──────────────────────────────────────────────────── */

interface CityMapProps {
  activeCityIndex: number;
  onCityChange: (index: number) => void;
  selectedLocation: LocationId | null;
  onSelectLocation: (loc: LocationId | null) => void;
  onStartHangout: (cityId: CityId, locationId: LocationId) => void;
  onStartLearn: (cityId: CityId, locationId: LocationId) => void;
  onReviewSession?: (session: import('@/lib/store/session-store').CompletedSession) => void;
  gameState: GameState;
}

/* ── Component ──────────────────────────────────────────────── */

export function CityMap({
  activeCityIndex,
  onCityChange,
  selectedLocation,
  onSelectLocation,
  onStartHangout,
  onStartLearn,
  onReviewSession,
  gameState,
}: CityMapProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  /* Two video refs for dissolve looping */
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  const city = CITY_ORDER[activeCityIndex];
  const meta = CITY_META[city];
  const comingSoon = !meta.hasVideo;
  const locations = CITY_LOCATIONS[city] ?? [];
  const targetLang = getLanguageForCity(city);

  /* ── Two-video dissolve loop ─────────────────────────────── */

  useEffect(() => {
    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (!vA || !vB || !meta.hasVideo) return;

    let active: 'A' | 'B' = 'A';
    let dissolving = false;

    function getActive() { return active === 'A' ? vA! : vB!; }
    function getStandby() { return active === 'A' ? vB! : vA!; }

    function onTimeUpdate() {
      if (dissolving) return;
      const cur = getActive();
      if (!cur.duration || cur.duration === Infinity) return;
      const remaining = cur.duration - cur.currentTime;

      if (remaining > 0 && remaining < DISSOLVE_SECONDS) {
        dissolving = true;
        const standby = getStandby();
        standby.currentTime = 0;
        standby.play().catch(() => {});

        // Crossfade: fade out active, fade in standby
        cur.style.opacity = '0';
        standby.style.opacity = '1';
      }
    }

    function onEnded(this: HTMLVideoElement) {
      // The old active video has ended; standby is now playing
      this.pause();
      this.currentTime = 0;
      active = active === 'A' ? 'B' : 'A';
      dissolving = false;
    }

    // Setup: A plays, B hidden
    vA.currentTime = 0;
    vB.currentTime = 0;
    vA.style.opacity = '1';
    vB.style.opacity = '0';
    vA.play().catch(() => {});
    vB.pause();

    vA.addEventListener('timeupdate', onTimeUpdate);
    vB.addEventListener('timeupdate', onTimeUpdate);
    vA.addEventListener('ended', onEnded);
    vB.addEventListener('ended', onEnded);

    return () => {
      vA.removeEventListener('timeupdate', onTimeUpdate);
      vB.removeEventListener('timeupdate', onTimeUpdate);
      vA.removeEventListener('ended', onEnded);
      vB.removeEventListener('ended', onEnded);
      vA.pause();
      vB.pause();
    };
  }, [city, meta.hasVideo]);

  /* ── Swipe handling ─────────────────────────────────────── */

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    setDragOffset(dx * 0.3);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    touchStartRef.current = null;
    setDragOffset(0);

    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0 && activeCityIndex > 0) {
        onCityChange(activeCityIndex - 1);
      } else if (dx < 0 && activeCityIndex < CITY_ORDER.length - 1) {
        onCityChange(activeCityIndex + 1);
      }
    }
  }, [activeCityIndex, onCityChange]);

  /* ── Keyboard navigation ────────────────────────────────── */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && activeCityIndex > 0) {
        onCityChange(activeCityIndex - 1);
      } else if (e.key === 'ArrowRight' && activeCityIndex < CITY_ORDER.length - 1) {
        onCityChange(activeCityIndex + 1);
      } else if (e.key === 'Escape' && selectedLocation) {
        onSelectLocation(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCityIndex, onCityChange, selectedLocation, onSelectLocation]);

  /* ── Pin tap ────────────────────────────────────────────── */

  const handlePinTap = useCallback((locId: LocationId) => {
    onSelectLocation(locId);
  }, [onSelectLocation]);

  /* ── Arrow navigation ──────────────────────────────────── */

  const goLeft = useCallback(() => {
    if (activeCityIndex > 0) onCityChange(activeCityIndex - 1);
  }, [activeCityIndex, onCityChange]);

  const goRight = useCallback(() => {
    if (activeCityIndex < CITY_ORDER.length - 1) onCityChange(activeCityIndex + 1);
  }, [activeCityIndex, onCityChange]);

  /* ── Background ─────────────────────────────────────────── */

  const bgStyle = { transform: `translateX(${dragOffset}px)` };
  const videoSrc = `/assets/locations/${city}.mp4`;

  return (
    <div
      className="city-map"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video backgrounds (two for dissolve) / static image */}
      {meta.hasVideo ? (
        <>
          <video
            ref={videoARef}
            key={`${city}-A`}
            className="city-map__bg city-map__bg--dissolve"
            style={bgStyle}
            muted
            playsInline
            preload="auto"
            poster={`/assets/locations/${city}-static.png`}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
          <video
            ref={videoBRef}
            key={`${city}-B`}
            className="city-map__bg city-map__bg--dissolve"
            style={{ ...bgStyle, opacity: 0 }}
            muted
            playsInline
            preload="auto"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        </>
      ) : (
        <img
          key={city}
          className={`city-map__bg${comingSoon ? ' city-map__bg--greyscale' : ''}`}
          style={bgStyle}
          src={`/assets/locations/${city}-static.png`}
          alt={meta.en}
        />
      )}

      {/* Dark gradient overlay */}
      <div className="city-map__overlay" />

      {/* Coming soon text */}
      {comingSoon && <div className="city-map__coming-soon">Coming Soon</div>}

      {/* City title */}
      <div className="city-map__title">
        <div className="city-map__title-en">{meta.en}</div>
        <div className="city-map__title-local"><KoreanText text={meta.local} targetLang={targetLang} /></div>
      </div>

      {/* Location pins */}
      {locations.map((loc) => {
        const unlocked = isLocationUnlocked(city, loc.id);
        return (
          <LocationPin
            key={loc.id}
            locationId={loc.id}
            label={loc.en}
            labelKo={loc.local}
            top={loc.top}
            left={loc.left}
            unlocked={unlocked}
            active={selectedLocation === loc.id}
            onTap={handlePinTap}
            targetLang={targetLang}
          />
        );
      })}

      {/* Bottom sheet */}
      {selectedLocation && (() => {
        const loc = locations.find((l) => l.id === selectedLocation);
        if (!loc) return null;
        return (
          <LocationSheet
            locationId={selectedLocation}
            locationName={loc.en}
            locationNameKo={loc.local}
            targetLang={targetLang}
            cityId={city}
            hangoutCount={getLocationHangoutCount(city, selectedLocation)}
            missionAvailable={isMissionAvailable(city, selectedLocation)}
            comingSoon={comingSoon}
            playerSp={gameState.sp}
            onHangout={() => onStartHangout(city, selectedLocation)}
            onLearn={() => onStartLearn(city, selectedLocation)}
            onReviewSession={onReviewSession}
            onDismiss={() => onSelectLocation(null)}
          />
        );
      })()}

      {/* Navigation arrows */}
      {activeCityIndex > 0 && (
        <div
          className="city-map__arrow city-map__arrow--left"
          onClick={goLeft}
          role="button"
          tabIndex={0}
        >
          &#8249;
        </div>
      )}
      {activeCityIndex < CITY_ORDER.length - 1 && (
        <div
          className="city-map__arrow city-map__arrow--right"
          onClick={goRight}
          role="button"
          tabIndex={0}
        >
          &#8250;
        </div>
      )}

      {/* City indicator dots */}
      <div className="city-map__dots">
        {CITY_ORDER.map((c, i) => (
          <div
            key={c}
            className={`city-map__dot${i === activeCityIndex ? ' city-map__dot--active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

export { CITY_ORDER };

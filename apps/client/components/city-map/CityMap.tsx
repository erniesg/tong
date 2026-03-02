'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CityId, LocationId } from '@/lib/api';
import type { GameState } from '@/lib/store/game-store';
import { getLocationHangoutCount, isLocationUnlocked, isMissionAvailable } from '@/lib/store/game-store';
import { LocationPin } from './LocationPin';
import { LocationSheet } from './LocationSheet';

/* ── Constants ──────────────────────────────────────────────── */

const CITY_ORDER: CityId[] = ['tokyo', 'seoul', 'shanghai'];

const CITY_META: Record<CityId, { en: string; local: string; hasVideo: boolean }> = {
  tokyo:    { en: 'Tokyo',    local: '東京', hasVideo: false },
  seoul:    { en: 'Seoul',    local: '서울', hasVideo: true },
  shanghai: { en: 'Shanghai', local: '上海', hasVideo: true },
};

// Korean labels match the actual signs visible in the Seoul video
const LOCATION_NAMES: Record<LocationId, { en: string; ko: string }> = {
  food_street:       { en: 'Food Street',       ko: '먹자골목' },
  cafe:              { en: 'Cafe',               ko: '카페' },
  convenience_store: { en: 'Convenience Store',  ko: 'CU 편의점' },
  subway_hub:        { en: 'Subway Hub',         ko: '지하철' },
  practice_studio:   { en: 'Chimaek Place',      ko: '치맥' },
};

// Pin positions matched to Seoul video landmarks (from annotated still):
// - practice_studio (치맥): rooftop chicken+beer restaurant, top-left
// - convenience_store (CU): green CU storefront, mid-left
// - subway_hub (지하철): subway entrance with blue sign, center-bottom
// - cafe (카페): pink building + cake display, mid-right
// - food_street (먹자골목): orange tent + steaming hotpot, bottom-left
const LOCATION_POSITIONS: Record<LocationId, { top: string; left: string }> = {
  practice_studio:   { top: '22%', left: '25%' },
  convenience_store: { top: '48%', left: '22%' },
  subway_hub:        { top: '68%', left: '48%' },
  cafe:              { top: '52%', left: '82%' },
  food_street:       { top: '88%', left: '25%' },
};

const ALL_LOCATIONS: LocationId[] = ['food_street', 'cafe', 'convenience_store', 'subway_hub', 'practice_studio'];

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
  gameState,
}: CityMapProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  /* Two video refs for dissolve looping */
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  const city = CITY_ORDER[activeCityIndex];
  const meta = CITY_META[city];
  const comingSoon = !meta.hasVideo && city !== 'seoul';
  const isSeoul = city === 'seoul';

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
        <div className="city-map__title-local">{meta.local}</div>
      </div>

      {/* Location pins (only for Seoul) */}
      {isSeoul && ALL_LOCATIONS.map((locId) => {
        const pos = LOCATION_POSITIONS[locId];
        const names = LOCATION_NAMES[locId];
        const unlocked = isLocationUnlocked(city, locId);
        return (
          <LocationPin
            key={locId}
            locationId={locId}
            label={names.en}
            labelKo={names.ko}
            top={pos.top}
            left={pos.left}
            unlocked={unlocked}
            active={selectedLocation === locId}
            onTap={handlePinTap}
          />
        );
      })}

      {/* Bottom sheet */}
      {selectedLocation && (
        <LocationSheet
          locationId={selectedLocation}
          locationName={LOCATION_NAMES[selectedLocation].en}
          locationNameKo={LOCATION_NAMES[selectedLocation].ko}
          hangoutCount={getLocationHangoutCount(city, selectedLocation)}
          missionAvailable={isMissionAvailable(city, selectedLocation)}
          comingSoon={comingSoon}
          onHangout={() => onStartHangout(city, selectedLocation)}
          onLearn={() => onStartLearn(city, selectedLocation)}
          onDismiss={() => onSelectLocation(null)}
        />
      )}

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

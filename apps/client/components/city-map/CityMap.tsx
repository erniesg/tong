'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CityId, LocationId } from '@/lib/api';
import type { GameState } from '@/lib/store/game-store';
import { getLocationHangoutCount, isLocationUnlocked, isMissionAvailable } from '@/lib/store/game-store';
import { LocationPin } from './LocationPin';
import { LocationSheet } from './LocationSheet';
import { KoreanText } from '@/components/shared/KoreanText';
import { getLanguageForCity } from '@/lib/content/locations';
import { fallbackRuntimeAssetCandidates, runtimeAssetUrl } from '@/lib/runtime-assets';

/* ── Constants ──────────────────────────────────────────────── */

const CITY_ORDER: CityId[] = ['tokyo', 'seoul', 'shanghai'];

const CITY_META: Record<CityId, { en: string; local: string; hasVideo: boolean }> = {
  tokyo:    { en: 'Tokyo',    local: '東京', hasVideo: true },
  seoul:    { en: 'Seoul',    local: '서울', hasVideo: true },
  shanghai: { en: 'Shanghai', local: '上海', hasVideo: true },
};

const CITY_MEDIA: Record<CityId, { poster: string; video: string }> = {
  tokyo: {
    poster: runtimeAssetUrl('city.tokyo.map.static.default'),
    video: runtimeAssetUrl('city.tokyo.map.video.default'),
  },
  seoul: {
    poster: runtimeAssetUrl('city.seoul.map.static.default'),
    video: runtimeAssetUrl('city.seoul.map.video.default'),
  },
  shanghai: {
    poster: runtimeAssetUrl('city.shanghai.map.static.default'),
    video: runtimeAssetUrl('city.shanghai.map.video.default'),
  },
};

/* ── Per-city location configs ────────────────────────────────── */

interface LocationConfig {
  id: LocationId;
  labels: { en: string; ko: string; ja: string; zh: string };
  top: string;
  left: string;
}

const CITY_LOCATIONS: Record<CityId, LocationConfig[]> = {
  seoul: [
    { id: 'practice_studio',   labels: { en: 'Chimaek Place',    ko: '치맥',     ja: 'チメク',         zh: '炸鸡啤酒' },   top: '22%', left: '25%' },
    { id: 'convenience_store', labels: { en: 'Convenience Store', ko: '편의점',   ja: 'コンビニ',       zh: '便利店' },     top: '48%', left: '22%' },
    { id: 'subway_hub',        labels: { en: 'Subway Hub',        ko: '지하철',   ja: '地下鉄',         zh: '地铁站' },     top: '68%', left: '48%' },
    { id: 'cafe',              labels: { en: 'Cafe',              ko: '카페',     ja: 'カフェ',         zh: '咖啡馆' },     top: '52%', left: '82%' },
    { id: 'food_street',       labels: { en: 'Food Street',       ko: '먹자골목', ja: '食べ歩き通り',   zh: '美食街' },     top: '88%', left: '25%' },
  ],
  shanghai: [
    { id: 'metro_station',     labels: { en: 'Metro Station',     ko: '지하철역',   ja: '地下鉄駅',       zh: '地铁站' },   top: '28%', left: '18%' },
    { id: 'bbq_stall',         labels: { en: 'BBQ Stall',         ko: '바비큐 노점', ja: 'BBQ屋台',       zh: '烧烤摊' },   top: '22%', left: '82%' },
    { id: 'convenience_store', labels: { en: 'Convenience Store', ko: '편의점',     ja: 'コンビニ',       zh: '便利店' },   top: '58%', left: '72%' },
    { id: 'milk_tea_shop',     labels: { en: 'Milk Tea Shop',     ko: '밀크티 가게', ja: 'ミルクティー店', zh: '奶茶店' },   top: '75%', left: '22%' },
    { id: 'dumpling_shop',     labels: { en: 'Dumpling Shop',     ko: '만두 가게',   ja: '小籠包店',       zh: '小笼包店' }, top: '88%', left: '75%' },
  ],
  tokyo: [
    { id: 'train_station', labels: { en: 'Train Station',      ko: '기차역',     ja: '駅',           zh: '车站' },     top: '22%', left: '18%' },
    { id: 'izakaya',       labels: { en: 'Izakaya',             ko: '이자카야',   ja: '居酒屋',       zh: '居酒屋' },   top: '18%', left: '72%' },
    { id: 'konbini',       labels: { en: 'Convenience Store',   ko: '편의점',     ja: 'コンビニ',     zh: '便利店' },   top: '40%', left: '75%' },
    { id: 'tea_house',     labels: { en: 'Tea House',            ko: '찻집',       ja: '茶屋',         zh: '茶馆' },     top: '55%', left: '18%' },
    { id: 'ramen_shop',    labels: { en: 'Ramen Shop',           ko: '라멘 가게',  ja: 'ラーメン屋',   zh: '拉面店' },   top: '82%', left: '72%' },
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
  const [videoCandidateIndex, setVideoCandidateIndex] = useState(0);
  const [posterCandidateIndex, setPosterCandidateIndex] = useState(0);

  /* Two video refs for dissolve looping */
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  const city = CITY_ORDER[activeCityIndex];
  const meta = CITY_META[city];
  const comingSoon = !meta.hasVideo;
  const locations = CITY_LOCATIONS[city] ?? [];
  const targetLang = getLanguageForCity(city);
  const explainLang = gameState.explainIn[city] ?? 'en';
  const cityMedia = CITY_MEDIA[city];
  const videoCandidates = fallbackRuntimeAssetCandidates(cityMedia.video);
  const posterCandidates = fallbackRuntimeAssetCandidates(cityMedia.poster);
  const videoSrc = videoCandidates[videoCandidateIndex] ?? '';
  const posterSrc = posterCandidates[posterCandidateIndex] ?? cityMedia.poster;

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
  }, [city, meta.hasVideo, videoSrc, posterSrc]);

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

  useEffect(() => {
    setVideoCandidateIndex(0);
    setPosterCandidateIndex(0);
  }, [city]);

  return (
    <div
      className="city-map"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video backgrounds (two for dissolve) / static image */}
      {meta.hasVideo && videoSrc ? (
        <>
          <video
            ref={videoARef}
            key={`${city}-A`}
            className="city-map__bg city-map__bg--dissolve"
            style={bgStyle}
            muted
            playsInline
            preload="auto"
            poster={posterSrc}
            onError={() => {
              if (posterCandidateIndex + 1 < posterCandidates.length) {
                setPosterCandidateIndex(posterCandidateIndex + 1);
              }
              if (videoCandidateIndex + 1 < videoCandidates.length) {
                setVideoCandidateIndex(videoCandidateIndex + 1);
              }
            }}
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
            poster={posterSrc}
            onError={() => {
              if (posterCandidateIndex + 1 < posterCandidates.length) {
                setPosterCandidateIndex(posterCandidateIndex + 1);
              }
              if (videoCandidateIndex + 1 < videoCandidates.length) {
                setVideoCandidateIndex(videoCandidateIndex + 1);
              }
            }}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        </>
      ) : (
        <img
          key={city}
          className={`city-map__bg${comingSoon ? ' city-map__bg--greyscale' : ''}`}
          style={bgStyle}
          src={posterSrc}
          alt={meta.en}
          onError={() => {
            if (posterCandidateIndex + 1 < posterCandidates.length) {
              setPosterCandidateIndex(posterCandidateIndex + 1);
            }
          }}
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
        const pinLabel = loc.labels[explainLang] ?? loc.labels.en;
        return (
          <LocationPin
            key={loc.id}
            locationId={loc.id}
            label={pinLabel}
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
        const sheetLabel = loc.labels[explainLang] ?? loc.labels.en;
        const sheetLocal = loc.labels[targetLang] ?? loc.labels.en;
        return (
          <LocationSheet
            locationId={selectedLocation}
            locationName={sheetLabel}
            locationNameLocal={sheetLocal}
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

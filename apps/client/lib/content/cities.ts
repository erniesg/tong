import type { CityId, LocationId } from '@/lib/api';

export interface CityRegistryEntry {
  id: CityId;
  label: string;
  localLabel: string;
  language: 'ko' | 'ja' | 'zh';
  defaultLocation: LocationId;
}

export const CITIES_REGISTRY: Record<CityId, CityRegistryEntry> = {
  seoul: {
    id: 'seoul',
    label: 'Seoul',
    localLabel: '서울',
    language: 'ko',
    defaultLocation: 'food_street',
  },
  tokyo: {
    id: 'tokyo',
    label: 'Tokyo',
    localLabel: '東京',
    language: 'ja',
    defaultLocation: 'ramen_shop',
  },
  shanghai: {
    id: 'shanghai',
    label: 'Shanghai',
    localLabel: '上海',
    language: 'zh',
    defaultLocation: 'dumpling_shop',
  },
};

export function getCityOrDefault(cityId: CityId): CityRegistryEntry {
  return CITIES_REGISTRY[cityId] ?? CITIES_REGISTRY.seoul;
}

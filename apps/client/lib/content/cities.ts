import type { CityId } from '@/lib/api';

export interface CityContent {
  id: CityId;
  name: {
    en: string;
    local: string;
  };
  language: 'ko' | 'ja' | 'zh';
  defaultLocationId: string;
  locationIds: string[];
}

export const CITY_REGISTRY: Record<CityId, CityContent> = {
  seoul: {
    id: 'seoul',
    name: { en: 'Seoul', local: '서울' },
    language: 'ko',
    defaultLocationId: 'food_street',
    locationIds: ['food_street', 'cafe', 'convenience_store', 'subway_hub', 'practice_studio'],
  },
  tokyo: {
    id: 'tokyo',
    name: { en: 'Tokyo', local: '東京' },
    language: 'ja',
    defaultLocationId: 'train_station',
    locationIds: ['train_station', 'izakaya', 'konbini', 'tea_house', 'ramen_shop'],
  },
  shanghai: {
    id: 'shanghai',
    name: { en: 'Shanghai', local: '上海' },
    language: 'zh',
    defaultLocationId: 'dumpling_shop',
    locationIds: ['metro_station', 'bbq_stall', 'convenience_store', 'milk_tea_shop', 'dumpling_shop', 'xiaolongbao'],
  },
};

export function getCity(cityId: CityId): CityContent {
  return CITY_REGISTRY[cityId];
}

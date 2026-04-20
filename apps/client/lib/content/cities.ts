export interface CityRegistryEntry {
  id: 'seoul' | 'tokyo' | 'shanghai';
  name: {
    en: string;
    local: string;
  };
  language: 'ko' | 'ja' | 'zh';
  locationIds: string[];
}

export const CITY_REGISTRY: Record<CityRegistryEntry['id'], CityRegistryEntry> = {
  seoul: {
    id: 'seoul',
    name: { en: 'Seoul', local: '서울' },
    language: 'ko',
    locationIds: ['food_street', 'cafe', 'convenience_store', 'subway_hub', 'practice_studio'],
  },
  tokyo: {
    id: 'tokyo',
    name: { en: 'Tokyo', local: '東京' },
    language: 'ja',
    locationIds: ['train_station', 'izakaya', 'konbini', 'tea_house', 'ramen_shop'],
  },
  shanghai: {
    id: 'shanghai',
    name: { en: 'Shanghai', local: '上海' },
    language: 'zh',
    locationIds: ['metro_station', 'bbq_stall', 'convenience_store', 'milk_tea_shop', 'xiaolongbao'],
  },
};

export function getCityRegistryEntry(cityId: CityRegistryEntry['id']): CityRegistryEntry {
  return CITY_REGISTRY[cityId];
}

export function getCitiesRegistry(): CityRegistryEntry[] {
  return Object.values(CITY_REGISTRY);
}

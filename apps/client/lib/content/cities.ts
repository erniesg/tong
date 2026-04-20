export interface CityRegistryEntry {
  id: 'seoul' | 'tokyo' | 'shanghai';
  name: string;
  nativeName: string;
  language: 'ko' | 'ja' | 'zh';
  defaultLocationId: string;
  locationIds: string[];
}

export const CITY_REGISTRY: Record<CityRegistryEntry['id'], CityRegistryEntry> = {
  seoul: {
    id: 'seoul',
    name: 'Seoul',
    nativeName: '서울',
    language: 'ko',
    defaultLocationId: 'food_street',
    locationIds: ['food_street', 'cafe', 'convenience_store', 'subway_hub', 'practice_studio'],
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo',
    nativeName: '東京',
    language: 'ja',
    defaultLocationId: 'train_station',
    locationIds: ['train_station', 'izakaya', 'konbini', 'tea_house', 'ramen_shop'],
  },
  shanghai: {
    id: 'shanghai',
    name: 'Shanghai',
    nativeName: '上海',
    language: 'zh',
    defaultLocationId: 'xiaolongbao',
    locationIds: ['metro_station', 'bbq_stall', 'convenience_store', 'milk_tea_shop', 'xiaolongbao'],
  },
};

export function getCityRegistryEntry(cityId: CityRegistryEntry['id']): CityRegistryEntry {
  return CITY_REGISTRY[cityId];
}

export function getRegisteredCities(): CityRegistryEntry[] {
  return Object.values(CITY_REGISTRY);
}

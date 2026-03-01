export type CitySkinId = 'seoul' | 'tokyo' | 'shanghai';

const CITY_TO_SKIN: Record<string, CitySkinId> = {
  seoul: 'seoul',
  tokyo: 'tokyo',
  shanghai: 'shanghai',
};

/** Map a city ID to its messaging-app skin. Defaults to 'seoul'. */
export function getCitySkin(cityId: string): CitySkinId {
  return CITY_TO_SKIN[cityId] ?? 'seoul';
}

export const SKIN_LABELS: Record<CitySkinId, string> = {
  seoul: 'KakaoTalk',
  tokyo: 'LINE',
  shanghai: 'WeChat',
};

import type { HanjaEntry } from './types';
import { getHanjaMap } from './loader';

/**
 * Look up a Korean word and return its Hanja equivalent.
 * Returns null if no Hanja mapping exists.
 */
export async function lookupHanja(koreanWord: string): Promise<HanjaEntry | null> {
  if (!koreanWord) return null;

  const hanjaMap = await getHanjaMap();
  const entry = hanjaMap.get(koreanWord);
  return entry || null;
}

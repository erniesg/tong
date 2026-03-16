import { getVariantMaps } from './loader';

/**
 * Convert text from traditional to simplified Chinese (character-level).
 */
export async function toSimplified(text: string): Promise<string> {
  const { traditionalToSimplified } = await getVariantMaps();
  return [...text].map(c => traditionalToSimplified[c] || c).join('');
}

/**
 * Convert text from simplified to traditional Chinese (character-level).
 */
export async function toTraditional(text: string): Promise<string> {
  const { simplifiedToTraditional } = await getVariantMaps();
  return [...text].map(c => simplifiedToTraditional[c] || c).join('');
}

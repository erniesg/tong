import type { RawHanziEntry, UnihanReading, HanjaEntry, VariantMaps } from './types';

// Chrome extension API type (available when running in extension context)
declare const chrome: { runtime?: { getURL?: (path: string) => string } } | undefined;

// Lazy-loaded data stores
let hanziMap: Map<string, RawHanziEntry> | null = null;
let unihanMap: Map<string, UnihanReading> | null = null;
let hanjaMap: Map<string, HanjaEntry> | null = null;
let variantMaps: VariantMaps | null = null;

/**
 * Load a JSON data file.
 * - In Chrome extension: fetches via chrome.runtime.getURL
 * - In Node.js/tests: reads from the data/ directory using fs
 */
async function loadJson<T>(filename: string): Promise<T> {
  // Chrome extension context
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    const url = chrome.runtime.getURL(`assets/cjk-data/${filename}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  // Node.js / test context — use dynamic import of fs
  // @ts-expect-error Node.js modules not available in extension context
  const { readFileSync } = await import('fs');
  // @ts-expect-error Node.js modules not available in extension context
  const { join, dirname } = await import('path');
  // @ts-expect-error Node.js modules not available in extension context
  const { fileURLToPath } = await import('url');
  const dir = dirname(fileURLToPath(import.meta.url));
  const filePath = join(dir, '..', 'data', filename);
  const text = readFileSync(filePath, 'utf-8');
  return JSON.parse(text) as T;
}

export async function getHanziMap(): Promise<Map<string, RawHanziEntry>> {
  if (hanziMap) return hanziMap;

  const data = await loadJson<Record<string, RawHanziEntry>>('hanzi-decomposition.json');
  hanziMap = new Map(Object.entries(data));
  return hanziMap;
}

export async function getUnihanMap(): Promise<Map<string, UnihanReading>> {
  if (unihanMap) return unihanMap;

  const data = await loadJson<Record<string, UnihanReading>>('unihan-readings.json');
  unihanMap = new Map(Object.entries(data));
  return unihanMap;
}

export async function getHanjaMap(): Promise<Map<string, HanjaEntry>> {
  if (hanjaMap) return hanjaMap;

  const data = await loadJson<Record<string, HanjaEntry>>('kengdic-hanja.json');
  hanjaMap = new Map(Object.entries(data));
  return hanjaMap;
}

export async function getVariantMaps(): Promise<VariantMaps> {
  if (variantMaps) return variantMaps;

  variantMaps = await loadJson<VariantMaps>('unihan-variants.json');
  return variantMaps;
}

/** Reset all caches (useful for testing) */
export function resetCaches() {
  hanziMap = null;
  unihanMap = null;
  hanjaMap = null;
  variantMaps = null;
}

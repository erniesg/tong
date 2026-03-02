/**
 * Dynamic translation cache — fetches from /api/ai/translate on miss,
 * caches in memory + localStorage so each word is only translated once.
 */

const STORAGE_KEY = 'tong:translations';
const MAX_BATCH = 20;
const DEBOUNCE_MS = 300;

// In-memory cache: `{word}:{from}:{to}` → translation
const cache = new Map<string, string>();

// Pending words waiting to be batch-fetched
const pending = new Map<string, Set<string>>(); // batchKey → Set<word>
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// Listeners for when translations arrive
const listeners = new Set<() => void>();

function cacheKey(word: string, from: string, to: string): string {
  return `${word}:${from}:${to}`;
}

function batchKey(from: string, to: string): string {
  return `${from}:${to}`;
}

/** Load cache from localStorage on init. */
function loadFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) {
        cache.set(k, v);
      }
    }
  } catch { /* ignore */ }
}

/** Persist cache to localStorage. */
function saveToStorage() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of cache.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

/** Get a cached translation, or null if not yet fetched. */
export function getCachedTranslation(word: string, from: string, to: string): string | null {
  if (from === to) return word; // same language, no translation needed
  const key = cacheKey(word, from, to);
  return cache.get(key) ?? null;
}

/** Register a listener that fires when new translations arrive. */
export function onTranslationsReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Request translations for a list of words. Batches and debounces. */
export function requestTranslations(words: string[], from: string, to: string) {
  if (from === to || !words.length) return;

  const bk = batchKey(from, to);
  if (!pending.has(bk)) pending.set(bk, new Set());
  const set = pending.get(bk)!;

  for (const w of words) {
    const key = cacheKey(w, from, to);
    if (!cache.has(key)) {
      set.add(w);
    }
  }

  // Debounce the actual fetch
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushPending, DEBOUNCE_MS);
}

async function flushPending() {
  const batches = Array.from(pending.entries());
  pending.clear();

  for (const [bk, words] of batches) {
    if (words.size === 0) continue;
    const [from, to] = bk.split(':');
    const batch = Array.from(words).slice(0, MAX_BATCH);

    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: batch, from, to }),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const translations = data.translations as Record<string, string>;

      for (const [word, translation] of Object.entries(translations)) {
        cache.set(cacheKey(word, from, to), translation);
      }
      saveToStorage();

      // Notify listeners
      for (const fn of listeners) fn();
    } catch {
      // Silently fail — user just won't see translations for this batch
    }
  }
}

// Load on module init
loadFromStorage();

/**
 * Storage management for extension data
 */

import type { UserPreferences } from '@tong/core';

const DEFAULT_PREFERENCES: UserPreferences = {
  languages: {
    fluentLanguages: ['en'],
    targetLanguages: ['ja'],
    primaryTarget: 'ja',
    translationLanguage: 'en',
  },
  subtitles: {
    showOriginal: true,
    showRomanization: true,
    showTranslation: true,
    romanizationSystem: 'romaji-hepburn',
    fontSize: 24,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    position: 'bottom',
    karaokeEnabled: true,
    karaokeHighlightColor: '#fbbf24',
  },
  shortcuts: {
    toggleOverlay: 'Alt+P',
    toggleRomanization: 'Alt+R',
    toggleTranslation: 'Alt+T',
    saveWord: 'Alt+S',
  },
  theme: 'system',
  autoPauseOnNewWord: false,
  showDifficultyIndicators: true,
};

export class StorageManager {
  private cache: Map<string, unknown> = new Map();

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    const cached = this.cache.get('preferences');
    if (cached) {
      return cached as UserPreferences;
    }

    const result = await chrome.storage.sync.get('preferences');
    const preferences = result.preferences || DEFAULT_PREFERENCES;

    this.cache.set('preferences', preferences);
    return preferences;
  }

  /**
   * Set user preferences (partial update)
   */
  async setPreferences(updates: Partial<UserPreferences> | Record<string, unknown>): Promise<void> {
    const current = await this.getPreferences();
    const merged = this.deepMerge(current, updates as Partial<UserPreferences>);

    await chrome.storage.sync.set({ preferences: merged });
    this.cache.set('preferences', merged);
  }

  /**
   * Set default preferences on first install
   */
  async setDefaultPreferences(): Promise<void> {
    const result = await chrome.storage.sync.get('preferences');
    if (!result.preferences) {
      await chrome.storage.sync.set({ preferences: DEFAULT_PREFERENCES });
      this.cache.set('preferences', DEFAULT_PREFERENCES);
    }
  }

  /**
   * Get a specific storage key
   */
  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    const result = await chrome.storage.local.get(key);
    const value = result[key] ?? null;

    if (value !== null) {
      this.cache.set(key, value);
    }

    return value;
  }

  /**
   * Set a storage key
   */
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
    this.cache.set(key, value);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Deep merge objects
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target } as Record<string, unknown>;
    const sourceObj = source as Record<string, unknown>;

    for (const key in sourceObj) {
      const sourceValue = sourceObj[key];
      const targetValue = (target as Record<string, unknown>)[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue;
      }
    }

    return result as T;
  }
}

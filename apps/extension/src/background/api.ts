/**
 * API client for Tong backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tong-api.erniesg.workers.dev';

// Regex patterns for language detection
const KANJI_REGEX = /[\u4E00-\u9FFF]/;
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

export interface JapaneseRomanizationResult {
  original: string;
  romaji: string;
  hiragana: string;
  katakana: string;
  hasKanji: boolean;
  cached: boolean;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  /**
   * Check if text contains Japanese kanji
   */
  containsKanji(text: string): boolean {
    return KANJI_REGEX.test(text);
  }

  /**
   * Check if text contains Japanese characters
   */
  containsJapanese(text: string): boolean {
    return JAPANESE_REGEX.test(text);
  }

  /**
   * Translate text
   */
  async translate(
    text: string,
    targetLang: string,
    sourceLang?: string
  ): Promise<{ original: string; translated: string; cached: boolean }> {
    const response = await this.post('/api/translate', {
      text,
      targetLang,
      sourceLang,
    });

    return response.data as { original: string; translated: string; cached: boolean };
  }

  /**
   * Romanize text (auto-detects Japanese kanji and uses appropriate endpoint)
   */
  async romanize(
    text: string,
    language?: string
  ): Promise<{ romanized: string; segments?: unknown[]; hiragana?: string; katakana?: string }> {
    // If Japanese with kanji, use the dedicated Japanese endpoint
    if ((language === 'ja' || (!language && this.containsJapanese(text))) && this.containsKanji(text)) {
      const result = await this.romanizeJapanese(text);
      return {
        romanized: result.romaji,
        hiragana: result.hiragana,
        katakana: result.katakana,
        segments: [], // Japanese endpoint doesn't return segments yet
      };
    }

    // Otherwise use standard romanization
    const response = await this.post('/api/romanize', {
      text,
      language,
      includeSegments: true,
    });

    return response.data as { romanized: string; segments?: unknown[] };
  }

  /**
   * Romanize Japanese text with full kanji support (uses kuroshiro on server)
   */
  async romanizeJapanese(text: string): Promise<JapaneseRomanizationResult> {
    const response = await this.post('/api/romanize/japanese', { text });
    return response.data as JapaneseRomanizationResult;
  }

  /**
   * Batch romanize Japanese texts with kanji support
   */
  async romanizeJapaneseBatch(texts: string[]): Promise<JapaneseRomanizationResult[]> {
    const response = await this.post('/api/romanize/japanese/batch', { texts });
    const data = response.data as { results: JapaneseRomanizationResult[] };
    return data.results;
  }

  /**
   * Save vocabulary item
   */
  async saveVocabulary(item: unknown): Promise<{ id: string; isNew: boolean }> {
    const response = await this.post('/api/vocabulary', item);
    return response.data as { id: string; isNew: boolean };
  }

  /**
   * Get vocabulary items
   */
  async getVocabulary(language?: string): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (language) {
      params.set('language', language);
    }

    const response = await this.get(`/api/vocabulary?${params}`);
    return response.data as unknown[];
  }

  /**
   * GET request
   */
  private async get(path: string): Promise<{ success: boolean; data: unknown }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * POST request
   */
  private async post(
    path: string,
    body: unknown
  ): Promise<{ success: boolean; data: unknown }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }
}

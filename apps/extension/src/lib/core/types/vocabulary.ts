import type { LanguageCode } from './subtitle';

/**
 * Difficulty levels based on standard proficiency tests
 */
export interface DifficultyLevel {
  /** HSK level for Chinese (1-6) */
  hsk?: 1 | 2 | 3 | 4 | 5 | 6;
  /** JLPT level for Japanese (N5-N1) */
  jlpt?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  /** TOPIK level for Korean (1-6) */
  topik?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Generic difficulty (1-10) */
  general?: number;
}

/**
 * Source context where vocabulary was encountered
 */
export interface VocabularyContext {
  /** Video ID */
  videoId: string;
  /** Platform (youtube, etc.) */
  platform: string;
  /** Video title */
  videoTitle: string;
  /** Timestamp in video (ms) */
  timestamp: number;
  /** Full sentence containing the word */
  sentence: string;
  /** Audio clip URL (if available) */
  audioClipUrl?: string;
}

/**
 * A vocabulary item saved by user
 */
export interface VocabularyItem {
  /** Unique identifier */
  id: string;
  /** User ID */
  userId: string;
  /** The word/phrase */
  word: string;
  /** Language of the word */
  language: LanguageCode;
  /** Romanization */
  romanization?: string;
  /** Translation to user's native language */
  translation: string;
  /** Target translation language */
  translationLanguage: LanguageCode;
  /** Part of speech */
  partOfSpeech?: string;
  /** Difficulty level */
  difficulty?: DifficultyLevel;
  /** Context where encountered */
  contexts: VocabularyContext[];
  /** User notes */
  notes?: string;
  /** Tags for organization */
  tags: string[];
  /** Created timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Spaced repetition review data
 */
export interface ReviewData {
  /** Vocabulary item ID */
  vocabularyId: string;
  /** User ID */
  userId: string;
  /** Number of times reviewed */
  reviewCount: number;
  /** Ease factor (SM-2 algorithm) */
  easeFactor: number;
  /** Interval until next review (days) */
  interval: number;
  /** Next review date */
  nextReviewDate: number;
  /** Last review date */
  lastReviewDate: number;
  /** Consecutive correct answers */
  streak: number;
}

/**
 * Review session result
 */
export interface ReviewResult {
  /** Vocabulary item ID */
  vocabularyId: string;
  /** User's response quality (0-5, SM-2 scale) */
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  /** Response time in ms */
  responseTime: number;
  /** Review type */
  reviewType: 'meaning' | 'reading' | 'listening' | 'writing';
  /** Timestamp */
  timestamp: number;
}

/**
 * Export format for vocabulary
 */
export type ExportFormat = 'anki' | 'csv' | 'json';

/**
 * Anki export options
 */
export interface AnkiExportOptions {
  /** Include audio clips */
  includeAudio: boolean;
  /** Include context sentences */
  includeContext: boolean;
  /** Deck name */
  deckName: string;
  /** Note type */
  noteType: 'basic' | 'cloze' | 'custom';
}

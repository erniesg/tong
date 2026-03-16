import type { LanguageCode } from './subtitle';
import type { RomanizationSystem } from './romanization';

/**
 * User's language learning configuration
 */
export interface LanguageLearningConfig {
  /** Languages user is fluent in */
  fluentLanguages: LanguageCode[];
  /** Languages user is learning */
  targetLanguages: LanguageCode[];
  /** Current primary learning target */
  primaryTarget: LanguageCode;
  /** Primary language for translations */
  translationLanguage: LanguageCode;
}

/**
 * Subtitle display preferences
 */
export interface SubtitlePreferences {
  /** Show original subtitles */
  showOriginal: boolean;
  /** Show romanization */
  showRomanization: boolean;
  /** Show translation */
  showTranslation: boolean;
  /** Romanization system preference */
  romanizationSystem: RomanizationSystem;
  /** Font size (px) */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Text color */
  textColor: string;
  /** Background color/opacity */
  backgroundColor: string;
  /** Position on screen */
  position: 'top' | 'bottom' | 'custom';
  /** Custom position (if position is 'custom') */
  customPosition?: { x: number; y: number };
  /** Enable karaoke highlighting */
  karaokeEnabled: boolean;
  /** Karaoke highlight color */
  karaokeHighlightColor: string;
}

/**
 * User preferences
 */
export interface UserPreferences {
  /** Language configuration */
  languages: LanguageLearningConfig;
  /** Subtitle display preferences */
  subtitles: SubtitlePreferences;
  /** Keyboard shortcuts */
  shortcuts: Record<string, string>;
  /** Theme (light/dark/system) */
  theme: 'light' | 'dark' | 'system';
  /** Auto-pause on new word */
  autoPauseOnNewWord: boolean;
  /** Show difficulty indicators */
  showDifficultyIndicators: boolean;
}

/**
 * User profile
 */
export interface User {
  /** Unique user ID */
  id: string;
  /** Email address */
  email: string;
  /** Display name */
  displayName?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** User preferences */
  preferences: UserPreferences;
  /** Subscription tier */
  subscriptionTier: 'free' | 'premium' | 'pro';
  /** Subscription expiry */
  subscriptionExpiry?: number;
  /** Created timestamp */
  createdAt: number;
  /** Last active timestamp */
  lastActiveAt: number;
}

/**
 * User learning statistics
 */
export interface UserStats {
  /** User ID */
  userId: string;
  /** Total videos watched */
  videosWatched: number;
  /** Total watch time (minutes) */
  watchTimeMinutes: number;
  /** Vocabulary items saved */
  vocabularySaved: number;
  /** Vocabulary items mastered */
  vocabularyMastered: number;
  /** Review sessions completed */
  reviewSessionsCompleted: number;
  /** Current streak (days) */
  currentStreak: number;
  /** Longest streak (days) */
  longestStreak: number;
  /** Stats per language */
  byLanguage: Record<
    LanguageCode,
    {
      videosWatched: number;
      watchTimeMinutes: number;
      vocabularySaved: number;
      vocabularyMastered: number;
    }
  >;
}

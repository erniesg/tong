/**
 * Romanization systems
 */
export type RomanizationSystem =
  | 'pinyin' // Chinese: Standard Pinyin with tone marks
  | 'pinyin-numbered' // Chinese: Pinyin with tone numbers
  | 'romaji-hepburn' // Japanese: Hepburn romanization
  | 'romaji-kunrei' // Japanese: Kunrei-shiki
  | 'hangul-rr' // Korean: Revised Romanization
  | 'hangul-mr'; // Korean: McCune-Reischauer

/**
 * A segment of romanized text
 */
export interface RomanizedSegment {
  /** Original text */
  text: string;
  /** Romanized reading */
  reading: string;
  /** Type of segment */
  type: 'cjk' | 'latin' | 'punctuation' | 'mixed';
  /** Tone number for Chinese (1-5) */
  tone?: number;
  /** Pitch accent pattern for Japanese */
  pitchAccent?: number[];
}

/**
 * Result of romanization operation
 */
export interface RomanizationResult {
  /** Original input text */
  original: string;
  /** Full romanized string */
  romanized: string;
  /** Individual segments */
  segments: RomanizedSegment[];
  /** System used for romanization */
  system: RomanizationSystem;
  /** Source language detected/specified */
  sourceLanguage: 'zh' | 'ja' | 'ko';
}

/**
 * Options for romanization
 */
export interface RomanizationOptions {
  /** Romanization system to use */
  system?: RomanizationSystem;
  /** Include tone marks/numbers */
  includeTones?: boolean;
  /** Convert to lowercase */
  lowercase?: boolean;
  /** Preserve spaces between words */
  preserveSpaces?: boolean;
  /** Include pitch accent for Japanese */
  includePitchAccent?: boolean;
}

/**
 * Batch romanization request
 */
export interface BatchRomanizationRequest {
  /** Texts to romanize */
  texts: string[];
  /** Source language */
  language: 'zh' | 'ja' | 'ko';
  /** Romanization options */
  options?: RomanizationOptions;
}

/**
 * Batch romanization response
 */
export interface BatchRomanizationResponse {
  /** Results in same order as input */
  results: RomanizationResult[];
  /** Processing time in ms */
  processingTime: number;
}

// Pinyin (Chinese)
export { toPinyin, toPinyinWithTones, toPinyinNumbered, toPinyinSegments } from './pinyin';
export type { PinyinOptions } from './pinyin';

// Romaji (Japanese)
export { toRomaji, toRomajiSegments } from './romaji';
export type { RomajiOptions } from './romaji';

// Hangul Romanization (Korean)
export { toRomanizedKorean, toRomanizedKoreanSegments } from './hangul';
export type { KoreanRomanizationOptions } from './hangul';

// Universal romanization function
export { romanize, romanizeWithSegments, romanizeBatch } from './romanize';
export type { RomanizeOptions } from './romanize';

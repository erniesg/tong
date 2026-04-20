import type { WebtoonPanel, WebtoonSpec } from '@/lib/hangout/fixture-types';

const ASSET = (n: number) => `/assets/webtoon/shanghai/h1/${n}.png`;

// Theme colors — chained so each gap fades from the prior panel's dominant
// tone into the next. Warm parchment dominates; the mic-drop pulls to near-black.
const PARCHMENT = '#f4f0e8';
const WARM_FADE = '#ead9c2';
const TABLE_WOOD = '#c29867';
const DARK = '#0b0b10';

// Source dimensions (aspect drives the natural panel height):
//   0: 2562x1440 (16:9 landscape)   — establishing
//   1: 1682x2193 (~3:4 portrait)     — opening beat
//   2: 1440x2562 (9:16 portrait)     — retort  (rendered as INSET for beat compression)
//   3: 2562x1440 (16:9 landscape)    — prompt
//   4: 1682x2193 (~3:4 portrait)     — deflection (food)
//   5: 1440x2562 (9:16 portrait)     — pitch line (focus)
//   6: 1682x2193 (~3:4 portrait)     — mic drop (after dark gradient lead)

export const SHANGHAI_H1_WEBTOON_PANELS: WebtoonPanel[] = [
  {
    id: 'p0',
    imageUrl: ASSET(0),
    widthType: 'full-bleed',
    heightClass: 'standard',
    aspectRatio: '16:9',
    shotType: 'wide-establishing',
    gapBefore: { px: 0 },
    transition: 'cut',
  },
  {
    id: 'p1',
    imageUrl: ASSET(1),
    widthType: 'full-width',
    heightClass: 'standard',
    aspectRatio: '3:4',
    shotType: 'medium',
    // Warm fade from the wood-tone base of p0 into parchment for p1.
    gapBefore: { px: 32, gradient: [TABLE_WOOD, PARCHMENT] },
    transition: 'cut',
    bubble: {
      zh: '方案你看过了。',
      py: ['Fāng', 'àn', 'nǐ', 'kàn', 'guò', 'le'],
      en: 'You looked at the proposal.',
      speaker: 'shoucheng',
      position: 'bottom',
    },
  },
  {
    id: 'p2',
    // Proper inset — 60% width, sits on the parchment surface (not on a void).
    // Compresses the beat: her answer is shorter than his question.
    imageUrl: ASSET(2),
    widthType: 'inset',
    heightClass: 'short',
    aspectRatio: '9:16',
    shotType: 'close-up',
    gapBefore: { px: 20 },
    transition: 'cut',
    bubble: {
      zh: '看了。',
      py: ['Kàn', 'le'],
      en: 'I did.',
      speaker: 'dingman',
      position: 'bottom',
    },
  },
  {
    id: 'p3',
    imageUrl: ASSET(3),
    widthType: 'full-width',
    heightClass: 'standard',
    aspectRatio: '16:9',
    shotType: 'medium-ots',
    gapBefore: { px: 36, gradient: [PARCHMENT, WARM_FADE] },
    transition: 'cut',
    bubble: {
      zh: '想法？',
      py: ['Xiǎng', 'fǎ'],
      en: 'Thoughts?',
      speaker: 'shoucheng',
      position: 'bottom',
    },
  },
  {
    id: 'p4',
    imageUrl: ASSET(4),
    widthType: 'full-width',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'medium',
    // Her deflection is the emotional focus — warm gradient holds the mood.
    gapBefore: { px: 28, gradient: [WARM_FADE, PARCHMENT] },
    transition: 'cut',
    bubble: {
      zh: '小笼包不错。',
      py: ['Xiǎo', 'lóng', 'bāo', 'bú', 'cuò'],
      en: 'The xiaolongbao is good.',
      speaker: 'dingman',
      position: 'bottom',
    },
  },
  {
    id: 'p5',
    imageUrl: ASSET(5),
    widthType: 'full-width',
    heightClass: 'tall',
    aspectRatio: '9:16',
    shotType: 'medium-closeup',
    // Building tension — parchment starts cooling.
    gapBefore: { px: 40, gradient: [PARCHMENT, '#c9b7a0'] },
    transition: 'cut',
    bubble: {
      zh: '这个节目跟其他的不一样。',
      py: ['Zhè', 'ge', 'jié', 'mù', 'gēn', 'qí', 'tā', 'de', 'bù', 'yí', 'yàng'],
      en: 'This show is different from the others.',
      speaker: 'shoucheng',
      position: 'bottom',
    },
  },
  {
    id: 'p6',
    imageUrl: ASSET(6),
    widthType: 'full-bleed',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'close-up',
    // Dramatic mood pivot: gradient fades the strip from parchment into near-black
    // so the mic-drop lands in a different emotional register.
    gapBefore: { px: 160, gradient: ['#c9b7a0', DARK] },
    transition: 'darken',
    isThumbStop: true,
    bubble: {
      zh: '每个节目都说自己不一样。',
      py: ['Měi', 'ge', 'jié', 'mù', 'dōu', 'shuō', 'zì', 'jǐ', 'bù', 'yí', 'yàng'],
      en: 'Every show says it is different.',
      speaker: 'dingman',
      position: 'center-bottom',
    },
  },
];

export const SHANGHAI_H1_WEBTOON: WebtoonSpec = {
  panels: SHANGHAI_H1_WEBTOON_PANELS,
};

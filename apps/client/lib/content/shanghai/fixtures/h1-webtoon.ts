import type { WebtoonPanel, WebtoonSpec } from '@/lib/hangout/fixture-types';

const ASSET = (n: number) => `/assets/webtoon/shanghai/h1/${n}.png`;

// Warm daytime palette (parchment surface).
const PARCHMENT = '#ffffff';
const WARM_SOFT = '#ead9c2';
const WARM_DEEP = '#c9b7a0';
const TABLE_WOOD = '#c29867';
const DARK_END = '#0b0b10';
const INK_BORDER = '#16110d';
const SUNSET_SOFT = '#f1d9bb';
const SUNSET_DEEP = '#d69b5f';
const SUNSET_FIELD = '#f3d6ae';
const SUNSET_FIELD_DARK = '#2a1f1a';

// Dark / night palette (near-black surface). The strip reads as the same
// restaurant scene after hours — warm tones survive but are dimmed.
const DARK_ROOM = '#141119';
const DARK_WARM = '#2a1f1a';
const DARK_DEEP = '#3a2c22';
const DARK_WOOD = '#4a3728';
const DARK_VOID = '#08080c';
const INK_BORDER_DARK = 'rgba(255, 248, 238, 0.9)';

// Source dimensions:
//   0: 2562x1440 (16:9 landscape)   — establishing
//   1: 1682x2193 (~3:4 portrait)     — opening beat
//   2: 1440x2562 (9:16 portrait)     — retort (rendered as INSET)
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
    widthType: 'inset',
    heightClass: 'standard',
    aspectRatio: '3:4',
    shotType: 'medium',
    gapBefore: {
      px: 220,
      gradient: [TABLE_WOOD, PARCHMENT],
      dark: { gradient: [DARK_WOOD, DARK_ROOM] },
    },
    frame: {
      edges: 'top-bottom',
      widthPx: 4,
      color: INK_BORDER,
      dark: { color: INK_BORDER_DARK },
    },
    transition: 'cut',
    bubble: {
      zh: '方案你看过了？',
      py: ['Fāng', 'àn', 'nǐ', 'kàn', 'guò', 'le'],
      en: 'You read the proposal?',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: {
        outside: true,
        outsideOverlapPx: 18,
        reserveSpacePx: 118,
        tailOffsetPct: 50,
        maxWidth: 'min(80vw, 19rem)',
      },
    },
  },
  {
    id: 'p2',
    imageUrl: ASSET(2),
    widthType: 'inset',
    heightClass: 'short',
    aspectRatio: '9:16',
    shotType: 'close-up',
    gapBefore: {
      px: 140,
      color: PARCHMENT,
      dark: { color: DARK_ROOM },
    },
    frame: {
      edges: 'top-bottom',
      widthPx: 4,
      color: INK_BORDER,
      dark: { color: INK_BORDER_DARK },
    },
    transition: 'cut',
    bubble: {
      zh: '看了。',
      py: ['Kàn', 'le'],
      en: 'I did.',
      speaker: 'dingman',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
    },
  },
  {
    id: 'p3',
    imageUrl: ASSET(3),
    widthType: 'inset',
    heightClass: 'standard',
    aspectRatio: '16:9',
    shotType: 'medium-ots',
    gapBefore: {
      px: 200,
      color: PARCHMENT,
      dark: { gradient: [DARK_ROOM, DARK_WARM] },
    },
    frame: {
      edges: 'all',
      widthPx: 4,
      color: INK_BORDER,
      dark: { color: INK_BORDER_DARK },
    },
    layout: {
      widthPct: 90,
      backdropColor: PARCHMENT,
      darkBackdropColor: DARK_WARM,
    },
    transition: 'cut',
    bubble: {
      zh: '想法？',
      py: ['Xiǎng', 'fǎ'],
      en: 'Thoughts?',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
    },
  },
  {
    id: 'p4',
    imageUrl: ASSET(4),
    widthType: 'full-bleed',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'medium',
    gapBefore: {
      px: 120,
      color: PARCHMENT,
      dark: { gradient: [DARK_WARM, DARK_ROOM] },
    },
    transition: 'cut',
    bubble: {
      zh: '小笼包不错。',
      py: ['Xiǎo', 'lóng', 'bāo', 'bú', 'cuò'],
      en: 'The xiaolongbao is good.',
      speaker: 'dingman',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
    },
  },
  {
    id: 'p5',
    imageUrl: ASSET(5),
    widthType: 'inset',
    heightClass: 'tall',
    aspectRatio: '9:16',
    shotType: 'medium-closeup',
    gapBefore: {
      px: 220,
      gradient: [PARCHMENT, SUNSET_FIELD],
      dark: { gradient: [DARK_ROOM, DARK_DEEP] },
    },
    frame: {
      edges: 'all',
      widthPx: 4,
      color: INK_BORDER,
      dark: { color: INK_BORDER_DARK },
    },
    layout: {
      align: 'right',
      flipX: true,
      cropAspectRatio: '3 / 4',
      cropPosition: 'center 42%',
      backdropColor: SUNSET_FIELD,
      darkBackdropColor: SUNSET_FIELD_DARK,
    },
    transition: 'cut',
    bubble: {
      zh: '这个节目跟其他的不一样。',
      py: ['Zhè', 'ge', 'jié', 'mù', 'gēn', 'qí', 'tā', 'de', 'bù', 'yí', 'yàng'],
      en: 'This show is different from the others.',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: { tailOffsetPct: 50, offsetYPx: 28 },
    },
  },
  {
    id: 'p6',
    imageUrl: ASSET(6),
    widthType: 'inset',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'close-up',
    gapBefore: {
      px: 110,
      color: SUNSET_FIELD,
      dark: { color: DARK_ROOM },
    },
    frame: {
      edges: 'all',
      widthPx: 4,
      color: INK_BORDER,
      dark: { color: INK_BORDER_DARK },
    },
    layout: {
      align: 'left',
      liftPx: 160,
      cropAspectRatio: '3 / 4',
      backdropColor: SUNSET_FIELD,
      darkBackdropColor: SUNSET_FIELD_DARK,
    },
    transition: 'darken',
    isThumbStop: true,
    bubble: {
      zh: '每个节目都说自己不一样。',
      py: ['Měi', 'ge', 'jié', 'mù', 'dōu', 'shuō', 'zì', 'jǐ', 'bù', 'yí', 'yàng'],
      en: 'Every show says it is different.',
      speaker: 'dingman',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
    },
  },
];

export const SHANGHAI_H1_WEBTOON: WebtoonSpec = {
  panels: SHANGHAI_H1_WEBTOON_PANELS,
};

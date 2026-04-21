import type { WebtoonPanel, WebtoonSpec } from '@/lib/hangout/fixture-types';

const AVAILABLE_ASSET_PANELS = new Set([0, 1, 2, 3, 4, 5, 6]);
const FALLBACK_ASSET_PANEL = 6;
const ASSET = (n: number) => `/assets/webtoon/shanghai/h1/${AVAILABLE_ASSET_PANELS.has(n) ? n : FALLBACK_ASSET_PANEL}.png`;

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
//   6: 1682x2193 (~3:4 portrait)     — mic drop setup (dark-gradient lead)
//   7+: art pending. Until placeholders land, these panels gracefully reuse panel 6's image
//       so the strip remains readable without 404 asset requests.
//   7:  concede + reframe
//   8:  pitch v2 "不装的人"
//   9:  retort "你觉得我不装？"
//  10:  mic drop "装不下去"
//  11:  ambient — phone rings
//  12:  丁漫 "你接吧。"
//  13:  守成 "不重要。"
//  14:  丁漫 "都响三次了……"
//  15:  守成 "我知道了 / 我先走一步，你好好想想。"
//  16:  ambient — QR-code payment
//  17:  方阿姨 "小瞿你又多给了！"
//  18:  方阿姨 reveal "瞿家的小儿子……"  ← premium (gamePass) scene unlock
//
// Gating policy for V1 demo:
//  - p1/p2 free — teaches the tap-to-reveal gesture
//  - p3–p17 translation gated behind 1 credit (per-bubble SA paywall)
//  - p18 translation + scene unlock gated behind Game Pass
//  - pinyin ruby is always free — paywall is on EN only

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
      gate: { kind: 'credits', cost: 1 },
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
      gate: { kind: 'credits', cost: 1 },
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
      gate: { kind: 'credits', cost: 1 },
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
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p7',
    imageUrl: ASSET(7),
    widthType: 'inset',
    heightClass: 'short',
    aspectRatio: '9:16',
    shotType: 'close-up',
    gapBefore: { px: 180, color: SUNSET_FIELD, dark: { gradient: [DARK_ROOM, DARK_WARM] } },
    frame: { edges: 'all', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    transition: 'cut',
    bubble: {
      zh: '……你说得对。那我换个说法。',
      py: ['Nǐ', 'shuō', 'de', 'duì', 'Nà', 'wǒ', 'huàn', 'ge', 'shuō', 'fǎ'],
      en: '……You’re right. Let me rephrase.',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p8',
    imageUrl: ASSET(8),
    widthType: 'full-bleed',
    heightClass: 'standard',
    aspectRatio: '16:9',
    shotType: 'medium-ots',
    gapBefore: { px: 140, color: PARCHMENT, dark: { color: DARK_ROOM } },
    transition: 'cut',
    bubble: {
      zh: '这个节目需要一个不装的人。',
      py: ['Zhè', 'ge', 'jié', 'mù', 'xū', 'yào', 'yí', 'ge', 'bù', 'zhuāng', 'de', 'rén'],
      en: 'This show needs someone who doesn’t pretend.',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p9',
    imageUrl: ASSET(9),
    widthType: 'inset',
    heightClass: 'standard',
    aspectRatio: '3:4',
    shotType: 'reaction-closeup',
    gapBefore: { px: 160, color: PARCHMENT, dark: { color: DARK_ROOM } },
    frame: { edges: 'top-bottom', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    transition: 'cut',
    bubble: {
      zh: '……你觉得我不装？',
      py: ['Nǐ', 'jué', 'de', 'wǒ', 'bù', 'zhuāng'],
      en: '……You think I’m not pretending?',
      speaker: 'dingman',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p10',
    imageUrl: ASSET(10),
    widthType: 'inset',
    heightClass: 'tall',
    aspectRatio: '9:16',
    shotType: 'mic-drop-closeup',
    gapBefore: { px: 220, gradient: [PARCHMENT, SUNSET_SOFT], dark: { gradient: [DARK_ROOM, DARK_DEEP] } },
    frame: { edges: 'all', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    layout: { align: 'right', cropAspectRatio: '3 / 4', backdropColor: SUNSET_FIELD, darkBackdropColor: SUNSET_FIELD_DARK },
    transition: 'darken',
    isThumbStop: true,
    bubble: {
      zh: '我觉得你装不下去。',
      py: ['Wǒ', 'jué', 'de', 'nǐ', 'zhuāng', 'bú', 'xià', 'qù'],
      en: 'I think you can’t keep pretending.',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p11',
    imageUrl: ASSET(11),
    widthType: 'full-bleed',
    heightClass: 'short',
    aspectRatio: '16:9',
    shotType: 'sfx-phone',
    gapBefore: { px: 200, color: DARK_END, dark: { color: DARK_VOID } },
    transition: 'cut',
    bubble: {
      zh: '手机又响了。',
      py: ['Shǒu', 'jī', 'yòu', 'xiǎng', 'le'],
      en: 'The phone rings again.',
      speaker: 'narrator',
      position: 'center-bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p12',
    imageUrl: ASSET(12),
    widthType: 'inset',
    heightClass: 'short',
    aspectRatio: '3:4',
    shotType: 'close-up',
    gapBefore: { px: 120, color: PARCHMENT, dark: { color: DARK_ROOM } },
    frame: { edges: 'top-bottom', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    transition: 'cut',
    bubble: {
      zh: '你接吧。',
      py: ['Nǐ', 'jiē', 'ba'],
      en: 'You answer it.',
      speaker: 'dingman',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p13',
    imageUrl: ASSET(13),
    widthType: 'inset',
    heightClass: 'short',
    aspectRatio: '9:16',
    shotType: 'close-up',
    gapBefore: { px: 100, color: PARCHMENT, dark: { color: DARK_ROOM } },
    frame: { edges: 'top-bottom', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    transition: 'cut',
    bubble: {
      zh: '不重要。',
      py: ['Bú', 'zhòng', 'yào'],
      en: 'Not important.',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p14',
    imageUrl: ASSET(14),
    widthType: 'inset',
    heightClass: 'standard',
    aspectRatio: '3:4',
    shotType: 'medium',
    gapBefore: { px: 140, color: PARCHMENT, dark: { color: DARK_ROOM } },
    frame: { edges: 'all', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    transition: 'cut',
    bubble: {
      zh: '都响三次了，还说不重要？',
      py: ['Dōu', 'xiǎng', 'sān', 'cì', 'le', 'hái', 'shuō', 'bú', 'zhòng', 'yào'],
      en: 'It’s rung three times — still not important?',
      speaker: 'dingman',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p15',
    imageUrl: ASSET(15),
    widthType: 'inset',
    heightClass: 'tall',
    aspectRatio: '9:16',
    shotType: 'medium-standing',
    gapBefore: { px: 220, gradient: [PARCHMENT, WARM_DEEP], dark: { gradient: [DARK_ROOM, DARK_WOOD] } },
    frame: { edges: 'all', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    layout: { align: 'left', liftPx: 60, backdropColor: WARM_SOFT, darkBackdropColor: DARK_WARM },
    transition: 'cut',
    bubble: {
      zh: '……我知道了。我先走一步，你好好想想。',
      py: ['Wǒ', 'zhī', 'dào', 'le', 'Wǒ', 'xiān', 'zǒu', 'yí', 'bù', 'nǐ', 'hǎo', 'hǎo', 'xiǎng', 'xiang'],
      en: '……Got it. I’ll head off — you think it over.',
      speaker: 'shoucheng',
      position: 'bottom',
      layout: { tailOffsetPct: 50, offsetYPx: 20 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p16',
    imageUrl: ASSET(16),
    widthType: 'inset',
    heightClass: 'short',
    aspectRatio: '3:4',
    shotType: 'qr-payment-closeup',
    gapBefore: { px: 120, color: WARM_SOFT, dark: { color: DARK_WARM } },
    frame: { edges: 'top-bottom', widthPx: 4, color: INK_BORDER, dark: { color: INK_BORDER_DARK } },
    transition: 'cut',
    bubble: {
      zh: '扫码，买单。',
      py: ['Sǎo', 'mǎ', 'mǎi', 'dān'],
      en: 'Scan to pay.',
      speaker: 'narrator',
      position: 'center-bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p17',
    imageUrl: ASSET(17),
    widthType: 'full-bleed',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'ayi-calling',
    gapBefore: { px: 200, gradient: [WARM_SOFT, PARCHMENT], dark: { gradient: [DARK_WARM, DARK_ROOM] } },
    transition: 'cut',
    bubble: {
      zh: '小瞿你又多给了！',
      py: ['Xiǎo', 'Qú', 'nǐ', 'yòu', 'duō', 'gěi', 'le'],
      en: 'Little Qu — you overpaid again!',
      speaker: 'ayi',
      position: 'bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'credits', cost: 1 },
    },
  },
  {
    id: 'p18',
    imageUrl: ASSET(18),
    widthType: 'full-bleed',
    heightClass: 'tall',
    aspectRatio: '4:7',
    shotType: 'cliffhanger-closeup',
    gapBefore: { px: 320, gradient: [PARCHMENT, DARK_END], dark: { gradient: [DARK_ROOM, DARK_VOID] } },
    transition: 'darken',
    isThumbStop: true,
    bubble: {
      zh: '瞿家的小儿子……',
      py: ['Qú', 'jiā', 'de', 'xiǎo', 'ér', 'zi'],
      en: 'The Qu family’s younger son……',
      speaker: 'ayi',
      position: 'center-bottom',
      layout: { tailOffsetPct: 50 },
      gate: { kind: 'gamePass' },
    },
  },
];

export const SHANGHAI_H1_WEBTOON: WebtoonSpec = {
  panels: SHANGHAI_H1_WEBTOON_PANELS,
};

import type { WebtoonPanel, WebtoonSpec } from '@/lib/hangout/fixture-types';

const ASSET = (n: number) => `/assets/webtoon/shanghai/h1/${n}.png`;

// Panel aspect ratios derived from source images:
//   0: 2562x1440 (16:9 landscape)   — establishing
//   1: 1682x2193 (~3:4 portrait)     — opening beat
//   2: 1440x2562 (9:16 portrait)     — retort
//   3: 2562x1440 (16:9 landscape)    — prompt
//   4: 1682x2193 (~3:4 portrait)     — deflection (food)
//   5: 1440x2562 (9:16 portrait)     — pitch line
//   6: 1682x2193 (~3:4 portrait)     — mic-drop

export const SHANGHAI_H1_WEBTOON_PANELS: WebtoonPanel[] = [
  {
    id: 'p0',
    imageUrl: ASSET(0),
    widthType: 'full-bleed',
    heightClass: 'tall',
    aspectRatio: '16:9',
    shotType: 'wide-establishing',
    gapBefore: { px: 0, color: '#0d0d1a' },
    transition: 'cut',
  },
  {
    id: 'p1',
    imageUrl: ASSET(1),
    widthType: 'full-width',
    heightClass: 'standard',
    aspectRatio: '3:4',
    shotType: 'medium',
    gapBefore: { px: 120, color: '#f4f0e8' },
    transition: 'cut',
    bubble: {
      zh: '方案你看过了。',
      py: 'Fāng\'àn nǐ kànguò le.',
      en: 'You looked at the proposal.',
      speaker: 'shoucheng',
      position: 'bottom',
    },
  },
  {
    id: 'p2',
    imageUrl: ASSET(2),
    widthType: 'inset-narrow',
    heightClass: 'short',
    aspectRatio: '9:16',
    shotType: 'close-up',
    gapBefore: { px: 50, color: '#f4f0e8' },
    transition: 'cut',
    bubble: {
      zh: '看了。',
      py: 'Kàn le.',
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
    gapBefore: { px: 150, color: '#f4f0e8' },
    transition: 'cut',
    bubble: {
      zh: '想法？',
      py: 'Xiǎngfǎ?',
      en: 'Thoughts?',
      speaker: 'shoucheng',
      position: 'bottom',
    },
  },
  {
    id: 'p4',
    imageUrl: ASSET(4),
    widthType: 'full-width',
    heightClass: 'standard',
    aspectRatio: '3:4',
    shotType: 'medium',
    gapBefore: { px: 120, color: '#f4f0e8' },
    transition: 'cut',
    bubble: {
      zh: '小笼包不错。',
      py: 'Xiǎolóngbāo búcuò.',
      en: 'The xiaolongbao is good.',
      speaker: 'dingman',
      position: 'bottom',
    },
  },
  {
    id: 'p5',
    imageUrl: ASSET(5),
    widthType: 'inset-wide',
    heightClass: 'tall',
    aspectRatio: '9:16',
    shotType: 'medium-closeup',
    gapBefore: { px: 180, color: '#f4f0e8' },
    transition: 'cut',
    bubble: {
      zh: '这个节目跟其他的不一样。',
      py: 'Zhège jiémù gēn qítā de bù yíyàng.',
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
    gapBefore: { px: 320, color: '#0d0d1a' },
    transition: 'darken',
    isThumbStop: true,
    bubble: {
      zh: '每个节目都说自己不一样。',
      py: 'Měi gè jiémù dōu shuō zìjǐ bù yíyàng.',
      en: 'Every show says it is different.',
      speaker: 'dingman',
      position: 'center-bottom',
    },
  },
];

export const SHANGHAI_H1_WEBTOON: WebtoonSpec = {
  panels: SHANGHAI_H1_WEBTOON_PANELS,
};

import type { ExerciseData } from '@/lib/types/hangout';
import type { WebtoonPanel } from '@/lib/hangout/fixture-types';

export type ShanghaiOnboardingHotspotId = 'shoucheng' | 'dingman';

export interface ShanghaiOnboardingBriefingBeat {
  id: string;
  expression: 'neutral' | 'thinking' | 'amazed' | 'proud';
  eyebrow: string;
  title: string;
  body: string;
  kicker: string;
}

export interface ShanghaiOnboardingHotspot {
  id: ShanghaiOnboardingHotspotId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  headline: string;
  detail: string;
}

const PARCHMENT = '#f4efe6';
const MIDNIGHT = '#111016';

const EXERCISE_BANK: ExerciseData[] = [
  {
    type: 'multiple_choice',
    id: 'shanghai-onboarding-fangan',
    objectiveId: 'zh-vocab-shanghai-negotiation',
    difficulty: 1,
    prompt: '方案 fits this room because 守成 is pushing a…',
    options: [
      { id: 'proposal', text: 'proposal' },
      { id: 'pillow', text: 'pillow' },
      { id: 'streetlight', text: 'streetlight' },
      { id: 'receipt', text: 'receipt' },
    ],
    correctOptionId: 'proposal',
    explanation: '方案 here means a proposal or plan he wants 丁漫 to react to.',
  },
  {
    type: 'multiple_choice',
    id: 'shanghai-onboarding-yuanyi',
    objectiveId: 'zh-vocab-shanghai-negotiation',
    difficulty: 1,
    prompt: '愿意 is about willingness, not ability. Which gloss fits best?',
    options: [
      { id: 'willing', text: 'willing' },
      { id: 'unable', text: 'unable' },
      { id: 'hungry', text: 'hungry' },
      { id: 'finished', text: 'finished' },
    ],
    correctOptionId: 'willing',
    explanation: 'Tong wants you listening for refusal versus inability before the confrontation sharpens.',
  },
  {
    type: 'multiple_choice',
    id: 'shanghai-onboarding-zhuang',
    objectiveId: 'zh-vocab-shanghai-negotiation',
    difficulty: 1,
    prompt: '装 in this scene is closest to…',
    options: [
      { id: 'pretend', text: 'pretend / put on an act' },
      { id: 'forget', text: 'forget' },
      { id: 'arrive', text: 'arrive' },
      { id: 'buy', text: 'buy' },
    ],
    correctOptionId: 'pretend',
    explanation: 'The tension is about whether someone can keep performing a version of themselves.',
  },
];

export const SHANGHAI_ONBOARDING_BRIEFING: ShanghaiOnboardingBriefingBeat[] = [
  {
    id: 'brief-1',
    expression: 'amazed',
    eyebrow: 'Shanghai feels faster than Seoul for a reason.',
    title: 'Tong Is Live On The Feed',
    body: 'Keep your eyes soft. 守成 sells ideas like contracts. 丁漫 breaks pressure by refusing the frame.',
    kicker: 'We are not barging in. We are learning how the room moves before it notices us.',
  },
  {
    id: 'brief-2',
    expression: 'thinking',
    eyebrow: 'Listen for stance, not volume.',
    title: 'Two Words Matter First',
    body: '方案 tells you what is on the table. 愿意 tells you whether someone will move at all.',
    kicker: 'I will give you two quick checks, then you scan the room yourself.',
  },
  {
    id: 'brief-3',
    expression: 'proud',
    eyebrow: 'Good. Now earn the angle.',
    title: 'Pan Across The Table',
    body: 'Drag left and right. Tag 守成 and 丁漫 once each so you know who is holding the pitch and who is stripping it bare.',
    kicker: 'After that, you can drop straight into the negotiation strip.',
  },
];

export const SHANGHAI_ONBOARDING_HOTSPOTS: ShanghaiOnboardingHotspot[] = [
  {
    id: 'dingman',
    label: '丁漫',
    x: 0.19,
    y: 0.18,
    width: 0.22,
    height: 0.56,
    headline: '丁漫 answers by refusing the business frame.',
    detail: 'Notice how she keeps the food and table rhythm intact. She does not raise her voice. She removes his leverage.',
  },
  {
    id: 'shoucheng',
    label: '守成',
    x: 0.58,
    y: 0.16,
    width: 0.22,
    height: 0.56,
    headline: '守成 opens with terms before emotion.',
    detail: 'His register is clipped, practiced, and transactional. The question is never whether he has a pitch. It is whether she will accept the pitch at all.',
  },
];

export const SHANGHAI_ONBOARDING_PANORAMA = {
  videoUrl: '/assets/locations/shanghai.mp4',
  imageUrl: '/assets/webtoon/shanghai/h1/0.png',
  title: 'Xiaolongbao Shop, Late Afternoon',
  subtitle: 'Pan the room, tag both leads, then drop into the strip.',
};

export const SHANGHAI_ONBOARDING_WEBTOON: WebtoonPanel[] = [
  {
    id: 'strip-1',
    imageUrl: '/assets/webtoon/shanghai/h1/1.png',
    widthType: 'full-width',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'wide-establishing',
    gapBefore: { px: 48, color: PARCHMENT },
    transition: 'cut',
  },
  {
    id: 'strip-2',
    imageUrl: '/assets/webtoon/shanghai/h1/2.png',
    widthType: 'inset-wide',
    heightClass: 'standard',
    aspectRatio: '1:1',
    shotType: 'medium-ots',
    gapBefore: { px: 64, color: PARCHMENT },
    bubble: {
      zh: '方案你看过了。',
      py: 'Fāng\'àn nǐ kàn guò le.',
      en: 'You looked at the proposal.',
      speaker: 'shoucheng',
      position: 'bottom',
    },
    transition: 'cut',
  },
  {
    id: 'strip-3',
    imageUrl: '/assets/webtoon/shanghai/h1/3.png',
    widthType: 'full-width',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'tight-reaction',
    gapBefore: { px: 110, color: PARCHMENT },
    bubble: {
      zh: '蟹壳黄不错。',
      py: 'Xièkéhuáng búcuò.',
      en: 'The sesame pastry is good.',
      speaker: 'dingman',
      position: 'bottom',
    },
    transition: 'fade',
  },
  {
    id: 'strip-4',
    imageUrl: '/assets/webtoon/shanghai/h1/4.png',
    widthType: 'inset-wide',
    heightClass: 'tall',
    aspectRatio: '3:4',
    shotType: 'phone-ring-turn',
    gapBefore: { px: 160, color: MIDNIGHT },
    transition: 'darken',
  },
  {
    id: 'strip-5',
    imageUrl: '/assets/webtoon/shanghai/h1/5.png',
    widthType: 'full-bleed',
    heightClass: 'ultra-tall',
    aspectRatio: '9:16',
    shotType: 'ayi-reveal',
    gapBefore: { px: 220, color: MIDNIGHT },
    isThumbStop: true,
    bubble: {
      zh: '瞿家的小儿子……',
      py: 'Qú jiā de xiǎo érzi…',
      en: 'The Qu family’s younger son…',
      speaker: 'ayi',
      position: 'center-bottom',
    },
    transition: 'darken',
  },
];

export function buildShanghaiOnboardingExercises(): ExerciseData[] {
  const pool = [...EXERCISE_BANK];
  const firstIndex = Math.floor(Math.random() * pool.length);
  const first = pool.splice(firstIndex, 1)[0];
  const second = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  return [first, second];
}

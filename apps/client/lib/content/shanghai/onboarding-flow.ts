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
  tongLine: string;
}

const PARCHMENT = '#f4efe6';
const MIDNIGHT = '#111016';

const LESSONS: ExerciseData[] = [
  {
    type: 'multiple_choice',
    id: 'shanghai-onboarding-xiaolongbao',
    objectiveId: 'zh-vocab-shanghai-shop-language',
    difficulty: 1,
    prompt: '小笼包 in this room is the...',
    options: [
      { id: 'dumpling', text: 'soup dumpling' },
      { id: 'folder', text: 'proposal folder' },
      { id: 'window', text: 'street-facing window' },
      { id: 'teacup', text: 'glass cup' },
    ],
    correctOptionId: 'dumpling',
    explanation: 'Tong wants the shop itself in your ear before the negotiation starts.',
  },
  {
    type: 'multiple_choice',
    id: 'shanghai-onboarding-ayi',
    objectiveId: 'zh-vocab-shanghai-shop-language',
    difficulty: 1,
    prompt: '阿姨 in a place like this is closest to...',
    options: [
      { id: 'auntie', text: 'auntie / older woman' },
      { id: 'waiter', text: 'formal waiter title' },
      { id: 'mentor', text: 'acting mentor' },
      { id: 'manager', text: 'corporate manager' },
    ],
    correctOptionId: 'auntie',
    explanation: 'It is a social role before it is a job title. The room already has history inside it.',
  },
];

export const SHANGHAI_ONBOARDING_BRIEFING: ShanghaiOnboardingBriefingBeat[] = [
  {
    id: 'arrival-1',
    expression: 'amazed',
    eyebrow: 'Shanghai starts with a room, not a speech.',
    title: 'Tong Drops You Into The Dumpling Shop',
    body: 'Do not rush the people yet. Read the steam, the stools, the fluorescent hush, the cheap tables, the window light. This city introduces itself sideways.',
    kicker: 'Learn the room first. Then I will show you why one table matters more than the others.',
  },
  {
    id: 'arrival-2',
    expression: 'thinking',
    eyebrow: 'Use the shop to tune your ear.',
    title: 'Small Learning Before Big Subtext',
    body: '小笼包 belongs to the table before it belongs to the lesson. 阿姨 belongs to the room before she changes the story. If you know the shop, the scene lands harder.',
    kicker: 'One more quick check, then I let you look around for yourself.',
  },
  {
    id: 'arrival-3',
    expression: 'proud',
    eyebrow: 'Now look left.',
    title: 'Someone Is Pitching. Someone Else Is Still Eating.',
    body: 'Pan the room and find the table that does not match the others. When you click one of them, you are choosing the side of the scene you carry into the eavesdrop.',
    kicker: 'You are not joining the conversation. You are catching it at the right angle.',
  },
];

export const SHANGHAI_ONBOARDING_HOTSPOTS: ShanghaiOnboardingHotspot[] = [
  {
    id: 'shoucheng',
    label: '守成',
    x: 0.21,
    y: 0.26,
    width: 0.2,
    height: 0.46,
    headline: '守成 leads with terms, not feelings.',
    detail: 'Everything about him says he came here to close a frame cleanly. The suit, the clipped posture, the untouched food: all pitch, no ease.',
    tongLine: 'Good. That is 守成. Watch how he tries to keep the lunch procedural until the room stops cooperating.',
  },
  {
    id: 'dingman',
    label: '丁漫',
    x: 0.41,
    y: 0.18,
    width: 0.18,
    height: 0.48,
    headline: '丁漫 keeps the meal louder than the pitch.',
    detail: 'She does not reject him with force. She rejects him by keeping her own rhythm intact. Food first, frame second.',
    tongLine: 'There. 丁漫 is the counterweight. She never has to win the room loudly if she can refuse its premise quietly.',
  },
];

export const SHANGHAI_ONBOARDING_PANORAMA = {
  videoUrl: '/assets/locations/shanghai-onboarding-panorama.mp4',
  posterUrl: '/assets/locations/shanghai-onboarding-panorama.jpg',
  title: 'Xiaolongbao Shop, Late Afternoon',
  subtitle: 'Tong opens the room first, then lets you pan left into the table that matters.',
  authoredAspect: 16 / 9,
  introFocus: 0.92,
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
      py: "Fāng'àn nǐ kàn guò le.",
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
      zh: '小笼包不错。',
      py: 'Xiǎolóngbāo búcuò.',
      en: 'The dumplings are good.',
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
  return [...LESSONS];
}

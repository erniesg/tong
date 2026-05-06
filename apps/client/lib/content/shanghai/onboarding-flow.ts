import { runtimeAssetUrl } from '@/lib/runtime-assets';
import type { ExerciseData } from '@/lib/types/hangout';

export interface ShanghaiLearningAnchor {
  id: string;
  zh: string;
  py: string;
  en: string;
  role: 'primary' | 'context' | 'reveal';
  note: string;
}

export interface ShanghaiOnboardingPanorama {
  id: string;
  sceneId: string;
  locationId: string;
  videoUrl: string;
  posterUrl: string;
  media: {
    width: number;
    height: number;
    durationSeconds: number;
    authoredAspect: '16:9';
  };
  presentation: {
    kind: 'panorama';
    initialFocus: number;
    panBounds: { min: number; max: number };
  };
  trigger: {
    priorityLanguage: 'zh';
    source: 'game-intro-language-priority';
  };
  learningAnchors: ShanghaiLearningAnchor[];
  introTongLines: string[];
  anchorExercise: ExerciseData;
  postExerciseTongLines: string[];
  panPrompt: string;
  completionTongLine: string;
  webtoonFixtureId: string;
}

export const SHANGHAI_ONBOARDING_PANORAMA_VIDEO_KEY =
  'city.shanghai.location.dumpling-shop.panorama.video.default';

export const SHANGHAI_ONBOARDING_PANORAMA_POSTER_KEY =
  'city.shanghai.location.dumpling-shop.panorama.poster.default';

export const SHANGHAI_ONBOARDING_PANORAMA: ShanghaiOnboardingPanorama = {
  id: 'shanghai-h1-panorama-entry',
  sceneId: 'shanghai/h1-negotiation',
  locationId: 'shanghai:dumpling_shop',
  videoUrl: runtimeAssetUrl(SHANGHAI_ONBOARDING_PANORAMA_VIDEO_KEY),
  posterUrl: runtimeAssetUrl(SHANGHAI_ONBOARDING_PANORAMA_POSTER_KEY),
  media: {
    width: 3840,
    height: 2160,
    durationSeconds: 5.06195,
    authoredAspect: '16:9',
  },
  presentation: {
    kind: 'panorama',
    // Start at the authored right edge. Tong owns the context first; panning only
    // unlocks once the player has a reason to eavesdrop.
    initialFocus: 1,
    panBounds: { min: 0, max: 1 },
  },
  trigger: {
    priorityLanguage: 'zh',
    source: 'game-intro-language-priority',
  },
  learningAnchors: [
    {
      id: 'fangan',
      zh: '方案',
      py: 'fang an',
      en: 'proposal / plan',
      role: 'primary',
      note: 'The object of the negotiation, not a random business noun.',
    },
    {
      id: 'kanguole-xiangfa',
      zh: '看过了 / 想法？',
      py: 'kan guo le / xiang fa',
      en: 'looked it over / thoughts?',
      role: 'primary',
      note: 'The compressed opening pressure: he asks whether she read it, then asks for a response.',
    },
    {
      id: 'buyiyang',
      zh: '不一样',
      py: 'bu yi yang',
      en: 'different',
      role: 'primary',
      note: 'A pitch claim that Dingman immediately treats as a cliche.',
    },
    {
      id: 'zhuangbuxiaqu',
      zh: '装不下去',
      py: 'zhuang bu xia qu',
      en: 'cannot keep pretending',
      role: 'primary',
      note: 'The character-read payoff for the next beat: the scene turns from proposal to person.',
    },
    {
      id: 'jie-zhongyao',
      zh: '接 / 重要',
      py: 'jie / zhong yao',
      en: 'answer / important',
      role: 'context',
      note: 'The phone beat exposes pressure outside the room.',
    },
    {
      id: 'xiaoqu-xiaoerzi',
      zh: '小瞿 / 小儿子',
      py: 'xiao Qu / xiao er zi',
      en: 'little Qu / younger son',
      role: 'reveal',
      note: 'Fang Ayi’s familiar wording proves she knows the family history.',
    },
  ],
  introTongLines: [
    'This is not the city map. We are inside a 小笼包店 in Shanghai.',
    'Two people are at the far table. One is pitching. One is eating.',
    'Tonight is not about ordering food. Catch the few words that tell you what the room is really doing.',
    'First anchor: 方案. That is the proposal he needs her to answer.',
  ],
  anchorExercise: {
    type: 'multiple_choice',
    id: 'shanghai-h1-anchor-fangan',
    objectiveId: 'zh-vocab-shanghai-negotiation',
    difficulty: 1,
    prompt: 'When you hear 方案, what should you track?',
    options: [
      { id: 'proposal', text: 'The proposal he needs Dingman to answer' },
      { id: 'food', text: 'The soup dumplings on the table' },
      { id: 'phone', text: 'The phone call outside the scene' },
    ],
    correctOptionId: 'proposal',
    explanation: '方案 is the negotiation object. The food is camouflage.',
  },
  postExerciseTongLines: [
    'Good. 方案 is the thing on the table even when nobody points at it.',
    'Next listen for two short chunks: 看过了, then 想法？ That is already pressure.',
    'Now slide left. Do not talk. Just listen.',
  ],
  panPrompt: 'Drag left to listen in.',
  completionTongLine:
    'Good read. 方案 was the real object. Food was the dodge.',
  webtoonFixtureId: 'shanghai-h1',
};

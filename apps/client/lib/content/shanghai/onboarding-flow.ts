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
      en: 'plan',
      role: 'primary',
      note: 'The object of the conversation, not a random business noun.',
    },
    {
      id: 'kanguole-xiangfa',
      zh: '看过了 / 想法？',
      py: 'kan guo le / xiang fa',
      en: 'looked it over / thoughts?',
      role: 'primary',
      note: 'The compressed opening pressure: he assumes she read it, then asks for a response.',
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
    'Shanghai starts quietly. Steam on the glass, tables half full, rain against the window.',
    'You are early. Nobody is talking to you yet.',
    'At the far table, two people are already in the middle of something.',
    'Before you listen, take one word with you: 方案. A plan.',
    'You do not need every sentence yet. Just notice when 方案 changes the room.',
  ],
  anchorExercise: {
    type: 'multiple_choice',
    id: 'shanghai-h1-anchor-fangan',
    objectiveId: 'zh-vocab-shanghai-negotiation',
    difficulty: 1,
    prompt: 'In this scene, 方案 is closest to...',
    options: [
      { id: 'plan', text: 'The plan on the table' },
      { id: 'food', text: 'The soup dumplings on the table' },
      { id: 'phone', text: 'The phone call outside the scene' },
    ],
    correctOptionId: 'plan',
    explanation: '方案 is the plan being discussed. The food is part of how 丁漫 avoids answering.',
  },
  postExerciseTongLines: [
    'Good. Now you have one handle before the conversation starts.',
    'Listen for how short the lines are. This is not a lesson. It is pressure.',
    'Slide left slowly. Do not interrupt. Just overhear it.',
  ],
  panPrompt: 'Drag left to listen in.',
  completionTongLine:
    'Good read. 方案 was the plan on the table. Food was the dodge. You did not meet them yet; next time, one of them may notice you.',
  webtoonFixtureId: 'shanghai-h1',
};

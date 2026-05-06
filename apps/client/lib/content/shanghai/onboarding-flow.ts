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
  preListeningExercises: ExerciseData[];
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
    'Shanghai starts quietly. Steam on glass, low voices, rain at the window.',
    'Two people at the far table. One is eating. One is not.',
    'Before you listen in, take the shape of the conversation first.',
    'You only need a few anchors. Then the scene can move.',
  ],
  preListeningExercises: [
    {
      type: 'matching',
      id: 'shanghai-h1-prelisten-phrases',
      objectiveId: 'zh-vocab-shanghai-negotiation',
      difficulty: 1,
      prompt: 'Match the words you are about to overhear.',
      pairs: [
        { left: '方案', right: 'plan' },
        { left: '看过了', right: 'looked it over' },
        { left: '想法', right: 'thoughts' },
        { left: '不一样', right: 'different' },
      ],
    },
    {
      type: 'pronunciation_select',
      id: 'shanghai-h1-prelisten-fangan-sound',
      objectiveId: 'zh-pronunciation-tone-pairs',
      difficulty: 1,
      prompt: 'Listen for 方案 before the webtoon starts.',
      targetText: '方案',
      audioOptions: [
        { id: 'fangan', label: '方案', romanization: 'fang an', meaning: 'plan' },
        { id: 'xiangfa', label: '想法', romanization: 'xiang fa', meaning: 'thoughts' },
        { id: 'buyiyang', label: '不一样', romanization: 'bu yi yang', meaning: 'different' },
      ],
      correctOptionId: 'fangan',
      explanation: '方案 is only one anchor. The scene decides what matters next.',
    },
  ],
  postExerciseTongLines: [
    'Good. Now you have enough to overhear without freezing on every word.',
    'Listen for what the scene gives you next. It may be 方案, 看过了, 想法, or something sharper.',
    'Now slide left. Do not answer them. Just listen.',
  ],
  panPrompt: 'Drag left to listen in.',
  completionTongLine:
    'Good read. Food was the dodge. The useful words came from what they actually said.',
  webtoonFixtureId: 'shanghai-h1',
};

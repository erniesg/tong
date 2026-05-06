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
  webtoonSteps: ShanghaiOnboardingWebtoonStep[];
}

export interface ShanghaiOnboardingWebtoonStep {
  id: string;
  label: string;
  panelIds: string[];
  afterTongLines?: string[];
  afterExercises?: ExerciseData[];
  masteryItems?: string[];
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
  webtoonSteps: [
    {
      id: 'segment-a-table-pressure',
      label: 'Eavesdrop A — table pressure',
      panelIds: ['p0', 'p1', 'p2', 'p3', 'p4'],
      afterTongLines: [
        'She did answer. She answered with food.',
        'Pull out the short pressure chain: 看过了, then 想法.',
      ],
      afterExercises: [
        {
          type: 'fill_blank',
          id: 'shanghai-h1-after-a-kanguole',
          objectiveId: 'zh-gram-shanghai-le-aspect',
          difficulty: 1,
          prompt: 'Complete the overheard line.',
          sentence: '方案你___。',
          blankIndex: 0,
          options: [
            { id: 'kanguole', text: '看过了' },
            { id: 'bu-zhongyao', text: '不重要' },
            { id: 'xianzou', text: '先走' },
          ],
          correctOptionId: 'kanguole',
          grammarNote: '了 marks the action as completed: she has already looked it over.',
          explanation: '看过了 is the clipped confirmation before 丁漫 dodges into food.',
        },
      ],
      masteryItems: ['看过了', '想法'],
    },
    {
      id: 'segment-b-character-read',
      label: 'Eavesdrop B — character read',
      panelIds: ['p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
      afterTongLines: [
        'Now the line gets sharper. 不一样 was the pitch. 装不下去 was the read.',
        'This is not just vocabulary. It is what he thinks she cannot keep doing.',
      ],
      afterExercises: [
        {
          type: 'sentence_builder',
          id: 'shanghai-h1-after-b-zhuang',
          objectiveId: 'zh-gram-shanghai-buxiaqu',
          difficulty: 2,
          prompt: 'Rebuild the line that changed the scene.',
          wordTiles: ['我', '觉得', '你', '装不下去'],
          correctOrder: ['我', '觉得', '你', '装不下去'],
          distractors: ['不重要', '想法'],
          explanation: '我觉得你装不下去。= I think you cannot keep pretending.',
        },
      ],
      masteryItems: ['不一样', '装', '装不下去'],
    },
    {
      id: 'segment-c-departure',
      label: 'Eavesdrop C — departure',
      panelIds: ['p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 'p20'],
      afterTongLines: [
        'That interruption gave you the useful words: 接 and 重要.',
        '小瞿 is not random. 方阿姨 knows him well enough to call him that.',
      ],
      afterExercises: [
        {
          type: 'fill_blank',
          id: 'shanghai-h1-after-c-zhongyao',
          objectiveId: 'zh-vocab-shanghai-interruption-reveal',
          difficulty: 1,
          prompt: 'Complete 丁漫’s phone line.',
          sentence: '响三次了。很___。',
          blankIndex: 0,
          options: [
            { id: 'zhongyao', text: '重要' },
            { id: 'buyiyang', text: '不一样' },
            { id: 'fangan', text: '方案' },
          ],
          correctOptionId: 'zhongyao',
          grammarNote: '重要 means important. 丁漫 reads the pressure before he admits it.',
          explanation: '响三次了。很重要。= It has rung three times. It is important.',
        },
      ],
      masteryItems: ['接', '重要', '小瞿'],
    },
  ],
};

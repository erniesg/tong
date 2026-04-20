import type { GrammarTarget, LearningObjective, Location, VocabularyTarget } from '@/lib/types/objectives';
import { runtimeAssetUrl } from '@/lib/runtime-assets';

const LEVEL_0_OBJECTIVES: LearningObjective[] = [
  {
    id: 'sh-xlb-script-core-hanzi',
    levelNumber: 0,
    category: 'script',
    title: 'Recognize core xiaolongbao hanzi',
    description: 'Read and identify the foundational characters used in this Shanghai food-street scene.',
    targetItems: ['方', '案', '不', '一', '样', '愿', '意', '装', '小', '笼', '包'],
    targetCount: 11,
    assessmentThreshold: 0.8,
    prerequisites: [],
    tags: ['hanzi', 'script', 'shanghai', 'xiaolongbao'],
  },
];

const LEVEL_1_OBJECTIVES: LearningObjective[] = [
  {
    id: 'sh-xlb-pron-tone-pairs',
    levelNumber: 1,
    category: 'pronunciation',
    title: 'Produce tone-pair pronunciation',
    description: 'Practice precise tones in words like 方案 and 愿意 with paired-tone drills.',
    targetItems: ['方案 fāng\'àn', '愿意 yuànyì'],
    targetCount: 2,
    assessmentThreshold: 0.75,
    prerequisites: ['sh-xlb-script-core-hanzi'],
    tags: ['tones', 'mandarin', 'pronunciation'],
  },
  {
    id: 'sh-xlb-pron-minimal-pair-zhuang-pao',
    levelNumber: 1,
    category: 'pronunciation',
    title: 'Differentiate 装/跑 minimal pair',
    description: 'Distinguish initial/final sound shifts between 装 and 跑 in guided contrast drills.',
    targetItems: ['装 zhuāng', '跑 pǎo'],
    targetCount: 2,
    assessmentThreshold: 0.75,
    prerequisites: ['sh-xlb-script-core-hanzi'],
    tags: ['minimal-pair', 'mandarin', 'pronunciation'],
  },
];

const LEVEL_2_OBJECTIVES: LearningObjective[] = [
  {
    id: 'sh-xlb-vocab-core-scene',
    levelNumber: 2,
    category: 'vocabulary',
    title: 'Understand core scene vocabulary',
    description: 'Use high-frequency words from the xiaolongbao shop interaction naturally in context.',
    targetItems: ['方案', '愿意', '装', '不一样', '小笼包', '蟹壳黄', '阿姨', '侬', '本事', '接', '重要'],
    targetCount: 11,
    assessmentThreshold: 0.8,
    prerequisites: ['sh-xlb-pron-tone-pairs', 'sh-xlb-pron-minimal-pair-zhuang-pao'],
    tags: ['vocabulary', 'shanghai-food', 'scene'],
  },
];

const LEVEL_3_OBJECTIVES: LearningObjective[] = [
  {
    id: 'sh-xlb-gram-buhui-vs-buyuanyi',
    levelNumber: 3,
    category: 'grammar',
    title: 'Contrast 不会 vs 不愿意',
    description: 'Express inability versus unwillingness accurately in dialogue choices.',
    targetItems: ['不会', '不愿意'],
    targetCount: 2,
    assessmentThreshold: 0.8,
    prerequisites: ['sh-xlb-vocab-core-scene'],
    tags: ['grammar', 'modality', 'contrast'],
  },
  {
    id: 'sh-xlb-gram-formal-ni',
    levelNumber: 3,
    category: 'grammar',
    title: 'Switch between 你 and 侬 register',
    description: 'Choose formal/neutral or local informal second-person forms based on social context.',
    targetItems: ['你', '侬'],
    targetCount: 2,
    assessmentThreshold: 0.75,
    prerequisites: ['sh-xlb-vocab-core-scene'],
    tags: ['grammar', 'register', 'shanghaihua'],
  },
  {
    id: 'sh-xlb-gram-le-aspect',
    levelNumber: 3,
    category: 'grammar',
    title: 'Use 了 for completed events',
    description: 'Mark completed actions with 了 in short food-ordering and task-completion lines.',
    targetItems: ['~了'],
    targetCount: 1,
    assessmentThreshold: 0.75,
    prerequisites: ['sh-xlb-vocab-core-scene'],
    tags: ['grammar', 'aspect', 'mandarin'],
  },
  {
    id: 'sh-xlb-gram-bu-xiaqu-potential',
    levelNumber: 3,
    category: 'grammar',
    title: 'Apply ~不下去 potential complement',
    description: 'Express inability to continue a state or action using the ~不下去 construction.',
    targetItems: ['~不下去'],
    targetCount: 1,
    assessmentThreshold: 0.75,
    prerequisites: ['sh-xlb-vocab-core-scene'],
    tags: ['grammar', 'potential-complement'],
  },
];

const VOCABULARY_TARGETS: VocabularyTarget[] = [
  { word: '方案', romanization: 'fāng\'àn', translation: 'plan', category: 'strategy', level: 2 },
  { word: '愿意', romanization: 'yuànyì', translation: 'to be willing', category: 'stance', level: 2 },
  { word: '装', romanization: 'zhuāng', translation: 'to pretend; to pack', category: 'action', level: 2 },
  { word: '不一样', romanization: 'bù yíyàng', translation: 'not the same', category: 'descriptor', level: 2 },
  { word: '小笼包', romanization: 'xiǎolóngbāo', translation: 'soup dumplings', category: 'food', level: 2 },
  { word: '蟹壳黄', romanization: 'xièkéhúang', translation: 'sesame flaky pastry', category: 'food', level: 2 },
  { word: '阿姨', romanization: 'āyí', translation: 'auntie; madam', category: 'person', level: 2 },
  { word: '侬', romanization: 'nóng', translation: 'you (Shanghai dialect)', category: 'pronoun', level: 2 },
  { word: '本事', romanization: 'běnshi', translation: 'ability; skill', category: 'trait', level: 2 },
  { word: '接', romanization: 'jiē', translation: 'to receive; to pick up', category: 'action', level: 2 },
  { word: '重要', romanization: 'zhòngyào', translation: 'important', category: 'descriptor', level: 2 },
];

const GRAMMAR_TARGETS: GrammarTarget[] = [
  {
    id: 'zh-gram-buhui-buyuanyi',
    pattern: '不会 vs 不愿意',
    explanation: 'Use 不会 for inability and 不愿意 for unwillingness; the distinction changes intent and tone.',
    examples: [
      { target: '我不会做小笼包。', translation: 'I cannot make soup dumplings.' },
      { target: '我不愿意装懂。', translation: 'I am not willing to pretend I understand.' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-ni-register',
    pattern: '你 / 侬',
    explanation: '你 is standard Mandarin, while 侬 is a local Shanghainese flavor often used for regional tone.',
    examples: [
      { target: '你愿意等一下吗？', translation: 'Are you willing to wait a moment?' },
      { target: '侬今朝要吃啥？', translation: 'What do you want to eat today?' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-le-aspect',
    pattern: 'V + 了',
    explanation: 'Use 了 to mark that an action is completed in context.',
    examples: [
      { target: '我点了两笼小笼包。', translation: 'I ordered two baskets of soup dumplings.' },
      { target: '阿姨已经装好了。', translation: 'Auntie already packed it.' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-bu-xiaqu',
    pattern: '~不下去',
    explanation: 'Potential complement that signals inability to continue an action or state.',
    examples: [
      { target: '太辣了，我吃不下去。', translation: 'It is too spicy, I cannot keep eating.' },
      { target: '太忙了，我等不下去了。', translation: 'It is too busy, I cannot keep waiting.' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
];

export const SHANGHAI_XIAOLONGBAO: Location = {
  id: 'xiaolongbao',
  cityId: 'shanghai',
  name: { en: 'Xiaolongbao Shop', zh: '小笼包店' },
  domain: 'restaurant',
  order: 4,
  backgroundImageUrl: runtimeAssetUrl('city.shanghai.location.dumpling-shop.backdrop.default'),
  ambientDescription:
    'Steam clouds the windows while bamboo baskets stack high. The line moves fast, aunties call out orders, and every table debates the best dipping ratio.',
  levels: [
    {
      level: 0,
      name: 'SCRIPT',
      description: 'Recognize key hanzi in context.',
      objectives: LEVEL_0_OBJECTIVES,
      estimatedSessionMinutes: 12,
      assessmentCriteria: {
        minAccuracy: 0.8,
        minItemsCompleted: 11,
        requiredObjectives: ['sh-xlb-script-core-hanzi'],
      },
    },
    {
      level: 1,
      name: 'PRONUNCIATION',
      description: 'Practice tone pairs and minimal contrasts.',
      objectives: LEVEL_1_OBJECTIVES,
      estimatedSessionMinutes: 15,
      assessmentCriteria: {
        minAccuracy: 0.75,
        minItemsCompleted: 4,
        requiredObjectives: ['sh-xlb-pron-tone-pairs', 'sh-xlb-pron-minimal-pair-zhuang-pao'],
      },
    },
    {
      level: 2,
      name: 'VOCABULARY',
      description: 'Use core xiaolongbao scene lexicon.',
      objectives: LEVEL_2_OBJECTIVES,
      estimatedSessionMinutes: 16,
      assessmentCriteria: {
        minAccuracy: 0.8,
        minItemsCompleted: 10,
        requiredObjectives: ['sh-xlb-vocab-core-scene'],
      },
    },
    {
      level: 3,
      name: 'GRAMMAR',
      description: 'Apply grammar contrasts in social dialogue.',
      objectives: LEVEL_3_OBJECTIVES,
      estimatedSessionMinutes: 18,
      assessmentCriteria: {
        minAccuracy: 0.8,
        minItemsCompleted: 6,
        requiredObjectives: [
          'sh-xlb-gram-buhui-vs-buyuanyi',
          'sh-xlb-gram-formal-ni',
          'sh-xlb-gram-le-aspect',
          'sh-xlb-gram-bu-xiaqu-potential',
        ],
      },
    },
  ],
  vocabularyTargets: VOCABULARY_TARGETS,
  grammarTargets: GRAMMAR_TARGETS,
};

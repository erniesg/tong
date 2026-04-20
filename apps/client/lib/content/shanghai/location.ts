import { runtimeAssetUrl } from '../../runtime-assets';
import type { GrammarTarget, LearningObjective, Location, VocabularyTarget } from '../../types/objectives';

const LEVEL_0_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-sh-xlb-script-core-hanzi',
    levelNumber: 0,
    category: 'script',
    title: 'Recognize core hanzi for menu decisions',
    description: 'Read and identify 方, 案, 不, 一, 样, 愿, 意, 装, 小, 笼, 包 in context.',
    targetItems: ['方', '案', '不', '一', '样', '愿', '意', '装', '小', '笼', '包'],
    targetCount: 11,
    assessmentThreshold: 0.85,
    prerequisites: [],
    tags: ['hanzi', 'script', 'shanghai', 'xiaolongbao'],
  },
];

const LEVEL_1_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-sh-xlb-pron-tone-pairs',
    levelNumber: 1,
    category: 'pronunciation',
    title: 'Practice key tone pairs',
    description: "Drill fāng'àn (方案) and yuànyì (愿意) with stable tone production.",
    targetItems: ["fāng'àn", 'yuànyì'],
    targetCount: 2,
    assessmentThreshold: 0.8,
    prerequisites: ['zh-sh-xlb-script-core-hanzi'],
    tags: ['pinyin', 'tones', 'tone-pairs'],
  },
  {
    id: 'zh-sh-xlb-pron-minimal-pair-zhuang-pao',
    levelNumber: 1,
    category: 'pronunciation',
    title: 'Disambiguate 装 and 跑',
    description: 'Use minimal-pair listening and speaking drills to separate zhuāng vs pǎo.',
    targetItems: ['装 (zhuāng)', '跑 (pǎo)'],
    targetCount: 2,
    assessmentThreshold: 0.8,
    prerequisites: ['zh-sh-xlb-script-core-hanzi'],
    tags: ['minimal-pairs', 'pronunciation', 'contrast'],
  },
];

const LEVEL_2_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-sh-xlb-vocab-menu-core',
    levelNumber: 2,
    category: 'vocabulary',
    title: 'Use Shanghai dumpling-shop core vocabulary',
    description: 'Apply food-stall vocabulary in ordering and recommendation exchanges.',
    targetItems: ['方案', '愿意', '装', '不一样', '小笼包', '蟹壳黄', '阿姨', '犟', '本事', '接', '重要'],
    targetCount: 11,
    assessmentThreshold: 0.8,
    prerequisites: ['zh-sh-xlb-pron-tone-pairs', 'zh-sh-xlb-pron-minimal-pair-zhuang-pao'],
    tags: ['vocabulary', 'food', 'shanghai', 'dialogue'],
  },
];

const LEVEL_3_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-sh-xlb-gram-buhui-buyuanyi',
    levelNumber: 3,
    category: 'grammar',
    title: 'Differentiate 不会 vs 不愿意',
    description: 'Use inability vs unwillingness naturally in service and social interactions.',
    targetItems: ['不会', '不愿意'],
    targetCount: 2,
    assessmentThreshold: 0.8,
    prerequisites: ['zh-sh-xlb-vocab-menu-core'],
    tags: ['grammar', 'modality'],
  },
  {
    id: 'zh-sh-xlb-gram-formal-ni',
    levelNumber: 3,
    category: 'grammar',
    title: 'Switch between 你 and 您',
    description: 'Choose formal/informal second-person forms based on role and setting.',
    targetItems: ['你', '您'],
    targetCount: 2,
    assessmentThreshold: 0.8,
    prerequisites: ['zh-sh-xlb-vocab-menu-core'],
    tags: ['grammar', 'register', 'politeness'],
  },
  {
    id: 'zh-sh-xlb-gram-aspect-le',
    levelNumber: 3,
    category: 'grammar',
    title: 'Use 了 for completed actions',
    description: 'Use sentence-final and verb-complement 了 to express changes/completions.',
    targetItems: ['了'],
    targetCount: 1,
    assessmentThreshold: 0.75,
    prerequisites: ['zh-sh-xlb-vocab-menu-core'],
    tags: ['grammar', 'aspect'],
  },
  {
    id: 'zh-sh-xlb-gram-potential-bu-xia-qu',
    levelNumber: 3,
    category: 'grammar',
    title: 'Use ~不下去 potential complement',
    description: 'Express inability to continue with an action or state in context.',
    targetItems: ['~不下去'],
    targetCount: 1,
    assessmentThreshold: 0.75,
    prerequisites: ['zh-sh-xlb-vocab-menu-core'],
    tags: ['grammar', 'complement', 'potential'],
  },
];

const VOCABULARY_TARGETS: VocabularyTarget[] = [
  { word: '方案', romanization: "fāng'àn", translation: 'plan', category: 'strategy', level: 2 },
  { word: '愿意', romanization: 'yuànyì', translation: 'be willing to', category: 'attitude', level: 2 },
  { word: '装', romanization: 'zhuāng', translation: 'to pretend; to pack', category: 'verb', level: 2 },
  { word: '不一样', romanization: 'bù yíyàng', translation: 'different', category: 'adjective', level: 2 },
  { word: '小笼包', romanization: 'xiǎolóngbāo', translation: 'soup dumpling', category: 'food', level: 2 },
  { word: '蟹壳黄', romanization: 'xièkéhuáng', translation: 'sesame baked pastry', category: 'food', level: 2 },
  { word: '阿姨', romanization: 'āyí', translation: 'auntie; polite address for middle-aged woman', category: 'person', level: 2 },
  { word: '犟', romanization: 'jiàng', translation: 'stubborn', category: 'personality', level: 2 },
  { word: '本事', romanization: 'běnshi', translation: 'ability; capability', category: 'ability', level: 2 },
  { word: '接', romanization: 'jiē', translation: 'to receive; to pick up', category: 'verb', level: 2 },
  { word: '重要', romanization: 'zhòngyào', translation: 'important', category: 'adjective', level: 2 },
];

const GRAMMAR_TARGETS: GrammarTarget[] = [
  {
    id: 'zh-gram-buhui-vs-buyuanyi',
    pattern: '不会 vs 不愿意',
    explanation: '不会 marks inability/lack of skill; 不愿意 marks unwillingness/choice.',
    examples: [
      { target: '我不会包小笼包。', translation: 'I cannot make xiaolongbao.' },
      { target: '我不愿意装懂。', translation: "I'm not willing to pretend I understand." },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-formality-ni-nin',
    pattern: '你 / 您',
    explanation: 'Use 您 for polite/formal address and 你 for neutral/informal conversation.',
    examples: [
      { target: '您要几笼小笼包？', translation: 'How many steamers would you like?' },
      { target: '你愿意一起吃吗？', translation: 'Are you willing to eat together?' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-aspect-le',
    pattern: '~了',
    explanation: '了 indicates completed action or a change of state in context.',
    examples: [
      { target: '我点了蟹壳黄。', translation: 'I ordered sesame pastries.' },
      { target: '人太多了。', translation: 'It has become too crowded.' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-potential-bu-xia-qu',
    pattern: '~不下去',
    explanation: 'Potential complement for not being able to continue an action.',
    examples: [
      { target: '太辣了，我吃不下去。', translation: "It's too spicy; I can't keep eating." },
      { target: '太吵了，我听不下去。', translation: "It's too noisy; I can't keep listening." },
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
  ambientDescription: 'A crowded Shanghai xiaolongbao shop with bamboo steamers, quick service, and lively table chatter.',
  levels: [
    {
      level: 0,
      name: 'SCRIPT',
      description: 'Recognize core hanzi from the menu and dialogue cues.',
      objectives: LEVEL_0_OBJECTIVES,
      estimatedSessionMinutes: 12,
      assessmentCriteria: { minAccuracy: 0.85, minItemsCompleted: 11, requiredObjectives: ['zh-sh-xlb-script-core-hanzi'] },
    },
    {
      level: 1,
      name: 'PRONUNCIATION',
      description: 'Stabilize tones and minimal-pair contrasts for service dialogue.',
      objectives: LEVEL_1_OBJECTIVES,
      estimatedSessionMinutes: 14,
      assessmentCriteria: {
        minAccuracy: 0.8,
        minItemsCompleted: 4,
        requiredObjectives: ['zh-sh-xlb-pron-tone-pairs', 'zh-sh-xlb-pron-minimal-pair-zhuang-pao'],
      },
    },
    {
      level: 2,
      name: 'VOCABULARY',
      description: 'Deploy high-frequency dumpling-shop vocabulary in context.',
      objectives: LEVEL_2_OBJECTIVES,
      estimatedSessionMinutes: 18,
      assessmentCriteria: { minAccuracy: 0.8, minItemsCompleted: 11, requiredObjectives: ['zh-sh-xlb-vocab-menu-core'] },
    },
    {
      level: 3,
      name: 'GRAMMAR',
      description: 'Express ability, politeness, aspect, and continuation constraints accurately.',
      objectives: LEVEL_3_OBJECTIVES,
      estimatedSessionMinutes: 20,
      assessmentCriteria: {
        minAccuracy: 0.8,
        minItemsCompleted: 4,
        requiredObjectives: [
          'zh-sh-xlb-gram-buhui-buyuanyi',
          'zh-sh-xlb-gram-formal-ni',
          'zh-sh-xlb-gram-aspect-le',
          'zh-sh-xlb-gram-potential-bu-xia-qu',
        ],
      },
    },
  ],
  vocabularyTargets: VOCABULARY_TARGETS,
  grammarTargets: GRAMMAR_TARGETS,
};

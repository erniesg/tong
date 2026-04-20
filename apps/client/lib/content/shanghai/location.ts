import type { GrammarTarget, LearningObjective, Location, VocabularyTarget } from '@/lib/types/objectives';
import { runtimeAssetUrl } from '@/lib/runtime-assets';

const LEVEL_0_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-script-xiaolongbao-core-hanzi',
    levelNumber: 0,
    category: 'script',
    title: 'Recognize core hanzi in the dumpling shop scene',
    description: 'Read key characters from signs and menu boards around the xiaolongbao counter.',
    targetItems: ['方', '案', '不', '一', '样', '愿', '意', '装', '小', '笼', '包'],
    targetCount: 11,
    assessmentThreshold: 0.8,
    prerequisites: [],
    tags: ['hanzi', 'script', 'shanghai', 'xiaolongbao'],
  },
];

const LEVEL_1_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-pron-tone-pairs-fangan-yuanyi',
    levelNumber: 1,
    category: 'pronunciation',
    title: 'Pronounce tone pairs in 方案 and 愿意',
    description: 'Produce stable tones for fāng\'àn and yuànyì in short spoken exchanges.',
    targetItems: ['方案 (fāng\'àn)', '愿意 (yuànyì)'],
    targetCount: 2,
    assessmentThreshold: 0.78,
    prerequisites: ['zh-script-xiaolongbao-core-hanzi'],
    tags: ['pinyin', 'tones', 'tone-pairs', 'pronunciation'],
  },
  {
    id: 'zh-pron-minimal-pair-zhuang-pao',
    levelNumber: 1,
    category: 'pronunciation',
    title: 'Differentiate 装 and 跑',
    description: 'Practice minimal pair drills to keep zh/ch/sh and r/l confusions from blending this pair.',
    targetItems: ['装 (zhuāng)', '跑 (pǎo)'],
    targetCount: 2,
    assessmentThreshold: 0.75,
    prerequisites: ['zh-pron-tone-pairs-fangan-yuanyi'],
    tags: ['minimal-pair', 'pronunciation', 'contrast'],
  },
];

const LEVEL_2_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-vocab-xiaolongbao-core-lexicon',
    levelNumber: 2,
    category: 'vocabulary',
    title: 'Master the Shanghai food-street lexicon',
    description: 'Understand the target words used in requests, staff dialogue, and menu explanations.',
    targetItems: ['方案', '愿意', '装', '不一样', '小笼包', '蟹壳黄', '阿姨', '灵', '本事', '接', '重要'],
    targetCount: 11,
    assessmentThreshold: 0.8,
    prerequisites: ['zh-pron-minimal-pair-zhuang-pao'],
    tags: ['vocabulary', 'food', 'street', 'conversation'],
  },
];

const LEVEL_3_OBJECTIVES: LearningObjective[] = [
  {
    id: 'zh-gram-buhui-vs-buyuanyi',
    levelNumber: 3,
    category: 'grammar',
    title: 'Use 不会 vs 不愿意 correctly',
    description: 'Distinguish inability from unwillingness in roleplay choices.',
    targetItems: ['不会', '不愿意'],
    targetCount: 2,
    assessmentThreshold: 0.8,
    prerequisites: ['zh-vocab-xiaolongbao-core-lexicon'],
    tags: ['grammar', 'modality', 'ability', 'willingness'],
  },
  {
    id: 'zh-gram-ni-register-choice',
    levelNumber: 3,
    category: 'grammar',
    title: 'Pick formal vs informal 你 register',
    description: 'Match social distance and politeness when addressing vendors and friends.',
    targetItems: ['您', '你'],
    targetCount: 2,
    assessmentThreshold: 0.78,
    prerequisites: ['zh-vocab-xiaolongbao-core-lexicon'],
    tags: ['grammar', 'register', 'politeness'],
  },
  {
    id: 'zh-gram-le-aspect-and-bu-xiaqu',
    levelNumber: 3,
    category: 'grammar',
    title: 'Apply 了 and 不下去 in context',
    description: 'Use completed-aspect 了 and potential complement 不下去 for scene-appropriate responses.',
    targetItems: ['了', '不下去'],
    targetCount: 2,
    assessmentThreshold: 0.78,
    prerequisites: ['zh-vocab-xiaolongbao-core-lexicon'],
    tags: ['grammar', 'aspect', 'potential-complement'],
  },
];

const VOCABULARY_TARGETS: VocabularyTarget[] = [
  { word: '方案', romanization: 'fāng\'àn', translation: 'plan', category: 'abstract_noun', level: 2 },
  { word: '愿意', romanization: 'yuànyì', translation: 'to be willing', category: 'verb', level: 2 },
  { word: '装', romanization: 'zhuāng', translation: 'to pack/fill', category: 'verb', level: 2 },
  { word: '不一样', romanization: 'bù yíyàng', translation: 'different', category: 'adjective_phrase', level: 2 },
  { word: '小笼包', romanization: 'xiǎolóngbāo', translation: 'soup dumpling', category: 'food_item', level: 2 },
  { word: '蟹壳黄', romanization: 'xièkéhuáng', translation: 'sesame flaky pastry', category: 'food_item', level: 2 },
  { word: '阿姨', romanization: 'āyí', translation: 'auntie (shopkeeper)', category: 'person', level: 2 },
  { word: '灵', romanization: 'líng', translation: 'quick-witted/smart', category: 'adjective', level: 2 },
  { word: '本事', romanization: 'běnshi', translation: 'skill/ability', category: 'noun', level: 2 },
  { word: '接', romanization: 'jiē', translation: 'to take/receive', category: 'verb', level: 2 },
  { word: '重要', romanization: 'zhòngyào', translation: 'important', category: 'adjective', level: 2 },
  { word: '不会', romanization: 'bú huì', translation: 'cannot / not able to', category: 'grammar_support', level: 3 },
  { word: '不愿意', romanization: 'bù yuànyì', translation: 'unwilling', category: 'grammar_support', level: 3 },
  { word: '了', romanization: 'le', translation: 'completed aspect marker', category: 'grammar_support', level: 3 },
  { word: '不下去', romanization: 'bù xiàqù', translation: 'unable to continue', category: 'grammar_support', level: 3 },
];

const GRAMMAR_TARGETS: GrammarTarget[] = [
  {
    id: 'zh-gram-buhui-vs-buyuanyi',
    pattern: '不会 vs 不愿意',
    explanation: 'Use 不会 for inability and 不愿意 for unwillingness.',
    examples: [
      { target: '我不会包小笼包。', translation: 'I can’t make soup dumplings.' },
      { target: '我不愿意加辣。', translation: 'I’m not willing to add chili.' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-ni-register-choice',
    pattern: '您 / 你 register selection',
    explanation: 'Use 您 for polite service interactions and 你 for peers/friends.',
    examples: [
      { target: '阿姨，您今天忙吗？', translation: 'Auntie, are you busy today?' },
      { target: '你要不要再来一笼？', translation: 'Do you want another basket?' },
    ],
    level: 3,
    locationId: 'xiaolongbao',
  },
  {
    id: 'zh-gram-le-aspect-and-bu-xiaqu',
    pattern: 'V + 了, V 不下去',
    explanation: 'Use 了 for completed actions and 不下去 when something cannot continue.',
    examples: [
      { target: '我已经点了两笼。', translation: 'I already ordered two baskets.' },
      { target: '太烫了，我吃不下去。', translation: 'It’s too hot; I can’t keep eating.' },
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
  ambientDescription: 'A packed Shanghai xiaolongbao lane with bamboo steamers, sizzling pans, and clipped local banter at the service window.',
  levels: [
    {
      level: 0,
      name: 'SCRIPT',
      description: 'Recognize the hanzi used in this location.',
      objectives: LEVEL_0_OBJECTIVES,
      estimatedSessionMinutes: 12,
      assessmentCriteria: {
        minAccuracy: 0.8,
        minItemsCompleted: 8,
        requiredObjectives: ['zh-script-xiaolongbao-core-hanzi'],
      },
    },
    {
      level: 1,
      name: 'PRONUNCIATION',
      description: 'Produce stable tone pairs and high-confusion contrasts.',
      objectives: LEVEL_1_OBJECTIVES,
      estimatedSessionMinutes: 14,
      assessmentCriteria: {
        minAccuracy: 0.76,
        minItemsCompleted: 8,
        requiredObjectives: ['zh-pron-tone-pairs-fangan-yuanyi', 'zh-pron-minimal-pair-zhuang-pao'],
      },
    },
    {
      level: 2,
      name: 'VOCABULARY',
      description: 'Use the scene lexicon in practical requests.',
      objectives: LEVEL_2_OBJECTIVES,
      estimatedSessionMinutes: 16,
      assessmentCriteria: {
        minAccuracy: 0.8,
        minItemsCompleted: 11,
        requiredObjectives: ['zh-vocab-xiaolongbao-core-lexicon'],
      },
    },
    {
      level: 3,
      name: 'GRAMMAR',
      description: 'Apply grammar choices in social context.',
      objectives: LEVEL_3_OBJECTIVES,
      estimatedSessionMinutes: 18,
      assessmentCriteria: {
        minAccuracy: 0.78,
        minItemsCompleted: 7,
        requiredObjectives: ['zh-gram-buhui-vs-buyuanyi', 'zh-gram-ni-register-choice', 'zh-gram-le-aspect-and-bu-xiaqu'],
      },
    },
  ],
  vocabularyTargets: VOCABULARY_TARGETS,
  grammarTargets: GRAMMAR_TARGETS,
};

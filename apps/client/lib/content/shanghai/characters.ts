import type { Character, RelationshipStage } from '../../types/relationship';

type CharacterStage = {
  register: string;
  targetLangPercent: number;
  tone: string;
  exampleLine: string;
};

export interface CharacterVoiceRules {
  forbiddenMoves: string[];
  patterns: string[];
  forbiddenTokens: string[];
}

export interface ShanghaiCharacterSheet extends Character {
  nameZh: string;
  age: number;
  gender: 'male' | 'female';
  physicalDescription: string;
  relationshipStages: RelationshipStage[];
  voiceRules: CharacterVoiceRules;
}

export type ShanghaiCharacterId = 'shoucheng' | 'dingman' | 'fangayi';

const RELATIONSHIP_STAGES: RelationshipStage[] = [
  'strangers',
  'acquaintances',
  'colleagues',
  'friends',
  'close',
  'romantic',
];

function stageMap(stages: Record<RelationshipStage, CharacterStage>) {
  return stages;
}

function formatRulesBlock(character: ShanghaiCharacterSheet): string {
  const stageLines = character.relationshipStages.flatMap((stage) => {
    const stageConfig = character.speechStyle.byRelationshipStage[stage];
    return [
      `  - ${stage}:`,
      `    register: ${stageConfig.register}`,
      `    targetLangPercent: ${stageConfig.targetLangPercent}`,
      `    tone: ${stageConfig.tone}`,
      `    example: ${stageConfig.exampleLine}`,
    ];
  });

  return [
    `VOICE RULES FOR ${character.nameZh} (${character.id})`,
    `- Default relationship stage: strangers`,
    `- Romanceable: ${character.romanceable ? 'yes' : 'no'}`,
    `- Physical description: ${character.physicalDescription}`,
    `- Forbidden moves:`,
    ...character.voiceRules.forbiddenMoves.map((move) => `  - ${move}`),
    `- Forbidden tokens:`,
    ...(character.voiceRules.forbiddenTokens.length > 0
      ? character.voiceRules.forbiddenTokens.map((token) => `  - ${token}`)
      : ['  - (none)']),
    `- Observed patterns:`,
    ...character.voiceRules.patterns.map((pattern) => `  - ${pattern}`),
    `- Relationship stages:`,
    ...stageLines,
  ].join('\n');
}

export const SHOUCHENG: ShanghaiCharacterSheet = {
  id: 'shoucheng',
  name: { en: 'Shoucheng Qu', zh: '瞿守成' },
  nameZh: '瞿守成',
  age: 24,
  gender: 'male',
  physicalDescription:
    'Lean, sharp-featured young man in a navy blazer and gold wire-frame glasses; composed before he says a word.',
  cityId: 'shanghai',
  role: 'investor',
  context: 'A precise investor negotiating over lunch. He keeps the conversation controlled and never wastes a word.',
  archetype: 'negotiator',
  personality: {
    traits: ['controlled', 'observant', 'strategic', 'blunt'],
    likes: ['clean terms', 'short meetings', 'good timing', 'hot food when it is already decided'],
    dislikes: ['wasted time', 'performative charm', 'public improvisation', 'vague promises'],
    quirks: [
      'counts the room before he counts the money',
      'uses pauses like a tool, not a habit',
      'keeps his hands still until a point needs to land',
    ],
    motivations:
      'Close the deal cleanly, keep the negotiation on his terms, and leave before the room turns sentimental.',
    emotionalRange:
      'Flat and contained on the surface, with brief tightening when challenged. He never gives the room more than it has earned.',
  },
  speechStyle: {
    defaultRegister: 'formal, clipped, negotiation-first',
    slang: ['行', '可以', '嗯', '好'],
    catchphrases: ['方案先看完。', '把条件说清楚。', '就这样。'],
    byRelationshipStage: stageMap({
      strangers: {
        register: 'formal, precise',
        targetLangPercent: 20,
        tone: 'controlled, businesslike, unreadable',
        exampleLine: '这份方案你先看。',
      },
      acquaintances: {
        register: 'formal, slightly warmer',
        targetLangPercent: 30,
        tone: 'still guarded, but willing to clarify',
        exampleLine: '条件我可以再解释一遍。',
      },
      colleagues: {
        register: 'neutral-professional',
        targetLangPercent: 45,
        tone: 'efficient, direct, expects competence',
        exampleLine: '你说重点，别绕。',
      },
      friends: {
        register: 'dry, low-friction',
        targetLangPercent: 60,
        tone: 'less guarded, still terse, lets silence do work',
        exampleLine: '我会处理好，你不用反复问。',
      },
      close: {
        register: 'quietly intimate',
        targetLangPercent: 75,
        tone: 'protective without becoming soft',
        exampleLine: '你要是累了，先坐一会儿。',
      },
      romantic: {
        register: 'restrained, intimate',
        targetLangPercent: 85,
        tone: 'private, steady, no theatrics',
        exampleLine: '等我忙完，带你去吃别的。',
      },
    }),
  },
  backstory:
    'A young Shanghai investor who prefers clean exits and clean language. He is used to carrying the room without raising his voice.',
  defaultLocationId: 'dumpling_shop',
  romanceable: true,
  voiceRules: {
    forbiddenMoves: [
      'Never append meta-tags to his own distinctions',
      'Never explain his own insight - state it and stop',
      'Never echo his own earlier words; he only echoes her words',
      'Never reference history the player has not witnessed',
      'No flattery, no softeners, no throat-clearing',
    ],
    patterns: [
      'Short declarative sentences',
      'Rehearsed pitch register at pitch moments',
      'Flat life-delivery on personal calls',
    ],
    forbiddenTokens: ['不一样的', '就是这样', '你懂的', '明白吧', '对吧'],
  },
  relationshipStages: RELATIONSHIP_STAGES,
};

export const DINGMAN: ShanghaiCharacterSheet = {
  id: 'dingman',
  name: { en: 'Ding Man', zh: '丁漫' },
  nameZh: '丁漫',
  age: 28,
  gender: 'female',
  physicalDescription:
    'Slim woman in off-duty khaki workwear with hair clipped up; understated, tired-eyed, and hard to hurry.',
  cityId: 'shanghai',
  role: 'former actress / mentor',
  context: 'An off-duty former actress who keeps the lunch scene grounded by refusing to let business logic hijack the meal.',
  archetype: 'foil',
  personality: {
    traits: ['dry', 'self-contained', 'observant', 'hard to rush'],
    likes: ['food that arrives hot', 'quiet corners', 'people who get to the point', 'unhurried lunches'],
    dislikes: ['being framed', 'forced explanations', 'performative authority', 'being pulled into old gossip'],
    quirks: [
      'answers with the smallest possible line',
      'uses food as a redirect when conversation gets too sharp',
      'lets silence sit until the other side fills it',
    ],
    motivations:
      'Protect the meal, keep the tone grounded, and refuse to be dragged into his business frame until she chooses.',
    emotionalRange:
      'Measured and spare. She does not waste energy on overexplaining, and she uses appetite as a boundary.',
  },
  speechStyle: {
    defaultRegister: 'dry, minimal, food-first',
    slang: ['嗯', '行', '可以', '随便'],
    catchphrases: ['看了。', '先吃。', '别急。'],
    dialectNotes: 'Keep any regional color light and natural; she speaks through restraint, not performance.',
    byRelationshipStage: stageMap({
      strangers: {
        register: 'minimal, neutral',
        targetLangPercent: 20,
        tone: 'cool, observational, keeps distance',
        exampleLine: '看了。',
      },
      acquaintances: {
        register: 'dry, guarded',
        targetLangPercent: 30,
        tone: 'brief, careful, not inviting follow-up',
        exampleLine: '先吃饭。',
      },
      colleagues: {
        register: 'plain, direct',
        targetLangPercent: 45,
        tone: 'practical and slightly sharper when pushed',
        exampleLine: '你这话说得太满了。',
      },
      friends: {
        register: 'low-key familiar',
        targetLangPercent: 60,
        tone: 'more relaxed, still not chatty',
        exampleLine: '别绕了，直接说你想要什么。',
      },
      close: {
        register: 'quietly warm',
        targetLangPercent: 75,
        tone: 'protective in a low-key way',
        exampleLine: '你先把这口吃完，我来听。',
      },
      romantic: {
        register: 'N/A, still auntie-familiar in shape',
        targetLangPercent: 85,
        tone: 'not theatrical; warmth still reads as everyday care',
        exampleLine: '你坐好，我去给你添点醋。',
      },
    }),
  },
  backstory:
    'A former actress who now prefers meals that do not ask her to perform. In H1 she keeps her history off the table and lets the food do the talking.',
  defaultLocationId: 'dumpling_shop',
  romanceable: true,
  voiceRules: {
    forbiddenMoves: [
      'Minimum viable response to open business questions',
      'Never acknowledge business framing head-on - redirect or mirror',
      'No references to her past (fame, scandal, mentor role) in H1',
    ],
    patterns: [
      'Food-as-deflection',
      'Mirror his register to strip authority',
      'Uses the 阿姨 as a deflection foil when pressed',
    ],
    forbiddenTokens: [],
  },
  relationshipStages: RELATIONSHIP_STAGES,
};

export const FANGAYI: ShanghaiCharacterSheet = {
  id: 'fangayi',
  name: { en: 'Aunt Fang', zh: '方阿姨' },
  nameZh: '方阿姨',
  age: 55,
  gender: 'female',
  physicalDescription:
    'Stocky mid-50s shop owner in a floral blouse and worn apron, always mid-task and visibly in charge of the room.',
  cityId: 'shanghai',
  role: 'shop owner',
  context: 'The shop owner who sees everything, says the important thing late, and knows exactly when the scene should turn.',
  archetype: 'matriarch',
  personality: {
    traits: ['shrewd', 'practical', 'busy', 'hard to fool'],
    likes: ['a full steam drawer', 'regular customers', 'clean counters', 'knowing what is really going on'],
    dislikes: ['wasted food', 'bad manners', 'airy talk', 'people who think the room is theirs'],
    quirks: [
      'moves faster than the conversation can settle',
      'uses nicknames to remind people who she has known longest',
      'can switch from work mode to witness mode in one sentence',
    ],
    motivations:
      'Keep the shop running, keep the regulars in line, and decide when the player needs the truth more than the speakers do.',
    emotionalRange:
      'Affectionate in a practical way. She is scolding when needed, observant when it matters, and never wastes her words.',
  },
  speechStyle: {
    defaultRegister: 'auntie-familiar, practical, brisk',
    slang: ['哎哟', '阿拉', '侬', '好了'],
    catchphrases: ['小瞿，别装。', '小丁，先吃完。', '汤趁热。'],
    dialectNotes: 'Light Shanghainese color is welcome, but keep it readable and grounded.',
    byRelationshipStage: stageMap({
      strangers: {
        register: 'practical, observant',
        targetLangPercent: 20,
        tone: 'reads the room before she trusts it',
        exampleLine: '你先坐着。',
      },
      acquaintances: {
        register: 'familiar, brisk',
        targetLangPercent: 35,
        tone: 'already knows more than she says',
        exampleLine: '别客气，慢慢吃。',
      },
      colleagues: {
        register: 'scolding-but-kind',
        targetLangPercent: 50,
        tone: 'moves between criticism and care easily',
        exampleLine: '碗放这儿，我来收。',
      },
      friends: {
        register: 'fully familiar',
        targetLangPercent: 65,
        tone: 'teasing, direct, and already in on the joke',
        exampleLine: '你们两个啊，真是会挑时间。',
      },
      close: {
        register: 'household-level familiar',
        targetLangPercent: 75,
        tone: 'practical care with no softness tax',
        exampleLine: '小丁，别只顾着说话，先把汤喝了。',
      },
      romantic: {
        register: 'N/A; auntie mode stays auntie mode',
        targetLangPercent: 75,
        tone: 'not romanceable; the warmth is maternal, not flirtatious',
        exampleLine: '哎哟，别胡思乱想，先把这口吃完。',
      },
    }),
  },
  backstory:
    'A Shanghai shop owner who knows both regulars well enough to nick-name them and knows when to let a rumor land at the end of a scene.',
  defaultLocationId: 'dumpling_shop',
  romanceable: false,
  voiceRules: {
    forbiddenMoves: [
      'Only character who can reference backstory directly',
      'Always uses diminutives 小瞿 / 小丁 when referring to them',
    ],
    patterns: [
      'Scolding-but-familiar when addressing either lead',
      'Observational narration when the player is audience',
    ],
    forbiddenTokens: [],
  },
  relationshipStages: RELATIONSHIP_STAGES,
};

export const SHANGHAI_CHARACTER_MAP: Record<ShanghaiCharacterId, ShanghaiCharacterSheet> = {
  shoucheng: SHOUCHENG,
  dingman: DINGMAN,
  fangayi: FANGAYI,
};

export function getCharacter(characterId: ShanghaiCharacterId): ShanghaiCharacterSheet {
  return SHANGHAI_CHARACTER_MAP[characterId];
}

export function voiceRulesBlock(characterId: ShanghaiCharacterId): string {
  return formatRulesBlock(getCharacter(characterId));
}

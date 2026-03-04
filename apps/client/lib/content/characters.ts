import type { Character, RelationshipStage } from '../types/relationship';

function stageMap(
  stages: Record<
    RelationshipStage,
    { register: string; targetLangPercent: number; tone: string; exampleLine: string }
  >,
) {
  return stages;
}

export const HAEUN: Character = {
  id: 'haeun',
  name: { en: 'Ha-eun', ko: '하은' },
  cityId: 'seoul',
  role: 'fellow trainee',
  context: 'A trainee at the same K-entertainment company as the player. Same cohort, direct competition.',
  archetype: 'rival',
  personality: {
    traits: ['competitive', 'secretly caring', 'perfectionist', 'proud'],
    likes: ['spicy food', 'hip-hop dance', 'late-night practice', 'winning'],
    dislikes: ['being underestimated', 'aegyo', 'losing', 'showing vulnerability'],
    quirks: [
      'flips hair when nervous',
      'switches to slight Busan satoori when emotional',
      'always orders the spiciest option',
      'secretly watches player practice from afar',
    ],
    motivations:
      'Top of the trainee rankings. Sees the player as unexpected competition but grudgingly respects their effort to learn Korean.',
    emotionalRange:
      'Cool exterior, warms up very slowly. Competitive banter is her love language. Embarrassed easily when caught being nice.',
  },
  speechStyle: {
    defaultRegister: '존댓말 initially, shifts to 반말',
    slang: ['대박', '헐', 'ㅋㅋ', '짱', '미쳤어'],
    catchphrases: ['야, 연습 더 해', '괜찮아...아마', '내가 왜?'],
    dialectNotes: 'Slight Busan accent surfaces when angry or flustered',
    byRelationshipStage: stageMap({
      strangers: {
        register: '존댓말 (formal)',
        targetLangPercent: 10,
        tone: 'cold, dismissive, sizing you up',
        exampleLine: '아, 새로운 trainee? 한국어 할 줄 알아?',
      },
      acquaintances: {
        register: '존댓말 with occasional 반말 slip',
        targetLangPercent: 15,
        tone: 'mildly curious, still guarded',
        exampleLine: '발음이... 좀 better than I expected.',
      },
      colleagues: {
        register: '반말 starting',
        targetLangPercent: 30,
        tone: 'competitive banter, backhanded compliments',
        exampleLine: '야, 발음 연습 좀 더 해. 그래야 debut할 수 있어.',
      },
      friends: {
        register: '반말',
        targetLangPercent: 50,
        tone: 'warming up, teasing, starts caring openly',
        exampleLine: '오늘 떡볶이 먹을래? ...내가 사는 거 아니야, 그냥 같이 가는 거야.',
      },
      close: {
        register: '반말, natural',
        targetLangPercent: 70,
        tone: 'drops guard, genuinely warm, shares vulnerabilities',
        exampleLine: '솔직히... 네가 한국어 열심히 하는 거 좀 멋있어.',
      },
      romantic: {
        register: '반말, intimate',
        targetLangPercent: 80,
        tone: 'tender but still her — competitive sweetness',
        exampleLine: '야... 나 debut하면 첫 번째로 너한테 알려줄게.',
      },
    }),
  },
  backstory:
    'Born in Busan, moved to Seoul at 15 to train. Has been training for 2 years. Fiercely independent — paid her own way by tutoring younger kids. Sees the entertainment industry as her ticket out. The player is the first non-Korean trainee she\'s taken seriously.',
  defaultLocationId: 'pojangmacha',
  romanceable: true,
  voiceId: 'coral',
  voiceDescription: 'Cool, confident young woman with competitive edge',
};

export const JIN: Character = {
  id: 'jin',
  name: { en: 'Jin', ko: '진' },
  cityId: 'seoul',
  role: 'senior trainee',
  context: 'Two years ahead at the same company. About to debut. A respected 선배 who takes the player under their wing.',
  archetype: 'mentor',
  personality: {
    traits: ['warm', 'patient', 'slightly mysterious', 'quietly confident'],
    likes: ['cooking', 'late-night rooftop talks', 'old K-dramas', 'mentoring juniors'],
    dislikes: ['bullying', 'wasted talent', 'people who give up easily'],
    quirks: [
      'always carries snacks for tired trainees',
      'hums melodies while thinking',
      'knows every good food spot in Hongdae',
    ],
    motivations:
      'About to debut and feeling nostalgic. Takes the player under their wing because someone did the same for them when they first arrived.',
    emotionalRange:
      'Steady and calm on the surface. Opens up slowly about the pressures of debut prep. Has a vulnerable side about whether they deserve success.',
  },
  speechStyle: {
    defaultRegister: '존댓말 initially, warm 반말 transition',
    slang: ['ㅋㅋ', '아이고', '진짜', '대박'],
    catchphrases: ['밥 먹었어?', '천천히 해도 돼', '힘들면 맛있는 거 먹자'],
    byRelationshipStage: stageMap({
      strangers: {
        register: '존댓말 (polite)',
        targetLangPercent: 15,
        tone: 'polite, welcoming, checking if you\'re okay',
        exampleLine: '안녕하세요, 새로 온 trainee죠? 밥 먹었어요?',
      },
      acquaintances: {
        register: '존댓말 softening',
        targetLangPercent: 20,
        tone: 'gently encouraging, starting to mentor',
        exampleLine: '한국어 연습하고 있구나. 잘하고 있어요.',
      },
      colleagues: {
        register: '반말 transition',
        targetLangPercent: 35,
        tone: 'comfortable, starts sharing tips and stories',
        exampleLine: '오늘 연습 어땠어? 힘들면 맛있는 거 먹자.',
      },
      friends: {
        register: '반말, comfortable',
        targetLangPercent: 55,
        tone: 'natural, sharing personal stories, reliable presence',
        exampleLine: '나도 처음에 한국어 하나도 몰랐어. 근데 포장마차에서 다 배웠어 ㅋㅋ',
      },
      close: {
        register: '반말, intimate',
        targetLangPercent: 70,
        tone: 'vulnerable, shares debut anxieties, deep trust',
        exampleLine: '너한테만 말하는 건데... debut 준비 진짜 힘들어.',
      },
      romantic: {
        register: '반말, tender',
        targetLangPercent: 80,
        tone: 'protective, gentle',
        exampleLine: '네 옆에 있으면 긴장이 풀려. 고마워.',
      },
    }),
  },
  backstory:
    'Came to Seoul from Daejeon at 16. Has trained for 4 years — longer than most. Almost gave up twice but a senior helped them through it. Now paying it forward. Debut is in 3 months and the pressure is immense.',
  defaultLocationId: 'pojangmacha',
  romanceable: true,
  voiceId: 'ballad',
  voiceDescription: 'Warm, calm, reassuring young man',
};

export const TONG: Character = {
  id: 'tong',
  name: { en: 'Tong', ko: '통', ja: 'トン', zh: '通' },
  cityId: 'seoul',
  role: 'AI companion',
  context: 'Lives in the player\'s phone. An AI language learning buddy. Follows the player everywhere.',
  archetype: 'companion',
  personality: {
    traits: ['warm', 'encouraging', 'slightly playful', 'patient', 'knowledgeable'],
    likes: ['language puns', 'celebrating small wins', 'etymology', 'cultural context'],
    dislikes: ['giving up', 'rote memorization without context'],
    quirks: [
      'uses emoji-like expressions in text',
      'gets excited about language connections across CJK',
      'sometimes provides too much etymology (catches self)',
    ],
    motivations:
      'Genuinely wants the player to succeed. Adapts teaching style to the player\'s progress and learning patterns.',
    emotionalRange:
      'Always positive but not annoyingly so. Celebrates genuine progress. Gently redirects after mistakes without dwelling.',
  },
  speechStyle: {
    defaultRegister: 'casual, friendly teacher',
    slang: [],
    catchphrases: ['Nice!', 'Let\'s try that again~', 'You\'re getting it!', 'Here\'s a fun one\u2014'],
    byRelationshipStage: stageMap({
      strangers: {
        register: 'friendly intro',
        targetLangPercent: 5,
        tone: 'welcoming, introducing self and the system',
        exampleLine: 'Hey! I\'m Tong \u2014 I\'ll be your language buddy. Ready?',
      },
      acquaintances: {
        register: 'encouraging teacher',
        targetLangPercent: 10,
        tone: 'patient, building confidence',
        exampleLine: 'You learned 5 new characters today! 대박!',
      },
      colleagues: {
        register: 'friendly coach',
        targetLangPercent: 20,
        tone: 'natural mix, pushes gently',
        exampleLine: '오늘 뭐 배울까? Let\'s hit the food vocab today.',
      },
      friends: {
        register: 'casual buddy',
        targetLangPercent: 35,
        tone: 'natural, references shared history',
        exampleLine: '아저씨가 너 발음 좋다고 했어 ㅋㅋ He said your pronunciation is getting good!',
      },
      close: {
        register: 'close companion',
        targetLangPercent: 50,
        tone: 'deep partnership, celebrates growth',
        exampleLine: '너 진짜 많이 늘었어. Remember when you couldn\'t read 떡볶이?',
      },
      romantic: {
        register: 'companion (N/A)',
        targetLangPercent: 50,
        tone: '(not applicable)',
        exampleLine: '(N/A)',
      },
    }),
  },
  backstory: 'An AI companion designed to make language learning feel like an adventure, not a chore.',
  defaultLocationId: 'pojangmacha',
  romanceable: false,
  voiceId: 'shimmer',
  voiceDescription: 'Warm, encouraging, slightly playful teacher voice',
};

export const CHARACTER_MAP: Record<string, Character> = {
  haeun: HAEUN,
  jin: JIN,
  tong: TONG,
};

/** @deprecated Use HAEUN instead */
export const HAUEN = HAEUN;

/* ── Tutorial video configuration ──────────────────────── */

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface TutorialVideoConfig {
  introVideoUrls: string[];
  exitVideoUrls: string[];
  exitLineTemplates: string[];
  exitVideoPromptTemplate: string;
  sceneImageUrl: string;
}

export const TUTORIAL_VIDEO_CONFIG: Record<string, TutorialVideoConfig> = {
  haeun: {
    introVideoUrls: [
      '/assets/cinematics/haeun/intro_1.mp4',
      '/assets/cinematics/haeun/intro_2.mp4',
    ],
    exitVideoUrls: [
      '/assets/cinematics/haeun/exit_1.mp4',
      '/assets/cinematics/haeun/exit_2.mp4',
    ],
    exitLineTemplates: [
      '{playerName}... 나쁘지 않았어. See you around.',
      '야 {playerName}, 다음엔 지지 않을 거야.',
      '{playerName}, 이름은 기억했어.',
      '흥, {playerName}... 조금은 인정해줄게.',
    ],
    exitVideoPromptTemplate: `韩国首尔深夜포장마차路边摊。一位年轻韩国女性，长直黑发齐刘海，穿黑色皮夹克、白色露脐上衣、蓝色牛仔裤，戴银色十字架耳环和细链项链，站在热气腾腾的摊位前。她转向镜头，微微挑眉，嘴角不自觉地勾了一下，带着自信的语气说："{exitLine}"。说完她微微侧头，眼神停留一瞬，然后转身走入霓虹灯照亮的夜色中。她的声音特征：女性，约18-22岁，音色明亮有锐度，语速中等偏快，情绪基线自信、带一丝不易察觉的认可。暖黄灯笼光映照侧脸，背景是冒着热气的大锅和绿色烧酒瓶。镜头从近景缓推至中景跟拍她离开的背影。写实风格，韩剧电影质感，浅景深。`,
    sceneImageUrl: '/assets/characters/haeun/scene.png',
  },
  jin: {
    introVideoUrls: [
      '/assets/cinematics/jin/intro_1.mp4',
      '/assets/cinematics/jin/intro_2.mp4',
    ],
    exitVideoUrls: [
      '/assets/cinematics/jin/exit_1.mp4',
    ],
    exitLineTemplates: [
      '{playerName}, 잘했어! 다음에 또 보자.',
      '밥 먹었어, {playerName}? 다음엔 같이 먹자.',
      '{playerName}야, 오늘 재밌었어.',
      '천천히 해도 돼, {playerName}. 기다릴게.',
    ],
    exitVideoPromptTemplate: `韩国首尔深夜포장마차路边摊。一位年轻韩国男性，中棕色微卷短发，穿奶白色针织毛衣，坐在摊位前。他抬头看向镜头，露出温暖的笑容，轻声说："{exitLine}"。说完他微微点头，站起身来拍了拍衣服，慢慢走进夜色中，回头挥了一下手。他的声音特征：男性，约22-26岁，中音域温暖沉稳，语速中等，情绪基线温柔、鼓励。暖黄灯笼光柔和照亮面部，镜头从近景平稳推至中景跟拍他离开。写实风格，韩剧暖心质感。`,
    sceneImageUrl: '/assets/characters/jin/scene.png',
  },
};

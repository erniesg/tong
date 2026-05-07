import { runtimeAssetUrl } from '@/lib/runtime-assets';
import type { ExerciseData } from '@/lib/types/hangout';
import type { AppLang } from '@/lib/api';

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

export interface ShanghaiOnboardingTongCopy {
  tongName: string;
  introTongLines: string[];
  postExerciseTongLines: string[];
  panPrompt: string;
  completionTongLine: string;
  webtoonStepTongLines: Record<string, string[]>;
}

export const SHANGHAI_ONBOARDING_PANORAMA_VIDEO_KEY =
  'city.shanghai.location.dumpling-shop.panorama.video.default';

export const SHANGHAI_ONBOARDING_PANORAMA_POSTER_KEY =
  'city.shanghai.location.dumpling-shop.panorama.poster.default';

const EN_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: 'Tong',
  introTongLines: [
    'You are in a Shanghai 小笼包店: steamers at the counter, rain on glass, tables close enough to overhear.',
    'Mandarin in this room moves fast. Do not chase every word. Catch compact chunks, repeated 不 phrases, and names.',
    'Start with 想法. Tap 想法 once and listen. It is a short way to ask for someone’s take.',
  ],
  postExerciseTongLines: [
    'Good. 想法 has a shape in your ear now.',
    'That table by the window is cutting through the room noise. Slide that way slowly.',
  ],
  panPrompt: 'Slide toward the window table.',
  completionTongLine: 'Today’s listening handles: 想法, 看过了, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      'You heard 看过了. Verb + 过了 gives the action an already-done feel.',
      'Try that shape once before the conversation tightens.',
    ],
    'beat-2-authenticity-contrast': [
      'That 不下去 is the useful part. It says an action cannot keep going.',
      'Try the shape across a few verbs so it is not trapped in one line.',
    ],
    'beat-3-exit-register': [
      'She said 小瞿, not 瞿先生. That is familiar address from someone older.',
      '瞿家 is the Qu family. 小儿子 is younger son.',
      'Today’s listening handles: 想法, 看过了, 装不下去, 小瞿.',
    ],
  },
};

const KO_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: '통',
  introTongLines: [
    '여기는 상하이 小笼包店이야. 찜통, 창문에 닿는 비, 가까운 테이블 소리가 한꺼번에 들어와.',
    '이 방의 만다린은 빠르고 짧아. 전부 잡으려 하지 말고, 작은 덩어리와 반복되는 不, 이름을 잡아.',
    '먼저 想法부터. 想法을 한 번 눌러서 들어 봐. 누군가의 생각을 묻는 짧은 덩어리야.',
  ],
  postExerciseTongLines: [
    '좋아. 이제 想法의 소리 모양이 귀에 남았어.',
    '창가 테이블 소리가 방 안 소음을 뚫고 들어와. 그쪽으로 천천히 밀어 봐.',
  ],
  panPrompt: '창가 테이블 쪽으로 밀기.',
  completionTongLine: '오늘 잡은 듣기 손잡이: 想法, 看过了, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      '방금 看过了가 지나갔어. 동사 + 过了는 이미 끝난 행동 느낌을 줄 수 있어.',
      '대화가 더 조여지기 전에 그 모양을 한 번 연습해 보자.',
    ],
    'beat-2-authenticity-contrast': [
      '여기서는 不下去가 핵심이야. 어떤 행동을 계속할 수 없다는 느낌이 나.',
      '한 줄에만 묶이지 않게 몇 가지 동사로 같은 모양을 연습해 보자.',
    ],
    'beat-3-exit-register': [
      '方阿姨가 小瞿라고 했지, 瞿先生이 아니었어. 어른이 어린 사람을 부르는 익숙한 호칭이야.',
      '瞿家는 Qu family, 小儿子는 작은아들 또는 둘째 아들이라는 말이야.',
      '오늘 잡은 듣기 손잡이: 想法, 看过了, 装不下去, 小瞿.',
    ],
  },
};

const JA_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: 'トン',
  introTongLines: [
    'ここは上海の 小笼包店。蒸し器、窓の雨、近いテーブルの音まで聞こえてくる。',
    'この部屋の中国語は速くて短い。全部を追わずに、小さなかたまり、くり返す 不、名前を拾って。',
    'まずは 想法。想法 を一度タップして聞いて。相手の考えを聞く短いかたまりだよ。',
  ],
  postExerciseTongLines: [
    'いいね。想法 の音の形が耳に残った。',
    '窓際のテーブルの声が、店の音を抜けて聞こえる。そっちへゆっくり寄せて。',
  ],
  panPrompt: '窓際のテーブルへスライド。',
  completionTongLine: '今日つかんだ聞き取りの手がかり: 想法, 看过了, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      '今、看过了 が聞こえたね。動詞 + 过了 は、もう済んだ動きの感じを出せる。',
      '会話が詰まる前に、その形を一度だけ練習しよう。',
    ],
    'beat-2-authenticity-contrast': [
      'ここで使えるのは 不下去。動作を続けられない、という感じが出る。',
      'その一文だけで終わらせず、いくつかの動詞で形を試そう。',
    ],
    'beat-3-exit-register': [
      '方阿姨 は 小瞿 と言った。瞿先生 じゃない。年上から若い人への親しい呼び方だよ。',
      '瞿家 は Qu家。小儿子 は下の息子。',
      '今日つかんだ聞き取りの手がかり: 想法, 看过了, 装不下去, 小瞿.',
    ],
  },
};

const ZH_ADVANCED_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: '小通',
  introTongLines: [
    '你在上海的 小笼包店里：柜台上是蒸笼，窗外有雨，旁边的桌子近到能听见人说话。',
    '这里的普通话很快，也很短。不要追每个字，先抓小块、重复的 不、还有称呼。',
    '先抓 想法。点一下 想法 听一遍，这是问别人看法的短块。',
  ],
  postExerciseTongLines: [
    '好，想法 这个声音已经有轮廓了。',
    '窗边那桌的声音从店里的杂音里透出来了。慢慢把视角移过去。',
  ],
  panPrompt: '滑向窗边那桌。',
  completionTongLine: '今天抓到的听力抓手：想法, 看过了, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      '你刚听到 看过了。动词 + 过了 会带出“已经做过”的感觉。',
      '趁对话还没更紧，先把这个形状练一次。',
    ],
    'beat-2-authenticity-contrast': [
      '这里有用的是 不下去。它表示一个动作没法继续撑下去。',
      '换几个动词练一下，别让它只留在这一句里。',
    ],
    'beat-3-exit-register': [
      '方阿姨说的是 小瞿，不是 瞿先生。这是长辈对晚辈的熟人称呼。',
      '瞿家 是 Qu family。小儿子 是 younger son。',
      '今天抓到的听力抓手：想法, 看过了, 装不下去, 小瞿.',
    ],
  },
};

const BEGINNER_COPY_BY_EXPLAIN_LANG: Record<AppLang, ShanghaiOnboardingTongCopy> = {
  en: EN_TONG_COPY,
  ko: KO_TONG_COPY,
  ja: JA_TONG_COPY,
  // A Mandarin beginner should not receive full Chinese helper text even if the
  // stored explain-language preference is zh. Keep Tong's beginner H1 teaching
  // in English with small tappable Chinese chunks.
  zh: EN_TONG_COPY,
};

export function getShanghaiOnboardingTongCopy(
  explainIn: AppLang = 'en',
  selfAssessedLevel: number | null = null,
): ShanghaiOnboardingTongCopy {
  if (explainIn === 'zh' && selfAssessedLevel !== null && selfAssessedLevel >= 4) {
    return ZH_ADVANCED_TONG_COPY;
  }
  return BEGINNER_COPY_BY_EXPLAIN_LANG[explainIn] ?? EN_TONG_COPY;
}

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
      en: 'proposal',
      role: 'primary',
      note: 'A useful proposal/show chunk, not the whole spine of the lesson.',
    },
    {
      id: 'kanguole-xiangfa',
      zh: '看过了 / 想法？',
      py: 'kan guo le / xiang fa',
      en: 'looked it over / thoughts?',
      role: 'primary',
      note: 'Beginner listening handles: completed action plus a compact question.',
    },
    {
      id: 'buyiyang',
      zh: '不一样',
      py: 'bu yi yang',
      en: 'different',
      role: 'primary',
      note: 'A repeated pitch word that sets up a 不 contrast without becoming plot commentary.',
    },
    {
      id: 'zhuangbuxiaqu',
      zh: '装不下去',
      py: 'zhuang bu xia qu',
      en: 'cannot keep pretending',
      role: 'primary',
      note: 'Grammar hook: a verb plus 不下去 as the keep-going feel.',
    },
    {
      id: 'jie-zhongyao',
      zh: '接 / 重要',
      py: 'jie / zhong yao',
      en: 'answer / important',
      role: 'context',
      note: 'Exit-beat listening handles from the repeated phone interruption.',
    },
    {
      id: 'xiaoqu-xiaoerzi',
      zh: '小瞿 / 小儿子',
      py: 'xiao Qu / xiao er zi',
      en: 'little Qu / younger son',
      role: 'reveal',
      note: 'Register hook: familiar address and family wording, not plot explanation.',
    },
  ],
  introTongLines: [
    ...EN_TONG_COPY.introTongLines,
  ],
  preListeningExercises: [
    {
      type: 'pronunciation_select',
      id: 'shanghai-h1-prelisten-xiangfa-sound',
      objectiveId: 'zh-pronunciation-tone-pairs',
      difficulty: 1,
      prompt: 'Which sound is the short question for someone’s take?',
      targetText: '想法',
      audioOptions: [
        { id: 'xiangfa', label: '想法', ttsText: '想法', romanization: 'xiǎng fǎ', meaning: 'thoughts; take' },
        { id: 'fangan', label: '方案', ttsText: '方案', romanization: "fāng'àn", meaning: 'plan' },
        { id: 'xiaolongbao', label: '小笼包', ttsText: '小笼包', romanization: 'xiǎo lóng bāo', meaning: 'soup dumpling' },
      ],
      correctOptionId: 'xiangfa',
      explanation: '想法 can stand alone as a compact question: thoughts? your take?',
    },
  ],
  postExerciseTongLines: [
    ...EN_TONG_COPY.postExerciseTongLines,
  ],
  panPrompt: EN_TONG_COPY.panPrompt,
  completionTongLine: EN_TONG_COPY.completionTongLine,
  webtoonFixtureId: 'shanghai-h1',
  webtoonSteps: [
    {
      id: 'beat-1-proposal-question',
      label: 'Beat 1 — proposal question',
      panelIds: ['p0', 'p1', 'p2', 'p3', 'p4'],
      afterTongLines: EN_TONG_COPY.webtoonStepTongLines['beat-1-proposal-question'],
      afterExercises: [
        {
          type: 'matching',
          id: 'shanghai-h1-after-a-guole-pattern',
          objectiveId: 'zh-gram-shanghai-le-aspect',
          difficulty: 1,
          prompt: 'Match each 过了 phrase with its meaning.',
          pairs: [
            { left: '看过了', right: 'looked it over already' },
            { left: '吃过了', right: 'already ate' },
            { left: '听过了', right: 'already heard it' },
          ],
        },
      ],
      masteryItems: ['看过了', '想法'],
    },
    {
      id: 'beat-2-authenticity-contrast',
      label: 'Beat 2 — authenticity contrast',
      panelIds: ['p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
      afterTongLines: EN_TONG_COPY.webtoonStepTongLines['beat-2-authenticity-contrast'],
      afterExercises: [
        {
          type: 'matching',
          id: 'shanghai-h1-after-b-buxiaqu-pattern',
          objectiveId: 'zh-gram-shanghai-buxiaqu',
          difficulty: 2,
          prompt: 'Match each V不下去 phrase with its meaning.',
          pairs: [
            { left: '装不下去', right: 'cannot keep pretending' },
            { left: '演不下去', right: 'cannot keep performing' },
            { left: '说不下去', right: 'cannot keep saying it' },
            { left: '吃不下去', right: 'cannot keep eating' },
          ],
        },
      ],
      masteryItems: ['不一样', '装', '装不下去'],
    },
    {
      id: 'beat-3-exit-register',
      label: 'Beat 3 — exit register',
      panelIds: ['p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 'p20'],
      afterTongLines: EN_TONG_COPY.webtoonStepTongLines['beat-3-exit-register'],
      masteryItems: ['接', '重要', '小瞿', '瞿家', '小儿子'],
    },
  ],
};

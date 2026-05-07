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
    'Mandarin is built from characters, and characters reuse pieces. The shop sign already gives you a handle: 小.',
    'Pinyin marks sound with tones. 小笼包店 gives you all four shapes: 小, 笼, 包, 店. Tap 小 once and listen.',
  ],
  postExerciseTongLines: [
    'Good. The sign is not decoration now: 小 is a character, xiǎo is its sound shape.',
    'That table by the window is cutting through the room noise. Slide that way slowly.',
  ],
  panPrompt: 'Slide toward the window table.',
  completionTongLine: 'Today’s listening handles: 小, 不一样, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      'You heard 不一样 twice. 不 is the high-value piece: it flips a word or phrase negative.',
      'Try the pieces once so the next 不 phrase lands as language, not noise.',
    ],
    'beat-2-authenticity-contrast': [
      'That 不下去 is the useful part. It says an action cannot keep going.',
      'Try the shape across a few verbs so it is not trapped in one line.',
    ],
    'beat-3-exit-register': [
      'She said 小瞿, not 瞿先生. That is familiar address from someone older.',
      '瞿家 is the Qu family. 小儿子 is younger son.',
      'That is enough for this first room. Keep the handles, not every sentence.',
      'Today’s listening handles: 小, 不一样, 装不下去, 小瞿.',
    ],
  },
};

const KO_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: '통',
  introTongLines: [
    '여기는 상하이 小笼包店이야. 찜통, 창문에 닿는 비, 가까운 테이블 소리가 한꺼번에 들어와.',
    '만다린은 글자로 이루어지고, 글자는 작은 조각을 다시 써. 가게 간판에서 먼저 小를 잡아 보자.',
    '병음은 소리에 성조를 붙여. 小笼包店 안에 네 가지 성조가 다 있어: 小, 笼, 包, 店. 小를 한 번 눌러서 들어 봐.',
  ],
  postExerciseTongLines: [
    '좋아. 이제 간판은 장식이 아니야. 小는 글자고, xiǎo는 그 소리 모양이야.',
    '창가 테이블 소리가 방 안 소음을 뚫고 들어와. 그쪽으로 천천히 밀어 봐.',
  ],
  panPrompt: '창가 테이블 쪽으로 밀기.',
  completionTongLine: '오늘 잡은 듣기 손잡이: 小, 不一样, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      '방금 不一样이 두 번 나왔어. 不가 중요한 조각이야. 단어나 구를 부정 쪽으로 돌려.',
      '다음 不 표현이 그냥 소음으로 지나가지 않게, 그 조각을 한 번 연습해 보자.',
    ],
    'beat-2-authenticity-contrast': [
      '여기서는 不下去가 핵심이야. 어떤 행동을 계속할 수 없다는 느낌이 나.',
      '한 줄에만 묶이지 않게 몇 가지 동사로 같은 모양을 연습해 보자.',
    ],
    'beat-3-exit-register': [
      '方阿姨가 小瞿라고 했지, 瞿先生이 아니었어. 어른이 어린 사람을 부르는 익숙한 호칭이야.',
      '瞿家는 Qu family, 小儿子는 작은아들 또는 둘째 아들이라는 말이야.',
      '이 첫 방에서는 여기까지면 충분해. 모든 문장이 아니라 손잡이만 잡고 가자.',
      '오늘 잡은 듣기 손잡이: 小, 不一样, 装不下去, 小瞿.',
    ],
  },
};

const JA_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: 'トン',
  introTongLines: [
    'ここは上海の 小笼包店。蒸し器、窓の雨、近いテーブルの音まで聞こえてくる。',
    '中国語は漢字でできていて、漢字は小さな部品を使い回す。店の名前からまず 小 を拾おう。',
    'ピンインは音に声調をつける。小笼包店 には四つの声調が全部ある: 小, 笼, 包, 店。小 を一度タップして聞いて。',
  ],
  postExerciseTongLines: [
    'いいね。看板はただの背景じゃない。小 は文字で、xiǎo はその音の形だ。',
    '窓際のテーブルの声が、店の音を抜けて聞こえる。そっちへゆっくり寄せて。',
  ],
  panPrompt: '窓際のテーブルへスライド。',
  completionTongLine: '今日つかんだ聞き取りの手がかり: 小, 不一样, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      '今、 不一样 が二回聞こえた。使える部品は 不。語やフレーズを否定側にひっくり返す。',
      '次の 不 の形がただの音で流れないように、一度だけ部品で練習しよう。',
    ],
    'beat-2-authenticity-contrast': [
      'ここで使えるのは 不下去。動作を続けられない、という感じが出る。',
      'その一文だけで終わらせず、いくつかの動詞で形を試そう。',
    ],
    'beat-3-exit-register': [
      '方阿姨 は 小瞿 と言った。瞿先生 じゃない。年上から若い人への親しい呼び方だよ。',
      '瞿家 は Qu家。小儿子 は下の息子。',
      'この最初の部屋はここまでで十分。全部の文ではなく、手がかりを持って出よう。',
      '今日つかんだ聞き取りの手がかり: 小, 不一样, 装不下去, 小瞿.',
    ],
  },
};

const ZH_ADVANCED_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: '小通',
  introTongLines: [
    '你在上海的 小笼包店里：柜台上是蒸笼，窗外有雨，旁边的桌子近到能听见人说话。',
    '普通话靠汉字承载，汉字会复用部件。先从店名里的 小 抓起。',
    '拼音用声调标声音。小笼包店 里四个声调都有：小, 笼, 包, 店。点一下 小 听一遍。',
  ],
  postExerciseTongLines: [
    '好。招牌现在不是背景了：小 是字，xiǎo 是它的声音形状。',
    '窗边那桌的声音从店里的杂音里透出来了。慢慢把视角移过去。',
  ],
  panPrompt: '滑向窗边那桌。',
  completionTongLine: '今天抓到的听力抓手：小, 不一样, 装不下去, 小瞿.',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      '你刚听到两次 不一样。有用的是 不：它把词或短语翻到否定方向。',
      '先练一次这个部件，下一段里的 不 才不会变成噪音。',
    ],
    'beat-2-authenticity-contrast': [
      '这里有用的是 不下去。它表示一个动作没法继续撑下去。',
      '换几个动词练一下，别让它只留在这一句里。',
    ],
    'beat-3-exit-register': [
      '方阿姨说的是 小瞿，不是 瞿先生。这是长辈对晚辈的熟人称呼。',
      '瞿家 是 Qu family。小儿子 是 younger son。',
      '第一间屋子到这里就够了。先带走抓手，不用带走每一句。',
      '今天抓到的听力抓手：小, 不一样, 装不下去, 小瞿.',
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
      id: 'shanghai-h1-prelisten-xiao-tone',
      objectiveId: 'zh-pronunciation-tone-pairs',
      difficulty: 1,
      prompt: 'Listen for 小. Which xiao has the dipping third tone?',
      targetText: '小',
      audioOptions: [
        { id: 'xiao1', label: '消', ttsText: '消', romanization: 'xiāo', meaning: 'first tone' },
        { id: 'xiao2', label: '淆', ttsText: '淆', romanization: 'xiáo', meaning: 'second tone' },
        { id: 'xiao3', label: '小', ttsText: '小', romanization: 'xiǎo', meaning: 'third tone; small' },
        { id: 'xiao4', label: '笑', ttsText: '笑', romanization: 'xiào', meaning: 'fourth tone' },
      ],
      correctOptionId: 'xiao3',
      explanation: '小 is xiǎo: the third tone dips before it comes back up.',
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
      label: 'Beat 1 — proposal, food redirect, generic pitch',
      panelIds: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
      afterTongLines: EN_TONG_COPY.webtoonStepTongLines['beat-1-proposal-question'],
      afterExercises: [
        {
          type: 'matching',
          id: 'shanghai-h1-after-a-bu-buyiyang-pattern',
          objectiveId: 'zh-script-shanghai-contrast-forms',
          difficulty: 1,
          prompt: 'Match the pieces behind 不一样.',
          pairs: [
            { left: '不', right: 'not' },
            { left: '一样', right: 'same' },
            { left: '不一样', right: 'not the same; different' },
          ],
        },
      ],
      masteryItems: ['小', '包', '笼', '店', '不', '一样', '不一样'],
    },
    {
      id: 'beat-2-authenticity-contrast',
      label: 'Beat 2 — authenticity contrast',
      panelIds: ['p7', 'p8', 'p9', 'p10', 'p11'],
      afterTongLines: EN_TONG_COPY.webtoonStepTongLines['beat-2-authenticity-contrast'],
      afterExercises: [
        {
          type: 'fill_blank',
          id: 'shanghai-h1-after-b-buxiaqu-pattern',
          objectiveId: 'zh-gram-shanghai-buxiaqu',
          difficulty: 2,
          prompt: 'Choose the ending that means “cannot keep going.”',
          sentence: '演 ___ 。',
          blankIndex: 1,
          options: [
            { id: 'buxiaqu', text: '不下去' },
            { id: 'xiaqu', text: '下去' },
            { id: 'buzhuang', text: '不装' },
            { id: 'buyiyang', text: '不一样' },
          ],
          correctOptionId: 'buxiaqu',
          grammarNote: 'verb + 不下去 means the action cannot continue.',
          explanation: '演不下去 = cannot keep performing.',
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

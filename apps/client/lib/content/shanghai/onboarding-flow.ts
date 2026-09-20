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
  overhearTongLine: string;
  overhearLabel: string;
  stepOutLabel: string;
  completionTongLine: string;
  finalWrapTongLines: string[];
  finalWrapContinueLabel: string;
  finalWrapCompleteLabel: string;
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
  preListeningTransitionTongLines: Record<number, string[]>;
  postExerciseTongLines: string[];
  panPrompt: string;
  overhearTongLine: string;
  overhearLabel: string;
  stepOutLabel: string;
  completionTongLine: string;
  finalWrapTongLines: string[];
  finalWrapContinueLabel: string;
  finalWrapCompleteLabel: string;
  webtoonStepTongLines: Record<string, string[]>;
}

export const SHANGHAI_ONBOARDING_PANORAMA_VIDEO_KEY =
  'city.shanghai.location.dumpling-shop.panorama.video.default';

export const SHANGHAI_ONBOARDING_PANORAMA_POSTER_KEY =
  'city.shanghai.location.dumpling-shop.panorama.poster.default';

const EN_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: 'Tong',
  introTongLines: [
    'Steamers at the counter. Vinegar on the tables. The sign says 小笼包店.',
    'Shanghai is already giving you Mandarin before anyone slows down for you.',
    'Stay with what the shop gives us first: one character you can see, then one sound you can hear.',
    'Start with 小. You see it in 小笼包. Later, you will hear it in a name.',
    'Watch how 小 is written. Tap 小 to hear it, then trace it in stroke order.',
  ],
  preListeningTransitionTongLines: {
    1: [
      'Now listen to the tone.',
      'Mandarin has four main tones: high, rising, dipping, falling.',
      '小 is third tone: xiǎo. It dips low, then comes back up.',
    ],
  },
  postExerciseTongLines: [
    'Good. You have 小 in your eyes and xiǎo in your ear.',
    'Now it is ready to travel: from 小笼包 on the sign to 小瞿 when someone says his name.',
    'The voices on the left are close enough now. Slide that way.',
  ],
  panPrompt: 'Slide left toward the voices.',
  overhearTongLine: 'There. Tap to listen in.',
  overhearLabel: 'Tap to overhear',
  stepOutLabel: 'Step out',
  completionTongLine: 'You left the shop hearing how small pieces shift the scene: 小 on the sign, 不 in the turns, and 小瞿 / 瞿家 at the register.',
  finalWrapTongLines: [
    'Take one last look before we leave the shop.',
    'At the start, 小 was just part of 小笼包.',
    '小瞿 feels familiar. 瞿先生 would keep distance. 瞿家 makes it bigger than one person.',
    '不 also stayed useful: 不一样, 装不下去, 不重要.',
    'That is enough for this stop. Shanghai will give us more next time.',
  ],
  finalWrapContinueLabel: 'Continue',
  finalWrapCompleteLabel: 'Continue',
  webtoonStepTongLines: {
    'beat-1-proposal-question': [
      '不一样 came up twice.',
      '一样 is “same.” 不一样 is “not the same.”',
    ],
    'beat-2-authenticity-contrast': [
      '装不下去 is the phrase to keep.',
      'It means the pretending cannot continue.',
    ],
    'beat-3-exit-register': [
      '方阿姨 calls him 小瞿.',
      'That is familiar address from someone older.',
      '小儿子 means younger son.',
      'One quick 不 before we step out.',
      'You heard it in 不一样, 装不下去, and 不重要.',
      '不 is usually fourth tone: bù, a falling tone.',
      'When it comes before another fourth tone, Mandarin often shifts it to bú.',
    ],
  },
};

const KO_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: '통',
  introTongLines: [
    '여기는 상하이 小笼包店이야. 찜통, 창가 테이블, 그릇 소리와 가까운 말소리가 한꺼번에 들어와.',
    '먼저 小를 보자. 小는 글자 하나이면서, 다른 글자 안에서 다시 쓰이는 부품이나 부수처럼도 움직여.',
    '小를 한 번 눌러 소리를 듣고, 모양을 따라 써 보자. 그래야 간판에서 바로 잡혀.',
  ],
  preListeningTransitionTongLines: {
    1: [
      '좋아. 이제 그 모양에 소리를 붙이자. 小는 xiǎo야.',
      '만다린은 성조가 바뀌면 뜻도 달라져. xiao 소리를 몇 개 듣고 小에 맞는 걸 골라 봐.',
    ],
  },
  postExerciseTongLines: [
    '좋아. 이제 간판은 장식이 아니야. 小는 눈으로 잡는 모양이고 귀로 잡는 소리야.',
    '이제 小는 이동할 수 있어. 간판의 小笼包에서, 누군가 부르는 小瞿까지.',
    '창가 테이블 소리가 방 안 소음을 뚫고 들어와. 그쪽으로 천천히 밀어 봐.',
  ],
  panPrompt: '창가 테이블 쪽으로 밀기.',
  overhearTongLine: '이 정도면 가까워. 눌러서 대화를 엿들어 보자.',
  overhearLabel: '엿듣기',
  stepOutLabel: '나가기',
  completionTongLine: '가게를 나서며 작은 조각들이 장면을 바꾸는 걸 들었어: 간판의 小, 말의 전환에 붙은 不, 계산대의 小瞿 / 瞿家.',
  finalWrapTongLines: [
    '가게를 나가기 전에 한 번만 더 보자.',
    '처음엔 小가 小笼包의 일부였어.',
    '小瞿는 익숙하게 들려. 瞿先生은 거리를 두는 말이고, 瞿家는 한 사람보다 더 큰 범위야.',
    '不도 계속 쓸모 있었어: 不一样, 装不下去, 不重要.',
    '이 정거장은 이 정도면 충분해. 상하이는 다음에 더 들려줄 거야.',
  ],
  finalWrapContinueLabel: '계속',
  finalWrapCompleteLabel: '계속',
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
      '나가기 전에 不를 한 번만 더 보자.',
      '不一样, 装不下去, 不重要에서 모두 들었어.',
      '不는 보통 4성 bù, 떨어지는 소리야.',
      '뒤에 또 4성이 오면 Mandarin에서는 자주 bú로 바뀌어.',
    ],
  },
};

const JA_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: 'トン',
  introTongLines: [
    'ここは上海の 小笼包店。蒸し器、窓ぎわのテーブル、器の音と近い声が聞こえてくる。',
    'まず 小 を見よう。小 は一つの漢字で、ほかの字の中で部品や部首のようにも働く。',
    '小 を一度タップして音を聞いてから、形をなぞろう。看板の中で拾えるようにする。',
  ],
  preListeningTransitionTongLines: {
    1: [
      'いいね。次はその形に音をつける。小 は xiǎo。',
      '中国語は声調で意味が変わる。いくつかの xiao を聞いて、小 に合う音を選ぼう。',
    ],
  },
  postExerciseTongLines: [
    'いいね。看板はただの背景じゃない。小 は目で拾える形で、耳で拾える音だ。',
    'これで 小 は動ける。看板の 小笼包 から、誰かが呼ぶ 小瞿 まで。',
    '窓際のテーブルの声が、店の音を抜けて聞こえる。そっちへゆっくり寄せて。',
  ],
  panPrompt: '窓際のテーブルへスライド。',
  overhearTongLine: 'ここまで寄れば十分。タップして聞きに入ろう。',
  overhearLabel: '聞き入る',
  stepOutLabel: '店を出る',
  completionTongLine: '店を出る時には、小さな部品が場面を動かすのが聞こえた。看板の 小、流れを変える 不、会計のところの 小瞿 / 瞿家。',
  finalWrapTongLines: [
    '店を出る前に、もう一度だけ見ておこう。',
    '最初、 小 は 小笼包 の一部だった。',
    '小瞿 は親しさがある。瞿先生 なら距離がある。瞿家 は一人より大きい範囲になる。',
    '不 も使えた: 不一样, 装不下去, 不重要.',
    'この立ち寄りはここまでで十分。上海は次もまた聞かせてくれる。',
  ],
  finalWrapContinueLabel: '続ける',
  finalWrapCompleteLabel: '続ける',
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
      '店を出る前に 不 を一度だけ見よう。',
      '不一样, 装不下去, 不重要 で聞こえた。',
      '不 は普通、4声の bù。落ちる音。',
      '次も4声の時、中国語ではよく bú に変わる。',
    ],
  },
};

const ZH_ADVANCED_TONG_COPY: ShanghaiOnboardingTongCopy = {
  tongName: '小通',
  introTongLines: [
    '你在上海的 小笼包店里：柜台上是蒸笼，窗边有桌子，碗筷声和旁边说话声都很近。',
    '先看 小。小 本身是一个字，也可以像部件、部首一样在别的字里复用。',
    '点一下 小 听一遍，然后描一遍字形。先让眼睛能在招牌里抓住它。',
  ],
  preListeningTransitionTongLines: {
    1: [
      '好。现在把声音接上：小 是 xiǎo。',
      '普通话的声调会改变意思。听几个 xiao，选出跟 小 对上的那个。',
    ],
  },
  postExerciseTongLines: [
    '好。招牌现在不是背景了：小 是你能看见的形，也是你能听出来的音。',
    '现在 小 可以移动了：从招牌上的 小笼包，到别人嘴里的 小瞿。',
    '窗边那桌的声音从店里的杂音里透出来了。慢慢把视角移过去。',
  ],
  panPrompt: '滑向窗边那桌。',
  overhearTongLine: '靠得够近了。点一下，听他们说。',
  overhearLabel: '听一听',
  stepOutLabel: '走出店里',
  completionTongLine: '你离开店时，已经能听见小碎片怎样转动场景：招牌上的 小，话锋里的 不，还有收银台边的 小瞿 / 瞿家。',
  finalWrapTongLines: [
    '离开店之前，再看一眼。',
    '一开始， 小 只是 小笼包 里的一个字。',
    '小瞿 听起来熟。瞿先生 会保持距离。瞿家 把范围放大到不止一个人。',
    '不 也一直有用：不一样，装不下去，不重要。',
    '这个停靠点到这里就够了。上海下次还会继续给我们听。',
  ],
  finalWrapContinueLabel: '继续',
  finalWrapCompleteLabel: '继续',
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
      '出门前，再看一个 不。',
      '你在 不一样、装不下去、不重要 里都听到了。',
      '不 通常是第四声 bù，往下落。',
      '后面也是第四声时，普通话里常常会变成 bú。',
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
      type: 'stroke_tracing',
      id: 'shanghai-h1-prelisten-xiao-stroke',
      objectiveId: 'zh-script-shanghai-xiao-character',
      difficulty: 1,
      prompt: 'Trace 小 in stroke order.',
      targetChar: '小',
      ghostOverlay: true,
      explanation: '小 is xiǎo, “small.”',
      romanization: 'xiǎo',
      meaning: 'small',
      sound: '小',
      language: 'zh',
      strokeOrder: [
        { label: '竖钩', pinyin: 'shù gōu', glyph: '亅', description: 'center hook' },
        { label: '撇', pinyin: 'piě', glyph: '丿', description: 'left fall' },
        { label: '点', pinyin: 'diǎn', glyph: '丶', description: 'right dot' },
      ],
      reps: 3,
      exampleWords: [
        { word: '小笼包', romanization: 'xiǎo lóng bāo', meaning: 'soup dumpling' },
        { word: '小吃', romanization: 'xiǎo chī', meaning: 'snacks / street food' },
      ],
    },
    {
      type: 'pronunciation_select',
      id: 'shanghai-h1-prelisten-xiao-tone',
      objectiveId: 'zh-pronunciation-tone-pairs',
      difficulty: 1,
      prompt: 'Which one is 小, xiǎo?',
      targetText: '小',
      audioOptions: [
        { id: 'xiao1', label: '消', ttsText: '消', romanization: 'xiāo', meaning: 'first tone' },
        { id: 'xiao2', label: '淆', ttsText: '淆', romanization: 'xiáo', meaning: 'second tone' },
        { id: 'xiao3', label: '小', ttsText: '小', romanization: 'xiǎo', meaning: 'third tone, falling-rising; small' },
        { id: 'xiao4', label: '笑', ttsText: '笑', romanization: 'xiào', meaning: 'fourth tone' },
      ],
      correctOptionId: 'xiao3',
      explanation: '小 is xiǎo: the third tone falls low, then rises.',
    },
  ],
  postExerciseTongLines: [
    ...EN_TONG_COPY.postExerciseTongLines,
  ],
  panPrompt: EN_TONG_COPY.panPrompt,
  overhearTongLine: EN_TONG_COPY.overhearTongLine,
  overhearLabel: EN_TONG_COPY.overhearLabel,
  stepOutLabel: EN_TONG_COPY.stepOutLabel,
  completionTongLine: EN_TONG_COPY.completionTongLine,
  finalWrapTongLines: EN_TONG_COPY.finalWrapTongLines,
  finalWrapContinueLabel: EN_TONG_COPY.finalWrapContinueLabel,
  finalWrapCompleteLabel: EN_TONG_COPY.finalWrapCompleteLabel,
  webtoonFixtureId: 'shanghai-h1',
  webtoonSteps: [
    {
      id: 'beat-1-proposal-question',
      label: 'Beat 1 — proposal, food redirect, generic pitch',
      panelIds: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
      afterTongLines: EN_TONG_COPY.webtoonStepTongLines['beat-1-proposal-question'],
      afterExercises: [
        {
          type: 'fill_blank',
          id: 'shanghai-h1-after-a-buyiyang-line',
          objectiveId: 'zh-script-shanghai-contrast-forms',
          difficulty: 1,
          prompt: 'Choose the phrase that means “not the same.”',
          sentence: '这个节目跟其他的 ___ 。',
          blankIndex: 1,
          options: [
            { id: 'buyiyang', text: '不一样', romanization: 'bù yí yàng', meaning: 'not the same' },
            { id: 'yiyang', text: '一样', romanization: 'yí yàng', meaning: 'same' },
            { id: 'buxiaqu', text: '不下去', romanization: 'bú xià qù', meaning: 'cannot keep going' },
            { id: 'buzhongyao', text: '不重要', romanization: 'bú zhòng yào', meaning: 'not important' },
          ],
          correctOptionId: 'buyiyang',
          grammarNote: '不一样 = not the same.',
          explanation: '不一样 = different / not the same.',
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
            { id: 'buxiaqu', text: '不下去', romanization: 'bú xià qù', meaning: 'cannot keep going' },
            { id: 'xiaqu', text: '下去', romanization: 'xià qù', meaning: 'continue; go down' },
            { id: 'buzhuang', text: '不装', romanization: 'bù zhuāng', meaning: 'not pretending' },
            { id: 'buyiyang', text: '不一样', romanization: 'bù yí yàng', meaning: 'not the same' },
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
      afterExercises: [
        {
          type: 'stroke_tracing',
          id: 'shanghai-h1-after-c-bu-stroke',
          objectiveId: 'zh-script-shanghai-bu-character',
          difficulty: 1,
          prompt: 'Trace 不 in stroke order.',
          targetChar: '不',
          ghostOverlay: true,
          explanation: '不 is bù, “not.”',
          romanization: 'bù',
          meaning: 'not',
          sound: '不',
          language: 'zh',
          reps: 3,
          strokeOrder: [
            { label: '横', pinyin: 'héng', glyph: '一', description: 'top line' },
            { label: '撇', pinyin: 'piě', glyph: '丿', description: 'left fall' },
            { label: '竖', pinyin: 'shù', glyph: '丨', description: 'center down' },
            { label: '点', pinyin: 'diǎn', glyph: '丶', description: 'right dot' },
          ],
          exampleWords: [
            { word: '不一样', romanization: 'bù yí yàng', meaning: 'not the same' },
            { word: '不重要', romanization: 'bù zhòng yào', meaning: 'not important' },
          ],
        },
      ],
      masteryItems: ['接', '重要', '小瞿', '瞿家', '小儿子'],
    },
  ],
};

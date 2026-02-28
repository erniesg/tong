import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeneratedSnapshot, runMockIngestion, writeGeneratedSnapshots } from './ingestion.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const PORT = Number(process.env.PORT || 8787);

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const FIXTURES = {
  captions: loadJson('packages/contracts/fixtures/captions.enriched.sample.json'),
  dictionary: loadJson('packages/contracts/fixtures/dictionary.entry.sample.json'),
  frequency: loadJson('packages/contracts/fixtures/vocab.frequency.sample.json'),
  insights: loadJson('packages/contracts/fixtures/vocab.insights.sample.json'),
  gameStart: loadJson('packages/contracts/fixtures/game.start-or-resume.sample.json'),
  objectivesNext: loadJson('packages/contracts/fixtures/objectives.next.sample.json'),
  sceneFoodHangout: loadJson('packages/contracts/fixtures/scene.food-hangout.sample.json'),
  learnSessions: loadJson('packages/contracts/fixtures/learn.sessions.sample.json'),
  mediaProfile: loadJson('packages/contracts/fixtures/player.media-profile.sample.json'),
};

const mockMediaWindowPath = path.join(repoRoot, 'apps/server/data/mock-media-window.json');

const DICTIONARY_OVERRIDES = {
  '오늘': {
    term: '오늘',
    lang: 'ko',
    meaning: 'today',
    examples: ['오늘 뭐 먹을까?'],
    crossCjk: { zhHans: '今天', ja: '今日' },
    readings: { ko: 'oneul', zhPinyin: 'jin tian', jaRomaji: 'kyou' },
  },
  '먹을까': {
    term: '먹다',
    lang: 'ko',
    meaning: 'to eat; shall we eat?',
    examples: ['같이 먹을까?'],
    crossCjk: { zhHans: '吃', ja: '食べる' },
    readings: { ko: 'meokda', zhPinyin: 'chi', jaRomaji: 'taberu' },
  },
  '주문': {
    term: '주문',
    lang: 'ko',
    meaning: 'order (food/item)',
    examples: ['주문 도와드릴까요?'],
    crossCjk: { zhHans: '点餐', ja: '注文' },
    readings: { ko: 'jumun', zhPinyin: 'dian can', jaRomaji: 'chuumon' },
  },
};

const CITY_IDS = ['seoul', 'tokyo', 'shanghai'];
const LOCATION_IDS = ['food_street', 'cafe', 'convenience_store', 'subway_hub', 'practice_studio'];
const LANG_IDS = ['ko', 'ja', 'zh'];

const CITY_BASE = {
  seoul: {
    cityLabel: 'Seoul',
    defaultLang: 'ko',
    district: 'Hongdae',
    landmark: 'Gyeongui Line lane',
    vibeTags: ['street-food', 'night-market', 'casual'],
    npc: {
      npcId: 'npc_mina_park',
      name: 'Mina Park',
      role: 'Street-food local friend',
      baselineMood: 'playful',
    },
  },
  tokyo: {
    cityLabel: 'Tokyo',
    defaultLang: 'ja',
    district: 'Shibuya',
    landmark: 'Center-gai lane',
    vibeTags: ['neon', 'izakaya', 'fast-paced'],
    npc: {
      npcId: 'npc_aoi_tanaka',
      name: 'Aoi Tanaka',
      role: 'Street-food local friend',
      baselineMood: 'bright',
    },
  },
  shanghai: {
    cityLabel: 'Shanghai',
    defaultLang: 'zh',
    district: 'Huangpu',
    landmark: 'Yuyuan market lane',
    vibeTags: ['night-market', 'riverfront', 'bustling'],
    npc: {
      npcId: 'npc_lin_yue',
      name: 'Lin Yue',
      role: 'Street-food local friend',
      baselineMood: 'friendly',
    },
  },
};

const CITY_CHARACTER_POOL = {
  seoul: [
    { npcId: 'npc_mina_park', name: 'Mina Park', role: 'Street-food local friend', baselineMood: 'playful' },
    { npcId: 'npc_jiho_kim', name: 'Jiho Kim', role: 'Cafe regular and foodie guide', baselineMood: 'curious' },
    { npcId: 'npc_yuri_han', name: 'Yuri Han', role: 'Subway-savvy conversation partner', baselineMood: 'focused' },
  ],
  tokyo: [
    { npcId: 'npc_aoi_tanaka', name: 'Aoi Tanaka', role: 'Street-food local friend', baselineMood: 'bright' },
    { npcId: 'npc_ren_sato', name: 'Ren Sato', role: 'Convenience-store local helper', baselineMood: 'warm' },
    { npcId: 'npc_mika_shimura', name: 'Mika Shimura', role: 'Practice studio partner', baselineMood: 'energetic' },
  ],
  shanghai: [
    { npcId: 'npc_lin_yue', name: 'Lin Yue', role: 'Street-food local friend', baselineMood: 'friendly' },
    { npcId: 'npc_bo_chen', name: 'Bo Chen', role: 'Cafe language exchange buddy', baselineMood: 'calm' },
    { npcId: 'npc_qi_wang', name: 'Qi Wang', role: 'Transit and city guide', baselineMood: 'attentive' },
  ],
};

const ROMANCEABLE_CHARACTERS = [
  {
    npcId: 'npc_haeun',
    assetKey: 'hauen/haeun.png',
    name: 'Haeun',
    role: 'Primary romance route lead',
    baselineMood: 'warm',
    isRomanceable: true,
  },
  {
    npcId: 'npc_ding_man',
    assetKey: 'ding_man/ding_man.png',
    name: 'Ding',
    role: 'Primary romance route lead',
    baselineMood: 'charming',
    isRomanceable: true,
  },
];

const LOCATION_BASE = {
  food_street: { label: 'Food Street', vibeTags: ['street-food'] },
  cafe: { label: 'Cafe', vibeTags: ['coffee', 'casual-chat'] },
  convenience_store: { label: 'Convenience Store', vibeTags: ['daily-life', 'errands'] },
  subway_hub: { label: 'Subway Hub', vibeTags: ['commute', 'navigation'] },
  practice_studio: { label: 'Practice Studio', vibeTags: ['music', 'practice'] },
};

const LANGUAGE_SCENE_PACKS = {
  ko: {
    objectiveLabel: 'Place a complete Korean street-food order',
    objectiveSummary: 'Choose dish, set spice level, and close politely.',
    targets: {
      vocabulary: ['떡볶이', '메뉴', '주문', '맵기'],
      grammar: ['-주세요', '-고 싶어요'],
      sentenceStructures: ['N + 주세요', '맵기 + degree 표현'],
    },
    turnScript: [
      {
        stepId: 'pick_menu',
        requiredTags: ['food', 'polite'],
        quickReplies: ['떡볶이 주세요.', '김밥 주세요.', '라면 하나 주세요.'],
        prompts: {
          start: '여기 떡볶이가 유명해. 먹고 싶은 메뉴를 한국어로 말해줘.',
          success: '좋아, 주문 톤이 자연스러워! 이제 맵기를 정해 볼까?',
          partial: '메뉴는 좋았어. 끝에 주세요를 붙이면 더 자연스러워.',
          miss: '메뉴 이름이랑 주세요를 같이 말해 보면 좋아.',
        },
        tongHints: {
          success: 'Nice opening. You named a dish and used polite ordering language.',
          partial: 'Good start. Add a polite ending like 주세요 for a natural order.',
          miss: 'Try a simple pattern: 떡볶이 주세요.',
        },
        rewards: {
          success: { xp: 8, sp: 2, rp: 1, objectiveProgress: 0.4 },
          partial: { xp: 6, sp: 1, rp: 1, objectiveProgress: 0.25 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'encouraged',
          partial: 'curious',
          miss: 'patient',
        },
      },
      {
        stepId: 'set_spice_level',
        requiredTags: ['spice'],
        quickReplies: ['보통맛으로 해주세요.', '덜 맵게 해주세요.', '순한맛으로 부탁해요.'],
        prompts: {
          success: '좋아! 마지막으로 수량까지 말해 줘.',
          partial: '맵기 표현이 거의 맞았어. 보통맛/덜 맵게 같은 표현을 써 봐.',
          miss: '맵기부터 정해 보자. 예: 보통맛으로 해주세요.',
        },
        tongHints: {
          success: 'Great. Spice-level language sounds natural.',
          partial: 'You are close. Add a clear spice word like 보통맛 or 덜 맵게.',
          miss: 'Include spice preference: 안 맵게 / 보통맛 / 매운맛.',
        },
        rewards: {
          success: { xp: 8, sp: 2, rp: 1, objectiveProgress: 0.35 },
          partial: { xp: 6, sp: 1, rp: 1, objectiveProgress: 0.2 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'impressed',
          partial: 'focused',
          miss: 'supportive',
        },
      },
      {
        stepId: 'confirm_order',
        requiredTags: ['confirm', 'polite'],
        quickReplies: ['한 개 주세요, 감사합니다.', '두 개 주세요.', '이렇게 주문할게요, 감사합니다.'],
        prompts: {
          success: '완벽해! 주문이 깔끔했어. 이제 다음 장소도 열 수 있어.',
          partial: '좋아, 거의 끝났어. 수량이나 감사 표현을 더하면 완성돼.',
          miss: '마무리로 수량 + 주세요를 말해 봐. 예: 한 개 주세요.',
        },
        tongHints: {
          success: 'Strong finish. You confirmed the order politely.',
          partial: 'Almost complete. Add quantity or a polite close.',
          miss: 'Use quantity + polite ending: 한 개 주세요.',
        },
        rewards: {
          success: { xp: 10, sp: 3, rp: 2, objectiveProgress: 0.35 },
          partial: { xp: 7, sp: 2, rp: 1, objectiveProgress: 0.2 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'excited',
          partial: 'encouraging',
          miss: 'calm',
        },
      },
    ],
    completion: {
      passedLine: '완벽해! 이 정도면 실제 주문도 자신 있게 할 수 있어.',
      retryLine: '흐름은 잡았어. 한 번 더 하면 바로 미션을 열 수 있어.',
      tongWrapUpPass: 'Objective validated. Mission gate is now previewed.',
      tongWrapUpRetry: 'Scene complete. Another validated hangout will unlock the mission gate.',
    },
    tongStartHint: 'Pick a dish with 주세요 first, then set spice level.',
    utteranceTagPatterns: {
      food: ['떡볶이', '김밥', '라면', '순대', '어묵', '메뉴', '주문'],
      polite: ['주세요', '부탁', '싶어요', '할게요', '주실', '주세'],
      spice: ['맵', '안 맵', '안맵', '덜 맵', '덜맵', '보통맛', '순한맛', '매운맛', '중간'],
      confirm: ['하나', '한 개', '한개', '두 개', '두개', '둘', '셋', '세 개', '세개', '감사'],
    },
  },
  ja: {
    objectiveLabel: 'Place a complete Japanese street-food order',
    objectiveSummary: 'Choose dish, set spice level, and close politely.',
    targets: {
      vocabulary: ['メニュー', '注文', '辛さ', 'たこ焼き'],
      grammar: ['ください', 'お願いします'],
      sentenceStructures: ['N + ください', '辛さ + でお願いします'],
    },
    turnScript: [
      {
        stepId: 'pick_menu',
        requiredTags: ['food', 'polite'],
        quickReplies: ['たこ焼きください。', '焼きそばください。', 'ラーメン一つください。'],
        prompts: {
          start: 'ここは屋台が有名だよ。食べたいメニューを日本語で言ってみて。',
          success: 'いいね、自然な注文だよ。次は辛さを決めよう。',
          partial: 'メニューはいいね。最後にくださいをつけると自然になるよ。',
          miss: 'メニュー名とくださいを一緒に言ってみよう。',
        },
        tongHints: {
          success: 'Nice opening. You named a dish and used polite ordering language.',
          partial: 'Good start. Add a polite ending like ください for a natural order.',
          miss: 'Try a simple pattern: たこ焼きください。',
        },
        rewards: {
          success: { xp: 8, sp: 2, rp: 1, objectiveProgress: 0.4 },
          partial: { xp: 6, sp: 1, rp: 1, objectiveProgress: 0.25 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'encouraged',
          partial: 'curious',
          miss: 'patient',
        },
      },
      {
        stepId: 'set_spice_level',
        requiredTags: ['spice'],
        quickReplies: ['普通の辛さでお願いします。', '辛さ控えめでお願いします。', '甘口でお願いします。'],
        prompts: {
          success: 'いいね。最後に数量を伝えよう。',
          partial: '惜しい。普通/控えめみたいに辛さをはっきり言おう。',
          miss: 'まず辛さを言ってみよう。例: 普通の辛さでお願いします。',
        },
        tongHints: {
          success: 'Great. Spice-level language sounds natural.',
          partial: 'You are close. Add a clear spice word like 普通 or 控えめ.',
          miss: 'Include spice preference: 辛さ控えめ / 普通 / 辛口.',
        },
        rewards: {
          success: { xp: 8, sp: 2, rp: 1, objectiveProgress: 0.35 },
          partial: { xp: 6, sp: 1, rp: 1, objectiveProgress: 0.2 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'impressed',
          partial: 'focused',
          miss: 'supportive',
        },
      },
      {
        stepId: 'confirm_order',
        requiredTags: ['confirm', 'polite'],
        quickReplies: ['一つお願いします、ありがとうございます。', '二つお願いします。', 'これでお願いします、ありがとうございます。'],
        prompts: {
          success: '完璧。注文の流れが自然だったよ。',
          partial: 'いい感じ。数量かありがとうを入れると完成度が上がるよ。',
          miss: '最後に数量 + お願いしますを入れてみよう。例: 一つお願いします。',
        },
        tongHints: {
          success: 'Strong finish. You confirmed the order politely.',
          partial: 'Almost complete. Add quantity or a polite close.',
          miss: 'Use quantity + polite ending: 一つお願いします。',
        },
        rewards: {
          success: { xp: 10, sp: 3, rp: 2, objectiveProgress: 0.35 },
          partial: { xp: 7, sp: 2, rp: 1, objectiveProgress: 0.2 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'excited',
          partial: 'encouraging',
          miss: 'calm',
        },
      },
    ],
    completion: {
      passedLine: '完璧。実際の注文でも十分に通じるレベルだよ。',
      retryLine: '流れは掴めてる。もう一回でミッションに進めるよ。',
      tongWrapUpPass: 'Objective validated. Mission gate is now previewed.',
      tongWrapUpRetry: 'Scene complete. Another validated hangout will unlock the mission gate.',
    },
    tongStartHint: 'Pick a dish with ください first, then set spice level.',
    utteranceTagPatterns: {
      food: ['たこ焼き', '焼きそば', 'ラーメン', 'メニュー', '注文'],
      polite: ['ください', 'お願いします', 'です', 'ます', 'ありがとう'],
      spice: ['辛', '控えめ', '普通', '甘口', '辛口'],
      confirm: ['一つ', '二つ', '三つ', 'お願いします', 'ありがとう'],
    },
  },
  zh: {
    objectiveLabel: 'Place a complete Chinese street-food order',
    objectiveSummary: 'Choose dish, set spice level, and close politely.',
    targets: {
      vocabulary: ['点单', '炒年糕', '辣度', '谢谢'],
      grammar: ['请 + 动词', '数量 + 份'],
      sentenceStructures: ['请给我 + N', '辣度 + 微辣/中辣'],
    },
    turnScript: [
      {
        stepId: 'pick_menu',
        requiredTags: ['food', 'polite'],
        quickReplies: ['请给我一份炒年糕。', '请给我一份煎饼。', '请来一份拉面。'],
        prompts: {
          start: '这条小吃街很有名。用中文说你想吃什么吧。',
          success: '很好，点单语气很自然。接下来选辣度。',
          partial: '菜名不错。加上请会更自然。',
          miss: '试试菜名加请。比如: 请给我一份炒年糕。',
        },
        tongHints: {
          success: 'Nice opening. You named a dish and used polite ordering language.',
          partial: 'Good start. Add a polite marker like 请 for a natural order.',
          miss: 'Try a simple pattern: 请给我一份炒年糕。',
        },
        rewards: {
          success: { xp: 8, sp: 2, rp: 1, objectiveProgress: 0.4 },
          partial: { xp: 6, sp: 1, rp: 1, objectiveProgress: 0.25 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'encouraged',
          partial: 'curious',
          miss: 'patient',
        },
      },
      {
        stepId: 'set_spice_level',
        requiredTags: ['spice'],
        quickReplies: ['请做微辣。', '请做不太辣。', '请做中辣。'],
        prompts: {
          success: '很好。最后再确认数量吧。',
          partial: '接近了。再明确一点辣度，比如微辣或中辣。',
          miss: '先说辣度。比如: 请做微辣。',
        },
        tongHints: {
          success: 'Great. Spice-level language sounds natural.',
          partial: 'You are close. Add a clear spice phrase like 微辣 or 中辣.',
          miss: 'Include spice preference: 不辣 / 微辣 / 中辣.',
        },
        rewards: {
          success: { xp: 8, sp: 2, rp: 1, objectiveProgress: 0.35 },
          partial: { xp: 6, sp: 1, rp: 1, objectiveProgress: 0.2 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'impressed',
          partial: 'focused',
          miss: 'supportive',
        },
      },
      {
        stepId: 'confirm_order',
        requiredTags: ['confirm', 'polite'],
        quickReplies: ['一份，谢谢。', '两份，谢谢。', '就这样点单，谢谢。'],
        prompts: {
          success: '太好了，整段点单很流畅。',
          partial: '不错。再加数量或谢谢会更完整。',
          miss: '最后说数量 + 谢谢。比如: 一份，谢谢。',
        },
        tongHints: {
          success: 'Strong finish. You confirmed the order politely.',
          partial: 'Almost complete. Add quantity or a polite close.',
          miss: 'Use quantity + polite ending: 一份，谢谢。',
        },
        rewards: {
          success: { xp: 10, sp: 3, rp: 2, objectiveProgress: 0.35 },
          partial: { xp: 7, sp: 2, rp: 1, objectiveProgress: 0.2 },
          miss: { xp: 4, sp: 1, rp: 0, objectiveProgress: 0.1 },
        },
        moodByTier: {
          success: 'excited',
          partial: 'encouraging',
          miss: 'calm',
        },
      },
    ],
    completion: {
      passedLine: '太棒了。你已经可以自然完成点单流程。',
      retryLine: '流程已经有了，再来一次就能开任务关卡。',
      tongWrapUpPass: 'Objective validated. Mission gate is now previewed.',
      tongWrapUpRetry: 'Scene complete. Another validated hangout will unlock the mission gate.',
    },
    tongStartHint: 'Pick a dish with 请 first, then set spice level.',
    utteranceTagPatterns: {
      food: ['炒年糕', '煎饼', '拉面', '点单', '菜单'],
      polite: ['请', '谢谢', '麻烦'],
      spice: ['辣', '微辣', '中辣', '不辣', '少辣'],
      confirm: ['一份', '两份', '三份', '谢谢', '就这样'],
    },
  },
};

const state = {
  profiles: new Map(),
  sessions: new Map(),
  gameSessions: new Map(),
  gameSessionByUser: new Map(),
  learnSessions: [...(FIXTURES.learnSessions.items || [])],
  ingestionResult: null,
  counters: {
    game: 1,
    hangout: 1,
  },
};

function nextSessionId(type) {
  const next = state.counters[type];
  state.counters[type] += 1;
  if (type === 'game') return `sess_${String(next).padStart(4, '0')}`;
  return `hang_${String(next).padStart(4, '0')}`;
}

function cloneScore(score) {
  return {
    xp: score.xp,
    sp: score.sp,
    rp: score.rp,
  };
}

function normalizeCity(value, fallback = 'seoul') {
  if (CITY_IDS.includes(value)) return value;
  return fallback;
}

function normalizeLocation(value, fallback = 'food_street') {
  if (LOCATION_IDS.includes(value)) return value;
  return fallback;
}

function normalizeLang(value, fallback = 'ko') {
  if (LANG_IDS.includes(value)) return value;
  return fallback;
}

function pickRandomNpc(city) {
  const safeCity = normalizeCity(city);
  const pool = CITY_CHARACTER_POOL[safeCity] || CITY_CHARACTER_POOL.seoul;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return { ...selected };
}

function pickCharacter({ city = 'seoul', preferRomance = true, requestedCharacterId } = {}) {
  if (requestedCharacterId) {
    const fromRomance = ROMANCEABLE_CHARACTERS.find((item) => item.npcId === requestedCharacterId);
    if (fromRomance) return { ...fromRomance };
    const fromPool = (CITY_CHARACTER_POOL[normalizeCity(city)] || []).find(
      (item) => item.npcId === requestedCharacterId,
    );
    if (fromPool) return { ...fromPool };
  }

  if (preferRomance && ROMANCEABLE_CHARACTERS.length > 0) {
    const selected = ROMANCEABLE_CHARACTERS[Math.floor(Math.random() * ROMANCEABLE_CHARACTERS.length)];
    return { ...selected };
  }

  return pickRandomNpc(city);
}

function getSceneSlice({ city = 'seoul', location = 'food_street', lang } = {}) {
  const safeCity = normalizeCity(city);
  const cityBase = CITY_BASE[safeCity];
  const safeLocation = normalizeLocation(location);
  const locationBase = LOCATION_BASE[safeLocation];
  const safeLang = normalizeLang(lang, cityBase.defaultLang);
  const languagePack = LANGUAGE_SCENE_PACKS[safeLang];

  return {
    city: safeCity,
    cityLabel: cityBase.cityLabel,
    lang: safeLang,
    sceneId: `${safeCity}_${safeLocation}_hangout_intro`,
    location: {
      locationId: safeLocation,
      label: locationBase.label,
      district: cityBase.district,
      landmark: cityBase.landmark,
      vibeTags: [...new Set([...cityBase.vibeTags, ...locationBase.vibeTags])],
    },
    objective: {
      objectiveId: `${safeLang}_${safeLocation}_l2_001`,
      label: languagePack.objectiveLabel,
      summary: `${languagePack.objectiveSummary} (${locationBase.label}).`,
      mode: 'hangout',
      requiredTurns: 3,
      requiredSuccessfulTurns: 2,
      requiredProgressForPass: 0.75,
      targets: {
        vocabulary: [...languagePack.targets.vocabulary],
        grammar: [...languagePack.targets.grammar],
        sentenceStructures: [...languagePack.targets.sentenceStructures],
      },
    },
    npc: { ...cityBase.npc },
    turnScript: [...languagePack.turnScript],
    completion: { ...languagePack.completion },
    tongStartHint: languagePack.tongStartHint,
    utteranceTagPatterns: languagePack.utteranceTagPatterns,
  };
}

function buildLocationMeta(scene) {
  return {
    city: scene.city,
    cityLabel: scene.cityLabel,
    sceneId: scene.sceneId,
    locationId: scene.location.locationId,
    locationLabel: scene.location.label,
    district: scene.location.district,
    landmark: scene.location.landmark,
    vibeTags: [...scene.location.vibeTags],
  };
}

function buildCurrentObjective(scene, progress = 0, successfulTurns = 0) {
  return {
    objectiveId: scene.objective.objectiveId,
    mode: scene.objective.mode,
    label: scene.objective.label,
    summary: scene.objective.summary,
    targets: {
      vocabulary: [...scene.objective.targets.vocabulary],
      grammar: [...scene.objective.targets.grammar],
      sentenceStructures: [...scene.objective.targets.sentenceStructures],
    },
    completionCriteria: {
      requiredTurns: scene.objective.requiredTurns,
      requiredSuccessfulTurns: scene.objective.requiredSuccessfulTurns,
      requiredProgressForPass: scene.objective.requiredProgressForPass,
    },
    progress: Number(progress.toFixed(2)),
    successfulTurns,
  };
}

function buildNpcState(scene, mood, npcOverride = null) {
  const npc = npcOverride || scene.npc;
  return {
    npcId: npc.npcId,
    name: npc.name,
    role: npc.role,
    mood: mood || npc.baselineMood,
    isRomanceable: Boolean(npc.isRomanceable),
    assetKey: npc.assetKey || null,
  };
}

function buildCharacterPayload(scene, mood, npcOverride = null) {
  const npc = npcOverride || scene.npc;
  return {
    id: npc.npcId,
    name: npc.name,
    role: npc.role,
    mood: mood || npc.baselineMood,
    isRomanceable: Boolean(npc.isRomanceable),
    assetKey: npc.assetKey || null,
  };
}

function buildObjectiveProgressState(scene, progress) {
  const clamped = Number(Math.max(0, Math.min(1, progress)).toFixed(2));
  return {
    current: Math.round(clamped * 100),
    target: 100,
    percent: clamped,
    label: `${scene.cityLabel} ${scene.location.label} objective`,
  };
}

function buildTurnState(scene, session, lastTurn = null) {
  const completedTurns = Math.min(session.turn - 1, scene.objective.requiredTurns);
  return {
    currentTurn: session.turn,
    completedTurns,
    requiredTurns: scene.objective.requiredTurns,
    turnsRemaining: Math.max(0, scene.objective.requiredTurns - completedTurns),
    successfulTurns: session.successfulTurns,
    objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
    isCompleted: session.completed,
    completionSignal: session.completed ? 'hangout_complete' : null,
    lastTurn,
  };
}

function buildUnlockPreview(scene, unlocked) {
  const currentIndex = LOCATION_IDS.indexOf(scene.location.locationId);
  const nextLocationOptions = [];
  if (currentIndex >= 0) {
    nextLocationOptions.push(LOCATION_IDS[(currentIndex + 1) % LOCATION_IDS.length]);
    nextLocationOptions.push(LOCATION_IDS[(currentIndex + 2) % LOCATION_IDS.length]);
  } else {
    nextLocationOptions.push('cafe', 'convenience_store');
  }

  return {
    missionGate: `${scene.city}_${scene.location.locationId}_mission_assessment`,
    nextMasteryTier: 2,
    nextLocationOptions,
    learnModeObjective: `${scene.lang}_${scene.location.locationId}_l2_002`,
    unlocked,
  };
}

function objectivePassed(scene, session) {
  return (
    session.successfulTurns >= scene.objective.requiredSuccessfulTurns &&
    session.objectiveProgress >= scene.objective.requiredProgressForPass
  );
}

function buildCompletionSummary(scene, session) {
  if (!session.completed) return null;
  const passed = objectivePassed(scene, session);
  return {
    objectiveId: scene.objective.objectiveId,
    status: passed ? 'passed' : 'completed_retry_available',
    completionSignal: passed ? 'objective_validated' : 'scene_complete_retry_available',
    turnsTaken: Math.min(session.turn - 1, scene.objective.requiredTurns),
    successfulTurns: session.successfulTurns,
    objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
    scoreDelta: cloneScore(session.score),
    unlockPreview: buildUnlockPreview(scene, passed),
  };
}

function extractUtteranceTags(userUtterance, utteranceTagPatterns) {
  const raw = String(userUtterance || '').toLowerCase();
  const tags = new Set();

  for (const [tag, patterns] of Object.entries(utteranceTagPatterns || {})) {
    if (patterns.some((pattern) => raw.includes(pattern))) tags.add(tag);
  }

  return tags;
}

function evaluateTurn(userUtterance, scene, turnScript) {
  const tags = extractUtteranceTags(userUtterance, scene.utteranceTagPatterns);
  const matchedTags = turnScript.requiredTags.filter((tag) => tags.has(tag));
  const missingTags = turnScript.requiredTags.filter((tag) => !tags.has(tag));
  const tier = missingTags.length === 0 ? 'success' : matchedTags.length > 0 ? 'partial' : 'miss';
  const rewards = turnScript.rewards[tier];

  return {
    tier,
    matchedTags,
    missingTags,
    rewards,
    tongHint: turnScript.tongHints[tier],
    nextLine: turnScript.prompts[tier],
    mood: turnScript.moodByTier[tier],
  };
}

function getQuickRepliesForTurn(scene, turnNumber) {
  const scriptIndex = Math.min(Math.max(turnNumber - 1, 0), scene.turnScript.length - 1);
  return [...(scene.turnScript[scriptIndex].quickReplies || [])];
}

function buildObjectiveNextResponse({ city = 'seoul', location = 'food_street', lang = 'ko', mode = 'hangout' }) {
  const scene = getSceneSlice({ city, location, lang });
  return {
    objectiveId: scene.objective.objectiveId,
    level: 2,
    mode,
    coreTargets: {
      vocabulary: [...scene.objective.targets.vocabulary],
      grammar: [...scene.objective.targets.grammar],
      sentenceStructures: [...scene.objective.targets.sentenceStructures],
    },
    personalizedTargets: (FIXTURES.objectivesNext.personalizedTargets || []).map((item, index) => ({
      ...item,
      lemma: scene.objective.targets.vocabulary[index] || item.lemma,
    })),
    completionCriteria: {
      requiredTurns: scene.objective.requiredTurns,
      requiredAccuracy: FIXTURES.objectivesNext.completionCriteria?.requiredAccuracy || 0.75,
    },
  };
}

function createGameSession(userId, profile, options = {}) {
  const slice = getSceneSlice(options);
  const npc = pickCharacter({
    city: slice.city,
    preferRomance: options.preferRomance !== false,
    requestedCharacterId: options.characterId,
  });
  const sessionId = nextSessionId('game');
  const session = {
    sessionId,
    userId,
    city: slice.city,
    location: slice.location.locationId,
    lang: slice.lang,
    sceneId: slice.sceneId,
    profile: profile || FIXTURES.gameStart.profile,
    progression: { ...(FIXTURES.gameStart.progression || { xp: 0, sp: 0, rp: 0 }) },
    objectiveProgress: 0,
    successfulTurns: 0,
    npc,
    npcMood: npc.baselineMood,
    lastHangoutSummary: null,
  };
  state.gameSessions.set(sessionId, session);
  state.gameSessionByUser.set(userId, sessionId);
  return session;
}

function buildGameStartResponse(session, resumed) {
  const scene = getSceneSlice({
    city: session.city,
    location: session.location,
    lang: session.lang,
  });

  return {
    ...FIXTURES.gameStart,
    sessionId: session.sessionId,
    city: scene.city,
    sceneId: scene.sceneId,
    location: scene.location.locationId,
    lang: scene.lang,
    profile: session.profile,
    progression: session.progression,
    resumed,
    tongPrompt: `tong://${scene.city}/${scene.location.locationId}/hangout/v1`,
    actions: [
      `Start ${scene.cityLabel} ${scene.location.label} Hangout`,
      `Review ${scene.location.label} Learn Session`,
      'Open Last-3-Days Vocab Feed',
    ],
    currentObjective: buildCurrentObjective(scene, session.objectiveProgress, session.successfulTurns),
    locationMeta: buildLocationMeta(scene),
    npc: buildNpcState(scene, session.npcMood, session.npc),
    turnState: {
      currentTurn: 1,
      completedTurns: 0,
      requiredTurns: scene.objective.requiredTurns,
      turnsRemaining: scene.objective.requiredTurns,
      successfulTurns: session.successfulTurns,
      objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
      isCompleted: false,
      completionSignal: null,
      lastTurn: null,
    },
    hangoutStartRequestPreview: {
      userId: session.userId,
      city: scene.city,
      location: scene.location.locationId,
      lang: scene.lang,
      objectiveId: scene.objective.objectiveId,
      gameSessionId: session.sessionId,
    },
    lastHangoutSummary: session.lastHangoutSummary,
  };
}

function createHangoutSession({
  userId,
  gameSessionId,
  city,
  location,
  lang,
  characterId,
  preferRomance = true,
}) {
  const scene = getSceneSlice({ city, location, lang });
  const npc = pickCharacter({ city: scene.city, preferRomance, requestedCharacterId: characterId });
  const sceneSessionId = nextSessionId('hangout');
  const session = {
    sceneSessionId,
    userId,
    gameSessionId,
    city: scene.city,
    location: scene.location.locationId,
    lang: scene.lang,
    sceneId: scene.sceneId,
    objectiveId: scene.objective.objectiveId,
    npc,
    turn: 1,
    score: { xp: 0, sp: 0, rp: 0 },
    objectiveProgress: 0,
    successfulTurns: 0,
    npcMood: npc.baselineMood,
    completed: false,
    transcript: [],
  };
  state.sessions.set(sceneSessionId, session);
  return session;
}

function updateGameSessionFromHangout(hangoutSession, completionSummary) {
  if (!hangoutSession.gameSessionId || !completionSummary) return;
  const gameSession = state.gameSessions.get(hangoutSession.gameSessionId);
  if (!gameSession) return;

  gameSession.progression.xp += completionSummary.scoreDelta.xp;
  gameSession.progression.sp += completionSummary.scoreDelta.sp;
  gameSession.progression.rp += completionSummary.scoreDelta.rp;
  gameSession.objectiveProgress = hangoutSession.objectiveProgress;
  gameSession.successfulTurns = hangoutSession.successfulTurns;
  gameSession.npcMood = hangoutSession.npcMood;
  gameSession.city = hangoutSession.city;
  gameSession.location = hangoutSession.location;
  gameSession.lang = hangoutSession.lang;
  gameSession.sceneId = hangoutSession.sceneId;
  gameSession.npc = hangoutSession.npc;
  gameSession.lastHangoutSummary = completionSummary;
  state.gameSessions.set(gameSession.sessionId, gameSession);
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function noContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function getLang(query) {
  return normalizeLang(query.get('lang'), 'ko');
}

function getCity(query) {
  return normalizeCity(query.get('city'), 'seoul');
}

function getLocation(query) {
  return normalizeLocation(query.get('location'), 'food_street');
}

function getMode(query) {
  return query.get('mode') === 'learn' ? 'learn' : 'hangout';
}

function getLearnTheme(lang) {
  if (lang === 'ja') return 'line_like';
  if (lang === 'zh') return 'wechat_like';
  return 'kakao_like';
}

function getCaptionsForVideo(videoId = 'karina-variety-demo') {
  const baseSegments = [
    {
      startMs: 2000,
      endMs: 5200,
      surface: '오늘 뭐 먹을까?',
      romanized: 'oneul mwo meogeulkka',
      english: 'What should we eat today?',
      tokens: [
        { text: '오늘', lemma: '오늘', pos: 'noun', dictionaryId: 'ko-001' },
        { text: '먹을까', lemma: '먹다', pos: 'verb', dictionaryId: 'ko-441' },
      ],
    },
    {
      startMs: 5600,
      endMs: 9200,
      surface: '떡볶이 주문해 볼래?',
      romanized: 'tteokbokki jumunhae bollae',
      english: 'Want to order tteokbokki?',
      tokens: [
        { text: '떡볶이', lemma: '떡볶이', pos: 'noun', dictionaryId: 'ko-210' },
        { text: '주문', lemma: '주문', pos: 'noun', dictionaryId: 'ko-099' },
      ],
    },
    {
      startMs: 9600,
      endMs: 12500,
      surface: '맵기는 어느 정도로 할까요?',
      romanized: 'maepgineun eoneu jeongdoro halkkayo',
      english: 'How spicy should we make it?',
      tokens: [
        { text: '맵기', lemma: '맵다', pos: 'adjective', dictionaryId: 'ko-552' },
        { text: '정도', lemma: '정도', pos: 'noun', dictionaryId: 'ko-778' },
      ],
    },
    {
      startMs: 13200,
      endMs: 16100,
      surface: '좋아, 같이 먹자!',
      romanized: 'joa, gachi meokja',
      english: 'Great, let’s eat together!',
      tokens: [
        { text: '같이', lemma: '같이', pos: 'adverb', dictionaryId: 'ko-345' },
        { text: '먹자', lemma: '먹다', pos: 'verb', dictionaryId: 'ko-441' },
      ],
    },
  ];

  return {
    ...FIXTURES.captions,
    videoId,
    segments: baseSegments,
  };
}

function loadOrFallback(name, fallback) {
  const generated = loadGeneratedSnapshot(name);
  return generated || fallback;
}

function runIngestion() {
  const snapshot = JSON.parse(fs.readFileSync(mockMediaWindowPath, 'utf8'));
  const result = runMockIngestion(snapshot);
  writeGeneratedSnapshots(result);
  state.ingestionResult = result;
  return result;
}

function ensureIngestion() {
  if (state.ingestionResult) return state.ingestionResult;

  const frequency = loadGeneratedSnapshot('frequency');
  const insights = loadGeneratedSnapshot('insights');
  const mediaProfile = loadGeneratedSnapshot('media-profile');
  if (frequency && insights && mediaProfile) {
    state.ingestionResult = {
      generatedAtIso: mediaProfile.generatedAtIso || new Date().toISOString(),
      frequency,
      insights,
      mediaProfile,
    };
    return state.ingestionResult;
  }

  return runIngestion();
}

function shouldUseAiHangout() {
  if (process.env.TONG_HANGOUT_MODE === 'mock') return false;
  return Boolean(process.env.OPENAI_API_KEY);
}

function parseJsonObject(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function generateAiHangoutTurn({
  scene,
  existing,
  userUtterance,
  evaluation,
  defaultLine,
  defaultHint,
  defaultReplies,
}) {
  if (!shouldUseAiHangout()) return null;

  const model = process.env.TONG_OPENAI_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are Tong scene director for a first-person language learning hangout. Return JSON only with keys: nextLine, tongHint, suggestedReplies, mood.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            city: scene.city,
            cityLabel: scene.cityLabel,
            location: scene.location.label,
            language: scene.lang,
            npc: existing.npc || scene.npc,
            objective: scene.objective,
            turn: existing.turn,
            userUtterance,
            rubricTier: evaluation.tier,
            matchedTags: evaluation.matchedTags,
            missingTags: evaluation.missingTags,
            guidance:
              'Keep immersive dialogue only. Next line should be short. suggestedReplies should be 3-5 learner-usable lines.',
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`openai_request_failed_${response.status}`);
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || '';
  const parsed = parseJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  const suggestedReplies = Array.isArray(parsed.suggestedReplies)
    ? parsed.suggestedReplies.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 6)
    : defaultReplies;

  return {
    nextLine: typeof parsed.nextLine === 'string' && parsed.nextLine.trim() ? parsed.nextLine.trim() : defaultLine,
    tongHint: typeof parsed.tongHint === 'string' && parsed.tongHint.trim() ? parsed.tongHint.trim() : defaultHint,
    suggestedReplies: suggestedReplies.length ? suggestedReplies : defaultReplies,
    mood: typeof parsed.mood === 'string' && parsed.mood.trim() ? parsed.mood.trim() : evaluation.mood,
  };
}

async function handleHangoutRespond(body) {
  const sceneSessionId = body.sceneSessionId;
  const userUtterance = String(body.userUtterance || '').trim();
  const existing = state.sessions.get(sceneSessionId);
  const scene = existing
    ? getSceneSlice({
        city: existing.city,
        location: existing.location,
        lang: existing.lang,
      })
    : null;

  if (!existing) {
    return {
      statusCode: 404,
      payload: {
        error: 'unknown_scene_session',
      },
    };
  }

  if (existing.completed) {
    const completionSummary = buildCompletionSummary(scene, existing);
    return {
      statusCode: 200,
      payload: {
        accepted: true,
        feedback: {
          tongHint: 'This hangout is already complete. Start a new scene to replay.',
          objectiveProgressDelta: 0,
          objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
          suggestedReplies: [],
        },
        nextLine: {
          speaker: 'tong',
          text: '이 장면은 이미 완료됐어. 새 세션으로 이어서 연습하자.',
        },
        state: {
          turn: existing.turn,
          score: cloneScore(existing.score),
          objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
        },
        currentObjective: buildCurrentObjective(scene, existing.objectiveProgress, existing.successfulTurns),
        locationMeta: buildLocationMeta(scene),
        npc: buildNpcState(scene, existing.npcMood, existing.npc),
        character: buildCharacterPayload(scene, existing.npcMood, existing.npc),
        turnState: buildTurnState(scene, existing, {
          stepId: 'complete',
          tier: 'complete',
          matchedTags: [],
          missingTags: [],
          delta: {
            xp: 0,
            sp: 0,
            rp: 0,
            objectiveProgressDelta: 0,
          },
        }),
        completion: {
          isCompleted: true,
          completionSignal: completionSummary?.completionSignal || 'hangout_complete',
        },
        completionSummary,
      },
    };
  }

  const scriptIndex = Math.min(existing.turn - 1, scene.turnScript.length - 1);
  const turnScript = scene.turnScript[scriptIndex];
  const evaluation = evaluateTurn(userUtterance, scene, turnScript);
  const xpDelta = evaluation.rewards.xp;
  const spDelta = evaluation.rewards.sp;
  const rpDelta = evaluation.rewards.rp;
  const objectiveProgressDelta = evaluation.rewards.objectiveProgress;

  existing.turn += 1;
  existing.score.xp += xpDelta;
  existing.score.sp += spDelta;
  existing.score.rp += rpDelta;
  existing.objectiveProgress = Number(
    Math.min(1, existing.objectiveProgress + objectiveProgressDelta).toFixed(2),
  );
  if (evaluation.tier === 'success') {
    existing.successfulTurns += 1;
  }
  existing.npcMood = evaluation.mood;
  existing.transcript.push({
    stepId: turnScript.stepId,
    userUtterance,
    tier: evaluation.tier,
    matchedTags: evaluation.matchedTags,
    missingTags: evaluation.missingTags,
  });

  const completedTurns = Math.min(existing.turn - 1, scene.objective.requiredTurns);
  existing.completed = completedTurns >= scene.objective.requiredTurns;
  const passed = objectivePassed(scene, existing);

  const completionSummary = buildCompletionSummary(scene, existing);
  if (completionSummary) {
    updateGameSessionFromHangout(existing, completionSummary);
  }

  const fallbackLine = existing.completed
    ? passed
      ? scene.completion.passedLine
      : scene.completion.retryLine
    : evaluation.nextLine;

  const fallbackHint = existing.completed
    ? passed
      ? scene.completion.tongWrapUpPass
      : scene.completion.tongWrapUpRetry
    : evaluation.tongHint;
  const fallbackReplies = existing.completed ? [] : getQuickRepliesForTurn(scene, existing.turn);

  let nextLineText = fallbackLine;
  let tongHint = fallbackHint;
  let suggestedReplies = fallbackReplies;

  if (!existing.completed) {
    try {
      const aiTurn = await generateAiHangoutTurn({
        scene,
        existing,
        userUtterance,
        evaluation,
        defaultLine: fallbackLine,
        defaultHint: fallbackHint,
        defaultReplies: fallbackReplies,
      });
      if (aiTurn) {
        nextLineText = aiTurn.nextLine;
        tongHint = aiTurn.tongHint;
        suggestedReplies = aiTurn.suggestedReplies;
        existing.npcMood = aiTurn.mood;
      }
    } catch (error) {
      console.warn('ai_turn_generation_failed', error instanceof Error ? error.message : 'unknown');
    }
  }

  const lastTurn = {
    stepId: turnScript.stepId,
    tier: evaluation.tier,
    matchedTags: evaluation.matchedTags,
    missingTags: evaluation.missingTags,
    delta: {
      xp: xpDelta,
      sp: spDelta,
      rp: rpDelta,
      objectiveProgressDelta,
    },
  };

  const response = {
    accepted: true,
    feedback: {
      tongHint,
      objectiveProgressDelta,
      objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
      suggestedReplies,
    },
    nextLine: {
      speaker: 'character',
      text: nextLineText,
    },
    state: {
      turn: existing.turn,
      score: cloneScore(existing.score),
      objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
    },
    currentObjective: buildCurrentObjective(scene, existing.objectiveProgress, existing.successfulTurns),
    locationMeta: buildLocationMeta(scene),
    npc: buildNpcState(scene, existing.npcMood, existing.npc),
    character: buildCharacterPayload(scene, existing.npcMood, existing.npc),
    turnState: buildTurnState(scene, existing, lastTurn),
    completion: {
      isCompleted: existing.completed,
      completionSignal: existing.completed
        ? passed
          ? 'objective_validated'
          : 'scene_complete_retry_available'
        : null,
    },
    completionSummary,
  };

  state.sessions.set(sceneSessionId, existing);
  return { statusCode: 200, payload: response };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      jsonResponse(res, 400, { error: 'invalid_request' });
      return;
    }

    if (req.method === 'OPTIONS') {
      noContent(res);
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    console.log(`[${new Date().toISOString()}] ${req.method || 'GET'} ${pathname}${url.search}`);

    if (pathname === '/health') {
      jsonResponse(res, 200, { ok: true, service: 'tong-server' });
      return;
    }

    if (pathname === '/api/v1/captions/enriched' && req.method === 'GET') {
      const videoId = url.searchParams.get('videoId') || 'karina-variety-demo';
      const lang = getLang(url.searchParams);
      jsonResponse(res, 200, { ...getCaptionsForVideo(videoId), lang });
      return;
    }

    if (pathname === '/api/v1/dictionary/entry' && req.method === 'GET') {
      const term = url.searchParams.get('term') || FIXTURES.dictionary.term;
      const entry = DICTIONARY_OVERRIDES[term] || {
        ...FIXTURES.dictionary,
        term,
      };
      jsonResponse(res, 200, entry);
      return;
    }

    if (pathname === '/api/v1/vocab/frequency' && req.method === 'GET') {
      const ingestion = ensureIngestion();
      jsonResponse(res, 200, loadOrFallback('frequency', ingestion.frequency || FIXTURES.frequency));
      return;
    }

    if (pathname === '/api/v1/vocab/insights' && req.method === 'GET') {
      const ingestion = ensureIngestion();
      jsonResponse(res, 200, loadOrFallback('insights', ingestion.insights || FIXTURES.insights));
      return;
    }

    if (pathname === '/api/v1/player/media-profile' && req.method === 'GET') {
      const ingestion = ensureIngestion();
      jsonResponse(
        res,
        200,
        loadOrFallback('media-profile', ingestion.mediaProfile || FIXTURES.mediaProfile),
      );
      return;
    }

    if (pathname === '/api/v1/ingestion/run-mock' && req.method === 'POST') {
      const result = runIngestion();
      jsonResponse(res, 200, {
        success: true,
        generatedAtIso: result.generatedAtIso,
        sourceCount: {
          youtube: result.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
          spotify: result.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
        },
        topTerms: result.frequency.items.slice(0, 10),
      });
      return;
    }

    if (pathname === '/api/v1/game/start-or-resume' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || 'demo-user-1';
      const existingSessionId = state.gameSessionByUser.get(userId);
      let session = existingSessionId ? state.gameSessions.get(existingSessionId) : null;
      let resumed = false;
      const requestedCity = normalizeCity(body.city, session?.city || 'seoul');
      const requestedLocation = normalizeLocation(body.location, session?.location || 'food_street');
      const requestedLang = normalizeLang(body.lang, CITY_BASE[requestedCity].defaultLang);

      if (session) {
        resumed = true;
        if (body.profile) {
          session.profile = body.profile;
        }
        session.city = requestedCity;
        session.location = requestedLocation;
        session.lang = requestedLang;
        session.sceneId = `${requestedCity}_${requestedLocation}_hangout_intro`;
        if (!session.npc || body.randomizeCharacter || body.characterId) {
          session.npc = pickCharacter({
            city: requestedCity,
            preferRomance: body.preferRomance !== false,
            requestedCharacterId: body.characterId,
          });
          session.npcMood = session.npc.baselineMood;
        }
        state.gameSessions.set(session.sessionId, session);
      } else {
        session = createGameSession(userId, body.profile, {
          city: requestedCity,
          location: requestedLocation,
          lang: requestedLang,
          preferRomance: body.preferRomance !== false,
          characterId: body.characterId,
        });
      }

      jsonResponse(res, 200, buildGameStartResponse(session, resumed));
      return;
    }

    if (pathname === '/api/v1/profile/proficiency' && req.method === 'PUT') {
      const body = await readJsonBody(req);
      if (!body.userId) {
        jsonResponse(res, 400, { error: 'userId_required' });
        return;
      }
      state.profiles.set(body.userId, body);
      jsonResponse(res, 200, { ok: true, profile: body });
      return;
    }

    if (pathname === '/api/v1/objectives/next' && req.method === 'GET') {
      const city = getCity(url.searchParams);
      const location = getLocation(url.searchParams);
      const lang = getLang(url.searchParams);
      const mode = getMode(url.searchParams);
      jsonResponse(res, 200, buildObjectiveNextResponse({ city, location, lang, mode }));
      return;
    }

    if (pathname === '/api/v1/scenes/hangout/start' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || 'demo-user-1';
      const gameSessionIdCandidate =
        body.gameSessionId || body.sessionId || state.gameSessionByUser.get(userId);
      const gameSessionId = state.gameSessions.has(gameSessionIdCandidate)
        ? gameSessionIdCandidate
        : null;
      const gameSession = gameSessionId ? state.gameSessions.get(gameSessionId) : null;
      const requestedCity = normalizeCity(body.city, gameSession?.city || 'seoul');
      const requestedLocation = normalizeLocation(body.location, gameSession?.location || 'food_street');
      const requestedLang = normalizeLang(body.lang, gameSession?.lang || CITY_BASE[requestedCity].defaultLang);
      const requestedCharacterId = body.characterId || gameSession?.npc?.npcId;
      const preferRomance = body.preferRomance !== false;
      const session = createHangoutSession({
        userId,
        gameSessionId,
        city: requestedCity,
        location: requestedLocation,
        lang: requestedLang,
        characterId: requestedCharacterId,
        preferRomance,
      });
      if (gameSession) {
        gameSession.city = session.city;
        gameSession.location = session.location;
        gameSession.lang = session.lang;
        gameSession.sceneId = session.sceneId;
        gameSession.npc = session.npc;
        gameSession.npcMood = session.npcMood;
        state.gameSessions.set(gameSession.sessionId, gameSession);
      }
      const scene = getSceneSlice({
        city: session.city,
        location: session.location,
        lang: session.lang,
      });

      jsonResponse(res, 200, {
        sceneSessionId: session.sceneSessionId,
        mode: 'hangout',
        city: scene.city,
        location: scene.location.locationId,
        lang: scene.lang,
        sceneId: scene.sceneId,
        uiPolicy: {
          immersiveFirstPerson: true,
          allowOnlyDialogueAndHints: true,
        },
        state: {
          turn: session.turn,
          score: cloneScore(session.score),
        },
        initialLine: {
          speaker: 'character',
          text: scene.turnScript[0].prompts.start,
        },
        initialLines: [
          {
            speaker: 'character',
            text: scene.turnScript[0].prompts.start,
          },
          {
            speaker: 'tong',
            text: scene.tongStartHint,
          },
        ],
        locationMeta: buildLocationMeta(scene),
        currentObjective: buildCurrentObjective(scene, session.objectiveProgress, session.successfulTurns),
        npc: buildNpcState(scene, session.npcMood, session.npc),
        character: buildCharacterPayload(scene, session.npcMood, session.npc),
        tongHint: scene.tongStartHint,
        quickReplies: getQuickRepliesForTurn(scene, session.turn),
        turnState: buildTurnState(scene, session),
        objectiveProgress: buildObjectiveProgressState(scene, session.objectiveProgress),
        objectiveId: body.objectiveId || scene.objective.objectiveId,
        objectiveSummary: scene.objective.summary,
        completion: {
          isCompleted: false,
          completionSignal: null,
        },
        completionSummary: null,
      });
      return;
    }

    if (pathname === '/api/v1/scenes/hangout/respond' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { statusCode, payload } = await handleHangoutRespond(body);
      jsonResponse(res, statusCode, payload);
      return;
    }

    if (pathname === '/api/v1/learn/sessions' && req.method === 'GET') {
      const city = normalizeCity(url.searchParams.get('city'), 'seoul');
      const lang = normalizeLang(url.searchParams.get('lang'), CITY_BASE[city].defaultLang);
      const items = [...state.learnSessions]
        .filter((item) => {
          if (item.city && item.city !== city) return false;
          if (item.lang && item.lang !== lang) return false;
          return true;
        })
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      jsonResponse(res, 200, { items });
      return;
    }

    if (pathname === '/api/v1/learn/sessions' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const city = normalizeCity(body.city, 'seoul');
      const lang = normalizeLang(body.lang, CITY_BASE[city].defaultLang);
      const location = normalizeLocation(body.location, 'food_street');
      const cityLabel = CITY_BASE[city].cityLabel;
      const learnSessionId = `learn_${Math.random().toString(36).slice(2, 8)}`;
      const objectiveId = body.objectiveId || `${lang}_${location}_l2_001`;
      const title = `${cityLabel} ${LOCATION_BASE[location].label} ${objectiveId} Drill`;
      const item = {
        learnSessionId,
        title,
        objectiveId,
        city,
        lang,
        lastMessageAt: new Date().toISOString(),
      };
      state.learnSessions.unshift(item);

      jsonResponse(res, 200, {
        learnSessionId,
        mode: 'learn',
        uiTheme: getLearnTheme(lang),
        objectiveId: item.objectiveId,
        firstMessage: {
          speaker: 'tong',
          text: `New session started in ${cityLabel}. We'll train for your next ${LOCATION_BASE[location].label} hangout.`,
        },
      });
      return;
    }

    jsonResponse(res, 404, { error: 'not_found', pathname });
  } catch (error) {
    jsonResponse(res, 500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
});

ensureIngestion();

server.listen(PORT, () => {
  console.log(`Tong mock server listening on http://localhost:${PORT}`);
});

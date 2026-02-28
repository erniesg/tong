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
const ROMANCE_LOCATION_IDS = ['food_street', 'cafe'];
const REQUIRED_VALIDATED_HANGOUTS_FOR_MISSION = 2;
const ROUTE_MEMORY_LIMIT = 8;
const ROUTE_HISTORY_LIMIT = 12;

const RELATIONSHIP_STAGES = [
  { stage: 'stranger', minRp: 0 },
  { stage: 'curious', minRp: 8 },
  { stage: 'comfortable', minRp: 18 },
  { stage: 'close', minRp: 32 },
  { stage: 'bonded', minRp: 48 },
];

const PROFICIENCY_READINESS = {
  none: 0.2,
  beginner: 0.38,
  intermediate: 0.58,
  advanced: 0.78,
  native: 0.9,
};

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
    assetKey: 'haeun/haeun.png',
    name: 'Haeun',
    role: 'Primary romance route lead',
    baselineMood: 'warm',
    isRomanceable: true,
  },
  {
    npcId: 'npc_jin',
    assetKey: 'jin/jin.png',
    name: 'Jin',
    role: 'Primary romance route lead',
    baselineMood: 'charming',
    isRomanceable: true,
  },
];

const CITY_ROMANCEABLE_CHARACTER_IDS = {
  seoul: ['npc_haeun', 'npc_jin'],
  tokyo: ['npc_haeun', 'npc_jin'],
  shanghai: ['npc_haeun', 'npc_jin'],
};

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

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getRelationshipStageFromRp(rp) {
  const safeRp = Math.max(0, Number(rp || 0));
  let current = RELATIONSHIP_STAGES[0];
  let next = null;

  for (let index = 0; index < RELATIONSHIP_STAGES.length; index += 1) {
    const candidate = RELATIONSHIP_STAGES[index];
    if (safeRp >= candidate.minRp) {
      current = candidate;
      next = RELATIONSHIP_STAGES[index + 1] || null;
    } else {
      break;
    }
  }

  return { current, next };
}

function buildRelationshipState(totalRp) {
  const safeRp = Math.max(0, Number(totalRp || 0));
  const { current, next } = getRelationshipStageFromRp(safeRp);
  const previousFloor = current.minRp;
  const nextFloor = next ? next.minRp : null;
  const progressToNext = nextFloor
    ? clampNumber((safeRp - previousFloor) / Math.max(1, nextFloor - previousFloor), 0, 1)
    : 1;

  return {
    rp: safeRp,
    stage: current.stage,
    currentStageMinRp: previousFloor,
    nextStageRp: nextFloor,
    progressToNext: Number(progressToNext.toFixed(2)),
  };
}

function deriveLearnReadiness(profile, lang) {
  const level = profile?.proficiency?.[lang] || 'beginner';
  const base = PROFICIENCY_READINESS[level] ?? PROFICIENCY_READINESS.beginner;
  return Number(clampNumber(base, 0, 1).toFixed(2));
}

function resolveTargetProficiency(profile, lang) {
  const level = profile?.proficiency?.[lang];
  if (level === 'none' || level === 'beginner' || level === 'intermediate' || level === 'advanced' || level === 'native') {
    return level;
  }
  return 'beginner';
}

function buildLanguageBlendGuidance(nativeLanguage, targetProficiency, relationshipStage) {
  const safeNativeLanguage = String(nativeLanguage || 'en').trim() || 'en';
  let targetLanguageShare = 0.22;
  if (targetProficiency === 'none') targetLanguageShare = 0.05;
  if (targetProficiency === 'beginner') targetLanguageShare = 0.22;
  if (targetProficiency === 'intermediate') targetLanguageShare = 0.55;
  if (targetProficiency === 'advanced') targetLanguageShare = 0.8;
  if (targetProficiency === 'native') targetLanguageShare = 0.95;

  const closeStage = relationshipStage === 'close' || relationshipStage === 'bonded';
  if (closeStage) {
    targetLanguageShare = clampNumber(targetLanguageShare + 0.08, 0.08, 0.96);
  }
  const nativeLanguageShare = Number((1 - targetLanguageShare).toFixed(2));
  const targetPercent = Math.round(targetLanguageShare * 100);
  const nativePercent = Math.round(nativeLanguageShare * 100);

  return `Language blend policy: use about ${targetPercent}% target language and ${nativePercent}% ${safeNativeLanguage}. Keep lines short and natural for ${targetProficiency} proficiency. No meta labels, no coaching prefixes, no objective summaries in dialogue.`;
}

function buildMissionGateState(session) {
  return {
    status: session.missionGateStatus || 'locked',
    requiredValidatedHangouts: REQUIRED_VALIDATED_HANGOUTS_FOR_MISSION,
    validatedHangouts: session.validatedHangouts || 0,
  };
}

function buildProgressLoopState(session) {
  return {
    masteryTier: session.masteryTier || 1,
    learnReadiness: Number(clampNumber(session.learnReadiness || 0, 0, 1).toFixed(2)),
    missionGate: buildMissionGateState(session),
  };
}

function sanitizeRouteMemoryNote(note) {
  if (typeof note !== 'string') return null;
  const trimmed = note.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 180);
}

function sanitizeHintText(text, fallback = '') {
  if (typeof text !== 'string') return fallback;
  const cleaned = text
    .replace(/^tong\s*[:\-]\s*/i, '')
    .replace(/^micro[\s-]*goal\s*[:\-]\s*/i, '')
    .replace(/^tip\s*[:\-]\s*/i, '')
    .replace(/^hint\s*[:\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 180);
}

function sanitizeSpokenLine(text, fallback = '') {
  if (typeof text !== 'string') return fallback;

  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/^(?:npc|character|dialogue|line)\s*[:\-]\s*/i, '')
    .trim();

  const quotedMatch = cleaned.match(/[“"]([^“”"]{2,260})[”"]/);
  if (quotedMatch?.[1]) {
    cleaned = quotedMatch[1].trim();
  }

  cleaned = cleaned
    .replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[:：-]\s*/u, '')
    .replace(/^\(([^)]{0,80})\)\s*/u, '')
    .replace(/^["“'`]+|["”'`]+$/gu, '')
    .trim();

  const narrativePrefix = cleaned.match(
    /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:nudges?|leans?|smiles?|grins?|laughs?|looks?|gestures?|whispers?|says?|replies?|asks?|nods?)\b[^.?!]*[.?!]\s*(.+)$/iu,
  );
  if (narrativePrefix?.[1]) {
    cleaned = narrativePrefix[1].trim();
  }

  // Reject template-like placeholders leaking from prompt examples.
  const hasPlaceholderPattern =
    /_{2,}|(?:^|\s)(?:N|V|A)\s*\+|(?:\(|\[)\s*(?:dish|menu|item|phrase|word|blank|fill|choice)\s*(?:\)|\])/i.test(
      cleaned,
    ) ||
    /(?:^|\s)(?:___|…{2,}|\.{3,})/.test(cleaned);
  if (hasPlaceholderPattern) return fallback;

  if (!cleaned) return fallback;
  return cleaned.slice(0, 260);
}

function sanitizeSuggestedReply(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/^(?:reply|option|choice)\s*[:\-]\s*/i, '')
    .replace(/^["“'`]+|["”'`]+$/gu, '')
    .trim();
  if (!cleaned) return null;
  const hasPlaceholderPattern = /_{2,}|(?:^|\s)(?:N|V|A)\s*\+|___|(?:\(|\[)\s*(?:dish|menu|item|blank)\s*(?:\)|\])/i.test(
    cleaned,
  );
  if (hasPlaceholderPattern) return null;
  return cleaned.slice(0, 120);
}

function mergeRouteMemoryNotes(existing = [], incoming = []) {
  const normalized = [];
  const seen = new Set();
  for (const candidate of [...existing, ...incoming]) {
    const safe = sanitizeRouteMemoryNote(candidate);
    if (!safe) continue;
    const key = safe.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(safe);
  }
  return normalized.slice(-ROUTE_MEMORY_LIMIT);
}

function normalizeSceneBeat(value, fallback = 'opening') {
  const safe = String(value || '').toLowerCase();
  if (safe === 'opening' || safe === 'build' || safe === 'challenge' || safe === 'resolution') return safe;
  return fallback;
}

function deriveSceneBeat(session, scene) {
  const completedTurns = Math.min((session.turn || 1) - 1, scene.objective.requiredTurns);
  const progress = Number(session.objectiveProgress || 0);
  if (completedTurns <= 1 || progress < 0.2) return 'opening';
  if (progress < 0.55) return 'build';
  if (progress < 0.9) return 'challenge';
  return 'resolution';
}

function buildFallbackMemoryNote(turnScript, tier, userUtterance) {
  if (tier === 'miss') return null;
  const cleanUtterance = String(userUtterance || '').replace(/\s+/g, ' ').trim();
  const excerpt = cleanUtterance ? ` (${cleanUtterance.slice(0, 42)})` : '';
  if (tier === 'success') return `Strong ${turnScript.stepId} response${excerpt}.`;
  return `Partial ${turnScript.stepId} response${excerpt}.`;
}

function buildRouteEvent({ scene, turnScript, tier, xpDelta, spDelta, rpDelta, objectiveProgressDelta }) {
  return {
    atIso: new Date().toISOString(),
    sceneId: scene.sceneId,
    city: scene.city,
    location: scene.location.locationId,
    stepId: turnScript.stepId,
    tier,
    delta: {
      xp: xpDelta,
      sp: spDelta,
      rp: rpDelta,
      objectiveProgressDelta: Number(clampNumber(objectiveProgressDelta, 0, 1).toFixed(2)),
    },
  };
}

function createCharacterProgressSeed(npc, seedRp = 0) {
  return {
    npcId: npc?.npcId || 'npc_unknown',
    name: npc?.name || 'Unknown',
    rp: Math.max(0, Math.round(Number(seedRp || 0))),
    validatedHangouts: 0,
    totalScenes: 0,
    totalTurns: 0,
    lastMood: npc?.baselineMood || 'neutral',
    lastSeenAt: null,
    memoryNotes: [],
    recentEvents: [],
  };
}

function ensureCharacterProgress(session, npc, options = {}) {
  if (!npc?.npcId) return null;
  const seedRp = Math.max(0, Math.round(Number(options.seedRp || 0)));
  session.characterProgress = session.characterProgress || {};
  if (!session.characterProgress[npc.npcId]) {
    session.characterProgress[npc.npcId] = createCharacterProgressSeed(npc, seedRp);
  }
  return session.characterProgress[npc.npcId];
}

function getCharacterProgress(session, npcId) {
  if (!session?.characterProgress || !npcId) return null;
  const record = session.characterProgress[npcId];
  if (!record) return null;
  return {
    ...record,
    memoryNotes: [...(record.memoryNotes || [])],
    recentEvents: [...(record.recentEvents || [])],
  };
}

function buildRouteState(npc, progress) {
  const safeProgress = progress || createCharacterProgressSeed(npc, 0);
  const relationshipState = buildRelationshipState(safeProgress.rp || 0);
  return {
    characterId: npc?.npcId || safeProgress.npcId,
    characterName: npc?.name || safeProgress.name,
    rp: safeProgress.rp || 0,
    stage: relationshipState.stage,
    progressToNext: relationshipState.progressToNext,
    validatedHangouts: safeProgress.validatedHangouts || 0,
    totalScenes: safeProgress.totalScenes || 0,
    totalTurns: safeProgress.totalTurns || 0,
    lastMood: safeProgress.lastMood || npc?.baselineMood || 'neutral',
    memoryNotes: [...(safeProgress.memoryNotes || [])].slice(-3),
    recentEvents: [...(safeProgress.recentEvents || [])].slice(-4),
    lastSeenAt: safeProgress.lastSeenAt || null,
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

function pickCharacter({ city = 'seoul', location = 'food_street', preferRomance = true, requestedCharacterId } = {}) {
  const safeCity = normalizeCity(city);
  const safeLocation = normalizeLocation(location);
  const normalizedRequestedCharacterId =
    requestedCharacterId === 'npc_ding_man' ? 'npc_jin' : requestedCharacterId;
  const romancePool = ROMANCEABLE_CHARACTERS.filter((item) =>
    (CITY_ROMANCEABLE_CHARACTER_IDS[safeCity] || []).includes(item.npcId),
  );

  if (normalizedRequestedCharacterId) {
    const fromRomance = ROMANCEABLE_CHARACTERS.find((item) => item.npcId === normalizedRequestedCharacterId);
    if (fromRomance) return { ...fromRomance };
    const fromPool = (CITY_CHARACTER_POOL[safeCity] || []).find(
      (item) => item.npcId === normalizedRequestedCharacterId,
    );
    if (fromPool) return { ...fromPool };
  }

  if (preferRomance && romancePool.length > 0) {
    // Deterministic first-scene lead for parity in Seoul Food Street demos.
    if (safeCity === 'seoul' && safeLocation === 'food_street') {
      const lead = romancePool.find((item) => item.npcId === 'npc_haeun');
      if (lead) return { ...lead };
    }
    const selected = romancePool[Math.floor(Math.random() * romancePool.length)];
    return { ...selected };
  }

  return pickRandomNpc(safeCity);
}

function normalizeLegacyRomanceIdentity(session) {
  if (!session) return;

  if (session.activeCharacterId === 'npc_ding_man') {
    session.activeCharacterId = 'npc_jin';
  }

  if (session.npc?.npcId === 'npc_ding_man') {
    session.npc = {
      ...session.npc,
      npcId: 'npc_jin',
      name: 'Jin',
      assetKey: session.npc.assetKey || 'jin/jin.png',
    };
  }

  if (session.npc?.npcId === 'npc_haeun' && session.npc.assetKey === 'hauen/haeun.png') {
    session.npc = {
      ...session.npc,
      assetKey: 'haeun/haeun.png',
    };
  }

  if (session.characterProgress?.npc_ding_man) {
    if (!session.characterProgress.npc_jin) {
      session.characterProgress.npc_jin = session.characterProgress.npc_ding_man;
    }
    delete session.characterProgress.npc_ding_man;
  }
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
    sceneBeat: session.sceneBeat || deriveSceneBeat(session, scene),
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

function computeTurnAccuracy(session) {
  const totalTurns = session.transcript?.length || 0;
  if (totalTurns === 0) return 0;
  return Number(clampNumber((session.successfulTurns || 0) / totalTurns, 0, 1).toFixed(2));
}

function buildCompletionSummary(scene, session) {
  if (!session.completed) return null;
  const passed = objectivePassed(scene, session);
  const totalRp = (session.characterBaseRp || 0) + (session.score?.rp || 0);
  const routeState = buildRouteState(session.npc, {
    npcId: session.npc?.npcId,
    name: session.npc?.name,
    rp: totalRp,
    validatedHangouts: session.routeValidatedHangouts || 0,
    totalScenes: 1,
    totalTurns: session.transcript?.length || 0,
    lastMood: session.npcMood,
    memoryNotes: [...(session.memoryNotes || [])],
    recentEvents: [...(session.recentEvents || [])],
    lastSeenAt: new Date().toISOString(),
  });
  return {
    objectiveId: scene.objective.objectiveId,
    status: passed ? 'passed' : 'completed_retry_available',
    completionSignal: passed ? 'objective_validated' : 'scene_complete_retry_available',
    turnsTaken: Math.min(session.turn - 1, scene.objective.requiredTurns),
    successfulTurns: session.successfulTurns,
    accuracy: computeTurnAccuracy(session),
    objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
    scoreDelta: cloneScore(session.score),
    relationshipState: buildRelationshipState(totalRp),
    routeState,
    progressionLoop: {
      masteryTier: session.masteryTier || 1,
      learnReadiness: Number(clampNumber(session.learnReadiness || 0, 0, 1).toFixed(2)),
      validatedHangouts: session.validatedHangouts || 0,
      missionGateStatus: session.missionGateStatus || 'locked',
    },
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

function buildHangoutOpeningLine(scene, session) {
  const baseLine = scene.turnScript[0].prompts.start;
  const lastMemory = [...(session.memoryNotes || [])].slice(-1)[0];
  if (!lastMemory) return baseLine;
  if (scene.lang === 'ko') return `${baseLine} 지난번에 ${lastMemory}`;
  if (scene.lang === 'ja') return `${baseLine} 前回メモ: ${lastMemory}`;
  if (scene.lang === 'zh') return `${baseLine} 上次记忆: ${lastMemory}`;
  return `${baseLine} Last memory: ${lastMemory}`;
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
  const nextProfile = profile || FIXTURES.gameStart.profile;
  const progression = { ...(FIXTURES.gameStart.progression || { xp: 0, sp: 0, rp: 0 }) };
  const validatedHangouts = 0;
  const missionGateStatus = 'locked';
  const masteryTier = progression.currentMasteryLevel || 1;
  const learnReadiness = deriveLearnReadiness(nextProfile, slice.lang);
  const npc = pickCharacter({
    city: slice.city,
    location: slice.location.locationId,
    preferRomance: options.preferRomance !== false,
    requestedCharacterId: options.characterId,
  });
  const characterProgress = {
    [npc.npcId]: createCharacterProgressSeed(npc, progression.rp || 0),
  };
  const sessionId = nextSessionId('game');
  const session = {
    sessionId,
    userId,
    city: slice.city,
    location: slice.location.locationId,
    lang: slice.lang,
    sceneId: slice.sceneId,
    profile: nextProfile,
    progression,
    objectiveProgress: 0,
    successfulTurns: 0,
    npc,
    npcMood: npc.baselineMood,
    masteryTier,
    learnReadiness,
    validatedHangouts,
    missionGateStatus,
    activeCharacterId: npc.npcId,
    characterProgress,
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
  const routeProgress = getCharacterProgress(session, session.activeCharacterId || session.npc?.npcId);
  const relationshipState = buildRelationshipState(routeProgress?.rp ?? session.progression?.rp ?? 0);
  const routeState = buildRouteState(session.npc, routeProgress);
  const progressionLoop = buildProgressLoopState(session);

  return {
    ...FIXTURES.gameStart,
    sessionId: session.sessionId,
    city: scene.city,
    sceneId: scene.sceneId,
    location: scene.location.locationId,
    lang: scene.lang,
    profile: session.profile,
    progression: session.progression,
    relationshipState,
    routeState,
    progressionLoop,
    engineMode: shouldUseAiHangout() ? 'dynamic_ai' : 'scripted_fallback',
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
      sceneBeat: 'opening',
      currentTurn: 1,
      completedTurns: 0,
      requiredTurns: scene.objective.requiredTurns,
      turnsRemaining: scene.objective.requiredTurns,
      successfulTurns: session.successfulTurns,
      objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
      relationshipState,
      routeState,
      progressionLoop,
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
  randomizeCharacter = false,
  preferRomance = true,
}) {
  const scene = getSceneSlice({ city, location, lang });
  const linkedGame = gameSessionId ? state.gameSessions.get(gameSessionId) : null;
  const romanceEligible = ROMANCE_LOCATION_IDS.includes(scene.location.locationId);
  const shouldPreferRomance = romanceEligible ? preferRomance !== false : false;
  const requestedCharacterId = randomizeCharacter ? null : characterId;
  const npc = pickCharacter({
    city: scene.city,
    location: scene.location.locationId,
    preferRomance: shouldPreferRomance,
    requestedCharacterId,
  });
  let characterProgress = null;
  if (linkedGame) {
    const seedRp = linkedGame.activeCharacterId === npc.npcId ? linkedGame.progression?.rp || 0 : 0;
    characterProgress = ensureCharacterProgress(linkedGame, npc, { seedRp });
    linkedGame.activeCharacterId = npc.npcId;
    linkedGame.npc = npc;
    state.gameSessions.set(linkedGame.sessionId, linkedGame);
  }
  if (!characterProgress) {
    characterProgress = createCharacterProgressSeed(npc, 0);
  }
  const baseProgression = linkedGame?.progression ? { ...linkedGame.progression } : { xp: 0, sp: 0, rp: 0 };
  const masteryTier = linkedGame?.masteryTier || linkedGame?.progression?.currentMasteryLevel || 1;
  const learnReadiness =
    typeof linkedGame?.learnReadiness === 'number'
      ? linkedGame.learnReadiness
      : deriveLearnReadiness(linkedGame?.profile, scene.lang);
  const validatedHangouts = linkedGame?.validatedHangouts || 0;
  const missionGateStatus = linkedGame?.missionGateStatus || 'locked';
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
    baseProgression,
    characterBaseRp: characterProgress.rp || 0,
    routeValidatedHangouts: characterProgress.validatedHangouts || 0,
    memoryNotes: [...(characterProgress.memoryNotes || [])].slice(-ROUTE_MEMORY_LIMIT),
    recentEvents: [...(characterProgress.recentEvents || [])].slice(-ROUTE_HISTORY_LIMIT),
    sceneBeat: 'opening',
    turn: 1,
    score: { xp: 0, sp: 0, rp: 0 },
    objectiveProgress: 0,
    successfulTurns: 0,
    npcMood: npc.baselineMood,
    masteryTier,
    learnReadiness,
    validatedHangouts,
    missionGateStatus,
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
  gameSession.activeCharacterId = hangoutSession.npc?.npcId || gameSession.activeCharacterId;
  gameSession.learnReadiness = Number(clampNumber((gameSession.learnReadiness || 0) + 0.04, 0, 1).toFixed(2));

  if (hangoutSession.npc?.npcId) {
    const route = ensureCharacterProgress(gameSession, hangoutSession.npc, { seedRp: 0 });
    route.rp = Math.max(0, (route.rp || 0) + completionSummary.scoreDelta.rp);
    if (completionSummary.completionSignal === 'objective_validated') {
      route.validatedHangouts = (route.validatedHangouts || 0) + 1;
    }
    route.totalScenes = (route.totalScenes || 0) + 1;
    route.totalTurns = (route.totalTurns || 0) + (hangoutSession.transcript?.length || 0);
    route.lastMood = hangoutSession.npcMood || route.lastMood;
    route.lastSeenAt = new Date().toISOString();
    route.memoryNotes = mergeRouteMemoryNotes(route.memoryNotes, hangoutSession.memoryNotes || []);
    route.recentEvents = [...(route.recentEvents || []), ...(hangoutSession.recentEvents || [])].slice(
      -ROUTE_HISTORY_LIMIT,
    );
    gameSession.characterProgress[hangoutSession.npc.npcId] = route;
  }

  if (completionSummary.completionSignal === 'objective_validated') {
    gameSession.validatedHangouts = (gameSession.validatedHangouts || 0) + 1;
  }
  if (gameSession.missionGateStatus === 'passed') {
    // keep passed until a new mastery tier reset path is introduced
  } else if ((gameSession.validatedHangouts || 0) >= REQUIRED_VALIDATED_HANGOUTS_FOR_MISSION) {
    gameSession.missionGateStatus = 'ready';
  } else if (!gameSession.missionGateStatus) {
    gameSession.missionGateStatus = 'locked';
  }

  gameSession.masteryTier = gameSession.masteryTier || gameSession.progression.currentMasteryLevel || 1;
  gameSession.progression.currentMasteryLevel = gameSession.masteryTier;
  gameSession.lastHangoutSummary = completionSummary;
  state.gameSessions.set(gameSession.sessionId, gameSession);
}

function assessMissionForGameSession(session, scene) {
  const gate = buildMissionGateState(session);
  if (gate.status !== 'ready') {
    return {
      ok: false,
      status: 'locked',
      message: 'Mission gate is locked. Validate more hangouts first.',
      progressionLoop: buildProgressLoopState(session),
    };
  }

  const readinessWeight = session.learnReadiness || 0;
  const validationWeight = Math.min(1, (session.validatedHangouts || 0) / REQUIRED_VALIDATED_HANGOUTS_FOR_MISSION);
  const relationshipWeight = Math.min(1, (session.progression?.rp || 0) / 40);
  const missionScore = Number((readinessWeight * 0.4 + validationWeight * 0.35 + relationshipWeight * 0.25).toFixed(2));
  const passed = missionScore >= 0.72;
  const rewards = passed ? { xp: 18, sp: 6, rp: 3 } : { xp: 4, sp: 1, rp: 0 };
  session.progression.xp += rewards.xp;
  session.progression.sp += rewards.sp;
  session.progression.rp += rewards.rp;

  if (passed) {
    session.missionGateStatus = 'passed';
    session.masteryTier = (session.masteryTier || 1) + 1;
    session.progression.currentMasteryLevel = session.masteryTier;
    session.validatedHangouts = 0;
    session.learnReadiness = Number(clampNumber(session.learnReadiness + 0.08, 0, 1).toFixed(2));
  } else {
    session.missionGateStatus = 'ready';
  }

  state.gameSessions.set(session.sessionId, session);

  return {
    ok: true,
    status: passed ? 'passed' : 'retry',
    missionScore,
    message: passed
      ? `${scene.cityLabel} ${scene.location.label} mission passed. Mastery tier increased.`
      : `${scene.cityLabel} mission not passed yet. Run another validated hangout and retry.`,
    rewards,
    progressionLoop: buildProgressLoopState(session),
    relationshipState: buildRelationshipState(
      getCharacterProgress(session, session.activeCharacterId || session.npc?.npcId)?.rp ?? session.progression?.rp ?? 0,
    ),
    routeState: buildRouteState(session.npc, getCharacterProgress(session, session.activeCharacterId || session.npc?.npcId)),
    unlockPreview: {
      nextMasteryTier: session.masteryTier,
      nextLocationOptions: buildUnlockPreview(scene, passed).nextLocationOptions,
      videoCallRewardEligible: passed && scene.city === 'shanghai' && scene.lang === 'zh',
      memoryCardRewardEligible: passed,
    },
  };
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

function normalizeEvaluationTier(value, fallback = 'partial') {
  if (value === 'success' || value === 'partial' || value === 'miss') return value;
  return fallback;
}

function parseAiScoreDelta(candidate, fallback) {
  return {
    xp: Math.round(clampNumber(Number(candidate?.xp), 1, 20)) || fallback.xp,
    sp: Math.round(clampNumber(Number(candidate?.sp), 0, 6)) || fallback.sp,
    rp: Math.round(clampNumber(Number(candidate?.rp), 0, 4)) || fallback.rp,
  };
}

async function generateAiHangoutDecision({
  scene,
  existing,
  userUtterance,
  fallbackEvaluation,
  turnScript,
}) {
  if (!shouldUseAiHangout()) return null;

  const transcriptWindow = [...(existing.transcript || [])].slice(-4).map((item) => ({
    stepId: item.stepId,
    tier: item.tier,
    userUtterance: item.userUtterance,
    matchedTags: item.matchedTags,
    missingTags: item.missingTags,
  }));
  const routeState = buildRouteState(existing.npc, {
    npcId: existing.npc?.npcId,
    name: existing.npc?.name,
    rp: (existing.characterBaseRp || 0) + (existing.score?.rp || 0),
    validatedHangouts: existing.routeValidatedHangouts || 0,
    totalScenes: 1,
    totalTurns: existing.transcript?.length || 0,
    lastMood: existing.npcMood,
    memoryNotes: [...(existing.memoryNotes || [])],
    recentEvents: [...(existing.recentEvents || [])],
    lastSeenAt: null,
  });
  const linkedGameSession =
    existing.gameSessionId && state.gameSessions.has(existing.gameSessionId)
      ? state.gameSessions.get(existing.gameSessionId)
      : null;
  const effectiveProfile = linkedGameSession?.profile || state.profiles.get(existing.userId) || null;
  const targetProficiency = resolveTargetProficiency(effectiveProfile, scene.lang);
  const languageBlendGuidance = buildLanguageBlendGuidance(
    effectiveProfile?.nativeLanguage || 'en',
    targetProficiency,
    routeState.stage || 'stranger',
  );

  const model = process.env.TONG_OPENAI_MODEL || 'gpt-5.2';
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
            'You run a first-person language learning hangout. Keep continuity with prior turns. Return JSON only with: tier, objectiveProgressDelta, scoreDelta, nextLine, tongHint, suggestedReplies, mood, matchedTags, missingTags, sceneBeat, memoryNote. Never output narrator text or markdown. Keep the dialogue immersive and in-scene only. nextLine must be only what the NPC says aloud, no stage directions and no third-person description. Never use labels like "Micro-goal", "Tong:", "Tip:", "Hint:", or objective percentage/meta copy in nextLine or tongHint. Never output template placeholders like "___", "N + ...", or bracketed blanks. ' +
            languageBlendGuidance,
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
            sceneBeat: existing.sceneBeat || deriveSceneBeat(existing, scene),
            objectiveProgress: Number((existing.objectiveProgress || 0).toFixed(2)),
            successfulTurns: existing.successfulTurns || 0,
            routeState,
            profile: effectiveProfile,
            targetProficiency,
            languageBlendGuidance,
            priorMemoryNotes: [...(existing.memoryNotes || [])].slice(-5),
            transcriptWindow,
            userUtterance,
            rubricTierFallback: fallbackEvaluation.tier,
            matchedTagsFallback: fallbackEvaluation.matchedTags,
            missingTagsFallback: fallbackEvaluation.missingTags,
            scriptedPrompt: turnScript.prompts,
            scriptedHints: turnScript.tongHints,
            scriptedReplies: turnScript.quickReplies,
            guidance:
              'Evaluate objective progress and keep scene continuity. suggestedReplies must be 3-5 short learner lines in target language. memoryNote should be one short persistent route memory item if relevant. Keep tongHint concise and practical, no labels/prefixes. nextLine is spoken dialogue only.',
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

  const tier = normalizeEvaluationTier(parsed.tier, fallbackEvaluation.tier);
  const baseRewards = turnScript.rewards[tier] || fallbackEvaluation.rewards;
  const scoreDelta = parseAiScoreDelta(parsed.scoreDelta, baseRewards);
  const objectiveProgressDelta = Number(
    clampNumber(Number(parsed.objectiveProgressDelta), 0.05, 0.5).toFixed(2),
  );
  const suggestedReplies = Array.isArray(parsed.suggestedReplies)
    ? parsed.suggestedReplies.map((value) => sanitizeSuggestedReply(String(value || ''))).filter(Boolean).slice(0, 6)
    : turnScript.quickReplies.slice(0, 6);
  const matchedTags = Array.isArray(parsed.matchedTags)
    ? parsed.matchedTags.map((value) => String(value || '').trim()).filter(Boolean)
    : fallbackEvaluation.matchedTags;
  const missingTags = Array.isArray(parsed.missingTags)
    ? parsed.missingTags.map((value) => String(value || '').trim()).filter(Boolean)
    : fallbackEvaluation.missingTags;
  const sceneBeat = normalizeSceneBeat(parsed.sceneBeat, deriveSceneBeat(existing, scene));
  const memoryNote = sanitizeRouteMemoryNote(parsed.memoryNote);

  return {
    tier,
    matchedTags,
    missingTags,
    rewards: {
      xp: scoreDelta.xp,
      sp: scoreDelta.sp,
      rp: scoreDelta.rp,
      objectiveProgress: objectiveProgressDelta,
    },
    tongHint: sanitizeHintText(parsed.tongHint, turnScript.tongHints[tier]),
    nextLine: sanitizeSpokenLine(parsed.nextLine, turnScript.prompts[tier]),
    suggestedReplies: suggestedReplies.length ? suggestedReplies : turnScript.quickReplies.slice(0, 6),
    mood:
      typeof parsed.mood === 'string' && parsed.mood.trim()
        ? parsed.mood.trim()
        : turnScript.moodByTier[tier] || fallbackEvaluation.mood,
    sceneBeat,
    memoryNote,
  };
}

async function generateAiHangoutOpening({ scene, session, profile, routeState }) {
  if (!shouldUseAiHangout()) return null;

  const targetProficiency = resolveTargetProficiency(profile, scene.lang);
  const languageBlendGuidance = buildLanguageBlendGuidance(
    profile?.nativeLanguage || 'en',
    targetProficiency,
    routeState?.stage || 'stranger',
  );
  const model = process.env.TONG_OPENAI_MODEL || 'gpt-5.2';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Generate the opening beat for a first-person language-learning hangout scene. Return JSON only with: openingLine, tongHint, quickReplies, mood. quickReplies must be 3-6 short learner lines in the target language. openingLine must be only what the NPC says aloud, with no stage directions or third-person narration. No markdown, no narration labels, and no labels like "Micro-goal", "Tong:", or "Hint:". Never output placeholders like "___", "N + ...", or bracketed blanks in openingLine or quickReplies. ' +
            languageBlendGuidance,
        },
        {
          role: 'user',
          content: JSON.stringify({
            city: scene.city,
            cityLabel: scene.cityLabel,
            location: scene.location.label,
            language: scene.lang,
            objective: scene.objective,
            npc: session.npc || scene.npc,
            profile,
            targetProficiency,
            routeState,
            memoryNotes: [...(session.memoryNotes || [])].slice(-4),
            scriptedOpening: buildHangoutOpeningLine(scene, session),
            scriptedHint: scene.tongStartHint,
            scriptedReplies: getQuickRepliesForTurn(scene, 1),
            guidance:
              'Open naturally and set one practical action for this turn in plain natural language. Do not prefix with labels. Keep replies practical for ordering food in this location. openingLine is spoken dialogue only.',
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`openai_opening_failed_${response.status}`);
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || '';
  const parsed = parseJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  const openingLine = sanitizeSpokenLine(parsed.openingLine, buildHangoutOpeningLine(scene, session));
  const tongHint = sanitizeHintText(parsed.tongHint, scene.tongStartHint);
  const quickReplies = Array.isArray(parsed.quickReplies)
    ? parsed.quickReplies.map((value) => sanitizeSuggestedReply(String(value || ''))).filter(Boolean).slice(0, 6)
    : [];
  const mood = typeof parsed.mood === 'string' && parsed.mood.trim() ? parsed.mood.trim() : null;

  return {
    openingLine,
    tongHint,
    quickReplies: quickReplies.length >= 3 ? quickReplies : getQuickRepliesForTurn(scene, session.turn),
    mood,
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
    const relationshipState = buildRelationshipState((existing.characterBaseRp || 0) + existing.score.rp);
    const routeState = buildRouteState(existing.npc, {
      npcId: existing.npc?.npcId,
      name: existing.npc?.name,
      rp: (existing.characterBaseRp || 0) + existing.score.rp,
      validatedHangouts: existing.routeValidatedHangouts || 0,
      totalScenes: 1,
      totalTurns: existing.transcript?.length || 0,
      lastMood: existing.npcMood,
      memoryNotes: [...(existing.memoryNotes || [])],
      recentEvents: [...(existing.recentEvents || [])],
      lastSeenAt: null,
    });
    const progressionLoop = buildProgressLoopState(existing);
    return {
      statusCode: 200,
      payload: {
        accepted: true,
        engineMode: shouldUseAiHangout() ? 'dynamic_ai' : 'scripted_fallback',
        feedback: {
          tongHint: 'This hangout is already complete. Start a new scene to replay.',
          objectiveProgressDelta: 0,
          objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
          relationshipState,
          routeState,
          suggestedReplies: [],
        },
        nextLine: {
          speaker: 'tong',
          text: '이 장면은 이미 완료됐어. 새 세션으로 이어서 연습하자.',
        },
        renderOps: [
          {
            tool: 'tong_whisper',
            text: 'This hangout is already complete. Start a new scene to replay.',
          },
          {
            tool: 'npc_speak',
            text: '이 장면은 이미 완료됐어. 새 세션으로 이어서 연습하자.',
            characterId: existing.npc?.npcId,
            speakerName: existing.npc?.name,
          },
        ],
        state: {
          turn: existing.turn,
          sceneBeat: existing.sceneBeat || deriveSceneBeat(existing, scene),
          score: cloneScore(existing.score),
          objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
          relationshipState,
          routeState,
          progressionLoop,
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
        relationshipState,
        routeState,
        progressionLoop,
      },
    };
  }

  const scriptIndex = Math.min(existing.turn - 1, scene.turnScript.length - 1);
  const turnScript = scene.turnScript[scriptIndex];
  const ruleEvaluation = evaluateTurn(userUtterance, scene, turnScript);
  let evaluation = ruleEvaluation;

  if (shouldUseAiHangout()) {
    try {
      const aiDecision = await generateAiHangoutDecision({
        scene,
        existing,
        userUtterance,
        fallbackEvaluation: ruleEvaluation,
        turnScript,
      });
      if (aiDecision) {
        evaluation = aiDecision;
      }
    } catch (error) {
      console.warn('ai_turn_decision_failed', error instanceof Error ? error.message : 'unknown');
    }
  }

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
  existing.sceneBeat = normalizeSceneBeat(evaluation.sceneBeat, deriveSceneBeat(existing, scene));
  existing.transcript.push({
    stepId: turnScript.stepId,
    userUtterance,
    tier: evaluation.tier,
    matchedTags: evaluation.matchedTags,
    missingTags: evaluation.missingTags,
  });
  const memoryNote =
    sanitizeRouteMemoryNote(evaluation.memoryNote) ||
    sanitizeRouteMemoryNote(buildFallbackMemoryNote(turnScript, evaluation.tier, userUtterance));
  if (memoryNote) {
    existing.memoryNotes = mergeRouteMemoryNotes(existing.memoryNotes, [memoryNote]);
  }
  existing.recentEvents = [
    ...(existing.recentEvents || []),
    buildRouteEvent({
      scene,
      turnScript,
      tier: evaluation.tier,
      xpDelta,
      spDelta,
      rpDelta,
      objectiveProgressDelta,
    }),
  ].slice(-ROUTE_HISTORY_LIMIT);

  const completedTurns = Math.min(existing.turn - 1, scene.objective.requiredTurns);
  existing.completed = completedTurns >= scene.objective.requiredTurns;
  const passed = objectivePassed(scene, existing);

  const completionSummary = buildCompletionSummary(scene, existing);
  if (completionSummary) {
    updateGameSessionFromHangout(existing, completionSummary);
  }

  const linkedGameSession = existing.gameSessionId ? state.gameSessions.get(existing.gameSessionId) : null;
  if (linkedGameSession) {
    existing.validatedHangouts = linkedGameSession.validatedHangouts || existing.validatedHangouts;
    existing.missionGateStatus = linkedGameSession.missionGateStatus || existing.missionGateStatus;
    existing.masteryTier = linkedGameSession.masteryTier || existing.masteryTier;
    existing.learnReadiness = linkedGameSession.learnReadiness ?? existing.learnReadiness;
    const linkedRoute = getCharacterProgress(linkedGameSession, existing.npc?.npcId);
    if (linkedRoute) {
      existing.routeValidatedHangouts = linkedRoute.validatedHangouts || existing.routeValidatedHangouts;
    }
  }
  const finalCompletionSummary = existing.completed ? buildCompletionSummary(scene, existing) : completionSummary;

  const nextLineText = existing.completed
    ? passed
      ? scene.completion.passedLine
      : scene.completion.retryLine
    : evaluation.nextLine;
  const tongHint = existing.completed
    ? passed
      ? scene.completion.tongWrapUpPass
      : scene.completion.tongWrapUpRetry
    : evaluation.tongHint;
  const suggestedReplies = existing.completed
    ? []
    : evaluation.suggestedReplies && evaluation.suggestedReplies.length
      ? evaluation.suggestedReplies
      : getQuickRepliesForTurn(scene, existing.turn);
  const relationshipState = buildRelationshipState((existing.characterBaseRp || 0) + existing.score.rp);
  const routeState = buildRouteState(existing.npc, {
    npcId: existing.npc?.npcId,
    name: existing.npc?.name,
    rp: (existing.characterBaseRp || 0) + existing.score.rp,
    validatedHangouts: existing.routeValidatedHangouts || 0,
    totalScenes: 1,
    totalTurns: existing.transcript?.length || 0,
    lastMood: existing.npcMood,
    memoryNotes: [...(existing.memoryNotes || [])],
    recentEvents: [...(existing.recentEvents || [])],
    lastSeenAt: null,
  });
  const progressionLoop = buildProgressLoopState(existing);

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
    engineMode: shouldUseAiHangout() ? 'dynamic_ai' : 'scripted_fallback',
    feedback: {
      tongHint,
      objectiveProgressDelta,
      objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
      relationshipState,
      routeState,
      progressionLoop,
      suggestedReplies,
    },
    nextLine: {
      speaker: 'character',
      text: nextLineText,
    },
    renderOps: [
      {
        tool: 'npc_speak',
        text: nextLineText,
        characterId: existing.npc?.npcId,
        speakerName: existing.npc?.name,
      },
      {
        tool: 'tong_whisper',
        text: tongHint,
      },
      ...(suggestedReplies.length
        ? [
            {
              tool: 'offer_choices',
              choices: suggestedReplies,
            },
          ]
        : []),
    ],
    state: {
      turn: existing.turn,
      sceneBeat: existing.sceneBeat || deriveSceneBeat(existing, scene),
      score: cloneScore(existing.score),
      objectiveProgress: buildObjectiveProgressState(scene, existing.objectiveProgress),
      relationshipState,
      routeState,
      progressionLoop,
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
    completionSummary: finalCompletionSummary,
    relationshipState,
    routeState,
    progressionLoop,
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
      normalizeLegacyRomanceIdentity(session);
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
            location: requestedLocation,
            preferRomance: body.preferRomance !== false,
            requestedCharacterId: body.characterId,
          });
          session.npcMood = session.npc.baselineMood;
        }
        session.activeCharacterId = session.npc?.npcId || session.activeCharacterId;
        ensureCharacterProgress(session, session.npc, {
          seedRp: session.characterProgress?.[session.npc?.npcId]?.rp ?? (session.progression?.rp || 0),
        });
        session.masteryTier = session.masteryTier || session.progression?.currentMasteryLevel || 1;
        session.progression.currentMasteryLevel = session.masteryTier;
        session.learnReadiness = deriveLearnReadiness(session.profile, requestedLang);
        session.validatedHangouts = session.validatedHangouts || 0;
        session.missionGateStatus = session.missionGateStatus || 'locked';
        if (session.missionGateStatus !== 'passed') {
          session.missionGateStatus =
            session.validatedHangouts >= REQUIRED_VALIDATED_HANGOUTS_FOR_MISSION ? 'ready' : 'locked';
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
      normalizeLegacyRomanceIdentity(gameSession);
      const requestedCity = normalizeCity(body.city, gameSession?.city || 'seoul');
      const requestedLocation = normalizeLocation(body.location, gameSession?.location || 'food_street');
      const requestedLang = normalizeLang(body.lang, gameSession?.lang || CITY_BASE[requestedCity].defaultLang);
      const randomizeCharacter = Boolean(body.randomizeCharacter);
      const requestedCharacterId =
        body.characterId ||
        (randomizeCharacter
          ? null
          : ROMANCE_LOCATION_IDS.includes(requestedLocation)
            ? gameSession?.activeCharacterId || gameSession?.npc?.npcId
            : null);
      const preferRomance = body.preferRomance !== false;
      const session = createHangoutSession({
        userId,
        gameSessionId,
        city: requestedCity,
        location: requestedLocation,
        lang: requestedLang,
        characterId: requestedCharacterId,
        randomizeCharacter,
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
      const relationshipState = buildRelationshipState((session.characterBaseRp || 0) + session.score.rp);
      const routeState = buildRouteState(session.npc, {
        npcId: session.npc?.npcId,
        name: session.npc?.name,
        rp: (session.characterBaseRp || 0) + session.score.rp,
        validatedHangouts: session.routeValidatedHangouts || 0,
        totalScenes: 1,
        totalTurns: session.transcript?.length || 0,
        lastMood: session.npcMood,
        memoryNotes: [...(session.memoryNotes || [])],
        recentEvents: [...(session.recentEvents || [])],
        lastSeenAt: null,
      });
      const progressionLoop = buildProgressLoopState(session);
      const profileForOpening = gameSession?.profile || state.profiles.get(userId) || null;
      let openingLine = buildHangoutOpeningLine(scene, session);
      let openingHint = scene.tongStartHint;
      let openingQuickReplies = getQuickRepliesForTurn(scene, session.turn);

      if (shouldUseAiHangout()) {
        try {
          const aiOpening = await generateAiHangoutOpening({
            scene,
            session,
            profile: profileForOpening,
            routeState,
          });
          if (aiOpening) {
            openingLine = aiOpening.openingLine || openingLine;
            openingHint = aiOpening.tongHint || openingHint;
            openingQuickReplies = aiOpening.quickReplies?.length ? aiOpening.quickReplies : openingQuickReplies;
            if (aiOpening.mood) {
              session.npcMood = aiOpening.mood;
              state.sessions.set(session.sceneSessionId, session);
            }
          }
        } catch (error) {
          console.warn('ai_opening_generation_failed', error instanceof Error ? error.message : 'unknown');
        }
      }

      jsonResponse(res, 200, {
        sceneSessionId: session.sceneSessionId,
        mode: 'hangout',
        engineMode: shouldUseAiHangout() ? 'dynamic_ai' : 'scripted_fallback',
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
          sceneBeat: session.sceneBeat || 'opening',
          score: cloneScore(session.score),
          objectiveProgress: buildObjectiveProgressState(scene, session.objectiveProgress),
          relationshipState,
          routeState,
          progressionLoop,
        },
        initialLine: {
          speaker: 'character',
          text: openingLine,
        },
        renderOps: [
          {
            tool: 'npc_speak',
            text: openingLine,
            characterId: session.npc?.npcId,
            speakerName: session.npc?.name,
          },
          {
            tool: 'tong_whisper',
            text: openingHint,
          },
          {
            tool: 'offer_choices',
            choices: openingQuickReplies,
          },
        ],
        initialLines: [
          {
            speaker: 'character',
            text: openingLine,
          },
          {
            speaker: 'tong',
            text: openingHint,
          },
        ],
        locationMeta: buildLocationMeta(scene),
        currentObjective: buildCurrentObjective(scene, session.objectiveProgress, session.successfulTurns),
        npc: buildNpcState(scene, session.npcMood, session.npc),
        character: buildCharacterPayload(scene, session.npcMood, session.npc),
        tongHint: openingHint,
        quickReplies: openingQuickReplies,
        turnState: buildTurnState(scene, session),
        objectiveProgress: buildObjectiveProgressState(scene, session.objectiveProgress),
        relationshipState,
        routeState,
        progressionLoop,
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

    if (pathname === '/api/v1/missions/assess' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || 'demo-user-1';
      const sessionId = body.gameSessionId || body.sessionId || state.gameSessionByUser.get(userId);
      const gameSession = state.gameSessions.get(sessionId);
      if (!gameSession) {
        jsonResponse(res, 404, { error: 'unknown_game_session' });
        return;
      }

      const scene = getSceneSlice({
        city: body.city || gameSession.city,
        location: body.location || gameSession.location,
        lang: body.lang || gameSession.lang,
      });
      const result = assessMissionForGameSession(gameSession, scene);
      jsonResponse(res, 200, {
        missionId: `${scene.city}_${scene.location.locationId}_assessment`,
        city: scene.city,
        location: scene.location.locationId,
        lang: scene.lang,
        ...result,
      });
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

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

const SEOUL_FOOD_STREET_SLICE = {
  city: 'seoul',
  cityLabel: 'Seoul',
  sceneId: 'food_street_hangout_intro',
  location: {
    locationId: 'food_street',
    label: 'Food Street',
    district: 'Hongdae',
    landmark: 'Gyeongui Line lane',
    vibeTags: ['street-food', 'night-market', 'casual'],
  },
  objective: {
    objectiveId: 'ko_food_l2_001',
    label: 'Place a complete Korean street-food order',
    summary: 'Choose dish, set spice level, and close politely.',
    mode: 'hangout',
    requiredTurns: 3,
    requiredSuccessfulTurns: 2,
    requiredProgressForPass: 0.75,
    targets: {
      vocabulary: ['떡볶이', '메뉴', '주문', '맵기'],
      grammar: ['-주세요', '-고 싶어요'],
      sentenceStructures: ['N + 주세요', '맵기 + degree 표현'],
    },
  },
  npc: {
    npcId: 'npc_mina_park',
    name: 'Mina Park',
    role: 'Street-food local friend',
    baselineMood: 'playful',
  },
  turnScript: [
    {
      stepId: 'pick_menu',
      requiredTags: ['food', 'polite'],
      quickReplies: ['떡볶이 주세요.', '김밥 주세요.', '라면 하나 주세요.'],
      prompts: {
        start: '나 미나야! 여기 떡볶이가 유명해. 먹고 싶은 메뉴를 한국어로 말해줘.',
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
    tongWrapUpPass: 'Objective validated. Seoul mission gate is now previewed.',
    tongWrapUpRetry: 'Scene complete. Another validated hangout will unlock the mission gate.',
    unlockPreview: {
      missionGate: 'seoul_food_mission_assessment',
      nextMasteryTier: 2,
      nextLocationOptions: ['cafe', 'convenience_store'],
      learnModeObjective: 'ko_food_l2_002',
    },
  },
};

const UTTERANCE_TAG_PATTERNS = {
  food: ['떡볶이', '김밥', '라면', '순대', '어묵', '메뉴', '주문'],
  polite: ['주세요', '부탁', '싶어요', '할게요', '주실', '주세'],
  spice: ['맵', '안 맵', '안맵', '덜 맵', '덜맵', '보통맛', '순한맛', '매운맛', '중간'],
  confirm: ['하나', '한 개', '한개', '두 개', '두개', '둘', '셋', '세 개', '세개', '감사'],
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

function buildLocationMeta() {
  return {
    city: SEOUL_FOOD_STREET_SLICE.city,
    cityLabel: SEOUL_FOOD_STREET_SLICE.cityLabel,
    sceneId: SEOUL_FOOD_STREET_SLICE.sceneId,
    locationId: SEOUL_FOOD_STREET_SLICE.location.locationId,
    locationLabel: SEOUL_FOOD_STREET_SLICE.location.label,
    district: SEOUL_FOOD_STREET_SLICE.location.district,
    landmark: SEOUL_FOOD_STREET_SLICE.location.landmark,
    vibeTags: [...SEOUL_FOOD_STREET_SLICE.location.vibeTags],
  };
}

function buildCurrentObjective(progress = 0, successfulTurns = 0) {
  return {
    objectiveId: SEOUL_FOOD_STREET_SLICE.objective.objectiveId,
    mode: SEOUL_FOOD_STREET_SLICE.objective.mode,
    label: SEOUL_FOOD_STREET_SLICE.objective.label,
    summary: SEOUL_FOOD_STREET_SLICE.objective.summary,
    targets: {
      vocabulary: [...SEOUL_FOOD_STREET_SLICE.objective.targets.vocabulary],
      grammar: [...SEOUL_FOOD_STREET_SLICE.objective.targets.grammar],
      sentenceStructures: [...SEOUL_FOOD_STREET_SLICE.objective.targets.sentenceStructures],
    },
    completionCriteria: {
      requiredTurns: SEOUL_FOOD_STREET_SLICE.objective.requiredTurns,
      requiredSuccessfulTurns: SEOUL_FOOD_STREET_SLICE.objective.requiredSuccessfulTurns,
      requiredProgressForPass: SEOUL_FOOD_STREET_SLICE.objective.requiredProgressForPass,
    },
    progress: Number(progress.toFixed(2)),
    successfulTurns,
  };
}

function buildNpcState(mood) {
  return {
    npcId: SEOUL_FOOD_STREET_SLICE.npc.npcId,
    name: SEOUL_FOOD_STREET_SLICE.npc.name,
    role: SEOUL_FOOD_STREET_SLICE.npc.role,
    mood: mood || SEOUL_FOOD_STREET_SLICE.npc.baselineMood,
  };
}

function buildCharacterPayload(mood) {
  return {
    id: SEOUL_FOOD_STREET_SLICE.npc.npcId,
    name: SEOUL_FOOD_STREET_SLICE.npc.name,
    role: SEOUL_FOOD_STREET_SLICE.npc.role,
    mood: mood || SEOUL_FOOD_STREET_SLICE.npc.baselineMood,
  };
}

function buildObjectiveProgressState(progress) {
  const clamped = Number(Math.max(0, Math.min(1, progress)).toFixed(2));
  return {
    current: Math.round(clamped * 100),
    target: 100,
    percent: clamped,
    label: 'Food-order objective',
  };
}

function buildTurnState(session, lastTurn = null) {
  const completedTurns = Math.min(
    session.turn - 1,
    SEOUL_FOOD_STREET_SLICE.objective.requiredTurns,
  );
  return {
    currentTurn: session.turn,
    completedTurns,
    requiredTurns: SEOUL_FOOD_STREET_SLICE.objective.requiredTurns,
    turnsRemaining: Math.max(
      0,
      SEOUL_FOOD_STREET_SLICE.objective.requiredTurns - completedTurns,
    ),
    successfulTurns: session.successfulTurns,
    objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
    isCompleted: session.completed,
    completionSignal: session.completed ? 'hangout_complete' : null,
    lastTurn,
  };
}

function buildUnlockPreview(unlocked) {
  return {
    ...SEOUL_FOOD_STREET_SLICE.completion.unlockPreview,
    unlocked,
  };
}

function objectivePassed(session) {
  return (
    session.successfulTurns >= SEOUL_FOOD_STREET_SLICE.objective.requiredSuccessfulTurns &&
    session.objectiveProgress >= SEOUL_FOOD_STREET_SLICE.objective.requiredProgressForPass
  );
}

function buildCompletionSummary(session) {
  if (!session.completed) return null;
  const passed = objectivePassed(session);
  return {
    objectiveId: SEOUL_FOOD_STREET_SLICE.objective.objectiveId,
    status: passed ? 'passed' : 'completed_retry_available',
    completionSignal: passed ? 'objective_validated' : 'scene_complete_retry_available',
    turnsTaken: Math.min(session.turn - 1, SEOUL_FOOD_STREET_SLICE.objective.requiredTurns),
    successfulTurns: session.successfulTurns,
    objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
    scoreDelta: cloneScore(session.score),
    unlockPreview: buildUnlockPreview(passed),
  };
}

function extractUtteranceTags(userUtterance) {
  const raw = String(userUtterance || '').toLowerCase();
  const tags = new Set();

  for (const [tag, patterns] of Object.entries(UTTERANCE_TAG_PATTERNS)) {
    if (patterns.some((pattern) => raw.includes(pattern))) tags.add(tag);
  }

  return tags;
}

function evaluateTurn(userUtterance, turnScript) {
  const tags = extractUtteranceTags(userUtterance);
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

function getQuickRepliesForTurn(turnNumber) {
  const scriptIndex = Math.min(
    Math.max(turnNumber - 1, 0),
    SEOUL_FOOD_STREET_SLICE.turnScript.length - 1,
  );
  return [...(SEOUL_FOOD_STREET_SLICE.turnScript[scriptIndex].quickReplies || [])];
}

function createGameSession(userId, profile) {
  const sessionId = nextSessionId('game');
  const session = {
    sessionId,
    userId,
    city: SEOUL_FOOD_STREET_SLICE.city,
    sceneId: SEOUL_FOOD_STREET_SLICE.sceneId,
    profile: profile || FIXTURES.gameStart.profile,
    progression: { ...(FIXTURES.gameStart.progression || { xp: 0, sp: 0, rp: 0 }) },
    objectiveProgress: 0,
    successfulTurns: 0,
    npcMood: SEOUL_FOOD_STREET_SLICE.npc.baselineMood,
    lastHangoutSummary: null,
  };
  state.gameSessions.set(sessionId, session);
  state.gameSessionByUser.set(userId, sessionId);
  return session;
}

function buildGameStartResponse(session, resumed) {
  return {
    ...FIXTURES.gameStart,
    sessionId: session.sessionId,
    city: SEOUL_FOOD_STREET_SLICE.city,
    sceneId: SEOUL_FOOD_STREET_SLICE.sceneId,
    profile: session.profile,
    progression: session.progression,
    resumed,
    tongPrompt: 'tong://seoul/food-street/hangout/v1',
    actions: [
      'Start Seoul Food Street Hangout',
      'Review Food Ordering Learn Session',
      'Open Last-3-Days Vocab Feed',
    ],
    currentObjective: buildCurrentObjective(session.objectiveProgress, session.successfulTurns),
    locationMeta: buildLocationMeta(),
    npc: buildNpcState(session.npcMood),
    turnState: {
      currentTurn: 1,
      completedTurns: 0,
      requiredTurns: SEOUL_FOOD_STREET_SLICE.objective.requiredTurns,
      turnsRemaining: SEOUL_FOOD_STREET_SLICE.objective.requiredTurns,
      successfulTurns: session.successfulTurns,
      objectiveProgress: Number(session.objectiveProgress.toFixed(2)),
      isCompleted: false,
      completionSignal: null,
      lastTurn: null,
    },
    hangoutStartRequestPreview: {
      userId: session.userId,
      city: SEOUL_FOOD_STREET_SLICE.city,
      location: SEOUL_FOOD_STREET_SLICE.location.locationId,
      objectiveId: SEOUL_FOOD_STREET_SLICE.objective.objectiveId,
      gameSessionId: session.sessionId,
    },
    lastHangoutSummary: session.lastHangoutSummary,
  };
}

function createHangoutSession({ userId, gameSessionId }) {
  const sceneSessionId = nextSessionId('hangout');
  const session = {
    sceneSessionId,
    userId,
    gameSessionId,
    turn: 1,
    score: { xp: 0, sp: 0, rp: 0 },
    objectiveProgress: 0,
    successfulTurns: 0,
    npcMood: SEOUL_FOOD_STREET_SLICE.npc.baselineMood,
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
  const lang = query.get('lang') || 'ko';
  if (lang === 'ko' || lang === 'ja' || lang === 'zh') return lang;
  return 'ko';
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

function handleHangoutRespond(body) {
  const sceneSessionId = body.sceneSessionId;
  const userUtterance = String(body.userUtterance || '').trim();
  const existing = state.sessions.get(sceneSessionId);

  if (!existing) {
    return {
      statusCode: 404,
      payload: {
        error: 'unknown_scene_session',
      },
    };
  }

  if (existing.completed) {
    const completionSummary = buildCompletionSummary(existing);
    return {
      statusCode: 200,
      payload: {
        accepted: true,
        feedback: {
          tongHint: 'This hangout is already complete. Start a new scene to replay.',
          objectiveProgressDelta: 0,
          objectiveProgress: buildObjectiveProgressState(existing.objectiveProgress),
          suggestedReplies: [],
        },
        nextLine: {
          speaker: 'tong',
          text: '이 장면은 이미 완료됐어. 새 세션으로 이어서 연습하자.',
        },
        state: {
          turn: existing.turn,
          score: cloneScore(existing.score),
          objectiveProgress: buildObjectiveProgressState(existing.objectiveProgress),
        },
        currentObjective: buildCurrentObjective(existing.objectiveProgress, existing.successfulTurns),
        locationMeta: buildLocationMeta(),
        npc: buildNpcState(existing.npcMood),
        character: buildCharacterPayload(existing.npcMood),
        turnState: buildTurnState(existing, {
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

  const scriptIndex = Math.min(existing.turn - 1, SEOUL_FOOD_STREET_SLICE.turnScript.length - 1);
  const turnScript = SEOUL_FOOD_STREET_SLICE.turnScript[scriptIndex];
  const evaluation = evaluateTurn(userUtterance, turnScript);
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

  const completedTurns = Math.min(existing.turn - 1, SEOUL_FOOD_STREET_SLICE.objective.requiredTurns);
  existing.completed = completedTurns >= SEOUL_FOOD_STREET_SLICE.objective.requiredTurns;
  const passed = objectivePassed(existing);

  const completionSummary = buildCompletionSummary(existing);
  if (completionSummary) {
    updateGameSessionFromHangout(existing, completionSummary);
  }

  const nextLineText = existing.completed
    ? passed
      ? SEOUL_FOOD_STREET_SLICE.completion.passedLine
      : SEOUL_FOOD_STREET_SLICE.completion.retryLine
    : evaluation.nextLine;

  const tongHint = existing.completed
    ? passed
      ? SEOUL_FOOD_STREET_SLICE.completion.tongWrapUpPass
      : SEOUL_FOOD_STREET_SLICE.completion.tongWrapUpRetry
    : evaluation.tongHint;
  const suggestedReplies = existing.completed ? [] : getQuickRepliesForTurn(existing.turn);

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
      objectiveProgress: buildObjectiveProgressState(existing.objectiveProgress),
      suggestedReplies,
    },
    nextLine: {
      speaker: 'character',
      text: nextLineText,
    },
    state: {
      turn: existing.turn,
      score: cloneScore(existing.score),
      objectiveProgress: buildObjectiveProgressState(existing.objectiveProgress),
    },
    currentObjective: buildCurrentObjective(existing.objectiveProgress, existing.successfulTurns),
    locationMeta: buildLocationMeta(),
    npc: buildNpcState(existing.npcMood),
    character: buildCharacterPayload(existing.npcMood),
    turnState: buildTurnState(existing, lastTurn),
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

      if (session) {
        resumed = true;
        if (body.profile) {
          session.profile = body.profile;
          state.gameSessions.set(session.sessionId, session);
        }
      } else {
        session = createGameSession(userId, body.profile);
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
      jsonResponse(res, 200, FIXTURES.objectivesNext);
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
      const session = createHangoutSession({ userId, gameSessionId });

      jsonResponse(res, 200, {
        sceneSessionId: session.sceneSessionId,
        mode: 'hangout',
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
          text: SEOUL_FOOD_STREET_SLICE.turnScript[0].prompts.start,
        },
        initialLines: [
          {
            speaker: 'character',
            text: SEOUL_FOOD_STREET_SLICE.turnScript[0].prompts.start,
          },
          {
            speaker: 'tong',
            text: 'Pick a dish with 주세요 first, then set spice level.',
          },
        ],
        city: SEOUL_FOOD_STREET_SLICE.city,
        sceneId: SEOUL_FOOD_STREET_SLICE.sceneId,
        location: SEOUL_FOOD_STREET_SLICE.location.locationId,
        locationMeta: buildLocationMeta(),
        currentObjective: buildCurrentObjective(session.objectiveProgress, session.successfulTurns),
        npc: buildNpcState(session.npcMood),
        character: buildCharacterPayload(session.npcMood),
        tongHint: 'Use menu + 주세요 first, then set spice level to complete this slice.',
        quickReplies: getQuickRepliesForTurn(session.turn),
        turnState: buildTurnState(session),
        objectiveProgress: buildObjectiveProgressState(session.objectiveProgress),
        objectiveId: SEOUL_FOOD_STREET_SLICE.objective.objectiveId,
        objectiveSummary: SEOUL_FOOD_STREET_SLICE.objective.summary,
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
      const { statusCode, payload } = handleHangoutRespond(body);
      jsonResponse(res, statusCode, payload);
      return;
    }

    if (pathname === '/api/v1/learn/sessions' && req.method === 'GET') {
      const items = [...state.learnSessions].sort((a, b) =>
        b.lastMessageAt.localeCompare(a.lastMessageAt),
      );
      jsonResponse(res, 200, { items });
      return;
    }

    if (pathname === '/api/v1/learn/sessions' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const learnSessionId = `learn_${Math.random().toString(36).slice(2, 8)}`;
      const title = `Food Street ${body.objectiveId || 'Objective'} Drill`;
      const item = {
        learnSessionId,
        title,
        objectiveId: body.objectiveId || 'ko_food_l2_001',
        lastMessageAt: new Date().toISOString(),
      };
      state.learnSessions.unshift(item);

      jsonResponse(res, 200, {
        learnSessionId,
        mode: 'learn',
        uiTheme: 'kakao_like',
        objectiveId: item.objectiveId,
        firstMessage: {
          speaker: 'tong',
          text: "New session started. We'll train 주문 phrases for your next hangout.",
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

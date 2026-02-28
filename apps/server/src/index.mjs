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

const DEFAULT_USER_ID = 'demo-user-1';
const PROFICIENCY_RANK = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  native: 4,
};
const CLUSTER_CITY_MAP = {
  'food-ordering': 'seoul',
  'performance-energy': 'shanghai',
  'city-social': 'tokyo',
  general: 'seoul',
};
const CLUSTER_LOCATION_MAP = {
  'food-ordering': 'food_street',
  'performance-energy': 'practice_studio',
  'city-social': 'subway_hub',
  general: 'food_street',
};
const LANG_TARGETS = {
  ko: {
    grammar: ['-고 싶어요', '-주세요'],
    sentenceStructures: ['N + 주세요', 'N이/가 + adjective'],
  },
  ja: {
    grammar: ['〜たいです', '〜ください'],
    sentenceStructures: ['N を ください', 'N は adjective です'],
  },
  zh: {
    grammar: ['想 + verb', '请 + verb'],
    sentenceStructures: ['请给我 + N', 'N 很 + adjective'],
  },
};
const DEFAULT_OBJECTIVE_BY_LANG = {
  ko: 'ko_food_l2_001',
  ja: 'ko_city_l2_003',
  zh: 'zh_stage_l3_002',
};

const state = {
  profiles: new Map(),
  sessions: new Map(),
  learnSessions: [...(FIXTURES.learnSessions.items || [])],
  ingestionByUser: new Map(),
};

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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getUserIdFromSearch(searchParams) {
  return searchParams.get('userId') || DEFAULT_USER_ID;
}

function normalizeProfile(rawProfile) {
  if (!rawProfile || typeof rawProfile !== 'object') return null;

  const profile = rawProfile.profile && typeof rawProfile.profile === 'object'
    ? rawProfile.profile
    : rawProfile;

  const targetLanguages = Array.isArray(profile.targetLanguages)
    ? profile.targetLanguages.filter((lang) => lang === 'ko' || lang === 'ja' || lang === 'zh')
    : [];

  return {
    nativeLanguage: profile.nativeLanguage || 'en',
    targetLanguages: targetLanguages.length > 0 ? targetLanguages : ['ko', 'ja', 'zh'],
    proficiency: {
      ko: profile?.proficiency?.ko || 'none',
      ja: profile?.proficiency?.ja || 'none',
      zh: profile?.proficiency?.zh || 'none',
    },
  };
}

function upsertProfile(userId, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  if (!profile) return null;
  state.profiles.set(userId, profile);
  state.ingestionByUser.delete(userId);
  return profile;
}

function getProfile(userId) {
  return state.profiles.get(userId) || null;
}

function getWeakestTargetLanguage(profile) {
  if (!profile || !Array.isArray(profile.targetLanguages) || profile.targetLanguages.length === 0) {
    return 'ko';
  }

  return [...profile.targetLanguages].sort((a, b) => {
    const rankA = PROFICIENCY_RANK[profile?.proficiency?.[a] || 'none'] ?? 0;
    const rankB = PROFICIENCY_RANK[profile?.proficiency?.[b] || 'none'] ?? 0;
    return rankA - rankB;
  })[0];
}

function loadDefaultGeneratedIngestion() {
  const frequency = loadGeneratedSnapshot('frequency');
  const insights = loadGeneratedSnapshot('insights');
  const mediaProfile = loadGeneratedSnapshot('media-profile');
  if (!frequency || !insights || !mediaProfile) return null;

  return {
    generatedAtIso: mediaProfile.generatedAtIso || new Date().toISOString(),
    frequency,
    insights,
    mediaProfile: {
      ...mediaProfile,
      userId: mediaProfile.userId || DEFAULT_USER_ID,
      learningSignals: mediaProfile.learningSignals || FIXTURES.mediaProfile.learningSignals,
    },
  };
}

function runIngestionForUser(userId = DEFAULT_USER_ID) {
  const snapshot = JSON.parse(fs.readFileSync(mockMediaWindowPath, 'utf8'));
  const result = runMockIngestion(snapshot, {
    userId,
    profile: getProfile(userId),
  });

  if (userId === DEFAULT_USER_ID) {
    writeGeneratedSnapshots(result);
  }

  state.ingestionByUser.set(userId, result);
  return result;
}

function ensureIngestionForUser(userId = DEFAULT_USER_ID) {
  const existing = state.ingestionByUser.get(userId);
  if (existing) return existing;

  if (userId === DEFAULT_USER_ID && !getProfile(userId)) {
    const generated = loadDefaultGeneratedIngestion();
    if (generated) {
      state.ingestionByUser.set(userId, generated);
      return generated;
    }
  }

  return runIngestionForUser(userId);
}

function getDominantClusterId(ingestion) {
  return (
    ingestion?.mediaProfile?.learningSignals?.clusterAffinities?.[0]?.clusterId ||
    ingestion?.insights?.clusters?.[0]?.clusterId ||
    'food-ordering'
  );
}

function objectiveMatchesLanguage(objectiveId, lang) {
  return typeof objectiveId === 'string' && objectiveId.startsWith(`${lang}_`);
}

function buildPersonalizedObjective({ userId, mode = 'hangout', lang = 'ko' }) {
  const ingestion = ensureIngestionForUser(userId);
  const baseObjective = cloneJson(FIXTURES.objectivesNext);
  const dominantClusterId = getDominantClusterId(ingestion);
  const dominantCluster =
    ingestion?.insights?.clusters?.find((cluster) => cluster.clusterId === dominantClusterId) ||
    ingestion?.insights?.clusters?.[0];

  const insightItems = Array.isArray(ingestion?.insights?.items) ? ingestion.insights.items : [];
  const langItems = insightItems.filter((item) => item.lang === lang);
  const scopedItems = langItems.length > 0 ? langItems : insightItems;
  const scopedClusterItems = dominantCluster
    ? scopedItems.filter((item) => item.clusterId === dominantCluster.clusterId)
    : scopedItems;

  let objectiveId =
    scopedClusterItems[0]?.objectiveLinks?.[0]?.objectiveId ||
    scopedItems[0]?.objectiveLinks?.[0]?.objectiveId ||
    baseObjective.objectiveId ||
    DEFAULT_OBJECTIVE_BY_LANG[lang];

  if (!objectiveMatchesLanguage(objectiveId, lang)) {
    const languageAlignedObjective =
      scopedItems.find((item) => objectiveMatchesLanguage(item?.objectiveLinks?.[0]?.objectiveId, lang))
        ?.objectiveLinks?.[0]?.objectiveId ||
      insightItems.find((item) => objectiveMatchesLanguage(item?.objectiveLinks?.[0]?.objectiveId, lang))
        ?.objectiveLinks?.[0]?.objectiveId ||
      DEFAULT_OBJECTIVE_BY_LANG[lang];

    if (languageAlignedObjective) {
      objectiveId = languageAlignedObjective;
    }
  }

  const vocabCandidates = [
    ...scopedClusterItems.map((item) => item.lemma),
    ...scopedItems.map((item) => item.lemma),
    ...(dominantCluster?.topTerms || []),
  ];
  const vocabulary = [...new Set(vocabCandidates)].slice(0, 3);

  const topTerms = ingestion?.mediaProfile?.learningSignals?.topTerms || [];
  const preferredTerms = topTerms.filter((item) => item.lang === lang);
  const personalizedBase = preferredTerms.length > 0 ? preferredTerms : topTerms;
  const personalizedTargets = personalizedBase.slice(0, 3).map((item) => ({
    lemma: item.lemma,
    source: item.dominantSource,
  }));

  return {
    ...baseObjective,
    objectiveId,
    mode,
    coreTargets: {
      vocabulary:
        vocabulary.length > 0 ? vocabulary : [...(baseObjective.coreTargets?.vocabulary || [])],
      grammar: [...(LANG_TARGETS[lang]?.grammar || LANG_TARGETS.ko.grammar)],
      sentenceStructures: [
        ...(LANG_TARGETS[lang]?.sentenceStructures || LANG_TARGETS.ko.sentenceStructures),
      ],
    },
    personalizedTargets:
      personalizedTargets.length > 0
        ? personalizedTargets
        : cloneJson(baseObjective.personalizedTargets || []),
  };
}

function buildGameStartResponse(userId, incomingProfile) {
  const profile = incomingProfile || getProfile(userId) || FIXTURES.gameStart.profile;
  const ingestion = ensureIngestionForUser(userId);
  const dominantClusterId = getDominantClusterId(ingestion);

  const city = CLUSTER_CITY_MAP[dominantClusterId] || FIXTURES.gameStart.city || 'seoul';
  const location = CLUSTER_LOCATION_MAP[dominantClusterId] || 'food_street';

  const ytMinutes = ingestion?.mediaProfile?.sourceBreakdown?.youtube?.minutes || 0;
  const spMinutes = ingestion?.mediaProfile?.sourceBreakdown?.spotify?.minutes || 0;
  const clusterCount = ingestion?.mediaProfile?.learningSignals?.clusterAffinities?.length || 0;
  const topTermCount = ingestion?.mediaProfile?.learningSignals?.topTerms?.length || 0;
  const crossSourceCount =
    ingestion?.frequency?.items?.filter((item) => Number(item.sourceCount || 0) > 1).length || 0;

  const xp = Math.round(
    Math.min(999, 35 + ytMinutes * 0.45 + spMinutes * 0.4 + topTermCount * 2),
  );
  const sp = Math.round(Math.min(200, 12 + clusterCount * 8 + crossSourceCount * 3));
  const rp = Math.round(Math.min(100, 6 + crossSourceCount * 2 + clusterCount * 2));
  const currentMasteryLevel = xp >= 220 ? 3 : xp >= 140 ? 2 : 1;

  const weakestLang = getWeakestTargetLanguage(profile);
  const objective = buildPersonalizedObjective({
    userId,
    mode: 'hangout',
    lang: weakestLang,
  });

  return {
    ...cloneJson(FIXTURES.gameStart),
    city,
    location,
    mode: 'hangout',
    sceneId: `${location}_hangout_intro`,
    profile: cloneJson(profile),
    progression: {
      xp,
      sp,
      rp,
      currentMasteryLevel,
    },
    actions: [
      'Start hangout validation',
      'Review personalized learn targets',
      `Practice ${weakestLang.toUpperCase()} objective ${objective.objectiveId}`,
    ],
  };
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

  const goodPatterns = ['주세요', '먹', '주문', '라면', '떡볶이', '메뉴'];
  const matched = goodPatterns.some((pattern) => userUtterance.includes(pattern));
  const xpDelta = matched ? 8 : 4;
  const spDelta = matched ? 2 : 1;
  const rpDelta = matched ? 1 : 0;

  existing.turn += 1;
  existing.score.xp += xpDelta;
  existing.score.sp += spDelta;
  existing.score.rp += rpDelta;

  const nextLine =
    existing.turn % 2 === 0
      ? '좋아요, 맵기는 어느 정도로 할까요?'
      : '좋아요! 다음 주문도 한국어로 말해 볼까요?';

  const response = {
    accepted: true,
    feedback: {
      tongHint: matched
        ? 'Great phrasing. You used practical ordering language.'
        : 'Try adding a food word plus polite ending like 주세요.',
      objectiveProgressDelta: matched ? 0.25 : 0.1,
    },
    nextLine: {
      speaker: 'character',
      text: nextLine,
    },
    state: {
      turn: existing.turn,
      score: { ...existing.score },
    },
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
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(res, 200, ingestion.frequency || FIXTURES.frequency);
      return;
    }

    if (pathname === '/api/v1/vocab/insights' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(res, 200, ingestion.insights || FIXTURES.insights);
      return;
    }

    if (pathname === '/api/v1/player/media-profile' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(res, 200, ingestion.mediaProfile || { ...FIXTURES.mediaProfile, userId });
      return;
    }

    if (pathname === '/api/v1/ingestion/run-mock' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromSearch(url.searchParams);
      if (body.profile) upsertProfile(userId, { profile: body.profile });
      const result = runIngestionForUser(userId);
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
      const userId = body.userId || DEFAULT_USER_ID;
      const incomingProfile = body.profile ? upsertProfile(userId, { profile: body.profile }) : null;
      const sessionId = `sess_${Math.random().toString(36).slice(2, 10)}`;
      const response = {
        ...buildGameStartResponse(userId, incomingProfile),
        sessionId,
      };
      state.sessions.set(sessionId, {
        userId,
        turn: 1,
        score: { xp: 0, sp: 0, rp: 0 },
      });
      jsonResponse(res, 200, response);
      return;
    }

    if (pathname === '/api/v1/profile/proficiency' && req.method === 'PUT') {
      const body = await readJsonBody(req);
      if (!body.userId) {
        jsonResponse(res, 400, { error: 'userId_required' });
        return;
      }
      const profile = upsertProfile(body.userId, body.profile ? { profile: body.profile } : body);
      const ingestion = ensureIngestionForUser(body.userId);
      jsonResponse(res, 200, { ok: true, profile, mediaProfile: ingestion.mediaProfile });
      return;
    }

    if (pathname === '/api/v1/objectives/next' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const mode = url.searchParams.get('mode') === 'learn' ? 'learn' : 'hangout';
      const objective = buildPersonalizedObjective({
        userId,
        mode,
        lang: getLang(url.searchParams),
      });
      jsonResponse(res, 200, objective);
      return;
    }

    if (pathname === '/api/v1/scenes/hangout/start' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const sceneSessionId = `hang_${Math.random().toString(36).slice(2, 8)}`;
      const score = { xp: 0, sp: 0, rp: 0 };
      state.sessions.set(sceneSessionId, {
        userId: body.userId || 'demo-user-1',
        turn: 1,
        score: { ...score },
      });
      jsonResponse(res, 200, {
        sceneSessionId,
        mode: 'hangout',
        uiPolicy: {
          immersiveFirstPerson: true,
          allowOnlyDialogueAndHints: true,
        },
        state: {
          turn: 1,
          score,
        },
        initialLine: {
          speaker: 'character',
          text: '어서 와요! 오늘은 뭐 먹고 싶어요?',
        },
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

ensureIngestionForUser(DEFAULT_USER_ID);

server.listen(PORT, () => {
  console.log(`Tong mock server listening on http://localhost:${PORT}`);
});

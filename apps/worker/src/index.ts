import captionsFixture from '../../../packages/contracts/fixtures/captions.enriched.sample.json';
import dictionaryFixture from '../../../packages/contracts/fixtures/dictionary.entry.sample.json';
import frequencyFixture from '../../../packages/contracts/fixtures/vocab.frequency.sample.json';
import insightsFixture from '../../../packages/contracts/fixtures/vocab.insights.sample.json';
import gameStartFixture from '../../../packages/contracts/fixtures/game.start-or-resume.sample.json';
import objectivesNextFixture from '../../../packages/contracts/fixtures/objectives.next.sample.json';
import learnSessionsFixture from '../../../packages/contracts/fixtures/learn.sessions.sample.json';
import mediaProfileFixture from '../../../packages/contracts/fixtures/player.media-profile.sample.json';
import objectiveIdentityMap from '../../../packages/contracts/objective-identity-map.sample.json';
import mockMediaWindow from '../../server/data/mock-media-window.json';

type Lang = 'ko' | 'ja' | 'zh';
type Mode = 'hangout' | 'learn';
type CityId = 'seoul' | 'tokyo' | 'shanghai';
type LocationId = 'food_street' | 'cafe' | 'convenience_store' | 'subway_hub' | 'practice_studio';
type ObjectiveCategory =
  | 'script'
  | 'pronunciation'
  | 'vocabulary'
  | 'grammar'
  | 'sentences'
  | 'conversation';

type SourceKind = 'youtube' | 'spotify';

type Profile = {
  nativeLanguage: string;
  targetLanguages: Lang[];
  proficiency: {
    ko: string;
    ja: string;
    zh: string;
  };
};

type IngestionProvenanceSample = {
  source: SourceKind;
  mediaId: string;
  title?: string;
  consumedAtIso: string;
};

type IngestionProvenance = {
  sources: SourceKind[];
  mediaIds: string[];
  samples: IngestionProvenanceSample[];
};

type PlacementHint = {
  city: CityId;
  location: LocationId;
  mode: Mode;
  placementType: string;
  reason: string;
  clusterId: string;
  objectiveId: string;
  canonicalObjectiveId?: string;
  legacyObjectiveId?: string | null;
  objectiveAliasIds?: string[];
  confidence?: number;
};

type FrequencyItem = {
  lemma: string;
  lang: Lang;
  count: number;
  sourceCount: number;
  clusterId?: string;
  sourceBreakdown?: {
    youtube: number;
    spotify: number;
  };
  provenance?: IngestionProvenance;
};

type IngestionResult = {
  generatedAtIso: string;
  frequency: {
    windowStartIso: string;
    windowEndIso: string;
    items: FrequencyItem[];
  };
  insights: {
    windowStartIso: string;
    windowEndIso: string;
    clusters: Array<{
      clusterId: string;
      label: string;
      keywords: string[];
      topTerms: string[];
      placementHints?: PlacementHint[];
    }>;
    items: Array<{
      lemma: string;
      lang: Lang;
      score: number;
      frequency: number;
      burst: number;
      clusterId: string;
      orthographyFeatures: Record<string, unknown>;
      provenance?: IngestionProvenance;
      placementHints?: PlacementHint[];
      objectiveLinks: Array<{
        objectiveId: string;
        canonicalObjectiveId?: string;
        legacyObjectiveId?: string | null;
        objectiveAliasIds?: string[];
        reason: string;
      }>;
    }>;
  };
  mediaProfile: {
    userId: string;
    windowDays: number;
    generatedAtIso: string;
    sourceBreakdown: {
      youtube: {
        itemsConsumed: number;
        minutes: number;
        topMedia: Array<{ mediaId: string; title: string; lang: Lang; minutes: number }>;
      };
      spotify: {
        itemsConsumed: number;
        minutes: number;
        topMedia: Array<{ mediaId: string; title: string; lang: Lang; minutes: number }>;
      };
    };
    learningSignals: {
      topTerms: Array<{
        lemma: string;
        lang: Lang;
        weightedScore: number;
        dominantSource: 'youtube' | 'spotify';
        provenance?: IngestionProvenance;
        placementHints?: PlacementHint[];
      }>;
      clusterAffinities: Array<{
        clusterId: string;
        label: string;
        score: number;
      }>;
      placementCandidates?: PlacementHint[];
    };
  };
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-demo-password',
};

const DEFAULT_USER_ID = 'demo-user-1';
const PROFICIENCY_RANK: Record<string, number> = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  native: 4,
};

const CLUSTER_CITY_MAP: Record<string, 'seoul' | 'tokyo' | 'shanghai'> = {
  'food-ordering': 'seoul',
  'performance-energy': 'shanghai',
  'city-social': 'tokyo',
  general: 'seoul',
};

const CLUSTER_LOCATION_MAP: Record<
  string,
  'food_street' | 'cafe' | 'convenience_store' | 'subway_hub' | 'practice_studio'
> = {
  'food-ordering': 'food_street',
  'performance-energy': 'practice_studio',
  'city-social': 'subway_hub',
  general: 'food_street',
};

const LANG_TARGETS: Record<
  Lang,
  {
    grammar: string[];
    sentenceStructures: string[];
  }
> = {
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

const DEFAULT_OBJECTIVE_BY_LANG: Record<Lang, string> = {
  ko: 'ko-vocab-food-items',
  ja: 'ja-vocab-subway-transfers',
  zh: 'zh-mission-stage-texting',
};

const OBJECTIVE_BY_LANG: Record<
  Lang | 'en',
  {
    objectiveId: string;
    reason: string;
    gap: number;
  }
> = {
  ko: {
    objectiveId: 'ko-vocab-food-items',
    reason: 'Reinforces Korean phrase utility for food-street scenes',
    gap: 0.74,
  },
  ja: {
    objectiveId: 'ja-vocab-subway-transfers',
    reason: 'Builds Japanese transit and social phrase reliability',
    gap: 0.7,
  },
  zh: {
    objectiveId: 'zh-mission-stage-texting',
    reason: 'Strengthens Mandarin mission vocabulary recall',
    gap: 0.8,
  },
  en: {
    objectiveId: 'ja-vocab-subway-transfers',
    reason: 'Supports cross-city objective transfer terms',
    gap: 0.62,
  },
};

const TOPIC_DEFINITIONS = [
  {
    clusterId: 'food-ordering',
    label: 'Food Ordering',
    keywords: [
      'food',
      'restaurant',
      'order',
      'menu',
      'spicy',
      'kitchen',
      '먹',
      '주문',
      '메뉴',
      '맛',
      '라면',
      '떡볶이',
      '카페',
      '咖啡',
      '吃',
      '点餐',
      '料理',
    ],
    objectiveId: 'ko-vocab-food-items',
    objectiveReason: 'High utility in next food-location hangout',
    objectiveGap: 0.84,
  },
  {
    clusterId: 'performance-energy',
    label: 'Performance Energy',
    keywords: [
      'stage',
      'performance',
      'practice',
      'dance',
      'song',
      '무대',
      '연습',
      '노래',
      '火',
      '燃',
      '练习',
      '练',
      '舞台',
    ],
    objectiveId: 'zh-mission-stage-texting',
    objectiveReason: 'Supports Shanghai advanced texting mission vocabulary',
    objectiveGap: 0.9,
  },
  {
    clusterId: 'city-social',
    label: 'City Social',
    keywords: [
      'subway',
      'station',
      'street',
      'friends',
      'hangout',
      '지하철',
      '거리',
      '친구',
      '站',
      '街',
      '友達',
      'cafe',
    ],
    objectiveId: 'ko-vocab-city-social',
    objectiveReason: 'Builds social and navigation language transfer',
    objectiveGap: 0.72,
  },
];

const PLACEMENT_BY_CLUSTER: Record<
  string,
  Array<{
    city: CityId;
    location: LocationId;
    mode: Mode;
    placementType: string;
    reason: string;
  }>
> = {
  'food-ordering': [
    {
      city: 'seoul',
      location: 'food_street',
      mode: 'hangout',
      placementType: 'hangout',
      reason: 'Food-ordering terms reinforce the Seoul food street hangout.',
    },
    {
      city: 'seoul',
      location: 'food_street',
      mode: 'learn',
      placementType: 'learn',
      reason: 'Food-ordering terms fit the Seoul food lesson.',
    },
  ],
  'performance-energy': [
    {
      city: 'shanghai',
      location: 'practice_studio',
      mode: 'hangout',
      placementType: 'mission',
      reason: 'Performance language supports the Shanghai texting mission.',
    },
    {
      city: 'shanghai',
      location: 'practice_studio',
      mode: 'learn',
      placementType: 'learn',
      reason: 'Performance language can be introduced in the Shanghai practice lesson.',
    },
  ],
  'city-social': [
    {
      city: 'tokyo',
      location: 'subway_hub',
      mode: 'hangout',
      placementType: 'hangout',
      reason: 'Navigation language is best validated in the Tokyo subway hub.',
    },
    {
      city: 'tokyo',
      location: 'subway_hub',
      mode: 'learn',
      placementType: 'learn',
      reason: 'Navigation language fits the Tokyo subway lesson.',
    },
  ],
  general: [],
};

const RADICAL_BY_CHAR: Record<string, string> = {
  火: '火',
  炎: '火',
  灯: '火',
  烧: '火',
  燃: '火',
  热: '火',
  食: '食',
  饭: '食',
  飲: '食',
  饮: '食',
  餐: '食',
  言: '言',
  詞: '言',
  词: '言',
  話: '言',
  话: '言',
  語: '言',
  语: '言',
};

const RELATED_FORMS_BY_RADICAL: Record<string, string[]> = {
  火: ['炎', '灯', '烧'],
  食: ['饭', '饮', '餐'],
  言: ['语', '话', '词'],
};

const DICTIONARY_OVERRIDES: Record<string, Record<string, unknown>> = {
  오늘: {
    term: '오늘',
    lang: 'ko',
    meaning: 'today',
    examples: ['오늘 뭐 먹을까?'],
    crossCjk: { zhHans: '今天', ja: '今日' },
    readings: { ko: 'oneul', zhPinyin: 'jin tian', jaRomaji: 'kyou' },
  },
  먹을까: {
    term: '먹다',
    lang: 'ko',
    meaning: 'to eat; shall we eat?',
    examples: ['같이 먹을까?'],
    crossCjk: { zhHans: '吃', ja: '食べる' },
    readings: { ko: 'meokda', zhPinyin: 'chi', jaRomaji: 'taberu' },
  },
  주문: {
    term: '주문',
    lang: 'ko',
    meaning: 'order (food/item)',
    examples: ['주문 도와드릴까요?'],
    crossCjk: { zhHans: '点餐', ja: '注文' },
    readings: { ko: 'jumun', zhPinyin: 'dian can', jaRomaji: 'chuumon' },
  },
};

const TOKEN_REGEX = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z]{2,}/gu;

const FIXTURES = {
  captions: captionsFixture,
  dictionary: dictionaryFixture,
  frequency: frequencyFixture,
  insights: insightsFixture,
  gameStart: gameStartFixture,
  objectivesNext: objectivesNextFixture,
  learnSessions: learnSessionsFixture,
  mediaProfile: mediaProfileFixture,
};

const objectiveIdentityByCanonical = new Map<string, (typeof objectiveIdentityMap.objectives)[number]>();
const canonicalObjectiveByAnyId = new Map<string, string>();

for (const identity of objectiveIdentityMap.objectives || []) {
  objectiveIdentityByCanonical.set(identity.canonicalObjectiveId, identity);
  canonicalObjectiveByAnyId.set(identity.canonicalObjectiveId, identity.canonicalObjectiveId);
  for (const legacyId of identity.legacyObjectiveIds || []) {
    canonicalObjectiveByAnyId.set(legacyId, identity.canonicalObjectiveId);
  }
}

type WorkerGameRuntime = {
  userId: string;
  response: any;
};

type WorkerSceneRuntime = {
  userId: string;
  gameSessionId: string | null;
  sceneSession: Record<string, any>;
};

const state = {
  profiles: new Map<string, Profile>(),
  sessions: new Map<string, WorkerGameRuntime>(),
  sceneSessions: new Map<string, WorkerSceneRuntime>(),
  checkpoints: new Map<string, Record<string, any>>(),
  activeSessionByUser: new Map<string, string>(),
  learnSessions: [...(((FIXTURES.learnSessions as any).items || []) as Array<Record<string, unknown>>)],
  ingestionByUser: new Map<string, IngestionResult>(),
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildInitialProgressionDelta() {
  return {
    xp: 0,
    sp: 0,
    rp: 0,
    objectiveProgressDelta: 0,
    validatedHangoutsDelta: 0,
  };
}

function toSceneSessionPayload(sceneSession: Record<string, any>) {
  const payload = cloneJson(sceneSession);
  delete payload.score;
  return payload;
}

function ensureSceneRuntime(response: any, userId: string): WorkerSceneRuntime {
  const sceneSession = cloneJson(response?.sceneSession || {});
  const progression = cloneJson(response?.gameSession?.progression || response?.progression || { xp: 0, sp: 0, rp: 0 });
  const activeCheckpoint = cloneJson(response?.activeCheckpoint || {});

  sceneSession.turn = Number(activeCheckpoint?.turn || sceneSession.turn || 1);
  sceneSession.phase = activeCheckpoint?.phase || sceneSession.phase || 'intro';
  sceneSession.progressionDelta = cloneJson(activeCheckpoint?.progressionDelta || sceneSession.progressionDelta || buildInitialProgressionDelta());
  sceneSession.score = {
    xp: Number(progression?.xp || 0),
    sp: Number(progression?.sp || 0),
    rp: Number(progression?.rp || 0),
  };
  sceneSession.uiPolicy = cloneJson(
    sceneSession.uiPolicy || {
      immersiveFirstPerson: true,
      allowOnlyDialogueAndHints: true,
    },
  );

  return {
    userId,
    gameSessionId: response?.sessionId ? String(response.sessionId) : null,
    sceneSession,
  };
}

function storeGameRuntimeResponse(userId: string, response: any) {
  const responseClone = cloneJson(response);
  const sessionId = String(responseClone?.sessionId || '');
  const sceneRuntime = ensureSceneRuntime(responseClone, userId);
  const activeCheckpoint = cloneJson(responseClone?.activeCheckpoint || {});

  state.sessions.set(sessionId, {
    userId,
    response: responseClone,
  });
  state.sceneSessions.set(String(sceneRuntime.sceneSession.sceneSessionId || sessionId), sceneRuntime);
  if (activeCheckpoint?.checkpointId) {
    state.checkpoints.set(String(activeCheckpoint.checkpointId), activeCheckpoint);
  }
  state.activeSessionByUser.set(userId, sessionId);
}

function findStoredGameRuntime(userId: string, requestedSessionId: string | null) {
  if (requestedSessionId && state.sessions.has(requestedSessionId)) {
    const direct = state.sessions.get(requestedSessionId) || null;
    if (direct?.userId === userId) return direct;
  }

  const activeSessionId = state.activeSessionByUser.get(userId);
  if (activeSessionId) {
    const active = state.sessions.get(activeSessionId) || null;
    if (active?.userId === userId) return active;
  }

  for (const runtime of state.sessions.values()) {
    if (runtime.userId === userId) {
      return runtime;
    }
  }

  return null;
}

function buildStoredGameResponse(runtime: WorkerGameRuntime, resumeSource: 'new_session' | 'checkpoint' = 'checkpoint') {
  const response = cloneJson(runtime.response);
  const sessionId = String(response?.sessionId || response?.gameSession?.sessionId || '');
  const sceneSessionId = String(response?.gameSession?.activeSceneSessionId || response?.sceneSession?.sceneSessionId || '');
  const sceneRuntime = sceneSessionId ? state.sceneSessions.get(sceneSessionId) : null;
  const activeCheckpointId = String(response?.gameSession?.activeCheckpointId || response?.activeCheckpoint?.checkpointId || '');
  const activeCheckpoint =
    (activeCheckpointId ? state.checkpoints.get(activeCheckpointId) : null) || response.activeCheckpoint || null;

  response.resumeSource = resumeSource;
  response.progression = cloneJson(response?.gameSession?.progression || response?.progression || {});
  response.actions = cloneJson(response?.gameSession?.availableActions || response?.actions || []);
  response.gameSession = cloneJson(response?.gameSession || {});
  response.gameSession.sessionId = sessionId;
  response.gameSession.resumeSource = resumeSource;
  response.gameSession.activeCheckpointId = activeCheckpoint?.checkpointId || response.gameSession.activeCheckpointId;
  response.sceneSession = sceneRuntime ? toSceneSessionPayload(sceneRuntime.sceneSession) : toSceneSessionPayload(response.sceneSession || {});
  response.activeCheckpoint = activeCheckpoint ? cloneJson(activeCheckpoint) : null;

  runtime.response = cloneJson(response);
  state.sessions.set(sessionId, runtime);
  return response;
}

function createNextCheckpoint(gameResponse: any, sceneRuntime: WorkerSceneRuntime, boundary: string) {
  const gameSession = gameResponse?.gameSession || {};
  const sceneSession = sceneRuntime.sceneSession || {};
  const previousCheckpoint =
    (gameSession?.activeCheckpointId ? state.checkpoints.get(String(gameSession.activeCheckpointId)) : null) ||
    gameResponse?.activeCheckpoint ||
    null;
  const previousVersion = Number(previousCheckpoint?.rng?.version || 0);
  const checkpointVersion = Math.max(previousVersion, 0) + 1;
  const nowIso = new Date().toISOString();

  return {
    ...(cloneJson(previousCheckpoint || {}) as Record<string, any>),
    checkpointId: `ckpt_${String(gameSession.sessionId || gameResponse?.sessionId || 'session')}_${String(checkpointVersion).padStart(3, '0')}`,
    gameSessionId: String(gameSession.sessionId || gameResponse?.sessionId || ''),
    sceneSessionId: String(sceneSession.sceneSessionId || ''),
    route: {
      pathname: '/game',
      query: {
        city: String(sceneSession.cityId || gameSession.cityId || 'seoul'),
        location: String(sceneSession.locationId || gameSession.locationId || 'food_street'),
        mode: String(sceneSession.mode || gameSession.currentMode || 'hangout'),
        resume: '1',
        checkpoint: String(checkpointVersion),
      },
    },
    cityId: String(sceneSession.cityId || gameSession.cityId || 'seoul'),
    locationId: String(sceneSession.locationId || gameSession.locationId || 'food_street'),
    mode: String(sceneSession.mode || gameSession.currentMode || 'hangout'),
    objective: cloneJson(sceneSession.objective || gameSession.activeObjective || previousCheckpoint?.objective || {}),
    phase: sceneSession.phase || 'dialogue',
    turn: Number(sceneSession.turn || 1),
    progressionDelta: cloneJson(sceneSession.progressionDelta || buildInitialProgressionDelta()),
    rewards: cloneJson(gameSession.rewards || []),
    missionGate: cloneJson(gameSession.missionGate || {}),
    unlocks: cloneJson(gameSession.unlocks || {}),
    rng: {
      seed: `${String(gameSession.sessionId || gameResponse?.sessionId || 'session')}_${boundary}`,
      version: checkpointVersion,
    },
    createdAtIso: nowIso,
  };
}

function jsonResponse(statusCode: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

async function readJsonBody(request: Request): Promise<Record<string, any>> {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

function getLang(search: URLSearchParams): Lang {
  const lang = (search.get('lang') || 'ko') as Lang;
  if (lang === 'ko' || lang === 'ja' || lang === 'zh') return lang;
  return 'ko';
}

function getCityId(search: URLSearchParams): CityId {
  const city = search.get('city');
  if (city === 'seoul' || city === 'tokyo' || city === 'shanghai') return city;
  return 'seoul';
}

function getLocationId(search: URLSearchParams): LocationId {
  const location = search.get('location');
  if (
    location === 'food_street' ||
    location === 'cafe' ||
    location === 'convenience_store' ||
    location === 'subway_hub' ||
    location === 'practice_studio'
  ) {
    return location;
  }
  return 'food_street';
}

function getUserIdFromSearch(searchParams: URLSearchParams): string {
  return searchParams.get('userId') || DEFAULT_USER_ID;
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
    ...(cloneJson(FIXTURES.captions) as Record<string, unknown>),
    videoId,
    segments: baseSegments,
  };
}

function normalizeProfile(rawProfile: Record<string, any> | null): Profile | null {
  if (!rawProfile || typeof rawProfile !== 'object') return null;

  const profile = rawProfile.profile && typeof rawProfile.profile === 'object' ? rawProfile.profile : rawProfile;

  const targetLanguages = Array.isArray(profile.targetLanguages)
    ? profile.targetLanguages.filter((lang: string) => lang === 'ko' || lang === 'ja' || lang === 'zh')
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

function upsertProfile(userId: string, rawProfile: Record<string, any>): Profile | null {
  const profile = normalizeProfile(rawProfile);
  if (!profile) return null;
  state.profiles.set(userId, profile);
  state.ingestionByUser.delete(userId);
  return profile;
}

function getProfile(userId: string): Profile | null {
  return state.profiles.get(userId) || null;
}

function getWeakestTargetLanguage(profile: Profile | null): Lang {
  if (!profile || !Array.isArray(profile.targetLanguages) || profile.targetLanguages.length === 0) {
    return 'ko';
  }

  return [...profile.targetLanguages].sort((a, b) => {
    const rankA = PROFICIENCY_RANK[profile?.proficiency?.[a] || 'none'] ?? 0;
    const rankB = PROFICIENCY_RANK[profile?.proficiency?.[b] || 'none'] ?? 0;
    return rankA - rankB;
  })[0] as Lang;
}

function detectScriptType(token: string): 'hangul' | 'han' | 'kana' | 'latin' {
  if (/[\p{Script=Hangul}]/u.test(token)) return 'hangul';
  if (/[\p{Script=Han}]/u.test(token)) return 'han';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(token)) return 'kana';
  return 'latin';
}

function normalizeToken(token: string): string {
  return token.trim();
}

function extractTokens(text: string): string[] {
  if (!text) return [];
  return (text.match(TOKEN_REGEX) || []).map(normalizeToken).filter((token) => token.length >= 2);
}

function parseIso(input: string | undefined | null, fallbackIso?: string): Date {
  const candidate = input || fallbackIso || new Date().toISOString();
  const value = new Date(candidate);
  if (Number.isNaN(value.getTime())) {
    return new Date(fallbackIso || Date.now());
  }
  return value;
}

function detectLang(term: string): Lang {
  if (/[\p{Script=Hangul}]/u.test(term)) return 'ko';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(term)) return 'ja';
  if (/[\p{Script=Han}]/u.test(term)) return 'zh';
  return 'ko';
}

function normalizeTermKey(token: string): string {
  const cleaned = normalizeToken(token);
  if (!cleaned) return '';
  return cleaned.toLocaleLowerCase();
}

function getTopicMatches(text: string) {
  const haystack = text.toLowerCase();
  const matches = TOPIC_DEFINITIONS.filter((topic) =>
    topic.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
  );

  if (matches.length === 0) {
    return [
      {
        clusterId: 'general',
        label: 'General',
        keywords: ['general'],
        objectiveId: 'ko-vocab-food-items',
        objectiveReason: 'General fallback objective linkage',
        objectiveGap: 0.62,
      },
    ];
  }

  return matches;
}

function topicFromId(clusterId: string) {
  return (
    TOPIC_DEFINITIONS.find((topic) => topic.clusterId === clusterId) || {
      clusterId,
      label: clusterId,
      keywords: ['general'],
      objectiveId: 'ko-vocab-food-items',
      objectiveReason: 'General fallback objective linkage',
      objectiveGap: 0.62,
    }
  );
}

function pickDominantCluster(clusterVotes: Map<string, number>): string {
  let winner: string | null = null;
  let best = -1;
  for (const [clusterId, score] of clusterVotes.entries()) {
    if (score > best) {
      best = score;
      winner = clusterId;
    }
  }
  return winner || 'general';
}

function safeNorm(value: number, max: number): number {
  if (!max || max <= 0) return 0;
  return value / max;
}

function burstScore(recentCount: number, baselineCount: number): number {
  const ratio = (recentCount + 1) / (baselineCount + 1);
  const burst = 1 + 0.2 * (ratio - 1);
  return Number(Math.max(0.5, Math.min(3, burst)).toFixed(2));
}

function detectRadical(chars: string[]): string | null {
  for (const char of chars) {
    if (RADICAL_BY_CHAR[char]) return RADICAL_BY_CHAR[char];
  }
  for (const char of chars) {
    if (RELATED_FORMS_BY_RADICAL[char]) return char;
  }
  return chars[0] || null;
}

function orthographyFeaturesForLemma(lemma: string): Record<string, unknown> {
  const scriptType = detectScriptType(lemma);

  if (scriptType === 'hangul') {
    return {
      scriptType,
      syllables: [...lemma].filter((char) => /[\p{Script=Hangul}]/u.test(char)).slice(0, 6),
    };
  }

  if (scriptType === 'han') {
    const hanChars = [...lemma].filter((char) => /[\p{Script=Han}]/u.test(char));
    const radical = detectRadical(hanChars);
    const relatedForms = radical ? RELATED_FORMS_BY_RADICAL[radical] || [] : [];
    return {
      scriptType,
      ...(radical ? { radical } : {}),
      ...(relatedForms.length > 0 ? { relatedForms } : {}),
    };
  }

  if (scriptType === 'kana') {
    return {
      scriptType,
      morae: [...lemma].filter((char) => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char)).slice(0, 6),
    };
  }

  return { scriptType };
}

function resolveObjectiveIdentity(objectiveId: unknown) {
  if (typeof objectiveId !== 'string' || objectiveId.length === 0) {
    return {
      objectiveId,
      canonicalObjectiveId: objectiveId,
      legacyObjectiveId: null,
      objectiveAliasIds: [] as string[],
      identity: null,
    };
  }

  const canonicalObjectiveId = canonicalObjectiveByAnyId.get(objectiveId) || objectiveId;
  const identity = objectiveIdentityByCanonical.get(canonicalObjectiveId) || null;
  const legacyObjectiveId = identity?.legacyObjectiveIds?.[0] || null;
  const objectiveAliasIds = identity?.legacyObjectiveIds ? [...identity.legacyObjectiveIds] : [];

  return {
    objectiveId: canonicalObjectiveId,
    canonicalObjectiveId,
    legacyObjectiveId,
    objectiveAliasIds,
    identity,
  };
}

function withObjectiveIdentity<T extends Record<string, unknown>>(payload: T, objectiveId: unknown) {
  const resolved = resolveObjectiveIdentity(objectiveId);
  return {
    ...payload,
    objectiveId: resolved.objectiveId,
    canonicalObjectiveId: resolved.canonicalObjectiveId,
    legacyObjectiveId: resolved.legacyObjectiveId,
    objectiveAliasIds: resolved.objectiveAliasIds,
  };
}

function canonicalObjectiveNodeId(objectiveId: unknown): string {
  return `objective:${resolveObjectiveIdentity(objectiveId).canonicalObjectiveId}`;
}

function defaultObjectiveIdForLang(lang: Lang, fallbackObjectiveId: string | null = null): string | null {
  if (typeof fallbackObjectiveId === 'string' && fallbackObjectiveId.length > 0) {
    const fallbackCanonicalId = resolveObjectiveIdentity(fallbackObjectiveId).canonicalObjectiveId;
    if (typeof fallbackCanonicalId === 'string' && fallbackCanonicalId.startsWith(`${lang}-`)) {
      return fallbackCanonicalId;
    }
  }

  for (const identity of objectiveIdentityMap.objectives || []) {
    if (identity.lang === lang) {
      return identity.canonicalObjectiveId;
    }
  }

  return fallbackObjectiveId;
}

function objectiveLinkForEntry(entry: any) {
  const topic = topicFromId(entry.clusterId);
  const langFallback = (OBJECTIVE_BY_LANG as Record<string, { objectiveId: string; reason: string; gap: number }>)[entry.lang] || OBJECTIVE_BY_LANG.ko;
  const topicGap = Number(topic.objectiveGap || 0);
  const gap = topicGap > 0 ? topicGap : langFallback.gap;
  return withObjectiveIdentity(
    {
      reason: topic.objectiveReason || langFallback.reason,
      gap,
    },
    topic.objectiveId || langFallback.objectiveId,
  );
}

function placementHintsForCluster(clusterId: string, objectiveId: string): PlacementHint[] {
  const resolvedClusterId =
    clusterId && PLACEMENT_BY_CLUSTER[clusterId]
      ? clusterId
      : objectiveId === 'ko-vocab-food-items'
        ? 'food-ordering'
        : objectiveId === 'zh-mission-stage-texting'
          ? 'performance-energy'
          : 'city-social';

  return (PLACEMENT_BY_CLUSTER[resolvedClusterId] || []).map((placement) =>
    withObjectiveIdentity(
      {
        ...placement,
        clusterId: resolvedClusterId,
      },
      objectiveId,
    ) as PlacementHint,
  );
}

function summarizeProvenance(entry: any): IngestionProvenance {
  const samples = [...(entry.provenance || [])]
    .sort((a: IngestionProvenanceSample, b: IngestionProvenanceSample) => parseIso(b.consumedAtIso).getTime() - parseIso(a.consumedAtIso).getTime())
    .slice(0, 3);

  return {
    sources: [...(entry.sourceSet || [])],
    mediaIds: [...(entry.mediaIds || [])],
    samples,
  };
}

function aggregateTopMedia(sourceItems: any[], source: SourceKind) {
  const grouped = new Map<string, { mediaId: string; title: string; lang: Lang; minutes: number }>();
  for (const item of sourceItems) {
    if ((item.source === 'spotify' ? 'spotify' : 'youtube') !== source) continue;
    const mediaId = item.mediaId || item.id || `media_${source}`;
    const key = `${source}:${mediaId}`;
    const existing = grouped.get(key) || {
      mediaId,
      title: item.title || mediaId,
      lang: (item.lang || 'ko') as Lang,
      minutes: 0,
    };
    existing.minutes += Number(item.minutes || 0);
    grouped.set(key, existing);
  }
  return [...grouped.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
}

function runMockIngestion(
  snapshot: any,
  options: { userId?: string; profile?: Profile | null; includeSources?: SourceKind[] } = {},
): IngestionResult {
  const userId = options.userId || DEFAULT_USER_ID;
  const windowStart = parseIso(snapshot?.windowStartIso, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  const windowEnd = parseIso(snapshot?.windowEndIso, new Date().toISOString());
  const midpoint = new Date(windowStart.getTime() + (windowEnd.getTime() - windowStart.getTime()) / 2);
  const includeSources = Array.isArray(options.includeSources) && options.includeSources.length > 0
    ? new Set(options.includeSources)
    : null;

  const sourceItems = (Array.isArray(snapshot?.sourceItems) ? snapshot.sourceItems : []).filter((item) => {
    const source = item.source === 'spotify' ? 'spotify' : 'youtube';
    return !includeSources || includeSources.has(source);
  });

  const termMap = new Map<string, any>();
  const clusterStats = new Map<string, any>();
  const sourceBreakdown = {
    youtube: { itemsConsumed: 0, minutes: 0, topMedia: [] as Array<{ mediaId: string; title: string; lang: Lang; minutes: number }> },
    spotify: { itemsConsumed: 0, minutes: 0, topMedia: [] as Array<{ mediaId: string; title: string; lang: Lang; minutes: number }> },
  };

  for (const item of sourceItems) {
    const source: SourceKind = item.source === 'spotify' ? 'spotify' : 'youtube';
    sourceBreakdown[source].itemsConsumed += 1;
    sourceBreakdown[source].minutes += Number(item.minutes || 0);
  }

  sourceBreakdown.youtube.topMedia = aggregateTopMedia(sourceItems, 'youtube');
  sourceBreakdown.spotify.topMedia = aggregateTopMedia(sourceItems, 'spotify');

  for (const item of sourceItems) {
    const source: SourceKind = item.source === 'spotify' ? 'spotify' : 'youtube';
    const consumedAt = parseIso(item.playedAtIso || snapshot?.windowEndIso, windowEnd.toISOString());
    const ageHours = Math.max(0, (windowEnd.getTime() - consumedAt.getTime()) / (60 * 60 * 1000));
    const recencyWeight = Math.exp(
      -ageHours / Math.max(1, (windowEnd.getTime() - windowStart.getTime()) / (60 * 60 * 1000)),
    );
    const topics = getTopicMatches(`${item.title || ''} ${item.text || ''}`);
    const tokens =
      Array.isArray(item.tokens) && item.tokens.length > 0 ? item.tokens : extractTokens(item.text || '');

    for (const topic of topics) {
      const clusterEntry = clusterStats.get(topic.clusterId) || {
        clusterId: topic.clusterId,
        label: topic.label,
        keywords: topic.keywords.slice(0, 6),
        objectiveId: topic.objectiveId,
        count: 0,
        termCounts: new Map<string, number>(),
      };
      clusterEntry.count += 1;
      clusterStats.set(topic.clusterId, clusterEntry);
    }

    for (const tokenRaw of tokens) {
      const token = normalizeToken(String(tokenRaw));
      const key = normalizeTermKey(token);
      if (!key) continue;

      const existing = termMap.get(key) || {
        lemma: token,
        lang: (item.lang || detectLang(token)) as Lang,
        count: 0,
        weighted: 0,
        recencyWeighted: 0,
        sourceSet: new Set<SourceKind>(),
        mediaIds: new Set<string>(),
        provenance: [] as IngestionProvenanceSample[],
        sourceBreakdown: { youtube: 0, spotify: 0 },
        baselineCount: 0,
        recentCount: 0,
        clusterVotes: new Map<string, number>(),
      };

      existing.count += 1;
      existing.weighted += source === 'spotify' ? 1.15 : 1;
      existing.recencyWeighted += (source === 'spotify' ? 1.15 : 1) * recencyWeight;
      existing.sourceSet.add(source);
      existing.mediaIds.add(item.mediaId || item.id || `${source}_${key}`);
      existing.sourceBreakdown[source] += 1;

      if (existing.provenance.length < 4) {
        existing.provenance.push({
          source,
          mediaId: item.mediaId || item.id || `${source}_${key}`,
          title: item.title,
          consumedAtIso: item.playedAtIso || snapshot?.windowEndIso || windowEnd.toISOString(),
        });
      }

      if (consumedAt < midpoint) existing.baselineCount += 1;
      else existing.recentCount += 1;

      for (const topic of topics) {
        existing.clusterVotes.set(topic.clusterId, (existing.clusterVotes.get(topic.clusterId) || 0) + 1);
        const clusterEntry = clusterStats.get(topic.clusterId);
        if (clusterEntry) {
          clusterEntry.termCounts.set(token, (clusterEntry.termCounts.get(token) || 0) + 1);
        }
      }

      termMap.set(key, existing);
    }
  }

  const termEntries = [...termMap.values()];
  for (const entry of termEntries) {
    entry.clusterId = pickDominantCluster(entry.clusterVotes);
  }

  termEntries.sort((a, b) => {
    if (b.weighted !== a.weighted) return b.weighted - a.weighted;
    if (b.count !== a.count) return b.count - a.count;
    return b.sourceSet.size - a.sourceSet.size;
  });

  const frequencyItems: FrequencyItem[] = termEntries.map((entry) => ({
    lemma: entry.lemma,
    lang: entry.lang,
    count: entry.count,
    clusterId: entry.clusterId,
    sourceCount: entry.sourceSet.size,
    sourceBreakdown: entry.sourceBreakdown,
    provenance: summarizeProvenance(entry),
  }));

  const maxCount = termEntries.reduce((best, entry) => Math.max(best, entry.count), 0) || 1;
  const maxRecency = termEntries.reduce((best, entry) => Math.max(best, entry.recencyWeighted), 0) || 1;
  const bursts = termEntries.map((entry) => burstScore(entry.recentCount, entry.baselineCount));
  const maxBurst = bursts.reduce((best, burst) => Math.max(best, burst), 1);

  const scored = termEntries.map((entry, idx) => {
    const burst = bursts[idx];
    const objective = objectiveLinkForEntry(entry);
    const frequencyNorm = safeNorm(entry.count, maxCount);
    const burstNorm = maxBurst > 1 ? safeNorm(burst - 1, maxBurst - 1) : 0;
    const relevance = safeNorm(entry.recencyWeighted, maxRecency);
    const novelty = 1 / (1 + entry.baselineCount);
    const rawScore =
      0.3 * frequencyNorm +
      0.25 * burstNorm +
      0.2 * relevance +
      0.15 * Number(objective.gap || 0) +
      0.1 * novelty;

    return {
      entry,
      burst,
      objective,
      rawScore,
    };
  });

  const maxRawScore = scored.reduce((best, row) => Math.max(best, row.rawScore), 0) || 1;
  const insightsItems = scored
    .sort((a, b) => b.rawScore - a.rawScore || b.entry.count - a.entry.count)
    .slice(0, 30)
    .map((row) => ({
      lemma: row.entry.lemma,
      lang: row.entry.lang,
      score: Number((row.rawScore / maxRawScore).toFixed(2)),
      frequency: row.entry.count,
      burst: row.burst,
      clusterId: row.entry.clusterId,
      orthographyFeatures: orthographyFeaturesForLemma(row.entry.lemma),
      provenance: summarizeProvenance(row.entry),
      placementHints: placementHintsForCluster(row.entry.clusterId, row.objective.objectiveId),
      objectiveLinks: [
        withObjectiveIdentity(
          {
            reason: row.objective.reason,
          },
          row.objective.objectiveId,
        ),
      ],
    }));

  const clusters = [...clusterStats.values()]
    .sort((a, b) => b.count - a.count)
    .map((cluster) => ({
      clusterId: cluster.clusterId,
      label: cluster.label,
      keywords: cluster.keywords,
      topTerms: [...cluster.termCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([term]) => term),
      placementHints: placementHintsForCluster(cluster.clusterId, cluster.objectiveId),
    }));

  const topTerms = frequencyItems.slice(0, 8);
  const clusterAffinityMap = new Map<string, number>();
  for (const row of scored) {
    clusterAffinityMap.set(
      row.entry.clusterId,
      (clusterAffinityMap.get(row.entry.clusterId) || 0) + row.rawScore,
    );
  }

  const maxClusterAffinity = [...clusterAffinityMap.values()].reduce((best, value) => Math.max(best, value), 0) || 1;
  const topTopics = [...clusterAffinityMap.entries()]
    .map(([clusterId, value]) => ({
      clusterId,
      label: topicFromId(clusterId).label,
      score: Number((value / maxClusterAffinity).toFixed(2)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const totalTopWeight =
    topTerms.reduce((sum, item) => sum + item.count * Math.max(item.sourceCount, 1), 0) || 1;

  const learningSignals = {
    topTerms: topTerms.map((item) => ({
      lemma: item.lemma,
      lang: item.lang,
      weightedScore: Number(((item.count * Math.max(item.sourceCount, 1)) / totalTopWeight).toFixed(2)),
      dominantSource:
        Number(item.sourceBreakdown?.youtube || 0) >= Number(item.sourceBreakdown?.spotify || 0)
          ? 'youtube'
          : 'spotify',
      provenance: item.provenance,
      placementHints: placementHintsForCluster(
        item.clusterId || 'general',
        String(objectiveLinkForEntry(item).objectiveId || DEFAULT_OBJECTIVE_BY_LANG[item.lang]),
      ),
    })),
    clusterAffinities: topTopics,
    placementCandidates: topTopics.flatMap((topic) =>
      placementHintsForCluster(topic.clusterId, String(topicFromId(topic.clusterId).objectiveId)).map((placement) => ({
        ...placement,
        confidence: topic.score,
      })),
    ),
  };

  return {
    generatedAtIso: new Date().toISOString(),
    frequency: {
      windowStartIso: windowStart.toISOString(),
      windowEndIso: windowEnd.toISOString(),
      items: frequencyItems,
    },
    insights: {
      windowStartIso: windowStart.toISOString(),
      windowEndIso: windowEnd.toISOString(),
      clusters,
      items: insightsItems,
    },
    mediaProfile: {
      userId,
      windowDays: Math.max(1, Math.round((windowEnd.getTime() - windowStart.getTime()) / (24 * 60 * 60 * 1000))),
      generatedAtIso: new Date().toISOString(),
      sourceBreakdown: {
        youtube: {
          itemsConsumed: sourceBreakdown.youtube.itemsConsumed,
          minutes: sourceBreakdown.youtube.minutes,
          topMedia: sourceBreakdown.youtube.topMedia.slice(0, 5),
        },
        spotify: {
          itemsConsumed: sourceBreakdown.spotify.itemsConsumed,
          minutes: sourceBreakdown.spotify.minutes,
          topMedia: sourceBreakdown.spotify.topMedia.slice(0, 5),
        },
      },
      learningSignals,
    },
  };
}

function ensureIngestionForUser(userId = DEFAULT_USER_ID): IngestionResult {
  const existing = state.ingestionByUser.get(userId);
  if (existing) return existing;

  const result = runMockIngestion(mockMediaWindow, {
    userId,
    profile: getProfile(userId),
  });

  state.ingestionByUser.set(userId, result);
  return result;
}

function getDominantClusterId(ingestion: IngestionResult): string {
  return (
    ingestion?.mediaProfile?.learningSignals?.clusterAffinities?.[0]?.clusterId ||
    ingestion?.insights?.clusters?.[0]?.clusterId ||
    'food-ordering'
  );
}

function objectiveMatchesLanguage(objectiveId: unknown, lang: Lang): boolean {
  return typeof resolveObjectiveIdentity(objectiveId).canonicalObjectiveId === 'string' &&
    String(resolveObjectiveIdentity(objectiveId).canonicalObjectiveId).startsWith(`${lang}-`);
}

function buildPersonalizedObjective({
  userId,
  mode = 'hangout',
  lang = 'ko' as Lang,
  city = 'seoul' as CityId,
  location = 'food_street' as LocationId,
}) {
  const ingestion = ensureIngestionForUser(userId);
  const baseObjective = cloneJson(FIXTURES.objectivesNext as Record<string, any>);

  const dominantClusterId = getDominantClusterId(ingestion);
  const dominantCluster =
    ingestion?.insights?.clusters?.find((cluster) => cluster.clusterId === dominantClusterId) ||
    ingestion?.insights?.clusters?.[0];
  const placementCandidates = Array.isArray(ingestion?.mediaProfile?.learningSignals?.placementCandidates)
    ? ingestion.mediaProfile.learningSignals.placementCandidates
    : [];
  const selectedPlacement =
    placementCandidates.find(
      (candidate) =>
        candidate.city === city &&
        candidate.location === location &&
        candidate.mode === mode &&
        (candidate.objectiveId?.startsWith(`${lang}-`) || candidate.objectiveId === DEFAULT_OBJECTIVE_BY_LANG[lang]),
    ) ||
    placementCandidates.find(
      (candidate) =>
        candidate.city === city &&
        candidate.location === location &&
        candidate.mode === mode,
    ) ||
    null;

  const insightItems = Array.isArray(ingestion?.insights?.items) ? ingestion.insights.items : [];
  const langItems = insightItems.filter((item) => item.lang === lang);
  const scopedItems = langItems.length > 0 ? langItems : insightItems;
  const scopedClusterItems = dominantCluster
    ? scopedItems.filter((item) => item.clusterId === dominantCluster.clusterId)
    : scopedItems;

  let objectiveId =
    selectedPlacement?.objectiveId ||
    scopedClusterItems[0]?.objectiveLinks?.[0]?.objectiveId ||
    scopedItems[0]?.objectiveLinks?.[0]?.objectiveId ||
    baseObjective.objectiveId ||
    defaultObjectiveIdForLang(lang, DEFAULT_OBJECTIVE_BY_LANG[lang]);

  if (!objectiveMatchesLanguage(objectiveId, lang)) {
    const languageAlignedObjective =
      scopedItems.find((item) => objectiveMatchesLanguage(item?.objectiveLinks?.[0]?.objectiveId, lang))
        ?.objectiveLinks?.[0]?.objectiveId ||
      defaultObjectiveIdForLang(lang, DEFAULT_OBJECTIVE_BY_LANG[lang]);

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
    linkedNodeIds: [`overlay:${item.dominantSource}:${dominantClusterId}`, `target:${item.lemma}`],
  }));

  const resolvedObjective = resolveObjectiveIdentity(objectiveId);
  const objectiveNodeId = canonicalObjectiveNodeId(objectiveId);
  const objectiveCategory: ObjectiveCategory =
    (resolvedObjective.identity?.objectiveCategory as ObjectiveCategory | undefined) ||
    (lang === 'zh' ? 'conversation' : 'vocabulary');
  const prerequisiteByLang: Record<Lang, string[]> = {
    ko: ['ko-pron-food-words'],
    ja: [],
    zh: [],
  };

  return withObjectiveIdentity({
    ...baseObjective,
    mode,
    lang,
    objectiveGraph: {
      objectiveNodeId,
      cityId: city,
      locationId: location,
      objectiveCategory,
      targetNodeIds: vocabulary.map((term) => `target:${term}`),
      prerequisiteObjectiveIds: prerequisiteByLang[lang] || [],
      source: 'knowledge_graph',
    },
    coreTargets: {
      vocabulary: vocabulary.length > 0 ? vocabulary : [...(baseObjective.coreTargets?.vocabulary || [])],
      grammar: [...(LANG_TARGETS[lang]?.grammar || LANG_TARGETS.ko.grammar)],
      sentenceStructures: [...(LANG_TARGETS[lang]?.sentenceStructures || LANG_TARGETS.ko.sentenceStructures)],
    },
    personalizedTargets:
      personalizedTargets.length > 0 ? personalizedTargets : cloneJson(baseObjective.personalizedTargets || []),
    completionCriteria: {
      ...(baseObjective.completionCriteria || {}),
      minEvidenceEvents: baseObjective.completionCriteria?.minEvidenceEvents || 3,
      acceptedEvidenceModes: baseObjective.completionCriteria?.acceptedEvidenceModes || [
        'learn',
        'hangout',
        'mission',
      ],
    },
  }, objectiveId);
}

function buildGameStartResponse(userId: string, incomingProfile: Profile | null, sessionId: string) {
  const base = cloneJson(FIXTURES.gameStart as any);
  const profile = incomingProfile || getProfile(userId) || base.profile;
  const ingestion = ensureIngestionForUser(userId);
  const dominantClusterId = getDominantClusterId(ingestion);

  const city = CLUSTER_CITY_MAP[dominantClusterId] || base.city || 'seoul';
  const location = CLUSTER_LOCATION_MAP[dominantClusterId] || 'food_street';
  const sceneId = `${location}_hangout_intro`;
  const sceneSessionId = `scene_${sessionId}_001`;
  const checkpointId = `ckpt_${sessionId}_intro`;

  const ytMinutes = ingestion?.mediaProfile?.sourceBreakdown?.youtube?.minutes || 0;
  const spMinutes = ingestion?.mediaProfile?.sourceBreakdown?.spotify?.minutes || 0;
  const clusterCount = ingestion?.mediaProfile?.learningSignals?.clusterAffinities?.length || 0;
  const topTermCount = ingestion?.mediaProfile?.learningSignals?.topTerms?.length || 0;
  const crossSourceCount = ingestion?.frequency?.items?.filter((item) => Number(item.sourceCount || 0) > 1).length || 0;

  const xp = Math.round(Math.min(999, 35 + ytMinutes * 0.45 + spMinutes * 0.4 + topTermCount * 2));
  const sp = Math.round(Math.min(200, 12 + clusterCount * 8 + crossSourceCount * 3));
  const rp = Math.round(Math.min(100, 6 + crossSourceCount * 2 + clusterCount * 2));
  const currentMasteryLevel = xp >= 220 ? 3 : xp >= 140 ? 2 : 1;

  const weakestLang = getWeakestTargetLanguage(profile);
  const objective = buildPersonalizedObjective({
    userId,
    mode: 'hangout',
    lang: weakestLang,
    city,
    location,
  });
  const actions = [
    'Start hangout validation',
    'Review personalized learn targets',
    `Practice ${weakestLang.toUpperCase()} objective ${objective.objectiveId}`,
  ];
  const activeObjective = withObjectiveIdentity(
    {
      lang: weakestLang,
      mode: 'hangout',
      cityId: city,
      locationId: location,
      objectiveCategory: objective.objectiveGraph?.objectiveCategory,
      objectiveNodeId: objective.objectiveGraph?.objectiveNodeId,
      targetNodeIds: cloneJson(objective.objectiveGraph?.targetNodeIds || []),
      summary: base.gameSession?.activeObjective?.summary || `Practice ${weakestLang.toUpperCase()} in ${location}.`,
    },
    objective.objectiveId,
  );

  return {
    ...base,
    sessionId,
    city,
    location,
    mode: 'hangout',
    sceneId,
    profile: cloneJson(profile),
    progression: {
      xp,
      sp,
      rp,
      currentMasteryLevel,
    },
    actions,
    resumeSource: 'new_session',
    gameSession: {
      ...(base.gameSession || {}),
      sessionId,
      userId,
      profile: cloneJson(profile),
      cityId: city,
      locationId: location,
      currentMode: 'hangout',
      activeSceneId: sceneId,
      activeSceneSessionId: sceneSessionId,
      activeObjective,
      progression: {
        xp,
        sp,
        rp,
        currentMasteryLevel,
      },
      missionGate: cloneJson(base.gameSession?.missionGate || {}),
      unlocks: {
        ...(base.gameSession?.unlocks || {}),
        locationIds: [location],
      },
      rewards: cloneJson(base.gameSession?.rewards || []),
      availableActions: actions,
      resumeSource: 'new_session',
      activeCheckpointId: checkpointId,
    },
    sceneSession: {
      ...(base.sceneSession || {}),
      sceneSessionId,
      gameSessionId: sessionId,
      sceneId,
      cityId: city,
      locationId: location,
      mode: 'hangout',
      objective: activeObjective,
      route: {
        pathname: '/game',
        query: {
          city,
          location,
          mode: 'hangout',
        },
      },
    },
    activeCheckpoint: {
      ...(base.activeCheckpoint || {}),
      checkpointId,
      gameSessionId: sessionId,
      sceneSessionId,
      cityId: city,
      locationId: location,
      mode: 'hangout',
      objective: {
        ...activeObjective,
        summary: base.activeCheckpoint?.objective?.summary || 'Resume from the current safe intro boundary.',
      },
      route: {
        pathname: '/game',
        query: {
          city,
          location,
          mode: 'hangout',
          resume: '1',
        },
      },
    },
  };
}

function handleHangoutRespond(body: Record<string, any>) {
  const sceneSessionId = body.sceneSessionId;
  const userUtterance = String(body.userUtterance || '').trim();
  const existing = state.sceneSessions.get(sceneSessionId);

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
  const objectiveProgressDelta = matched ? 0.25 : 0.1;
  const sceneSession = existing.sceneSession;
  sceneSession.turn = Number(sceneSession.turn || 1) + 1;
  sceneSession.phase = 'dialogue';
  const nextLine =
    sceneSession.turn % 2 === 0 ? '좋아요, 맵기는 어느 정도로 할까요?' : '좋아요! 다음 주문도 한국어로 말해 볼까요?';

  if (!existing.gameSessionId) {
    sceneSession.score = cloneJson(sceneSession.score || { xp: 0, sp: 0, rp: 0 });
    sceneSession.score.xp += xpDelta;
    sceneSession.score.sp += spDelta;
    sceneSession.score.rp += rpDelta;
    state.sceneSessions.set(sceneSessionId, existing);

    return {
      statusCode: 200,
      payload: {
        accepted: true,
        feedback: {
          tongHint: matched
            ? 'Great phrasing. You used practical ordering language.'
            : 'Try adding a food word plus polite ending like 주세요.',
          objectiveProgressDelta,
        },
        nextLine: {
          speaker: 'character',
          text: nextLine,
        },
        state: {
          turn: sceneSession.turn,
          score: cloneJson(sceneSession.score),
        },
      },
    };
  }

  const gameRuntime = state.sessions.get(existing.gameSessionId);
  if (!gameRuntime) {
    return {
      statusCode: 404,
      payload: {
        error: 'unknown_game_session',
      },
    };
  }

  const storedResponse = cloneJson(gameRuntime.response);
  const gameSession = cloneJson(storedResponse?.gameSession || {});
  const currentProgression = cloneJson(gameSession.progression || storedResponse.progression || { xp: 0, sp: 0, rp: 0 });

  currentProgression.xp = Number(currentProgression.xp || 0) + xpDelta;
  currentProgression.sp = Number(currentProgression.sp || 0) + spDelta;
  currentProgression.rp = Number(currentProgression.rp || 0) + rpDelta;
  gameSession.progression = cloneJson(currentProgression);
  gameSession.missionGate = cloneJson(gameSession.missionGate || {});
  gameSession.missionGate.readiness = Math.min(
    1,
    Number(((Number(gameSession.missionGate.readiness || 0) + objectiveProgressDelta)).toFixed(2)),
  );

  sceneSession.progressionDelta = cloneJson(sceneSession.progressionDelta || buildInitialProgressionDelta());
  sceneSession.progressionDelta.xp = Number(sceneSession.progressionDelta.xp || 0) + xpDelta;
  sceneSession.progressionDelta.sp = Number(sceneSession.progressionDelta.sp || 0) + spDelta;
  sceneSession.progressionDelta.rp = Number(sceneSession.progressionDelta.rp || 0) + rpDelta;
  sceneSession.progressionDelta.objectiveProgressDelta = Number(
    ((Number(sceneSession.progressionDelta.objectiveProgressDelta || 0) + objectiveProgressDelta)).toFixed(2),
  );
  sceneSession.score = {
    xp: currentProgression.xp,
    sp: currentProgression.sp,
    rp: currentProgression.rp,
  };

  const nextCheckpoint = createNextCheckpoint(
    {
      ...storedResponse,
      gameSession,
    },
    existing,
    'turn_end',
  );
  gameSession.activeCheckpointId = nextCheckpoint.checkpointId;
  storedResponse.progression = cloneJson(currentProgression);
  storedResponse.gameSession = cloneJson(gameSession);
  storedResponse.gameSession.resumeSource = 'checkpoint';
  storedResponse.sceneSession = toSceneSessionPayload(sceneSession);
  storedResponse.activeCheckpoint = cloneJson(nextCheckpoint);
  storedResponse.resumeSource = 'checkpoint';
  gameRuntime.response = cloneJson(storedResponse);

  const response = {
    accepted: true,
    feedback: {
      tongHint: matched
        ? 'Great phrasing. You used practical ordering language.'
        : 'Try adding a food word plus polite ending like 주세요.',
      objectiveProgressDelta,
    },
    nextLine: {
      speaker: 'character',
      text: nextLine,
    },
    state: {
      turn: sceneSession.turn,
      score: cloneJson(currentProgression),
      objectiveProgress: sceneSession.progressionDelta.objectiveProgressDelta,
    },
    activeCheckpoint: cloneJson(nextCheckpoint),
    routeState: {
      sessionId: gameSession.sessionId,
      checkpointId: nextCheckpoint.checkpointId,
    },
  };

  state.sessions.set(String(gameSession.sessionId), gameRuntime);
  state.sceneSessions.set(sceneSessionId, existing);
  state.checkpoints.set(String(nextCheckpoint.checkpointId), cloneJson(nextCheckpoint));
  return { statusCode: 200, payload: response };
}

ensureIngestionForUser(DEFAULT_USER_ID);

async function handleRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') {
      return noContent();
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/health') {
      const env = (globalThis as any).__env;
      return jsonResponse(200, { ok: true, service: 'tong-api', hasResend: !!env?.RESEND_API_KEY, hasDB: !!env?.DB });
    }

    if (pathname === '/api/v1/captions/enriched' && request.method === 'GET') {
      const videoId = url.searchParams.get('videoId') || 'karina-variety-demo';
      const lang = getLang(url.searchParams);
      return jsonResponse(200, { ...getCaptionsForVideo(videoId), lang });
    }

    if (pathname === '/api/v1/dictionary/entry' && request.method === 'GET') {
      const term = url.searchParams.get('term') || (FIXTURES.dictionary as any).term;
      const entry = DICTIONARY_OVERRIDES[term] || {
        ...(cloneJson(FIXTURES.dictionary) as Record<string, unknown>),
        term,
      };
      return jsonResponse(200, entry);
    }

    if (pathname === '/api/v1/vocab/frequency' && request.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      return jsonResponse(200, ingestion.frequency || FIXTURES.frequency);
    }

    if (pathname === '/api/v1/vocab/insights' && request.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      return jsonResponse(200, ingestion.insights || FIXTURES.insights);
    }

    if (pathname === '/api/v1/player/media-profile' && request.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      return jsonResponse(200, ingestion.mediaProfile || { ...(FIXTURES.mediaProfile as any), userId });
    }

    if (pathname === '/api/v1/ingestion/run-mock' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const userId = body.userId || getUserIdFromSearch(url.searchParams);
      if (body.profile) upsertProfile(userId, { profile: body.profile });
      const includeSources = Array.isArray(body.includeSources)
        ? body.includeSources.filter((source: string) => source === 'youtube' || source === 'spotify')
        : [];
      const result = runMockIngestion(mockMediaWindow, {
        userId,
        profile: getProfile(userId),
        ...(includeSources.length > 0 ? { includeSources } : {}),
      });
      state.ingestionByUser.set(userId, result);

      return jsonResponse(200, {
        success: true,
        generatedAtIso: result.generatedAtIso,
        sourceCount: {
          youtube: result.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
          spotify: result.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
        },
        topTerms: result.frequency.items.slice(0, 10),
      });
    }

    if (pathname === '/api/v1/game/start-or-resume' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const userId = body.userId || DEFAULT_USER_ID;
      const incomingProfile = body.profile ? upsertProfile(userId, { profile: body.profile }) : null;
      const requestedSessionId =
        typeof body.sessionId === 'string' && body.sessionId.trim().length > 0 ? body.sessionId.trim() : null;
      const existingRuntime = findStoredGameRuntime(userId, requestedSessionId);

      if (existingRuntime) {
        return jsonResponse(200, buildStoredGameResponse(existingRuntime, 'checkpoint'));
      }

      const sessionId = `sess_${Math.random().toString(36).slice(2, 10)}`;
      const response = buildGameStartResponse(userId, incomingProfile, sessionId);
      storeGameRuntimeResponse(userId, response);

      return jsonResponse(200, response);
    }

    if (pathname === '/api/v1/profile/proficiency' && request.method === 'PUT') {
      const body = await readJsonBody(request);
      if (!body.userId) {
        return jsonResponse(400, { error: 'userId_required' });
      }

      const profile = upsertProfile(body.userId, body.profile ? { profile: body.profile } : body);
      const ingestion = ensureIngestionForUser(body.userId);
      return jsonResponse(200, { ok: true, profile, mediaProfile: ingestion.mediaProfile });
    }

    if (pathname === '/api/v1/objectives/next' && request.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const mode: Mode = url.searchParams.get('mode') === 'learn' ? 'learn' : 'hangout';
      const objective = buildPersonalizedObjective({
        userId,
        mode,
        lang: getLang(url.searchParams),
        city: getCityId(url.searchParams),
        location: getLocationId(url.searchParams),
      });
      return jsonResponse(200, objective);
    }

    if (pathname === '/api/v1/scenes/hangout/start' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const userId = body.userId || DEFAULT_USER_ID;
      const requestedSessionId =
        typeof body.sessionId === 'string' && body.sessionId.trim().length > 0 ? body.sessionId.trim() : null;
      const existingGameRuntime = findStoredGameRuntime(userId, requestedSessionId);

      if (existingGameRuntime) {
        const response = buildStoredGameResponse(existingGameRuntime, 'checkpoint');
        const sceneSessionId = String(response?.sceneSession?.sceneSessionId || '');
        const sceneRuntime = sceneSessionId ? state.sceneSessions.get(sceneSessionId) : null;
        const score = cloneJson(sceneRuntime?.sceneSession?.score || response?.gameSession?.progression || { xp: 0, sp: 0, rp: 0 });
        const turn = Number(sceneRuntime?.sceneSession?.turn || response?.activeCheckpoint?.turn || 1);

        return jsonResponse(200, {
          sceneSessionId,
          mode: 'hangout',
          uiPolicy: cloneJson(
            sceneRuntime?.sceneSession?.uiPolicy || {
              immersiveFirstPerson: true,
              allowOnlyDialogueAndHints: true,
            },
          ),
          resumeSource: response.resumeSource,
          checkpointId: response?.activeCheckpoint?.checkpointId || null,
          activeCheckpoint: cloneJson(response?.activeCheckpoint || null),
          state: {
            turn,
            score,
            objectiveProgress: Number(sceneRuntime?.sceneSession?.progressionDelta?.objectiveProgressDelta || 0),
          },
          initialLine: {
            speaker: 'character',
            text: turn > 1 ? '좋아요, 이어서 주문해 볼까요? 방금 멈춘 지점부터예요.' : '어서 와요! 오늘은 뭐 먹고 싶어요?',
          },
        });
      }

      const sceneSessionId = `hang_${Math.random().toString(36).slice(2, 8)}`;
      const sceneRuntime: WorkerSceneRuntime = {
        userId,
        gameSessionId: null,
        sceneSession: {
          sceneSessionId,
          gameSessionId: null,
          mode: 'hangout',
          phase: 'intro',
          turn: 1,
          progressionDelta: buildInitialProgressionDelta(),
          uiPolicy: {
            immersiveFirstPerson: true,
            allowOnlyDialogueAndHints: true,
          },
          score: {
            xp: 0,
            sp: 0,
            rp: 0,
          },
        },
      };

      state.sceneSessions.set(sceneSessionId, sceneRuntime);

      return jsonResponse(200, {
        sceneSessionId,
        mode: 'hangout',
        uiPolicy: cloneJson(sceneRuntime.sceneSession.uiPolicy),
        state: {
          turn: 1,
          score: cloneJson(sceneRuntime.sceneSession.score),
        },
        initialLine: {
          speaker: 'character',
          text: '어서 와요! 오늘은 뭐 먹고 싶어요?',
        },
      });
    }

    if (pathname === '/api/v1/scenes/hangout/respond' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const { statusCode, payload } = handleHangoutRespond(body);
      return jsonResponse(statusCode, payload);
    }

    if (pathname === '/api/v1/learn/sessions' && request.method === 'GET') {
      const items = [...state.learnSessions].sort((a: any, b: any) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      return jsonResponse(200, { items });
    }

    if (pathname === '/api/v1/learn/sessions' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const learnSessionId = `learn_${Math.random().toString(36).slice(2, 8)}`;
      const requestedObjectiveId =
        body.objectiveId ||
        defaultObjectiveIdForLang('ko', DEFAULT_OBJECTIVE_BY_LANG.ko) ||
        'ko-vocab-food-items';
      const resolvedObjective = resolveObjectiveIdentity(requestedObjectiveId);
      const title = `Food Street ${resolvedObjective.canonicalObjectiveId || 'Objective'} Drill`;
      const item = {
        learnSessionId,
        title,
        objectiveId: resolvedObjective.canonicalObjectiveId,
        lastMessageAt: new Date().toISOString(),
      };
      state.learnSessions.unshift(item);

      return jsonResponse(
        200,
        withObjectiveIdentity({
        learnSessionId,
        mode: 'learn',
        uiTheme: 'kakao_like',
        objectiveId: item.objectiveId,
        firstMessage: {
          speaker: 'tong',
          text: "New session started. We'll train 주문 phrases for your next hangout.",
        },
        }, item.objectiveId),
      );
    }

    /* ── Step 1: Signup — just save the email, no email yet ── */
    if (pathname === '/api/v1/signup' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse(400, { error: 'invalid_email' });
      }
      const env = (globalThis as any).__env;
      if (!env?.DB) return jsonResponse(500, { error: 'db_not_configured' });
      let isNew = true;
      try {
        await env.DB.prepare('INSERT INTO signups (email) VALUES (?)').bind(email).run();
      } catch (err: any) {
        if (err?.message?.includes('UNIQUE')) { isNew = false; } else { throw err; }
      }
      return jsonResponse(200, { ok: true, isNew });
    }

    /* ── Step 2a: Save preferences → send welcome email WITH prefs ── */
    if (pathname === '/api/v1/signup/preferences' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return jsonResponse(400, { error: 'email_required' });
      const prof = body.proficiency || {};
      const env = (globalThis as any).__env;
      if (!env?.DB) return jsonResponse(500, { error: 'db_not_configured' });
      const validLevels = ['none', 'beginner', 'intermediate', 'advanced', 'native'];
      const ko = validLevels.includes(prof.ko) ? prof.ko : 'none';
      const ja = validLevels.includes(prof.ja) ? prof.ja : 'none';
      const zh = validLevels.includes(prof.zh) ? prof.zh : 'none';
      const explain = body.explainIn || {};
      const validLangs = ['en', 'ko', 'ja', 'zh'];
      const exKo = validLangs.includes(explain.ko) ? explain.ko : 'en';
      const exJa = validLangs.includes(explain.ja) ? explain.ja : 'en';
      const exZh = validLangs.includes(explain.zh) ? explain.zh : 'en';
      await env.DB.prepare(
        `UPDATE signups SET proficiency_ko = ?, proficiency_ja = ?, proficiency_zh = ?, explain_ko = ?, explain_ja = ?, explain_zh = ?, has_preferences = 1, preferences_at = datetime('now') WHERE email = ?`
      ).bind(ko, ja, zh, exKo, exJa, exZh, email).run();

      // Send welcome email showing what they set
      const prefsUrl = `https://tong.berlayar.ai/?prefs=${encodeURIComponent(email)}`;
      const langLabel: Record<string, string> = { none: 'None', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', native: 'Native' };
      const explainLabel: Record<string, string> = { en: 'English', ko: '한국어', ja: '日本語', zh: '中文' };
      if (env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Tong <tong@berlayar.ai>',
            to: [email],
            subject: "You're on the list \uD83C\uDF89",
            html: `<div style="font-family:'Space Grotesk',system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#ffffff">
              <div style="text-align:center;margin-bottom:24px">
                <img src="https://tong.berlayar.ai/assets/app/logo_trimmed.png" alt="Tong" width="60" height="60" style="border-radius:12px"/>
              </div>
              <h1 style="font-size:28px;margin:0 0 8px;text-align:center;color:#1a1a2e">You're in.</h1>
              <p style="text-align:center;color:#555;font-size:15px;margin:0 0 28px;line-height:1.5">
                We'll fast-forward your onboarding when Tong launches. Here's what you told us:
              </p>
              <div style="background:#f5f5f7;border:1px solid #e0e0e0;border-radius:12px;padding:16px 20px;margin:0 0 24px">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 10px">
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1a1a2e">한국어 Korean</td>
                    <td align="right" style="font-size:14px;color:#555">${langLabel[ko] || ko}</td>
                    <td align="right" style="font-size:12px;color:#999;padding-left:8px">learn in ${explainLabel[exKo] || exKo}</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1a1a2e">日本語 Japanese</td>
                    <td align="right" style="font-size:14px;color:#555">${langLabel[ja] || ja}</td>
                    <td align="right" style="font-size:12px;color:#999;padding-left:8px">learn in ${explainLabel[exJa] || exJa}</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1a1a2e">中文 Chinese</td>
                    <td align="right" style="font-size:14px;color:#555">${langLabel[zh] || zh}</td>
                    <td align="right" style="font-size:12px;color:#999;padding-left:8px">learn in ${explainLabel[exZh] || exZh}</td>
                  </tr>
                </table>
                <p style="text-align:center;margin:12px 0 0">
                  <a href="${prefsUrl}" style="color:#ff6b2c;font-size:13px;font-weight:600;text-decoration:none">Edit levels &rarr;</a>
                </p>
              </div>
              <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px">
                The entire game is open source:
              </p>
              <p style="margin:0 0 24px">
                <a href="https://github.com/erniesg/tong" style="color:#ff6b2c;font-weight:600;font-size:14px">github.com/erniesg/tong</a>
              </p>
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 16px"/>
              <p style="color:#999;font-size:12px;margin:0;text-align:center">
                Tong &mdash; Built by <a href="https://berlayar.ai" style="color:#999">Berlayar</a>
              </p>
            </div>`,
          }),
        }).catch(() => {});
      }
      return jsonResponse(200, { ok: true });
    }

    /* ── Step 2b: Skipped preferences → send welcome email WITH prefs link ── */
    if (pathname === '/api/v1/signup/skip-preferences' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return jsonResponse(400, { error: 'email_required' });
      const env = (globalThis as any).__env;
      const prefsUrl = `https://tong.berlayar.ai/?prefs=${encodeURIComponent(email)}`;
      if (env?.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Tong <tong@berlayar.ai>',
            to: [email],
            subject: "You're on the list \uD83C\uDF89",
            html: `<div style="font-family:'Space Grotesk',system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#ffffff">
              <div style="text-align:center;margin-bottom:24px">
                <img src="https://tong.berlayar.ai/assets/app/logo_trimmed.png" alt="Tong" width="60" height="60" style="border-radius:12px"/>
              </div>
              <h1 style="font-size:28px;margin:0 0 8px;text-align:center;color:#1a1a2e">You're in.</h1>
              <p style="text-align:center;color:#555;font-size:15px;margin:0 0 28px;line-height:1.5">
                Tong is an open-source game where you play as a trainee in Seoul, Shanghai and Tokyo. Learn the language to build relationships &mdash; or burn them.
              </p>
              <div style="background:#f5f5f7;border:1px solid #e0e0e0;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center">
                <p style="color:#1a1a2e;font-size:15px;margin:0 0 4px;font-weight:600">
                  Want to skip the tutorial?
                </p>
                <p style="color:#666;font-size:13px;margin:0 0 16px;line-height:1.4">
                  Tell us your current level and we'll personalise your experience when Tong launches.
                </p>
                <a href="${prefsUrl}" style="display:inline-block;background:#ff6b2c;color:#fff;font-weight:700;font-size:14px;padding:10px 24px;border-radius:999px;text-decoration:none">
                  Set Language Levels &rarr;
                </a>
              </div>
              <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 8px">
                The entire game is open source:
              </p>
              <p style="margin:0 0 24px">
                <a href="https://github.com/erniesg/tong" style="color:#ff6b2c;font-weight:600;font-size:14px">github.com/erniesg/tong</a>
              </p>
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 16px"/>
              <p style="color:#999;font-size:12px;margin:0;text-align:center">
                Tong &mdash; Built by <a href="https://berlayar.ai" style="color:#999">Berlayar</a>
              </p>
            </div>`,
          }),
        }).catch(() => {});
      }
      return jsonResponse(200, { ok: true });
    }

    /* ── Send follow-up emails to signups missing preferences ── */
    if (pathname === '/api/v1/signup/follow-up' && request.method === 'POST') {
      const env = (globalThis as any).__env;
      if (!env?.DB || !env?.RESEND_API_KEY) {
        return jsonResponse(500, { error: 'not_configured' });
      }
      // Only email users who signed up > 1 day ago and never set preferences
      const { results } = await env.DB.prepare(
        `SELECT email FROM signups WHERE has_preferences = 0 AND created_at < datetime('now', '-1 day') AND source != 'followed_up'`
      ).all();
      let sent = 0;
      for (const row of results || []) {
        const prefsUrl = `https://tong.berlayar.ai/?prefs=${encodeURIComponent(row.email as string)}`;
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Tong <tong@berlayar.ai>',
            to: [row.email],
            subject: 'Quick question before Tong launches',
            html: `<div style="font-family:'Space Grotesk',system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#ffffff">
              <div style="text-align:center;margin-bottom:24px">
                <img src="https://tong.berlayar.ai/assets/app/logo_trimmed.png" alt="Tong" width="60" height="60" style="border-radius:12px"/>
              </div>
              <h1 style="font-size:22px;margin:0 0 12px;text-align:center;color:#1a1a2e">Quick question (optional)</h1>
              <p style="text-align:center;color:#555;font-size:15px;margin:0 0 20px;line-height:1.5">
                This is totally optional &mdash; but if you share your levels, we'll personalise your experience and skip content you've already mastered.
              </p>
              <div style="background:#f5f5f7;border:1px solid #e0e0e0;border-radius:12px;padding:16px;margin:0 0 20px">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 8px">
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1a1a2e;padding:0 0 0 4px" width="25%">한국어</td>
                    <td width="25%" align="center"><a href="${prefsUrl}&ko=0" style="color:#ff6b2c;font-size:13px;text-decoration:none">Zero</a></td>
                    <td width="25%" align="center"><a href="${prefsUrl}&ko=2" style="color:#ff6b2c;font-size:13px;text-decoration:none">Some</a></td>
                    <td width="25%" align="center"><a href="${prefsUrl}&ko=5" style="color:#ff6b2c;font-size:13px;text-decoration:none">Fluent</a></td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1a1a2e;padding:0 0 0 4px">日本語</td>
                    <td align="center"><a href="${prefsUrl}&ja=0" style="color:#ff6b2c;font-size:13px;text-decoration:none">Zero</a></td>
                    <td align="center"><a href="${prefsUrl}&ja=2" style="color:#ff6b2c;font-size:13px;text-decoration:none">Some</a></td>
                    <td align="center"><a href="${prefsUrl}&ja=5" style="color:#ff6b2c;font-size:13px;text-decoration:none">Fluent</a></td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1a1a2e;padding:0 0 0 4px">中文</td>
                    <td align="center"><a href="${prefsUrl}&zh=0" style="color:#ff6b2c;font-size:13px;text-decoration:none">Zero</a></td>
                    <td align="center"><a href="${prefsUrl}&zh=2" style="color:#ff6b2c;font-size:13px;text-decoration:none">Some</a></td>
                    <td align="center"><a href="${prefsUrl}&zh=5" style="color:#ff6b2c;font-size:13px;text-decoration:none">Fluent</a></td>
                  </tr>
                </table>
                <p style="text-align:center;margin:8px 0 0">
                  <a href="${prefsUrl}" style="color:#999;font-size:12px;text-decoration:underline">or set exact levels &rarr;</a>
                </p>
              </div>
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 16px"/>
              <p style="color:#999;font-size:12px;margin:0;text-align:center">
                Tong &mdash; Built by <a href="https://berlayar.ai" style="color:#999">Berlayar</a>
              </p>
            </div>`,
          }),
        }).catch(() => {});
        // Mark as followed up so we don't email again
        await env.DB.prepare(`UPDATE signups SET source = 'followed_up' WHERE email = ?`).bind(row.email).run();
        sent++;
      }
      return jsonResponse(200, { ok: true, sent });
    }

    return jsonResponse(404, { error: 'not_found', pathname });
  } catch (error) {
    return jsonResponse(500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export default {
  fetch(request: Request, env: Record<string, any>): Promise<Response> {
    (globalThis as any).__env = env;
    return handleRequest(request);
  },
};

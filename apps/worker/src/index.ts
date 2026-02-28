import captionsFixture from '../../../packages/contracts/fixtures/captions.enriched.sample.json';
import dictionaryFixture from '../../../packages/contracts/fixtures/dictionary.entry.sample.json';
import frequencyFixture from '../../../packages/contracts/fixtures/vocab.frequency.sample.json';
import insightsFixture from '../../../packages/contracts/fixtures/vocab.insights.sample.json';
import gameStartFixture from '../../../packages/contracts/fixtures/game.start-or-resume.sample.json';
import objectivesNextFixture from '../../../packages/contracts/fixtures/objectives.next.sample.json';
import learnSessionsFixture from '../../../packages/contracts/fixtures/learn.sessions.sample.json';
import mediaProfileFixture from '../../../packages/contracts/fixtures/player.media-profile.sample.json';
import mockMediaWindow from '../../server/data/mock-media-window.json';

type Lang = 'ko' | 'ja' | 'zh';
type Mode = 'hangout' | 'learn';

type Profile = {
  nativeLanguage: string;
  targetLanguages: Lang[];
  proficiency: {
    ko: string;
    ja: string;
    zh: string;
  };
};

type FrequencyItem = {
  lemma: string;
  lang: Lang;
  count: number;
  sourceCount: number;
  sourceBreakdown?: {
    youtube: number;
    spotify: number;
  };
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
    }>;
    items: Array<{
      lemma: string;
      lang: Lang;
      score: number;
      frequency: number;
      burst: number;
      clusterId: string;
      orthographyFeatures: Record<string, unknown>;
      objectiveLinks: Array<{ objectiveId: string; reason: string }>;
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
      }>;
      clusterAffinities: Array<{
        clusterId: string;
        label: string;
        score: number;
      }>;
    };
  };
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
  ko: 'ko_food_l2_001',
  ja: 'ko_city_l2_003',
  zh: 'zh_stage_l3_002',
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
    ],
    objectiveId: 'ko_food_l2_001',
  },
  {
    clusterId: 'performance-energy',
    label: 'Performance Energy',
    keywords: ['stage', 'performance', 'practice', 'dance', 'song', '무대', '연습', '노래', '火', '燃', '练习'],
    objectiveId: 'zh_stage_l3_002',
  },
  {
    clusterId: 'city-social',
    label: 'City Social',
    keywords: ['subway', 'station', 'street', 'friends', 'hangout', '지하철', '거리', '친구', '站', '街', '友達'],
    objectiveId: 'ko_city_l2_003',
  },
];

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

const state = {
  profiles: new Map<string, Profile>(),
  sessions: new Map<string, { userId: string; turn: number; score: { xp: number; sp: number; rp: number } }>(),
  learnSessions: [...(((FIXTURES.learnSessions as any).items || []) as Array<Record<string, unknown>>)],
  ingestionByUser: new Map<string, IngestionResult>(),
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
        objectiveId: 'ko_food_l2_001',
      },
    ];
  }

  return matches;
}

function sortFrequencyEntries(
  map: Map<
    string,
    {
      lemma: string;
      lang: Lang;
      count: number;
      sourceSet: Set<'youtube' | 'spotify'>;
      sourceBreakdown: { youtube: number; spotify: number };
    }
  >,
) {
  return [...map.entries()].sort((a, b) => {
    if (b[1].sourceSet.size !== a[1].sourceSet.size) {
      return b[1].sourceSet.size - a[1].sourceSet.size;
    }
    return b[1].count - a[1].count;
  });
}

function getLanguageLearningBoost(profile: Profile | null, lang: Lang): number {
  if (!profile || !Array.isArray(profile.targetLanguages) || profile.targetLanguages.length === 0) {
    return 1;
  }

  const targets = new Set(profile.targetLanguages);
  if (!targets.has(lang)) return 0.55;

  const level = profile?.proficiency?.[lang] || 'none';
  const rank = PROFICIENCY_RANK[level] ?? 0;
  const masteryGap = Math.max(0, 4 - rank);
  return Number((1 + masteryGap * 0.18).toFixed(2));
}

function stableTermJitter(userId: string, lemma: string): number {
  const seed = `${userId}:${lemma}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 10000;
  }
  return (hash % 17) / 1000;
}

function runMockIngestion(snapshot: any, options: { userId?: string; profile?: Profile | null } = {}): IngestionResult {
  const userId = options.userId || DEFAULT_USER_ID;
  const profile = options.profile || null;

  const frequencyMap = new Map<
    string,
    {
      lemma: string;
      lang: Lang;
      count: number;
      sourceSet: Set<'youtube' | 'spotify'>;
      sourceBreakdown: { youtube: number; spotify: number };
    }
  >();

  const topicStats = new Map<
    string,
    {
      clusterId: string;
      label: string;
      keywords: string[];
      count: number;
      terms: Map<string, number>;
      objectiveId: string;
    }
  >();

  const sourceBreakdown = {
    youtube: { itemsConsumed: 0, minutes: 0, topMedia: [] as Array<{ mediaId: string; title: string; lang: Lang; minutes: number }> },
    spotify: { itemsConsumed: 0, minutes: 0, topMedia: [] as Array<{ mediaId: string; title: string; lang: Lang; minutes: number }> },
  };

  const sourceItems = snapshot.sourceItems || [];

  for (const item of sourceItems) {
    const source: 'youtube' | 'spotify' = item.source === 'spotify' ? 'spotify' : 'youtube';
    sourceBreakdown[source].itemsConsumed += 1;
    sourceBreakdown[source].minutes += Number(item.minutes || 0);
    sourceBreakdown[source].topMedia.push({
      mediaId: item.id,
      title: item.title,
      lang: item.lang,
      minutes: Number(item.minutes || 0),
    });

    const tokens = extractTokens(item.text);
    const topics = getTopicMatches(`${item.title} ${item.text}`);

    for (const topic of topics) {
      const existingTopic = topicStats.get(topic.clusterId) || {
        clusterId: topic.clusterId,
        label: topic.label,
        keywords: topic.keywords.slice(0, 6),
        count: 0,
        terms: new Map<string, number>(),
        objectiveId: topic.objectiveId,
      };
      existingTopic.count += 1;
      topicStats.set(topic.clusterId, existingTopic);
    }

    for (const token of tokens) {
      const existing = frequencyMap.get(token) || {
        lemma: token,
        lang: item.lang,
        count: 0,
        sourceSet: new Set<'youtube' | 'spotify'>(),
        sourceBreakdown: { youtube: 0, spotify: 0 },
      };

      existing.count += 1;
      existing.sourceSet.add(source);
      existing.sourceBreakdown[source] += 1;
      frequencyMap.set(token, existing);

      for (const topic of topics) {
        const topicEntry = topicStats.get(topic.clusterId);
        if (!topicEntry) continue;
        if (!topicEntry.terms.has(token)) {
          topicEntry.terms.set(token, 0);
        }
        topicEntry.terms.set(token, (topicEntry.terms.get(token) || 0) + 1);
      }
    }
  }

  const sortedFrequency = sortFrequencyEntries(frequencyMap);
  const averageCount =
    sortedFrequency.length > 0
      ? sortedFrequency.reduce((sum, [, value]) => sum + value.count, 0) / sortedFrequency.length
      : 1;

  const frequencyItems: FrequencyItem[] = sortedFrequency.map(([, value]) => ({
    lemma: value.lemma,
    lang: value.lang,
    count: value.count,
    sourceCount: value.sourceSet.size,
    sourceBreakdown: value.sourceBreakdown,
  }));

  const sortedTopics = [...topicStats.values()].sort((a, b) => b.count - a.count);
  const clusters = sortedTopics.map((topic) => ({
    clusterId: topic.clusterId,
    label: topic.label,
    keywords: topic.keywords,
    topTerms: [...topic.terms.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([term]) => term),
  }));

  const insightsItems = sortedFrequency.slice(0, 30).map(([, value], index) => {
    const cluster =
      sortedTopics.find((topic) => topic.terms.has(value.lemma)) ||
      sortedTopics[0] || {
        clusterId: 'general',
        objectiveId: 'ko_food_l2_001',
      };

    const burst = Number((value.count / Math.max(averageCount, 1)).toFixed(2));
    const score = Number(
      (value.sourceSet.size * 3 + value.count * 0.8 + burst * 1.5 + (30 - index) * 0.03).toFixed(2),
    );

    return {
      lemma: value.lemma,
      lang: value.lang,
      score,
      frequency: value.count,
      burst,
      clusterId: cluster.clusterId,
      orthographyFeatures: {
        scriptType: detectScriptType(value.lemma),
      },
      objectiveLinks: [
        {
          objectiveId: cluster.objectiveId,
          reason: 'High recent recurrence across media sources',
        },
      ],
    };
  });

  const topTerms = frequencyItems.slice(0, 8);
  const topTopics = clusters.slice(0, 4).map((cluster, idx) => ({
    clusterId: cluster.clusterId,
    label: cluster.label,
    score: Number(Math.max(0.2, 0.95 - idx * 0.15).toFixed(2)),
  }));

  const rankedTopTerms = topTerms
    .map((item) => {
      const baseScore = item.count * item.sourceCount;
      const languageBoost = getLanguageLearningBoost(profile, item.lang);
      const weightedScore = Number((baseScore * languageBoost + stableTermJitter(userId, item.lemma)).toFixed(4));
      return { item, weightedScore };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const totalScore = rankedTopTerms.reduce((sum, entry) => sum + entry.weightedScore, 0) || 1;

  const learningSignals = {
    topTerms: rankedTopTerms.map(({ item, weightedScore }) => ({
      lemma: item.lemma,
      lang: item.lang,
      weightedScore: Number((weightedScore / totalScore).toFixed(2)),
      dominantSource:
        (item.sourceBreakdown?.youtube || 0) >= (item.sourceBreakdown?.spotify || 0)
          ? 'youtube'
          : 'spotify',
    })),
    clusterAffinities: topTopics,
  };

  return {
    generatedAtIso: new Date().toISOString(),
    frequency: {
      windowStartIso: snapshot.windowStartIso,
      windowEndIso: snapshot.windowEndIso,
      items: frequencyItems,
    },
    insights: {
      windowStartIso: snapshot.windowStartIso,
      windowEndIso: snapshot.windowEndIso,
      clusters,
      items: insightsItems,
    },
    mediaProfile: {
      userId,
      windowDays: 3,
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
  return typeof objectiveId === 'string' && objectiveId.startsWith(`${lang}_`);
}

function buildPersonalizedObjective({ userId, mode = 'hangout', lang = 'ko' as Lang }) {
  const ingestion = ensureIngestionForUser(userId);
  const baseObjective = cloneJson(FIXTURES.objectivesNext as Record<string, any>);

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
      vocabulary: vocabulary.length > 0 ? vocabulary : [...(baseObjective.coreTargets?.vocabulary || [])],
      grammar: [...(LANG_TARGETS[lang]?.grammar || LANG_TARGETS.ko.grammar)],
      sentenceStructures: [...(LANG_TARGETS[lang]?.sentenceStructures || LANG_TARGETS.ko.sentenceStructures)],
    },
    personalizedTargets:
      personalizedTargets.length > 0 ? personalizedTargets : cloneJson(baseObjective.personalizedTargets || []),
  };
}

function buildGameStartResponse(userId: string, incomingProfile: Profile | null) {
  const profile = incomingProfile || getProfile(userId) || (FIXTURES.gameStart as any).profile;
  const ingestion = ensureIngestionForUser(userId);
  const dominantClusterId = getDominantClusterId(ingestion);

  const city = CLUSTER_CITY_MAP[dominantClusterId] || (FIXTURES.gameStart as any).city || 'seoul';
  const location = CLUSTER_LOCATION_MAP[dominantClusterId] || 'food_street';

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
  });

  return {
    ...(cloneJson(FIXTURES.gameStart) as Record<string, unknown>),
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

function handleHangoutRespond(body: Record<string, any>) {
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
    existing.turn % 2 === 0 ? '좋아요, 맵기는 어느 정도로 할까요?' : '좋아요! 다음 주문도 한국어로 말해 볼까요?';

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

ensureIngestionForUser(DEFAULT_USER_ID);

async function handleRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') {
      return noContent();
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/health') {
      return jsonResponse(200, { ok: true, service: 'tong-api' });
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
      const result = runMockIngestion(mockMediaWindow, {
        userId,
        profile: getProfile(userId),
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
      });
      return jsonResponse(200, objective);
    }

    if (pathname === '/api/v1/scenes/hangout/start' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const sceneSessionId = `hang_${Math.random().toString(36).slice(2, 8)}`;
      const score = { xp: 0, sp: 0, rp: 0 };

      state.sessions.set(sceneSessionId, {
        userId: body.userId || DEFAULT_USER_ID,
        turn: 1,
        score: { ...score },
      });

      return jsonResponse(200, {
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
      const title = `Food Street ${body.objectiveId || 'Objective'} Drill`;
      const item = {
        learnSessionId,
        title,
        objectiveId: body.objectiveId || 'ko_food_l2_001',
        lastMessageAt: new Date().toISOString(),
      };
      state.learnSessions.unshift(item);

      return jsonResponse(200, {
        learnSessionId,
        mode: 'learn',
        uiTheme: 'kakao_like',
        objectiveId: item.objectiveId,
        firstMessage: {
          speaker: 'tong',
          text: "New session started. We'll train 주문 phrases for your next hangout.",
        },
      });
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
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};

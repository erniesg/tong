import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const GRAPH_NOW_MS = Date.parse('2026-03-08T09:00:00.000Z');

const CITY_LABELS = {
  seoul: 'Seoul',
  tokyo: 'Tokyo',
  shanghai: 'Shanghai',
};

const LOCATION_LABELS = {
  food_street: 'Food Street',
  cafe: 'Cafe',
  convenience_store: 'Convenience Store',
  subway_hub: 'Subway Hub',
  practice_studio: 'Practice Studio',
};

const CITY_LANG = {
  seoul: 'ko',
  tokyo: 'ja',
  shanghai: 'zh',
};

const DEFAULT_LOCATION_BY_CITY = {
  seoul: 'food_street',
  tokyo: 'food_street',
  shanghai: 'practice_studio',
};

const LEGACY_SHARED_LOCATIONS = [
  { locationId: 'food_street', label: 'Food Street' },
  { locationId: 'cafe', label: 'Cafe' },
  { locationId: 'convenience_store', label: 'Convenience Store' },
  { locationId: 'subway_hub', label: 'Subway Hub' },
  { locationId: 'practice_studio', label: 'Practice Studio' },
];

const VALID_CITIES = new Set(Object.keys(CITY_LABELS));
const LESSON_STATUSES = new Set(['available', 'due', 'learning']);
const COMPLETED_STATUSES = new Set(['validated', 'mastered']);
const BLOCKER_CLEAR_STATUSES = new Set(['due', 'validated', 'mastered']);
const LESSON_CATEGORY_PRIORITY = {
  grammar: 12,
  sentences: 10,
  conversation: 8,
  vocabulary: 6,
  pronunciation: 4,
  script: 2,
};

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const WORLD_MAP_REGISTRY = loadJson('packages/contracts/world-map-registry.sample.json');

const VALID_LOCATION_IDS = new Set(
  [
    ...Object.keys(LOCATION_LABELS),
    ...((WORLD_MAP_REGISTRY.cities || []).flatMap((city) =>
      (city.locations || []).flatMap((entry) => [
        entry.mapLocationId,
        entry.dagLocationSlot,
        ...((entry.legacyLocationIds || [])),
      ]),
    )),
  ].filter(Boolean),
);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function stableSlug(value) {
  const raw = String(value || '').trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalized) return normalized;
  return [...raw].map((char) => char.codePointAt(0).toString(16)).join('_');
}

function stableHashNumber(value) {
  const raw = String(value || '');
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getWorldMapCityRegistry(cityId) {
  return (WORLD_MAP_REGISTRY.cities || []).find((city) => city.cityId === cityId) || null;
}

function resolveWorldMapLocation(cityId, locationId = null) {
  const cityRegistry = getWorldMapCityRegistry(cityId);
  const fallbackLocationId = locationId || DEFAULT_LOCATION_BY_CITY[cityId] || 'food_street';

  if (!cityRegistry) {
    return {
      cityId,
      mapLocationId: fallbackLocationId,
      dagLocationSlot: fallbackLocationId,
      label: LOCATION_LABELS[fallbackLocationId] || fallbackLocationId.replace(/_/g, ' '),
      legacyLocationIds: [fallbackLocationId],
    };
  }

  const requestedLocationId = locationId || cityRegistry.defaultMapLocationId;
  const normalized = cityRegistry.locations.find(
    (entry) =>
      entry.mapLocationId === requestedLocationId ||
      entry.dagLocationSlot === requestedLocationId ||
      (entry.legacyLocationIds || []).includes(requestedLocationId),
  );
  const fallback = cityRegistry.locations.find((entry) => entry.mapLocationId === cityRegistry.defaultMapLocationId)
    || cityRegistry.locations[0];
  const mapLocationId = normalized?.mapLocationId || fallback?.mapLocationId || fallbackLocationId;
  const dagLocationSlot = normalized?.dagLocationSlot || fallback?.dagLocationSlot || fallbackLocationId;

  return {
    cityId,
    mapLocationId,
    dagLocationSlot,
    label:
      normalized?.label ||
      fallback?.label ||
      LOCATION_LABELS[dagLocationSlot] ||
      mapLocationId.replace(/_/g, ' '),
    legacyLocationIds: unique([dagLocationSlot, ...((normalized?.legacyLocationIds || []))]),
  };
}

function loadStarterPacks() {
  const packDir = path.join(repoRoot, 'assets/content-packs');
  return fs.readdirSync(packDir)
    .filter((fileName) => fileName.endsWith('.starter.json'))
    .sort()
    .map((fileName) => {
      const relativePath = path.join('assets/content-packs', fileName);
      const raw = loadJson(relativePath);
      if (!VALID_CITIES.has(raw.city)) return null;

      const requestedMapLocationId = raw.mapLocationId || raw.location?.id;
      if (!requestedMapLocationId) return null;

      const resolvedLocation = resolveWorldMapLocation(raw.city, requestedMapLocationId);
      return {
        relativePath,
        packId: raw.packId,
        templateVersion: raw.templateVersion || '1.0.0',
        cityId: raw.city,
        mapLocationId: resolvedLocation.mapLocationId,
        dagLocationSlot: raw.location?.id || resolvedLocation.dagLocationSlot,
        locationId: raw.location?.id || resolvedLocation.dagLocationSlot,
        lang: CITY_LANG[raw.city],
        title: `${CITY_LABELS[raw.city]} ${raw.playerFacingLocationLabel || resolvedLocation.label}`,
        playerFacingLocationLabel: raw.playerFacingLocationLabel || resolvedLocation.label,
        status: raw.status || 'draft',
        characterRoster: cloneJson(raw.characterRoster || []),
        objectiveSeed: cloneJson(raw.objectiveSeed || {}),
        manifestKeys: cloneJson(raw.manifestKeys || []),
        rewardHooks: cloneJson(raw.rewardHooks || {}),
      };
    })
    .filter(Boolean);
}

const STARTER_PACKS = loadStarterPacks();
const STARTER_PACK_BY_DAG_KEY = new Map(
  STARTER_PACKS.map((pack) => [keyFor(pack.cityId, pack.dagLocationSlot), pack]),
);
const STARTER_PACK_BY_MAP_KEY = new Map(
  STARTER_PACKS.map((pack) => [keyFor(pack.cityId, pack.mapLocationId), pack]),
);

function getStarterPackMetadata(cityId, locationId) {
  const resolvedLocation = resolveWorldMapLocation(cityId, locationId);
  return (
    STARTER_PACK_BY_MAP_KEY.get(keyFor(cityId, resolvedLocation.mapLocationId)) ||
    STARTER_PACK_BY_DAG_KEY.get(keyFor(cityId, resolvedLocation.dagLocationSlot)) ||
    null
  );
}

function getCityStarterPackCoverage(cityId) {
  const cityRegistry = getWorldMapCityRegistry(cityId);
  const liveMapLocationIds = (cityRegistry?.locations || []).map((entry) => entry.mapLocationId);
  const authoredMapLocationIds = liveMapLocationIds.filter((mapLocationId) =>
    Boolean(getStarterPackMetadata(cityId, mapLocationId)),
  );

  return {
    authoredCount: authoredMapLocationIds.length,
    totalCount: liveMapLocationIds.length,
  };
}

function keyFor(cityId, locationId) {
  return `${cityId}:${locationId}`;
}

function baseIso() {
  return new Date(GRAPH_NOW_MS).toISOString();
}

function isoHoursAgo(hours) {
  return new Date(GRAPH_NOW_MS - hours * 60 * 60 * 1000).toISOString();
}

function createGraphError(code, message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

export function isGraphRuntimeError(error) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      typeof error.code === 'string' &&
      typeof error.statusCode === 'number',
  );
}

const SEOUL_FOOD_STREET_PACK = loadJson(
  'packages/contracts/fixtures/location.curriculum-pack.seoul-food-street.sample.json',
);

function buildStarterPackStub(starterPack) {
  return {
    packId: starterPack.packId,
    version: starterPack.templateVersion,
    cityId: starterPack.cityId,
    locationId: starterPack.dagLocationSlot,
    lang: CITY_LANG[starterPack.cityId],
    title: `${CITY_LABELS[starterPack.cityId]} ${starterPack.playerFacingLocationLabel}`,
    summary:
      starterPack.objectiveSeed?.objectiveId
        ? `Starter pack scaffold is checked in for ${starterPack.playerFacingLocationLabel}. Seed objective: ${starterPack.objectiveSeed.objectiveId}.`
        : `Starter pack scaffold is checked in for ${starterPack.playerFacingLocationLabel}.`,
    goldStandard: false,
    contentVersionPolicy: 'append_only',
    nodes: [],
    edges: [],
    levels: [],
    scenarios: [],
    missions: [],
    content: {
      scriptTargets: [],
      pronunciationTargets: [],
      vocabularyTargets: [],
      grammarTargets: [],
      sentenceFrameTargets: [],
    },
    starterPackMetadata: {
      mapLocationId: starterPack.mapLocationId,
      playerFacingLocationLabel: starterPack.playerFacingLocationLabel,
      status: starterPack.status,
      characterRoster: cloneJson(starterPack.characterRoster || []),
      manifestKeys: cloneJson(starterPack.manifestKeys || []),
      objectiveSeed: cloneJson(starterPack.objectiveSeed || {}),
      rewardHooks: cloneJson(starterPack.rewardHooks || {}),
    },
  };
}

function buildStubPack(cityId, locationId) {
  const cityLabel = CITY_LABELS[cityId];
  const locationLabel = LOCATION_LABELS[locationId];
  const summaries = {
    [keyFor('tokyo', 'food_street')]:
      'Starter Japanese scaffold for the Tokyo food-street route. The canonical pack is still pending authoring.',
    [keyFor('shanghai', 'practice_studio')]:
      'Creator-focused Shanghai practice-studio route. Personalized overlays are ready before the authored pack lands.',
  };

  return {
    packId: `${cityId}_${locationId}_stub`,
    version: '0.1.0',
    cityId,
    locationId,
    lang: CITY_LANG[cityId],
    title: `${cityLabel} ${locationLabel}`,
    summary:
      summaries[keyFor(cityId, locationId)] ||
      `${cityLabel} ${locationLabel} is reserved for future authored curriculum packs.`,
    goldStandard: false,
    contentVersionPolicy: 'append_only',
    nodes: [],
    edges: [],
    levels: [],
    scenarios: [],
    missions: [],
    content: {
      scriptTargets: [],
      pronunciationTargets: [],
      vocabularyTargets: [],
      grammarTargets: [],
      sentenceFrameTargets: [],
    },
  };
}

function buildPackRegistry() {
  const registry = new Map();
  registry.set(keyFor('seoul', 'food_street'), SEOUL_FOOD_STREET_PACK);

  for (const starterPack of STARTER_PACKS) {
    const key = keyFor(starterPack.cityId, starterPack.dagLocationSlot);
    if (key === keyFor('seoul', 'food_street')) continue;
    if (!registry.has(key)) {
      registry.set(key, buildStarterPackStub(starterPack));
    }
  }

  for (const cityId of VALID_CITIES) {
    for (const locationId of Object.keys(LOCATION_LABELS)) {
      const key = keyFor(cityId, locationId);
      if (registry.has(key)) continue;
      registry.set(key, buildStubPack(cityId, locationId));
    }
  }

  return registry;
}

const PACK_REGISTRY = buildPackRegistry();
const KNOWN_NODE_IDS = new Set();
const PACK_BY_NODE_ID = new Map();
const LEGACY_NODE_ID_ALIASES = new Map([
  ['ko-script-consonants', 'ko-script-consonants-basic'],
  ['ko-script-vowels', 'ko-script-vowels-basic'],
]);

for (const pack of PACK_REGISTRY.values()) {
  for (const node of pack.nodes || []) {
    KNOWN_NODE_IDS.add(node.nodeId);
    if (!PACK_BY_NODE_ID.has(node.nodeId)) {
      PACK_BY_NODE_ID.set(node.nodeId, pack);
    }
  }
}

function seed(nodeId, options = {}) {
  return {
    nodeId,
    source: options.source || 'exercise',
    mode: options.mode || 'learn',
    correct: options.correct ?? true,
    qualityScore: options.qualityScore ?? 4,
    createdAt: options.createdAt || baseIso(),
    targetResults: cloneJson(options.targetResults || []),
    metadata: options.metadata,
  };
}

const PERSONAS = [
  {
    learnerId: 'persona_kpop_prompting',
    aliases: ['kpop-video-prompter'],
    userId: 'demo-user-1',
    displayName: 'K-pop creator learner',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: {
      ko: 'beginner',
      ja: 'beginner',
      zh: 'intermediate',
    },
    goals: [
      { lang: 'zh', topic: 'video prompting vocabulary' },
      { lang: 'ko', topic: 'K-pop and performance language' },
      { lang: 'ja', topic: 'beginner daily conversation' },
    ],
    mediaPreferences: {
      youtube: ['Chinese prompt engineering explainers', 'K-pop performance practice clips', 'Japanese travel vlogs'],
      spotify: ['aespa', 'IVE', 'NewJeans'],
    },
    topTerms: [
      { lemma: '镜头', lang: 'zh', source: 'youtube', weight: 0.86 },
      { lemma: '提示词', lang: 'zh', source: 'youtube', weight: 0.79 },
      { lemma: '무대', lang: 'ko', source: 'spotify', weight: 0.83 },
      { lemma: '안무', lang: 'ko', source: 'spotify', weight: 0.8 },
    ],
    seedEvidence: [
      seed('ko-script-consonants-basic', { qualityScore: 4, createdAt: isoHoursAgo(220) }),
      seed('ko-script-consonants-basic', { qualityScore: 4, createdAt: isoHoursAgo(204) }),
      seed('ko-script-consonants-basic', { qualityScore: 4, createdAt: isoHoursAgo(188) }),
      seed('ko-script-vowels-basic', { qualityScore: 4, createdAt: isoHoursAgo(214) }),
      seed('ko-script-vowels-basic', { qualityScore: 4, createdAt: isoHoursAgo(198) }),
      seed('ko-script-vowels-basic', { qualityScore: 4, createdAt: isoHoursAgo(182) }),
      seed('ko-script-blocks-2part', { qualityScore: 4, createdAt: isoHoursAgo(176) }),
      seed('ko-script-blocks-2part', { qualityScore: 4, createdAt: isoHoursAgo(164) }),
      seed('ko-script-blocks-2part', { qualityScore: 4, createdAt: isoHoursAgo(152) }),
      seed('ko-script-menu-reading', { qualityScore: 5, createdAt: isoHoursAgo(160) }),
      seed('ko-script-menu-reading', { qualityScore: 4, createdAt: isoHoursAgo(136) }),
      seed('ko-script-menu-reading', { qualityScore: 5, createdAt: isoHoursAgo(116) }),
      seed('ko-pron-jamo-all', { qualityScore: 4, createdAt: isoHoursAgo(144) }),
      seed('ko-pron-jamo-all', { qualityScore: 4, createdAt: isoHoursAgo(124) }),
      seed('ko-pron-jamo-all', { qualityScore: 4, createdAt: isoHoursAgo(108) }),
      seed('ko-pron-food-words', { qualityScore: 4, createdAt: isoHoursAgo(96) }),
      seed('ko-pron-food-words', { qualityScore: 4, createdAt: isoHoursAgo(80) }),
      seed('ko-pron-food-words', { qualityScore: 4, createdAt: isoHoursAgo(68) }),
      seed('ko-vocab-food-items', { qualityScore: 4, createdAt: isoHoursAgo(52) }),
      seed('ko-vocab-food-items', { qualityScore: 3, createdAt: isoHoursAgo(36) }),
      seed('ko-vocab-food-items', { qualityScore: 4, createdAt: isoHoursAgo(18) }),
      seed('ko-vocab-courtesy', { qualityScore: 4, createdAt: isoHoursAgo(112) }),
      seed('ko-vocab-courtesy', { qualityScore: 4, createdAt: isoHoursAgo(92) }),
    ],
  },
  {
    learnerId: 'persona_beginner_foundation',
    aliases: ['quiet-beginner'],
    userId: 'demo-user-beginner',
    displayName: 'No-media beginner',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: {
      ko: 'beginner',
      ja: 'none',
      zh: 'none',
    },
    goals: [{ lang: 'ko', topic: 'reading and food ordering basics' }],
    mediaPreferences: {
      youtube: [],
      spotify: [],
    },
    topTerms: [],
    seedEvidence: [
      seed('ko-script-consonants-basic', { qualityScore: 2, createdAt: isoHoursAgo(34) }),
      seed('ko-script-consonants-basic', { qualityScore: 2, createdAt: isoHoursAgo(18) }),
      seed('ko-script-vowels-basic', { qualityScore: 2, createdAt: isoHoursAgo(22) }),
    ],
  },
  {
    learnerId: 'persona_mixed_progress',
    aliases: ['mixed-intermediate'],
    userId: 'demo-user-mixed',
    displayName: 'Mixed progress learner',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: {
      ko: 'intermediate',
      ja: 'beginner',
      zh: 'beginner',
    },
    goals: [
      { lang: 'ko', topic: 'casual hangout fluency' },
      { lang: 'zh', topic: 'food and app navigation' },
    ],
    mediaPreferences: {
      youtube: ['Korean street food channels', 'Chinese app tutorials'],
      spotify: ['IU', 'Radwimps'],
    },
    topTerms: [
      { lemma: '주문', lang: 'ko', source: 'youtube', weight: 0.9 },
      { lemma: '메뉴', lang: 'ko', source: 'youtube', weight: 0.82 },
      { lemma: '导航', lang: 'zh', source: 'youtube', weight: 0.7 },
    ],
    seedEvidence: [
      seed('ko-script-consonants-basic', { qualityScore: 4, createdAt: isoHoursAgo(210) }),
      seed('ko-script-consonants-basic', { qualityScore: 4, createdAt: isoHoursAgo(194) }),
      seed('ko-script-consonants-basic', { qualityScore: 4, createdAt: isoHoursAgo(178) }),
      seed('ko-script-vowels-basic', { qualityScore: 4, createdAt: isoHoursAgo(206) }),
      seed('ko-script-vowels-basic', { qualityScore: 4, createdAt: isoHoursAgo(190) }),
      seed('ko-script-vowels-basic', { qualityScore: 4, createdAt: isoHoursAgo(174) }),
      seed('ko-script-blocks-2part', { qualityScore: 4, createdAt: isoHoursAgo(166) }),
      seed('ko-script-blocks-2part', { qualityScore: 4, createdAt: isoHoursAgo(154) }),
      seed('ko-script-blocks-2part', { qualityScore: 4, createdAt: isoHoursAgo(142) }),
      seed('ko-script-menu-reading', { qualityScore: 5, createdAt: isoHoursAgo(150) }),
      seed('ko-script-menu-reading', { qualityScore: 5, createdAt: isoHoursAgo(126) }),
      seed('ko-script-menu-reading', { qualityScore: 5, createdAt: isoHoursAgo(102) }),
      seed('ko-pron-jamo-all', { qualityScore: 4, createdAt: isoHoursAgo(132) }),
      seed('ko-pron-jamo-all', { qualityScore: 4, createdAt: isoHoursAgo(116) }),
      seed('ko-pron-jamo-all', { qualityScore: 5, createdAt: isoHoursAgo(98) }),
      seed('ko-pron-food-words', { qualityScore: 4, createdAt: isoHoursAgo(88) }),
      seed('ko-pron-food-words', { qualityScore: 5, createdAt: isoHoursAgo(64) }),
      seed('ko-pron-food-words', { qualityScore: 4, createdAt: isoHoursAgo(40) }),
      seed('ko-vocab-food-items', { qualityScore: 5, createdAt: isoHoursAgo(90) }),
      seed('ko-vocab-food-items', { qualityScore: 4, createdAt: isoHoursAgo(56) }),
      seed('ko-vocab-food-items', { qualityScore: 4, createdAt: isoHoursAgo(28) }),
      seed('ko-vocab-food-items', { qualityScore: 5, mode: 'hangout', source: 'hangout', createdAt: isoHoursAgo(10) }),
      seed('ko-vocab-courtesy', { qualityScore: 4, createdAt: isoHoursAgo(82) }),
      seed('ko-vocab-courtesy', { qualityScore: 4, createdAt: isoHoursAgo(48) }),
      seed('ko-vocab-courtesy', { qualityScore: 4, mode: 'hangout', source: 'hangout', createdAt: isoHoursAgo(12) }),
      seed('ko-gram-juseyo', { qualityScore: 4, createdAt: isoHoursAgo(38) }),
      seed('ko-gram-juseyo', { qualityScore: 5, mode: 'hangout', source: 'hangout', createdAt: isoHoursAgo(14) }),
      seed('ko-vocab-numbers', { qualityScore: 3, createdAt: isoHoursAgo(8) }),
    ],
  },
];

const runtimeEvidenceByLearner = new Map();
const runtimeLearnersByLearnerId = new Map();
const runtimeLearnerIdByUserId = new Map();

export const GRAPH_TOOL_DEFINITIONS = [
  {
    name: 'graph.dashboard.get',
    description: 'Fetch the learner-specific curriculum graph dashboard using the shared contract shape.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional) – stable learner identifier',
      personaId: 'string (optional) – legacy alias accepted for demo personas',
      userId: 'string (optional)',
      city: 'seoul|tokyo|shanghai (optional)',
      location: 'food_street|cafe|convenience_store|subway_hub|practice_studio (optional)',
    },
  },
  {
    name: 'graph.next_actions.get',
    description: 'Get graph-derived lesson, review, mission, hangout, and overlay recommendations.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      limit: 'number (optional, default 4)',
    },
  },
  {
    name: 'graph.lesson_bundle.get',
    description: 'Return the next graph-driven lesson bundle for the selected pack.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      city: 'seoul|tokyo|shanghai (optional)',
      location: 'food_street|cafe|convenience_store|subway_hub|practice_studio (optional)',
    },
  },
  {
    name: 'graph.hangout_bundle.get',
    description: 'Return the next graph-driven hangout bundle when scenario readiness is sufficient.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      city: 'seoul|tokyo|shanghai (optional)',
      location: 'food_street|cafe|convenience_store|subway_hub|practice_studio (optional)',
    },
  },
  {
    name: 'graph.evidence.record',
    description: 'Record a learner evidence event and return the updated canonical node state.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      event: 'object – evidence event { nodeId, mode, quality|qualityScore, source, correct, createdAt }',
    },
  },
  {
    name: 'graph.pack.validate',
    description: 'Validate a curriculum pack against the shared curriculum-graph contract.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      pack: 'object (optional) – custom curriculum pack; defaults to the canonical Seoul pack',
    },
  },
  {
    name: 'graph.overlay.propose',
    description: 'Propose personalized overlay branches derived from learner goals and media behavior.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      lang: 'ko|ja|zh (optional)',
      theme: 'string (optional)',
      count: 'number (optional, default 5)',
    },
  },
];

function deriveRuntimePrimaryLang(args = {}) {
  if (args.lang && ['ko', 'ja', 'zh'].includes(args.lang)) {
    return args.lang;
  }

  const cityId = args.city || inferCityFromLocation(args.location) || 'seoul';
  return CITY_LANG[cityId] || 'ko';
}

function buildRuntimeLearner(learnerIdOrAlias, userId, args = {}) {
  const primaryLang = deriveRuntimePrimaryLang(args);
  const learnerId =
    learnerIdOrAlias && learnerIdOrAlias.trim()
      ? learnerIdOrAlias.trim()
      : `learner_${stableSlug(userId || `${primaryLang}_runtime`)}`;
  const existing =
    runtimeLearnersByLearnerId.get(learnerId) ||
    (userId ? runtimeLearnersByLearnerId.get(runtimeLearnerIdByUserId.get(userId)) : null);
  if (existing) return existing;

  const proficiency = {
    ko: 'none',
    ja: 'none',
    zh: 'none',
  };
  proficiency[primaryLang] = 'beginner';

  const learner = {
    learnerId,
    aliases: [],
    userId: userId || learnerId,
    displayName: args.displayName || `${CITY_LABELS[args.city || 'seoul'] || 'Seoul'} learner`,
    targetLanguages: [primaryLang],
    proficiency,
    goals: [],
    mediaPreferences: {
      youtube: [],
      spotify: [],
    },
    topTerms: [],
    seedEvidence: [],
  };

  runtimeLearnersByLearnerId.set(learnerId, learner);
  runtimeLearnerIdByUserId.set(learner.userId, learnerId);
  return learner;
}

function getPersona(learnerIdOrAlias, userId, args = {}) {
  if (learnerIdOrAlias) {
    const byId = PERSONAS.find(
      (persona) =>
        persona.learnerId === learnerIdOrAlias ||
        persona.aliases.includes(learnerIdOrAlias),
    );
    if (byId) return byId;
  }

  if (userId) {
    const byUser = PERSONAS.find((persona) => persona.userId === userId);
    if (byUser) return byUser;
  }

  if (learnerIdOrAlias || userId) {
    return buildRuntimeLearner(learnerIdOrAlias, userId, args);
  }

  return PERSONAS[0];
}

function getPersonaFromArgs(args = {}) {
  return getPersona(args.learnerId || args.personaId, args.userId, args);
}

function getRuntimeEvidence(learnerId) {
  if (!runtimeEvidenceByLearner.has(learnerId)) {
    runtimeEvidenceByLearner.set(learnerId, []);
  }
  return runtimeEvidenceByLearner.get(learnerId);
}

function normalizeSeedEvent(event, learnerId, index) {
  return {
    eventId: typeof event.eventId === 'string' ? event.eventId : `seed:${learnerId}:${index + 1}`,
    learnerId,
    nodeId: event.nodeId,
    source: event.source,
    mode: event.mode,
    correct: event.correct,
    qualityScore: event.qualityScore,
    createdAt: event.createdAt,
    targetResults: cloneJson(event.targetResults || []),
    metadata: event.metadata,
  };
}

function materializeEvidence(persona) {
  const seedEvidence = persona.seedEvidence.map((event, index) =>
    normalizeSeedEvent(event, persona.learnerId, index),
  );
  const runtimeEvidence = getRuntimeEvidence(persona.learnerId);
  return [...seedEvidence, ...runtimeEvidence].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

function normalizeCity(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!VALID_CITIES.has(value)) {
    throw createGraphError('invalid_graph_city', `Unknown graph city "${value}".`, 400, {
      city: value,
    });
  }
  return value;
}

function normalizeLocation(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!VALID_LOCATION_IDS.has(value)) {
    throw createGraphError('invalid_graph_location', `Unknown graph location "${value}".`, 400, {
      location: value,
    });
  }
  return value;
}

function inferCityFromLocation(locationId) {
  if (!locationId) return null;
  for (const city of WORLD_MAP_REGISTRY.cities || []) {
    const matches = (city.locations || []).some(
      (entry) =>
        entry.mapLocationId === locationId ||
        entry.dagLocationSlot === locationId ||
        (entry.legacyLocationIds || []).includes(locationId),
    );
    if (matches) return city.cityId;
  }
  return null;
}

function resolveSelection(args = {}) {
  const requestedLocation = normalizeLocation(args.location);
  const requestedCity = normalizeCity(args.city) || inferCityFromLocation(requestedLocation) || 'seoul';
  const requestedLocationId = requestedLocation || DEFAULT_LOCATION_BY_CITY[requestedCity];
  const resolvedLocation = resolveWorldMapLocation(requestedCity, requestedLocationId);
  const pack = getStarterPackMetadata(requestedCity, requestedLocationId)
    || PACK_REGISTRY.get(keyFor(requestedCity, resolvedLocation.dagLocationSlot));

  if (!pack) {
    throw createGraphError(
      'graph_pack_not_found',
      `No curriculum pack is registered for ${requestedCity}/${requestedLocationId}.`,
      404,
      {
        city: requestedCity,
        location: requestedLocationId,
      },
    );
  }

  return {
    cityId: requestedCity,
    locationId: resolvedLocation.dagLocationSlot,
    mapLocationId: resolvedLocation.mapLocationId,
    pack,
  };
}

function buildPackIndex(pack) {
  const nodeById = new Map((pack.nodes || []).map((node) => [node.nodeId, node]));
  const orderByNodeId = new Map();

  for (const level of pack.levels || []) {
    (level.objectiveNodeIds || []).forEach((nodeId, index) => {
      orderByNodeId.set(nodeId, { level: level.level, index });
    });
  }

  const objectiveNodes = (pack.nodes || [])
    .filter((node) => node.type === 'objective')
    .sort((left, right) => {
      const leftOrder = orderByNodeId.get(left.nodeId) || { level: left.level || 0, index: 0 };
      const rightOrder = orderByNodeId.get(right.nodeId) || { level: right.level || 0, index: 0 };
      if (leftOrder.level !== rightOrder.level) return leftOrder.level - rightOrder.level;
      return leftOrder.index - rightOrder.index;
    });

  const blockersByNodeId = new Map(objectiveNodes.map((node) => [node.nodeId, []]));
  const supportsByNodeId = new Map(objectiveNodes.map((node) => [node.nodeId, []]));
  const unlocksByNodeId = new Map(objectiveNodes.map((node) => [node.nodeId, []]));

  for (const edge of pack.edges || []) {
    if (!nodeById.has(edge.toNodeId) || !nodeById.has(edge.fromNodeId)) continue;
    if (!supportsByNodeId.has(edge.toNodeId)) continue;

    if (edge.type === 'requires' || edge.type === 'unlocks') {
      blockersByNodeId.get(edge.toNodeId).push(edge.fromNodeId);
      supportsByNodeId.get(edge.toNodeId).push(edge.fromNodeId);
      if (unlocksByNodeId.has(edge.fromNodeId)) {
        unlocksByNodeId.get(edge.fromNodeId).push(edge.toNodeId);
      }
      continue;
    }

    if (edge.type === 'reinforces') {
      supportsByNodeId.get(edge.toNodeId).push(edge.fromNodeId);
    }
  }

  for (const [nodeId, blockerIds] of blockersByNodeId) {
    blockersByNodeId.set(nodeId, unique(blockerIds));
  }

  for (const [nodeId, supportIds] of supportsByNodeId) {
    supportsByNodeId.set(nodeId, unique(supportIds));
  }

  for (const [nodeId, unlockIds] of unlocksByNodeId) {
    unlocksByNodeId.set(nodeId, unique(unlockIds));
  }

  return {
    nodeById,
    objectiveNodes,
    blockersByNodeId,
    supportsByNodeId,
    unlocksByNodeId,
  };
}

function summarizeEvidence(events, nodeIds) {
  const summary = new Map();

  for (const event of events) {
    if (!nodeIds.has(event.nodeId)) continue;
    const existing = summary.get(event.nodeId) || {
      count: 0,
      correctCount: 0,
      totalQualityScore: 0,
      hangoutCount: 0,
      missionCount: 0,
      reviewCount: 0,
      lastCreatedAt: null,
    };

    existing.count += 1;
    existing.correctCount += event.correct ? 1 : 0;
    existing.totalQualityScore += Number(event.qualityScore) || 0;
    if (event.mode === 'hangout') existing.hangoutCount += 1;
    if (event.mode === 'mission') existing.missionCount += 1;
    if (event.mode === 'review') existing.reviewCount += 1;
    existing.lastCreatedAt =
      !existing.lastCreatedAt || event.createdAt > existing.lastCreatedAt
        ? event.createdAt
        : existing.lastCreatedAt;

    summary.set(event.nodeId, existing);
  }

  return summary;
}

function computeMasteryScore(record) {
  if (!record || record.count === 0) return 0;

  const averageQuality = clamp01(record.totalQualityScore / Math.max(record.count, 1) / 5);
  const accuracy = clamp01(record.correctCount / Math.max(record.count, 1));
  const engagementBonus = Math.min(Math.max(record.count - 1, 0) * 0.04, 0.12);
  const hangoutBonus = Math.min(record.hangoutCount * 0.08, 0.16);
  const missionBonus = Math.min(record.missionCount * 0.12, 0.24);
  const reviewBonus = Math.min(record.reviewCount * 0.03, 0.06);

  return clamp01(
    averageQuality * 0.65 +
      accuracy * 0.25 +
      engagementBonus +
      hangoutBonus +
      missionBonus +
      reviewBonus,
  );
}

function buildRecommendedReason(node, status, blockers) {
  if (blockers.length > 0) {
    return `${node.title} is still blocked by ${blockers.length} prerequisite${blockers.length === 1 ? '' : 's'}.`;
  }

  if (status === 'due') {
    return `${node.title} is due for review before the next validation scene.`;
  }

  if (status === 'available') {
    return `${node.title} is unlocked and ready for a focused lesson.`;
  }

  if (status === 'learning') {
    return `${node.title} has partial evidence and benefits from another guided session.`;
  }

  if (status === 'validated') {
    return `${node.title} is validated and can support the next hangout bundle.`;
  }

  if (status === 'mastered') {
    return `${node.title} is stable enough to unlock more advanced objectives.`;
  }

  return undefined;
}

function shortNodeTitle(node) {
  const title = String(node?.title || '').trim();
  if (!title) return 'objective';
  if (title.startsWith('Learn ')) return title.slice(6);
  if (title.startsWith('Master ')) return title.slice(7);
  return title;
}

function normalizeTargetIdentifier(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
    .trim();
}

function resolveCanonicalTargetId(targetLookup, value) {
  if (!targetLookup || targetLookup.size === 0) return '';
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = normalizeTargetIdentifier(raw);
  return targetLookup.get(raw) || targetLookup.get(normalized) || '';
}

function computeTargetCoverageCount(event, totalTargetCount) {
  if (totalTargetCount <= 0) return 0;
  if (event.mode === 'mission') return Math.min(totalTargetCount, 3);
  if (event.mode === 'hangout') return Math.min(totalTargetCount, 2);
  if (event.qualityScore >= 4.5) return Math.min(totalTargetCount, 3);
  if (event.qualityScore >= 3) return Math.min(totalTargetCount, 2);
  return 1;
}

function computeTargetMasteryScore(record) {
  if (!record || record.count === 0) return 0;
  const averageQuality = clamp01(record.totalQualityScore / Math.max(record.count, 1) / 5);
  const accuracy = clamp01(record.correctCount / Math.max(record.count, 1));
  const repetitionBonus = Math.min(Math.max(record.count - 1, 0) * 0.12, 0.28);
  return clamp01(averageQuality * 0.55 + accuracy * 0.25 + repetitionBonus);
}

function deriveNodeTargetProgress(node, nodeEvents = []) {
  const targetIds = unique(node.targetItemIds || []);
  if (targetIds.length === 0) {
    return {
      nodeId: node.nodeId,
      totalTargetCount: 0,
      completedTargetCount: 0,
      completionRatio: 0,
      remainingTargetIds: [],
      weakTargetIds: [],
      lastPracticedTargetIds: [],
    };
  }

  const targetLookup = new Map();
  for (const targetId of targetIds) {
    targetLookup.set(targetId, targetId);
    targetLookup.set(normalizeTargetIdentifier(targetId), targetId);
  }

  const statsByTargetId = new Map(
    targetIds.map((targetId) => [
      targetId,
      {
        count: 0,
        correctCount: 0,
        totalQualityScore: 0,
        lastCreatedAt: null,
      },
    ]),
  );

  const orderedEvents = [...nodeEvents].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const event of orderedEvents) {
    const explicitTargets = Array.isArray(event.targetResults)
      ? event.targetResults
          .map((result) => {
            if (!result) return null;
            const rawTargetId =
              typeof result === 'string'
                ? result
                : typeof result.targetId === 'string'
                  ? result.targetId
                  : '';
            const canonicalTargetId = resolveCanonicalTargetId(targetLookup, rawTargetId);
            if (!canonicalTargetId) return null;
            return {
              targetId: canonicalTargetId,
              correct:
                typeof result === 'string'
                  ? event.correct
                  : typeof result.correct === 'boolean'
                    ? result.correct
                    : event.correct,
              qualityScore:
                typeof result === 'string'
                  ? event.qualityScore
                  : Number.isFinite(Number(result.qualityScore))
                    ? Number(result.qualityScore)
                    : event.qualityScore,
            };
          })
          .filter(Boolean)
      : [];

    const updates =
      explicitTargets.length > 0
        ? explicitTargets
        : (() => {
            const coverageCount = computeTargetCoverageCount(event, targetIds.length);
            const startIndex =
              stableHashNumber(`${node.nodeId}:${event.eventId}:${event.createdAt}`) % targetIds.length;
            return Array.from({ length: coverageCount }, (_, offset) => ({
              targetId: targetIds[(startIndex + offset) % targetIds.length],
              correct: event.correct,
              qualityScore: event.qualityScore,
            }));
          })();

    for (const update of updates) {
      const stats = statsByTargetId.get(update.targetId);
      if (!stats) continue;
      stats.count += 1;
      stats.correctCount += update.correct ? 1 : 0;
      stats.totalQualityScore += Number(update.qualityScore) || 0;
      stats.lastCreatedAt =
        !stats.lastCreatedAt || event.createdAt > stats.lastCreatedAt
          ? event.createdAt
          : stats.lastCreatedAt;
    }
  }

  const completedTargetIds = [];
  const weakTargetIds = [];

  for (const targetId of targetIds) {
    const stats = statsByTargetId.get(targetId);
    const masteryScore = computeTargetMasteryScore(stats);
    if (masteryScore >= 0.6 && stats.correctCount > 0) {
      completedTargetIds.push(targetId);
      continue;
    }
    if (stats.count > 0) {
      weakTargetIds.push(targetId);
    }
  }

  const remainingTargetIds = targetIds.filter((targetId) => !completedTargetIds.includes(targetId));
  const lastPracticedTargetIds = [...targetIds]
    .filter((targetId) => statsByTargetId.get(targetId)?.lastCreatedAt)
    .sort((left, right) =>
      (statsByTargetId.get(right)?.lastCreatedAt || '').localeCompare(
        statsByTargetId.get(left)?.lastCreatedAt || '',
      ),
    )
    .slice(0, 5);

  return {
    nodeId: node.nodeId,
    totalTargetCount: targetIds.length,
    completedTargetCount: completedTargetIds.length,
    completionRatio: Number((completedTargetIds.length / targetIds.length).toFixed(2)),
    remainingTargetIds,
    weakTargetIds,
    lastPracticedTargetIds,
  };
}

function deriveNodeState(node, learnerId, record, blockers) {
  if (!record && blockers.length > 0) {
    return {
      learnerId,
      nodeId: node.nodeId,
      status: 'locked',
      masteryScore: 0,
      evidenceCount: 0,
      blockerNodeIds: blockers,
      recommendedReason: buildRecommendedReason(node, 'locked', blockers),
    };
  }

  if (!record) {
    return {
      learnerId,
      nodeId: node.nodeId,
      status: 'available',
      masteryScore: 0,
      evidenceCount: 0,
      blockerNodeIds: [],
      recommendedReason: buildRecommendedReason(node, 'available', []),
    };
  }

  const masteryScore = Number(computeMasteryScore(record).toFixed(2));
  const threshold = Number(node.assessmentThreshold || 0.8);
  let status = 'learning';

  if (
    masteryScore >= Math.max(0.9, threshold + 0.08) &&
    (record.missionCount > 0 || record.hangoutCount > 0 || record.count >= 3)
  ) {
    status = 'mastered';
  } else if (
    masteryScore >= threshold &&
    (record.hangoutCount > 0 || record.reviewCount > 0 || record.count >= 3)
  ) {
    status = 'validated';
  }

  const intervalHours =
    status === 'mastered' ? 7 * 24 : status === 'validated' ? 3 * 24 : 2 * 24;
  const lastCreatedAt = record.lastCreatedAt;
  const nextReviewAt = new Date(
    Date.parse(lastCreatedAt) + intervalHours * 60 * 60 * 1000,
  ).toISOString();

  if (status !== 'validated' && status !== 'mastered' && nextReviewAt <= baseIso()) {
    status = 'due';
  }

  return {
    learnerId,
    nodeId: node.nodeId,
    status,
    masteryScore,
    nextReviewAt,
    lastEvidenceAt: lastCreatedAt,
    evidenceCount: record.count,
    blockerNodeIds: blockers,
    recommendedReason: buildRecommendedReason(node, status, blockers),
  };
}

function computeNodeCompletionValue(entry) {
  const targetRatio = entry.targetProgress?.completionRatio || 0;
  if (entry.state.status === 'mastered') return 1;
  if (entry.state.status === 'validated') {
    return Math.max(0.88, entry.state.masteryScore, targetRatio);
  }
  if (entry.state.status === 'due') {
    return Math.max(0.72, entry.state.masteryScore, targetRatio);
  }
  if (entry.state.status === 'learning') {
    return Math.max(entry.state.masteryScore * 0.75, targetRatio);
  }
  if (entry.state.status === 'available') return 0;
  return 0;
}

function missionIdFromEvent(event) {
  const missionId =
    event?.metadata && typeof event.metadata === 'object'
      ? event.metadata.missionId
      : undefined;
  return typeof missionId === 'string' ? missionId.trim() : '';
}

function summarizeMissionEvidence(mission, allEvidence = []) {
  const requiredNodeIds = unique(mission?.requiredNodeIds || []);
  const missionEvidenceNodeIds = new Set();
  let completedAt = null;

  for (const event of allEvidence) {
    if (event.mode !== 'mission' || event.correct !== true) continue;

    const explicitMissionId = missionIdFromEvent(event);
    const matchesMission = explicitMissionId
      ? explicitMissionId === mission.missionId
      : requiredNodeIds.includes(event.nodeId);
    if (!matchesMission) continue;

    if (requiredNodeIds.includes(event.nodeId)) {
      missionEvidenceNodeIds.add(event.nodeId);
    }

    completedAt =
      !completedAt || event.createdAt > completedAt
        ? event.createdAt
        : completedAt;
  }

  const completed =
    requiredNodeIds.length > 0
      ? requiredNodeIds.every((nodeId) => missionEvidenceNodeIds.has(nodeId))
      : Boolean(completedAt);

  return {
    completed,
    completedAt,
    missionEvidenceNodeIds: [...missionEvidenceNodeIds],
  };
}

function buildMissionGateStatus(evaluation, mission, allEvidence = []) {
  if (!mission) return null;

  const completedRequiredNodeIds = (mission.requiredNodeIds || []).filter((nodeId) =>
    COMPLETED_STATUSES.has(evaluation.stateByNodeId.get(nodeId)?.status),
  );
  const remainingRequiredNodeIds = (mission.requiredNodeIds || []).filter(
    (nodeId) => !completedRequiredNodeIds.includes(nodeId),
  );
  const remainingTitles = remainingRequiredNodeIds.map(
    (nodeId) => evaluation.index.nodeById.get(nodeId)?.title || nodeId,
  );
  const missionEvidence = summarizeMissionEvidence(mission, allEvidence);
  const completed = remainingRequiredNodeIds.length === 0 && missionEvidence.completed;
  const ready = remainingRequiredNodeIds.length === 0 && !completed;
  const status = completed ? 'completed' : ready ? 'ready' : 'blocked';

  return {
    missionId: mission.missionId,
    title: mission.title,
    description: mission.description,
    level: mission.level,
    status,
    ready,
    completed,
    completedAt: missionEvidence.completedAt || undefined,
    requiredNodeIds: cloneJson(mission.requiredNodeIds || []),
    completedRequiredNodeIds,
    remainingRequiredNodeIds,
    reason:
      completed
        ? `${mission.title} is complete. The learner has demonstrated mastery in the capstone mission.`
        : ready
          ? `${mission.title} is ready. The learner has validated every required objective and can now attempt the capstone.`
        : `${mission.title} is blocked by ${remainingRequiredNodeIds.length} remaining requirement${remainingRequiredNodeIds.length === 1 ? '' : 's'}: ${remainingTitles.join(', ')}.`,
    rewards: cloneJson(mission.rewards || { xp: 0, sp: 0, rp: 0 }),
  };
}

function buildNextUnlocks(evaluation, limit = 3) {
  const lockedCandidates = evaluation.nodeEntries
    .filter((entry) => entry.state.status === 'locked')
    .map((entry) => {
      const blockerMastery = entry.state.blockerNodeIds.reduce(
        (sum, blockerNodeId) => sum + (evaluation.stateByNodeId.get(blockerNodeId)?.masteryScore || 0),
        0,
      );
      return {
        entry,
        blockerMastery,
      };
    })
    .sort((left, right) => {
      const blockerDelta =
        left.entry.state.blockerNodeIds.length - right.entry.state.blockerNodeIds.length;
      if (blockerDelta !== 0) return blockerDelta;
      if (left.entry.node.level !== right.entry.node.level) {
        return left.entry.node.level - right.entry.node.level;
      }
      if (left.blockerMastery !== right.blockerMastery) {
        return right.blockerMastery - left.blockerMastery;
      }
      return left.entry.node.nodeId.localeCompare(right.entry.node.nodeId);
    });

  return lockedCandidates.slice(0, Math.max(1, limit)).map(({ entry }) => {
    const blockerTitles = entry.state.blockerNodeIds.map(
      (blockerNodeId) => evaluation.index.nodeById.get(blockerNodeId)?.title || blockerNodeId,
    );
    return {
      nodeId: entry.node.nodeId,
      title: entry.node.title,
      level: entry.node.level,
      objectiveCategory: entry.node.objectiveCategory,
      remainingBlockerNodeIds: cloneJson(entry.state.blockerNodeIds),
      pathNodeIds: unique([...entry.state.blockerNodeIds, entry.node.nodeId]),
      reason:
        blockerTitles.length > 0
          ? `Finish ${blockerTitles.join(' and ')} to unlock ${entry.node.title}.`
          : `${entry.node.title} is the next unlock.`,
    };
  });
}

function buildLanguageSummary({
  evaluation,
  nextUnlocks,
  lessonBundle,
  hangoutBundle,
  missionGate,
}) {
  const unlockedEntries = evaluation.nodeEntries.filter((entry) => entry.state.status !== 'locked');
  const currentLevel =
    unlockedEntries.length > 0
      ? Math.max(...unlockedEntries.map((entry) => entry.node.level || 0))
      : Math.min(...(evaluation.pack.levels || []).map((level) => level.level || 0), 0);
  const currentLevelMeta =
    (evaluation.pack.levels || []).find((level) => level.level === currentLevel) || {
      level: currentLevel,
      label: `LEVEL ${currentLevel + 1}`,
      description: 'Current learner tier',
    };
  const currentLevelEntries = evaluation.nodeEntries.filter(
    (entry) => (entry.node.level || 0) === currentLevel,
  );
  const progressToNextTier =
    currentLevelEntries.length > 0
      ? Number(
          (
            currentLevelEntries.reduce(
              (sum, entry) => sum + computeNodeCompletionValue(entry),
              0,
            ) / currentLevelEntries.length
          ).toFixed(2),
        )
      : 0;

  const categoryStats = new Map();
  for (const entry of evaluation.nodeEntries) {
    const category = entry.node.objectiveCategory || 'vocabulary';
    const existing = categoryStats.get(category) || {
      category,
      masteryScore: 0,
      nodeCount: 0,
    };
    existing.masteryScore += entry.state.masteryScore;
    existing.nodeCount += 1;
    categoryStats.set(category, existing);
  }

  const rankedCategories = [...categoryStats.values()]
    .map((stat) => ({
      category: stat.category,
      masteryScore: Number((stat.masteryScore / Math.max(stat.nodeCount, 1)).toFixed(2)),
      nodeCount: stat.nodeCount,
    }))
    .sort((left, right) => right.masteryScore - left.masteryScore);

  const recommendedAction = evaluation.nodeEntries.some((entry) => entry.state.status === 'due')
    ? 'review'
    : missionGate?.status === 'ready'
      ? 'mission'
      : hangoutBundle.ready
        ? 'hangout'
        : lessonBundle.nodeIds.length > 0
          ? 'lesson'
          : 'review';

  return {
    learnerId: evaluation.nodeEntries[0]?.state.learnerId || '',
    lang: evaluation.pack.lang,
    languageTier: {
      level: currentLevelMeta.level + 1,
      label: currentLevelMeta.label,
      description: currentLevelMeta.description,
    },
    progressToNextTier,
    completedNodeCount: evaluation.completedNodeCount,
    activeNodeCount: evaluation.activeNodeCount,
    totalNodeCount: evaluation.nodeEntries.length,
    nextUnlockNodeIds: nextUnlocks.map((item) => item.nodeId),
    strongestCategories: rankedCategories.slice(0, 2),
    weakestCategories: [...rankedCategories].reverse().slice(0, 2),
    recommendedAction,
  };
}

function derivePackEvaluation(pack, learnerId, allEvidence) {
  const index = buildPackIndex(pack);
  const nodeIds = new Set(index.objectiveNodes.map((node) => node.nodeId));
  const evidenceSummary = summarizeEvidence(allEvidence, nodeIds);
  const eventsByNodeId = new Map(index.objectiveNodes.map((node) => [node.nodeId, []]));
  const stateByNodeId = new Map();
  const nodeEntries = [];
  const missionCriticalNodeIds = new Set(
    (pack.missions || []).flatMap((mission) => mission.requiredNodeIds || []),
  );

  for (const event of allEvidence) {
    if (!nodeIds.has(event.nodeId)) continue;
    if (!eventsByNodeId.has(event.nodeId)) {
      eventsByNodeId.set(event.nodeId, []);
    }
    eventsByNodeId.get(event.nodeId).push(event);
  }

  const targetProgressByNodeId = new Map(
    index.objectiveNodes.map((node) => [
      node.nodeId,
      deriveNodeTargetProgress(node, eventsByNodeId.get(node.nodeId) || []),
    ]),
  );

  for (const node of index.objectiveNodes) {
    const blockerNodeIds = (index.blockersByNodeId.get(node.nodeId) || []).filter((blockerId) => {
      const blockerState = stateByNodeId.get(blockerId);
      return !blockerState || !BLOCKER_CLEAR_STATUSES.has(blockerState.status);
    });

    const state = deriveNodeState(
      node,
      learnerId,
      evidenceSummary.get(node.nodeId) || null,
      blockerNodeIds,
    );

    stateByNodeId.set(node.nodeId, state);
    nodeEntries.push({
      node: cloneJson(node),
      state,
      blockers: cloneJson(blockerNodeIds),
      targetProgress: cloneJson(targetProgressByNodeId.get(node.nodeId)),
      unlocksNodeIds: cloneJson(index.unlocksByNodeId.get(node.nodeId) || []),
      missionCritical: missionCriticalNodeIds.has(node.nodeId),
    });
  }

  const lastUpdatedAt = nodeEntries
    .map((entry) => entry.state.lastEvidenceAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    pack,
    index,
    nodeEntries,
    stateByNodeId,
    activeNodeCount: nodeEntries.filter((entry) =>
      ['available', 'learning', 'due'].includes(entry.state.status),
    ).length,
    completedNodeCount: nodeEntries.filter((entry) =>
      COMPLETED_STATUSES.has(entry.state.status),
    ).length,
    evidenceCount: allEvidence.filter((event) => nodeIds.has(event.nodeId)).length,
    lastUpdatedAt,
    targetProgressByNodeId,
    missions: (pack.missions || []).map((mission) => buildMissionGateStatus(
      {
        pack,
        index,
        stateByNodeId,
      },
      mission,
      allEvidence,
    )),
  };
}

function deriveProgression(evaluations, allEvidence) {
  const uniqueStates = new Map();

  for (const evaluation of evaluations) {
    for (const entry of evaluation.nodeEntries) {
      uniqueStates.set(entry.state.nodeId, entry.state);
    }
  }

  const states = [...uniqueStates.values()];
  const validatedCount = states.filter((state) => state.status === 'validated').length;
  const masteredCount = states.filter((state) => state.status === 'mastered').length;
  const hangoutCount = allEvidence.filter((event) => event.mode === 'hangout').length;
  const missionCount = allEvidence.filter((event) => event.mode === 'mission').length;

  return {
    xp: Math.round(
      states.reduce((sum, state) => sum + state.masteryScore * 12, 0) +
        validatedCount * 10 +
        masteredCount * 14,
    ),
    sp: validatedCount * 3 + masteredCount * 5 + missionCount * 10,
    rp: hangoutCount * 4 + missionCount * 6,
  };
}

function deriveCanonicalEvaluations(persona, allEvidence) {
  const seenPackIds = new Set();
  const evaluations = [];

  for (const pack of PACK_REGISTRY.values()) {
    if (seenPackIds.has(pack.packId)) continue;
    seenPackIds.add(pack.packId);
    if (!Array.isArray(pack.nodes) || pack.nodes.length === 0) continue;
    evaluations.push(derivePackEvaluation(pack, persona.learnerId, allEvidence));
  }

  return evaluations;
}

function buildOverlayCandidates(persona) {
  const candidates = [];
  const zhTerms = unique(
    [...persona.topTerms.filter((term) => term.lang === 'zh').map((term) => term.lemma), '镜头', '提示词', '风格', '画面', '生成'],
  ).slice(0, 5);
  const koTerms = unique(
    [...persona.topTerms.filter((term) => term.lang === 'ko').map((term) => term.lemma), '무대', '연습', '안무', '파트', '리허설'],
  ).slice(0, 5);

  const hasZhGoal = persona.goals.some((goal) => goal.lang === 'zh');
  if (hasZhGoal || zhTerms.length > 0) {
    candidates.push({
      theme: 'video_prompting',
      overlay: {
        overlayId: 'overlay_zh_video_prompting',
        title: 'Chinese Video Prompting Vocabulary',
        lang: 'zh',
        source: 'youtube',
        connectedNodeIds: ['overlay_zh_video_prompting'],
        rationale:
          'Recent creator-focused YouTube activity suggests strong motivation for prompt-writing vocabulary in Mandarin.',
        suggestedTerms: zhTerms,
      },
    });
  }

  const hasKoGoal = persona.goals.some((goal) => goal.lang === 'ko');
  if (hasKoGoal || koTerms.length > 0) {
    candidates.push({
      theme: 'kpop_stage',
      overlay: {
        overlayId: 'overlay_ko_kpop_stage',
        title: 'K-pop Stage Language',
        lang: 'ko',
        source: 'spotify',
        connectedNodeIds: ['ko-vocab-food-items', 'ko-vocab-courtesy'],
        rationale:
          'Heavy K-pop listening is a useful motivational bridge into Korean performance and rehearsal vocabulary.',
        suggestedTerms: koTerms,
      },
    });
  }

  return candidates;
}

function buildRoadmap(persona, foundationEvaluation, overlayCandidates) {
  const hasJapanese = persona.targetLanguages.includes('ja') || persona.goals.some((goal) => goal.lang === 'ja');
  const zhOverlay = overlayCandidates.find((candidate) => candidate.overlay.lang === 'zh');
  const seoulFoundationLocation = resolveWorldMapLocation('seoul', 'food_street');
  const tokyoFoundationLocation = resolveWorldMapLocation('tokyo');
  const shanghaiFoundationLocation = resolveWorldMapLocation('shanghai');
  const seoulCoverage = getCityStarterPackCoverage('seoul');

  return [
    {
      cityId: 'seoul',
      locationId: seoulFoundationLocation.dagLocationSlot,
      mapLocationId: seoulFoundationLocation.mapLocationId,
      dagLocationSlot: seoulFoundationLocation.dagLocationSlot,
      title: `${CITY_LABELS.seoul} ${seoulFoundationLocation.label}`,
      lang: 'ko',
      status:
        foundationEvaluation.completedNodeCount > 0 || foundationEvaluation.activeNodeCount > 0
          ? 'in_progress'
          : seoulCoverage.authoredCount > 0
            ? 'ready'
            : 'stub',
      summary:
        foundationEvaluation.completedNodeCount > 0
          ? `Core Korean foundation path with active work on ordering language. ${seoulCoverage.authoredCount}/${seoulCoverage.totalCount} Seoul starter packs are checked in.`
          : seoulCoverage.authoredCount > 0
            ? `${seoulCoverage.authoredCount}/${seoulCoverage.totalCount} Seoul starter packs are checked in and ready for runtime wiring.`
            : 'Core Korean foundation path is ready to start.',
      activeNodeCount: foundationEvaluation.activeNodeCount,
      completedNodeCount: foundationEvaluation.completedNodeCount,
    },
    {
      cityId: 'tokyo',
      locationId: tokyoFoundationLocation.dagLocationSlot,
      mapLocationId: tokyoFoundationLocation.mapLocationId,
      dagLocationSlot: tokyoFoundationLocation.dagLocationSlot,
      title: `${CITY_LABELS.tokyo} ${tokyoFoundationLocation.label}`,
      lang: 'ja',
      status: hasJapanese ? 'ready' : 'stub',
      summary: hasJapanese
        ? 'Starter Japanese path is scaffolded and ready once the authored pack lands.'
        : 'Japanese roadmap entry remains parked until the learner opts in.',
      activeNodeCount: 0,
      completedNodeCount: 0,
    },
    {
      cityId: 'shanghai',
      locationId: shanghaiFoundationLocation.dagLocationSlot,
      mapLocationId: shanghaiFoundationLocation.mapLocationId,
      dagLocationSlot: shanghaiFoundationLocation.dagLocationSlot,
      title: `${CITY_LABELS.shanghai} ${shanghaiFoundationLocation.label}`,
      lang: 'zh',
      status: zhOverlay ? 'ready' : 'stub',
      summary: zhOverlay
        ? 'Chinese creator overlay is available while the authored Shanghai pack is still pending.'
        : 'Shanghai stays reserved for future personalized overlays and authored packs.',
      activeNodeCount: zhOverlay ? 1 : 0,
      completedNodeCount: zhOverlay ? Math.min(2, zhOverlay.overlay.suggestedTerms.length) : 0,
    },
  ];
}

function buildLegacyPersona(persona) {
  const primaryAlias = persona.aliases?.[0] || persona.learnerId;
  const legacyGoals = (persona.goals || []).map((goal) => ({
    lang: goal.lang,
    topic: goal.topic,
    theme: goal.topic,
    objective: goal.topic,
  }));

  return {
    learnerId: persona.learnerId,
    personaId: primaryAlias,
    userId: persona.userId,
    displayName: persona.displayName,
    focusSummary: legacyGoals.map((goal) => `${goal.lang.toUpperCase()}: ${goal.objective}`).join(' • '),
    proficiency: cloneJson(persona.proficiency),
    goals: legacyGoals,
    mediaPreferences: cloneJson(persona.mediaPreferences),
    topTerms: cloneJson(persona.topTerms || []),
    targetLanguages: cloneJson(persona.targetLanguages || []),
  };
}

function buildLegacyWorldRoadmap(persona, foundationEvaluation, overlayCandidates) {
  const cityFocus = new Map((persona.goals || []).map((goal) => [goal.lang, goal.topic]));
  const seoulLevelProgress = (SEOUL_FOOD_STREET_PACK.levels || []).map((level) => {
    const levelNodeIds = new Set(level.objectiveNodeIds || []);
    const levelEntries = foundationEvaluation.nodeEntries.filter((entry) => levelNodeIds.has(entry.node.nodeId));
    return {
      level: level.level,
      label: level.label,
      status: levelEntries.every((entry) => COMPLETED_STATUSES.has(entry.state.status))
        ? 'validated'
        : levelEntries.some((entry) => entry.state.status !== 'locked')
          ? 'active'
          : 'locked',
    };
  });

  return [
    {
      cityId: 'seoul',
      label: 'Seoul',
      focus: cityFocus.get('ko') || 'foundation',
      proficiency: persona.proficiency.ko || 'beginner',
      locations: LEGACY_SHARED_LOCATIONS.map((location, index) => {
        const resolvedLocation = resolveWorldMapLocation('seoul', location.locationId);
        const starterPack = getStarterPackMetadata('seoul', location.locationId);
        const authoredStatus =
          location.locationId === 'food_street'
            ? foundationEvaluation.completedNodeCount > 0 || foundationEvaluation.activeNodeCount > 0
              ? 'active'
              : starterPack
                ? 'preview'
                : 'locked'
            : starterPack
              ? 'preview'
              : 'locked';
        const authoredProgress =
          location.locationId === 'food_street'
            ? `${foundationEvaluation.completedNodeCount}/${foundationEvaluation.nodeEntries.length} nodes completed`
            : starterPack
              ? `Starter pack checked in: ${starterPack.packId}`
              : 'Awaiting authored starter pack';
        return {
          locationId: location.locationId,
          mapLocationId: resolvedLocation.mapLocationId,
          dagLocationSlot: resolvedLocation.dagLocationSlot,
          label: starterPack?.playerFacingLocationLabel || resolvedLocation.label,
          status: authoredStatus,
          progress: authoredProgress,
        };
      }),
      levels: seoulLevelProgress,
    },
    {
      cityId: 'tokyo',
      label: 'Tokyo',
      focus: cityFocus.get('ja') || 'foundation',
      proficiency: persona.proficiency.ja || 'beginner',
      locations: LEGACY_SHARED_LOCATIONS.map((location) => {
        const resolvedLocation = resolveWorldMapLocation('tokyo', location.locationId);
        const starterPack = getStarterPackMetadata('tokyo', location.locationId);
        return {
          locationId: location.locationId,
          mapLocationId: resolvedLocation.mapLocationId,
          dagLocationSlot: resolvedLocation.dagLocationSlot,
          label: starterPack?.playerFacingLocationLabel || resolvedLocation.label,
          status: starterPack ? 'preview' : 'locked',
          progress: starterPack ? `Starter pack checked in: ${starterPack.packId}` : 'Awaiting authored starter pack',
        };
      }),
      levels: [
        { level: 0, label: 'SCRIPT', status: 'available' },
        { level: 1, label: 'PRONUNCIATION', status: 'locked' },
      ],
    },
    {
      cityId: 'shanghai',
      label: 'Shanghai',
      focus: cityFocus.get('zh') || 'personalization',
      proficiency: persona.proficiency.zh || 'beginner',
      locations: LEGACY_SHARED_LOCATIONS.map((location) => {
        const resolvedLocation = resolveWorldMapLocation('shanghai', location.locationId);
        const starterPack = getStarterPackMetadata('shanghai', location.locationId);
        return {
          locationId: location.locationId,
          mapLocationId: resolvedLocation.mapLocationId,
          dagLocationSlot: resolvedLocation.dagLocationSlot,
          label: starterPack?.playerFacingLocationLabel || resolvedLocation.label,
          status:
            location.locationId === 'practice_studio'
              ? starterPack || overlayCandidates.some((candidate) => candidate.overlay.lang === 'zh')
                ? 'preview'
                : 'locked'
              : starterPack
                ? 'preview'
                : 'locked',
          progress:
            location.locationId === 'practice_studio'
              ? starterPack
                ? `Starter pack checked in: ${starterPack.packId}`
                : 'Personalized overlay ready for creator vocabulary'
              : starterPack
                ? `Starter pack checked in: ${starterPack.packId}`
                : 'Awaiting generated pack',
        };
      }),
      levels: [
        { level: 0, label: 'FOUNDATION', status: 'available' },
        { level: 1, label: 'VIDEO PROMPTING OVERLAY', status: 'preview' },
      ],
    },
  ];
}

function buildLegacyLocationSkillTree(runtime) {
  const { selection, selectedEvaluation, missionGate } = runtime;
  const pack = selection.pack;

  return {
    packId: pack.packId,
    cityId: pack.cityId,
    locationId: pack.locationId,
    title: pack.title,
    levels: (pack.levels || []).map((level) => {
      const levelNodeIds = new Set(level.objectiveNodeIds || []);
      const levelEntries = selectedEvaluation.nodeEntries.filter((entry) => levelNodeIds.has(entry.node.nodeId));
      const mission = (pack.missions || []).find((item) => item.level === level.level) || {
        missionId: `mission:${pack.packId}:${level.level}`,
        title: `${level.label} mission`,
        requiredNodeIds: level.objectiveNodeIds || [],
        rewards: { xp: 0, sp: 0, rp: 0 },
      };

      const completedRequiredNodeIds = (mission.requiredNodeIds || []).filter((nodeId) =>
        COMPLETED_STATUSES.has(selectedEvaluation.stateByNodeId.get(nodeId)?.status),
      );

      const missionStatus =
        missionGate && mission.level === missionGate.level
          ? missionGate.status === 'completed'
            ? 'ready'
            : missionGate.status === 'ready'
              ? 'ready'
              : levelEntries.some((entry) => entry.state.status !== 'locked')
                ? 'tracking'
                : 'locked'
          : completedRequiredNodeIds.length === (mission.requiredNodeIds || []).length
            ? 'ready'
            : levelEntries.some((entry) => entry.state.status !== 'locked')
              ? 'tracking'
              : 'locked';

      return {
        level: level.level,
        name: level.label,
        description: level.description,
        estimatedSessionMinutes: 12 + levelEntries.length * 3,
        mission: {
          missionId: mission.missionId,
          title: mission.title,
          requiredObjectiveIds: cloneJson(mission.requiredNodeIds || []),
          reward: cloneJson(mission.rewards || { xp: 0, sp: 0, rp: 0 }),
          status: missionStatus,
        },
        objectives: levelEntries.map((entry) => ({
          objectiveId: entry.node.nodeId,
          title: entry.node.title,
          description: entry.node.description,
          status: entry.state.status,
          mastery_score: entry.state.masteryScore,
          validatedTargetCount: entry.targetProgress?.completedTargetCount || 0,
          targetCount: entry.targetProgress?.totalTargetCount || entry.node.targetCount || 0,
          blockers: cloneJson(entry.state.blockerNodeIds || []),
          category: entry.node.objectiveCategory || 'foundation',
        })),
      };
    }),
  };
}

function buildLegacyOverlay(overlayCandidates) {
  const focusCards = overlayCandidates.map((candidate) => ({
    overlayId: candidate.overlay.overlayId,
    lang: candidate.overlay.lang,
    theme: candidate.theme,
    title: candidate.overlay.title,
    description: candidate.overlay.rationale,
    nodes: (candidate.overlay.suggestedTerms || []).slice(0, 4).map((term, index) => ({
      nodeId: candidate.overlay.connectedNodeIds?.[index] || `${candidate.overlay.overlayId}:${stableSlug(term)}`,
      label: term,
      translation: term,
      status: 'available',
    })),
    reason: candidate.overlay.rationale,
  }));

  return {
    focusCards,
    summary: `Personalized overlay tracks ${focusCards.length} theme${focusCards.length === 1 ? '' : 's'}.`,
  };
}

function buildLegacyNextActions(recommendations) {
  return recommendations.map((recommendation) => {
    const resolvedLocation = resolveWorldMapLocation(recommendation.cityId, recommendation.locationId);
    return {
      actionId: recommendation.recommendationId,
      type: recommendation.type,
      title: recommendation.title,
      objectiveId: recommendation.nodeIds?.[0] || null,
      cityId: recommendation.cityId,
      locationId: recommendation.locationId,
      mapLocationId: resolvedLocation.mapLocationId,
      dagLocationSlot: resolvedLocation.dagLocationSlot,
      reason: recommendation.reason,
      recommendedNodeIds: cloneJson(recommendation.nodeIds || []),
    };
  });
}

function buildLegacyBundleTargets(bundle, evaluation) {
  return (bundle.nodeIds || [])
    .map((nodeId) => evaluation.nodeEntries.find((entry) => entry.node.nodeId === nodeId))
    .filter(Boolean)
    .map((entry) => ({
      nodeId: entry.node.nodeId,
      label: entry.node.title,
      status: entry.state.status,
      mastery_score: entry.state.masteryScore,
    }));
}

function buildLegacyMetrics(runtime) {
  const nodeStates = runtime.foundationEvaluation.nodeEntries.map((entry) => entry.state);
  return {
    validatedObjectives: nodeStates.filter((state) => state.status === 'validated').length,
    masteredObjectives: nodeStates.filter((state) => state.status === 'mastered').length,
    dueNodeCount: nodeStates.filter((state) => state.status === 'due').length,
    evidenceCount: runtime.allEvidence.length,
  };
}

function collectFocusTargetIds(targetProgressItems, limit = 8) {
  return unique(
    targetProgressItems.flatMap((progress) => [
      ...(progress?.weakTargetIds || []),
      ...(progress?.remainingTargetIds || []),
    ]),
  ).slice(0, limit);
}

function buildLessonBundle(pack, evaluation, learnerId, nextUnlocks = []) {
  const resolvedLocation = resolveWorldMapLocation(pack.cityId, pack.locationId);
  if ((pack.nodes || []).length === 0 || evaluation.nodeEntries.length === 0) {
    return {
      bundleId: `lesson:${pack.packId}:none`,
      learnerId,
      nodeIds: [],
      objectiveIds: [],
      lang: pack.lang,
      cityId: pack.cityId,
      locationId: pack.locationId,
      mapLocationId: resolvedLocation.mapLocationId,
      dagLocationSlot: resolvedLocation.dagLocationSlot,
      title: `${pack.title} lesson bundle`,
      mode: 'learn',
      reason: 'This location does not have an authored lesson bundle yet.',
      targets: [],
      explainIn: pack.lang === 'ko' ? 'en' : pack.lang,
      focusTargetIds: [],
      targetProgress: [],
      nextUnlockNodeIds: nextUnlocks.map((item) => item.nodeId),
    };
  }

  const rankedCandidates = evaluation.nodeEntries
    .filter((entry) => LESSON_STATUSES.has(entry.state.status))
    .sort((left, right) => {
      const leftSupports = evaluation.index.supportsByNodeId.get(left.node.nodeId) || [];
      const rightSupports = evaluation.index.supportsByNodeId.get(right.node.nodeId) || [];
      const leftSupportMastery =
        leftSupports.reduce(
          (sum, nodeId) => sum + (evaluation.stateByNodeId.get(nodeId)?.masteryScore || 0),
          0,
        ) / Math.max(leftSupports.length, 1);
      const rightSupportMastery =
        rightSupports.reduce(
          (sum, nodeId) => sum + (evaluation.stateByNodeId.get(nodeId)?.masteryScore || 0),
          0,
        ) / Math.max(rightSupports.length, 1);

      function score(entry, supportCount, supportMastery) {
        const statusBase =
          entry.state.status === 'available'
            ? 90
            : entry.state.status === 'due'
              ? 70
              : 50;
        const levelScore = (entry.node.level || 0) * 12;
        const supportScore = supportCount * 8 + supportMastery * 10;
        const categoryScore = LESSON_CATEGORY_PRIORITY[entry.node.objectiveCategory] || 0;
        return statusBase + levelScore + supportScore + categoryScore;
      }

      return score(right, rightSupports.length, rightSupportMastery) - score(left, leftSupports.length, leftSupportMastery);
    });

  const candidate = rankedCandidates[0] || evaluation.nodeEntries[0];

  const supportNodeIds = unique([
    ...(evaluation.index.supportsByNodeId.get(candidate.node.nodeId) || []),
    candidate.node.nodeId,
  ]).filter((nodeId) => evaluation.stateByNodeId.has(nodeId));
  const bundleTargetProgress = supportNodeIds
    .map((nodeId) => evaluation.targetProgressByNodeId.get(nodeId))
    .filter(Boolean);

  const title =
    pack.cityId === 'seoul' &&
    pack.locationId === 'food_street' &&
    supportNodeIds.includes('ko-gram-juseyo')
      ? 'Food Street Polite Ordering Bundle'
      : `${LOCATION_LABELS[pack.locationId]} ${candidate.node.title}`;

  const reason =
    candidate.state.status === 'available'
      ? 'This lesson bundle reinforces the current foundation path and directly prepares the next hangout validation.'
      : candidate.state.status === 'due'
        ? 'This lesson bundle refreshes due material before it slips further.'
        : 'This lesson bundle deepens the current objective before it is validated in-scene.';

  return {
    bundleId: `lesson:${candidate.node.nodeId}`,
    learnerId,
    nodeIds: supportNodeIds,
    objectiveIds: supportNodeIds,
    lang: pack.lang,
    cityId: pack.cityId,
    locationId: pack.locationId,
    mapLocationId: resolvedLocation.mapLocationId,
    dagLocationSlot: resolvedLocation.dagLocationSlot,
    title,
    mode: 'learn',
    reason,
    targets: buildLegacyBundleTargets({ nodeIds: supportNodeIds }, evaluation),
    explainIn: pack.lang === 'ko' ? 'en' : pack.lang,
    focusNodeId: candidate.node.nodeId,
    focusTargetIds: collectFocusTargetIds(
      [
        evaluation.targetProgressByNodeId.get(candidate.node.nodeId),
        ...bundleTargetProgress,
      ].filter(Boolean),
    ),
    targetProgress: cloneJson(bundleTargetProgress),
    nextUnlockNodeIds: nextUnlocks.map((item) => item.nodeId),
  };
}

function hangoutPriority(entry) {
  if (entry.state.status === 'due') return 5;
  if (entry.state.status === 'learning' && entry.state.masteryScore >= 0.7) return 4;
  if (entry.state.status === 'available' && entry.state.blockerNodeIds.length === 0) return 3;
  if (COMPLETED_STATUSES.has(entry.state.status)) return 2;
  if (entry.state.status === 'learning') return 1;
  return 0;
}

function buildHangoutBundle(pack, evaluation, learnerId, missionGate = null) {
  const resolvedLocation = resolveWorldMapLocation(pack.cityId, pack.locationId);
  const scenarios = (pack.scenarios || []).filter((scenario) => scenario.mode === 'hangout');
  if (scenarios.length === 0) {
    return {
      bundleId: `hangout:${pack.packId}:none`,
      learnerId,
      nodeIds: [],
      objectiveIds: [],
      lang: pack.lang,
      cityId: pack.cityId,
      locationId: pack.locationId,
      mapLocationId: resolvedLocation.mapLocationId,
      dagLocationSlot: resolvedLocation.dagLocationSlot,
      scenarioId: '',
      title: `${pack.title} hangout bundle`,
      mode: 'hangout',
      reason: 'No authored hangout scenario exists for this pack yet.',
      targets: [],
      suggestedPhrases: [],
      ready: false,
      focusTargetIds: [],
      targetProgress: [],
      readiness: {
        ready: false,
        reason: 'No authored hangout scenario exists for this pack yet.',
        blockingNodeIds: [],
      },
      missionGate,
    };
  }

  for (const scenario of scenarios) {
    const scenarioEntries = (scenario.targetNodeIds || [])
      .map((nodeId) => evaluation.nodeEntries.find((entry) => entry.node.nodeId === nodeId))
      .filter(Boolean)
      .filter((entry) => entry.state.status !== 'locked')
      .sort((left, right) => hangoutPriority(right) - hangoutPriority(left))
      .slice(0, 3);

    const readySupportCount = scenarioEntries.filter(
      (entry) =>
        entry.state.status === 'due' ||
        entry.state.status === 'validated' ||
        entry.state.status === 'mastered' ||
        (entry.state.status === 'learning' && entry.state.masteryScore >= 0.7),
    ).length;
    const includesUnlockedProduction = scenarioEntries.some(
      (entry) =>
        entry.node.objectiveCategory === 'grammar' &&
        entry.state.blockerNodeIds.length === 0 &&
        entry.state.status !== 'locked',
    );

    if (scenarioEntries.length >= 3 && readySupportCount >= 2 && includesUnlockedProduction) {
      const bundleTargetProgress = scenarioEntries
        .map((entry) => evaluation.targetProgressByNodeId.get(entry.node.nodeId))
        .filter(Boolean);
      return {
        bundleId: `hangout:${scenario.scenarioId}`,
        learnerId,
        nodeIds: scenarioEntries.map((entry) => entry.node.nodeId),
        objectiveIds: scenarioEntries.map((entry) => entry.node.nodeId),
        lang: pack.lang,
        cityId: pack.cityId,
        locationId: pack.locationId,
        mapLocationId: resolvedLocation.mapLocationId,
        dagLocationSlot: resolvedLocation.dagLocationSlot,
        scenarioId: scenario.scenarioId,
        title: 'Food Street Hangout Validation',
        mode: 'hangout',
        reason: 'The learner has enough readiness to validate polite Korean ordering in-context.',
        targets: buildLegacyBundleTargets({ nodeIds: scenarioEntries.map((entry) => entry.node.nodeId) }, evaluation),
        suggestedPhrases: collectFocusTargetIds(bundleTargetProgress, 3),
        ready: true,
        focusNodeId: scenarioEntries[0]?.node.nodeId,
        focusTargetIds: collectFocusTargetIds(bundleTargetProgress, 6),
        targetProgress: cloneJson(bundleTargetProgress),
        readiness: {
          ready: true,
          reason: 'The learner has enough readiness to validate polite Korean ordering in-context.',
          blockingNodeIds: [],
        },
        missionGate,
      };
    }
  }

  const blockingNodeIds = unique(
    scenarios.flatMap((scenario) =>
      (scenario.targetNodeIds || []).filter((nodeId) => {
        const state = evaluation.stateByNodeId.get(nodeId);
        if (!state) return true;
        if (state.status === 'locked') return true;
        if (state.status === 'learning' && state.masteryScore < 0.7) return true;
        return false;
      }),
    ),
  );
  const blockingTitles = blockingNodeIds.map(
    (nodeId) => evaluation.index.nodeById.get(nodeId)?.title || nodeId,
  );

  return {
    bundleId: `hangout:${pack.packId}:blocked`,
    learnerId,
    nodeIds: [],
    objectiveIds: [],
    lang: pack.lang,
    cityId: pack.cityId,
    locationId: pack.locationId,
    mapLocationId: resolvedLocation.mapLocationId,
    dagLocationSlot: resolvedLocation.dagLocationSlot,
    scenarioId: '',
    title: `${pack.title} hangout bundle`,
    mode: 'hangout',
    reason: 'No scenario has enough readiness yet; keep building lesson evidence first.',
    targets: [],
    suggestedPhrases: [],
    ready: false,
    focusTargetIds: [],
    targetProgress: [],
    readiness: {
      ready: false,
      reason:
        blockingTitles.length > 0
          ? `Keep building readiness in ${blockingTitles.join(', ')} before starting a paid hangout.`
          : 'No scenario has enough readiness yet; keep building lesson evidence first.',
      blockingNodeIds,
    },
    missionGate,
  };
}

function buildRecommendations({
  foundationEvaluation,
  overlayCandidates,
  lessonBundle,
  hangoutBundle,
  limit,
}) {
  const recommendations = [];
  let priority = 1;
  const foundationPack = foundationEvaluation.pack;
  const foundationLang = foundationPack.lang;

  const reviewCandidate = foundationEvaluation.nodeEntries.find((entry) => entry.state.status === 'due');
  if (reviewCandidate) {
    recommendations.push({
      recommendationId: `rec_review_${stableSlug(reviewCandidate.node.nodeId)}`,
      type: 'review',
      title: `Review ${shortNodeTitle(reviewCandidate.node)}`,
      reason: 'This is the highest-leverage due item before the next hangout.',
      nodeIds: [reviewCandidate.node.nodeId],
      cityId: foundationPack.cityId,
      locationId: foundationPack.locationId,
      lang: foundationLang,
      foundation: true,
      priority: priority++,
    });
  }

  if (lessonBundle.nodeIds.length > 0) {
    const primaryLessonNodeId = lessonBundle.objectiveIds.at(-1) || lessonBundle.nodeIds.at(-1);
    const primaryLessonNode = foundationEvaluation.index.nodeById.get(primaryLessonNodeId);
    recommendations.push({
      recommendationId: `rec_lesson_${stableSlug(primaryLessonNodeId)}`,
      type: 'lesson',
      title: primaryLessonNode
        ? `Open the ${shortNodeTitle(primaryLessonNode)} session`
        : lessonBundle.title,
      reason: lessonBundle.reason,
      nodeIds: [primaryLessonNodeId],
      cityId: foundationPack.cityId,
      locationId: foundationPack.locationId,
      lang: foundationLang,
      foundation: true,
      priority: priority++,
    });
  }

  if (hangoutBundle.nodeIds.length > 0) {
    recommendations.push({
      recommendationId: `rec_hangout_${stableSlug(hangoutBundle.scenarioId)}`,
      type: 'hangout',
      title: hangoutBundle.title,
      reason: hangoutBundle.reason,
      nodeIds: cloneJson(hangoutBundle.nodeIds),
      cityId: foundationPack.cityId,
      locationId: foundationPack.locationId,
      lang: foundationLang,
      foundation: true,
      priority: priority++,
    });
  }

  const readyMission = foundationEvaluation.missions.find((mission) => mission.status === 'ready');
  if (readyMission) {
    recommendations.push({
      recommendationId: `rec_mission_${stableSlug(readyMission.missionId)}`,
      type: 'mission',
      title: readyMission.title,
      reason: readyMission.description,
      nodeIds: cloneJson(readyMission.requiredNodeIds),
      cityId: foundationPack.cityId,
      locationId: foundationPack.locationId,
      lang: foundationLang,
      foundation: true,
      priority: priority++,
    });
  }

  for (const candidate of overlayCandidates) {
    recommendations.push({
      recommendationId: `rec_overlay_${stableSlug(candidate.overlay.overlayId)}`,
      type: 'overlay',
      title: `Explore ${candidate.overlay.title}`,
      reason: candidate.overlay.rationale,
      nodeIds: [candidate.overlay.overlayId],
      cityId: candidate.overlay.lang === 'zh' ? 'shanghai' : 'seoul',
      locationId: candidate.overlay.lang === 'zh' ? 'practice_studio' : 'food_street',
      lang: candidate.overlay.lang,
      foundation: false,
      priority: priority++,
    });
  }

  return recommendations.slice(0, Math.max(1, Number(limit) || 4));
}

function buildRuntimeState(args = {}) {
  const persona = getPersonaFromArgs(args);
  const selection = resolveSelection(args);
  const allEvidence = materializeEvidence(persona);
  const foundationEvaluation = derivePackEvaluation(
    SEOUL_FOOD_STREET_PACK,
    persona.learnerId,
    allEvidence,
  );
  const selectedEvaluation =
    selection.pack.packId === SEOUL_FOOD_STREET_PACK.packId
      ? foundationEvaluation
      : derivePackEvaluation(selection.pack, persona.learnerId, allEvidence);
  const overlayCandidates = buildOverlayCandidates(persona);
  const progression = deriveProgression(deriveCanonicalEvaluations(persona, allEvidence), allEvidence);
  const nextUnlocks = buildNextUnlocks(selectedEvaluation, 3);
  const missionGate = selectedEvaluation.missions[0] || null;
  const lessonBundle = buildLessonBundle(
    selection.pack,
    selectedEvaluation,
    persona.learnerId,
    nextUnlocks,
  );
  const hangoutBundle = buildHangoutBundle(
    selection.pack,
    selectedEvaluation,
    persona.learnerId,
    missionGate,
  );
  const languageSummary = buildLanguageSummary({
    evaluation: selectedEvaluation,
    nextUnlocks,
    lessonBundle,
    hangoutBundle,
    missionGate,
  });

  return {
    persona,
    selection,
    allEvidence,
    foundationEvaluation,
    selectedEvaluation,
    overlayCandidates,
    progression,
    nextUnlocks,
    missionGate,
    lessonBundle,
    hangoutBundle,
    languageSummary,
  };
}

function normalizeEvidenceSource(source, mode) {
  if (typeof source === 'string') {
    const normalized = source.trim().toLowerCase();
    if (
      normalized === 'learn' ||
      normalized === 'hangout' ||
      normalized === 'exercise' ||
      normalized === 'mission' ||
      normalized === 'review' ||
      normalized === 'media'
    ) {
      return normalized;
    }
    if (normalized.includes('hangout')) return 'hangout';
    if (normalized.includes('mission')) return 'mission';
    if (normalized.includes('review')) return 'review';
    if (normalized.includes('media')) return 'media';
    if (normalized.includes('learn') || normalized.includes('exercise')) return 'exercise';
  }

  if (mode === 'hangout') return 'hangout';
  if (mode === 'mission') return 'mission';
  if (mode === 'review') return 'review';
  return 'exercise';
}

function resolveLegacyEvidenceNodeId(rawNodeId, rawObjectiveId) {
  const candidateIds = [
    typeof rawNodeId === 'string' ? rawNodeId.trim() : '',
    typeof rawObjectiveId === 'string' ? rawObjectiveId.trim() : '',
  ].filter(Boolean);

  for (const candidateId of candidateIds) {
    const canonicalId = LEGACY_NODE_ID_ALIASES.get(candidateId) || candidateId;
    if (KNOWN_NODE_IDS.has(canonicalId)) {
      return canonicalId;
    }

    if (candidateId.startsWith('objective:')) {
      const objectiveId = candidateId.slice('objective:'.length).trim();
      const canonicalObjectiveId = LEGACY_NODE_ID_ALIASES.get(objectiveId) || objectiveId;
      if (KNOWN_NODE_IDS.has(canonicalObjectiveId)) {
        return canonicalObjectiveId;
      }
    }
  }

  return '';
}

function normalizeQualityScore(rawEvent) {
  if (rawEvent.qualityScore !== undefined) {
    const score = Number(rawEvent.qualityScore);
    if (!Number.isFinite(score)) {
      throw createGraphError('invalid_evidence_quality', 'qualityScore must be a number.', 400);
    }
    return Math.max(0, Math.min(5, Number(score.toFixed(2))));
  }

  if (rawEvent.quality !== undefined) {
    const quality = Number(rawEvent.quality);
    if (!Number.isFinite(quality)) {
      throw createGraphError('invalid_evidence_quality', 'quality must be a number.', 400);
    }

    if (quality <= 1) {
      return Math.max(1, Math.min(5, Math.round(quality * 5)));
    }

    return Math.max(0, Math.min(5, Number(quality.toFixed(2))));
  }

  return rawEvent.correct === false ? 1 : 3;
}

function normalizeTargetResults(rawEvent) {
  const sourceArray = Array.isArray(rawEvent?.targetResults)
    ? rawEvent.targetResults
    : Array.isArray(rawEvent?.metadata?.targetResults)
      ? rawEvent.metadata.targetResults
      : [];

  return sourceArray
    .map((result) => {
      if (!result) return null;
      if (typeof result === 'string') {
        return {
          targetId: result,
          correct: rawEvent.correct !== false,
          qualityScore: rawEvent.qualityScore,
        };
      }

      if (typeof result !== 'object') return null;
      const targetId = typeof result.targetId === 'string' ? result.targetId.trim() : '';
      if (!targetId) return null;

      return {
        targetId,
        correct: typeof result.correct === 'boolean' ? result.correct : rawEvent.correct !== false,
        qualityScore: Number.isFinite(Number(result.qualityScore))
          ? Number(Number(result.qualityScore).toFixed(2))
          : undefined,
      };
    })
    .filter(Boolean);
}

function normalizeRuntimeEvent(rawEvent, learnerId, eventIndex) {
  if (!rawEvent || typeof rawEvent !== 'object') {
    throw createGraphError('invalid_evidence_event', 'Evidence event payload is required.', 400);
  }

  const rawNodeId = typeof rawEvent.nodeId === 'string' ? rawEvent.nodeId.trim() : '';
  const rawObjectiveId = typeof rawEvent.objectiveId === 'string' ? rawEvent.objectiveId.trim() : '';
  const nodeId =
    resolveLegacyEvidenceNodeId(rawNodeId, rawObjectiveId) ||
    LEGACY_NODE_ID_ALIASES.get(rawNodeId) ||
    rawNodeId;
  if (!nodeId) {
    throw createGraphError('invalid_evidence_node', 'Evidence event must include nodeId.', 400);
  }

  if (!KNOWN_NODE_IDS.has(nodeId)) {
    throw createGraphError(
      'unknown_graph_node',
      `Unknown curriculum graph node "${nodeId}".`,
      400,
      { nodeId },
    );
  }

  const rawMode = typeof rawEvent.mode === 'string' ? rawEvent.mode.trim().toLowerCase() : 'learn';
  const mode = rawMode === 'exercise' ? 'learn' : rawMode;
  if (!['learn', 'hangout', 'review', 'mission'].includes(mode)) {
    throw createGraphError(
      'invalid_evidence_mode',
      `Unsupported evidence mode "${rawMode}".`,
      400,
      { mode: rawMode },
    );
  }

  const qualityScore = normalizeQualityScore(rawEvent);
  const source = normalizeEvidenceSource(rawEvent.source, mode);
  const targetResults = normalizeTargetResults({
    ...rawEvent,
    correct: typeof rawEvent.correct === 'boolean' ? rawEvent.correct : qualityScore >= 3,
    qualityScore,
  });
  const createdAt =
    typeof rawEvent.createdAt === 'string'
      ? rawEvent.createdAt
      : typeof rawEvent.occurredAtIso === 'string'
        ? rawEvent.occurredAtIso
        : new Date(GRAPH_NOW_MS + eventIndex * 5 * 60 * 1000).toISOString();

  return {
    eventId:
      typeof rawEvent.eventId === 'string'
        ? rawEvent.eventId
        : `evt_graph_${String(eventIndex + 1).padStart(3, '0')}`,
    learnerId,
    nodeId,
    legacyNodeId: rawNodeId || rawObjectiveId || nodeId,
    legacyObjectiveId: rawObjectiveId || rawNodeId || nodeId,
    legacyMode: rawMode === 'exercise' ? 'exercise' : mode,
    legacyQuality:
      rawEvent.quality !== undefined && Number.isFinite(Number(rawEvent.quality))
        ? Number(Number(rawEvent.quality).toFixed(2))
        : qualityScore / 5,
    source,
    mode,
    correct: typeof rawEvent.correct === 'boolean' ? rawEvent.correct : qualityScore >= 3,
    qualityScore,
    createdAt,
    targetResults,
    metadata:
      rawEvent.metadata && typeof rawEvent.metadata === 'object'
        ? cloneJson(rawEvent.metadata)
        : undefined,
  };
}

function getPackForNode(nodeId) {
  const pack = PACK_BY_NODE_ID.get(nodeId);
  if (!pack) {
    throw createGraphError(
      'unknown_graph_node',
      `Unknown curriculum graph node "${nodeId}".`,
      400,
      { nodeId },
    );
  }
  return pack;
}

function validationIssue(code, severity, message, nodeId) {
  return nodeId ? { code, severity, message, nodeId } : { code, severity, message };
}

function collectContentIds(pack) {
  const sections = [
    ...(pack.content?.scriptTargets || []),
    ...(pack.content?.pronunciationTargets || []),
    ...(pack.content?.vocabularyTargets || []),
    ...(pack.content?.grammarTargets || []),
    ...(pack.content?.sentenceFrameTargets || []),
  ];
  const identifiers = new Set();

  for (const item of sections) {
    for (const value of [item?.id, item?.word, item?.pattern, item?.label]) {
      if (!value) continue;
      identifiers.add(value);
      identifiers.add(normalizeTargetIdentifier(value));
      if (normalizeTargetIdentifier(value) === 'N+number+개+주세요') {
        identifiers.add('하나/둘/셋+개');
      }
    }
  }

  return identifiers;
}

function detectCycle(pack) {
  const adjacency = new Map();

  for (const node of pack.nodes || []) {
    adjacency.set(node.nodeId, []);
  }

  for (const edge of pack.edges || []) {
    if (edge.type !== 'requires' && edge.type !== 'unlocks') continue;
    const list = adjacency.get(edge.fromNodeId) || [];
    list.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, list);
  }

  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const nodeId of adjacency.keys()) {
    if (visit(nodeId)) return true;
  }

  return false;
}

export function validatePack(pack = SEOUL_FOOD_STREET_PACK) {
  const issues = [];
  const nodes = Array.isArray(pack?.nodes) ? pack.nodes : [];
  const nodeIds = new Set();
  const contentIds = collectContentIds(pack);

  for (const node of nodes) {
    if (!node?.nodeId) {
      issues.push(validationIssue('node_missing_id', 'error', 'A node is missing nodeId.'));
      continue;
    }
    if (nodeIds.has(node.nodeId)) {
      issues.push(
        validationIssue('duplicate_node', 'error', `Duplicate node id ${node.nodeId}.`, node.nodeId),
      );
    }
    nodeIds.add(node.nodeId);

    for (const targetItemId of node.targetItemIds || []) {
      const sparseCatalogAllowed =
        (node.objectiveCategory === 'script' && (pack.content?.scriptTargets || []).length === 0) ||
        (node.objectiveCategory === 'pronunciation' && (pack.content?.pronunciationTargets || []).length === 0);
      if (sparseCatalogAllowed) continue;
      if (!contentIds.has(targetItemId) && !contentIds.has(normalizeTargetIdentifier(targetItemId))) {
        issues.push(
          validationIssue(
            'unmapped_target_item',
            'error',
            `Node ${node.nodeId} references unknown target item ${targetItemId}.`,
            node.nodeId,
          ),
        );
      }
    }
  }

  for (const edge of pack?.edges || []) {
    if (!nodeIds.has(edge.fromNodeId)) {
      issues.push(
        validationIssue(
          'edge_missing_from',
          'error',
          `Edge ${edge.edgeId} references unknown fromNodeId ${edge.fromNodeId}.`,
        ),
      );
    }
    if (!nodeIds.has(edge.toNodeId)) {
      issues.push(
        validationIssue(
          'edge_missing_to',
          'error',
          `Edge ${edge.edgeId} references unknown toNodeId ${edge.toNodeId}.`,
        ),
      );
    }
  }

  for (const level of pack?.levels || []) {
    for (const nodeId of level.objectiveNodeIds || []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(
          validationIssue(
            'level_objective_missing',
            'error',
            `Level ${level.level} references unknown objective node ${nodeId}.`,
            nodeId,
          ),
        );
      }
    }
    for (const nodeId of level.assessmentCriteria?.requiredNodeIds || []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(
          validationIssue(
            'level_requirement_missing',
            'error',
            `Level ${level.level} references unknown required node ${nodeId}.`,
            nodeId,
          ),
        );
      }
    }
  }

  for (const mission of pack?.missions || []) {
    for (const nodeId of mission.requiredNodeIds || []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(
          validationIssue(
            'mission_requirement_missing',
            'error',
            `Mission ${mission.missionId} references unknown node ${nodeId}.`,
            nodeId,
          ),
        );
      }
    }
  }

  for (const scenario of pack?.scenarios || []) {
    for (const nodeId of scenario.targetNodeIds || []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(
          validationIssue(
            'scenario_target_missing',
            'error',
            `Scenario ${scenario.scenarioId} references unknown node ${nodeId}.`,
            nodeId,
          ),
        );
      }
    }
  }

  if (detectCycle(pack)) {
    issues.push(
      validationIssue(
        'graph_cycle_detected',
        'error',
        'Requires/unlocks graph contains a cycle.',
      ),
    );
  }

  if ((pack.content?.scriptTargets || []).length === 0 || (pack.content?.pronunciationTargets || []).length === 0) {
    const firstScriptNode = (pack.nodes || []).find((node) => node.objectiveCategory === 'script');
    issues.push(
      validationIssue(
        'script_targets_optional_v1',
        'warning',
        'Script and pronunciation target catalogs are still sparse in v1; validator treats this as a warning.',
        firstScriptNode?.nodeId,
      ),
    );
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    packId: pack?.packId || 'unknown_pack',
    issues,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    errors: issues.map((issue) => ({ code: issue.code, message: issue.message })),
    summary: !issues.some((issue) => issue.severity === 'error')
      ? 'Canonical Seoul graph pack passed validation.'
      : `${issues.filter((issue) => issue.severity === 'error').length} validation error(s) detected.`,
  };
}

export function listGraphPersonas() {
  return PERSONAS.map((persona) => ({
    ...buildLegacyPersona(persona),
  }));
}

export function getGraphDashboard(args = {}) {
  const runtime = buildRuntimeState(args);
  const legacyPersona = buildLegacyPersona(runtime.persona);
  const roadmap = buildRoadmap(
    runtime.persona,
    runtime.foundationEvaluation,
    runtime.overlayCandidates,
  );
  const legacyWorldRoadmap = buildLegacyWorldRoadmap(
    runtime.persona,
    runtime.foundationEvaluation,
    runtime.overlayCandidates,
  );
  const recommendations = buildRecommendations({
    foundationEvaluation: runtime.foundationEvaluation,
    overlayCandidates: runtime.overlayCandidates,
    lessonBundle: runtime.lessonBundle,
    hangoutBundle: runtime.hangoutBundle,
    limit: Number(args.limit) || 4,
  });

  return {
    generatedAtIso: baseIso(),
    persona: legacyPersona,
    worldRoadmap: legacyWorldRoadmap,
    locationSkillTree: buildLegacyLocationSkillTree(runtime),
    personalizedOverlay: buildLegacyOverlay(runtime.overlayCandidates),
    nextActions: buildLegacyNextActions(recommendations),
    lessonBundle: cloneJson(runtime.lessonBundle),
    hangoutBundle: cloneJson(runtime.hangoutBundle),
    metrics: buildLegacyMetrics(runtime),
    learner: {
      learnerId: runtime.persona.learnerId,
      displayName: runtime.persona.displayName,
      targetLanguages: cloneJson(runtime.persona.targetLanguages),
      proficiency: cloneJson(runtime.persona.proficiency),
      goals: cloneJson(runtime.persona.goals),
      mediaPreferences: cloneJson(runtime.persona.mediaPreferences),
    },
    languageSummary: cloneJson(runtime.languageSummary),
    progression: cloneJson(runtime.progression),
    roadmap,
    nextUnlocks: cloneJson(runtime.nextUnlocks),
    selectedPack: {
      pack: cloneJson(runtime.selection.pack),
      nodes: cloneJson(runtime.selectedEvaluation.nodeEntries),
      missionGate: cloneJson(runtime.missionGate),
      lessonBundle: cloneJson(runtime.lessonBundle),
      hangoutBundle: cloneJson(runtime.hangoutBundle),
    },
    overlays: runtime.overlayCandidates.map((candidate) => cloneJson(candidate.overlay)),
    recommendations,
    evidence: {
      totalEvents: runtime.allEvidence.length,
      lastUpdatedAt:
        runtime.allEvidence.map((event) => event.createdAt).sort().at(-1) || undefined,
    },
  };
}

export function getGraphNextActions(args = {}) {
  const runtime = buildRuntimeState(args);
  const foundationNextUnlocks = buildNextUnlocks(runtime.foundationEvaluation, 3);
  const foundationMissionGate = runtime.foundationEvaluation.missions[0] || null;
  const recommendations = buildRecommendations({
    foundationEvaluation: runtime.foundationEvaluation,
    overlayCandidates: runtime.overlayCandidates,
    lessonBundle: buildLessonBundle(
      runtime.foundationEvaluation.pack,
      runtime.foundationEvaluation,
      runtime.persona.learnerId,
      foundationNextUnlocks,
    ),
    hangoutBundle: buildHangoutBundle(
      runtime.foundationEvaluation.pack,
      runtime.foundationEvaluation,
      runtime.persona.learnerId,
      foundationMissionGate,
    ),
    limit: Number(args.limit) || 4,
  });
  return {
    generatedAtIso: baseIso(),
    learnerId: runtime.persona.learnerId,
    personaId: runtime.persona.aliases?.[0] || runtime.persona.learnerId,
    actions: buildLegacyNextActions(recommendations),
    recommendations,
  };
}

export function getGraphLessonBundle(args = {}) {
  const runtime = buildRuntimeState(args);
  return runtime.lessonBundle;
}

export function getGraphHangoutBundle(args = {}) {
  const runtime = buildRuntimeState(args);
  return runtime.hangoutBundle;
}

export function recordGraphEvidence(args = {}) {
  const persona = getPersonaFromArgs(args);
  const runtimeEvidence = getRuntimeEvidence(persona.learnerId);

  if (Array.isArray(args.events) && args.events.length > 1) {
    throw createGraphError(
      'graph_bulk_evidence_not_supported',
      'Record graph evidence accepts exactly one event per call.',
      400,
    );
  }

  const rawEvent = Array.isArray(args.events) ? args.events[0] : args.event;
  const normalizedEvent = normalizeRuntimeEvent(
    rawEvent,
    persona.learnerId,
    runtimeEvidence.length,
  );

  runtimeEvidence.push(normalizedEvent);

  const pack = getPackForNode(normalizedEvent.nodeId);
  const allEvidence = materializeEvidence(persona);
  const evaluation = derivePackEvaluation(pack, persona.learnerId, allEvidence);
  const progression = deriveProgression(deriveCanonicalEvaluations(persona, allEvidence), allEvidence);
  const state = evaluation.stateByNodeId.get(normalizedEvent.nodeId);
  const legacyEvent = {
    eventId: normalizedEvent.eventId,
    personaId: persona.aliases?.[0] || persona.learnerId,
    userId: persona.userId,
    nodeId: normalizedEvent.legacyNodeId || normalizedEvent.nodeId,
    objectiveId: normalizedEvent.legacyObjectiveId || normalizedEvent.nodeId,
    mode: normalizedEvent.legacyMode || normalizedEvent.mode,
    quality: normalizedEvent.legacyQuality ?? normalizedEvent.qualityScore / 5,
    occurredAtIso: normalizedEvent.createdAt,
    source: normalizedEvent.source,
  };

  return {
    accepted: true,
    learnerId: persona.learnerId,
    personaId: persona.aliases?.[0] || persona.learnerId,
    recorded: 1,
    events: [legacyEvent],
    event: cloneJson(normalizedEvent),
    state: cloneJson(state),
    progression,
    metrics: {
      validatedObjectives: evaluation.nodeEntries.filter((entry) => entry.state.status === 'validated').length,
      masteredObjectives: evaluation.nodeEntries.filter((entry) => entry.state.status === 'mastered').length,
      dueNodeCount: evaluation.nodeEntries.filter((entry) => entry.state.status === 'due').length,
      evidenceCount: allEvidence.length,
    },
  };
}

export function proposeGraphOverlay(args = {}) {
  const persona = getPersonaFromArgs(args);
  const candidates = buildOverlayCandidates(persona)
    .filter((candidate) => (args.lang ? candidate.overlay.lang === args.lang : true))
    .filter((candidate) => (args.theme ? candidate.theme === args.theme : true));
  const count = Math.max(1, Number(args.count) || 5);

  return {
    learnerId: persona.learnerId,
    overlays: candidates.map((candidate) => ({
      ...cloneJson(candidate.overlay),
      suggestedTerms: candidate.overlay.suggestedTerms.slice(0, count),
    })),
  };
}

export function getGoldPack() {
  return cloneJson(SEOUL_FOOD_STREET_PACK);
}

export function resetGraphRuntime(learnerId = undefined) {
  if (!learnerId) {
    runtimeEvidenceByLearner.clear();
    runtimeLearnersByLearnerId.clear();
    runtimeLearnerIdByUserId.clear();
    return;
  }
  const persona = getPersona(learnerId);
  const canonicalLearnerId = persona?.learnerId || learnerId;
  runtimeEvidenceByLearner.delete(canonicalLearnerId);
  const runtimeLearner = runtimeLearnersByLearnerId.get(canonicalLearnerId);
  if (runtimeLearner) {
    runtimeLearnersByLearnerId.delete(canonicalLearnerId);
    runtimeLearnerIdByUserId.delete(runtimeLearner.userId);
  }
}

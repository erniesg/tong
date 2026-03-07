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

const VALID_CITIES = new Set(Object.keys(CITY_LABELS));
const VALID_LOCATIONS = new Set(Object.keys(LOCATION_LABELS));
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

  for (const cityId of VALID_CITIES) {
    for (const locationId of VALID_LOCATIONS) {
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
  if (!VALID_LOCATIONS.has(value)) {
    throw createGraphError('invalid_graph_location', `Unknown graph location "${value}".`, 400, {
      location: value,
    });
  }
  return value;
}

function inferCityFromLocation(locationId) {
  if (!locationId) return null;
  if (locationId === 'practice_studio') return 'shanghai';
  return 'seoul';
}

function resolveSelection(args = {}) {
  const requestedLocation = normalizeLocation(args.location);
  const requestedCity = normalizeCity(args.city) || inferCityFromLocation(requestedLocation) || 'seoul';
  const locationId = requestedLocation || DEFAULT_LOCATION_BY_CITY[requestedCity];
  const pack = PACK_REGISTRY.get(keyFor(requestedCity, locationId));

  if (!pack) {
    throw createGraphError(
      'graph_pack_not_found',
      `No curriculum pack is registered for ${requestedCity}/${locationId}.`,
      404,
      {
        city: requestedCity,
        location: locationId,
      },
    );
  }

  return {
    cityId: requestedCity,
    locationId,
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

  for (const edge of pack.edges || []) {
    if (!nodeById.has(edge.toNodeId) || !nodeById.has(edge.fromNodeId)) continue;
    if (!supportsByNodeId.has(edge.toNodeId)) continue;

    if (edge.type === 'requires' || edge.type === 'unlocks') {
      blockersByNodeId.get(edge.toNodeId).push(edge.fromNodeId);
      supportsByNodeId.get(edge.toNodeId).push(edge.fromNodeId);
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

  return {
    nodeById,
    objectiveNodes,
    blockersByNodeId,
    supportsByNodeId,
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

function derivePackEvaluation(pack, learnerId, allEvidence) {
  const index = buildPackIndex(pack);
  const nodeIds = new Set(index.objectiveNodes.map((node) => node.nodeId));
  const evidenceSummary = summarizeEvidence(allEvidence, nodeIds);
  const stateByNodeId = new Map();
  const nodeEntries = [];

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
    missions: (pack.missions || []).map((mission) => ({
      ...mission,
      ready: (mission.requiredNodeIds || []).every((nodeId) =>
        COMPLETED_STATUSES.has(stateByNodeId.get(nodeId)?.status),
      ),
    })),
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

  return [
    {
      cityId: 'seoul',
      locationId: 'food_street',
      title: 'Seoul Food Street',
      lang: 'ko',
      status:
        foundationEvaluation.completedNodeCount > 0 || foundationEvaluation.activeNodeCount > 0
          ? 'in_progress'
          : 'ready',
      summary:
        foundationEvaluation.completedNodeCount > 0
          ? 'Core Korean foundation path with active work on ordering language.'
          : 'Core Korean foundation path is ready to start.',
      activeNodeCount: foundationEvaluation.activeNodeCount,
      completedNodeCount: foundationEvaluation.completedNodeCount,
    },
    {
      cityId: 'tokyo',
      locationId: 'food_street',
      title: 'Tokyo Food Street',
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
      locationId: 'practice_studio',
      title: 'Shanghai Practice Studio',
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

function buildLessonBundle(pack, evaluation, learnerId) {
  if ((pack.nodes || []).length === 0 || evaluation.nodeEntries.length === 0) {
    return {
      learnerId,
      nodeIds: [],
      objectiveIds: [],
      title: `${pack.title} lesson bundle`,
      reason: 'This location does not have an authored lesson bundle yet.',
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
    learnerId,
    nodeIds: supportNodeIds,
    objectiveIds: supportNodeIds,
    title,
    reason,
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

function buildHangoutBundle(pack, evaluation, learnerId) {
  const scenarios = (pack.scenarios || []).filter((scenario) => scenario.mode === 'hangout');
  if (scenarios.length === 0) {
    return {
      learnerId,
      nodeIds: [],
      objectiveIds: [],
      scenarioId: '',
      title: `${pack.title} hangout bundle`,
      reason: 'No authored hangout scenario exists for this pack yet.',
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
      return {
        learnerId,
        nodeIds: scenarioEntries.map((entry) => entry.node.nodeId),
        objectiveIds: scenarioEntries.map((entry) => entry.node.nodeId),
        scenarioId: scenario.scenarioId,
        title: 'Food Street Hangout Validation',
        reason: 'The learner has enough readiness to validate polite Korean ordering in-context.',
      };
    }
  }

  return {
    learnerId,
    nodeIds: [],
    objectiveIds: [],
    scenarioId: '',
    title: `${pack.title} hangout bundle`,
    reason: 'No scenario has enough readiness yet; keep building lesson evidence first.',
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

  const readyMission = foundationEvaluation.missions.find((mission) => mission.ready);
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
  const lessonBundle = buildLessonBundle(selection.pack, selectedEvaluation, persona.learnerId);
  const hangoutBundle = buildHangoutBundle(selection.pack, selectedEvaluation, persona.learnerId);

  return {
    persona,
    selection,
    allEvidence,
    foundationEvaluation,
    selectedEvaluation,
    overlayCandidates,
    progression,
    lessonBundle,
    hangoutBundle,
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

function normalizeRuntimeEvent(rawEvent, learnerId, eventIndex) {
  if (!rawEvent || typeof rawEvent !== 'object') {
    throw createGraphError('invalid_evidence_event', 'Evidence event payload is required.', 400);
  }

  const rawNodeId = typeof rawEvent.nodeId === 'string' ? rawEvent.nodeId.trim() : '';
  const nodeId = LEGACY_NODE_ID_ALIASES.get(rawNodeId) || rawNodeId;
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

  const rawMode = typeof rawEvent.mode === 'string' ? rawEvent.mode : 'learn';
  if (!['learn', 'hangout', 'review', 'mission'].includes(rawMode)) {
    throw createGraphError(
      'invalid_evidence_mode',
      `Unsupported evidence mode "${rawMode}".`,
      400,
      { mode: rawMode },
    );
  }

  const qualityScore = normalizeQualityScore(rawEvent);
  const source = normalizeEvidenceSource(rawEvent.source, rawMode);
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
    source,
    mode: rawMode,
    correct: typeof rawEvent.correct === 'boolean' ? rawEvent.correct : qualityScore >= 3,
    qualityScore,
    createdAt,
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
  };
}

export function listGraphPersonas() {
  return PERSONAS.map((persona) => ({
    learnerId: persona.learnerId,
    displayName: persona.displayName,
    targetLanguages: cloneJson(persona.targetLanguages),
    proficiency: cloneJson(persona.proficiency),
    goals: cloneJson(persona.goals),
    mediaPreferences: cloneJson(persona.mediaPreferences),
  }));
}

export function getGraphDashboard(args = {}) {
  const runtime = buildRuntimeState(args);

  return {
    learner: {
      learnerId: runtime.persona.learnerId,
      displayName: runtime.persona.displayName,
      targetLanguages: cloneJson(runtime.persona.targetLanguages),
      proficiency: cloneJson(runtime.persona.proficiency),
      goals: cloneJson(runtime.persona.goals),
      mediaPreferences: cloneJson(runtime.persona.mediaPreferences),
    },
    progression: cloneJson(runtime.progression),
    roadmap: buildRoadmap(
      runtime.persona,
      runtime.foundationEvaluation,
      runtime.overlayCandidates,
    ),
    selectedPack: {
      pack: cloneJson(runtime.selection.pack),
      nodes: cloneJson(runtime.selectedEvaluation.nodeEntries),
    },
    overlays: runtime.overlayCandidates.map((candidate) => cloneJson(candidate.overlay)),
    recommendations: buildRecommendations({
      foundationEvaluation: runtime.foundationEvaluation,
      overlayCandidates: runtime.overlayCandidates,
      lessonBundle: runtime.lessonBundle,
      hangoutBundle: runtime.hangoutBundle,
      limit: Number(args.limit) || 4,
    }),
    evidence: {
      totalEvents: runtime.allEvidence.length,
      lastUpdatedAt:
        runtime.allEvidence.map((event) => event.createdAt).sort().at(-1) || undefined,
    },
  };
}

export function getGraphNextActions(args = {}) {
  const runtime = buildRuntimeState(args);
  return {
    learnerId: runtime.persona.learnerId,
    actions: buildRecommendations({
      foundationEvaluation: runtime.foundationEvaluation,
      overlayCandidates: runtime.overlayCandidates,
      lessonBundle: buildLessonBundle(
        runtime.foundationEvaluation.pack,
        runtime.foundationEvaluation,
        runtime.persona.learnerId,
      ),
      hangoutBundle: buildHangoutBundle(
        runtime.foundationEvaluation.pack,
        runtime.foundationEvaluation,
        runtime.persona.learnerId,
      ),
      limit: Number(args.limit) || 4,
    }),
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

  return {
    accepted: true,
    learnerId: persona.learnerId,
    event: cloneJson(normalizedEvent),
    state: cloneJson(state),
    progression,
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

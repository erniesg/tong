import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const generatedDir = path.join(repoRoot, 'apps/server/data/generated');

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_WEIGHT = {
  youtube: 1,
  spotify: 1.15,
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
    objectiveId: 'ko_food_l2_001',
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
    objectiveId: 'zh_stage_l3_002',
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
    objectiveId: 'ko_city_l2_003',
    objectiveReason: 'Builds social and navigation language transfer',
    objectiveGap: 0.72,
  },
];

const TOKEN_REGEX = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z]{2,}/gu;
const KANA_REGEX = /[\u3040-\u30ff]/u;
const HANGUL_REGEX = /[\uac00-\ud7af]/u;
const HAN_REGEX = /[\u4e00-\u9fff]/u;

const OBJECTIVE_BY_LANG = {
  ko: {
    objectiveId: 'ko_food_l2_001',
    reason: 'Reinforces Korean phrase utility for food-street scenes',
    gap: 0.74,
  },
  ja: {
    objectiveId: 'ko_city_l2_003',
    reason: 'Builds Japanese transit and social phrase reliability',
    gap: 0.7,
  },
  zh: {
    objectiveId: 'zh_stage_l3_002',
    reason: 'Strengthens Mandarin mission vocabulary recall',
    gap: 0.8,
  },
  en: {
    objectiveId: 'ko_city_l2_003',
    reason: 'Supports cross-city objective transfer terms',
    gap: 0.62,
  },
};

const RADICAL_BY_CHAR = {
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

const RELATED_FORMS_BY_RADICAL = {
  火: ['炎', '灯', '烧'],
  食: ['饭', '饮', '餐'],
  言: ['语', '话', '词'],
};

function detectScriptType(token) {
  if (HANGUL_REGEX.test(token)) return 'hangul';
  if (HAN_REGEX.test(token)) return 'han';
  if (KANA_REGEX.test(token)) return 'kana';
  return 'latin';
}

function normalizeToken(token) {
  return String(token || '').trim();
}

function extractTokens(text) {
  if (!text) return [];
  return (text.match(TOKEN_REGEX) || [])
    .map(normalizeToken)
    .filter((token) => token.length >= 2);
}

function parseIso(input, fallbackIso) {
  const candidate = input || fallbackIso || new Date().toISOString();
  const value = new Date(candidate);
  if (Number.isNaN(value.getTime())) {
    return new Date(fallbackIso || Date.now());
  }
  return value;
}

function detectLang(term) {
  if (HANGUL_REGEX.test(term)) return 'ko';
  if (KANA_REGEX.test(term)) return 'ja';
  if (HAN_REGEX.test(term)) return 'zh';
  return 'en';
}

function normalizeTermKey(token) {
  const cleaned = normalizeToken(token);
  if (!cleaned) return '';
  return cleaned.toLocaleLowerCase();
}

function getTopicMatches(text) {
  const haystack = String(text || '').toLocaleLowerCase();
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
        objectiveReason: 'General fallback objective linkage',
        objectiveGap: 0.62,
      },
    ];
  }

  return matches;
}

function topicFromId(clusterId) {
  return (
    TOPIC_DEFINITIONS.find((topic) => topic.clusterId === clusterId) || {
      clusterId,
      label: clusterId,
      keywords: ['general'],
      objectiveId: 'ko_food_l2_001',
      objectiveReason: 'General fallback objective linkage',
      objectiveGap: 0.62,
    }
  );
}

function pickDominantCluster(clusterVotes) {
  let winner = null;
  let best = -1;
  for (const [clusterId, score] of clusterVotes.entries()) {
    if (score > best) {
      best = score;
      winner = clusterId;
    }
  }
  return winner || 'general';
}

function safeNorm(value, max) {
  if (!max || max <= 0) return 0;
  return value / max;
}

function burstScore(recentCount, baselineCount) {
  const ratio = (recentCount + 1) / (baselineCount + 1);
  const burst = 1 + 0.2 * (ratio - 1);
  return Number(Math.max(0.5, Math.min(3, burst)).toFixed(2));
}

function detectRadical(chars) {
  for (const char of chars) {
    if (RADICAL_BY_CHAR[char]) return RADICAL_BY_CHAR[char];
  }
  for (const char of chars) {
    if (RELATED_FORMS_BY_RADICAL[char]) return char;
  }
  return chars[0] || null;
}

function orthographyFeaturesForLemma(lemma) {
  const scriptType = detectScriptType(lemma);

  if (scriptType === 'hangul') {
    return {
      scriptType,
      syllables: [...lemma].filter((char) => HANGUL_REGEX.test(char)).slice(0, 6),
    };
  }

  if (scriptType === 'han') {
    const hanChars = [...lemma].filter((char) => HAN_REGEX.test(char));
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
      morae: [...lemma].filter((char) => KANA_REGEX.test(char)).slice(0, 6),
    };
  }

  return { scriptType };
}

function objectiveLinkForEntry(entry) {
  const topic = topicFromId(entry.clusterId);
  const langFallback = OBJECTIVE_BY_LANG[entry.lang] || OBJECTIVE_BY_LANG.en;
  const topicGap = Number(topic.objectiveGap || 0);
  const gap = topicGap > 0 ? topicGap : langFallback.gap;
  return {
    objectiveId: topic.objectiveId || langFallback.objectiveId,
    reason: topic.objectiveReason || langFallback.reason,
    gap,
  };
}

function aggregateTopMedia(sourceItems, source) {
  const grouped = new Map();
  for (const item of sourceItems) {
    if (item.source !== source) continue;
    const mediaId = item.mediaId || item.id || `media_${source}`;
    const key = `${source}:${mediaId}`;
    const existing = grouped.get(key) || {
      mediaId,
      title: item.title || mediaId,
      lang: item.lang || 'ko',
      minutes: 0,
    };
    existing.minutes += Number(item.minutes || 0);
    grouped.set(key, existing);
  }
  return [...grouped.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
}

export function buildMediaEventsFromSnapshot(snapshot, userId = 'demo-user-1') {
  const windowEndIso = snapshot?.windowEndIso || snapshot?.generatedAtIso || new Date().toISOString();
  const sourceItems = Array.isArray(snapshot?.sourceItems) ? snapshot.sourceItems : [];

  return sourceItems.map((item, idx) => {
    const mediaId = item.mediaId || item.id || `${item.source || 'youtube'}_${idx}`;
    const consumedAtIso = item.playedAtIso || windowEndIso;
    const rawTokens =
      Array.isArray(item.tokens) && item.tokens.length > 0 ? item.tokens : extractTokens(item.text || '');
    return {
      eventId: item.eventId || `evt_${idx + 1}`,
      userId,
      source: item.source === 'spotify' ? 'spotify' : 'youtube',
      mediaId,
      title: item.title || mediaId,
      lang: item.lang || 'ko',
      minutes: Number(item.minutes || 0),
      consumedAtIso,
      tokens: rawTokens,
      text: item.text || '',
    };
  });
}

export function runMockIngestion(snapshot, options = {}) {
  const userId = options.userId || 'demo-user-1';
  const events = buildMediaEventsFromSnapshot(snapshot, userId);
  const windowStart = parseIso(snapshot?.windowStartIso, new Date(Date.now() - 3 * DAY_MS).toISOString());
  const windowEnd = parseIso(snapshot?.windowEndIso, new Date().toISOString());
  const midpoint = new Date(windowStart.getTime() + (windowEnd.getTime() - windowStart.getTime()) / 2);

  const termMap = new Map();
  const clusterStats = new Map();
  const sourceBreakdown = {
    youtube: { itemsConsumed: 0, minutes: 0, topMedia: [] },
    spotify: { itemsConsumed: 0, minutes: 0, topMedia: [] },
  };

  for (const event of events) {
    const source = event.source === 'spotify' ? 'spotify' : 'youtube';
    sourceBreakdown[source].itemsConsumed += 1;
    sourceBreakdown[source].minutes += Number(event.minutes || 0);
  }

  sourceBreakdown.youtube.topMedia = aggregateTopMedia(events, 'youtube');
  sourceBreakdown.spotify.topMedia = aggregateTopMedia(events, 'spotify');

  for (const event of events) {
    const source = event.source;
    const consumedAt = parseIso(event.consumedAtIso, windowEnd.toISOString());
    const ageHours = Math.max(0, (windowEnd.getTime() - consumedAt.getTime()) / (60 * 60 * 1000));
    const recencyWeight = Math.exp(-ageHours / Math.max(1, (windowEnd.getTime() - windowStart.getTime()) / (60 * 60 * 1000)));
    const topicMatches = getTopicMatches(`${event.title || ''} ${event.text || ''}`);
    const tokens = Array.isArray(event.tokens) && event.tokens.length > 0 ? event.tokens : extractTokens(event.text || '');

    for (const topic of topicMatches) {
      const topicEntry = clusterStats.get(topic.clusterId) || {
        clusterId: topic.clusterId,
        label: topic.label,
        keywords: topic.keywords.slice(0, 6),
        objectiveId: topic.objectiveId,
        count: 0,
        termCounts: new Map(),
      };
      topicEntry.count += 1;
      clusterStats.set(topic.clusterId, topicEntry);
    }

    for (const tokenRaw of tokens) {
      const token = normalizeToken(tokenRaw);
      const key = normalizeTermKey(token);
      if (!key) continue;

      const existing = termMap.get(key) || {
        lemma: token,
        lang: event.lang || detectLang(token),
        count: 0,
        weighted: 0,
        recencyWeighted: 0,
        sourceSet: new Set(),
        sourceBreakdown: { youtube: 0, spotify: 0 },
        baselineCount: 0,
        recentCount: 0,
        clusterVotes: new Map(),
      };

      existing.count += 1;
      existing.weighted += SOURCE_WEIGHT[source] || 1;
      existing.recencyWeighted += (SOURCE_WEIGHT[source] || 1) * recencyWeight;
      existing.sourceSet.add(source);
      existing.sourceBreakdown[source] += 1;
      if (consumedAt < midpoint) existing.baselineCount += 1;
      else existing.recentCount += 1;

      for (const topic of topicMatches) {
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

  const frequencyItems = termEntries.map((entry) => ({
    lemma: entry.lemma,
    lang: entry.lang,
    count: entry.count,
    sourceCount: entry.sourceSet.size,
    sourceBreakdown: entry.sourceBreakdown,
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
      0.15 * objective.gap +
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
      objectiveLinks: [
        {
          objectiveId: row.objective.objectiveId,
          reason: row.objective.reason,
        },
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
    }));

  const topTerms = frequencyItems.slice(0, 8);
  const clusterAffinityMap = new Map();
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

  const totalTopWeight = topTerms.reduce((sum, item) => sum + item.count * Math.max(item.sourceCount, 1), 0) || 1;
  const learningSignals = {
    topTerms: topTerms.map((item) => ({
      lemma: item.lemma,
      lang: item.lang,
      weightedScore: Number(((item.count * Math.max(item.sourceCount, 1)) / totalTopWeight).toFixed(2)),
      dominantSource:
        Number(item.sourceBreakdown?.youtube || 0) >= Number(item.sourceBreakdown?.spotify || 0)
          ? 'youtube'
          : 'spotify',
    })),
    clusterAffinities: topTopics,
  };

  const result = {
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
      windowDays: Math.max(1, Math.round((windowEnd.getTime() - windowStart.getTime()) / DAY_MS)),
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

  return result;
}

export function writeGeneratedSnapshots(result) {
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatedDir, 'frequency.snapshot.json'),
    JSON.stringify(result.frequency, null, 2),
  );
  fs.writeFileSync(
    path.join(generatedDir, 'insights.snapshot.json'),
    JSON.stringify(result.insights, null, 2),
  );
  fs.writeFileSync(
    path.join(generatedDir, 'media-profile.snapshot.json'),
    JSON.stringify(result.mediaProfile, null, 2),
  );
}

export function loadGeneratedSnapshot(name) {
  const fullPath = path.join(generatedDir, `${name}.snapshot.json`);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const generatedDir = path.join(repoRoot, 'apps/server/data/generated');

const TOPIC_DEFINITIONS = [
  {
    clusterId: 'food-ordering',
    label: 'Food Ordering',
    keywords: ['food', 'restaurant', 'order', 'menu', 'spicy', 'kitchen', '먹', '주문', '메뉴', '맛', '라면', '떡볶이', '카페', '咖啡', '吃'],
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

const TOKEN_REGEX = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z]{2,}/gu;

function detectScriptType(token) {
  if (/[\p{Script=Hangul}]/u.test(token)) return 'hangul';
  if (/[\p{Script=Han}]/u.test(token)) return 'han';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(token)) return 'kana';
  return 'latin';
}

function normalizeToken(token) {
  return token.trim();
}

function extractTokens(text) {
  if (!text) return [];
  return (text.match(TOKEN_REGEX) || [])
    .map(normalizeToken)
    .filter((token) => token.length >= 2);
}

function getTopicMatches(text) {
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

function sortFrequencyEntries(map) {
  return [...map.entries()].sort((a, b) => {
    if (b[1].sourceCount !== a[1].sourceCount) {
      return b[1].sourceCount - a[1].sourceCount;
    }
    return b[1].count - a[1].count;
  });
}

export function runMockIngestion(snapshot) {
  const frequencyMap = new Map();
  const topicStats = new Map();
  const sourceBreakdown = {
    youtube: { itemsConsumed: 0, minutes: 0, topMedia: [] },
    spotify: { itemsConsumed: 0, minutes: 0, topMedia: [] },
  };

  const sourceItems = snapshot.sourceItems || [];

  for (const item of sourceItems) {
    const source = item.source === 'spotify' ? 'spotify' : 'youtube';
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
        terms: new Map(),
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
        sourceSet: new Set(),
        sourceBreakdown: { youtube: 0, spotify: 0 },
      };

      existing.count += 1;
      existing.sourceSet.add(source);
      existing.sourceBreakdown[source] += 1;
      frequencyMap.set(token, existing);

      for (const topic of topics) {
        const topicEntry = topicStats.get(topic.clusterId);
        if (!topicEntry.terms.has(token)) {
          topicEntry.terms.set(token, 0);
        }
        topicEntry.terms.set(token, topicEntry.terms.get(token) + 1);
      }
    }
  }

  const sortedFrequency = sortFrequencyEntries(frequencyMap);
  const averageCount =
    sortedFrequency.length > 0
      ? sortedFrequency.reduce((sum, [, value]) => sum + value.count, 0) / sortedFrequency.length
      : 1;

  const frequencyItems = sortedFrequency.map(([, value]) => ({
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

  const totalScore =
    topTerms.reduce((sum, item) => sum + item.count * item.sourceCount, 0) || 1;
  const learningSignals = {
    topTerms: topTerms.map((item) => ({
      lemma: item.lemma,
      lang: item.lang,
      weightedScore: Number(((item.count * item.sourceCount) / totalScore).toFixed(2)),
      dominantSource:
        (item.sourceBreakdown?.youtube || 0) >= (item.sourceBreakdown?.spotify || 0)
          ? 'youtube'
          : 'spotify',
    })),
    clusterAffinities: topTopics,
  };

  const result = {
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
      userId: 'demo-user-1',
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

import fs from "node:fs";
import path from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_KEYS = ["youtube", "spotify"];

const SOURCE_WEIGHT = {
  youtube: 1,
  spotify: 1.15
};

const CLUSTERS = [
  {
    clusterId: "food-ordering",
    label: "Food Ordering",
    keywords: ["메뉴", "주문", "먹", "포장", "맵", "snack", "food"]
  },
  {
    clusterId: "performance-energy",
    label: "Performance Energy",
    keywords: ["무대", "연습", "火", "燃", "stage", "dance", "voice"]
  },
  {
    clusterId: "transport-navigation",
    label: "Transit Navigation",
    keywords: ["지하철", "역", "subway", "station", "transfer"]
  }
];

const OBJECTIVE_BY_CLUSTER = {
  "food-ordering": {
    objectiveId: "ko_food_l2_001",
    reason: "High utility in next food-location hangout",
    gap: 0.84
  },
  "performance-energy": {
    objectiveId: "zh_stage_l3_002",
    reason: "Supports Shanghai advanced texting mission vocabulary",
    gap: 0.9
  },
  "transport-navigation": {
    objectiveId: "ja_subway_l1_001",
    reason: "Improves route and transfer conversation readiness",
    gap: 0.72
  }
};

const OBJECTIVE_BY_LANG = {
  ko: {
    objectiveId: "ko_food_l2_001",
    reason: "Reinforces Korean phrase utility for food-street scenes",
    gap: 0.74
  },
  ja: {
    objectiveId: "ja_subway_l1_001",
    reason: "Builds Japanese transit phrase reliability",
    gap: 0.7
  },
  zh: {
    objectiveId: "zh_stage_l3_002",
    reason: "Strengthens Mandarin mission vocabulary recall",
    gap: 0.8
  },
  en: {
    objectiveId: "ja_subway_l1_001",
    reason: "Useful bridge terms for subway objective setup",
    gap: 0.62
  }
};

const RADICAL_BY_CHAR = {
  火: "火",
  炎: "火",
  灯: "火",
  烧: "火",
  燃: "火",
  热: "火",
  食: "食",
  饭: "食",
  飲: "食",
  饮: "食",
  餐: "食",
  言: "言",
  詞: "言",
  词: "言",
  話: "言",
  话: "言",
  語: "言",
  语: "言"
};

const RELATED_FORMS_BY_RADICAL = {
  火: ["炎", "灯", "烧"],
  食: ["饭", "饮", "餐"],
  言: ["语", "话", "词"]
};

function parseIso(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${input}`);
  }
  return date;
}

function normalizeTerm(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function detectLang(term) {
  if (/[\uac00-\ud7af]/u.test(term)) {
    return "ko";
  }
  if (/[\u3040-\u30ff]/u.test(term)) {
    return "ja";
  }
  if (/[\u4e00-\u9fff]/u.test(term)) {
    return "zh";
  }
  return "en";
}

function clusterForTerm(term) {
  const matched = CLUSTERS.find((cluster) =>
    cluster.keywords.some((keyword) => term.includes(keyword.toLowerCase()))
  );

  return matched?.clusterId ?? null;
}

function getWindowBounds({ events, userId = null, windowDays, nowIso }) {
  const scopedEvents = userId ? events.filter((event) => event.userId === userId) : events;
  const eventDates = scopedEvents.map((event) => parseIso(event.consumedAtIso));
  const windowEnd = nowIso
    ? parseIso(nowIso)
    : eventDates.length > 0
      ? new Date(Math.max(...eventDates.map((date) => date.getTime())))
      : new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * DAY_MS);

  return { windowStart, windowEnd };
}

function filterEventsByWindow({ events, userId, windowStart, windowEnd }) {
  return events.filter((event) => {
    if (userId && event.userId !== userId) {
      return false;
    }

    const consumedAt = parseIso(event.consumedAtIso);
    return consumedAt >= windowStart && consumedAt <= windowEnd;
  });
}

function filterEventsByRange({ events, userId, rangeStart, rangeEnd }) {
  return events.filter((event) => {
    if (userId && event.userId !== userId) {
      return false;
    }

    const consumedAt = parseIso(event.consumedAtIso);
    return consumedAt >= rangeStart && consumedAt < rangeEnd;
  });
}

function aggregateTerms(events, { windowEnd, windowDays }) {
  const terms = new Map();
  const decayHours = Math.max(1, windowDays * 24);

  for (const event of events) {
    const source = event.source;
    const consumedAt = parseIso(event.consumedAtIso);
    const ageHours = Math.max(0, (windowEnd.getTime() - consumedAt.getTime()) / (60 * 60 * 1000));
    const recencyWeight = Math.exp(-ageHours / decayHours);

    for (const tokenRaw of event.tokens ?? []) {
      const token = normalizeTerm(tokenRaw);
      if (!token) {
        continue;
      }

      const weight = SOURCE_WEIGHT[source] ?? 1;
      const prev = terms.get(token) ?? {
        lemma: tokenRaw,
        normalized: token,
        lang: detectLang(tokenRaw),
        count: 0,
        weighted: 0,
        recencyWeighted: 0,
        sourceSet: new Set(),
        sourceWeights: Object.fromEntries(SOURCE_KEYS.map((key) => [key, 0])),
        clusterId: clusterForTerm(token)
      };

      prev.count += 1;
      prev.weighted += weight;
      prev.recencyWeighted += weight * recencyWeight;
      prev.sourceSet.add(source);
      if (typeof prev.sourceWeights[source] !== "number") {
        prev.sourceWeights[source] = 0;
      }
      prev.sourceWeights[source] += weight;
      if (!prev.clusterId) {
        prev.clusterId = clusterForTerm(token);
      }

      terms.set(token, prev);
    }
  }

  return terms;
}

function applyLangFilter(terms, lang) {
  const rows = Array.from(terms.values());
  if (!lang) {
    return rows;
  }
  return rows.filter((term) => term.lang === lang);
}

function getObjectiveLink(term) {
  const byCluster = term.clusterId ? OBJECTIVE_BY_CLUSTER[term.clusterId] : null;
  if (byCluster) {
    return byCluster;
  }

  return OBJECTIVE_BY_LANG[term.lang] ?? OBJECTIVE_BY_LANG.en;
}

function detectScriptType(term) {
  if (/[\uac00-\ud7af]/u.test(term)) {
    return "hangul";
  }
  if (/[\u4e00-\u9fff]/u.test(term)) {
    return "han";
  }
  if (/[\u3040-\u30ff]/u.test(term)) {
    return "kana";
  }
  return "latin";
}

function detectRadical(chars) {
  for (const ch of chars) {
    if (RADICAL_BY_CHAR[ch]) {
      return RADICAL_BY_CHAR[ch];
    }
  }

  for (const ch of chars) {
    if (RELATED_FORMS_BY_RADICAL[ch]) {
      return ch;
    }
  }

  return chars[0] ?? null;
}

function orthographyFeaturesForTerm(lemma) {
  const scriptType = detectScriptType(lemma);

  if (scriptType === "hangul") {
    return {
      scriptType,
      syllables: [...lemma].filter((ch) => /[\uac00-\ud7af]/u.test(ch)).slice(0, 6)
    };
  }

  if (scriptType === "han") {
    const hanChars = [...lemma].filter((ch) => /[\u4e00-\u9fff]/u.test(ch));
    const radical = detectRadical(hanChars);
    const relatedForms = radical ? RELATED_FORMS_BY_RADICAL[radical] ?? [] : [];

    return {
      scriptType,
      ...(radical ? { radical } : {}),
      ...(relatedForms.length > 0 ? { relatedForms } : {})
    };
  }

  if (scriptType === "kana") {
    return {
      scriptType,
      morae: [...lemma].filter((ch) => /[\u3040-\u30ff]/u.test(ch)).slice(0, 6)
    };
  }

  return { scriptType };
}

function topItemsFromMedia(events) {
  const grouped = new Map();

  for (const event of events) {
    const key = `${event.source}:${event.mediaId}`;
    const prev = grouped.get(key) ?? {
      mediaId: event.mediaId,
      title: event.title,
      lang: event.lang,
      minutes: 0,
      embedUrl: event.embedUrl
    };

    prev.minutes += Number(event.minutes) || 0;
    if (!prev.embedUrl && event.embedUrl) {
      prev.embedUrl = event.embedUrl;
    }

    grouped.set(key, prev);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);
}

function computeClusterScores(termEntries) {
  const rawScores = CLUSTERS.map((cluster) => {
    let score = 0;

    for (const entry of termEntries) {
      if (entry.clusterId !== cluster.clusterId) {
        continue;
      }

      score += entry.weighted;
    }

    return {
      clusterId: cluster.clusterId,
      label: cluster.label,
      score
    };
  }).filter((item) => item.score > 0);

  const max = rawScores.reduce((best, item) => Math.max(best, item.score), 0) || 1;

  return rawScores
    .map((item) => ({
      clusterId: item.clusterId,
      label: item.label,
      score: Number((item.score / max).toFixed(4))
    }))
    .sort((a, b) => b.score - a.score);
}

function plannerRecommendations(clusterScores, topTerms) {
  const byCluster = Object.fromEntries(clusterScores.map((item) => [item.clusterId, item.score]));

  const objectiveCandidates = [
    {
      objectiveId: "ko_food_l2_001",
      reason: "High food-ordering coverage from recent consumption",
      confidence: Number((byCluster["food-ordering"] ?? 0).toFixed(2))
    },
    {
      objectiveId: "zh_stage_l3_002",
      reason: "Performance-energy cluster is active in CN/KR media",
      confidence: Number((byCluster["performance-energy"] ?? 0).toFixed(2))
    },
    {
      objectiveId: "ja_subway_l1_001",
      reason: "Transit vocabulary appears in multi-source content",
      confidence: Number((byCluster["transport-navigation"] ?? 0).toFixed(2))
    }
  ].filter((item) => item.confidence > 0);

  const sceneCandidates = [
    {
      sceneId: "food_street_hangout_intro",
      city: "seoul",
      mode: "hangout",
      objectiveId: "ko_food_l2_001"
    },
    {
      sceneId: "shanghai_texting_mission_advanced",
      city: "shanghai",
      mode: "hangout",
      objectiveId: "zh_stage_l3_002"
    }
  ].filter((scene) => objectiveCandidates.some((objective) => objective.objectiveId === scene.objectiveId));

  const exerciseCandidates = topTerms.slice(0, 6).map((term) => ({
    type: "targeted-drill",
    lemma: term.lemma,
    lang: term.lang,
    objectiveId:
      term.clusterId === "food-ordering"
        ? "ko_food_l2_001"
        : term.clusterId === "performance-energy"
          ? "zh_stage_l3_002"
          : "ja_subway_l1_001",
    reason: `Frequent in ${term.dominantSource} over last 72h`
  }));

  return {
    objectiveCandidates,
    sceneCandidates,
    exerciseCandidates
  };
}

function buildTermCountMap(events) {
  const counts = new Map();

  for (const event of events) {
    for (const tokenRaw of event.tokens ?? []) {
      const token = normalizeTerm(tokenRaw);
      if (!token) {
        continue;
      }
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return counts;
}

function burstForCount(currentCount, baselineCount) {
  const ratio = (currentCount + 1) / (baselineCount + 1);
  const burst = 1 + 0.2 * (ratio - 1);
  return Number(Math.max(0.5, Math.min(3, burst)).toFixed(2));
}

function safeNorm(value, max) {
  if (!max || max <= 0) {
    return 0;
  }
  return value / max;
}

function buildInsightsClusters(items) {
  const grouped = new Map();

  for (const item of items) {
    if (!item.clusterId || item.clusterId === "unassigned") {
      continue;
    }
    const group = grouped.get(item.clusterId) ?? [];
    group.push(item);
    grouped.set(item.clusterId, group);
  }

  return Array.from(grouped.entries())
    .map(([clusterId, clusterItems]) => {
      const meta = CLUSTERS.find((cluster) => cluster.clusterId === clusterId) ?? {
        clusterId,
        label: clusterId
      };
      const sorted = [...clusterItems].sort((a, b) => b.score - a.score || b.frequency - a.frequency);
      const keywords = sorted.slice(0, 3).map((item) => item.lemma);
      const topTerms = sorted.slice(0, 2).map((item) => item.lemma);

      return {
        clusterId: meta.clusterId,
        label: meta.label,
        keywords,
        topTerms,
        score: sorted.reduce((sum, item) => sum + item.score, 0)
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...cluster }) => cluster);
}

export function loadEvents(eventsPath) {
  const absolute = path.resolve(eventsPath);
  const raw = fs.readFileSync(absolute, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.events)) {
    throw new Error("Expected events array in events fixture");
  }

  return parsed.events;
}

export function buildPlannerContext({ userId, events, windowDays = 3, nowIso }) {
  const { windowStart, windowEnd } = getWindowBounds({ events, userId, windowDays, nowIso });
  const filtered = filterEventsByWindow({ events, userId, windowStart, windowEnd });

  const sourceBreakdown = {
    youtube: {
      itemsConsumed: 0,
      minutes: 0,
      topMedia: []
    },
    spotify: {
      itemsConsumed: 0,
      minutes: 0,
      topMedia: []
    }
  };

  for (const source of ["youtube", "spotify"]) {
    const sourceEvents = filtered.filter((event) => event.source === source);
    sourceBreakdown[source].itemsConsumed = sourceEvents.length;
    sourceBreakdown[source].minutes = sourceEvents.reduce(
      (sum, event) => sum + (Number(event.minutes) || 0),
      0
    );
    sourceBreakdown[source].topMedia = topItemsFromMedia(sourceEvents);
  }

  const mergedTerms = aggregateTerms(filtered, { windowEnd, windowDays });
  const sortedTerms = Array.from(mergedTerms.values()).sort((a, b) => b.weighted - a.weighted);
  const maxWeighted = sortedTerms[0]?.weighted ?? 1;

  const topTerms = sortedTerms.slice(0, 20).map((term) => ({
    lemma: term.lemma,
    lang: term.lang,
    count: term.count,
    weightedScore: Number((term.weighted / maxWeighted).toFixed(4)),
    dominantSource: term.sourceWeights.spotify > term.sourceWeights.youtube ? "spotify" : "youtube",
    clusterId: term.clusterId ?? "unassigned"
  }));

  const clusterScores = computeClusterScores(
    sortedTerms.map((term) => ({
      weighted: term.weighted,
      clusterId: term.clusterId
    }))
  );

  return {
    userId,
    windowDays,
    generatedAtIso: windowEnd.toISOString(),
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
    sourceBreakdown,
    topTerms,
    topicModel: {
      clusters: clusterScores
    },
    plannerInput: plannerRecommendations(clusterScores, topTerms)
  };
}

export function buildFrequencyPayload({
  userId = null,
  events,
  windowDays = 3,
  limit = 100,
  nowIso,
  lang = null
}) {
  const { windowStart, windowEnd } = getWindowBounds({ events, userId, windowDays, nowIso });
  const filteredEvents = filterEventsByWindow({ events, userId, windowStart, windowEnd });
  const termMap = aggregateTerms(filteredEvents, { windowEnd, windowDays });

  const items = applyLangFilter(termMap, lang)
    .sort((a, b) => b.count - a.count || b.sourceSet.size - a.sourceSet.size || b.weighted - a.weighted)
    .slice(0, limit)
    .map((term) => ({
      lemma: term.lemma,
      lang: term.lang,
      count: term.count,
      sourceCount: term.sourceSet.size
    }));

  return {
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
    items
  };
}

export function buildVocabInsights({
  userId = null,
  events,
  windowDays = 3,
  limit = 50,
  nowIso,
  lang = null
}) {
  const { windowStart, windowEnd } = getWindowBounds({ events, userId, windowDays, nowIso });
  const filteredEvents = filterEventsByWindow({ events, userId, windowStart, windowEnd });

  const baselineStart = new Date(windowStart.getTime() - windowDays * DAY_MS);
  const baselineEvents = filterEventsByRange({
    events,
    userId,
    rangeStart: baselineStart,
    rangeEnd: windowStart
  });

  const baselineCounts = buildTermCountMap(baselineEvents);
  const termMap = aggregateTerms(filteredEvents, { windowEnd, windowDays });
  const termRows = applyLangFilter(termMap, lang);

  if (termRows.length === 0) {
    return {
      windowStartIso: windowStart.toISOString(),
      windowEndIso: windowEnd.toISOString(),
      clusters: [],
      items: []
    };
  }

  const withBurst = termRows.map((term) => {
    const baselineCount = baselineCounts.get(term.normalized) ?? 0;
    return {
      ...term,
      baselineCount,
      burst: burstForCount(term.count, baselineCount)
    };
  });

  const maxCount = withBurst.reduce((best, term) => Math.max(best, term.count), 0) || 1;
  const maxBurst = withBurst.reduce((best, term) => Math.max(best, term.burst), 0) || 1;
  const maxRecency = withBurst.reduce((best, term) => Math.max(best, term.recencyWeighted), 0) || 1;

  const scored = withBurst.map((term) => {
    const objective = getObjectiveLink(term);
    const frequencyNorm = safeNorm(term.count, maxCount);
    const burstNorm = maxBurst > 1 ? safeNorm(term.burst - 1, maxBurst - 1) : 0;
    const relevance = safeNorm(term.recencyWeighted, maxRecency);
    const objectiveGap = objective.gap;
    const novelty = 1 / (1 + term.baselineCount);
    const rawScore =
      0.3 * frequencyNorm +
      0.25 * burstNorm +
      0.2 * relevance +
      0.15 * objectiveGap +
      0.1 * novelty;

    return {
      ...term,
      objective,
      rawScore,
      frequency: term.count,
      clusterId: term.clusterId ?? "unassigned"
    };
  });

  const maxRawScore = scored.reduce((best, term) => Math.max(best, term.rawScore), 0) || 1;
  const scoredNormalized = scored.map((term) => ({
    lemma: term.lemma,
    lang: term.lang,
    score: Number((term.rawScore / maxRawScore).toFixed(2)),
    frequency: term.frequency,
    burst: term.burst,
    clusterId: term.clusterId,
    orthographyFeatures: orthographyFeaturesForTerm(term.lemma),
    objectiveLinks: [
      {
        objectiveId: term.objective.objectiveId,
        reason: term.objective.reason
      }
    ]
  }));

  const sortedItems = scoredNormalized
    .sort((a, b) => b.score - a.score || b.frequency - a.frequency || a.lemma.localeCompare(b.lemma))
    .slice(0, limit);

  return {
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
    clusters: buildInsightsClusters(scoredNormalized),
    items: sortedItems
  };
}

import fs from "node:fs";
import path from "node:path";

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
  const eventDates = events.map((event) => parseIso(event.consumedAtIso));
  const windowEnd = nowIso ? parseIso(nowIso) : new Date(Math.max(...eventDates.map((d) => d.getTime())));
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const filtered = events.filter((event) => {
    if (event.userId !== userId) {
      return false;
    }

    const consumedAt = parseIso(event.consumedAtIso);
    return consumedAt >= windowStart && consumedAt <= windowEnd;
  });

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

  const terms = new Map();

  for (const event of filtered) {
    for (const tokenRaw of event.tokens ?? []) {
      const token = normalizeTerm(tokenRaw);
      if (!token) {
        continue;
      }

      const key = `${token}:${event.source}`;
      const weight = SOURCE_WEIGHT[event.source] ?? 1;
      const prev = terms.get(key) ?? {
        lemma: tokenRaw,
        normalized: token,
        lang: detectLang(tokenRaw),
        source: event.source,
        count: 0,
        weighted: 0,
        clusterId: clusterForTerm(token)
      };

      prev.count += 1;
      prev.weighted += weight;
      terms.set(key, prev);
    }
  }

  const mergedTerms = new Map();

  for (const term of terms.values()) {
    const prev = mergedTerms.get(term.normalized) ?? {
      lemma: term.lemma,
      lang: term.lang,
      count: 0,
      weighted: 0,
      sourceWeights: { youtube: 0, spotify: 0 },
      clusterId: term.clusterId
    };

    prev.count += term.count;
    prev.weighted += term.weighted;
    prev.sourceWeights[term.source] += term.weighted;
    if (!prev.clusterId && term.clusterId) {
      prev.clusterId = term.clusterId;
    }

    mergedTerms.set(term.normalized, prev);
  }

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

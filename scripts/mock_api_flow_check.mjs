#!/usr/bin/env node

import fs from 'node:fs';

const args = process.argv.slice(2);
const baseArg = args.find((arg) => !arg.startsWith('-'));
const strictState = args.includes('--strict-state');
const checkScenarioSeed = args.includes('--check-scenario-seed');
const checkProgressionPersistence = args.includes('--check-progression-persistence');
const sourcesArg = args.find((arg) => arg.startsWith('--sources='));
const traceFileArg = args.find((arg) => arg.startsWith('--trace-file='));
const apiBase = (baseArg || process.env.TONG_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const demoPassword = process.env.TONG_DEMO_PASSWORD || process.env.TONG_DEMO_CODE || '';
const traceFile = traceFileArg ? traceFileArg.slice('--trace-file='.length) : '';
const includeSources = sourcesArg
  ? [...new Set(
    sourcesArg
      .slice('--sources='.length)
      .split(',')
      .map((source) => source.trim().toLowerCase())
      .filter((source) => source === 'youtube' || source === 'spotify'),
  )]
  : [];

const userId = `mock_user_${Date.now().toString(36)}`;
const networkTrace = [];
const profile = {
  nativeLanguage: 'en',
  targetLanguages: ['ko', 'ja', 'zh'],
  proficiency: {
    ko: 'beginner',
    ja: 'none',
    zh: 'none',
  },
};

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logWarn(message) {
  console.warn(`WARN ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includesHangul(value) {
  return /[\uac00-\ud7af]/u.test(String(value || ''));
}

function assertNoHangul(value, label) {
  assert(!includesHangul(value), `${label} should not contain Hangul: ${value}`);
}

function writeNetworkTrace() {
  if (!traceFile) return;
  fs.writeFileSync(traceFile, `${JSON.stringify(networkTrace, null, 2)}\n`, 'utf8');
}

function assertJsonEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${label} mismatch`);
}

async function requestJson(pathname, init = {}) {
  const url = `${apiBase}${pathname}`;
  const method = init.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(demoPassword ? { 'x-demo-password': demoPassword } : {}),
    ...(init.headers || {}),
  };
  const startedAt = Date.now();

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  networkTrace.push({
    recordedAtIso: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    request: {
      method,
      url,
      pathname,
      headers: Object.fromEntries(
        Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'x-demo-password'),
      ),
      body: typeof init.body === 'string' && init.body.length > 0 ? init.body : null,
    },
    response: {
      ok: response.ok,
      status: response.status,
      headers: {
        contentType: response.headers.get('content-type') || '',
      },
      body: data,
    },
  });
  writeNetworkTrace();

  return {
    ok: response.ok,
    status: response.status,
    data,
    text,
    url,
  };
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} should be an array`);
  assert(value.length > 0, `${label} should not be empty`);
}

function expectsSource(source) {
  return includeSources.length === 0 || includeSources.includes(source);
}

async function run() {
  console.log(`Running mock flow checks against ${apiBase}`);
  console.log(`Strict stateful checks: ${strictState ? 'enabled' : 'disabled'}`);
  console.log(`Scenario seed checks: ${checkScenarioSeed ? 'enabled' : 'disabled'}`);
  console.log(`Progression persistence checks: ${checkProgressionPersistence ? 'enabled' : 'disabled'}`);
  console.log(`Source scope: ${includeSources.length > 0 ? includeSources.join(', ') : 'all'}`);

  const health = await requestJson('/health');
  assert(health.ok, `/health failed (${health.status})`);
  assert(health.data?.ok === true, '/health payload missing ok=true');
  logPass('/health');

  const captions = await requestJson('/api/v1/captions/enriched?videoId=karina-variety-demo&lang=ko');
  assert(captions.ok, `/captions failed (${captions.status})`);
  assertArray(captions.data?.segments, 'captions.segments');
  logPass('/api/v1/captions/enriched');

  const dictionary = await requestJson('/api/v1/dictionary/entry?term=%EC%A3%BC%EB%AC%B8&lang=ko');
  assert(dictionary.ok, `/dictionary failed (${dictionary.status})`);
  assert(typeof dictionary.data?.meaning === 'string' && dictionary.data.meaning.length > 0, 'dictionary.meaning missing');
  logPass('/api/v1/dictionary/entry');

  const profileUpdate = await requestJson('/api/v1/profile/proficiency', {
    method: 'PUT',
    body: JSON.stringify({
      userId,
      profile,
    }),
  });
  assert(profileUpdate.ok, `/profile/proficiency failed (${profileUpdate.status})`);
  assert(profileUpdate.data?.ok === true, 'profile update response missing ok=true');
  logPass('/api/v1/profile/proficiency');

  const ingest = await requestJson('/api/v1/ingestion/run-mock', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      profile,
      ...(includeSources.length > 0 ? { includeSources } : {}),
    }),
  });
  assert(ingest.ok, `/ingestion/run-mock failed (${ingest.status})`);
  assert(ingest.data?.success === true, 'ingestion response missing success=true');
  assertArray(ingest.data?.topTerms, 'ingestion.topTerms');
  logPass('/api/v1/ingestion/run-mock');

  const mediaProfile = await requestJson(`/api/v1/player/media-profile?windowDays=3&userId=${encodeURIComponent(userId)}`);
  assert(mediaProfile.ok, `/player/media-profile failed (${mediaProfile.status})`);
  assert(mediaProfile.data?.userId === userId, 'mediaProfile userId mismatch');
  const ytCount = mediaProfile.data?.sourceBreakdown?.youtube?.itemsConsumed || 0;
  const spCount = mediaProfile.data?.sourceBreakdown?.spotify?.itemsConsumed || 0;
  if (expectsSource('youtube')) {
    assert(ytCount > 0, 'youtube sourceBreakdown missing');
  } else {
    assert(ytCount === 0, `youtube sourceBreakdown should be 0 when source-scoped: ${ytCount}`);
  }
  if (expectsSource('spotify')) {
    assert(spCount > 0, 'spotify sourceBreakdown missing');
  } else {
    assert(spCount === 0, `spotify sourceBreakdown should be 0 when source-scoped: ${spCount}`);
  }
  assertArray(mediaProfile.data?.learningSignals?.topTerms, 'learningSignals.topTerms');
  assertArray(mediaProfile.data?.learningSignals?.clusterAffinities, 'learningSignals.clusterAffinities');
  assertArray(mediaProfile.data?.learningSignals?.placementCandidates, 'learningSignals.placementCandidates');
  assertArray(mediaProfile.data?.learningSignals?.topTerms[0]?.provenance?.samples, 'learningSignals.topTerms[0].provenance.samples');
  logPass('/api/v1/player/media-profile');

  const spotifyStatusBeforeSync = await requestJson(`/api/v1/integrations/spotify/status?userId=${encodeURIComponent(userId)}`);
  assert(spotifyStatusBeforeSync.ok, `/integrations/spotify/status pre-sync failed (${spotifyStatusBeforeSync.status})`);
  assert(spotifyStatusBeforeSync.data?.connected === false, 'spotify status should start disconnected');
  assert((spotifyStatusBeforeSync.data?.lastSyncItemCount || 0) === 0, 'spotify status should not report sync items before sync');
  assert(spotifyStatusBeforeSync.data?.lastSyncAtIso == null, 'spotify status should not report lastSyncAtIso before sync');
  logPass('/api/v1/integrations/spotify/status pre-sync');

  const spotifyConnect = await requestJson(`/api/v1/integrations/spotify/connect?userId=${encodeURIComponent(userId)}`);
  assert(spotifyConnect.ok, `/integrations/spotify/connect failed (${spotifyConnect.status})`);
  assert(spotifyConnect.data?.connected === false, 'spotify connect should start disconnected');
  assert(typeof spotifyConnect.data?.authUrl === 'string', 'spotify connect authUrl missing');
  logPass('/api/v1/integrations/spotify/connect');

  const spotifySync = await requestJson('/api/v1/integrations/spotify/sync', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  assert(spotifySync.ok, `/integrations/spotify/sync failed (${spotifySync.status})`);
  assert(spotifySync.data?.ok === true, 'spotify sync missing ok=true');
  assert(Number.isFinite(spotifySync.data?.spotifyItemCount), 'spotify sync item count missing');
  assertArray(spotifySync.data?.recentMediaRationale?.rankedTerms, 'spotify sync recentMediaRationale.rankedTerms');
  logPass('/api/v1/integrations/spotify/sync');

  const spotifyStatus = await requestJson(`/api/v1/integrations/spotify/status?userId=${encodeURIComponent(userId)}`);
  assert(spotifyStatus.ok, `/integrations/spotify/status failed (${spotifyStatus.status})`);
  assert(spotifyStatus.data?.connected === true, 'spotify status should report connected after sync');
  logPass('/api/v1/integrations/spotify/status');

  const youtubeStatusBeforeSync = await requestJson(`/api/v1/integrations/youtube/status?userId=${encodeURIComponent(userId)}`);
  assert(youtubeStatusBeforeSync.ok, `/integrations/youtube/status pre-sync failed (${youtubeStatusBeforeSync.status})`);
  assert(youtubeStatusBeforeSync.data?.connected === false, 'youtube status should start disconnected');
  assert((youtubeStatusBeforeSync.data?.lastSyncItemCount || 0) === 0, 'youtube status should not report sync items before sync');
  assert(youtubeStatusBeforeSync.data?.lastSyncAtIso == null, 'youtube status should not report lastSyncAtIso before sync');
  logPass('/api/v1/integrations/youtube/status pre-sync');

  const youtubeConnect = await requestJson(`/api/v1/integrations/youtube/connect?userId=${encodeURIComponent(userId)}`);
  assert(youtubeConnect.ok, `/integrations/youtube/connect failed (${youtubeConnect.status})`);
  assert(youtubeConnect.data?.connected === false, 'youtube connect should start disconnected');
  assert(typeof youtubeConnect.data?.authUrl === 'string', 'youtube connect authUrl missing');
  logPass('/api/v1/integrations/youtube/connect');

  const youtubeSync = await requestJson('/api/v1/integrations/youtube/sync', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  assert(youtubeSync.ok, `/integrations/youtube/sync failed (${youtubeSync.status})`);
  assert(youtubeSync.data?.ok === true, 'youtube sync missing ok=true');
  assert(Number.isFinite(youtubeSync.data?.youtubeItemCount), 'youtube sync item count missing');
  assertArray(youtubeSync.data?.recentMediaRationale?.rankedTerms, 'youtube sync recentMediaRationale.rankedTerms');
  logPass('/api/v1/integrations/youtube/sync');

  const youtubeStatus = await requestJson(`/api/v1/integrations/youtube/status?userId=${encodeURIComponent(userId)}`);
  assert(youtubeStatus.ok, `/integrations/youtube/status failed (${youtubeStatus.status})`);
  assert(youtubeStatus.data?.connected === true, 'youtube status should report connected after sync');
  logPass('/api/v1/integrations/youtube/status');

  const frequency = await requestJson(`/api/v1/vocab/frequency?windowDays=3&userId=${encodeURIComponent(userId)}`);
  assert(frequency.ok, `/vocab/frequency failed (${frequency.status})`);
  assertArray(frequency.data?.items, 'frequency.items');
  logPass('/api/v1/vocab/frequency');

  const insights = await requestJson(`/api/v1/vocab/insights?windowDays=3&lang=ko&userId=${encodeURIComponent(userId)}`);
  assert(insights.ok, `/vocab/insights failed (${insights.status})`);
  assertArray(insights.data?.clusters, 'insights.clusters');
  assertArray(insights.data?.items, 'insights.items');
  assertArray(insights.data.items[0]?.objectiveLinks, 'insights.items[0].objectiveLinks');
  assertArray(insights.data.items[0]?.placementHints, 'insights.items[0].placementHints');
  assertArray(insights.data.items[0]?.provenance?.samples, 'insights.items[0].provenance.samples');
  logPass('/api/v1/vocab/insights');

  const objectiveKo = await requestJson(
    `/api/v1/objectives/next?userId=${encodeURIComponent(userId)}&mode=hangout&lang=ko&city=seoul&location=food_street`,
  );
  assert(objectiveKo.ok, `/objectives/next ko failed (${objectiveKo.status})`);
  assert(objectiveKo.data?.lang === 'ko', 'objectiveKo.lang should be ko');
  assert(objectiveKo.data?.objectiveGraph?.source === 'knowledge_graph', 'objectiveKo.objectiveGraph.source missing');
  assert(objectiveKo.data?.objectiveGraph?.cityId === 'seoul', 'objectiveKo.objectiveGraph.cityId mismatch');
  assert(objectiveKo.data?.objectiveGraph?.locationId === 'food_street', 'objectiveKo.objectiveGraph.locationId mismatch');
  assertArray(objectiveKo.data?.objectiveGraph?.targetNodeIds, 'objectiveKo.objectiveGraph.targetNodeIds');
  assertArray(objectiveKo.data?.coreTargets?.vocabulary, 'objectiveKo.coreTargets.vocabulary');
  assertArray(objectiveKo.data?.coreTargets?.grammar, 'objectiveKo.coreTargets.grammar');
  assertArray(objectiveKo.data?.coreTargets?.sentenceStructures, 'objectiveKo.coreTargets.sentenceStructures');
  assertArray(objectiveKo.data?.personalizedTargets, 'objectiveKo.personalizedTargets');
  assertArray(objectiveKo.data?.recentMediaRationale?.rankedTerms, 'objectiveKo.recentMediaRationale.rankedTerms');
  assertArray(objectiveKo.data?.placementHints, 'objectiveKo.placementHints');
  assert(
    objectiveKo.data.personalizedTargets.every((item) => Array.isArray(item.linkedNodeIds) && item.linkedNodeIds.length > 0),
    'objectiveKo.personalizedTargets[].linkedNodeIds missing',
  );
  assert(Number.isFinite(objectiveKo.data?.completionCriteria?.minEvidenceEvents), 'objectiveKo.minEvidenceEvents missing');
  assertArray(objectiveKo.data?.completionCriteria?.acceptedEvidenceModes, 'objectiveKo.acceptedEvidenceModes');
  assert(
    typeof objectiveKo.data?.objectiveId === 'string' && objectiveKo.data.objectiveId.startsWith('ko-'),
    `objectiveKo.objectiveId should start with ko-: ${objectiveKo.data?.objectiveId}`,
  );
  assert(objectiveKo.data?.legacyObjectiveId === 'ko_food_l2_001', 'objectiveKo.legacyObjectiveId mismatch');
  logPass('/api/v1/objectives/next?lang=ko');

  const objectiveJa = await requestJson(
    `/api/v1/objectives/next?userId=${encodeURIComponent(userId)}&mode=hangout&lang=ja&city=tokyo&location=subway_hub`,
  );
  assert(objectiveJa.ok, `/objectives/next ja failed (${objectiveJa.status})`);
  assert(objectiveJa.data?.lang === 'ja', 'objectiveJa.lang should be ja');
  assert(objectiveJa.data?.objectiveGraph?.cityId === 'tokyo', 'objectiveJa.objectiveGraph.cityId mismatch');
  assert(objectiveJa.data?.objectiveGraph?.locationId === 'subway_hub', 'objectiveJa.objectiveGraph.locationId mismatch');
  assertArray(objectiveJa.data?.objectiveGraph?.targetNodeIds, 'objectiveJa.objectiveGraph.targetNodeIds');
  assertArray(objectiveJa.data?.coreTargets?.vocabulary, 'objectiveJa.coreTargets.vocabulary');
  assertArray(objectiveJa.data?.recentMediaRationale?.rankedTerms, 'objectiveJa.recentMediaRationale.rankedTerms');
  assertArray(objectiveJa.data?.placementHints, 'objectiveJa.placementHints');
  objectiveJa.data.objectiveGraph.targetNodeIds.forEach((targetNodeId, index) =>
    assertNoHangul(targetNodeId, `objectiveJa.objectiveGraph.targetNodeIds[${index}]`),
  );
  objectiveJa.data.recentMediaRationale.rankedTerms.forEach((term, index) => {
    assert(term?.lang === 'ja', `objectiveJa.recentMediaRationale.rankedTerms[${index}].lang mismatch`);
    assertNoHangul(term?.lemma, `objectiveJa.recentMediaRationale.rankedTerms[${index}].lemma`);
  });
  assert(
    typeof objectiveJa.data?.objectiveId === 'string' && objectiveJa.data.objectiveId.startsWith('ja-'),
    `objectiveJa.objectiveId should start with ja-: ${objectiveJa.data?.objectiveId}`,
  );
  assert(objectiveJa.data?.legacyObjectiveId === 'ja_subway_l1_001', 'objectiveJa.legacyObjectiveId mismatch');
  logPass('/api/v1/objectives/next?lang=ja');

  const objectiveZh = await requestJson(
    `/api/v1/objectives/next?userId=${encodeURIComponent(userId)}&mode=hangout&lang=zh&city=shanghai&location=practice_studio`,
  );
  assert(objectiveZh.ok, `/objectives/next zh failed (${objectiveZh.status})`);
  assert(objectiveZh.data?.lang === 'zh', 'objectiveZh.lang should be zh');
  assert(objectiveZh.data?.objectiveGraph?.cityId === 'shanghai', 'objectiveZh.objectiveGraph.cityId mismatch');
  assert(objectiveZh.data?.objectiveGraph?.locationId === 'practice_studio', 'objectiveZh.objectiveGraph.locationId mismatch');
  assertArray(objectiveZh.data?.coreTargets?.vocabulary, 'objectiveZh.coreTargets.vocabulary');
  assert(
    typeof objectiveZh.data?.objectiveId === 'string' && objectiveZh.data.objectiveId.startsWith('zh-'),
    `objectiveZh.objectiveId should start with zh-: ${objectiveZh.data?.objectiveId}`,
  );
  assert(objectiveZh.data?.legacyObjectiveId === 'zh_stage_l3_002', 'objectiveZh.legacyObjectiveId mismatch');
  logPass('/api/v1/objectives/next?lang=zh');

  const graphEvidence = await requestJson('/api/v1/graph/evidence', {
    method: 'POST',
    body: JSON.stringify({
      personaId: 'kpop-video-prompter',
      event: {
        nodeId: 'objective:ko-vocab-courtesy',
        objectiveId: 'ko-vocab-courtesy',
        mode: 'exercise',
        quality: 0.86,
        source: 'mock_api_flow_check',
      },
    }),
  });
  if (graphEvidence.status === 404) {
    logWarn('/api/v1/graph/evidence unavailable on this runtime; skipped graph evidence contract checks');
  } else {
    assert(graphEvidence.ok, `/graph/evidence failed (${graphEvidence.status})`);
    assert(Number.isFinite(graphEvidence.data?.recorded), 'graphEvidence.recorded missing');
    assertArray(graphEvidence.data?.events, 'graphEvidence.events');
    assert(graphEvidence.data.events[0]?.mode === 'exercise', 'graphEvidence event mode should preserve exercise');
    assert(Number.isFinite(graphEvidence.data?.metrics?.evidenceCount), 'graphEvidence.metrics.evidenceCount missing');
    logPass('/api/v1/graph/evidence');
  }

  const gameStart = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      profile,
    }),
  });
  assert(gameStart.ok, `/game/start-or-resume failed (${gameStart.status})`);
  assert(typeof gameStart.data?.sessionId === 'string' && gameStart.data.sessionId.length > 0, 'gameStart.sessionId missing');
  assert(typeof gameStart.data?.location === 'string' && gameStart.data.location.length > 0, 'gameStart.location missing');
  assert(['hangout', 'learn'].includes(gameStart.data?.mode), 'gameStart.mode missing/invalid');
  assert(typeof gameStart.data?.progression?.xp === 'number', 'gameStart progression missing xp');
  assertArray(gameStart.data?.actions, 'gameStart.actions');
  assertArray(gameStart.data?.recentMediaRationale?.rankedTerms, 'gameStart.recentMediaRationale.rankedTerms');
  assertArray(gameStart.data?.gameSession?.personalization?.rankedTerms, 'gameStart.gameSession.personalization.rankedTerms');
  const recentMediaSources = Object.fromEntries(
    (gameStart.data?.recentMediaRationale?.sourceSummary || []).map((entry) => [entry.source, entry.itemsConsumed || 0]),
  );
  assert((recentMediaSources.spotify || 0) > 0, 'gameStart recentMediaRationale should preserve spotify counts after youtube sync');
  assert((recentMediaSources.youtube || 0) > 0, 'gameStart recentMediaRationale should include youtube counts after youtube sync');
  assert(gameStart.data?.gameSession?.activeObjective?.lang === 'ko', 'gameStart activeObjective.lang should prefer the KO pilot path');
  assert(
    typeof gameStart.data?.gameSession?.activeObjective?.objectiveId === 'string' &&
      gameStart.data.gameSession.activeObjective.objectiveId.startsWith('ko-'),
    `gameStart activeObjective.objectiveId should start with ko-: ${gameStart.data?.gameSession?.activeObjective?.objectiveId}`,
  );
  const tokyoBootstrap = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId: `${userId}_tokyo`,
      city: 'tokyo',
      profile: {
        nativeLanguage: 'en',
        targetLanguages: ['ko', 'ja', 'zh'],
        proficiency: {
          ko: 'none',
          ja: 'none',
          zh: 'advanced',
        },
      },
    }),
  });
  assert(tokyoBootstrap.ok, `/game/start-or-resume tokyo fallback failed (${tokyoBootstrap.status})`);
  assert(
    tokyoBootstrap.data?.gameSession?.activeObjective?.lang === 'ja',
    'gameStart tokyo bootstrap should align to the JA runtime objective',
  );
  assert(tokyoBootstrap.data?.gameSession?.cityId === 'tokyo', 'gameStart tokyo bootstrap city mismatch');
  assert(tokyoBootstrap.data?.gameSession?.locationId === 'subway_hub', 'gameStart tokyo bootstrap location mismatch');
  assert(
    typeof tokyoBootstrap.data?.gameSession?.activeObjective?.objectiveId === 'string' &&
      tokyoBootstrap.data.gameSession.activeObjective.objectiveId.startsWith('ja-'),
    `gameStart tokyo bootstrap objective mismatch: ${tokyoBootstrap.data?.gameSession?.activeObjective?.objectiveId}`,
  );

  const tokyoCityRetentionBootstrap = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId: `${userId}_tokyo_city_retention`,
      city: 'tokyo',
      profile: {
        nativeLanguage: 'en',
        targetLanguages: ['ko', 'zh'],
        proficiency: {
          ko: 'none',
          zh: 'advanced',
        },
      },
    }),
  });
  assert(
    tokyoCityRetentionBootstrap.ok,
    `/game/start-or-resume tokyo city retention failed (${tokyoCityRetentionBootstrap.status})`,
  );
  assert(
    tokyoCityRetentionBootstrap.data?.gameSession?.cityId === 'tokyo',
    `gameStart tokyo city retention mismatch: ${tokyoCityRetentionBootstrap.data?.gameSession?.cityId}`,
  );
  assert(
    typeof tokyoCityRetentionBootstrap.data?.gameSession?.activeObjective?.objectiveId === 'string' &&
      tokyoCityRetentionBootstrap.data.gameSession.activeObjective.objectiveId.startsWith('ko-'),
    `gameStart tokyo city retention objective mismatch: ${tokyoCityRetentionBootstrap.data?.gameSession?.activeObjective?.objectiveId}`,
  );
  logPass('/api/v1/game/start-or-resume keeps requested city when runtime config is missing');

  assert(gameStart.data?.gameSession?.sessionId === gameStart.data.sessionId, 'gameStart.gameSession.sessionId mismatch');
  assert(gameStart.data?.sceneSession?.gameSessionId === gameStart.data.sessionId, 'gameStart.sceneSession.gameSessionId mismatch');
  assert(gameStart.data?.activeCheckpoint?.gameSessionId === gameStart.data.sessionId, 'gameStart.activeCheckpoint.gameSessionId mismatch');
  assert(gameStart.data?.sceneSession?.sceneSessionId === gameStart.data?.gameSession?.activeSceneSessionId, 'gameStart active scene session mismatch');
  assert(gameStart.data?.gameSession?.activeCheckpointId === gameStart.data?.activeCheckpoint?.checkpointId, 'gameStart active checkpoint mismatch');
  assert(['new_session', 'checkpoint', 'scenario_seed'].includes(gameStart.data?.resumeSource), 'gameStart.resumeSource missing/invalid');
  assert(typeof gameStart.data?.gameSession?.missionGate?.readiness === 'number', 'gameStart missionGate.readiness missing');
  assert(Array.isArray(gameStart.data?.gameSession?.unlocks?.locationIds), 'gameStart unlocks.locationIds missing');
  assert(gameStart.data?.activeCheckpoint?.route?.pathname === '/game', 'gameStart activeCheckpoint.route.pathname missing');
  assert(Number.isInteger(gameStart.data?.activeCheckpoint?.rng?.version), 'gameStart activeCheckpoint.rng.version missing');
  assertArray(gameStart.data?.availableScenarioSeeds, 'gameStart.availableScenarioSeeds');
  assert(
    gameStart.data.availableScenarioSeeds.every((seed) => seed.qaOnly === true && typeof seed.seedId === 'string'),
    'gameStart.availableScenarioSeeds must be QA-only entries',
  );
  logPass('/api/v1/game/start-or-resume');

  if (checkScenarioSeed) {
    const scenarioSeedId = gameStart.data?.availableScenarioSeeds?.[0]?.seedId || 'review_ready';
    const seededGame = await requestJson('/api/v1/game/start-or-resume', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        profile,
        scenarioSeedId,
      }),
    });
    assert(seededGame.ok, `/game/start-or-resume scenario seed failed (${seededGame.status})`);
    assert(seededGame.data?.resumeSource === 'scenario_seed', 'scenario seed start should report scenario_seed resumeSource');
    assert(seededGame.data?.activeCheckpoint?.route?.query?.scenarioSeed === scenarioSeedId, 'scenario seed route query missing scenarioSeed');
    assert(seededGame.data?.activeCheckpoint?.phase === 'review', 'scenario seed phase should land on review');
    assert(seededGame.data?.activeCheckpoint?.turn === 4, 'scenario seed turn should land on the deterministic review turn');
    assert(seededGame.data?.activeCheckpoint?.activeExercise?.exerciseType === 'block_crush', 'scenario seed activeExercise missing');
    assert(seededGame.data?.activeCheckpoint?.rng?.seed === 'review_ready_seed_v1', 'scenario seed rng.seed mismatch');
    logPass('/api/v1/game/start-or-resume scenario seed');
  }

  const startHangout = await requestJson('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      sessionId: gameStart.data.sessionId,
      city: 'seoul',
      location: 'food_street',
      lang: 'ko',
      objectiveId: objectiveKo.data.objectiveId,
    }),
  });
  assert(startHangout.ok, `/scenes/hangout/start failed (${startHangout.status})`);
  assert(typeof startHangout.data?.sceneSessionId === 'string', 'hangout start missing sceneSessionId');
  assert(startHangout.data?.uiPolicy?.allowOnlyDialogueAndHints === true, 'hangout uiPolicy missing/invalid');
  assert(
    startHangout.data?.sceneSessionId === gameStart.data?.sceneSession?.sceneSessionId,
    'hangout start should reuse active scene session for a persisted game session',
  );
  assert(
    startHangout.data?.state?.turn === gameStart.data?.activeCheckpoint?.turn,
    'hangout start turn should match active checkpoint turn',
  );
  logPass('/api/v1/scenes/hangout/start');

  const respondHangout = await requestJson('/api/v1/scenes/hangout/respond', {
    method: 'POST',
    body: JSON.stringify({
      sceneSessionId: startHangout.data.sceneSessionId,
      userUtterance: '떡볶이 주세요',
      toolContext: {
        dictionaryEnabled: true,
        objectiveTrackingEnabled: true,
      },
    }),
  });

  if (!respondHangout.ok) {
    if (!strictState && respondHangout.status === 404) {
      logWarn('/api/v1/scenes/hangout/respond returned 404 in non-strict mode (likely stateless runtime)');
    } else {
      throw new Error(`/scenes/hangout/respond failed (${respondHangout.status})`);
    }
  } else {
    assert(respondHangout.data?.accepted === true, 'hangout respond missing accepted=true');
    assert(typeof respondHangout.data?.state?.score?.xp === 'number', 'hangout respond missing score');
    assert(
      typeof respondHangout.data?.activeCheckpoint?.checkpointId === 'string',
      'hangout respond should return an updated activeCheckpoint',
    );
    logPass('/api/v1/scenes/hangout/respond');
  }

  const resumedGame = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      profile,
    }),
  });
  assert(resumedGame.ok, `/game/start-or-resume resume failed (${resumedGame.status})`);
  assert(resumedGame.data?.sessionId === gameStart.data?.sessionId, 'resume should reuse the active game session');
  assert(resumedGame.data?.resumeSource === 'checkpoint', 'resume should report checkpoint resumeSource');
  assert(
    resumedGame.data?.activeCheckpoint?.turn === respondHangout.data?.state?.turn,
    'resumed checkpoint turn should match the last persisted hangout turn',
  );
  assert(
    resumedGame.data?.activeCheckpoint?.checkpointId === resumedGame.data?.gameSession?.activeCheckpointId,
    'resumed active checkpoint should match gameSession.activeCheckpointId',
  );
  assert(
    resumedGame.data?.activeCheckpoint?.rng?.version > gameStart.data?.activeCheckpoint?.rng?.version,
    'resume should advance the persisted checkpoint version after a turn response',
  );
  if (checkProgressionPersistence) {
    assertJsonEqual(
      resumedGame.data?.activeCheckpoint?.missionGate,
      respondHangout.data?.activeCheckpoint?.missionGate,
      'resumed activeCheckpoint.missionGate',
    );
    assertJsonEqual(
      resumedGame.data?.activeCheckpoint?.unlocks,
      respondHangout.data?.activeCheckpoint?.unlocks,
      'resumed activeCheckpoint.unlocks',
    );
    assertJsonEqual(
      resumedGame.data?.activeCheckpoint?.rewards,
      respondHangout.data?.activeCheckpoint?.rewards,
      'resumed activeCheckpoint.rewards',
    );
    assertJsonEqual(
      resumedGame.data?.gameSession?.missionGate,
      resumedGame.data?.activeCheckpoint?.missionGate,
      'resumed gameSession.missionGate',
    );
    assertJsonEqual(
      resumedGame.data?.gameSession?.unlocks,
      resumedGame.data?.activeCheckpoint?.unlocks,
      'resumed gameSession.unlocks',
    );
    assertJsonEqual(
      resumedGame.data?.gameSession?.rewards,
      resumedGame.data?.activeCheckpoint?.rewards,
      'resumed gameSession.rewards',
    );
    logPass('/api/v1/game/start-or-resume progression persistence');
  }
  logPass('/api/v1/game/start-or-resume resume');

  const learnSessions = await requestJson(`/api/v1/learn/sessions?userId=${encodeURIComponent(userId)}&city=seoul&lang=ko`);
  assert(learnSessions.ok, `/learn/sessions GET failed (${learnSessions.status})`);
  assert(Array.isArray(learnSessions.data?.items), 'learnSessions.items should be an array');
  logPass('/api/v1/learn/sessions GET');

  const createLearn = await requestJson('/api/v1/learn/sessions', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      city: 'seoul',
      lang: 'ko',
      objectiveId: objectiveKo.data.objectiveId,
    }),
  });
  assert(createLearn.ok, `/learn/sessions POST failed (${createLearn.status})`);
  assert(typeof createLearn.data?.learnSessionId === 'string', 'learn session create missing learnSessionId');
  assert(typeof createLearn.data?.firstMessage?.text === 'string', 'learn session create missing firstMessage');
  assert(createLearn.data?.objectiveId === objectiveKo.data.objectiveId, 'learn session create objectiveId mismatch');
  logPass('/api/v1/learn/sessions POST');

  const createDefaultLearn = await requestJson('/api/v1/learn/sessions', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      city: 'seoul',
      lang: 'ko',
    }),
  });
  assert(createDefaultLearn.ok, `/learn/sessions POST default failed (${createDefaultLearn.status})`);
  assert(
    createDefaultLearn.data?.objectiveId === 'ko-vocab-food-items',
    `default learn session objectiveId mismatch: ${createDefaultLearn.data?.objectiveId}`,
  );
  assert(
    createDefaultLearn.data?.legacyObjectiveId === 'ko_food_l2_001',
    `default learn session legacyObjectiveId mismatch: ${createDefaultLearn.data?.legacyObjectiveId}`,
  );
  logPass('/api/v1/learn/sessions POST default objective');

  console.log('');
  console.log('Mock flow check complete.');
  console.log(`- API base: ${apiBase}`);
  console.log(`- userId: ${userId}`);
  console.log(`- strict state checks: ${strictState ? 'enabled' : 'disabled'}`);
  console.log(`- source scope: ${includeSources.length > 0 ? includeSources.join(', ') : 'all'}`);
}

run().catch((error) => {
  console.error('Mock flow check failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

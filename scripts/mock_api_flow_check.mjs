#!/usr/bin/env node

const args = process.argv.slice(2);
const baseArg = args.find((arg) => !arg.startsWith('-'));
const strictState = args.includes('--strict-state');
const apiBase = (baseArg || process.env.TONG_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');

const userId = `mock_user_${Date.now().toString(36)}`;
const profile = {
  nativeLanguage: 'en',
  targetLanguages: ['ko', 'zh'],
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

async function requestJson(pathname, init = {}) {
  const url = `${apiBase}${pathname}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };

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

async function run() {
  console.log(`Running mock flow checks against ${apiBase}`);
  console.log(`Strict stateful checks: ${strictState ? 'enabled' : 'disabled'}`);

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
    }),
  });
  assert(ingest.ok, `/ingestion/run-mock failed (${ingest.status})`);
  assert(ingest.data?.success === true, 'ingestion response missing success=true');
  assertArray(ingest.data?.topTerms, 'ingestion.topTerms');
  logPass('/api/v1/ingestion/run-mock');

  const mediaProfile = await requestJson(`/api/v1/player/media-profile?windowDays=3&userId=${encodeURIComponent(userId)}`);
  assert(mediaProfile.ok, `/player/media-profile failed (${mediaProfile.status})`);
  assert(mediaProfile.data?.userId === userId, 'mediaProfile userId mismatch');
  assert(mediaProfile.data?.sourceBreakdown?.youtube?.itemsConsumed > 0, 'youtube sourceBreakdown missing');
  assert(mediaProfile.data?.sourceBreakdown?.spotify?.itemsConsumed > 0, 'spotify sourceBreakdown missing');
  assertArray(mediaProfile.data?.learningSignals?.topTerms, 'learningSignals.topTerms');
  assertArray(mediaProfile.data?.learningSignals?.clusterAffinities, 'learningSignals.clusterAffinities');
  logPass('/api/v1/player/media-profile');

  const frequency = await requestJson(`/api/v1/vocab/frequency?windowDays=3&userId=${encodeURIComponent(userId)}`);
  assert(frequency.ok, `/vocab/frequency failed (${frequency.status})`);
  assertArray(frequency.data?.items, 'frequency.items');
  logPass('/api/v1/vocab/frequency');

  const insights = await requestJson(`/api/v1/vocab/insights?windowDays=3&lang=ko&userId=${encodeURIComponent(userId)}`);
  assert(insights.ok, `/vocab/insights failed (${insights.status})`);
  assertArray(insights.data?.clusters, 'insights.clusters');
  assertArray(insights.data?.items, 'insights.items');
  assertArray(insights.data.items[0]?.objectiveLinks, 'insights.items[0].objectiveLinks');
  logPass('/api/v1/vocab/insights');

  const objectiveKo = await requestJson(
    `/api/v1/objectives/next?userId=${encodeURIComponent(userId)}&mode=hangout&lang=ko&city=seoul&location=food_street`,
  );
  assert(objectiveKo.ok, `/objectives/next ko failed (${objectiveKo.status})`);
  assertArray(objectiveKo.data?.coreTargets?.vocabulary, 'objectiveKo.coreTargets.vocabulary');
  assertArray(objectiveKo.data?.coreTargets?.grammar, 'objectiveKo.coreTargets.grammar');
  assertArray(objectiveKo.data?.coreTargets?.sentenceStructures, 'objectiveKo.coreTargets.sentenceStructures');
  assert(
    typeof objectiveKo.data?.objectiveId === 'string' && objectiveKo.data.objectiveId.startsWith('ko_'),
    `objectiveKo.objectiveId should start with ko_: ${objectiveKo.data?.objectiveId}`,
  );
  logPass('/api/v1/objectives/next?lang=ko');

  const objectiveZh = await requestJson(
    `/api/v1/objectives/next?userId=${encodeURIComponent(userId)}&mode=hangout&lang=zh&city=shanghai&location=practice_studio`,
  );
  assert(objectiveZh.ok, `/objectives/next zh failed (${objectiveZh.status})`);
  assertArray(objectiveZh.data?.coreTargets?.vocabulary, 'objectiveZh.coreTargets.vocabulary');
  assert(
    typeof objectiveZh.data?.objectiveId === 'string' && objectiveZh.data.objectiveId.startsWith('zh_'),
    `objectiveZh.objectiveId should start with zh_: ${objectiveZh.data?.objectiveId}`,
  );
  logPass('/api/v1/objectives/next?lang=zh');

  const gameStart = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      profile,
    }),
  });
  assert(gameStart.ok, `/game/start-or-resume failed (${gameStart.status})`);
  assert(typeof gameStart.data?.sessionId === 'string' && gameStart.data.sessionId.length > 0, 'gameStart.sessionId missing');
  assert(typeof gameStart.data?.progression?.xp === 'number', 'gameStart progression missing xp');
  assertArray(gameStart.data?.actions, 'gameStart.actions');
  logPass('/api/v1/game/start-or-resume');

  const startHangout = await requestJson('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      city: 'seoul',
      location: 'food_street',
      lang: 'ko',
      objectiveId: objectiveKo.data.objectiveId,
    }),
  });
  assert(startHangout.ok, `/scenes/hangout/start failed (${startHangout.status})`);
  assert(typeof startHangout.data?.sceneSessionId === 'string', 'hangout start missing sceneSessionId');
  assert(startHangout.data?.uiPolicy?.allowOnlyDialogueAndHints === true, 'hangout uiPolicy missing/invalid');
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
    logPass('/api/v1/scenes/hangout/respond');
  }

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
  logPass('/api/v1/learn/sessions POST');

  console.log('');
  console.log('Mock flow check complete.');
  console.log(`- API base: ${apiBase}`);
  console.log(`- userId: ${userId}`);
  console.log(`- strict state checks: ${strictState ? 'enabled' : 'disabled'}`);
}

run().catch((error) => {
  console.error('Mock flow check failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

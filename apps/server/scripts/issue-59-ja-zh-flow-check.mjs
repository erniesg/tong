#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const baseArg = args.find((arg) => !arg.startsWith('--'));
const traceFileArg = args.find((arg) => arg.startsWith('--trace-file='));
const apiBase = (baseArg || process.env.TONG_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const demoPassword = process.env.TONG_DEMO_PASSWORD || process.env.TONG_DEMO_CODE || '';
const traceFile = traceFileArg ? traceFileArg.slice('--trace-file='.length) : null;
const traces = [];
const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../../..');
const worldMapRegistry = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'packages/contracts/world-map-registry.sample.json'), 'utf8'),
);

function getExpectedMapLocation(cityId, dagLocationSlot) {
  const cityRegistry = (worldMapRegistry.cities || []).find((city) => city.cityId === cityId);
  const current = (cityRegistry?.locations || []).find(
    (entry) => entry.dagLocationSlot === dagLocationSlot && entry.mapLocationId === cityRegistry?.defaultMapLocationId,
  );
  const fallback = (cityRegistry?.locations || []).find((entry) => entry.dagLocationSlot === dagLocationSlot);
  return current?.mapLocationId || fallback?.mapLocationId || dagLocationSlot;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

function includesHangul(value) {
  return /[\uac00-\ud7af]/u.test(String(value || ''));
}

function assertNoHangul(value, label) {
  assert(!includesHangul(value), `${label} should not contain Hangul: ${value}`);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} should be an array`);
  assert(value.length > 0, `${label} should not be empty`);
}

function writeTraceFile() {
  if (!traceFile) {
    return;
  }

  fs.mkdirSync(path.dirname(traceFile), { recursive: true });
  fs.writeFileSync(
    traceFile,
    JSON.stringify(
      {
        generatedAtIso: new Date().toISOString(),
        apiBase,
        traces,
      },
      null,
      2,
    ),
  );
}

async function requestJson(pathname, init = {}) {
  const url = `${apiBase}${pathname}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(demoPassword ? { 'x-demo-password': demoPassword } : {}),
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

  traces.push({
    request: {
      url,
      method: init.method || 'GET',
      body: init.body ? JSON.parse(init.body) : null,
    },
    response: {
      status: response.status,
      ok: response.ok,
      data,
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function assertPlacement(payload, { lang, city, location, mapLocationId, objectivePrefix }, label) {
  assert(payload?.gameSession?.activeObjective?.lang === lang, `${label} activeObjective.lang mismatch`);
  assert(payload?.gameSession?.cityId === city, `${label} city mismatch`);
  assert(payload?.gameSession?.locationId === location, `${label} location mismatch`);
  assert(payload?.gameSession?.mapLocationId === mapLocationId, `${label} mapLocationId mismatch`);
  assert(payload?.gameSession?.dagLocationSlot === location, `${label} dagLocationSlot mismatch`);
  assert(
    typeof payload?.gameSession?.activeObjective?.objectiveId === 'string' &&
      payload.gameSession.activeObjective.objectiveId.startsWith(objectivePrefix),
    `${label} objectiveId mismatch: ${payload?.gameSession?.activeObjective?.objectiveId}`,
  );
}

function assertObjectiveResponse(payload, { lang, city, location, mapLocationId, objectivePrefix }, label) {
  assert(payload?.lang === lang, `${label} lang mismatch`);
  assert(payload?.objectiveGraph?.cityId === city, `${label} city mismatch`);
  assert(payload?.objectiveGraph?.locationId === location, `${label} location mismatch`);
  assert(payload?.objectiveGraph?.mapLocationId === mapLocationId, `${label} mapLocationId mismatch`);
  assert(payload?.objectiveGraph?.dagLocationSlot === location, `${label} dagLocationSlot mismatch`);
  assert(
    typeof payload?.objectiveId === 'string' && payload.objectiveId.startsWith(objectivePrefix),
    `${label} objectiveId mismatch: ${payload?.objectiveId}`,
  );
  assertArray(payload?.placementHints, `${label}.placementHints`);
  assertArray(payload?.objectiveGraph?.targetNodeIds, `${label}.objectiveGraph.targetNodeIds`);
  assertArray(payload?.recentMediaRationale?.rankedTerms, `${label}.recentMediaRationale.rankedTerms`);
  payload.objectiveGraph.targetNodeIds.forEach((targetNodeId, index) =>
    assertNoHangul(targetNodeId, `${label}.objectiveGraph.targetNodeIds[${index}]`),
  );
  payload.recentMediaRationale.rankedTerms.forEach((term, index) => {
    assert(term?.lang === lang, `${label}.recentMediaRationale.rankedTerms[${index}].lang mismatch`);
    assertNoHangul(term?.lemma, `${label}.recentMediaRationale.rankedTerms[${index}].lemma`);
  });
}

function assertHangoutCopy(payload, label) {
  assert(typeof payload?.initialLine?.text === 'string', `${label}.initialLine.text missing`);
  assertNoHangul(payload.initialLine.text, `${label}.initialLine.text`);
}

function assertHangoutResponse(payload, label) {
  assert(payload?.accepted === true, `${label}.accepted missing`);
  assert(typeof payload?.feedback?.tongHint === 'string', `${label}.feedback.tongHint missing`);
  assert(typeof payload?.nextLine?.text === 'string', `${label}.nextLine.text missing`);
  assertNoHangul(payload.feedback.tongHint, `${label}.feedback.tongHint`);
  assertNoHangul(payload.nextLine.text, `${label}.nextLine.text`);
}

async function run() {
  console.log(`Running issue #59 flow checks against ${apiBase}`);

  const seoulBootstrap = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId: `issue59-seoul-${Date.now().toString(36)}`,
      city: 'seoul',
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
  assert(seoulBootstrap.ok, `/game/start-or-resume seoul failed (${seoulBootstrap.status})`);
  assertPlacement(
    seoulBootstrap.data,
    { lang: 'ko', city: 'seoul', location: 'food_street', mapLocationId: 'food_street', objectivePrefix: 'ko-' },
    'seoulBootstrap',
  );
  logPass('preserve Seoul KO bootstrap');

  const jaUserId = `issue59-ja-${Date.now().toString(36)}`;
  const jaProfile = {
    nativeLanguage: 'en',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: {
      ko: 'advanced',
      ja: 'none',
      zh: 'advanced',
    },
  };

  const jaBootstrap = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId: jaUserId,
      city: 'tokyo',
      profile: jaProfile,
    }),
  });
  assert(jaBootstrap.ok, `/game/start-or-resume tokyo failed (${jaBootstrap.status})`);
  const jaMapLocationId = getExpectedMapLocation('tokyo', 'subway_hub');
  assertPlacement(
    jaBootstrap.data,
    { lang: 'ja', city: 'tokyo', location: 'subway_hub', mapLocationId: jaMapLocationId, objectivePrefix: 'ja-' },
    'jaBootstrap',
  );
  logPass('tokyo bootstrap resolves JA placement');

  const jaObjective = await requestJson(
    `/api/v1/objectives/next?userId=${encodeURIComponent(jaUserId)}&mode=hangout&lang=ja&city=tokyo&location=${encodeURIComponent(jaMapLocationId)}`,
  );
  assert(jaObjective.ok, `/objectives/next ja failed (${jaObjective.status})`);
  assertObjectiveResponse(
    jaObjective.data,
    { lang: 'ja', city: 'tokyo', location: 'subway_hub', mapLocationId: jaMapLocationId, objectivePrefix: 'ja-' },
    'jaObjective',
  );
  logPass('objectives/next returns JA-safe targets and rationale');

  const jaHangoutStart = await requestJson('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId: jaUserId,
      sessionId: jaBootstrap.data?.sessionId,
      city: 'tokyo',
      location: jaMapLocationId,
      lang: 'ja',
      objectiveId: jaObjective.data?.objectiveId,
    }),
  });
  assert(jaHangoutStart.ok, `/scenes/hangout/start ja failed (${jaHangoutStart.status})`);
  assertHangoutCopy(jaHangoutStart.data, 'jaHangoutStart');
  logPass('hangout/start returns JA copy');

  const jaHangoutRespond = await requestJson('/api/v1/scenes/hangout/respond', {
    method: 'POST',
    body: JSON.stringify({
      sceneSessionId: jaHangoutStart.data?.sceneSessionId,
      userUtterance: '駅でお願いします',
    }),
  });
  assert(jaHangoutRespond.ok, `/scenes/hangout/respond ja failed (${jaHangoutRespond.status})`);
  assertHangoutResponse(jaHangoutRespond.data, 'jaHangoutRespond');
  logPass('hangout/respond returns JA copy');

  const jaStatelessHangoutStart = await requestJson('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId: `${jaUserId}-stateless`,
      city: 'tokyo',
      location: jaMapLocationId,
      lang: 'ja',
      objectiveId: jaObjective.data?.objectiveId,
    }),
  });
  assert(jaStatelessHangoutStart.ok, `/scenes/hangout/start ja stateless failed (${jaStatelessHangoutStart.status})`);
  assertHangoutCopy(jaStatelessHangoutStart.data, 'jaStatelessHangoutStart');
  logPass('hangout/start returns JA copy without a game session');

  const jaStatelessHangoutRespond = await requestJson('/api/v1/scenes/hangout/respond', {
    method: 'POST',
    body: JSON.stringify({
      sceneSessionId: jaStatelessHangoutStart.data?.sceneSessionId,
      userUtterance: '駅でお願いします',
    }),
  });
  assert(
    jaStatelessHangoutRespond.ok,
    `/scenes/hangout/respond ja stateless failed (${jaStatelessHangoutRespond.status})`,
  );
  assertHangoutResponse(jaStatelessHangoutRespond.data, 'jaStatelessHangoutRespond');
  logPass('hangout/respond returns JA copy without a game session');

  const zhUserId = `issue59-zh-${Date.now().toString(36)}`;
  const zhProfile = {
    nativeLanguage: 'en',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: {
      ko: 'advanced',
      ja: 'advanced',
      zh: 'none',
    },
  };

  const zhBootstrap = await requestJson('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId: zhUserId,
      city: 'shanghai',
      profile: zhProfile,
    }),
  });
  assert(zhBootstrap.ok, `/game/start-or-resume shanghai failed (${zhBootstrap.status})`);
  const zhMapLocationId = getExpectedMapLocation('shanghai', 'practice_studio');
  assertPlacement(
    zhBootstrap.data,
    { lang: 'zh', city: 'shanghai', location: 'practice_studio', mapLocationId: zhMapLocationId, objectivePrefix: 'zh-' },
    'zhBootstrap',
  );
  logPass('shanghai bootstrap resolves ZH placement');

  const zhObjective = await requestJson(
    `/api/v1/objectives/next?userId=${encodeURIComponent(zhUserId)}&mode=hangout&lang=zh&city=shanghai&location=${encodeURIComponent(zhMapLocationId)}`,
  );
  assert(zhObjective.ok, `/objectives/next zh failed (${zhObjective.status})`);
  assertObjectiveResponse(
    zhObjective.data,
    { lang: 'zh', city: 'shanghai', location: 'practice_studio', mapLocationId: zhMapLocationId, objectivePrefix: 'zh-' },
    'zhObjective',
  );
  logPass('objectives/next returns ZH-safe targets and rationale');

  const zhHangoutStart = await requestJson('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId: zhUserId,
      sessionId: zhBootstrap.data?.sessionId,
      city: 'shanghai',
      location: zhMapLocationId,
      lang: 'zh',
      objectiveId: zhObjective.data?.objectiveId,
    }),
  });
  assert(zhHangoutStart.ok, `/scenes/hangout/start zh failed (${zhHangoutStart.status})`);
  assertHangoutCopy(zhHangoutStart.data, 'zhHangoutStart');
  logPass('hangout/start returns ZH copy');

  const zhHangoutRespond = await requestJson('/api/v1/scenes/hangout/respond', {
    method: 'POST',
    body: JSON.stringify({
      sceneSessionId: zhHangoutStart.data?.sceneSessionId,
      userUtterance: '我要拉面',
    }),
  });
  assert(zhHangoutRespond.ok, `/scenes/hangout/respond zh failed (${zhHangoutRespond.status})`);
  assertHangoutResponse(zhHangoutRespond.data, 'zhHangoutRespond');
  logPass('hangout/respond returns ZH copy');

  const zhStatelessHangoutStart = await requestJson('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId: `${zhUserId}-stateless`,
      city: 'shanghai',
      location: zhMapLocationId,
      lang: 'zh',
      objectiveId: zhObjective.data?.objectiveId,
    }),
  });
  assert(zhStatelessHangoutStart.ok, `/scenes/hangout/start zh stateless failed (${zhStatelessHangoutStart.status})`);
  assertHangoutCopy(zhStatelessHangoutStart.data, 'zhStatelessHangoutStart');
  logPass('hangout/start returns ZH copy without a game session');

  const zhStatelessHangoutRespond = await requestJson('/api/v1/scenes/hangout/respond', {
    method: 'POST',
    body: JSON.stringify({
      sceneSessionId: zhStatelessHangoutStart.data?.sceneSessionId,
      userUtterance: '我要拉面',
    }),
  });
  assert(
    zhStatelessHangoutRespond.ok,
    `/scenes/hangout/respond zh stateless failed (${zhStatelessHangoutRespond.status})`,
  );
  assertHangoutResponse(zhStatelessHangoutRespond.data, 'zhStatelessHangoutRespond');
  logPass('hangout/respond returns ZH copy without a game session');

  writeTraceFile();
  console.log('');
  console.log('Issue #59 flow check complete.');
  if (traceFile) {
    console.log(`Trace file: ${traceFile}`);
  }
}

run().catch((error) => {
  writeTraceFile();
  console.error('Issue #59 flow check failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

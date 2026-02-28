#!/usr/bin/env node

const args = process.argv.slice(2);
const baseArg = args.find((arg) => !arg.startsWith('-'));
const apiBase = (baseArg || process.env.TONG_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const userId = `tool_user_${Date.now().toString(36)}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(pathname, init = {}) {
  const url = `${apiBase}${pathname}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    url,
  };
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

async function invoke(tool, toolArgs = {}) {
  const response = await requestJson('/api/v1/tools/invoke', {
    method: 'POST',
    body: JSON.stringify({
      tool,
      args: toolArgs,
    }),
  });
  assert(response.ok, `${tool} failed (${response.status})`);
  assert(response.data?.ok === true, `${tool} missing ok=true`);
  assert(response.data?.tool === tool, `${tool} response tool mismatch`);
  return response.data.result;
}

async function run() {
  console.log(`Running tool flow check against ${apiBase}`);

  const health = await requestJson('/health');
  assert(health.ok && health.data?.ok === true, '/health check failed');
  logPass('/health');

  const tools = await requestJson('/api/v1/tools');
  assert(tools.ok, `/api/v1/tools failed (${tools.status})`);
  assert(Array.isArray(tools.data?.tools) && tools.data.tools.length > 0, 'tools list empty');
  const names = new Set(tools.data.tools.map((tool) => tool.name));
  for (const required of [
    'ingestion.run_mock',
    'ingestion.snapshot.get',
    'player.media_profile.get',
    'vocab.frequency.get',
    'vocab.insights.get',
    'objectives.next.get',
  ]) {
    assert(names.has(required), `missing tool: ${required}`);
  }
  logPass('/api/v1/tools');

  const runMock = await invoke('ingestion.run_mock', {
    userId,
    includeSources: ['youtube'],
  });
  assert(runMock?.success === true, 'ingestion.run_mock missing success');
  assert(runMock?.sourceCount?.youtube > 0, 'ingestion.run_mock missing youtube sourceCount');
  assert(runMock?.sourceCount?.spotify === 0, 'ingestion.run_mock spotify should be 0 for youtube scope');
  logPass('ingestion.run_mock');

  const snapshot = await invoke('ingestion.snapshot.get', { userId, includeSources: ['youtube'] });
  assert(Array.isArray(snapshot?.sourceItems), 'ingestion.snapshot.get missing sourceItems');
  assert(snapshot.sourceItems.every((item) => item.source === 'youtube'), 'snapshot source filter mismatch');
  logPass('ingestion.snapshot.get');

  const frequency = await invoke('vocab.frequency.get', { userId });
  assert(Array.isArray(frequency?.items) && frequency.items.length > 0, 'vocab.frequency.get missing items');
  logPass('vocab.frequency.get');

  const insights = await invoke('vocab.insights.get', { userId, lang: 'ko' });
  assert(Array.isArray(insights?.clusters), 'vocab.insights.get missing clusters');
  assert(Array.isArray(insights?.items), 'vocab.insights.get missing items');
  logPass('vocab.insights.get');

  const objective = await invoke('objectives.next.get', { userId, mode: 'hangout', lang: 'ko' });
  assert(typeof objective?.objectiveId === 'string' && objective.objectiveId.startsWith('ko_'), 'objective language mismatch');
  assert(Array.isArray(objective?.coreTargets?.vocabulary), 'objective coreTargets.vocabulary missing');
  logPass('objectives.next.get');

  const mediaProfile = await invoke('player.media_profile.get', { userId });
  assert(mediaProfile?.userId === userId, 'player.media_profile.get user mismatch');
  assert(Array.isArray(mediaProfile?.learningSignals?.topTerms), 'media profile topTerms missing');
  logPass('player.media_profile.get');

  console.log('');
  console.log('Tool flow check complete.');
  console.log(`- API base: ${apiBase}`);
  console.log(`- userId: ${userId}`);
}

run().catch((error) => {
  console.error('Tool flow check failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

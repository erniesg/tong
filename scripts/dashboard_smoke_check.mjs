#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const serverBase = (process.env.TONG_LOCAL_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const clientBase = (process.env.TONG_LOCAL_CLIENT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const dashboardUrl = `${clientBase}/dashboard`;
const screenshotPath = path.resolve(
  process.env.TONG_DASHBOARD_SMOKE_SCREENSHOT_PATH || path.join(os.tmpdir(), `tong-dashboard-smoke-${Date.now()}.png`),
);

const startedProcesses = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logInfo(message) {
  console.log(`INFO ${message}`);
}

function findTargetProgressForNode(dashboardData, nodeId) {
  return (
    dashboardData?.selectedPack?.nodes?.find((entry) => entry?.node?.nodeId === nodeId)?.targetProgress || null
  );
}

function pickTargetProgressCandidate(dashboardData) {
  const bundleCandidates = Array.isArray(dashboardData?.selectedPack?.lessonBundle?.targetProgress)
    ? dashboardData.selectedPack.lessonBundle.targetProgress
    : [];
  const nodeCandidates = Array.isArray(dashboardData?.selectedPack?.nodes)
    ? dashboardData.selectedPack.nodes
        .map((entry) => entry?.targetProgress)
        .filter(Boolean)
    : [];

  return (
    [...bundleCandidates, ...nodeCandidates].find((progress) => Array.isArray(progress?.remainingTargetIds) && progress.remainingTargetIds.length > 0) ||
    [...bundleCandidates, ...nodeCandidates].find((progress) => Array.isArray(progress?.weakTargetIds) && progress.weakTargetIds.length > 0) ||
    null
  );
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function pickEvidenceTargets(progress) {
  if (!progress) return [];
  return unique([
    ...(progress.remainingTargetIds || []),
    ...(progress.weakTargetIds || []),
    ...(progress.lastPracticedTargetIds || []),
  ]).slice(0, 3);
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.status === 0;
}

function getPlaywrightCommand() {
  if (commandExists('playwright')) {
    return {
      command: 'playwright',
      argsPrefix: [],
    };
  }

  if (commandExists('npx', ['playwright', '--version'])) {
    return {
      command: 'npx',
      argsPrefix: ['playwright'],
    };
  }

  throw new Error(
    'Playwright CLI is not available. Install it globally or make it available via npx before running test:dashboard-smoke.',
  );
}

function spawnManaged(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  const output = [];
  const capture = (streamLabel, chunk) => {
    const text = chunk.toString();
    output.push(`[${streamLabel}] ${text}`);
    if (output.length > 120) output.shift();
  };

  child.stdout.on('data', (chunk) => capture('stdout', chunk));
  child.stderr.on('data', (chunk) => capture('stderr', chunk));

  startedProcesses.push({ label, child, output });
  return child;
}

async function stopManagedProcesses() {
  for (const entry of startedProcesses.reverse()) {
    if (entry.child.exitCode !== null) continue;
    entry.child.kill('SIGINT');
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (entry.child.exitCode === null) {
      entry.child.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (entry.child.exitCode === null) {
      entry.child.kill('SIGKILL');
    }
  }
}

async function request(url, init = {}) {
  const response = await fetch(url, init);
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
  };
}

async function invokeTool(tool, args = {}) {
  return request(`${serverBase}/api/v1/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tool, args }),
  });
}

async function waitFor(name, fn, timeoutMs = 60000, intervalMs = 500) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`${name} timed out after ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ''}`);
}

async function ensureServer() {
  try {
    const health = await request(`${serverBase}/health`);
    if (health.ok && health.data?.ok === true) {
      logInfo(`Using existing server at ${serverBase}`);
      return false;
    }
  } catch {}

  logInfo('Starting local mock server');
  spawnManaged('server', 'npm', ['--prefix', 'apps/server', 'run', 'start']);

  await waitFor('server /health', async () => {
    const health = await request(`${serverBase}/health`);
    assert(health.ok && health.data?.ok === true, '/health failed');
    return health;
  });
  logPass('server /health');
  return true;
}

async function ensureClient() {
  try {
    const page = await request(dashboardUrl);
    if (page.ok) {
      logInfo(`Using existing client at ${clientBase}`);
      return false;
    }
  } catch {}

  logInfo('Starting local client');
  spawnManaged('client', 'npm', ['--prefix', 'apps/client', 'run', 'dev']);

  await waitFor('client /dashboard', async () => {
    const page = await request(dashboardUrl);
    assert(page.ok, `/dashboard failed with ${page.status}`);
    return page;
  }, 120000, 1000);
  logPass('client /dashboard');
  return true;
}

async function validateGraphEndpoints() {
  const personas = await request(`${serverBase}/api/v1/graph/personas`);
  assert(personas.ok, `/api/v1/graph/personas failed (${personas.status})`);
  assert(Array.isArray(personas.data?.items) && personas.data.items.length > 0, 'graph personas list empty');
  const learner = personas.data.items[0];
  assert(typeof learner?.displayName === 'string' && learner.displayName.length > 0, 'graph personas missing displayName');
  assert(Array.isArray(learner?.targetLanguages) && learner.targetLanguages.length > 0, 'graph personas missing targetLanguages');
  assert(Array.isArray(learner?.goals), 'graph personas missing goals array');
  const learnerId = learner.learnerId;
  assert(typeof learnerId === 'string' && learnerId.length > 0, 'graph personas missing learner identifier');
  logPass('graph personas');

  const dashboard = await request(
    `${serverBase}/api/v1/graph/dashboard?learnerId=${encodeURIComponent(learnerId)}`,
  );
  assert(dashboard.ok, `/api/v1/graph/dashboard failed (${dashboard.status})`);
  assert(dashboard.data?.learner?.learnerId === learnerId, 'dashboard learner does not match requested learner');
  assert(typeof dashboard.data?.languageSummary?.languageTier?.level === 'number', 'dashboard missing language tier');
  assert(typeof dashboard.data?.languageSummary?.progressToNextTier === 'number', 'dashboard missing progress-to-next-tier');
  assert(Array.isArray(dashboard.data?.roadmap) && dashboard.data.roadmap.length > 0, 'dashboard missing roadmap');
  assert(Array.isArray(dashboard.data?.nextUnlocks), 'dashboard missing next unlocks');
  assert(Array.isArray(dashboard.data?.selectedPack?.nodes), 'dashboard missing selected pack nodes');
  assert(typeof dashboard.data?.selectedPack?.pack?.packId === 'string', 'dashboard missing selected pack metadata');
  assert(Array.isArray(dashboard.data?.selectedPack?.lessonBundle?.nodeIds), 'dashboard missing selected pack lesson bundle');
  assert(Array.isArray(dashboard.data?.selectedPack?.lessonBundle?.targetProgress), 'dashboard missing lesson target progress');
  assert(typeof dashboard.data?.selectedPack?.hangoutBundle?.ready === 'boolean', 'dashboard missing selected pack hangout readiness');
  assert(typeof dashboard.data?.selectedPack?.hangoutBundle?.readiness?.ready === 'boolean', 'dashboard missing hangout readiness state');
  assert(
    dashboard.data?.selectedPack?.missionGate === null ||
      (typeof dashboard.data?.selectedPack?.missionGate?.status === 'string' &&
        typeof dashboard.data?.selectedPack?.missionGate?.ready === 'boolean' &&
        typeof dashboard.data?.selectedPack?.missionGate?.completed === 'boolean'),
    'dashboard missing mission gate status',
  );
  assert(Array.isArray(dashboard.data?.overlays), 'dashboard missing overlays array');
  assert(Array.isArray(dashboard.data?.recommendations) && dashboard.data.recommendations.length > 0, 'dashboard missing recommendations');
  assert(typeof dashboard.data?.evidence?.totalEvents === 'number', 'dashboard missing evidence summary');
  logPass('graph dashboard');

  const lessonBundle = await invokeTool('graph.lesson_bundle.get', { learnerId });
  assert(lessonBundle.ok, `graph.lesson_bundle.get failed (${lessonBundle.status})`);
  assert(lessonBundle.data?.ok === true, 'graph.lesson_bundle.get did not return ok:true');
  assert(lessonBundle.data?.result?.learnerId === learnerId, 'lesson bundle learner mismatch');
  assert(Array.isArray(lessonBundle.data?.result?.nodeIds), 'lesson bundle missing nodeIds');
  assert(Array.isArray(lessonBundle.data?.result?.objectiveIds), 'lesson bundle missing objectiveIds');
  assert(
    lessonBundle.data?.result?.focusNodeId === dashboard.data?.selectedPack?.lessonBundle?.focusNodeId,
    'lesson bundle tool diverged from dashboard selected pack bundle',
  );
  logPass('graph lesson bundle');

  const hangoutBundle = await invokeTool('graph.hangout_bundle.get', { learnerId });
  assert(hangoutBundle.ok, `graph.hangout_bundle.get failed (${hangoutBundle.status})`);
  assert(hangoutBundle.data?.ok === true, 'graph.hangout_bundle.get did not return ok:true');
  assert(hangoutBundle.data?.result?.learnerId === learnerId, 'hangout bundle learner mismatch');
  assert(Array.isArray(hangoutBundle.data?.result?.nodeIds), 'hangout bundle missing nodeIds');
  assert(Array.isArray(hangoutBundle.data?.result?.objectiveIds), 'hangout bundle missing objectiveIds');
  assert(typeof hangoutBundle.data?.result?.scenarioId === 'string', 'hangout bundle missing scenarioId');
  assert(
    hangoutBundle.data?.result?.readiness?.ready === dashboard.data?.selectedPack?.hangoutBundle?.readiness?.ready,
    'hangout bundle tool diverged from dashboard selected pack readiness',
  );
  logPass('graph hangout bundle');

  const nextActions = await request(
    `${serverBase}/api/v1/graph/next-actions?learnerId=${encodeURIComponent(learnerId)}`,
  );
  assert(nextActions.ok, `/api/v1/graph/next-actions failed (${nextActions.status})`);
  assert(nextActions.data?.learnerId === learnerId, 'graph next actions learner mismatch');
  assert(Array.isArray(nextActions.data?.actions), 'graph next actions missing actions');
  logPass('graph next actions');

  const validation = await invokeTool('graph.pack.validate');
  assert(validation.ok, `graph.pack.validate failed (${validation.status})`);
  assert(validation.data?.ok === true, 'graph.pack.validate did not return ok:true');
  assert(typeof validation.data?.result?.valid === 'boolean', 'graph pack validation missing valid flag');
  assert(typeof validation.data?.result?.packId === 'string', 'graph pack validation missing packId');
  assert(Array.isArray(validation.data?.result?.issues), 'graph pack validation missing issues');
  logPass('graph pack validation');

  const candidateProgress = pickTargetProgressCandidate(dashboard.data);
  const firstTarget = candidateProgress?.nodeId || lessonBundle.data?.result?.nodeIds?.[0] || dashboard.data?.selectedPack?.nodes?.[0]?.node?.nodeId;
  assert(typeof firstTarget === 'string' && firstTarget.length > 0, 'graph runtime did not expose a recordable nodeId');
  const beforeTargetProgress = findTargetProgressForNode(dashboard.data, firstTarget);
  assert(beforeTargetProgress, 'dashboard missing node target progress for smoke candidate');
  const targetId =
    beforeTargetProgress.remainingTargetIds.find(
      (item) =>
        !beforeTargetProgress.weakTargetIds.includes(item) &&
        !beforeTargetProgress.lastPracticedTargetIds.includes(item),
    ) ||
    beforeTargetProgress.remainingTargetIds[0] ||
    beforeTargetProgress.weakTargetIds[0];
  assert(typeof targetId === 'string' && targetId.length > 0, 'dashboard did not expose a recordable targetId');
  const targetWasUnseen =
    !beforeTargetProgress.weakTargetIds.includes(targetId) &&
    !beforeTargetProgress.lastPracticedTargetIds.includes(targetId);

  const evidence = await request(`${serverBase}/api/v1/graph/evidence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      learnerId,
      event: {
        nodeId: firstTarget,
        mode: 'learn',
        correct: true,
        qualityScore: 5,
        source: 'dashboard-smoke',
        targetResults: [
          {
            targetId,
            correct: true,
            qualityScore: 5,
          },
        ],
      },
    }),
  });
  assert(evidence.ok, `/api/v1/graph/evidence failed (${evidence.status})`);
  assert(evidence.data?.accepted === true, 'graph evidence did not accept the event');
  assert(evidence.data?.learnerId === learnerId, 'graph evidence learner mismatch');
  assert(evidence.data?.event?.nodeId === firstTarget, 'graph evidence event missing nodeId');
  assert(Array.isArray(evidence.data?.event?.targetResults) && evidence.data.event.targetResults.length > 0, 'graph evidence did not persist targetResults');
  assert(evidence.data?.state?.nodeId === firstTarget, 'graph evidence state missing nodeId');
  assert(typeof evidence.data?.progression?.xp === 'number', 'graph evidence missing progression');
  const dashboardAfterEvidence = await request(
    `${serverBase}/api/v1/graph/dashboard?learnerId=${encodeURIComponent(learnerId)}`,
  );
  assert(dashboardAfterEvidence.ok, `dashboard refresh after evidence failed (${dashboardAfterEvidence.status})`);
  const afterTargetProgress = findTargetProgressForNode(dashboardAfterEvidence.data, firstTarget);
  assert(afterTargetProgress, 'dashboard lost target progress after evidence');
  assert(
    afterTargetProgress.lastPracticedTargetIds.includes(targetId),
    'explicit target evidence did not update lastPracticedTargetIds',
  );
  assert(
    afterTargetProgress.completedTargetCount >= beforeTargetProgress.completedTargetCount,
    'target progress regressed after evidence',
  );
  assert(
    afterTargetProgress.remainingTargetIds.length <= beforeTargetProgress.remainingTargetIds.length,
    'remaining target count did not stay flat or improve after evidence',
  );
  if (targetWasUnseen) {
    assert(
      !afterTargetProgress.remainingTargetIds.includes(targetId),
      'new target evidence did not clear the chosen unseen target',
    );
  }
  assert(
    dashboardAfterEvidence.data?.evidence?.totalEvents === dashboard.data?.evidence?.totalEvents + 1,
    'dashboard evidence total did not increment after writeback',
  );
  logPass('graph evidence');

  const missionGate = dashboardAfterEvidence.data?.selectedPack?.missionGate;
  assert(missionGate && typeof missionGate.missionId === 'string', 'dashboard missing capstone mission gate');
  assert(Array.isArray(missionGate.requiredNodeIds) && missionGate.requiredNodeIds.length > 0, 'capstone gate missing required nodes');

  for (const nodeId of missionGate.requiredNodeIds) {
    const nodeProgress = findTargetProgressForNode(dashboardAfterEvidence.data, nodeId);
    const targetIds = pickEvidenceTargets(nodeProgress);
    const missionEvidence = await request(`${serverBase}/api/v1/graph/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        learnerId,
        event: {
          nodeId,
          mode: 'mission',
          correct: true,
          qualityScore: 5,
          source: 'dashboard-smoke',
          metadata: {
            missionId: missionGate.missionId,
          },
          targetResults: targetIds.map((targetId) => ({
            targetId,
            correct: true,
            qualityScore: 5,
          })),
        },
      }),
    });
    assert(missionEvidence.ok, `/api/v1/graph/evidence mission write failed (${missionEvidence.status})`);
    assert(missionEvidence.data?.accepted === true, 'mission evidence did not accept the event');
  }

  const dashboardAfterMission = await request(
    `${serverBase}/api/v1/graph/dashboard?learnerId=${encodeURIComponent(learnerId)}`,
  );
  assert(dashboardAfterMission.ok, `dashboard refresh after mission failed (${dashboardAfterMission.status})`);
  assert(dashboardAfterMission.data?.selectedPack?.missionGate?.status === 'completed', 'capstone gate did not enter completed status');
  assert(dashboardAfterMission.data?.selectedPack?.missionGate?.completed === true, 'capstone gate completed flag did not flip');
  assert(typeof dashboardAfterMission.data?.selectedPack?.missionGate?.completedAt === 'string', 'capstone gate missing completedAt');
  assert(
    dashboardAfterMission.data?.recommendations?.every((item) => item.type !== 'mission'),
    'completed capstone should not remain in graph recommendations',
  );
  assert(
    dashboardAfterMission.data?.evidence?.totalEvents ===
      dashboardAfterEvidence.data?.evidence?.totalEvents + missionGate.requiredNodeIds.length,
    'dashboard evidence total did not increment after mission writeback',
  );
  logPass('graph capstone completion');

  return learnerId;
}

function runPlaywright(command, argsPrefix, learnerId) {
  const selector = 'text=Progression Overview';
  const args = [
    ...argsPrefix,
    'screenshot',
    '--browser',
    'chromium',
    '--wait-for-selector',
    selector,
    '--wait-for-timeout',
    '1500',
    '--full-page',
    `${dashboardUrl}?learnerId=${encodeURIComponent(learnerId)}`,
    screenshotPath,
  ];

  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'pipe',
    env: process.env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`Playwright hydration check failed.\n${details}`);
  }

  assert(fs.existsSync(screenshotPath), 'Playwright did not produce a dashboard screenshot');
  logPass(`dashboard hydration (${selector})`);
}

async function run() {
  console.log(`Running dashboard smoke check against ${serverBase} and ${clientBase}`);
  const playwright = getPlaywrightCommand();
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

  try {
    await ensureServer();
    await ensureClient();
    const learnerId = await validateGraphEndpoints();
    runPlaywright(playwright.command, playwright.argsPrefix, learnerId);
    console.log('');
    console.log('Dashboard smoke check complete.');
    console.log(`- learnerId: ${learnerId}`);
    console.log(`- screenshot: ${screenshotPath}`);
  } finally {
    await stopManagedProcesses();
  }
}

run().catch((error) => {
  console.error('Dashboard smoke check failed.');
  console.error(error instanceof Error ? error.message : String(error));

  for (const entry of startedProcesses) {
    if (!entry.output.length) continue;
    console.error(`\nRecent ${entry.label} logs:`);
    for (const line of entry.output.slice(-20)) {
      process.stderr.write(line);
    }
  }

  stopManagedProcesses().finally(() => process.exit(1));
});

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
  const learnerId = personas.data.items[0].learnerId || personas.data.items[0].personaId;
  assert(typeof learnerId === 'string' && learnerId.length > 0, 'graph personas missing learner identifier');
  logPass('graph personas');

  const dashboard = await request(
    `${serverBase}/api/v1/graph/dashboard?learnerId=${encodeURIComponent(learnerId)}`,
  );
  assert(dashboard.ok, `/api/v1/graph/dashboard failed (${dashboard.status})`);
  assert(dashboard.data?.locationSkillTree?.levels?.length > 0, 'dashboard missing skill tree levels');
  assert(dashboard.data?.personalizedOverlay?.focusCards?.length > 0, 'dashboard missing overlay focus cards');
  assert(Array.isArray(dashboard.data?.lessonBundle?.targets), 'dashboard missing lesson bundle targets');
  logPass('graph dashboard');

  const firstTarget = dashboard.data.lessonBundle.targets[0]?.nodeId;
  assert(typeof firstTarget === 'string' && firstTarget.length > 0, 'dashboard missing lesson target nodeId');

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
        quality: 0.86,
        source: 'dashboard-smoke',
      },
    }),
  });
  assert(evidence.ok, `/api/v1/graph/evidence failed (${evidence.status})`);
  assert(evidence.data?.recorded === 1, 'graph evidence did not record the lesson target');
  logPass('graph evidence');

  return learnerId;
}

function runPlaywright(command, argsPrefix, learnerId) {
  const selector = 'text=World Roadmap';
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

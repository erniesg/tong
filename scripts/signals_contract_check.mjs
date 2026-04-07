#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.TONG_LOCAL_API_BASE_URL || 'http://localhost:8787';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // retry until timeout
    }
    await sleep(300);
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms (${url})`);
}

async function postJson(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  return response.json();
}

async function main() {
  const child = spawn('node', ['apps/server/src/index.mjs'], {
    stdio: 'ignore',
    env: process.env,
  });

  try {
    await waitForServer(BASE_URL);

    const browserPreflight = await postJson('/api/v1/signals/browser-search', {
      keyword: 'learn korean',
      executionMode: 'preflight',
    });
    assert.equal(browserPreflight.ok, true);
    assert.equal(browserPreflight.execution.mode, 'preflight');
    assert.equal(browserPreflight.execution.liveScrapeRequired, true);
    assert(Array.isArray(browserPreflight.execution.dependencies));
    assert.equal(Array.isArray(browserPreflight.results), true);

    const platformMock = await postJson('/api/v1/signals/search', {
      platform: 'tiktok',
      keywords: ['learn korean'],
      executionMode: 'mock',
      limit: 1,
    });
    assert.equal(platformMock.ok, true);
    assert.equal(platformMock.execution.mode, 'mock');
    assert.equal(platformMock.execution.liveScrapeRequired, false);
    assert.equal(platformMock.results.length >= 1, true);

    const browserStatus = await getJson('/api/v1/signals/browser-status');
    assert.equal(browserStatus.ok, true);
    assert.equal(Array.isArray(browserStatus.executionModes), true);

    const signalStatus = await getJson('/api/v1/signals/status');
    assert.equal(signalStatus.ok, true);
    assert.equal(Array.isArray(signalStatus.executionModes), true);

    // ── Filter pipeline (mock mode) ────────────────────────────────

    const mockResults = [
      { title: 'Learn Korean fast', stats: { views: 50000, likes: 3000 }, platform: 'tiktok', author: 'test' },
      { title: 'Low view video', stats: { views: 500, likes: 10 }, platform: 'tiktok', author: 'test2' },
      { title: 'Popular Chinese', stats: { views: 200000, likes: 15000 }, platform: 'tiktok', author: 'test3' },
    ];

    const filterResult = await postJson('/api/v1/signals/filter', {
      results: mockResults,
      brief: { description: 'language learning app', keywords: ['korean', 'chinese'] },
      minViews: 10000,
      executionMode: 'mock',
    });
    assert.equal(filterResult.ok, true);
    assert.equal(filterResult.stats.total, 3);
    assert.equal(filterResult.stats.engagementDropped, 1, 'should drop 1 low-view result');
    assert.equal(filterResult.stats.afterEngagementFilter, 2);
    assert.equal(Array.isArray(filterResult.ranked), true);
    assert.equal(filterResult.ranked.length, 2);
    // Mock mode should have _relevance on results
    assert(filterResult.ranked[0]._relevance, 'scored results should have _relevance');

    // ── Brief extraction (mock mode) ────────────────────────────────

    const briefResult = await postJson('/api/v1/signals/extract-brief', {
      text: 'dating sim language learning game',
      executionMode: 'mock',
    });
    assert.equal(briefResult.ok, true);
    assert(briefResult.brief, 'should return a brief object');
    assert(briefResult.brief.productName, 'brief should have productName');
    assert(Array.isArray(briefResult.brief.keywords), 'brief should have keywords array');

    console.log('signals_contract_check: ok');
  } finally {
    child.kill('SIGTERM');
    await sleep(200);
  }
}

main().catch((error) => {
  console.error('signals_contract_check: failed');
  console.error(error);
  process.exitCode = 1;
});

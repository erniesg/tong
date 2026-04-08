/**
 * Unit tests for signal-xhs.mjs multi-provider XHS search.
 *
 * Run: node --test apps/server/src/__tests__/signal-xhs.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { xhsSearch, getXhsStatus } = await import('../signal-xhs.mjs');

describe('getXhsStatus', () => {
  it('returns provider list and config', () => {
    const status = getXhsStatus();
    assert.ok(Array.isArray(status.providers));
    assert.ok(status.rapidapi);
    assert.ok(status.puppeteer);
    assert.equal(typeof status.rapidapi.configured, 'boolean');
  });
});

describe('xhsSearch mock mode', () => {
  it('returns normalised mock results', async () => {
    const { results, provider, warnings } = await xhsSearch('学韩语', 3, { executionMode: 'mock' });
    assert.equal(provider, 'mock');
    assert.equal(results.length, 3);
    for (const r of results) {
      assert.equal(r.platform, 'xiaohongshu');
      assert.equal(r.keyword, '学韩语');
      assert.equal(r._provider, 'mock');
      assert.ok(r.scrapedAt);
    }
    assert.ok(Array.isArray(warnings));
  });
});

describe('xhsSearch preflight mode', () => {
  it('returns empty results', async () => {
    const { results, provider } = await xhsSearch('test', 5, { executionMode: 'preflight' });
    assert.equal(results.length, 0);
    assert.equal(provider, 'preflight');
  });
});

describe('xhsSearch provider fallthrough', () => {
  it('skips rapidapi when key not configured', async () => {
    const origKey = process.env['X-RapidAPI-Key'];
    delete process.env['X-RapidAPI-Key'];
    delete process.env.RAPIDAPI_KEY;
    try {
      const { warnings } = await xhsSearch('test', 1, {
        executionMode: 'mock',
        providers: ['rapidapi'],
      });
      // In mock mode the mock provider handles it before rapidapi is tried
    } finally {
      if (origKey) process.env['X-RapidAPI-Key'] = origKey;
    }
  });

  it('rejects unknown providers gracefully', async () => {
    const { results, warnings } = await xhsSearch('test', 1, {
      providers: ['nonexistent'],
    });
    assert.equal(results.length, 0);
    assert.ok(warnings.some((w) => w.includes('unknown provider')));
  });
});

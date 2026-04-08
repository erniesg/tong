/**
 * Unit tests for signal-apify.mjs
 *
 * Run: node --test apps/server/src/__tests__/signal-apify.test.mjs
 *
 * Tests mock mode (no API calls), preflight mode, status, and result normalization.
 * Live Apify calls are tested separately via manual validation.
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Import module ────────────────────────────────────────────────────

const {
  apifyXhsSearch,
  apifyInstagramSearch,
  apifySearch,
  getApifyStatus,
} = await import('../signal-apify.mjs');

// ── getApifyStatus ──────────────────────────────────────────────────

describe('getApifyStatus', () => {
  it('returns expected shape', () => {
    const status = getApifyStatus();
    assert.equal(typeof status.tokenConfigured, 'boolean');
    assert.ok(Array.isArray(status.supportedPlatforms));
    assert.ok(status.supportedPlatforms.includes('xiaohongshu'));
    assert.ok(status.supportedPlatforms.includes('instagram'));
    assert.ok(status.actors.xiaohongshu);
    assert.ok(status.actors.instagram);
  });
});

// ── apifyXhsSearch — mock mode ──────────────────────────────────────

describe('apifyXhsSearch mock mode', () => {
  it('returns normalized XHS results', async () => {
    const results = await apifyXhsSearch('学韩语', 3, { executionMode: 'mock' });
    assert.equal(results.length, 3);
    for (const r of results) {
      assert.equal(r.platform, 'xiaohongshu');
      assert.equal(r.keyword, '学韩语');
      assert.equal(r.type, 'note');
      assert.equal(r._scraper, 'apify');
      assert.ok(r.title);
      assert.ok(r.scrapedAt);
      assert.ok(r.stats);
    }
  });

  it('respects limit', async () => {
    const results = await apifyXhsSearch('test', 1, { executionMode: 'mock' });
    assert.equal(results.length, 1);
  });
});

// ── apifyXhsSearch — preflight mode ─────────────────────────────────

describe('apifyXhsSearch preflight mode', () => {
  it('returns empty array', async () => {
    const results = await apifyXhsSearch('test', 5, { executionMode: 'preflight' });
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });
});

// ── apifyInstagramSearch — mock mode ────────────────────────────────

describe('apifyInstagramSearch mock mode', () => {
  it('returns normalized IG results with hashtag and post structure', async () => {
    const { hashtag, posts } = await apifyInstagramSearch('learnkorean', 3, { executionMode: 'mock' });
    assert.equal(hashtag, 'learnkorean');
    assert.equal(posts.length, 3);
    for (const p of posts) {
      assert.equal(p.platform, 'instagram');
      assert.equal(p.keyword, '#learnkorean');
      assert.ok(['reel', 'post'].includes(p.type));
      assert.equal(p._scraper, 'apify');
      assert.ok(p.scrapedAt);
      assert.ok(p.stats);
    }
  });

  it('strips # from hashtag input', async () => {
    const { hashtag } = await apifyInstagramSearch('#learnkorean', 1, { executionMode: 'mock' });
    assert.equal(hashtag, 'learnkorean');
  });
});

// ── apifyInstagramSearch — preflight mode ───────────────────────────

describe('apifyInstagramSearch preflight mode', () => {
  it('returns empty posts', async () => {
    const { hashtag, posts } = await apifyInstagramSearch('test', 5, { executionMode: 'preflight' });
    assert.equal(hashtag, 'test');
    assert.equal(posts.length, 0);
  });
});

// ── apifySearch — unified interface ─────────────────────────────────

describe('apifySearch', () => {
  it('delegates to XHS in mock mode', async () => {
    const results = await apifySearch('xiaohongshu', '学韩语', 2, { executionMode: 'mock' });
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.equal(results[0].platform, 'xiaohongshu');
  });

  it('delegates to IG in mock mode', async () => {
    const results = await apifySearch('instagram', 'learnkorean', 2, { executionMode: 'mock' });
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.equal(results[0].platform, 'instagram');
  });

  it('throws for unsupported platform', async () => {
    await assert.rejects(
      () => apifySearch('tiktok', 'test', 5, { executionMode: 'mock' }),
      /not available for platform: tiktok/,
    );
  });
});

// ── Live mode without token ─────────────────────────────────────────

describe('apifyXhsSearch live mode without token', () => {
  it('throws when APIFY_API_TOKEN is missing', async () => {
    const origToken = process.env.APIFY_API_TOKEN;
    delete process.env.APIFY_API_TOKEN;
    try {
      await assert.rejects(
        () => apifyXhsSearch('test', 2, { executionMode: 'live' }),
        /APIFY_API_TOKEN/,
      );
    } finally {
      if (origToken) process.env.APIFY_API_TOKEN = origToken;
    }
  });
});

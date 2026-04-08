/**
 * Unit tests for signal-filter.mjs
 *
 * Run: node --test apps/server/src/__tests__/signal-filter.test.mjs
 *
 * Tests parseViewCount, filterByEngagement, and relevance scoring mock/preflight modes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  parseViewCount,
  filterByEngagement,
  scoreRelevance,
  runFilterPipeline,
  extractBriefFromMultimodal,
} = await import('../signal-filter.mjs');

// ── parseViewCount ──────────────────────────────────────────────────

describe('parseViewCount', () => {
  it('parses K suffix', () => {
    assert.equal(parseViewCount('63.3K'), 63300);
    assert.equal(parseViewCount('1K'), 1000);
    assert.equal(parseViewCount('167K'), 167000);
  });

  it('parses M suffix', () => {
    assert.equal(parseViewCount('1.7M'), 1700000);
    assert.equal(parseViewCount('5.9M'), 5900000);
  });

  it('parses B suffix', () => {
    assert.equal(parseViewCount('2.1B'), 2100000000);
  });

  it('parses plain numbers', () => {
    assert.equal(parseViewCount('5900'), 5900);
    assert.equal(parseViewCount('42000'), 42000);
    assert.equal(parseViewCount('3281'), 3281);
  });

  it('handles numbers with commas', () => {
    assert.equal(parseViewCount('1,000,000'), 1000000);
  });

  it('handles numeric input', () => {
    assert.equal(parseViewCount(42000), 42000);
    assert.equal(parseViewCount(1.5), 2); // rounds
  });

  it('returns null for null/undefined/empty', () => {
    assert.equal(parseViewCount(null), null);
    assert.equal(parseViewCount(undefined), null);
    assert.equal(parseViewCount(''), null);
  });

  it('returns null for non-numeric strings', () => {
    assert.equal(parseViewCount('abc'), null);
    assert.equal(parseViewCount('views: 100'), null);
  });

  it('is case insensitive', () => {
    assert.equal(parseViewCount('63.3k'), 63300);
    assert.equal(parseViewCount('1.7m'), 1700000);
  });
});

// ── filterByEngagement ──────────────────────────────────────────────

describe('filterByEngagement', () => {
  const results = [
    { title: 'A', stats: { views: '63.3K', likes: '500' } },
    { title: 'B', stats: { views: '3281', likes: '100' } },
    { title: 'C', stats: { views: '22.8K', likes: '1K' } },
    { title: 'D', stats: { views: '100', likes: '5' } },
  ];

  it('filters by minViews', () => {
    const { passed, dropped } = filterByEngagement(results, { minViews: 10000 });
    assert.equal(passed.length, 2);
    assert.equal(dropped, 2);
    assert.ok(passed.every((r) => r._parsedViews >= 10000));
  });

  it('filters by minLikes', () => {
    const { passed } = filterByEngagement(results, { minLikes: 500 });
    assert.equal(passed.length, 2); // A (500) and C (1000)
  });

  it('returns all when thresholds are 0', () => {
    const { passed } = filterByEngagement(results, { minViews: 0, minLikes: 0 });
    assert.equal(passed.length, 4);
  });

  it('adds _parsedViews and _parsedLikes to passed results', () => {
    const { passed } = filterByEngagement(results, { minViews: 0 });
    for (const r of passed) {
      assert.equal(typeof r._parsedViews, 'number');
      assert.equal(typeof r._parsedLikes, 'number');
    }
  });

  it('handles results with alternative field names', () => {
    const altResults = [
      { title: 'Alt', playCount: 50000, diggCount: 1000 },
    ];
    const { passed } = filterByEngagement(altResults, { minViews: 10000 });
    assert.equal(passed.length, 1);
    assert.equal(passed[0]._parsedViews, 50000);
  });
});

// ── scoreRelevance — mock mode ──────────────────────────────────────

describe('scoreRelevance mock mode', () => {
  it('returns scored results sorted by relevance', async () => {
    const results = [
      { title: 'A', stats: { views: 100 } },
      { title: 'B', stats: { views: 200 } },
    ];
    const brief = { description: 'language learning', keywords: ['korean', 'japanese'] };
    const { scored, cost } = await scoreRelevance(results, brief, { executionMode: 'mock' });
    assert.equal(scored.length, 2);
    assert.ok(scored[0]._relevance.relevanceScore >= scored[1]._relevance.relevanceScore);
    assert.equal(cost.calls, 0); // no API calls in mock
  });
});

// ── scoreRelevance — preflight mode ─────────────────────────────────

describe('scoreRelevance preflight mode', () => {
  it('returns empty with dependency hints', async () => {
    const { scored, execution } = await scoreRelevance([], {}, { executionMode: 'preflight' });
    assert.equal(scored.length, 0);
    assert.equal(execution.mode, 'preflight');
    assert.ok(execution.dependencies.includes('GOOGLE_GEMINI_API_KEY'));
  });
});

// ── runFilterPipeline — mock mode ───────────────────────────────────

describe('runFilterPipeline mock mode', () => {
  it('chains engagement + relevance filtering', async () => {
    const results = [
      { title: 'A', stats: { views: '50K' } },
      { title: 'B', stats: { views: '100' } },
      { title: 'C', stats: { views: '20K' } },
    ];
    const brief = { description: 'test' };
    const { ranked, stats } = await runFilterPipeline(results, brief, {
      minViews: 10000,
      executionMode: 'mock',
    });
    assert.equal(stats.total, 3);
    assert.equal(stats.afterEngagementFilter, 2); // A and C pass
    assert.equal(stats.engagementDropped, 1);
    assert.equal(ranked.length, 2);
  });

  it('respects topN', async () => {
    const results = Array.from({ length: 10 }, (_, i) => ({
      title: `V${i}`,
      stats: { views: 100000 },
    }));
    const { ranked } = await runFilterPipeline(results, { description: 'x' }, {
      topN: 3,
      executionMode: 'mock',
    });
    assert.equal(ranked.length, 3);
  });
});

// ── extractBriefFromMultimodal — mock mode ──────────────────────────

describe('extractBriefFromMultimodal mock mode', () => {
  it('returns a structured brief', async () => {
    const { brief, execution } = await extractBriefFromMultimodal({ executionMode: 'mock' });
    assert.ok(brief.productName);
    assert.ok(brief.description);
    assert.ok(Array.isArray(brief.keywords));
    assert.equal(execution.mode, 'mock');
  });
});

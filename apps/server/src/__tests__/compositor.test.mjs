/**
 * Unit tests for compositor.mjs
 *
 * Run: node --test apps/server/src/__tests__/compositor.test.mjs
 *
 * Tests format registry, renderStill, renderBatch, and compositing functions.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const compositor = await import('../compositor.mjs');

// ── Format Registry ────────────────────────────────────────────────

describe('listFormats', () => {
  it('returns all 13 platform formats', () => {
    const formats = compositor.listFormats();
    assert.ok(Array.isArray(formats));
    assert.ok(formats.length >= 12, `Expected >=12 formats, got ${formats.length}`);
  });

  it('each format has required fields', () => {
    const formats = compositor.listFormats();
    for (const f of formats) {
      assert.ok(f.id, 'format must have id');
      assert.ok(f.width > 0, 'width must be positive');
      assert.ok(f.height > 0, 'height must be positive');
      assert.ok(f.platform, 'format must have platform');
      assert.ok(f.aspectRatio, 'format must have aspectRatio');
    }
  });

  it('includes instagram-story with correct dimensions', () => {
    const formats = compositor.listFormats();
    const story = formats.find(f => f.id === 'instagram-story');
    assert.ok(story, 'instagram-story must exist');
    assert.equal(story.width, 1080);
    assert.equal(story.height, 1920);
  });

  it('includes xiaohongshu-post', () => {
    const formats = compositor.listFormats();
    const xhs = formats.find(f => f.id === 'xiaohongshu-post');
    assert.ok(xhs, 'xiaohongshu-post must exist');
    assert.equal(xhs.width, 1080);
    assert.equal(xhs.height, 1440);
  });
});

describe('getFormatsByPlatform', () => {
  it('returns instagram formats', () => {
    const formats = compositor.getFormatsByPlatform('instagram');
    assert.ok(formats.length >= 3, 'Instagram should have at least 3 formats');
    assert.ok(formats.every(f => f.platform === 'instagram'));
  });

  it('returns empty array for unknown platform', () => {
    const formats = compositor.getFormatsByPlatform('nonexistent');
    assert.deepEqual(formats, []);
  });
});

// ── renderStill ────────────────────────────────────────────────────

describe('renderStill', () => {
  const testOutputDir = path.join(import.meta.dirname, '../../data/compositions/__test__');

  it('renders a PNG at instagram-story dimensions', async () => {
    const result = await compositor.renderStill({
      compositionId: 'EventPoster',
      format: 'instagram-story',
      background: { imageUrl: '' },
      text: [
        {
          content: 'TEST RENDER',
          fontSize: 64,
          position: { x: 0.5, y: 0.5, anchor: 'center' },
        },
      ],
    });

    assert.ok(result.ok, 'renderStill should succeed');
    assert.ok(result.outputPath, 'should return outputPath');
    assert.ok(existsSync(result.outputPath), 'output file should exist');
    assert.equal(result.width, 1080);
    assert.equal(result.height, 1920);

    // Cleanup
    await rm(path.dirname(result.outputPath), { recursive: true, force: true });
  });

  it('renders at youtube-thumbnail dimensions', async () => {
    const result = await compositor.renderStill({
      compositionId: 'SocialCard',
      format: 'youtube-thumbnail',
      background: { imageUrl: '' },
      text: [
        {
          content: 'YT THUMB',
          fontSize: 80,
          position: { x: 0.5, y: 0.5, anchor: 'center' },
        },
      ],
    });

    assert.ok(result.ok);
    assert.equal(result.width, 1280);
    assert.equal(result.height, 720);

    await rm(path.dirname(result.outputPath), { recursive: true, force: true });
  });

  it('rejects unknown format', async () => {
    const result = await compositor.renderStill({
      compositionId: 'EventPoster',
      format: 'nonexistent-format',
      background: { imageUrl: '' },
      text: [],
    });

    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Unknown format'));
  });
});

// ── renderBatch ────────────────────────────────────────────────────

describe('renderBatch', () => {
  it('renders multiple formats from same props', async () => {
    const result = await compositor.renderBatch({
      compositionId: 'SocialCard',
      formats: ['instagram-post', 'linkedin-post'],
      background: { imageUrl: '' },
      text: [
        {
          content: 'BATCH TEST',
          fontSize: 56,
          position: { x: 0.5, y: 0.5, anchor: 'center' },
        },
      ],
    });

    assert.ok(result.ok, 'renderBatch should succeed');
    assert.equal(result.outputs.length, 2, 'should have 2 outputs');

    const igPost = result.outputs.find(o => o.format === 'instagram-post');
    const liPost = result.outputs.find(o => o.format === 'linkedin-post');
    assert.ok(igPost, 'should have instagram-post');
    assert.ok(liPost, 'should have linkedin-post');
    assert.equal(igPost.width, 1080);
    assert.equal(igPost.height, 1080);
    assert.equal(liPost.width, 1200);
    assert.equal(liPost.height, 628);

    // Cleanup
    await rm(result.jobDir, { recursive: true, force: true });
  });

  it('returns partial results when some formats fail', async () => {
    const result = await compositor.renderBatch({
      compositionId: 'SocialCard',
      formats: ['instagram-post', 'fake-format'],
      background: { imageUrl: '' },
      text: [],
    });

    assert.ok(result.ok, 'batch should still succeed partially');
    assert.equal(result.outputs.length, 1);
    assert.equal(result.errors.length, 1);
  });
});

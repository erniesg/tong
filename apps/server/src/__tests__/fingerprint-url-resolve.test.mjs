/**
 * Unit tests for fingerprint URL resolution logic.
 *
 * Run: node --test apps/server/src/__tests__/fingerprint-url-resolve.test.mjs
 *
 * Validates that the fingerprint pipeline correctly resolves video URLs
 * from various field names used by different pipeline stages.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the URL resolution logic in scripts/signals-pipeline.mjs cmdFingerprint.
 * If this breaks, the fingerprint CLI will skip videos silently.
 */
function resolveVideoUrl(item) {
  return item.videoPageUrl || item.videoUrl || item.video_url || item.url || item.downloadUrl || item.video?.url || null;
}

describe('fingerprint URL resolution', () => {
  it('resolves videoPageUrl from filter pipeline output', () => {
    const item = {
      platform: 'tiktok',
      title: 'Video by @gracesooda',
      videoPageUrl: 'https://www.tiktok.com/@gracesooda/video/7342872001104645394',
      thumbnailUrl: 'https://p16-common-sign.tiktokcdn.com/...',
      stats: { views: '63.3K' },
    };
    assert.equal(resolveVideoUrl(item), 'https://www.tiktok.com/@gracesooda/video/7342872001104645394');
  });

  it('resolves videoUrl from direct download results', () => {
    const item = {
      platform: 'tiktok',
      videoUrl: 'https://v16-webapp-prime.tiktok.com/video/xxx.mp4',
    };
    assert.equal(resolveVideoUrl(item), 'https://v16-webapp-prime.tiktok.com/video/xxx.mp4');
  });

  it('resolves video_url from XHS results', () => {
    const item = {
      platform: 'xiaohongshu',
      video_url: 'https://sns-video-bd.xhscdn.com/xxx.mp4',
    };
    assert.equal(resolveVideoUrl(item), 'https://sns-video-bd.xhscdn.com/xxx.mp4');
  });

  it('resolves url as fallback', () => {
    const item = { url: 'https://example.com/video.mp4' };
    assert.equal(resolveVideoUrl(item), 'https://example.com/video.mp4');
  });

  it('resolves downloadUrl', () => {
    const item = { downloadUrl: 'https://cdn.example.com/dl/video.mp4' };
    assert.equal(resolveVideoUrl(item), 'https://cdn.example.com/dl/video.mp4');
  });

  it('resolves nested video.url', () => {
    const item = { video: { url: 'https://cdn.example.com/nested.mp4' } };
    assert.equal(resolveVideoUrl(item), 'https://cdn.example.com/nested.mp4');
  });

  it('returns null when no URL field exists', () => {
    const item = { platform: 'tiktok', title: 'No URL' };
    assert.equal(resolveVideoUrl(item), null);
  });

  it('prefers videoPageUrl over videoUrl', () => {
    const item = {
      videoPageUrl: 'https://www.tiktok.com/@user/video/123',
      videoUrl: 'https://cdn.tiktok.com/video.mp4',
    };
    assert.equal(resolveVideoUrl(item), 'https://www.tiktok.com/@user/video/123');
  });

  it('detects social URLs for yt-dlp routing', () => {
    const socialPattern = /tiktok\.com|instagram\.com|xiaohongshu\.com|douyin\.com/;
    assert.ok(socialPattern.test('https://www.tiktok.com/@gracesooda/video/7342872001104645394'));
    assert.ok(socialPattern.test('https://www.instagram.com/reel/abc123/'));
    assert.ok(socialPattern.test('https://www.xiaohongshu.com/explore/abc'));
    assert.ok(!socialPattern.test('https://cdn.example.com/video.mp4'));
  });

  it('resolves all 20 items from cached 03-filtered.json', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve('apps/client/public/signals-cache/03-filtered.json');

    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      // Skip if cache file doesn't exist (CI environments)
      return;
    }

    const ranked = data.ranked || [];
    assert.ok(ranked.length > 0, 'Expected ranked results in 03-filtered.json');

    let resolved = 0;
    for (const item of ranked) {
      const url = resolveVideoUrl(item);
      if (url) resolved++;
    }
    assert.equal(resolved, ranked.length, `Expected all ${ranked.length} items to resolve, got ${resolved}`);
  });
});

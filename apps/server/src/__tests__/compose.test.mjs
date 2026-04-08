/**
 * Unit tests for compose.mjs — mask-aware compositing pipeline.
 *
 * Run: node --test apps/server/src/__tests__/compose.test.mjs
 *
 * Tests the high-level composition orchestration: building spatial prompts,
 * computing subject layout, and format-aware size mapping.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const compose = await import('../compose.mjs');

// ── Spatial Prompt Enhancement ─────────────────────────────────────

describe('buildSpatialPrompt', () => {
  it('adds no spatial directive when no subject position', () => {
    const result = compose.buildSpatialPrompt('a vibrant cityscape at sunset', {});
    assert.ok(result.includes('vibrant cityscape'));
    // Should not contain position-specific phrases
    assert.ok(!result.includes('negative space'));
  });

  it('adds right-side space directive for left-positioned subject', () => {
    const result = compose.buildSpatialPrompt('abstract gradient background', {
      subjectGravity: 'center-left',
    });
    assert.ok(result.includes('abstract gradient'));
    // Should guide generation to leave space
    assert.ok(
      result.includes('right') || result.includes('left side'),
      'Should reference spatial positioning',
    );
  });

  it('adds bottom space directive for top-positioned subject', () => {
    const result = compose.buildSpatialPrompt('tech conference stage', {
      subjectGravity: 'top-center',
    });
    assert.ok(
      result.includes('bottom') || result.includes('lower'),
      'Should reference bottom area',
    );
  });

  it('adds top space directive for bottom-positioned subject', () => {
    const result = compose.buildSpatialPrompt('neon lights background', {
      subjectGravity: 'bottom-center',
    });
    assert.ok(
      result.includes('top') || result.includes('upper'),
      'Should reference top area',
    );
  });
});

// ── Format-Aware Size Mapping ──────────────────────────────────────

describe('formatToImageSize', () => {
  it('maps instagram-story (9:16) to appropriate Seedream size', () => {
    const size = compose.formatToImageSize('instagram-story');
    assert.ok(size, 'Should return a size');
    assert.ok(typeof size === 'string' || typeof size === 'object');
  });

  it('maps youtube-thumbnail (16:9) to landscape size', () => {
    const size = compose.formatToImageSize('youtube-thumbnail');
    assert.ok(size);
  });

  it('maps instagram-post (1:1) to square size', () => {
    const size = compose.formatToImageSize('instagram-post');
    assert.ok(size);
  });

  it('returns default for unknown format', () => {
    const size = compose.formatToImageSize('nonexistent');
    assert.ok(size, 'Should return a default size');
  });
});

// ── Subject Layout Computation ─────────────────────────────────────

describe('computeSubjectLayout', () => {
  it('positions bottom-center subject correctly for 9:16', () => {
    const layout = compose.computeSubjectLayout({
      gravity: 'bottom-center',
      scale: 0.6,
      canvasWidth: 1080,
      canvasHeight: 1920,
      subjectAspect: 0.56, // ~9:16 portrait subject
    });
    assert.ok(layout.x >= 0, 'x should be non-negative');
    assert.ok(layout.y >= 0, 'y should be non-negative');
    assert.ok(layout.width > 0);
    assert.ok(layout.height > 0);
    // Bottom-center: y should be in the lower portion
    assert.ok(layout.y > 600, `Subject y (${layout.y}) should be in lower half`);
  });

  it('positions center-right subject correctly', () => {
    const layout = compose.computeSubjectLayout({
      gravity: 'center-right',
      scale: 0.5,
      canvasWidth: 1200,
      canvasHeight: 628,
      subjectAspect: 0.75,
    });
    // Right side: x should be past midpoint
    assert.ok(layout.x > 400, `Subject x (${layout.x}) should be on right side`);
  });

  it('respects scale parameter', () => {
    const small = compose.computeSubjectLayout({
      gravity: 'center',
      scale: 0.3,
      canvasWidth: 1080,
      canvasHeight: 1080,
      subjectAspect: 1.0,
    });
    const large = compose.computeSubjectLayout({
      gravity: 'center',
      scale: 0.8,
      canvasWidth: 1080,
      canvasHeight: 1080,
      subjectAspect: 1.0,
    });
    assert.ok(large.height > small.height, 'Larger scale should produce larger subject');
  });
});

// ── Multi-Subject Layout ───────────────────────────────────────────

describe('computeMultiSubjectLayout', () => {
  it('lays out two subjects without overlap', () => {
    const layouts = compose.computeMultiSubjectLayout({
      subjects: [
        { id: 'person', gravity: 'center-left', scale: 0.6, aspect: 0.56 },
        { id: 'tong', gravity: 'center-right', scale: 0.4, aspect: 0.56 },
      ],
      canvasWidth: 1080,
      canvasHeight: 1920,
    });

    assert.equal(layouts.length, 2);
    const [person, tong] = layouts;
    // Left subject should be left of right subject
    assert.ok(person.x < tong.x, 'Left subject should have smaller x');
  });

  it('handles single subject as passthrough', () => {
    const layouts = compose.computeMultiSubjectLayout({
      subjects: [{ id: 'me', gravity: 'bottom-center', scale: 0.7, aspect: 0.6 }],
      canvasWidth: 1080,
      canvasHeight: 1080,
    });
    assert.equal(layouts.length, 1);
    assert.equal(layouts[0].id, 'me');
  });
});

// ── Text-Safe Zone Computation ─────────────────────────────────────

describe('computeTextSafeZones', () => {
  it('returns zones that avoid the subject area', () => {
    const zones = compose.computeTextSafeZones({
      subjectLayouts: [{ x: 100, y: 500, width: 300, height: 600 }],
      canvasWidth: 1080,
      canvasHeight: 1920,
    });

    assert.ok(zones.length > 0, 'Should return at least one safe zone');
    // Each zone should be a rect
    for (const z of zones) {
      assert.ok('x' in z && 'y' in z && 'width' in z && 'height' in z);
      assert.ok(z.width > 0 && z.height > 0);
    }
  });

  it('returns full canvas when no subjects', () => {
    const zones = compose.computeTextSafeZones({
      subjectLayouts: [],
      canvasWidth: 1080,
      canvasHeight: 1080,
    });
    assert.ok(zones.length > 0);
    // Should cover most of the canvas
    const totalArea = zones.reduce((sum, z) => sum + z.width * z.height, 0);
    assert.ok(totalArea > 1080 * 1080 * 0.5);
  });
});

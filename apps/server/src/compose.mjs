/**
 * compose.mjs — Mask-aware compositing pipeline.
 *
 * Higher-level orchestration that chains segmentation, image generation,
 * and compositing into creative workflows. This module provides:
 *
 *   - Spatial prompt enhancement (guide AI to leave space for subjects)
 *   - Format-to-size mapping (platform format → Seedream/Gemini image size)
 *   - Subject layout computation (gravity → pixel positions)
 *   - Multi-subject layout (avoid overlaps)
 *   - Text-safe zone computation (find areas not occupied by subjects)
 *
 * The AI orchestrator calls these functions to plan composition, then
 * calls segment.*, generate.*, and compositor.* tools to execute.
 */

// ── Spatial Prompt Enhancement ─────────────────────────────────────

/**
 * Enhance an image generation prompt with spatial directives based on
 * where subjects will be placed. This guides the AI to create backgrounds
 * with appropriate negative space for compositing.
 *
 * @param {string} basePrompt - Original prompt for the background
 * @param {object} opts
 * @param {string} [opts.subjectGravity] - Where the subject will be placed
 * @param {number} [opts.subjectScale] - How much of the canvas the subject occupies (0-1)
 * @returns {string} Enhanced prompt with spatial directives
 */
export function buildSpatialPrompt(basePrompt, opts = {}) {
  const { subjectGravity, subjectScale = 0.6 } = opts;

  if (!subjectGravity) return basePrompt;

  const directives = [];

  // Determine where to put visual emphasis (opposite of subject)
  if (subjectGravity.includes('left')) {
    directives.push('with visual interest and detail concentrated on the right side');
    directives.push('the left side should be simpler with subtle textures or gradients');
  } else if (subjectGravity.includes('right')) {
    directives.push('with visual interest concentrated on the left side');
    directives.push('the right side should have cleaner, less busy composition');
  }

  if (subjectGravity.includes('bottom')) {
    directives.push('with the upper portion being the focal area');
    directives.push('the lower third should have a simpler, less detailed composition suitable as a backdrop');
  } else if (subjectGravity.includes('top')) {
    directives.push('with the lower and middle portions being the focal area');
    directives.push('the top area should be less detailed, suitable as a backdrop behind a person');
  }

  if (subjectGravity === 'center') {
    directives.push('with visual interest around the edges');
    directives.push('the center should be slightly less busy, creating a natural frame');
  }

  if (directives.length === 0) return basePrompt;

  return `${basePrompt}. ${directives.join('. ')}. The image should work well as a background with a person or character composited on top.`;
}

// ── Format-to-Size Mapping ─────────────────────────────────────────

const FORMAT_SIZES = {
  // Seedream sizes: 1K (1024x1024), 2K (2048x2048), 4K (4096x4096)
  // For non-square, we specify WxH strings for volcengine
  // Maps format key → { size, aspectHint }
  'instagram-post':      { size: '1K',        dimensions: '1080x1080',  aspect: 'square' },
  'instagram-story':     { size: '2K',        dimensions: '1080x1920',  aspect: 'portrait' },
  'instagram-reel':      { size: '2K',        dimensions: '1080x1920',  aspect: 'portrait' },
  'tiktok-video':        { size: '2K',        dimensions: '1080x1920',  aspect: 'portrait' },
  'linkedin-post':       { size: '2K',        dimensions: '1200x628',   aspect: 'landscape' },
  'linkedin-carousel':   { size: '1K',        dimensions: '1080x1080',  aspect: 'square' },
  'facebook-post':       { size: '2K',        dimensions: '1200x628',   aspect: 'landscape' },
  'facebook-story':      { size: '2K',        dimensions: '1080x1920',  aspect: 'portrait' },
  'twitter-post':        { size: '2K',        dimensions: '1600x900',   aspect: 'landscape' },
  'twitter-header':      { size: '2K',        dimensions: '1500x500',   aspect: 'ultrawide' },
  'youtube-thumbnail':   { size: '2K',        dimensions: '1280x720',   aspect: 'landscape' },
  'youtube-short':       { size: '2K',        dimensions: '1080x1920',  aspect: 'portrait' },
  'xiaohongshu-post':    { size: '2K',        dimensions: '1080x1440',  aspect: 'portrait' },
};

/**
 * Map a platform format to an appropriate image generation size.
 * @param {string} formatId - format key
 * @returns {{ size: string, dimensions: string, aspect: string }}
 */
export function formatToImageSize(formatId) {
  return FORMAT_SIZES[formatId] || { size: '2K', dimensions: '1080x1080', aspect: 'square' };
}

// ── Subject Layout Computation ─────────────────────────────────────

/**
 * Compute pixel position and dimensions for a subject based on
 * gravity, scale, and canvas dimensions.
 *
 * @param {object} opts
 * @param {string} opts.gravity - Placement gravity (bottom-center, center-right, etc.)
 * @param {number} opts.scale - Fraction of canvas height for subject (0-1)
 * @param {number} opts.canvasWidth
 * @param {number} opts.canvasHeight
 * @param {number} opts.subjectAspect - Width/height ratio of subject (e.g. 0.56 for portrait)
 * @param {number} [opts.offsetX] - Normalized horizontal offset (0-1)
 * @param {number} [opts.offsetY] - Normalized vertical offset (0-1)
 * @returns {{ x, y, width, height }}
 */
export function computeSubjectLayout(opts) {
  const {
    gravity = 'bottom-center',
    scale = 0.6,
    canvasWidth,
    canvasHeight,
    subjectAspect = 0.56,
    offsetX = 0,
    offsetY = 0,
  } = opts;

  const height = Math.round(canvasHeight * scale);
  const width = Math.round(height * subjectAspect);

  let x, y;

  // Horizontal positioning
  if (gravity.includes('left')) {
    x = Math.round(canvasWidth * 0.05);
  } else if (gravity.includes('right')) {
    x = canvasWidth - width - Math.round(canvasWidth * 0.05);
  } else {
    x = Math.round((canvasWidth - width) / 2);
  }

  // Vertical positioning
  if (gravity.includes('top')) {
    y = Math.round(canvasHeight * 0.05);
  } else if (gravity.includes('bottom')) {
    y = canvasHeight - height - Math.round(canvasHeight * 0.02);
  } else {
    y = Math.round((canvasHeight - height) / 2);
  }

  // Apply offsets
  x += Math.round(offsetX * canvasWidth);
  y += Math.round(offsetY * canvasHeight);

  return { x, y, width, height };
}

// ── Multi-Subject Layout ───────────────────────────────────────────

/**
 * Compute layout for multiple subjects, respecting their gravities
 * and avoiding overlaps.
 *
 * @param {object} opts
 * @param {Array<{ id, gravity, scale, aspect }>} opts.subjects
 * @param {number} opts.canvasWidth
 * @param {number} opts.canvasHeight
 * @returns {Array<{ id, x, y, width, height }>}
 */
export function computeMultiSubjectLayout(opts) {
  const { subjects, canvasWidth, canvasHeight } = opts;

  return subjects.map((s) => {
    const layout = computeSubjectLayout({
      gravity: s.gravity,
      scale: s.scale,
      canvasWidth,
      canvasHeight,
      subjectAspect: s.aspect || 0.56,
    });
    return { id: s.id, ...layout };
  });
}

// ── Text-Safe Zone Computation ─────────────────────────────────────

/**
 * Find rectangular zones where text can be placed without overlapping
 * subject areas. Returns an array of safe rectangles sorted by area
 * (largest first).
 *
 * @param {object} opts
 * @param {Array<{ x, y, width, height }>} opts.subjectLayouts
 * @param {number} opts.canvasWidth
 * @param {number} opts.canvasHeight
 * @param {number} [opts.padding] - Minimum distance from subject edges (px)
 * @returns {Array<{ x, y, width, height, position: string }>}
 */
export function computeTextSafeZones(opts) {
  const { subjectLayouts = [], canvasWidth, canvasHeight, padding = 20 } = opts;

  if (subjectLayouts.length === 0) {
    // Full canvas is safe, with margins
    const margin = Math.round(canvasWidth * 0.05);
    return [{
      x: margin,
      y: margin,
      width: canvasWidth - margin * 2,
      height: canvasHeight - margin * 2,
      position: 'full',
    }];
  }

  const zones = [];
  const margin = Math.round(canvasWidth * 0.05);

  // Compute bounding box of all subjects
  let minSX = canvasWidth, minSY = canvasHeight, maxSX = 0, maxSY = 0;
  for (const s of subjectLayouts) {
    minSX = Math.min(minSX, s.x - padding);
    minSY = Math.min(minSY, s.y - padding);
    maxSX = Math.max(maxSX, s.x + s.width + padding);
    maxSY = Math.max(maxSY, s.y + s.height + padding);
  }

  // Zone above all subjects
  if (minSY > margin + 100) {
    zones.push({
      x: margin,
      y: margin,
      width: canvasWidth - margin * 2,
      height: minSY - margin,
      position: 'above',
    });
  }

  // Zone below all subjects
  if (maxSY < canvasHeight - margin - 100) {
    zones.push({
      x: margin,
      y: maxSY,
      width: canvasWidth - margin * 2,
      height: canvasHeight - maxSY - margin,
      position: 'below',
    });
  }

  // Zone to the left of all subjects
  if (minSX > margin + 100) {
    zones.push({
      x: margin,
      y: margin,
      width: minSX - margin,
      height: canvasHeight - margin * 2,
      position: 'left',
    });
  }

  // Zone to the right of all subjects
  if (maxSX < canvasWidth - margin - 100) {
    zones.push({
      x: maxSX,
      y: margin,
      width: canvasWidth - maxSX - margin,
      height: canvasHeight - margin * 2,
      position: 'right',
    });
  }

  // Sort by area, largest first
  zones.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  return zones;
}

/**
 * sam2-client.mjs — Segmentation client with multi-provider support.
 *
 * Providers (selected via SEGMENT_PROVIDER env var):
 *   - "replicate" (default) — SAM3 for text-prompted, BiRefNet for auto bg removal
 *   - "local" — Python sidecar on port 8100 (SAM2/SAM3 depending on env)
 *
 * Tools:
 *   segment.extract      → Auto-segment largest foreground subject
 *   segment.interactive   → Text or point/box-prompted segmentation
 *   segment.contour       → Outline from mask (always local — no model needed)
 *   segment.composite     → Multi-layer compositing (always local)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────

const SEGMENT_PROVIDER = () => process.env.SEGMENT_PROVIDER || 'replicate';
const SAM2_BASE_URL = () => process.env.SAM2_SERVICE_URL || 'http://localhost:8100';
const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const REPLICATE_API_TOKEN = () => process.env.REPLICATE_API_TOKEN || '';

// Replicate model versions (pinned for stability)
const MODELS = {
  sam3: {
    name: 'mattsays/sam3-image',     // Text-prompted segmentation, ~$0.001/run
    version: 'd73db077226443ba4fafd34e233b3626b552eac2a433f90c7c32a9ac89bd9e72',
  },
  birefnet: {
    name: 'men1scus/birefnet',       // Auto bg removal, ~$0.002/run
    version: 'f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7',
  },
};

// ── Replicate helpers ─────────────────────────────────────────────

async function replicatePredict(modelKey, input) {
  const token = REPLICATE_API_TOKEN();
  if (!token) throw new Error('REPLICATE_API_TOKEN not configured');

  const model = MODELS[modelKey];
  if (!model) throw new Error(`Unknown model key: ${modelKey}`);

  // Use versioned /predictions endpoint (required for community models)
  const resp = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Prefer: 'wait=60',
    },
    body: JSON.stringify({ version: model.version, input }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Replicate ${model.name} error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(`Replicate ${model.name}: ${data.error}`);
  return data;
}

/**
 * Convert a base64 image to a data URI for Replicate input.
 * Replicate accepts data URIs in the image field.
 */
function b64ToDataUri(b64, mime = 'image/png') {
  // If already a data URI, pass through
  if (b64.startsWith('data:')) return b64;
  return `data:${mime};base64,${b64}`;
}

/**
 * Fetch an image URL and return as base64.
 */
async function urlToBase64(url) {
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

// ── Local sidecar helpers ─────────────────────────────────────────

async function sidecarFetch(endpoint, body) {
  const resp = await fetch(`${SAM2_BASE_URL()}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sidecar ${endpoint} failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Auto-segment the largest foreground subject from an image.
 *
 * Replicate mode: Uses BiRefNet for clean alpha-matte background removal.
 * Local mode: Uses SAM2/3 sidecar auto-segment.
 *
 * @param {object} args
 * @param {string} [args.imageBase64] - base64 encoded image
 * @param {string} [args.imageUrl] - URL of image
 * @param {string} [args.provider] - override: 'replicate' | 'local'
 * @returns {Promise<{subjectBase64?, subjectUrl?, maskBase64?, maskUrl?, boundingBox?}>}
 */
export async function extractSubject(args) {
  const provider = args.provider || SEGMENT_PROVIDER();

  if (provider === 'replicate') {
    // Use BiRefNet for auto background removal — outputs clean RGBA
    const imageInput = args.imageUrl || (args.imageBase64 ? b64ToDataUri(args.imageBase64) : null);
    if (!imageInput) throw new Error('imageBase64 or imageUrl required');

    const prediction = await replicatePredict('birefnet', {
      image: imageInput,
    });

    // BiRefNet returns a single URL to the mask/subject image
    const outputUrl = prediction.output;
    return {
      subjectUrl: outputUrl,
      maskUrl: outputUrl,
      provider: 'replicate:birefnet',
      predictionId: prediction.id,
    };
  }

  // Local sidecar
  let imageBase64 = args.imageBase64;
  if (!imageBase64 && args.imageUrl) {
    imageBase64 = await urlToBase64(args.imageUrl);
  }

  return {
    ...await sidecarFetch('/segment', { imageBase64 }),
    provider: 'local',
  };
}

/**
 * Text-prompted or point/box-prompted segmentation.
 *
 * Replicate mode: Uses SAM3 with text prompts (e.g., "person", "the dog").
 * Local mode: Uses SAM2/3 sidecar with point/box prompts.
 *
 * @param {object} args
 * @param {string} [args.imageBase64] - base64 encoded image
 * @param {string} [args.imageUrl] - URL of image
 * @param {string} [args.textPrompt] - text prompt for SAM3 (Replicate only)
 * @param {Array<{x,y,label}>} [args.points] - point prompts (local only)
 * @param {number[]} [args.box] - bounding box [x1, y1, x2, y2] (local only)
 * @param {number} [args.threshold] - confidence threshold (default 0.5)
 * @param {string} [args.provider] - override: 'replicate' | 'local'
 * @returns {Promise<{subjectUrl?, maskUrl?, subjectBase64?, maskBase64?, boundingBox?}>}
 */
export async function interactiveSegment(args) {
  const provider = args.provider || SEGMENT_PROVIDER();

  if (provider === 'replicate') {
    const imageInput = args.imageUrl || (args.imageBase64 ? b64ToDataUri(args.imageBase64) : null);
    if (!imageInput) throw new Error('imageBase64 or imageUrl required');

    // SAM3 text-prompted segmentation
    const prediction = await replicatePredict('sam3', {
      image: imageInput,
      prompt: args.textPrompt || 'person',
      threshold: args.threshold ?? 0.5,
      mask_only: true,      // Return black-and-white mask
      return_zip: false,     // Single mask image, not zip
    });

    const outputUrl = prediction.output;
    return {
      maskUrl: outputUrl,
      provider: 'replicate:sam3',
      predictionId: prediction.id,
      prompt: args.textPrompt || 'person',
    };
  }

  // Local sidecar
  let imageBase64 = args.imageBase64;
  if (!imageBase64 && args.imageUrl) {
    imageBase64 = await urlToBase64(args.imageUrl);
  }

  return {
    ...await sidecarFetch('/segment/interactive', {
      imageBase64,
      points: args.points || null,
      box: args.box || null,
    }),
    provider: 'local',
  };
}

/**
 * Generate contour/outline from a mask.
 * Always runs locally (no model needed, just OpenCV edge detection).
 *
 * @param {object} args
 * @param {string} args.maskBase64 - base64 encoded mask (grayscale)
 * @param {string} [args.maskUrl] - URL of mask image (fetched and converted)
 * @param {string} [args.color] - hex color for contour (default: #FFFFFF)
 * @param {number} [args.width] - contour line width in px (default: 3)
 * @returns {Promise<{contourBase64}>}
 */
export async function generateContour(args) {
  let maskBase64 = args.maskBase64;
  if (!maskBase64 && args.maskUrl) {
    maskBase64 = await urlToBase64(args.maskUrl);
  }

  return sidecarFetch('/contour', {
    maskBase64,
    color: args.color || '#FFFFFF',
    width: args.width || 3,
  });
}

/**
 * Composite multiple layers onto a background.
 * Always runs locally (PIL image compositing, no model needed).
 *
 * @param {object} args
 * @param {string} args.backgroundBase64 - base64 background image
 * @param {number} args.width - output width
 * @param {number} args.height - output height
 * @param {Array<{imageBase64, x, y, width?, height?, opacity?, dropShadow?}>} args.layers
 * @returns {Promise<{resultBase64}>}
 */
export async function compositeImage(args) {
  // Convert any URL-based layer images to base64 for the sidecar
  const layers = await Promise.all((args.layers || []).map(async (layer) => {
    if (layer.imageUrl && !layer.imageBase64) {
      layer.imageBase64 = await urlToBase64(layer.imageUrl);
    }
    return layer;
  }));

  return sidecarFetch('/composite', {
    backgroundBase64: args.backgroundBase64,
    width: args.width,
    height: args.height,
    layers,
  });
}

/**
 * Health check — reports both Replicate and local sidecar status.
 * @returns {Promise<{status, providers}>}
 */
export async function sam2Health() {
  const providers = {};

  // Check Replicate
  try {
    const token = REPLICATE_API_TOKEN();
    providers.replicate = {
      available: !!token,
      models: Object.entries(MODELS).map(([k, v]) => `${k}: ${v}`),
    };
  } catch {
    providers.replicate = { available: false };
  }

  // Check local sidecar
  try {
    const resp = await fetch(`${SAM2_BASE_URL()}/health`, { signal: AbortSignal.timeout(2000) });
    providers.local = await resp.json();
  } catch {
    providers.local = { available: false, error: 'Sidecar not running' };
  }

  return {
    status: 'ok',
    defaultProvider: SEGMENT_PROVIDER(),
    providers,
  };
}

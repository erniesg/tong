import sharp from 'sharp';

/**
 * Replicate API client — Image gen (Nano Banana 2) + Video gen (Veo 3.1 Fast) + Music gen (Lyria 2).
 *
 * Services:
 *   1. Image gen (Nano Banana 2)  – google/nano-banana-2, sync via Prefer: wait
 *   2. Video gen (Veo 3.1 Fast)   – google/veo-3.1-fast, async with webhook
 *   3. Music gen (Lyria 2)        – google/lyria-2, sync via Prefer: wait
 *
 * Webhook support:
 *   Set REPLICATE_WEBHOOK_BASE_URL to your public server URL (e.g. https://xyz.ngrok.io)
 *   Async predictions will auto-attach a webhook so Replicate pushes status updates.
 *   Use replicateWaitForPrediction() to await completion via webhook (no polling needed).
 *
 * All functions are designed to be called from the tool invocation layer.
 * API keys are read from environment variables and never exposed to the client.
 */

// ── Configuration ────────────────────────────────────────────────────

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';
const REPLICATE_API_TOKEN = () => process.env.REPLICATE_API_TOKEN || '';
const REPLICATE_WEBHOOK_BASE_URL = () => process.env.REPLICATE_WEBHOOK_BASE_URL || '';

// In-memory prediction store for tracking
const predictions = new Map();

// Pending waiters: predictionId → { resolve, reject, timer }
const waiters = new Map();

// ── Helpers ──────────────────────────────────────────────────────────

function replicateHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${REPLICATE_API_TOKEN()}`,
    ...extra,
  };
}

// ── Generic Prediction API ───────────────────────────────────────────

/**
 * Create a prediction for any Replicate model.
 *
 * @param {object} args
 * @param {string} args.model  - "owner/name" format
 * @param {object} args.input  - Model-specific input parameters
 * @param {object} [args.extraHeaders] - Additional headers (e.g. Prefer: wait)
 * @returns {Promise<object>} Prediction object
 */
async function createPrediction(args, extraHeaders = {}) {
  const token = REPLICATE_API_TOKEN();
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const body = { input: args.input };

  // Auto-attach webhook for async predictions (skip for sync Prefer: wait)
  const isSync = extraHeaders.Prefer && extraHeaders.Prefer.includes('wait');
  const webhookBase = REPLICATE_WEBHOOK_BASE_URL();
  if (!isSync && webhookBase) {
    body.webhook = `${webhookBase}/api/v1/replicate/webhook`;
    body.webhook_events_filter = ['completed'];
  }

  const response = await fetch(`${REPLICATE_API_BASE}/models/${args.model}/predictions`, {
    method: 'POST',
    headers: replicateHeaders(extraHeaders),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Replicate API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  predictions.set(data.id, data);
  return normalizePrediction(data);
}

/**
 * Get a prediction by ID.
 *
 * @param {string} predictionId
 * @returns {Promise<object>} Prediction object
 */
export async function replicateGetPrediction(predictionId) {
  const token = REPLICATE_API_TOKEN();
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const response = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}`, {
    method: 'GET',
    headers: replicateHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Replicate API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  predictions.set(data.id, data);
  return normalizePrediction(data);
}

/**
 * Cancel a running prediction.
 *
 * @param {string} predictionId
 * @returns {Promise<object>} Prediction object
 */
export async function replicateCancelPrediction(predictionId) {
  const token = REPLICATE_API_TOKEN();
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const response = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}/cancel`, {
    method: 'POST',
    headers: replicateHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Replicate API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  predictions.set(data.id, data);
  return normalizePrediction(data);
}

function normalizePrediction(data) {
  return {
    id: data.id,
    model: data.model,
    version: data.version,
    status: data.status,
    output: data.output ?? null,
    error: data.error ?? null,
    metrics: data.metrics ?? null,
    createdAt: data.created_at,
    startedAt: data.started_at,
    completedAt: data.completed_at,
  };
}

// ── 1. Image Generation (Nano Banana 2) ──────────────────────────────

/**
 * Generate images using google/nano-banana-2 via Replicate.
 * Uses sync mode (Prefer: wait=60) since image gen takes ~20-30s.
 *
 * @param {object} args
 * @param {string}  args.prompt            - Text description of the image
 * @param {string}  [args.image]           - Optional input image URL for img2img
 * @param {string}  [args.aspect_ratio]    - '1:1'|'16:9'|'9:16'|'4:3'|'3:4'|'3:2'|'2:3' (default '1:1')
 * @param {string}  [args.output_format]   - 'png'|'jpg'|'webp' (default 'png')
 * @param {string}  [args.output_resolution] - 'auto'|'1024'|'2048' (default 'auto')
 * @param {number}  [args.number_of_images] - 1-4 (default 1)
 * @returns {Promise<{id: string, status: string, images: string[], error: string|null}>}
 */
export async function replicateGenerateImage(args) {
  const input = {
    prompt: args.prompt,
  };

  if (args.image) input.image = args.image;
  if (args.aspect_ratio) input.aspect_ratio = args.aspect_ratio;
  if (args.output_format) input.output_format = args.output_format;
  if (args.output_resolution) input.output_resolution = args.output_resolution;
  if (args.number_of_images != null) input.number_of_images = args.number_of_images;

  const prediction = await createPrediction(
    { model: 'google/nano-banana-2', input },
    { Prefer: 'wait=60' },
  );

  // In sync mode, output is available immediately
  const images = Array.isArray(prediction.output) ? prediction.output : prediction.output ? [prediction.output] : [];

  return {
    id: prediction.id,
    status: prediction.status,
    images,
    error: prediction.error,
  };
}

// ── 2. Video Generation (Veo 3.1 Fast) ──────────────────────────────

/**
 * Create a video using google/veo-3.1-fast via Replicate.
 * Async — returns prediction ID for polling (video takes ~60-120s).
 *
 * @param {object} args
 * @param {string}  args.prompt        - Text description of the video
 * @param {string}  [args.image]       - Optional input image URL for img2vid
 * @param {number}  [args.duration]    - 4|6|8 seconds (default 8)
 * @param {string}  [args.resolution]  - '720p'|'1080p' (default '720p')
 * @param {string}  [args.aspect_ratio] - '16:9'|'9:16' (default '16:9')
 * @returns {Promise<object>} Prediction object with id for polling
 */
export async function replicateGenerateVideo(args) {
  const input = {
    prompt: args.prompt,
  };

  if (args.image) input.image = args.image;
  if (args.duration != null) input.duration = args.duration;
  if (args.resolution) input.resolution = args.resolution;
  if (args.aspect_ratio) input.aspect_ratio = args.aspect_ratio;

  return createPrediction({ model: 'google/veo-3.1-fast', input });
}

// ── 3. Music Generation (Lyria 2) ────────────────────────────────────

/**
 * Generate music using google/lyria-2 via Replicate.
 * Uses sync mode (Prefer: wait=60) since music gen takes ~20-30s.
 * Produces 30s of 48kHz stereo instrumental audio.
 *
 * @param {object} args
 * @param {string}  args.prompt           - Text description or lyrics (max 600 chars). Supports newlines for line breaks, double newlines for pauses, ## for accompaniment sections.
 * @param {string}  [args.negative_prompt] - Description of what to exclude from the audio
 * @param {number}  [args.seed]           - Seed for deterministic generation (min 0)
 * @returns {Promise<{id: string, status: string, audio: string|null, error: string|null}>}
 */
export async function replicateGenerateMusic(args) {
  const input = {
    prompt: args.prompt,
  };

  if (args.negative_prompt) input.negative_prompt = args.negative_prompt;
  if (args.seed != null) input.seed = args.seed;

  const prediction = await createPrediction(
    { model: 'google/lyria-2', input },
    { Prefer: 'wait=60' },
  );

  // Output is a single audio URL
  const audio = typeof prediction.output === 'string' ? prediction.output : null;

  return {
    id: prediction.id,
    status: prediction.status,
    audio,
    error: prediction.error,
  };
}

// ── Webhook Handler ──────────────────────────────────────────────────

/**
 * Handle incoming webhook from Replicate.
 * Called by the HTTP server when POST /api/v1/replicate/webhook is hit.
 *
 * @param {object} data - Raw prediction payload from Replicate
 * @returns {{ ok: boolean }}
 */
export function handleReplicateWebhook(data) {
  if (!data || !data.id) {
    return { ok: false, error: 'missing prediction id' };
  }

  // Update local cache
  predictions.set(data.id, data);
  const normalized = normalizePrediction(data);

  // Resolve any pending waiters
  const waiter = waiters.get(data.id);
  if (waiter) {
    clearTimeout(waiter.timer);
    waiters.delete(data.id);

    if (normalized.status === 'failed' || normalized.status === 'canceled') {
      waiter.reject(new Error(normalized.error || `Prediction ${normalized.status}`));
    } else {
      waiter.resolve(normalized);
    }
  }

  return { ok: true, predictionId: data.id, status: normalized.status };
}

/**
 * Wait for a prediction to complete via webhook notification.
 * Falls back to polling if no webhook is configured.
 *
 * @param {string} predictionId
 * @param {number} [timeoutMs=300000] - Max wait (default 5 min)
 * @returns {Promise<object>} Completed prediction
 */
export function replicateWaitForPrediction(predictionId, timeoutMs = 300000) {
  // Check if already completed in cache
  const cached = predictions.get(predictionId);
  if (cached) {
    const status = cached.status;
    if (status === 'succeeded' || status === 'failed' || status === 'canceled') {
      const normalized = normalizePrediction(cached);
      if (status === 'failed' || status === 'canceled') {
        return Promise.reject(new Error(normalized.error || `Prediction ${status}`));
      }
      return Promise.resolve(normalized);
    }
  }

  const webhookBase = REPLICATE_WEBHOOK_BASE_URL();

  // If webhook is configured, wait for the push
  if (webhookBase) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(predictionId);
        reject(new Error(`Prediction ${predictionId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      waiters.set(predictionId, { resolve, reject, timer });
    });
  }

  // Fallback: poll every 5s
  return pollPrediction(predictionId, 5000, timeoutMs);
}

async function pollPrediction(predictionId, intervalMs, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const prediction = await replicateGetPrediction(predictionId);
    if (prediction.status === 'succeeded') return prediction;
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(prediction.error || `Prediction ${prediction.status}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Prediction ${predictionId} timed out after ${timeoutMs}ms`);
}

// ── 4. Character Reference Image Generation ─────────────────────────

const CHARACTER_PRESETS = {
  dingman: {
    name: 'Ding Man (丁漫)',
    face: 'Oval face, high forehead, high cheekbones with slight hollow beneath',
    eyes: 'Large almond-shaped double-lid eyes, dark brown irises, slightly downturned outer corners',
    eyebrows: 'Thin natural arched eyebrows, well-spaced from eyes',
    nose: 'Straight high-bridged narrow nose with refined tip',
    mouth: 'Full lips with defined cupid\'s bow, naturally rosy',
    skin: 'Fair porcelain complexion, clear',
    hair: 'Long straight silky center-parted black hair past mid-back',
    build: 'Tall slender dancer\'s build, long swan-like neck, narrow shoulders, 170cm',
    distinguishing: 'High cheekbones with slight hollow, swan-like neck',
    casualLook: {
      expression: 'soft distant slightly melancholic gaze',
      clothing: 'Loose vintage cream silk blouse with subtle draping, sleeves to elbows, first button undone, 90s Hong Kong retro style',
    },
  },
  qushoucheng: {
    name: 'Qu Shoucheng (曲守城)',
    face: 'Square jaw, broad forehead, strong angular jawline',
    eyes: 'Deep-set single-lid eyes, dark brown irises, intense steady gaze',
    eyebrows: 'Thick straight eyebrows, slightly furrowed',
    nose: 'Broad straight nose with rounded tip',
    mouth: 'Thin firm lips, often pressed together',
    skin: 'Warm tan complexion, weathered',
    hair: 'Short cropped black hair, neat military-style cut',
    build: 'Broad-shouldered muscular build, thick neck, 182cm',
    distinguishing: 'Strong angular jawline, intense steady gaze',
    casualLook: {
      expression: 'calm confident half-smile',
      clothing: 'Fitted dark navy henley shirt, sleeves pushed up to forearms, silver watch on left wrist',
    },
  },
  miku: {
    name: 'Miku (未来)',
    face: 'Heart-shaped face, small chin, soft rounded features',
    eyes: 'Large round double-lid eyes, bright dark brown irises, expressive and lively',
    eyebrows: 'Soft curved eyebrows, natural and youthful',
    nose: 'Small button nose with slightly upturned tip',
    mouth: 'Small pouty lips, naturally pink',
    skin: 'Light fair complexion, smooth and dewy',
    hair: 'Shoulder-length layered black hair with wispy bangs, slightly wavy ends',
    build: 'Petite slender build, delicate frame, 158cm',
    distinguishing: 'Bright expressive eyes, youthful energy',
    casualLook: {
      expression: 'bright cheerful smile showing teeth',
      clothing: 'Oversized pastel pink hoodie over white pleated skirt, small crossbody bag',
    },
  },
  kaito: {
    name: 'Kaito (海斗)',
    face: 'Oval face, balanced proportions, clean features',
    eyes: 'Narrow sharp single-lid eyes, dark brown irises, observant analytical gaze',
    eyebrows: 'Defined angular eyebrows, well-groomed',
    nose: 'Straight narrow nose, well-proportioned',
    mouth: 'Medium lips, neutral resting expression',
    skin: 'Light olive complexion, clear',
    hair: 'Medium-length black hair, side-parted with slight wave, falls just above ears',
    build: 'Lean athletic build, good posture, 175cm',
    distinguishing: 'Sharp observant eyes, composed demeanor',
    casualLook: {
      expression: 'thoughtful slight smirk',
      clothing: 'Crisp white oxford shirt untucked over dark indigo jeans, minimal silver necklace',
    },
  },
  obachan: {
    name: 'Obachan (おばあちゃん)',
    face: 'Round soft face, laugh lines around eyes and mouth, gentle features',
    eyes: 'Small warm crescent-shaped eyes, dark brown irises, perpetual kindness',
    eyebrows: 'Thin sparse grey eyebrows, soft arch',
    nose: 'Small rounded nose',
    mouth: 'Thin gentle lips, natural smile lines',
    skin: 'Warm beige complexion with age spots, soft wrinkles',
    hair: 'Short permed silver-grey hair, neat and voluminous',
    build: 'Short stout build, slightly hunched posture, 152cm',
    distinguishing: 'Warm crescent-shaped smile, laugh lines, grandmotherly warmth',
    casualLook: {
      expression: 'warm gentle smile with crinkled eyes',
      clothing: 'Soft lavender cardigan over floral print blouse, reading glasses on beaded chain around neck',
    },
  },
};

const VARIANT_CONFIGS = {
  'a-pose': {
    framing: 'Full body front-facing A-pose, arms slightly away from body, full body visible head to feet',
    expression: 'neutral calm expression',
    clothing: 'Wearing plain fitted light grey t-shirt and grey leggings',
    extras: 'No makeup, no jewelry, no accessories, no piercings',
  },
  grimace: {
    framing: 'Half body from waist up, front-facing',
    expression: 'making wide grimace clearly showing both upper and lower rows of teeth, mouth stretched wide open',
    clothing: 'Wearing plain light grey t-shirt',
    extras: 'No makeup, no jewelry, no accessories, no piercings',
  },
  'right-profile': {
    framing: 'Right profile view, half body from waist up, facing right',
    expression: 'neutral expression',
    clothing: 'Wearing plain light grey t-shirt',
    extras: 'No makeup, no jewelry, no accessories, no piercings',
  },
  casual: {
    framing: 'Half body from waist up, front-facing',
    // expression + clothing come from CHARACTER_PRESETS[id].casualLook
  },
};

const CHARACTER_REF_STYLE =
  'Solid bright chromakey green background (#00FF00), flat even studio lighting, character reference sheet style';

/**
 * Build a complete prompt for a character reference image.
 *
 * @param {object} opts
 * @param {string} opts.characterId  - Key in CHARACTER_PRESETS
 * @param {string} opts.variant      - Key in VARIANT_CONFIGS
 * @param {object} [opts.customOverrides] - Override any face/body field
 * @returns {string} Assembled prompt
 */
function buildCharacterPrompt({ characterId, variant, customOverrides }) {
  const preset = CHARACTER_PRESETS[characterId];
  if (!preset) throw new Error(`Unknown character: ${characterId}`);

  const variantCfg = VARIANT_CONFIGS[variant];
  if (!variantCfg) throw new Error(`Unknown variant: ${variant}`);

  const merged = { ...preset, ...(customOverrides || {}) };
  const parts = [];

  // Framing
  parts.push(variantCfg.framing);

  // Expression: casual uses per-character, others use variant default
  if (variant === 'casual' && merged.casualLook) {
    parts.push(merged.casualLook.expression);
  } else if (variantCfg.expression) {
    parts.push(variantCfg.expression);
  }

  // Face card fields
  const faceFields = ['face', 'eyes', 'eyebrows', 'nose', 'mouth', 'skin', 'hair', 'build', 'distinguishing'];
  for (const field of faceFields) {
    if (merged[field]) parts.push(merged[field]);
  }

  // Clothing: casual uses per-character, others use variant default
  if (variant === 'casual' && merged.casualLook) {
    parts.push(merged.casualLook.clothing);
  } else if (variantCfg.clothing) {
    parts.push(variantCfg.clothing);
  }

  // Extras (no makeup etc.)
  if (variantCfg.extras) parts.push(variantCfg.extras);

  // Style suffix
  parts.push(CHARACTER_REF_STYLE);

  return parts.join(', ');
}

/**
 * Chroma-key green screen removal.
 * Fetches an image URL, replaces green pixels with transparency, returns base64 PNG.
 *
 * @param {string} imageUrl - URL of the green-screen image
 * @param {object} [opts]
 * @param {number} [opts.threshold=90] - Max distance from pure green to consider "green" (0-255 scale)
 * @returns {Promise<string>} Base64-encoded PNG with alpha
 */
async function chromaKeyRemoveGreen(imageUrl, opts = {}) {
  const threshold = opts.threshold ?? 90;

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = data;
  const channels = info.channels; // 4 (RGBA)

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Distance from pure green (#00FF00)
    const dist = Math.sqrt(r * r + (255 - g) * (255 - g) + b * b);

    if (dist < threshold) {
      // Fully transparent
      pixels[i + 3] = 0;
    } else if (dist < threshold + 30) {
      // Feathered edge — partial transparency for anti-aliasing
      const alpha = Math.round(((dist - threshold) / 30) * 255);
      pixels[i + 3] = Math.min(pixels[i + 3], alpha);
    }
  }

  const result = await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels },
  })
    .png()
    .toBuffer();

  return result.toString('base64');
}

/**
 * Generate a character reference image.
 * Uses green-screen prompting + chroma-key post-processing for true transparency.
 *
 * @param {object} args
 * @param {string}  args.characterId     - Character preset key
 * @param {string}  args.variant         - a-pose|grimace|right-profile|casual
 * @param {object}  [args.customOverrides] - Override any face/body field
 * @param {string}  [args.referenceImage] - URL of a reference image for face consistency
 * @returns {Promise<{id: string, status: string, images: string[], transparentB64: string|null, prompt: string, characterId: string, variant: string, error: string|null}>}
 */
export async function replicateGenerateCharacterRef(args) {
  const prompt = buildCharacterPrompt({
    characterId: args.characterId,
    variant: args.variant,
    customOverrides: args.customOverrides,
  });

  const genArgs = {
    prompt,
    aspect_ratio: '9:16',
    output_format: 'png',
  };
  if (args.referenceImage) genArgs.image = args.referenceImage;

  const result = await replicateGenerateImage(genArgs);

  // Post-process: chroma-key the green background
  let transparentB64 = null;
  if (result.images && result.images.length > 0) {
    try {
      transparentB64 = await chromaKeyRemoveGreen(result.images[0]);
    } catch (err) {
      // Non-fatal — still return the original image
      console.error('Chroma key failed:', err.message);
    }
  }

  return {
    ...result,
    transparentB64,
    prompt,
    characterId: args.characterId,
    variant: args.variant,
  };
}

/**
 * Get available character presets and variant options.
 */
export function getCharacterPresets() {
  return {
    characters: Object.entries(CHARACTER_PRESETS).map(([id, preset]) => ({
      id,
      name: preset.name,
    })),
    variants: Object.keys(VARIANT_CONFIGS),
  };
}

// ── Status ───────────────────────────────────────────────────────────

/**
 * Check if Replicate API token is configured.
 */
export function getReplicateStatus() {
  return {
    apiTokenConfigured: Boolean(REPLICATE_API_TOKEN()),
  };
}

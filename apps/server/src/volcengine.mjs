/**
 * Volcengine / ByteDance API client for image generation, video generation, and TTS.
 *
 * Three separate services:
 *   1. Image gen (Seedream)  – Ark platform, sync
 *   2. Video gen (Seedance)  – Ark platform, async task-based
 *   3. TTS                   – Speech platform, sync
 *
 * All functions are designed to be called from the tool invocation layer.
 * API keys are read from environment variables and never exposed to the client.
 */

// ── Configuration ────────────────────────────────────────────────────

const ARK_API_BASE =
  process.env.VOLCENGINE_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = () => process.env.VOLCENGINE_ARK_API_KEY || '';

const TTS_API_BASE =
  process.env.VOLCENGINE_TTS_BASE_URL || 'https://openspeech.bytedance.com/api/v1/tts';
const TTS_APP_ID = () => process.env.VOLCENGINE_TTS_APP_ID || '';
const TTS_ACCESS_TOKEN = () => process.env.VOLCENGINE_TTS_ACCESS_TOKEN || '';
const TTS_CLUSTER = () => process.env.VOLCENGINE_TTS_CLUSTER || 'volcano_tts';

// Default models – can be overridden per-request
const DEFAULT_IMAGE_MODEL = 'doubao-seedream-5-0-260128';
const DEFAULT_VIDEO_MODEL = 'doubao-seedance-1-5-pro-251215';
const DEFAULT_TTS_VOICE = 'BV700_V2_streaming';

// In-memory task store for tracking video generation jobs
const videoTasks = new Map();

// ── Helpers ──────────────────────────────────────────────────────────

function arkHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ARK_API_KEY()}`,
  };
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── 1. Image Generation (Seedream) ──────────────────────────────────

/**
 * Generate images from a text prompt.
 * Synchronous – returns image URLs directly.
 *
 * @param {object} args
 * @param {string} args.prompt           - Text description of the image
 * @param {string} [args.model]          - Model ID (default: doubao-seedream-4-5-251128)
 * @param {string} [args.size]           - '1K' | '2K' | '4K' (default: '2K')
 * @param {number} [args.n]             - Number of images 1-4 (default: 1)
 * @param {number} [args.seed]          - Random seed for reproducibility
 * @param {number} [args.guidanceScale] - Prompt adherence 1.0-20.0 (default: 7.5)
 * @param {string} [args.responseFormat] - 'url' | 'b64_json' (default: 'url')
 * @returns {Promise<{images: Array<{url?: string, b64Json?: string}>, model: string, seed?: number}>}
 */
export async function generateImage(args) {
  const apiKey = ARK_API_KEY();
  if (!apiKey) {
    throw new Error('VOLCENGINE_ARK_API_KEY is not configured');
  }

  const body = {
    model: args.model || DEFAULT_IMAGE_MODEL,
    prompt: args.prompt,
    size: args.size || '2K',
    n: Math.min(Math.max(args.n || 1, 1), 4),
    response_format: args.responseFormat || 'url',
    watermark: false,
  };

  if (args.seed != null) body.seed = args.seed;
  if (args.guidanceScale != null) body.guidance_scale = args.guidanceScale;

  const response = await fetch(`${ARK_API_BASE}/images/generations`, {
    method: 'POST',
    headers: arkHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Volcengine image API error (${response.status}): ${text}`);
  }

  const data = await response.json();

  return {
    images: (data.data || []).map((item) => ({
      url: item.url || undefined,
      b64Json: item.b64_json || undefined,
    })),
    model: body.model,
    seed: data.seed,
  };
}

// ── 2. Video Generation (Seedance) ──────────────────────────────────

/**
 * Create a video generation task (async).
 * Returns a task object with `id` and `status: 'queued'`.
 * Use `getVideoTask()` to poll for completion.
 *
 * @param {object} args
 * @param {string}   [args.model]         - Model ID
 * @param {Array}    args.content         - Content items [{type:'text',text:'...'}, {type:'image_url',imageUrl:'...'}]
 * @param {string}   [args.resolution]    - '480p' | '720p' | '1080p' | '2K'
 * @param {string}   [args.ratio]         - '16:9' | '9:16' | '4:3' | '1:1' etc.
 * @param {number}   [args.duration]      - Video length 4-15 seconds
 * @param {number}   [args.seed]          - Random seed
 * @param {boolean}  [args.generateAudio] - Generate audio track (Seedance 1.5+)
 * @param {string}   [args.serviceTier]   - 'default' | 'flex' (flex = 50% cheaper, slower)
 * @param {string}   [args.callbackUrl]   - Webhook URL for status updates
 * @returns {Promise<object>} Task object
 */
export async function createVideoTask(args) {
  const apiKey = ARK_API_KEY();
  if (!apiKey) {
    throw new Error('VOLCENGINE_ARK_API_KEY is not configured');
  }

  // Normalize content items to API format
  const content = (args.content || []).map((item) => {
    if (item.type === 'image_url') {
      return {
        type: 'image_url',
        image_url: { url: item.imageUrl || item.url },
      };
    }
    return { type: 'text', text: item.text };
  });

  const body = {
    model: args.model || DEFAULT_VIDEO_MODEL,
    content,
  };

  if (args.resolution) body.resolution = args.resolution;
  if (args.ratio) body.ratio = args.ratio;
  if (args.duration != null) body.duration = args.duration;
  if (args.seed != null) body.seed = args.seed;
  if (args.generateAudio != null) body.generate_audio = args.generateAudio;
  if (args.serviceTier) body.service_tier = args.serviceTier;
  if (args.callbackUrl) body.callback_url = args.callbackUrl;

  const response = await fetch(`${ARK_API_BASE}/contents/generations/tasks`, {
    method: 'POST',
    headers: arkHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Volcengine video API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const task = normalizeVideoTask(data);

  // Store in local task cache for tracking
  videoTasks.set(task.id, task);

  return task;
}

/**
 * Get the status of a video generation task.
 *
 * @param {string} taskId - Task ID from createVideoTask
 * @returns {Promise<object>} Updated task object
 */
export async function getVideoTask(taskId) {
  const apiKey = ARK_API_KEY();
  if (!apiKey) {
    throw new Error('VOLCENGINE_ARK_API_KEY is not configured');
  }

  const response = await fetch(`${ARK_API_BASE}/contents/generations/tasks/${taskId}`, {
    method: 'GET',
    headers: arkHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Volcengine video task query error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const task = normalizeVideoTask(data);

  // Update local cache
  videoTasks.set(task.id, task);

  return task;
}

/**
 * List video generation tasks.
 *
 * @param {object} [args]
 * @param {number} [args.limit]  - Max tasks to return (default: 20)
 * @param {string} [args.after]  - Cursor for pagination
 * @returns {Promise<{tasks: Array, hasMore: boolean}>}
 */
export async function listVideoTasks(args = {}) {
  const apiKey = ARK_API_KEY();
  if (!apiKey) {
    throw new Error('VOLCENGINE_ARK_API_KEY is not configured');
  }

  const params = new URLSearchParams();
  if (args.limit) params.set('limit', String(args.limit));
  if (args.after) params.set('after', args.after);

  const url = `${ARK_API_BASE}/contents/generations/tasks${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: arkHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Volcengine video task list error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const tasks = (data.data || []).map(normalizeVideoTask);

  // Update local cache
  for (const task of tasks) {
    videoTasks.set(task.id, task);
  }

  return {
    tasks,
    hasMore: data.has_more || false,
  };
}

/**
 * Poll a video task until completion or timeout.
 *
 * @param {string} taskId           - Task ID
 * @param {number} [intervalMs=3000] - Poll interval in ms
 * @param {number} [timeoutMs=300000] - Max wait time (5 min default)
 * @returns {Promise<object>} Completed task
 */
export async function waitForVideoTask(taskId, intervalMs = 3000, timeoutMs = 300000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const task = await getVideoTask(taskId);

    if (task.status === 'succeeded' || task.status === 'failed') {
      return task;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Video task ${taskId} timed out after ${timeoutMs}ms`);
}

function normalizeVideoTask(data) {
  return {
    id: data.id,
    model: data.model,
    status: data.status,
    videoUrl: data.content?.video_url || data.video_url || undefined,
    seed: data.seed,
    resolution: data.resolution,
    ratio: data.ratio,
    duration: data.duration,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    error: data.error || undefined,
  };
}

// ── 3. Text-to-Speech (Volcengine TTS) ──────────────────────────────

/**
 * Synthesize speech from text.
 * Synchronous – returns base64-encoded audio.
 *
 * @param {object} args
 * @param {string}  args.text        - Text to synthesize
 * @param {string}  [args.voiceType] - Voice ID (default: BV700_V2_streaming)
 * @param {string}  [args.encoding]  - 'mp3' | 'wav' | 'ogg' | 'pcm' (default: 'mp3')
 * @param {number}  [args.speedRatio] - 0.5-2.0 (default: 1.0)
 * @param {number}  [args.volumeRatio] - 0.5-2.0 (default: 1.0)
 * @param {number}  [args.pitchRatio]  - 0.5-2.0 (default: 1.0)
 * @param {string}  [args.emotion]     - Emotion style
 * @param {string}  [args.language]    - 'en' | 'cn' | 'ja' | 'ko'
 * @returns {Promise<{audioBase64: string, encoding: string}>}
 */
export async function synthesizeSpeech(args) {
  const appId = TTS_APP_ID();
  const accessToken = TTS_ACCESS_TOKEN();

  if (!appId || !accessToken) {
    throw new Error('VOLCENGINE_TTS_APP_ID and VOLCENGINE_TTS_ACCESS_TOKEN are required');
  }

  const encoding = args.encoding || 'mp3';

  const body = {
    app: {
      appid: appId,
      token: accessToken,
      cluster: TTS_CLUSTER(),
    },
    user: {
      uid: 'tong-server',
    },
    audio: {
      voice_type: args.voiceType || DEFAULT_TTS_VOICE,
      encoding,
      speed_ratio: args.speedRatio ?? 1.0,
      volume_ratio: args.volumeRatio ?? 1.0,
      pitch_ratio: args.pitchRatio ?? 1.0,
    },
    request: {
      reqid: uuid(),
      text: args.text,
      operation: 'query',
    },
  };

  if (args.emotion) {
    body.audio.emotion = args.emotion;
    body.audio.enable_emotion = true;
  }

  if (args.language) {
    body.audio.explicit_language = args.language;
    body.audio.context_language = args.language;
  }

  const response = await fetch(TTS_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer;${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Volcengine TTS API error (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.code !== 3000) {
    throw new Error(`Volcengine TTS error (code ${data.code}): ${data.message || 'unknown'}`);
  }

  return {
    audioBase64: data.data,
    encoding,
  };
}

// ── 4. Backdrop Generation (Hangout Scenes) ─────────────────────────

const BACKDROP_STYLE =
  'photorealistic, detailed environment, atmospheric lighting, ' +
  'no people, no characters, empty scene ready for character overlay, shallow depth of field, ' +
  'shot on Sony A7IV, 35mm lens, natural color grading, 9:16 portrait orientation';

const TIME_LIGHTING = {
  morning: 'soft golden morning light, long shadows, warm sunrise tones',
  day: 'bright natural daylight, clear sky, vibrant colors',
  afternoon: 'warm afternoon sun, amber tones, relaxed atmosphere',
  evening: 'orange-pink sunset glow, transitional lighting, golden hour',
  night: 'nighttime, warm artificial lighting, lanterns and neon glow, dark sky, cozy atmosphere',
  rain: 'overcast, rain falling, wet reflections on surfaces, moody grey tones, puddles',
};

const MOOD_MODIFIERS = {
  warm: 'warm color palette, inviting, comfortable',
  cool: 'cool blue tones, calm, serene',
  energetic: 'vibrant saturated colors, lively, bustling',
  melancholy: 'muted desaturated tones, quiet, reflective',
  mysterious: 'dramatic shadows, fog, dim lighting, intriguing',
  romantic: 'soft pink and purple tones, dreamy bokeh, fairy lights',
};

const LOCATION_PRESETS = {
  pojangmacha: {
    base: 'Korean pojangmacha street food tent, plastic stools, steaming pots on counter, soju bottles, snack menu hanging, narrow alley setting',
    defaultTime: 'night',
    defaultMood: 'warm',
  },
  cafe: {
    base: 'Modern Korean cafe interior, wooden tables, plants, large windows, coffee equipment on counter, aesthetic minimalist decor',
    defaultTime: 'afternoon',
    defaultMood: 'warm',
  },
  park: {
    base: 'Seoul city park, trees and benches, walking path, distant skyline, cherry blossom trees',
    defaultTime: 'day',
    defaultMood: 'cool',
  },
  subway: {
    base: 'Seoul subway station platform, clean tiled walls, route map, fluorescent lighting, numbered platform signs in Korean',
    defaultTime: 'day',
    defaultMood: 'energetic',
  },
  classroom: {
    base: 'Korean language school classroom, whiteboard with hangul, individual desks, bright fluorescent lights, study materials',
    defaultTime: 'day',
    defaultMood: 'cool',
  },
  convenience_store: {
    base: 'Korean convenience store interior, bright shelves, ramen section, kimbap counter, glass refrigerators',
    defaultTime: 'night',
    defaultMood: 'cool',
  },
  rooftop: {
    base: 'Seoul rooftop with city skyline view, string lights, folding chairs, small garden pots, Namsan Tower in distance',
    defaultTime: 'evening',
    defaultMood: 'romantic',
  },
  market: {
    base: 'Traditional Korean market, colorful stalls, hanging signs in Korean, dried goods, crowded alley, overhead tarps',
    defaultTime: 'day',
    defaultMood: 'energetic',
  },
  pc_bang: {
    base: 'Korean PC bang interior, rows of gaming monitors with RGB lighting, gaming chairs, dark ambient with screen glow',
    defaultTime: 'night',
    defaultMood: 'cool',
  },
  hanok: {
    base: 'Traditional Korean hanok courtyard, wooden columns, tiled roof, stone path, garden with pine trees',
    defaultTime: 'afternoon',
    defaultMood: 'warm',
  },
};

/**
 * Build a complete prompt from location/time/mood components.
 */
function buildBackdropPrompt({ location, customPrompt, timeOfDay, mood }) {
  const parts = [];

  if (location && LOCATION_PRESETS[location]) {
    const preset = LOCATION_PRESETS[location];
    parts.push(preset.base);
    timeOfDay = timeOfDay || preset.defaultTime;
    mood = mood || preset.defaultMood;
  } else if (customPrompt) {
    parts.push(customPrompt);
  }

  if (timeOfDay && TIME_LIGHTING[timeOfDay]) parts.push(TIME_LIGHTING[timeOfDay]);
  if (mood && MOOD_MODIFIERS[mood]) parts.push(MOOD_MODIFIERS[mood]);
  parts.push(BACKDROP_STYLE);

  return parts.join(', ');
}

/**
 * Generate a hangout backdrop image.
 *
 * @param {object} args
 * @param {string} [args.location]     - Preset location name (pojangmacha, cafe, park, etc.)
 * @param {string} [args.customPrompt] - Custom scene description (combined with location if both given)
 * @param {string} [args.timeOfDay]    - morning|day|afternoon|evening|night|rain
 * @param {string} [args.mood]         - warm|cool|energetic|melancholy|mysterious|romantic
 * @param {string} [args.model]        - Model ID override
 * @param {string} [args.size]         - WxH like '1440x2560' (default: 9:16 portrait)
 * @param {number} [args.seed]         - Random seed for reproducibility
 * @returns {Promise<{images: Array, model: string, prompt: string, location?: string}>}
 */
export async function generateBackdrop(args) {
  const prompt = buildBackdropPrompt({
    location: args.location,
    customPrompt: args.customPrompt,
    timeOfDay: args.timeOfDay,
    mood: args.mood,
  });

  const result = await generateImage({
    prompt,
    model: args.model,
    size: args.size || '1440x2560',
    seed: args.seed,
    responseFormat: args.responseFormat || 'url',
  });

  return {
    ...result,
    prompt,
    location: args.location || undefined,
  };
}

/**
 * Get available location presets and their defaults.
 */
export function getBackdropPresets() {
  return {
    locations: Object.entries(LOCATION_PRESETS).map(([id, preset]) => ({
      id,
      description: preset.base,
      defaultTime: preset.defaultTime,
      defaultMood: preset.defaultMood,
    })),
    timeOptions: Object.keys(TIME_LIGHTING),
    moodOptions: Object.keys(MOOD_MODIFIERS),
  };
}

// ── Exported helpers ─────────────────────────────────────────────────

/**
 * Get all locally tracked video tasks.
 * Useful for listing tasks without hitting the API.
 */
export function getCachedVideoTasks() {
  return [...videoTasks.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Check if Volcengine credentials are configured.
 */
export function getVolcengineStatus() {
  return {
    arkApiKeyConfigured: Boolean(ARK_API_KEY()),
    ttsAppIdConfigured: Boolean(TTS_APP_ID()),
    ttsAccessTokenConfigured: Boolean(TTS_ACCESS_TOKEN()),
    ttsCuster: TTS_CLUSTER(),
    defaultImageModel: DEFAULT_IMAGE_MODEL,
    defaultVideoModel: DEFAULT_VIDEO_MODEL,
    defaultTtsVoice: DEFAULT_TTS_VOICE,
  };
}

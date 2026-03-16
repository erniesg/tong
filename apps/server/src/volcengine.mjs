/**
 * Media generation API client — Volcengine (ByteDance) + ElevenLabs.
 *
 * Services:
 *   1. Image gen (Seedream)        – Volcengine Ark, sync
 *   2. Video gen (Seedance)        – Volcengine Ark, async task-based
 *   3. TTS (Volcengine)            – ByteDance Speech platform, sync
 *   4. Sound effects (ElevenLabs)  – Text → SFX, sync
 *   5. Music gen (ElevenLabs)      – Text → music, sync/streaming
 *   6. TTS (ElevenLabs)            – Text → speech, sync
 *
 * All functions are designed to be called from the tool invocation layer.
 * API keys are read from environment variables and never exposed to the client.
 */

// ── Configuration ────────────────────────────────────────────────────

// Volcengine / ByteDance
const ARK_API_BASE =
  process.env.VOLCENGINE_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = () => process.env.VOLCENGINE_ARK_API_KEY || '';

const TTS_API_BASE =
  process.env.VOLCENGINE_TTS_BASE_URL || 'https://openspeech.bytedance.com/api/v1/tts';
const TTS_APP_ID = () => process.env.VOLCENGINE_TTS_APP_ID || '';
const TTS_ACCESS_TOKEN = () => process.env.VOLCENGINE_TTS_ACCESS_TOKEN || '';
const TTS_CLUSTER = () => process.env.VOLCENGINE_TTS_CLUSTER || 'volcano_tts';

// ElevenLabs
const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE_URL || 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = () => process.env.ELEVENLABS_API_KEY || '';

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
 * Content modes:
 *   Text-to-video:     [{type:'text', text:'...'}]
 *   Image-to-video:    [{type:'text', text:'...'}, {type:'image_url', imageUrl:'...'}]
 *   First+last frame:  [{type:'text', text:'...'}, {type:'image_url', imageUrl:'first'}, {type:'image_url', imageUrl:'last'}]
 *   Reference images:  [{type:'text', text:'...'}, ...up to 4 {type:'image_url'}]
 *   From draft:        [{type:'draft_task', draftTaskId:'cgt-...'}]
 *
 * @param {object} args
 * @param {string}   [args.model]           - Model ID (default: doubao-seedance-1-5-pro-251215)
 * @param {Array}    args.content           - Content items (see modes above)
 * @param {string}   [args.resolution]      - '480p' | '720p' | '1080p' (default: '720p')
 * @param {string}   [args.ratio]           - '16:9' | '9:16' | '21:9' | '1:1' | 'adaptive' (default: '9:16')
 * @param {number}   [args.duration]        - Video length in seconds (default: 5)
 * @param {number}   [args.frames]          - Frame count (alternative to duration)
 * @param {number}   [args.seed]            - Random seed for reproducibility
 * @param {boolean}  [args.cameraFixed]     - Lock camera (useful for talking-head shots)
 * @param {boolean}  [args.returnLastFrame] - Return last frame for clip chaining
 * @param {boolean}  [args.generateAudio]   - Generate ambient audio (Seedance 1.5+)
 * @param {boolean}  [args.draft]           - Draft mode: 480p preview at ~60% cost, 7-day validity
 * @param {string}   [args.serviceTier]     - 'default' | 'flex' (flex = 50% cheaper, slower)
 * @param {string}   [args.callbackUrl]     - Webhook URL for status updates
 * @param {boolean}  [args.watermark]       - Add watermark (default: false)
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
    if (item.type === 'draft_task') {
      return {
        type: 'draft_task',
        draft_task: { id: item.draftTaskId || item.id },
      };
    }
    return { type: 'text', text: item.text };
  });

  const body = {
    model: args.model || DEFAULT_VIDEO_MODEL,
    content,
    ratio: args.ratio || '9:16',
    watermark: args.watermark ?? false,
  };

  if (args.resolution) body.resolution = args.resolution;
  if (args.duration != null) body.duration = args.duration;
  if (args.frames != null) body.frames = args.frames;
  if (args.seed != null) body.seed = args.seed;
  if (args.cameraFixed != null) body.camera_fixed = args.cameraFixed;
  if (args.returnLastFrame != null) body.return_last_frame = args.returnLastFrame;
  if (args.generateAudio != null) body.generate_audio = args.generateAudio;
  if (args.draft != null) body.draft = args.draft;
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
 * @param {number} [intervalMs=10000] - Poll interval in ms (API recommends 10s)
 * @param {number} [timeoutMs=600000] - Max wait time (10 min default)
 * @returns {Promise<object>} Completed task
 */
export async function waitForVideoTask(taskId, intervalMs = 10000, timeoutMs = 600000) {
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
    lastFrameUrl: data.content?.last_frame_url || undefined,
    seed: data.seed,
    resolution: data.resolution,
    ratio: data.ratio,
    duration: data.duration,
    fps: data.framespersecond || undefined,
    draft: data.draft || false,
    serviceTier: data.service_tier || 'default',
    usage: data.usage || undefined,
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

// ── 4. ElevenLabs Sound Effects ──────────────────────────────────────

function elevenlabsHeaders() {
  return {
    'Content-Type': 'application/json',
    'xi-api-key': ELEVENLABS_API_KEY(),
  };
}

/**
 * Generate a sound effect from a text description.
 *
 * @param {object} args
 * @param {string}  args.text             - Description of the sound effect
 * @param {number}  [args.durationSeconds] - 0.5–30 (auto if omitted)
 * @param {boolean} [args.loop]           - Seamlessly looping (v2 only)
 * @param {number}  [args.promptInfluence] - 0–1, prompt adherence (default: 0.3)
 * @param {string}  [args.outputFormat]   - e.g. 'mp3_44100_128' (default)
 * @returns {Promise<{audioBase64: string, format: string}>}
 */
export async function generateSoundEffect(args) {
  const apiKey = ELEVENLABS_API_KEY();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const body = {
    text: args.text,
    model_id: 'eleven_text_to_sound_v2',
  };

  if (args.durationSeconds != null) body.duration_seconds = args.durationSeconds;
  if (args.loop != null) body.loop = args.loop;
  if (args.promptInfluence != null) body.prompt_influence = args.promptInfluence;

  const format = args.outputFormat || 'mp3_44100_128';
  const url = `${ELEVENLABS_API_BASE}/sound-generation`;

  const response = await fetch(url, {
    method: 'POST',
    headers: elevenlabsHeaders(),
    body: JSON.stringify({ ...body, output_format: format }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs SFX API error (${response.status}): ${text}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    audioBase64: Buffer.from(buffer).toString('base64'),
    format,
  };
}

// ── 5. ElevenLabs Music Generation ──────────────────────────────────

/**
 * Generate music from a text prompt or composition plan.
 *
 * @param {object} args
 * @param {string}  [args.prompt]            - Simple text prompt (cannot combine with compositionPlan)
 * @param {object}  [args.compositionPlan]   - Structured plan with sections, styles, lyrics
 * @param {number}  [args.musicLengthMs]     - 3000–600000 ms (only with prompt)
 * @param {boolean} [args.forceInstrumental] - No vocals (default: false, only with prompt)
 * @param {number}  [args.seed]              - For reproducibility (only with compositionPlan)
 * @param {string}  [args.outputFormat]      - e.g. 'mp3_44100_128'
 * @returns {Promise<{audioBase64: string, format: string}>}
 */
export async function generateMusic(args) {
  const apiKey = ELEVENLABS_API_KEY();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const body = {
    model_id: 'music_v1',
  };

  if (args.prompt) {
    body.prompt = args.prompt;
    if (args.musicLengthMs != null) body.music_length_ms = args.musicLengthMs;
    if (args.forceInstrumental != null) body.force_instrumental = args.forceInstrumental;
  } else if (args.compositionPlan) {
    body.composition_plan = args.compositionPlan;
    if (args.seed != null) body.seed = args.seed;
  } else {
    throw new Error('Either prompt or compositionPlan is required');
  }

  const format = args.outputFormat || 'mp3_44100_128';
  const url = `${ELEVENLABS_API_BASE}/music`;

  const response = await fetch(url, {
    method: 'POST',
    headers: elevenlabsHeaders(),
    body: JSON.stringify({ ...body, output_format: format }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs Music API error (${response.status}): ${text}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    audioBase64: Buffer.from(buffer).toString('base64'),
    format,
  };
}

// ── 6. ElevenLabs Text-to-Speech ────────────────────────────────────

/**
 * Generate speech from text using ElevenLabs voices.
 *
 * @param {object} args
 * @param {string}  args.text            - Text to speak
 * @param {string}  args.voiceId         - ElevenLabs voice ID
 * @param {string}  [args.modelId]       - 'eleven_multilingual_v2' (default) | 'eleven_turbo_v2_5'
 * @param {string}  [args.languageCode]  - ISO 639-1 code (e.g. 'ko', 'ja', 'zh', 'en')
 * @param {number}  [args.stability]     - 0–1 (default ~0.5)
 * @param {number}  [args.similarityBoost] - 0–1 (default ~0.75)
 * @param {number}  [args.speed]         - Speech speed (1.0 = normal)
 * @param {string}  [args.outputFormat]  - e.g. 'mp3_44100_128'
 * @returns {Promise<{audioBase64: string, format: string}>}
 */
export async function elevenlabsTTS(args) {
  const apiKey = ELEVENLABS_API_KEY();
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  if (!args.voiceId) {
    throw new Error('voiceId is required for ElevenLabs TTS');
  }

  const body = {
    text: args.text,
    model_id: args.modelId || 'eleven_multilingual_v2',
  };

  if (args.languageCode) body.language_code = args.languageCode;

  const voiceSettings = {};
  if (args.stability != null) voiceSettings.stability = args.stability;
  if (args.similarityBoost != null) voiceSettings.similarity_boost = args.similarityBoost;
  if (args.speed != null) voiceSettings.speed = args.speed;
  if (Object.keys(voiceSettings).length > 0) body.voice_settings = voiceSettings;

  const format = args.outputFormat || 'mp3_44100_128';
  const url = `${ELEVENLABS_API_BASE}/text-to-speech/${args.voiceId}?output_format=${format}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: elevenlabsHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs TTS API error (${response.status}): ${text}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    audioBase64: Buffer.from(buffer).toString('base64'),
    format,
  };
}

// ── 7. Backdrop Generation (Hangout Scenes) ─────────────────────────

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
    elevenlabsApiKeyConfigured: Boolean(ELEVENLABS_API_KEY()),
    defaultImageModel: DEFAULT_IMAGE_MODEL,
    defaultVideoModel: DEFAULT_VIDEO_MODEL,
    defaultTtsVoice: DEFAULT_TTS_VOICE,
  };
}

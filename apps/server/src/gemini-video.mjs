/**
 * Video understanding via Google Gemini — upload, analyse, extract structured data.
 *
 * Services:
 *   1. File upload    – Gemini Files API (videos up to 20 GB, 48 h retention)
 *   2. Video analysis – Gemini generateContent with video + structured output
 *   3. Playtest analysis – session bundle → issues list with variable schema
 *
 * Cost guidance (Gemini 3.1 Pro, default resolution ~300 tok/s):
 *   5 min session ≈ 90 k input tokens ≈ $0.18
 *   Use Flash ($0.50/1M) for triage, Pro ($2/1M) for deep analysis.
 *
 * All functions are designed to be called from the tool invocation layer.
 * API key is read from GOOGLE_GEMINI_API_KEY env var.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Configuration ────────────────────────────────────────────────────

const GEMINI_API_KEY = () => process.env.GOOGLE_GEMINI_API_KEY || '';

const MODELS = {
  flash: 'gemini-3-flash-preview',
  pro: 'gemini-3.1-pro-preview',
};

const DEFAULT_MODEL = 'flash';

// Media resolution presets — tokens per video frame
// low: 70 tok/frame, medium: 70, high: 280, ultra_high: per-part
const MEDIA_RESOLUTIONS = ['media_resolution_low', 'media_resolution_medium', 'media_resolution_high'];

// In-memory file cache: localPath|url → { fileUri, displayName, expiresAt }
const fileCache = new Map();

// In-memory analysis results: analysisId → result
const analysisResults = new Map();

// ── Helpers ──────────────────────────────────────────────────────────

function geminiHeaders() {
  return { 'Content-Type': 'application/json' };
}

function apiBase() {
  return 'https://generativelanguage.googleapis.com';
}

function apiKey() {
  return GEMINI_API_KEY();
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── 1. File Upload (Files API) ──────────────────────────────────────

/**
 * Upload a video file to Gemini Files API for subsequent analysis.
 *
 * @param {object} args
 * @param {string} [args.filePath]     – Local file path to upload
 * @param {string} [args.url]          – Public URL to download and upload
 * @param {Buffer} [args.buffer]       – Raw video bytes (alternative to filePath/url)
 * @param {string} [args.mimeType]     – MIME type (default: video/webm)
 * @param {string} [args.displayName]  – Human-readable name
 * @returns {Promise<{ fileUri: string, displayName: string, mimeType: string, sizeBytes: number, expiresAt: string }>}
 */
export async function uploadVideo(args) {
  const key = apiKey();
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const mimeType = args.mimeType || 'video/webm';
  const displayName = args.displayName || `playtest-${Date.now()}`;

  // Check cache
  const cacheKey = args.filePath || args.url || displayName;
  const cached = fileCache.get(cacheKey);
  if (cached && new Date(cached.expiresAt) > new Date()) {
    return cached;
  }

  // Read file bytes
  let bytes;
  if (args.buffer) {
    bytes = args.buffer;
  } else if (args.filePath) {
    bytes = fs.readFileSync(args.filePath);
  } else if (args.url) {
    const urlRes = await fetch(args.url);
    if (!urlRes.ok) throw new Error(`Failed to fetch video from ${args.url}: ${urlRes.status}`);
    bytes = Buffer.from(await urlRes.arrayBuffer());
  } else {
    throw new Error('filePath, buffer, or url is required');
  }

  // Step 1: Start resumable upload
  const startRes = await fetch(
    `${apiBase()}/upload/v1beta/files?key=${key}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    },
  );

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Gemini upload start failed (${startRes.status}): ${text}`);
  }

  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('No upload URL returned from Gemini Files API');

  // Step 2: Upload the bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(bytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Gemini upload failed (${uploadRes.status}): ${text}`);
  }

  const result = await uploadRes.json();
  const file = result.file || result;

  // Step 3: Wait for processing
  const fileUri = file.uri || file.name;
  const fileName = file.name; // e.g. "files/abc123"
  let state = file.state;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes at 5s intervals

  while (state === 'PROCESSING' && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000));
    const checkRes = await fetch(
      `${apiBase()}/v1beta/${fileName}?key=${key}`,
    );
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      state = checkData.state;
      if (state === 'ACTIVE') break;
      if (state === 'FAILED') throw new Error(`Video processing failed: ${JSON.stringify(checkData)}`);
    }
    attempts++;
  }

  if (state === 'PROCESSING') {
    throw new Error('Video processing timed out after 5 minutes');
  }

  const entry = {
    fileUri: file.uri,
    fileName,
    displayName,
    mimeType,
    sizeBytes: bytes.length,
    expiresAt: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(), // ~47h
  };

  fileCache.set(cacheKey, entry);
  return entry;
}

/**
 * List uploaded files still active on Gemini.
 */
export async function listUploadedFiles() {
  const key = apiKey();
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const res = await fetch(`${apiBase()}/v1beta/files?key=${key}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini list files failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Delete an uploaded file.
 */
export async function deleteUploadedFile(fileName) {
  const key = apiKey();
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const res = await fetch(`${apiBase()}/v1beta/${fileName}?key=${key}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini delete file failed (${res.status}): ${text}`);
  }
  return { deleted: true, fileName };
}

// ── 2. Video Analysis ───────────────────────────────────────────────

/**
 * Analyse a video using Gemini multimodal understanding.
 *
 * @param {object} args
 * @param {string} args.fileUri            – Gemini file URI from uploadVideo()
 * @param {string} args.prompt             – Analysis prompt
 * @param {string} [args.model]            – 'flash' | 'pro' (default: flash)
 * @param {string} [args.mediaResolution]  – 'low' | 'medium' | 'high' (default: low)
 * @param {object} [args.responseSchema]   – JSON Schema for structured output
 * @param {string} [args.context]          – Additional text context (e.g. annotations JSON)
 * @returns {Promise<{ analysisId: string, model: string, result: object|string, tokensUsed: object }>}
 */
export async function analyzeVideo(args) {
  const key = apiKey();
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const modelKey = args.model || DEFAULT_MODEL;
  const modelId = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
  const mediaRes = args.mediaResolution
    ? `media_resolution_${args.mediaResolution}`
    : 'media_resolution_low';

  // Build contents
  const parts = [
    { file_data: { file_uri: args.fileUri, mime_type: 'video/webm' } },
  ];

  // Add context (annotations, comments) as text if provided
  if (args.context) {
    parts.push({ text: `Context from playtest session:\n${args.context}` });
  }

  parts.push({ text: args.prompt });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      mediaResolution: mediaRes,
    },
  };

  // Add structured output schema if provided
  if (args.responseSchema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = args.responseSchema;
  }

  const res = await fetch(
    `${apiBase()}/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini analysis failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Extract response
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text || '';
  const tokensUsed = data.usageMetadata || {};

  let parsed = content;
  if (args.responseSchema) {
    try {
      parsed = JSON.parse(content);
    } catch {
      // If structured output fails to parse, return raw
      parsed = content;
    }
  }

  const analysisId = `analysis-${uuid()}`;
  const result = {
    analysisId,
    model: modelId,
    result: parsed,
    tokensUsed: {
      inputTokens: tokensUsed.promptTokenCount || 0,
      outputTokens: tokensUsed.candidatesTokenCount || 0,
      totalTokens: tokensUsed.totalTokenCount || 0,
    },
    createdAt: new Date().toISOString(),
  };

  analysisResults.set(analysisId, result);
  return result;
}

// ── 3. Playtest Session Analysis ────────────────────────────────────

/**
 * Predefined analysis schemas for common playtest scenarios.
 */
export const ANALYSIS_PRESETS = {
  ux_friction: {
    name: 'UX Friction Analysis',
    description: 'Identify moments where the user appears confused, stuck, or frustrated',
    prompt: `Analyze this playtest recording of a language learning game. Identify all moments where the user appears to experience friction, confusion, or frustration.

For each issue found:
- Note the exact timestamp
- Describe what was happening on screen
- Categorize the issue type
- Suggest a specific fix
- Rate severity (1=minor annoyance, 5=blocking)

Also consider the annotation comments provided as context — the user marked these moments themselves.`,
    schema: {
      type: 'object',
      properties: {
        sessionSummary: {
          type: 'string',
          description: 'Brief summary of the overall session',
        },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', description: 'MM:SS format' },
              category: {
                type: 'string',
                enum: ['ui_layout', 'navigation', 'content', 'translation', 'exercise_ux', 'performance', 'accessibility', 'onboarding', 'unclear_instruction', 'bug'],
              },
              severity: { type: 'integer', minimum: 1, maximum: 5 },
              description: { type: 'string' },
              whatUserExpected: { type: 'string' },
              whatActuallyHappened: { type: 'string' },
              suggestedFix: { type: 'string' },
              autoFixable: { type: 'boolean', description: 'Can this be fixed programmatically without design decisions?' },
              affectedComponent: { type: 'string', description: 'Best guess at which UI component is involved' },
            },
            required: ['timestamp', 'category', 'severity', 'description', 'suggestedFix', 'autoFixable'],
          },
        },
        overallScore: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Overall session quality score',
        },
        topPriority: {
          type: 'string',
          description: 'The single most impactful fix to make',
        },
      },
      required: ['sessionSummary', 'issues', 'overallScore', 'topPriority'],
    },
  },

  translation_quality: {
    name: 'Translation Quality Review',
    description: 'Review accuracy and naturalness of in-game translations',
    prompt: `Review this playtest recording focusing specifically on the translations and language content shown in the game.

For each translation issue:
- Note the timestamp and what text was shown
- Identify whether it's a mistranslation, unnatural phrasing, missing context, or wrong register
- Provide the corrected version
- Note which language pair is affected`,
    schema: {
      type: 'object',
      properties: {
        languagePair: { type: 'string' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              originalText: { type: 'string' },
              shownTranslation: { type: 'string' },
              issueType: {
                type: 'string',
                enum: ['mistranslation', 'unnatural', 'wrong_register', 'missing_context', 'romanization_error', 'missing_tooltip'],
              },
              correctedVersion: { type: 'string' },
              explanation: { type: 'string' },
            },
            required: ['timestamp', 'originalText', 'issueType', 'correctedVersion'],
          },
        },
        overallQuality: {
          type: 'string',
          enum: ['excellent', 'good', 'needs_work', 'poor'],
        },
      },
      required: ['languagePair', 'issues', 'overallQuality'],
    },
  },

  content_engagement: {
    name: 'Content Engagement Analysis',
    description: 'Analyze which content keeps users engaged vs causes drop-off',
    prompt: `Analyze this playtest recording to understand user engagement patterns.

Track:
- Which scenes/exercises held attention (user actively participating)
- Which moments caused hesitation or disengagement (long pauses, random tapping)
- How the user interacted with characters and dialogue choices
- Whether the difficulty progression felt right

Consider the user's annotations as direct feedback.`,
    schema: {
      type: 'object',
      properties: {
        engagementTimeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startTime: { type: 'string' },
              endTime: { type: 'string' },
              engagement: { type: 'string', enum: ['high', 'medium', 'low', 'disengaged'] },
              activity: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['startTime', 'endTime', 'engagement', 'activity'],
          },
        },
        peakMoments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Timestamps of highest engagement',
        },
        dropOffMoments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Timestamps where engagement dropped',
        },
        difficultyAssessment: {
          type: 'string',
          enum: ['too_easy', 'just_right', 'slightly_hard', 'too_hard'],
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['engagementTimeline', 'peakMoments', 'dropOffMoments', 'difficultyAssessment', 'recommendations'],
    },
  },

  scene_decomposition: {
    name: 'Scene Decomposition',
    description: 'Decompose a video into timestamped scenes with visual type, audio layer, automation difficulty, and overall hook/format analysis',
    prompt: 'Analyze this video and decompose it into individual scenes/segments. For each scene identify: the visual type (talking_head, text_overlay, product_shot, data_viz, b_roll, screen_recording, split_screen, transition, outro_cta), the audio layer (voiceover, trending_sound, original_music, silence, speech), any text/overlay content visible, the visual style, and how automatable this scene would be (trivial = can generate with Remotion/text-to-video, moderate = needs some stock footage, hard = needs original human footage). Also identify the hook technique used in the first 3 seconds and the overall content format.',
    schema: {
      type: 'OBJECT',
      properties: {
        hookTechnique: { type: 'STRING', description: 'How the video hooks viewers in first 3 seconds' },
        contentFormat: { type: 'STRING', description: 'Overall format: tutorial, storytime, challenge, POV, review, etc.' },
        totalDurationEstimate: { type: 'INTEGER' },
        scenes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              startTimestamp: { type: 'STRING', description: 'MM:SS' },
              endTimestamp: { type: 'STRING', description: 'MM:SS' },
              sceneType: { type: 'STRING', description: 'talking_head|text_overlay|product_shot|data_viz|b_roll|screen_recording|split_screen|transition|outro_cta' },
              audioLayer: { type: 'STRING', description: 'voiceover|trending_sound|original_music|silence|speech|mixed' },
              textContent: { type: 'STRING', description: 'Any visible text/overlay content' },
              visualStyle: { type: 'STRING', description: 'Brief description of visual aesthetic' },
              automationDifficulty: { type: 'STRING', description: 'trivial|moderate|hard' },
              description: { type: 'STRING', description: 'What happens in this scene' },
            },
            required: ['startTimestamp', 'endTimestamp', 'sceneType', 'audioLayer', 'automationDifficulty', 'description'],
          },
        },
        audioSummary: {
          type: 'OBJECT',
          properties: {
            hasVoiceover: { type: 'BOOLEAN' },
            hasTrendingSound: { type: 'BOOLEAN' },
            language: { type: 'STRING' },
            transcript: { type: 'STRING', description: 'Brief transcript or summary of speech content' },
          },
        },
        automatabilityScore: { type: 'INTEGER', description: '0-100 how much of this video could be auto-generated' },
      },
      required: ['hookTechnique', 'contentFormat', 'scenes', 'automatabilityScore'],
    },
  },

  trend_analysis: {
    name: 'Social Media Trend Analysis',
    description: 'Analyze scraped social media videos for trend patterns',
    prompt: `Analyze this social media video to extract trend patterns useful for creating marketing content for a language learning game.

Identify:
- The hook technique used in the first 3 seconds
- Content format/structure (e.g. "POV", "storytime", "before/after")
- Music/sound usage and timing
- Caption style and placement
- Engagement triggers (questions, challenges, relatable moments)
- Visual aesthetic (color grading, transitions, text overlays)
- How this format could be adapted for language learning content`,
    schema: {
      type: 'object',
      properties: {
        hookTechnique: { type: 'string' },
        contentFormat: { type: 'string' },
        duration: { type: 'integer', description: 'Estimated seconds' },
        soundUsage: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['trending_sound', 'original_audio', 'voiceover', 'music_only', 'mixed'] },
            description: { type: 'string' },
          },
        },
        captionStyle: { type: 'string' },
        visualAesthetic: { type: 'string' },
        engagementTriggers: { type: 'array', items: { type: 'string' } },
        adaptationIdeas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              idea: { type: 'string' },
              platform: { type: 'string', enum: ['tiktok', 'instagram', 'xiaohongshu', 'x'] },
              estimatedEffort: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
          },
        },
      },
      required: ['hookTechnique', 'contentFormat', 'visualAesthetic', 'adaptationIdeas'],
    },
  },
};

/**
 * Analyse a playtest session — pulls recording + annotations, sends to Gemini.
 *
 * @param {object} args
 * @param {string} args.sessionId          – Playtest session ID
 * @param {string} [args.analysisType]     – Preset key: 'ux_friction' | 'translation_quality' | 'content_engagement' | 'trend_analysis'
 * @param {object} [args.customSchema]     – Custom JSON Schema (overrides preset)
 * @param {string} [args.customPrompt]     – Custom prompt (overrides preset)
 * @param {string} [args.model]            – 'flash' | 'pro'
 * @param {string} [args.mediaResolution]  – 'low' | 'medium' | 'high'
 * @param {string} [args.videoPath]        – Direct path to video file (if not using R2)
 * @param {string} [args.annotationsJson]  – Annotations as JSON string
 * @param {string} [args.commentsJson]     – Comments as JSON string
 * @returns {Promise<object>}
 */
export async function analyzePlaytestSession(args) {
  const preset = args.analysisType ? ANALYSIS_PRESETS[args.analysisType] : null;

  const prompt = args.customPrompt || preset?.prompt || ANALYSIS_PRESETS.ux_friction.prompt;
  const schema = args.customSchema || preset?.schema || ANALYSIS_PRESETS.ux_friction.schema;

  // Build context from annotations + comments
  const contextParts = [];
  if (args.annotationsJson) {
    contextParts.push(`User annotations (drawn highlights/pins):\n${args.annotationsJson}`);
  }
  if (args.commentsJson) {
    contextParts.push(`User comments (with AI clarifications):\n${args.commentsJson}`);
  }

  // If we have a video file, upload it first
  let fileUri = args.fileUri;
  if (!fileUri && args.videoPath) {
    const uploaded = await uploadVideo({
      filePath: args.videoPath,
      displayName: `playtest-${args.sessionId}`,
      mimeType: args.videoPath.endsWith('.mp4') ? 'video/mp4' : 'video/webm',
    });
    fileUri = uploaded.fileUri;
  }
  if (!fileUri && args.videoUrl) {
    const uploaded = await uploadVideo({
      url: args.videoUrl,
      displayName: `playtest-${args.sessionId}`,
      mimeType: args.videoUrl.endsWith('.mp4') ? 'video/mp4' : 'video/webm',
    });
    fileUri = uploaded.fileUri;
  }

  if (!fileUri) {
    throw new Error('No video file provided — supply fileUri, videoPath, or videoUrl');
  }

  return analyzeVideo({
    fileUri,
    prompt,
    model: args.model || (preset === ANALYSIS_PRESETS.ux_friction ? 'pro' : 'flash'),
    mediaResolution: args.mediaResolution || 'low',
    responseSchema: schema,
    context: contextParts.join('\n\n') || undefined,
  });
}

// ── 3b. Screenshot Gallery Analysis ─────────────────────────────────

/**
 * Analyse a playtest session using annotated screenshots instead of video.
 * ~70% cheaper than video analysis: inline images skip the Files API.
 *
 * @param {object} args
 * @param {string} args.sessionId
 * @param {Array<{url: string, timestamp: number, type: string, text?: string, id: string}>} args.screenshots
 * @param {string} [args.annotationsJson]
 * @param {string} [args.commentsJson]
 * @param {string} [args.analysisType]
 * @param {object} [args.customSchema]
 * @param {string} [args.customPrompt]
 * @param {string} [args.model]
 * @returns {Promise<object>}
 */
export async function analyzePlaytestScreenshots(args) {
  const key = apiKey();
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const preset = args.analysisType ? ANALYSIS_PRESETS[args.analysisType] : null;
  const prompt = args.customPrompt || preset?.prompt || ANALYSIS_PRESETS.ux_friction.prompt;
  const schema = args.customSchema || preset?.schema || ANALYSIS_PRESETS.ux_friction.schema;

  // Build parts: alternating screenshot images + annotation context
  const parts = [];

  for (const ss of args.screenshots) {
    // Fetch screenshot and encode as inline base64
    const res = await fetch(ss.url);
    if (!res.ok) {
      console.warn(`[gemini] Failed to fetch screenshot ${ss.id}: ${res.status}`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    parts.push({
      inline_data: { mime_type: 'image/png', data: buffer.toString('base64') },
    });
    const label = ss.type === 'comment'
      ? `[Screenshot at ${ss.timestamp}s — comment: "${ss.text}"]`
      : `[Screenshot at ${ss.timestamp}s — ${ss.type} annotation]`;
    parts.push({ text: label });
  }

  if (parts.length === 0) {
    throw new Error('No screenshots available for analysis');
  }

  // Add full annotations + comments context
  if (args.annotationsJson) {
    parts.push({ text: `Full annotation data:\n${args.annotationsJson}` });
  }
  if (args.commentsJson) {
    parts.push({ text: `User comments:\n${args.commentsJson}` });
  }

  parts.push({ text: prompt });

  const modelId = MODELS[args.model || DEFAULT_MODEL];
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  const res = await fetch(
    `${apiBase()}/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini screenshot analysis failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text || '';
  const tokensUsed = data.usageMetadata || {};

  let parsed = content;
  try { parsed = JSON.parse(content); } catch { /* raw text fallback */ }

  const analysisId = `analysis-${uuid()}`;
  const result = {
    analysisId,
    model: modelId,
    mode: 'screenshots',
    screenshotCount: args.screenshots.length,
    result: parsed,
    tokensUsed: {
      inputTokens: tokensUsed.promptTokenCount || 0,
      outputTokens: tokensUsed.candidatesTokenCount || 0,
      totalTokens: tokensUsed.totalTokenCount || 0,
    },
    createdAt: new Date().toISOString(),
  };

  analysisResults.set(analysisId, result);
  return result;
}

// ── 4. Status & Utilities ───────────────────────────────────────────

/**
 * Check Gemini API configuration status.
 */
export function getGeminiVideoStatus() {
  return {
    apiKeyConfigured: Boolean(GEMINI_API_KEY()),
    models: MODELS,
    defaultModel: DEFAULT_MODEL,
    cachedFiles: fileCache.size,
    analysisResults: analysisResults.size,
    presets: Object.keys(ANALYSIS_PRESETS),
  };
}

/**
 * Get a cached analysis result by ID.
 */
export function getAnalysisResult(analysisId) {
  return analysisResults.get(analysisId) || null;
}

/**
 * List all cached analysis results.
 */
export function listAnalysisResults() {
  return [...analysisResults.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
}

/**
 * List available analysis presets.
 */
export function listAnalysisPresets() {
  return Object.entries(ANALYSIS_PRESETS).map(([key, p]) => ({
    key,
    name: p.name,
    description: p.description,
  }));
}

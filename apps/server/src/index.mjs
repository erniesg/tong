import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeneratedSnapshot, runMockIngestion, writeGeneratedSnapshots } from './ingestion.mjs';
import {
  generateImage,
  generateBackdrop,
  getBackdropPresets,
  createVideoTask,
  getVideoTask,
  waitForVideoTask,
  listVideoTasks,
  synthesizeSpeech,
  generateSoundEffect,
  generateMusic,
  elevenlabsTTS,
  getVolcengineStatus,
} from './volcengine.mjs';
import {
  getReplicateStatus,
  replicateGenerateImage,
  replicateGenerateVideo,
  replicateGetPrediction,
  replicateCancelPrediction,
  replicateGenerateMusic,
  replicateGenerateCharacterRef,
  getCharacterPresets,
  handleReplicateWebhook,
  replicateWaitForPrediction,
} from './replicate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const PORT = Number(process.env.PORT || 8787);
const DEMO_PASSWORD = String(process.env.TONG_DEMO_PASSWORD || '').trim();

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const FIXTURES = {
  captions: loadJson('packages/contracts/fixtures/captions.enriched.sample.json'),
  dictionary: loadJson('packages/contracts/fixtures/dictionary.entry.sample.json'),
  frequency: loadJson('packages/contracts/fixtures/vocab.frequency.sample.json'),
  insights: loadJson('packages/contracts/fixtures/vocab.insights.sample.json'),
  gameStart: loadJson('packages/contracts/fixtures/game.start-or-resume.sample.json'),
  objectivesNext: loadJson('packages/contracts/fixtures/objectives.next.sample.json'),
  sceneFoodHangout: loadJson('packages/contracts/fixtures/scene.food-hangout.sample.json'),
  learnSessions: loadJson('packages/contracts/fixtures/learn.sessions.sample.json'),
  mediaProfile: loadJson('packages/contracts/fixtures/player.media-profile.sample.json'),
};

const mockMediaWindowPath = path.join(repoRoot, 'apps/server/data/mock-media-window.json');
const DEFAULT_USER_ID = 'demo-user-1';
const PROFICIENCY_RANK = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  native: 4,
};
const CLUSTER_CITY_MAP = {
  'food-ordering': 'seoul',
  'performance-energy': 'shanghai',
  'city-social': 'tokyo',
  general: 'seoul',
};
const CLUSTER_LOCATION_MAP = {
  'food-ordering': 'food_street',
  'performance-energy': 'practice_studio',
  'city-social': 'subway_hub',
  general: 'food_street',
};
const LANG_TARGETS = {
  ko: {
    grammar: ['-고 싶어요', '-주세요'],
    sentenceStructures: ['N + 주세요', 'N이/가 + adjective'],
  },
  ja: {
    grammar: ['〜たいです', '〜ください'],
    sentenceStructures: ['N を ください', 'N は adjective です'],
  },
  zh: {
    grammar: ['想 + verb', '请 + verb'],
    sentenceStructures: ['请给我 + N', 'N 很 + adjective'],
  },
};
const DEFAULT_OBJECTIVE_BY_LANG = {
  ko: 'ko_food_l2_001',
  ja: 'ko_city_l2_003',
  zh: 'zh_stage_l3_002',
};
const INGESTION_SOURCES = new Set(['youtube', 'spotify']);

const DICTIONARY_OVERRIDES = {
  '오늘': {
    term: '오늘',
    lang: 'ko',
    meaning: 'today',
    examples: ['오늘 뭐 먹을까?'],
    crossCjk: { zhHans: '今天', ja: '今日' },
    readings: { ko: 'oneul', zhPinyin: 'jin tian', jaRomaji: 'kyou' },
  },
  '먹을까': {
    term: '먹다',
    lang: 'ko',
    meaning: 'to eat; shall we eat?',
    examples: ['같이 먹을까?'],
    crossCjk: { zhHans: '吃', ja: '食べる' },
    readings: { ko: 'meokda', zhPinyin: 'chi', jaRomaji: 'taberu' },
  },
  '주문': {
    term: '주문',
    lang: 'ko',
    meaning: 'order (food/item)',
    examples: ['주문 도와드릴까요?'],
    crossCjk: { zhHans: '点餐', ja: '注文' },
    readings: { ko: 'jumun', zhPinyin: 'dian can', jaRomaji: 'chuumon' },
  },
};

const state = {
  profiles: new Map(),
  sessions: new Map(),
  learnSessions: [...(FIXTURES.learnSessions.items || [])],
  ingestionByUser: new Map(),
};

const AGENT_TOOL_DEFINITIONS = [
  {
    name: 'ingestion.run_mock',
    description: 'Run mock ingestion and refresh frequency/insight/media-profile signals for a user.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      profile: 'object (optional)',
      includeSources: ['youtube', 'spotify'],
    },
  },
  {
    name: 'ingestion.snapshot.get',
    description: 'Get current source items for a user to validate ingestible transcript/lyric text signals.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      includeSources: ['youtube', 'spotify'],
    },
  },
  {
    name: 'player.media_profile.get',
    description: 'Fetch computed media profile used by game personalization.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'vocab.frequency.get',
    description: 'Fetch 3-day vocab frequency rankings.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'vocab.insights.get',
    description: 'Fetch topic clusters and objective links from ingestion.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      lang: 'ko|ja|zh (optional)',
    },
  },
  {
    name: 'objectives.next.get',
    description: 'Get next objective for learn/hangout mode.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      mode: 'hangout|learn (optional)',
      lang: 'ko|ja|zh (optional)',
    },
  },
  // ── Volcengine / ByteDance tools ──────────────────────────────
  {
    name: 'volcengine.status',
    description: 'Check Volcengine API credential configuration status.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'volcengine.backdrop.generate',
    description: 'Generate a hangout scene backdrop using location presets with time-of-day and mood. Uses Seedream 5.0 with VN-style prompt templates.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      location: 'string (optional) – preset: pojangmacha|cafe|park|subway|classroom|convenience_store|rooftop|market|pc_bang|hanok',
      customPrompt: 'string (optional) – custom scene description, combined with location if both given',
      timeOfDay: 'morning|day|afternoon|evening|night|rain (optional, defaults from preset)',
      mood: 'warm|cool|energetic|melancholy|mysterious|romantic (optional, defaults from preset)',
      model: 'string (optional) – model ID, default doubao-seedream-5-0-260128',
      size: 'string (optional) – WxH e.g. "1440x2560" (default: 9:16 portrait 1440x2560)',
      seed: 'number (optional) – for reproducibility',
    },
  },
  {
    name: 'volcengine.backdrop.presets',
    description: 'List available backdrop location presets, time-of-day options, and mood options.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'volcengine.image.generate',
    description: 'Generate images from a text prompt using ByteDance Seedream model.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      prompt: 'string (required) – description of the image to generate',
      model: 'string (optional) – model ID, default doubao-seedream-5-0-260128',
      size: '1K|2K|4K (optional, default 2K)',
      n: 'number 1-4 (optional, default 1)',
      seed: 'number (optional) – for reproducibility',
      guidanceScale: 'number 1.0-20.0 (optional, default 7.5)',
      responseFormat: 'url|b64_json (optional, default url)',
    },
  },
  {
    name: 'volcengine.video.create',
    description: 'Create a video generation task using ByteDance Seedance. Supports text-to-video, image-to-video (first frame), first+last frame transitions, reference images (1-4 for style consistency), and draft-to-full promotion. Default 9:16 portrait. Returns task ID for polling.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      content: 'array (required) – content items. Modes: [{type:"text",text:"..."}] for text-to-video | add {type:"image_url",imageUrl:"..."} for first frame | add two image_urls for first+last frame | up to 4 image_urls for reference | [{type:"draft_task",draftTaskId:"cgt-..."}] to promote draft',
      model: 'string (optional) – model ID, default doubao-seedance-1-5-pro-251215',
      resolution: '480p|720p|1080p (optional, default 720p)',
      ratio: '16:9|9:16|21:9|1:1|adaptive (optional, default 9:16)',
      duration: 'number (optional) – video length in seconds (default 5)',
      frames: 'number (optional) – frame count (alternative to duration)',
      seed: 'number (optional) – for reproducibility',
      cameraFixed: 'boolean (optional) – lock camera for talking-head shots',
      returnLastFrame: 'boolean (optional) – return last frame URL for clip chaining',
      generateAudio: 'boolean (optional) – generate ambient audio track',
      draft: 'boolean (optional) – draft mode: 480p preview at ~60% cost, 7-day validity, no last frame',
      serviceTier: 'default|flex (optional) – flex is 50% cheaper but slower',
      callbackUrl: 'string (optional) – webhook URL for status updates',
      watermark: 'boolean (optional, default false)',
    },
  },
  {
    name: 'volcengine.video.get',
    description: 'Get the status and result of a video generation task. Status: queued → running → succeeded|failed. Response includes videoUrl, lastFrameUrl (if returnLastFrame was set), usage tokens, seed.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      taskId: 'string (required) – task ID from volcengine.video.create',
    },
  },
  {
    name: 'volcengine.video.wait',
    description: 'Poll a video task until succeeded or failed. Blocks up to 10 minutes, polling every 10s. Returns the completed task with videoUrl. Use for synchronous workflows.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      taskId: 'string (required) – task ID from volcengine.video.create',
      intervalMs: 'number (optional, default 10000) – poll interval in ms',
      timeoutMs: 'number (optional, default 600000) – max wait time in ms',
    },
  },
  {
    name: 'volcengine.video.list',
    description: 'List video generation tasks with their statuses. Tasks auto-delete after 24h.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      limit: 'number (optional, default 20)',
      after: 'string (optional) – pagination cursor',
    },
  },
  {
    name: 'volcengine.tts.synthesize',
    description: 'Synthesize speech from text using ByteDance TTS. Returns base64-encoded audio.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      text: 'string (required) – text to speak',
      voiceType: 'string (optional) – voice ID, default BV700_V2_streaming',
      encoding: 'mp3|wav|ogg|pcm (optional, default mp3)',
      speedRatio: 'number 0.5-2.0 (optional, default 1.0)',
      volumeRatio: 'number 0.5-2.0 (optional, default 1.0)',
      pitchRatio: 'number 0.5-2.0 (optional, default 1.0)',
      emotion: 'string (optional) – e.g. happy, sad, energetic',
      language: 'en|cn|ja|ko (optional)',
    },
  },
  // ── ElevenLabs tools ──────────────────────────────────────────
  {
    name: 'elevenlabs.sfx.generate',
    description: 'Generate a sound effect from a text description using ElevenLabs. Returns base64 audio. Great for ambient loops per location (e.g. "Korean street food stall sizzling, chatter, night traffic"), UI sounds, or scene transitions.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      text: 'string (required) – description of the sound effect',
      durationSeconds: 'number 0.5-30 (optional) – auto if omitted',
      loop: 'boolean (optional) – seamlessly looping audio (v2 model)',
      promptInfluence: 'number 0-1 (optional, default 0.3) – higher = more prompt adherence',
      outputFormat: 'string (optional, default mp3_44100_128)',
    },
  },
  {
    name: 'elevenlabs.music.generate',
    description: 'Generate music from a text prompt or structured composition plan using ElevenLabs. Returns base64 audio. For BGM per location/mood, character themes, scene transitions. 3s–5min duration. Paid tier required.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      prompt: 'string (optional) – simple text prompt like "lo-fi Korean cafe vibes, warm acoustic guitar". Cannot combine with compositionPlan',
      compositionPlan: 'object (optional) – structured plan with positiveGlobalStyles, negativeGlobalStyles, sections[]. Cannot combine with prompt',
      musicLengthMs: 'number 3000-600000 (optional) – only with prompt mode',
      forceInstrumental: 'boolean (optional, default false) – no vocals, only with prompt',
      seed: 'number (optional) – for reproducibility, only with compositionPlan',
      outputFormat: 'string (optional, default mp3_44100_128)',
    },
  },
  {
    name: 'elevenlabs.tts.speak',
    description: 'Generate speech from text using ElevenLabs voices. Multilingual with natural intonation. Returns base64 audio. Use for character voice lines (haeun, jin) in cinematic clips or dialogue.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      text: 'string (required) – text to speak',
      voiceId: 'string (required) – ElevenLabs voice ID',
      modelId: 'string (optional) – eleven_multilingual_v2 (default) | eleven_turbo_v2_5',
      languageCode: 'string (optional) – ISO 639-1 code: ko, ja, zh, en',
      stability: 'number 0-1 (optional) – emotional range',
      similarityBoost: 'number 0-1 (optional) – voice fidelity',
      speed: 'number (optional) – speech speed, 1.0 = normal',
      outputFormat: 'string (optional, default mp3_44100_128)',
    },
  },
  // ── Replicate tools ───────────────────────────────────────────
  {
    name: 'replicate.status',
    description: 'Check if Replicate API token is configured.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'replicate.image.generate',
    description: 'Generate images using Google Nano Banana 2 via Replicate. Sync mode (~20-30s). Returns image URLs directly.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      prompt: 'string (required) – description of the image to generate',
      image: 'string (optional) – input image URL for img2img',
      aspect_ratio: '1:1|16:9|9:16|4:3|3:4|3:2|2:3 (optional, default 1:1)',
      output_format: 'png|jpg|webp (optional, default png)',
      output_resolution: 'auto|1024|2048 (optional, default auto)',
      number_of_images: 'number 1-4 (optional, default 1)',
    },
  },
  {
    name: 'replicate.video.create',
    description: 'Create a video using Google Veo 3.1 Fast via Replicate. Async (~60-120s) – returns prediction ID for polling.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      prompt: 'string (required) – description of the video to generate',
      image: 'string (optional) – input image URL for img2vid',
      duration: '4|6|8 (optional, default 8) – video length in seconds',
      resolution: '720p|1080p (optional, default 720p)',
      aspect_ratio: '16:9|9:16 (optional, default 16:9)',
    },
  },
  {
    name: 'replicate.music.generate',
    description: 'Generate 30s of instrumental music using Google Lyria 2 via Replicate. Sync mode (~20-30s). Produces 48kHz stereo audio. Use for BGM, scene music, character themes.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      prompt: 'string (required, max 600 chars) – music description or lyrics. Newlines = line breaks, double newlines = pauses, ## = accompaniment sections',
      negative_prompt: 'string (optional) – what to exclude from the audio',
      seed: 'number (optional, min 0) – for reproducibility',
    },
  },
  {
    name: 'replicate.prediction.get',
    description: 'Get status of any Replicate prediction. Use to poll video generation. Status: starting → processing → succeeded|failed|canceled.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      predictionId: 'string (required) – prediction ID from replicate.video.create or replicate.image.generate',
    },
  },
  {
    name: 'replicate.prediction.cancel',
    description: 'Cancel a running Replicate prediction.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      predictionId: 'string (required) – prediction ID to cancel',
    },
  },
  {
    name: 'replicate.prediction.wait',
    description: 'Wait for a Replicate prediction to complete. Uses webhook if REPLICATE_WEBHOOK_BASE_URL is set (instant notification), otherwise falls back to polling every 5s. Blocks up to 5 minutes. Returns completed prediction with output.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      predictionId: 'string (required) – prediction ID from replicate.video.create',
      timeoutMs: 'number (optional, default 300000) – max wait time in ms',
    },
  },
  {
    name: 'replicate.character.generate',
    description: 'Generate a character reference image (bareface A-pose, grimace, profile, or casual outfit) using Nano Banana 2. Sync mode (~20-30s). Returns PNG at 9:16.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      characterId: 'string (required) – character preset: dingman|qushoucheng|miku|kaito|obachan',
      variant: 'string (required) – a-pose|grimace|right-profile|casual',
      referenceImage: 'string (optional) – URL of a reference image for face consistency (e.g. A-pose output)',
      customOverrides: 'object (optional) – override any face/body field (e.g. {hair: "short bob"}) ',
    },
  },
  {
    name: 'replicate.character.presets',
    description: 'List available character presets and variant options for character reference image generation.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
];

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Password',
  });
  res.end(JSON.stringify(payload));
}

function noContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Demo-Password',
  });
  res.end();
}

function getHeaderValue(req, key) {
  const value = req.headers[key];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function isDemoAuthorized(req, url) {
  if (!DEMO_PASSWORD) return true;

  const provided =
    String(getHeaderValue(req, 'x-demo-password')).trim() ||
    String(url.searchParams.get('demo') || '').trim();

  return provided === DEMO_PASSWORD;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function getLang(query) {
  const lang = query.get('lang') || 'ko';
  if (lang === 'ko' || lang === 'ja' || lang === 'zh') return lang;
  return 'ko';
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getUserIdFromQuery(query) {
  return String(query.get('userId') || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
}

function normalizeProfileRecord(input) {
  if (!input || typeof input !== 'object') return null;
  if (input.profile && typeof input.profile === 'object') return input.profile;

  const hasProfileShape =
    typeof input.nativeLanguage === 'string' &&
    Array.isArray(input.targetLanguages) &&
    input.proficiency &&
    typeof input.proficiency === 'object';
  return hasProfileShape ? input : null;
}

function getProfile(userId = DEFAULT_USER_ID) {
  const raw = state.profiles.get(userId);
  return normalizeProfileRecord(raw);
}

function getWeakestTargetLanguage(profile) {
  if (!profile || !Array.isArray(profile.targetLanguages) || profile.targetLanguages.length === 0) {
    return 'ko';
  }

  return [...profile.targetLanguages]
    .filter((lang) => lang === 'ko' || lang === 'ja' || lang === 'zh')
    .sort((a, b) => {
      const rankA = PROFICIENCY_RANK[profile?.proficiency?.[a] || 'none'] ?? 0;
      const rankB = PROFICIENCY_RANK[profile?.proficiency?.[b] || 'none'] ?? 0;
      return rankA - rankB;
    })[0] || 'ko';
}

function getCaptionsForVideo(videoId = 'karina-variety-demo') {
  const baseSegments = [
    {
      startMs: 2000,
      endMs: 5200,
      surface: '오늘 뭐 먹을까?',
      romanized: 'oneul mwo meogeulkka',
      english: 'What should we eat today?',
      tokens: [
        { text: '오늘', lemma: '오늘', pos: 'noun', dictionaryId: 'ko-001' },
        { text: '먹을까', lemma: '먹다', pos: 'verb', dictionaryId: 'ko-441' },
      ],
    },
    {
      startMs: 5600,
      endMs: 9200,
      surface: '떡볶이 주문해 볼래?',
      romanized: 'tteokbokki jumunhae bollae',
      english: 'Want to order tteokbokki?',
      tokens: [
        { text: '떡볶이', lemma: '떡볶이', pos: 'noun', dictionaryId: 'ko-210' },
        { text: '주문', lemma: '주문', pos: 'noun', dictionaryId: 'ko-099' },
      ],
    },
    {
      startMs: 9600,
      endMs: 12500,
      surface: '맵기는 어느 정도로 할까요?',
      romanized: 'maepgineun eoneu jeongdoro halkkayo',
      english: 'How spicy should we make it?',
      tokens: [
        { text: '맵기', lemma: '맵다', pos: 'adjective', dictionaryId: 'ko-552' },
        { text: '정도', lemma: '정도', pos: 'noun', dictionaryId: 'ko-778' },
      ],
    },
    {
      startMs: 13200,
      endMs: 16100,
      surface: '좋아, 같이 먹자!',
      romanized: 'joa, gachi meokja',
      english: 'Great, let’s eat together!',
      tokens: [
        { text: '같이', lemma: '같이', pos: 'adverb', dictionaryId: 'ko-345' },
        { text: '먹자', lemma: '먹다', pos: 'verb', dictionaryId: 'ko-441' },
      ],
    },
  ];

  return {
    ...FIXTURES.captions,
    videoId,
    segments: baseSegments,
  };
}

function loadOrFallback(name, fallback) {
  const generated = loadGeneratedSnapshot(name);
  return generated || fallback;
}

function normalizeIngestionSources(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .map((value) => String(value || '').trim().toLowerCase())
      .filter((value) => INGESTION_SOURCES.has(value)),
  )];
}

function buildIngestionSnapshotForUser(options = {}) {
  const includeSources = normalizeIngestionSources(options.includeSources);
  const snapshot = JSON.parse(fs.readFileSync(mockMediaWindowPath, 'utf8'));
  if (includeSources.length > 0) {
    snapshot.sourceItems = (snapshot.sourceItems || []).filter((item) => includeSources.includes(item.source));
  }
  return snapshot;
}

function loadDefaultGeneratedIngestion() {
  const frequency = loadGeneratedSnapshot('frequency');
  const insights = loadGeneratedSnapshot('insights');
  const mediaProfile = loadGeneratedSnapshot('media-profile');
  if (!frequency || !insights || !mediaProfile) return null;

  return {
    generatedAtIso: mediaProfile.generatedAtIso || new Date().toISOString(),
    frequency,
    insights,
    mediaProfile: {
      ...mediaProfile,
      userId: mediaProfile.userId || DEFAULT_USER_ID,
      learningSignals: mediaProfile.learningSignals || FIXTURES.mediaProfile.learningSignals,
    },
  };
}

function runIngestionForUser(userId = DEFAULT_USER_ID, options = {}) {
  const includeSources = normalizeIngestionSources(options.includeSources);
  const snapshot = buildIngestionSnapshotForUser({ includeSources });
  const result = runMockIngestion(snapshot, {
    userId,
  });

  if (userId === DEFAULT_USER_ID && includeSources.length === 0) {
    writeGeneratedSnapshots(result);
  }

  state.ingestionByUser.set(userId, result);
  return result;
}

function ensureIngestionForUser(userId = DEFAULT_USER_ID) {
  const existing = state.ingestionByUser.get(userId);
  if (existing) return existing;

  if (userId === DEFAULT_USER_ID && !getProfile(userId)) {
    const generated = loadDefaultGeneratedIngestion();
    if (generated) {
      state.ingestionByUser.set(userId, generated);
      return generated;
    }
  }

  return runIngestionForUser(userId);
}

function formatIngestionRunResponse(result) {
  return {
    success: true,
    generatedAtIso: result.generatedAtIso,
    sourceCount: {
      youtube: result.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
      spotify: result.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
    },
    topTerms: result.frequency.items.slice(0, 10),
  };
}

function normalizeObject(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function getDominantClusterId(ingestion) {
  return (
    ingestion?.mediaProfile?.learningSignals?.clusterAffinities?.[0]?.clusterId ||
    ingestion?.insights?.clusters?.[0]?.clusterId ||
    'food-ordering'
  );
}

function objectiveMatchesLanguage(objectiveId, lang) {
  return typeof objectiveId === 'string' && objectiveId.startsWith(`${lang}_`);
}

function buildPersonalizedObjective({ userId = DEFAULT_USER_ID, mode = 'hangout', lang = 'ko' }) {
  const ingestion = ensureIngestionForUser(userId);
  const baseObjective = cloneJson(FIXTURES.objectivesNext);
  const dominantClusterId = getDominantClusterId(ingestion);
  const dominantCluster =
    ingestion?.insights?.clusters?.find((cluster) => cluster.clusterId === dominantClusterId) ||
    ingestion?.insights?.clusters?.[0];

  const insightItems = Array.isArray(ingestion?.insights?.items) ? ingestion.insights.items : [];
  const langItems = insightItems.filter((item) => item.lang === lang);
  const scopedItems = langItems.length > 0 ? langItems : insightItems;
  const scopedClusterItems = dominantCluster
    ? scopedItems.filter((item) => item.clusterId === dominantCluster.clusterId)
    : scopedItems;

  let objectiveId =
    scopedClusterItems[0]?.objectiveLinks?.[0]?.objectiveId ||
    scopedItems[0]?.objectiveLinks?.[0]?.objectiveId ||
    baseObjective.objectiveId ||
    DEFAULT_OBJECTIVE_BY_LANG[lang];

  if (!objectiveMatchesLanguage(objectiveId, lang)) {
    const languageAlignedObjective =
      scopedItems.find((item) => objectiveMatchesLanguage(item?.objectiveLinks?.[0]?.objectiveId, lang))
        ?.objectiveLinks?.[0]?.objectiveId || DEFAULT_OBJECTIVE_BY_LANG[lang];

    if (languageAlignedObjective) {
      objectiveId = languageAlignedObjective;
    }
  }

  const vocabCandidates = [
    ...scopedClusterItems.map((item) => item.lemma),
    ...scopedItems.map((item) => item.lemma),
    ...(dominantCluster?.topTerms || []),
  ];
  const vocabulary = [...new Set(vocabCandidates)].slice(0, 3);

  const topTerms = ingestion?.mediaProfile?.learningSignals?.topTerms || [];
  const preferredTerms = topTerms.filter((item) => item.lang === lang);
  const personalizedBase = preferredTerms.length > 0 ? preferredTerms : topTerms;
  const personalizedTargets = personalizedBase.slice(0, 3).map((item) => ({
    lemma: item.lemma,
    source: item.dominantSource,
  }));

  return {
    ...baseObjective,
    objectiveId,
    mode,
    coreTargets: {
      vocabulary:
        vocabulary.length > 0 ? vocabulary : [...(baseObjective.coreTargets?.vocabulary || [])],
      grammar: [...(LANG_TARGETS[lang]?.grammar || LANG_TARGETS.ko.grammar)],
      sentenceStructures: [
        ...(LANG_TARGETS[lang]?.sentenceStructures || LANG_TARGETS.ko.sentenceStructures),
      ],
    },
    personalizedTargets:
      personalizedTargets.length > 0
        ? personalizedTargets
        : cloneJson(baseObjective.personalizedTargets || []),
  };
}

function buildGameStartResponse(userId, incomingProfile) {
  const profile = incomingProfile || getProfile(userId) || FIXTURES.gameStart.profile;
  const weakestLang = getWeakestTargetLanguage(profile);
  const objective = buildPersonalizedObjective({ userId, mode: 'hangout', lang: weakestLang });
  const dominantClusterId = getDominantClusterId(ensureIngestionForUser(userId));
  const city = CLUSTER_CITY_MAP[dominantClusterId] || FIXTURES.gameStart.city || 'seoul';
  const location = CLUSTER_LOCATION_MAP[dominantClusterId] || 'food_street';

  return {
    ...cloneJson(FIXTURES.gameStart),
    city,
    sceneId: `${location}_hangout_intro`,
    actions: [
      'Start hangout validation',
      'Review personalized learn targets',
      `Practice ${weakestLang.toUpperCase()} objective ${objective.objectiveId}`,
    ],
  };
}

function getSecretStatus() {
  const youtubeConfigured = Boolean(
    process.env.TONG_YOUTUBE_API_KEY ||
      (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) ||
      (process.env.TONG_YOUTUBE_CLIENT_ID && process.env.TONG_YOUTUBE_CLIENT_SECRET),
  );
  const spotifyConfigured = Boolean(
    (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) ||
      (process.env.TONG_SPOTIFY_CLIENT_ID && process.env.TONG_SPOTIFY_CLIENT_SECRET),
  );

  return {
    demoPasswordEnabled: Boolean(DEMO_PASSWORD),
    youtubeApiKeyConfigured: youtubeConfigured,
    spotifyClientIdConfigured: spotifyConfigured,
    spotifyClientSecretConfigured: spotifyConfigured,
    openAiApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}

function handleHangoutRespond(body) {
  const sceneSessionId = body.sceneSessionId;
  const userUtterance = String(body.userUtterance || '').trim();
  const existing = state.sessions.get(sceneSessionId);

  if (!existing) {
    return {
      statusCode: 404,
      payload: {
        error: 'unknown_scene_session',
      },
    };
  }

  const goodPatterns = ['주세요', '먹', '주문', '라면', '떡볶이', '메뉴'];
  const matched = goodPatterns.some((pattern) => userUtterance.includes(pattern));
  const xpDelta = matched ? 8 : 4;
  const spDelta = matched ? 2 : 1;
  const rpDelta = matched ? 1 : 0;

  existing.turn += 1;
  existing.score.xp += xpDelta;
  existing.score.sp += spDelta;
  existing.score.rp += rpDelta;

  const nextLine =
    existing.turn % 2 === 0
      ? '좋아요, 맵기는 어느 정도로 할까요?'
      : '좋아요! 다음 주문도 한국어로 말해 볼까요?';

  const response = {
    accepted: true,
    feedback: {
      tongHint: matched
        ? 'Great phrasing. You used practical ordering language.'
        : 'Try adding a food word plus polite ending like 주세요.',
      objectiveProgressDelta: matched ? 0.25 : 0.1,
    },
    nextLine: {
      speaker: 'character',
      text: nextLine,
    },
    state: {
      turn: existing.turn,
      score: { ...existing.score },
    },
  };

  state.sessions.set(sceneSessionId, existing);
  return { statusCode: 200, payload: response };
}

function startHangoutScene(userId = DEFAULT_USER_ID) {
  const sceneSessionId = `hang_${Math.random().toString(36).slice(2, 8)}`;
  const score = { xp: 0, sp: 0, rp: 0 };
  state.sessions.set(sceneSessionId, {
    userId,
    turn: 1,
    score: { ...score },
  });
  return {
    sceneSessionId,
    mode: 'hangout',
    uiPolicy: {
      immersiveFirstPerson: true,
      allowOnlyDialogueAndHints: true,
    },
    state: {
      turn: 1,
      score,
    },
    initialLine: {
      speaker: 'character',
      text: '어서 와요! 오늘은 뭐 먹고 싶어요?',
    },
  };
}

function listLearnSessions() {
  return [...state.learnSessions].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

function createLearnSession(body = {}) {
  const learnSessionId = `learn_${Math.random().toString(36).slice(2, 8)}`;
  const title = `Food Street ${body.objectiveId || 'Objective'} Drill`;
  const item = {
    learnSessionId,
    title,
    objectiveId: body.objectiveId || 'ko_food_l2_001',
    lastMessageAt: new Date().toISOString(),
  };
  state.learnSessions.unshift(item);

  return {
    learnSessionId,
    mode: 'learn',
    uiTheme: 'kakao_like',
    objectiveId: item.objectiveId,
    firstMessage: {
      speaker: 'tong',
      text: "New session started. We'll train 주문 phrases for your next hangout.",
    },
  };
}

async function invokeAgentTool(toolName, rawArgs = {}) {
  const args = normalizeObject(rawArgs);
  const userId = typeof args.userId === 'string' && args.userId.trim() ? args.userId : DEFAULT_USER_ID;

  switch (toolName) {
    case 'ingestion.run_mock': {
      if (args.profile && typeof args.profile === 'object') {
        state.profiles.set(userId, { userId, profile: args.profile });
      }
      const includeSources = normalizeIngestionSources(args.includeSources);
      const result = runIngestionForUser(userId, { includeSources });
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            ...formatIngestionRunResponse(result),
            includeSources: includeSources.length > 0 ? includeSources : ['youtube', 'spotify'],
          },
        },
      };
    }
    case 'ingestion.snapshot.get': {
      const includeSources = normalizeIngestionSources(args.includeSources);
      const snapshot = buildIngestionSnapshotForUser({ includeSources });
      const sourceItems = Array.isArray(snapshot.sourceItems) ? snapshot.sourceItems : [];
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            userId,
            includeSources: includeSources.length > 0 ? includeSources : ['youtube', 'spotify'],
            windowStartIso: snapshot.windowStartIso || null,
            windowEndIso: snapshot.windowEndIso || null,
            generatedAtIso: snapshot.generatedAtIso || null,
            sourceItems,
          },
        },
      };
    }
    case 'player.media_profile.get': {
      const ingestion = ensureIngestionForUser(userId);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: ingestion.mediaProfile || { ...FIXTURES.mediaProfile, userId },
        },
      };
    }
    case 'vocab.frequency.get': {
      const ingestion = ensureIngestionForUser(userId);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: ingestion.frequency || FIXTURES.frequency,
        },
      };
    }
    case 'vocab.insights.get': {
      const ingestion = ensureIngestionForUser(userId);
      const lang = args.lang === 'ja' || args.lang === 'zh' || args.lang === 'ko' ? args.lang : null;
      const result = lang
        ? {
            ...ingestion.insights,
            items: (ingestion.insights?.items || []).filter((item) => item.lang === lang),
          }
        : ingestion.insights;
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: result || FIXTURES.insights,
        },
      };
    }
    case 'objectives.next.get': {
      const mode = args.mode === 'learn' ? 'learn' : 'hangout';
      const lang = args.lang === 'ja' || args.lang === 'zh' ? args.lang : 'ko';
      const objective = buildPersonalizedObjective({ userId, mode, lang });
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: objective,
        },
      };
    }
    // ── Volcengine tools ─────────────────────────────────────────
    case 'volcengine.status': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: getVolcengineStatus(),
        },
      };
    }
    case 'volcengine.backdrop.generate': {
      try {
        const result = await generateBackdrop(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'volcengine.backdrop.presets': {
      return {
        statusCode: 200,
        payload: { ok: true, tool: toolName, result: getBackdropPresets() },
      };
    }
    case 'volcengine.image.generate': {
      try {
        const result = await generateImage(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'volcengine.video.create': {
      try {
        const result = await createVideoTask(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'volcengine.video.get': {
      try {
        const result = await getVideoTask(args.taskId);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'volcengine.video.wait': {
      try {
        const result = await waitForVideoTask(
          args.taskId,
          args.intervalMs || 10000,
          args.timeoutMs || 600000,
        );
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'volcengine.video.list': {
      try {
        const result = await listVideoTasks(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'volcengine.tts.synthesize': {
      try {
        const result = await synthesizeSpeech(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    // ── ElevenLabs tools ─────────────────────────────────────────
    case 'elevenlabs.sfx.generate': {
      try {
        const result = await generateSoundEffect(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'elevenlabs.music.generate': {
      try {
        const result = await generateMusic(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'elevenlabs.tts.speak': {
      try {
        const result = await elevenlabsTTS(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    // ── Replicate tools ─────────────────────────────────────────
    case 'replicate.status': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: getReplicateStatus(),
        },
      };
    }
    case 'replicate.image.generate': {
      try {
        const result = await replicateGenerateImage(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'replicate.video.create': {
      try {
        const result = await replicateGenerateVideo(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'replicate.music.generate': {
      try {
        const result = await replicateGenerateMusic(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'replicate.prediction.get': {
      try {
        const result = await replicateGetPrediction(args.predictionId);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'replicate.prediction.cancel': {
      try {
        const result = await replicateCancelPrediction(args.predictionId);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'replicate.prediction.wait': {
      try {
        const result = await replicateWaitForPrediction(
          args.predictionId,
          args.timeoutMs || 300000,
        );
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'replicate.character.generate': {
      try {
        const result = await replicateGenerateCharacterRef(args);
        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    case 'replicate.character.presets': {
      return {
        statusCode: 200,
        payload: { ok: true, tool: toolName, result: getCharacterPresets() },
      };
    }
    default:
      return {
        statusCode: 404,
        payload: {
          ok: false,
          error: 'tool_not_found',
          tool: toolName,
        },
      };
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      jsonResponse(res, 400, { error: 'invalid_request' });
      return;
    }

    if (req.method === 'OPTIONS') {
      noContent(res);
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    if (pathname === '/health') {
      jsonResponse(res, 200, { ok: true, service: 'tong-server' });
      return;
    }

    // Replicate webhook — must be before auth check (Replicate won't send demo password)
    if (pathname === '/api/v1/replicate/webhook' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const result = handleReplicateWebhook(body);
        jsonResponse(res, 200, result);
      } catch (err) {
        jsonResponse(res, 400, { ok: false, error: err.message });
      }
      return;
    }

    if (!isDemoAuthorized(req, url)) {
      jsonResponse(res, 401, {
        error: 'demo_password_required',
        message: 'Provide a valid demo password via x-demo-password header or ?demo= query.',
      });
      return;
    }

    if (pathname === '/api/v1/captions/enriched' && req.method === 'GET') {
      const videoId = url.searchParams.get('videoId') || 'karina-variety-demo';
      const lang = getLang(url.searchParams);
      jsonResponse(res, 200, { ...getCaptionsForVideo(videoId), lang });
      return;
    }

    if (pathname === '/api/v1/dictionary/entry' && req.method === 'GET') {
      const term = url.searchParams.get('term') || FIXTURES.dictionary.term;
      const entry = DICTIONARY_OVERRIDES[term] || {
        ...FIXTURES.dictionary,
        term,
      };
      jsonResponse(res, 200, entry);
      return;
    }

    if (pathname === '/api/v1/tools' && req.method === 'GET') {
      jsonResponse(res, 200, {
        ok: true,
        tools: AGENT_TOOL_DEFINITIONS,
      });
      return;
    }

    if (pathname === '/api/v1/tools/invoke' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const toolName = typeof body.tool === 'string' ? body.tool : '';
      if (!toolName) {
        jsonResponse(res, 400, {
          ok: false,
          error: 'tool_required',
        });
        return;
      }
      const { statusCode, payload } = await invokeAgentTool(toolName, body.args);
      jsonResponse(res, statusCode, payload);
      return;
    }

    if (pathname === '/api/v1/vocab/frequency' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(
        res,
        200,
        userId === DEFAULT_USER_ID
          ? loadOrFallback('frequency', ingestion.frequency || FIXTURES.frequency)
          : ingestion.frequency || FIXTURES.frequency,
      );
      return;
    }

    if (pathname === '/api/v1/vocab/insights' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(
        res,
        200,
        userId === DEFAULT_USER_ID
          ? loadOrFallback('insights', ingestion.insights || FIXTURES.insights)
          : ingestion.insights || FIXTURES.insights,
      );
      return;
    }

    if (pathname === '/api/v1/player/media-profile' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(
        res,
        200,
        userId === DEFAULT_USER_ID
          ? loadOrFallback('media-profile', ingestion.mediaProfile || FIXTURES.mediaProfile)
          : ingestion.mediaProfile || { ...FIXTURES.mediaProfile, userId },
      );
      return;
    }

    if (pathname === '/api/v1/ingestion/run-mock' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromQuery(url.searchParams);
      if (body?.profile && typeof body.profile === 'object') {
        state.profiles.set(userId, { userId, profile: body.profile });
      }
      const includeSources = normalizeIngestionSources(body.includeSources);
      const result = runIngestionForUser(userId, { includeSources });
      jsonResponse(res, 200, formatIngestionRunResponse(result));
      return;
    }

    if (pathname === '/api/v1/demo/secret-status' && req.method === 'GET') {
      jsonResponse(res, 200, getSecretStatus());
      return;
    }

    if (pathname === '/api/v1/game/start-or-resume' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || DEFAULT_USER_ID;
      if (body.profile) {
        state.profiles.set(userId, { userId, profile: body.profile });
      }
      const sessionId = `sess_${Math.random().toString(36).slice(2, 10)}`;
      const response = { ...buildGameStartResponse(userId, body.profile), sessionId };
      state.sessions.set(sessionId, {
        userId,
        turn: 1,
        score: { xp: 0, sp: 0, rp: 0 },
      });
      jsonResponse(res, 200, response);
      return;
    }

    if (pathname === '/api/v1/profile/proficiency' && req.method === 'PUT') {
      const body = await readJsonBody(req);
      if (!body.userId) {
        jsonResponse(res, 400, { error: 'userId_required' });
        return;
      }
      const profile = normalizeProfileRecord(body) || normalizeProfileRecord(body.profile);
      const record = profile ? { userId: body.userId, profile } : body;
      state.profiles.set(body.userId, record);
      jsonResponse(res, 200, { ok: true, profile: record });
      return;
    }

    if (pathname === '/api/v1/objectives/next' && req.method === 'GET') {
      const explicitLang = url.searchParams.get('lang');
      const lang = getLang(url.searchParams);
      const mode = url.searchParams.get('mode') === 'learn' ? 'learn' : 'hangout';
      const userId = getUserIdFromQuery(url.searchParams);
      const profile = getProfile(userId);
      const selectedLang =
        explicitLang && (explicitLang === 'ko' || explicitLang === 'ja' || explicitLang === 'zh')
          ? lang
          : profile
            ? getWeakestTargetLanguage(profile)
            : lang;
      const objective = buildPersonalizedObjective({
        userId,
        mode,
        lang: selectedLang,
      });
      jsonResponse(res, 200, objective);
      return;
    }

    if (pathname === '/api/v1/scenes/hangout/start' && req.method === 'POST') {
      const body = await readJsonBody(req);
      jsonResponse(res, 200, startHangoutScene(body.userId || DEFAULT_USER_ID));
      return;
    }

    if (pathname === '/api/v1/scenes/hangout/respond' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { statusCode, payload } = handleHangoutRespond(body);
      jsonResponse(res, statusCode, payload);
      return;
    }

    if (pathname === '/api/v1/learn/sessions' && req.method === 'GET') {
      jsonResponse(res, 200, { items: listLearnSessions() });
      return;
    }

    if (pathname === '/api/v1/learn/sessions' && req.method === 'POST') {
      const body = await readJsonBody(req);
      jsonResponse(res, 200, createLearnSession(body));
      return;
    }

    jsonResponse(res, 404, { error: 'not_found', pathname });
  } catch (error) {
    jsonResponse(res, 500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
});

ensureIngestionForUser(DEFAULT_USER_ID);

server.listen(PORT, () => {
  console.log(`Tong mock server listening on http://localhost:${PORT}`);
});

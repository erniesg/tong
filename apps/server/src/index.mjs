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
  deleteVideoTask,
  synthesizeSpeech,
  generateSoundEffect,
  generateMusic,
  elevenlabsTTS,
  getVolcengineStatus,
} from './volcengine.mjs';
import {
  getHunyuan3dStatus,
  submitHunyuan3dProJob,
  queryHunyuan3dProJob,
  waitForHunyuan3dProJob,
  submitHunyuan3dRapidJob,
  queryHunyuan3dRapidJob,
  waitForHunyuan3dRapidJob,
  submitTextureJob,
  queryTextureJob,
  waitForTextureJob,
  submitReduceFaceJob,
  queryReduceFaceJob,
  waitForReduceFaceJob,
  submitUVJob,
  queryUVJob,
  waitForUVJob,
  submitPartJob,
  queryPartJob,
  waitForPartJob,
  submitProfileTo3dJob,
  queryProfileTo3dJob,
  waitForProfileTo3dJob,
  convert3dFormat,
} from './hunyuan3d.mjs';
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
import {
  GRAPH_TOOL_DEFINITIONS,
  getGraphDashboard,
  getGraphHangoutBundle,
  getGraphLessonBundle,
  getGraphNextActions,
  listGraphPersonas,
  proposeGraphOverlay,
  recordGraphEvidence,
  validatePack,
} from './curriculum-graph.mjs';
import {
  canonicalObjectiveNodeId,
  defaultObjectiveIdForLang,
  objectiveMatchesLanguage,
  objectiveIdentityMap,
  resolveObjectiveIdentity,
  withObjectiveIdentity,
} from './objective-identity.mjs';
import {
  uploadVideo,
  analyzeVideo,
  analyzePlaytestSession,
  getGeminiVideoStatus,
  getAnalysisResult,
  listAnalysisResults,
  listAnalysisPresets,
  listUploadedFiles,
  deleteUploadedFile,
  ANALYSIS_PRESETS,
} from './gemini-video.mjs';
import {
  scrapeTikTokTrends,
  scrapeInstagramTrends,
  scrapeXHSTrends,
  scrapeAllTrends,
  getTrendStatus,
  saveKeywordSet,
  listKeywordSets,
  getKeywordSet,
  deleteKeywordSet,
  searchPlatform,
  runTargetedScrape,
} from './signals.mjs';
import {
  runSignalGathering,
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  generateKeywordsFromBrief,
} from './signal-scheduler.mjs';
import {
  filterByEngagement,
  scoreRelevance,
  runFilterPipeline,
  extractBriefFromMultimodal,
} from './signal-filter.mjs';
import {
  tiktokSearch,
  tiktokTrending,
  instagramHashtag,
  browserSearch,
  getBrowserScraperStatus,
  closeBrowser,
} from './signal-browser.mjs';
import {
  runAutoFix,
  getAutoFixJob,
  listAutoFixJobs,
  getAutoFixStatus,
} from './autofix.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const PORT = Number(process.env.PORT || 8787);
const DEMO_PASSWORD = String(process.env.TONG_DEMO_PASSWORD || '').trim();
const STATE_FILE_PATH = path.resolve(
  repoRoot,
  process.env.TONG_STATE_FILE || 'apps/server/data/generated/mock-state.json',
);

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
  spotifyConnect: loadJson('packages/contracts/fixtures/spotify.connect.sample.json'),
  spotifySync: loadJson('packages/contracts/fixtures/spotify.sync.sample.json'),
  spotifyStatus: loadJson('packages/contracts/fixtures/spotify.status.sample.json'),
  youtubeConnect: loadJson('packages/contracts/fixtures/youtube.connect.sample.json'),
  youtubeSync: loadJson('packages/contracts/fixtures/youtube.sync.sample.json'),
  youtubeStatus: loadJson('packages/contracts/fixtures/youtube.status.sample.json'),
};
const WORLD_MAP_REGISTRY = loadJson('packages/contracts/world-map-registry.sample.json');

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
  ko: defaultObjectiveIdForLang('ko', 'ko-vocab-food-items'),
  ja: defaultObjectiveIdForLang('ja', 'ja-vocab-subway-transfers'),
  zh: defaultObjectiveIdForLang('zh', 'zh-mission-stage-texting'),
};

function getWorldMapCityRegistry(cityId) {
  return (WORLD_MAP_REGISTRY.cities || []).find((city) => city.cityId === cityId) || null;
}

function resolveWorldMapLocation(cityId, locationId = null) {
  const cityRegistry = getWorldMapCityRegistry(cityId);
  if (!cityRegistry) {
    return {
      cityId,
      mapLocationId: locationId || 'food_street',
      dagLocationSlot: locationId || 'food_street',
      legacyLocationIds: [locationId || 'food_street'],
    };
  }

  const requestedLocationId = locationId || cityRegistry.defaultMapLocationId;
  const normalized = cityRegistry.locations.find(
    (entry) =>
      entry.mapLocationId === requestedLocationId ||
      entry.dagLocationSlot === requestedLocationId ||
      (entry.legacyLocationIds || []).includes(requestedLocationId),
  );
  const fallback = cityRegistry.locations.find((entry) => entry.mapLocationId === cityRegistry.defaultMapLocationId)
    || cityRegistry.locations[0];

  return {
    cityId,
    mapLocationId: normalized?.mapLocationId || fallback?.mapLocationId || 'food_street',
    dagLocationSlot: normalized?.dagLocationSlot || fallback?.dagLocationSlot || 'food_street',
    legacyLocationIds: [...new Set([normalized?.dagLocationSlot, ...((normalized?.legacyLocationIds || []))].filter(Boolean))],
  };
}
const OBJECTIVE_RUNTIME_CONFIG = new Map([
  ['ko-vocab-food-items', {
    fallbackTerms: ['주문', '메뉴', '떡볶이'],
    placementReason: 'Food-ordering terms reinforce the Seoul food street hangout.',
    summary: 'Order street food politely in Korean.',
    hangoutCopy: {
      start: '어서 와요! 오늘은 뭐 먹고 싶어요?',
      resume: '좋아요, 이어서 주문해 볼까요? 방금 멈춘 지점부터예요.',
      successHint: '좋아요. 주문할 때 바로 쓸 수 있는 자연스러운 표현이었어요.',
      retryHint: '음식 이름이랑 정중한 끝맺음, 예를 들면 주세요를 붙여 볼까요?',
      nextTurnEven: '좋아요, 맵기는 어느 정도로 할까요?',
      nextTurnOdd: '좋아요! 다음 주문도 한국어로 말해 볼까요?',
    },
  }],
  ['ja-vocab-subway-transfers', {
    fallbackTerms: ['駅', '乗り換え', 'ホーム'],
    placementReason: 'Transit and meetup language fits the Tokyo subway hangout.',
    summary: 'Handle a Tokyo station meetup in Japanese.',
    hangoutCopy: {
      start: 'いらっしゃい。今日は駅で何をしたい？',
      resume: 'じゃあ、続けよう。さっきのやり取りからもう一度ね。',
      successHint: 'いいね。駅でそのまま使える自然な言い方だったよ。',
      retryHint: '場所の名前に、お願いしますかくださいを足してみよう。',
      nextTurnEven: 'いいね。次はどこで乗り換えるか言ってみようか。',
      nextTurnOdd: 'いいね。待ち合わせの場所を日本語で伝えてみよう。',
    },
  }],
  ['zh-mission-stage-texting', {
    fallbackTerms: ['朋友', '练习', '舞台'],
    placementReason: 'Performance language supports the Shanghai texting mission.',
    summary: 'Coordinate a Shanghai practice-studio meetup in Mandarin.',
    hangoutCopy: {
      start: '你来了。今天在练习室附近想做什么？',
      resume: '好，我们继续，从刚才停下来的地方接着说。',
      successHint: '不错，这句话在练习室见面的时候很自然。',
      retryHint: '试着加上食物或地点，再配一个礼貌表达，比如请或者我要。',
      nextTurnEven: '好，那你再说一下想几点见面。',
      nextTurnOdd: '不错，下一句用中文说明你想点什么吧。',
    },
  }],
]);
const HANGOUT_MATCH_PATTERNS = {
  ko: ['주세요', '먹', '주문', '라면', '떡볶이', '메뉴'],
  ja: ['ください', 'お願いします', 'ラーメン', '注文', 'メニュー', '食べ', '駅'],
  zh: ['请', '我要', '拉面', '菜单', '点餐', '火锅', '见面'],
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

const CHECKPOINT_BOUNDARIES = {
  scene_start: 'scene_start',
  turn_end: 'turn_end',
  exercise_start: 'exercise_start',
  exercise_complete: 'exercise_complete',
  reward_grant: 'reward_grant',
};

const state = {
  profiles: new Map(),
  sessions: new Map(),
  sceneSessions: new Map(),
  checkpoints: new Map(),
  activeSessionByUser: new Map(),
  learnSessions: [...(FIXTURES.learnSessions.items || [])],
  ingestionByUser: new Map(),
  integrationsByUser: new Map(),
  playtestSessions: new Map(),
};

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function cloneMapEntries(map) {
  return [...map.entries()].map(([key, value]) => [key, cloneJson(value)]);
}

function restoreMap(entries = []) {
  return new Map(entries.map(([key, value]) => [key, cloneJson(value)]));
}

function uniqueStringList(values = []) {
  return [...new Set(
    values
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

function normalizeRewards(rewards = []) {
  const seen = new Set();
  return rewards.filter((reward) => {
    const rewardId = typeof reward?.rewardId === 'string' ? reward.rewardId.trim() : '';
    if (!rewardId || seen.has(rewardId)) {
      return false;
    }
    seen.add(rewardId);
    return true;
  }).map((reward) => cloneJson(reward));
}

function normalizeUnlocks(unlocks = {}) {
  return {
    locationIds: uniqueStringList(unlocks.locationIds || []),
    missionIds: uniqueStringList(unlocks.missionIds || []),
    rewardIds: uniqueStringList(unlocks.rewardIds || []),
  };
}

function normalizeMissionGate(missionGate = {}, progression = buildInitialProgression()) {
  return {
    readiness: Math.max(0, Math.min(1, Number(missionGate.readiness ?? 0.34) || 0.34)),
    validatedHangouts: Math.max(0, Number(missionGate.validatedHangouts ?? 0) || 0),
    missionAssessmentUnlocked: Boolean(missionGate.missionAssessmentUnlocked),
    masteryTier: Math.max(1, Number(missionGate.masteryTier ?? progression.currentMasteryLevel) || 1),
  };
}

function normalizeGameSessionState(gameSession) {
  if (!gameSession) {
    return gameSession;
  }

  gameSession.progression = {
    ...buildInitialProgression(),
    ...(cloneJson(gameSession.progression || {})),
  };
  gameSession.rewards = normalizeRewards(gameSession.rewards || []);
  gameSession.unlocks = normalizeUnlocks(gameSession.unlocks || {});
  gameSession.missionGate = normalizeMissionGate(gameSession.missionGate || {}, gameSession.progression);
  return gameSession;
}

function normalizeCheckpointState(checkpoint, gameSession = null) {
  if (!checkpoint) {
    return checkpoint;
  }

  checkpoint.rewards = normalizeRewards(checkpoint.rewards || []);
  checkpoint.unlocks = normalizeUnlocks(checkpoint.unlocks || gameSession?.unlocks || {});
  checkpoint.missionGate = normalizeMissionGate(
    checkpoint.missionGate || gameSession?.missionGate || {},
    gameSession?.progression,
  );
  return checkpoint;
}

function saveDurableState() {
  ensureParentDir(STATE_FILE_PATH);
  const payload = {
    schemaVersion: 1,
    savedAtIso: new Date().toISOString(),
    profiles: cloneMapEntries(state.profiles),
    sessions: cloneMapEntries(state.sessions),
    sceneSessions: cloneMapEntries(state.sceneSessions),
    checkpoints: cloneMapEntries(state.checkpoints),
    activeSessionByUser: [...state.activeSessionByUser.entries()],
    learnSessions: cloneJson(state.learnSessions),
    ingestionByUser: cloneMapEntries(state.ingestionByUser),
    integrationsByUser: cloneMapEntries(state.integrationsByUser),
    playtestSessions: cloneMapEntries(state.playtestSessions),
  };
  const tempPath = `${STATE_FILE_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, STATE_FILE_PATH);
}

function loadDurableState() {
  if (!fs.existsSync(STATE_FILE_PATH)) {
    return;
  }

  const parsed = JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf8'));
  state.profiles = restoreMap(parsed.profiles || []);
  state.sessions = restoreMap(parsed.sessions || []);
  state.sceneSessions = restoreMap(parsed.sceneSessions || []);
  state.checkpoints = restoreMap(parsed.checkpoints || []);
  state.activeSessionByUser = new Map(parsed.activeSessionByUser || []);
  state.learnSessions = Array.isArray(parsed.learnSessions)
    ? cloneJson(parsed.learnSessions)
    : [...(FIXTURES.learnSessions.items || [])];
  state.ingestionByUser = restoreMap(parsed.ingestionByUser || []);
  state.integrationsByUser = restoreMap(parsed.integrationsByUser || []);
  state.playtestSessions = restoreMap(parsed.playtestSessions || []);

  for (const [sessionId, gameSession] of state.sessions.entries()) {
    normalizeGameSessionState(gameSession);
    state.sessions.set(sessionId, gameSession);
  }

  for (const [checkpointId, checkpoint] of state.checkpoints.entries()) {
    normalizeCheckpointState(checkpoint, state.sessions.get(checkpoint.gameSessionId) || null);
    state.checkpoints.set(checkpointId, checkpoint);
  }
}

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
  ...GRAPH_TOOL_DEFINITIONS,
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
    description: 'Create a video generation task using ByteDance Seedance. Supports text-to-video, image-to-video (first frame), first+last frame, reference images (1-4, or 1-9 for Seedance 2.0), video/audio reference clips, draft preview (60% cost for validation), and draft-to-full promotion. Default 9:16 portrait. Returns task ID for polling.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      content: 'array (required) – content items. Modes: [{type:"text",text:"..."}] text-to-video | add {type:"image_url",imageUrl:"..."} for first frame | two image_urls for first+last | up to 4 image_urls for reference (9 for Seedance 2.0) | {type:"video_url",videoUrl:"..."} video ref (mp4/mov, 2-15s) | {type:"audio_url",audioUrl:"..."} audio ref (wav/mp3, 2-15s) | [{type:"draft_task",draftTaskId:"cgt-..."}] to promote draft to full',
      model: 'string (optional) – model ID, default doubao-seedance-1-5-pro-251215',
      resolution: '480p|720p|1080p (optional, default 720p)',
      ratio: '16:9|9:16|21:9|9:21|1:1|adaptive (optional, default 9:16)',
      duration: 'number 2-15 (optional) – video length in seconds (default 5)',
      frames: 'number (optional) – frame count (alternative to duration)',
      seed: 'number (optional) – for reproducibility',
      cameraFixed: 'boolean (optional) – lock camera for talking-head shots',
      returnLastFrame: 'boolean (optional) – return last frame URL for clip chaining',
      generateAudio: 'boolean (optional) – generate ambient audio track',
      draft: 'boolean (optional) – draft mode: 480p preview at ~60% cost, 7-day validity, no last frame. Then promote to full via {type:"draft_task",draftTaskId:"..."} content item',
      serviceTier: 'default|flex (optional) – flex is 50% cheaper but slower (hour-level latency)',
      executionExpiresAfter: 'number (optional) – timeout in seconds for flex tier tasks',
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
    name: 'volcengine.video.delete',
    description: 'Delete or cancel a video generation task. Queued tasks are cancelled; completed tasks have their records removed. Tasks auto-delete after 24h anyway.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      taskId: 'string (required) – task ID to delete/cancel',
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
  // ── Scene Builder tools ──────────────────────────────────────────
  {
    name: 'scene-builder.generate-images',
    description: 'Generate scene sketch images for a Scene Builder exercise. Takes an array of scene descriptions and generates images in parallel via Replicate. Returns image URLs for each scene.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      scenes: 'array (required) – [{ prompt: "image generation prompt", sceneNumber: 1 }, ...]',
      aspect_ratio: '16:9|1:1|9:16 (optional, default 16:9)',
      style: 'string (optional) – style prefix, e.g. "pencil sketch storyboard style"',
    },
  },
  // ── Tencent Hunyuan 3D tools ──────────────────────────────────────
  {
    name: 'hunyuan3d.status',
    description: 'Check Tencent Hunyuan 3D API key configuration status.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'hunyuan3d.pro.submit',
    description: 'Submit a Hunyuan 3D Pro job — text or image to 3D model. Async, returns jobId for polling. Supports OBJ/GLB/STL/USDZ/FBX output, PBR materials, LowPoly/Geometry/Sketch modes, face count control.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      prompt: 'string (optional) – text description for text-to-3D, mutually exclusive with imageUrl/imageBase64',
      imageUrl: 'string (optional) – image URL for image-to-3D',
      imageBase64: 'string (optional) – image base64 for image-to-3D',
      model: '3.0|3.1 (optional, default 3.0)',
      enablePBR: 'boolean (optional, default false) – enable PBR material generation',
      faceCount: 'number 3000-1500000 (optional, default 500000) – polygon face count',
      generateType: 'Normal|LowPoly|Geometry|Sketch (optional, default Normal)',
      resultFormat: 'STL|USDZ|FBX (optional) – default returns OBJ+GLB',
    },
  },
  {
    name: 'hunyuan3d.pro.query',
    description: 'Query status of a Hunyuan 3D Pro job. Status: WAIT → RUN → DONE|FAIL. When DONE, returns resultFiles with download URLs (OBJ, GLB, preview image).',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required) – job ID from hunyuan3d.pro.submit',
    },
  },
  {
    name: 'hunyuan3d.pro.wait',
    description: 'Poll a Hunyuan 3D Pro job until DONE or FAIL. Blocks up to 10 minutes, polling every 5s. Returns completed job with resultFiles.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required) – job ID from hunyuan3d.pro.submit',
      intervalMs: 'number (optional, default 5000) – poll interval in ms',
      timeoutMs: 'number (optional, default 600000) – max wait time in ms',
    },
  },
  {
    name: 'hunyuan3d.rapid.submit',
    description: 'Submit a Hunyuan 3D Rapid job — faster generation, lower quality. Async, returns jobId. Good for quick previews.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      prompt: 'string (optional) – text description, mutually exclusive with imageUrl/imageBase64',
      imageUrl: 'string (optional) – image URL for image-to-3D',
      imageBase64: 'string (optional) – image base64 for image-to-3D',
      resultFormat: 'OBJ|GLB|STL|USDZ|FBX|MP4 (optional, default OBJ)',
      enablePBR: 'boolean (optional, default false)',
    },
  },
  {
    name: 'hunyuan3d.rapid.query',
    description: 'Query status of a Hunyuan 3D Rapid job. Status: WAIT → RUN → DONE|FAIL.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required) – job ID from hunyuan3d.rapid.submit',
    },
  },
  {
    name: 'hunyuan3d.rapid.wait',
    description: 'Poll a Hunyuan 3D Rapid job until DONE or FAIL. Blocks up to 5 minutes, polling every 3s.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required) – job ID from hunyuan3d.rapid.submit',
      intervalMs: 'number (optional, default 3000) – poll interval in ms',
      timeoutMs: 'number (optional, default 300000) – max wait time in ms',
    },
  },
  {
    name: 'hunyuan3d.texture.submit',
    description: 'Submit a texture generation job — input a white 3D model (OBJ/GLB) plus a reference image or text prompt to generate a textured model. Requires TC3 auth (TENCENT_SECRET_ID/KEY).',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      file3d: 'object (required) – { type: "OBJ"|"GLB", url: "https://..." }',
      prompt: 'string (optional) – text description for texture',
      image: 'object (optional) – { url: "..." } or { base64: "..." } reference image',
      model: '3.0|3.1 (optional, default 3.0) – 3.1 enables multi-view images',
      enablePBR: 'boolean (optional, default false)',
    },
  },
  {
    name: 'hunyuan3d.texture.query',
    description: 'Query status of a texture generation job.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
    },
  },
  {
    name: 'hunyuan3d.texture.wait',
    description: 'Poll a texture job until DONE or FAIL.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
      intervalMs: 'number (optional, default 5000)',
      timeoutMs: 'number (optional, default 600000)',
    },
  },
  {
    name: 'hunyuan3d.reduceFace.submit',
    description: 'Submit a smart topology (reduce face) job — input high-poly 3D model, get clean low-poly output. Uses Polygon 1.5 model. Requires TC3 auth.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      file3d: 'object (required) – { type: "OBJ"|"GLB", url: "https://..." }',
      polygonType: 'triangle|quadrilateral (optional, default triangle)',
      faceLevel: 'high|medium|low (optional)',
    },
  },
  {
    name: 'hunyuan3d.reduceFace.query',
    description: 'Query status of a reduce face job.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
    },
  },
  {
    name: 'hunyuan3d.reduceFace.wait',
    description: 'Poll a reduce face job until DONE or FAIL.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
      intervalMs: 'number (optional, default 5000)',
      timeoutMs: 'number (optional, default 600000)',
    },
  },
  {
    name: 'hunyuan3d.uv.submit',
    description: 'Submit a UV unwrapping job — input a 3D model (FBX/OBJ/GLB), get UV-mapped output with texture atlas. Requires TC3 auth.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      file: 'object (required) – { type: "FBX"|"OBJ"|"GLB", url: "https://..." }',
    },
  },
  {
    name: 'hunyuan3d.uv.query',
    description: 'Query status of a UV unwrapping job.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
    },
  },
  {
    name: 'hunyuan3d.uv.wait',
    description: 'Poll a UV job until DONE or FAIL.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
      intervalMs: 'number (optional, default 5000)',
      timeoutMs: 'number (optional, default 600000)',
    },
  },
  {
    name: 'hunyuan3d.part.submit',
    description: 'Submit a component generation job — input a 3D model (FBX only), auto-split into parts. Requires TC3 auth.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      file: 'object (required) – { type: "FBX", url: "https://..." }',
      model: '1.5 (optional, default 1.5)',
    },
  },
  {
    name: 'hunyuan3d.part.query',
    description: 'Query status of a part generation job.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
    },
  },
  {
    name: 'hunyuan3d.part.wait',
    description: 'Poll a part generation job until DONE or FAIL.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
      intervalMs: 'number (optional, default 5000)',
      timeoutMs: 'number (optional, default 600000)',
    },
  },
  {
    name: 'hunyuan3d.profile.submit',
    description: 'Submit a 3D character generation job — input a head photo + template to generate a 3D character model. Templates: basketball, badminton, pingpong, gymnastics, pilidance, tennis, athletics, footballboykicking1, footballboykicking2, guitar, footballboy, skateboard, futuresoilder, explorer, beardollgirl, bibpantsboy, womansitpose, womanstandpose2, mysteriousprincess, manstandpose2. Requires TC3 auth.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      profile: 'object (required) – { url: "..." } or { base64: "..." } – head photo, min 500px',
      template: 'string (required) – template ID, e.g. "basketball", "guitar", "pingpong"',
    },
  },
  {
    name: 'hunyuan3d.profile.query',
    description: 'Query status of a profile-to-3D character job.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
    },
  },
  {
    name: 'hunyuan3d.profile.wait',
    description: 'Poll a profile-to-3D job until DONE or FAIL.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (required)',
      intervalMs: 'number (optional, default 5000)',
      timeoutMs: 'number (optional, default 600000)',
    },
  },
  {
    name: 'hunyuan3d.convert',
    description: 'Convert a 3D model format (sync). Input OBJ/GLB/FBX (≤60MB), output STL/USDZ/FBX/MP4/GIF. Returns result URL directly. Requires TC3 auth.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      file3dUrl: 'string (required) – URL to source 3D file',
      format: 'STL|USDZ|FBX|MP4|GIF (required) – target format',
    },
  },
  // ── Gemini Video Understanding tools ──────────────────────────────
  {
    name: 'gemini.video.status',
    description: 'Check Gemini Video API key configuration and available presets.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'gemini.video.upload',
    description: 'Upload a video file to Gemini Files API for analysis. Returns fileUri for subsequent analysis calls. Files persist 48h.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      filePath: 'string (required) – local path to video file',
      mimeType: 'string (optional) – MIME type, default video/webm',
      displayName: 'string (optional) – human-readable label',
    },
  },
  {
    name: 'gemini.video.analyze',
    description: 'Analyze a video using Gemini multimodal understanding. Supports variable schemas for different analysis goals. Use media_resolution "high" for reading UI text, "low" for general analysis.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      fileUri: 'string (required) – Gemini file URI from upload',
      prompt: 'string (required) – analysis prompt',
      model: 'flash|pro (optional, default flash) – flash for triage ($0.05/5min), pro for deep analysis ($0.18/5min)',
      mediaResolution: 'low|medium|high (optional, default low)',
      responseSchema: 'object (optional) – JSON Schema for structured output',
      context: 'string (optional) – additional context (annotations, comments)',
    },
  },
  {
    name: 'gemini.video.analyze_playtest',
    description: 'Analyze a playtest session recording with annotations and comments. Supports preset analysis types or custom schemas.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      sessionId: 'string (required) – playtest session ID',
      analysisType: 'ux_friction|translation_quality|content_engagement|trend_analysis (optional, default ux_friction)',
      customSchema: 'object (optional) – custom JSON Schema, overrides preset',
      customPrompt: 'string (optional) – custom prompt, overrides preset',
      model: 'flash|pro (optional)',
      mediaResolution: 'low|medium|high (optional)',
      videoPath: 'string (optional) – direct path to video file',
      annotationsJson: 'string (optional) – annotations JSON',
      commentsJson: 'string (optional) – comments JSON',
    },
  },
  {
    name: 'gemini.video.presets',
    description: 'List available analysis presets (ux_friction, translation_quality, content_engagement, trend_analysis).',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'gemini.video.results',
    description: 'List cached analysis results or get a specific result by ID.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      analysisId: 'string (optional) – specific analysis ID to retrieve',
    },
  },
  {
    name: 'gemini.video.files',
    description: 'List or delete uploaded files on Gemini. Files auto-expire after 48h.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      action: 'list|delete (optional, default list)',
      fileName: 'string (required for delete) – e.g. "files/abc123"',
    },
  },
  // ── Auto-fix pipeline tools ────────────────────────────────────────
  {
    name: 'autofix.status',
    description: 'Check auto-fix pipeline status (OpenAI key, gh CLI, repo root).',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'autofix.run',
    description: 'Run the auto-fix pipeline for a triaged issue. Generates fix via AI, validates (tsc + server), commits, and creates PR. Set dryRun:true to preview without committing.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      sessionId: 'string (required) – playtest session ID',
      issue: 'object (required) – triaged issue { category, severity, description, suggestedFix, affectedComponent?, whatUserExpected?, whatActuallyHappened? }',
      dryRun: 'boolean (optional, default false) – preview fix without committing',
    },
  },
  {
    name: 'autofix.jobs',
    description: 'List auto-fix jobs or get a specific job by ID.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      jobId: 'string (optional) – specific job ID',
    },
  },
  // ── Signals tools ─────────────────────────────────────────────────
  {
    name: 'signals.keywords.save',
    description: 'Save a keyword set for targeted signal scraping. Sets can come from AI generation or manual input.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      theme: 'string (required) – e.g. "korean_language_learning"',
      description: 'string (required) – what this set is designed to find',
      keywords: 'object (required) – { global: [...], tiktok: [...], instagram: [...], xiaohongshu: [...] }',
      priority: 'high|medium|low (optional, default medium)',
      languages: 'array (optional) – ["ko","ja","zh","en"]',
      source: 'ai|manual (optional, default manual)',
    },
  },
  {
    name: 'signals.keywords.list',
    description: 'List all saved keyword sets.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'signals.keywords.delete',
    description: 'Delete a keyword set by ID.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: { id: 'string (required)' },
  },
  {
    name: 'signals.search',
    description: 'Search a specific platform using keywords. Returns matching posts/videos/notes.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      platform: 'tiktok|instagram|xiaohongshu (required)',
      keywords: 'array (required) – search terms / hashtags',
      limit: 'number (optional, default 5) – results per keyword',
    },
  },
  {
    name: 'signals.targeted_scrape',
    description: 'Run a full targeted scrape using saved keyword sets across all platforms. This is the main entry point for keyword-driven signal gathering.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      keywordSetIds: 'array (optional) – specific set IDs (default: all)',
      platforms: 'array (optional) – ["tiktok","instagram","xiaohongshu"] (default: all)',
      limit: 'number (optional, default 5)',
    },
  },
  {
    name: 'signals.browser_search',
    description: 'Search TikTok and Instagram via headless browser (Puppeteer). This is the real data path — returns actual video/post data with view counts, authors, captions. Supports TikTok keyword search and Instagram hashtag lookup.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      keyword: 'string (required) – search term or hashtag',
      platforms: 'array (optional) – ["tiktok","instagram"] (default both)',
      limit: 'number (optional, default 10)',
    },
  },
  {
    name: 'signals.browser_status',
    description: 'Check headless browser scraper status.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'signals.status',
    description: 'Check signals intelligence configuration and cache status (last scrape time, cached signal count, API key presence).',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {},
  },
  {
    name: 'signals.tiktok',
    description: 'Scrape TikTok trending hashtags, sounds, and content format patterns. Uses Creative Center public endpoint or official API if TIKTOK_API_KEY is set. Results cached 15 min. Pass __mock:true for sample data.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      limit: 'number (optional, default 20, max 50)',
      language: 'string (optional) – filter by language relevance: ko|ja|zh|en',
      category: 'string (optional) – filter by theme: language_learning|dating_sim|anime|kpop|food|travel',
      __mock: 'boolean (optional) – return sample data for development',
    },
  },
  {
    name: 'signals.instagram',
    description: 'Scrape Instagram trending hashtags and Reels audio. Uses public explore endpoint or Graph API if INSTAGRAM_API_KEY is set. Results cached 15 min.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      limit: 'number (optional, default 20, max 50)',
      language: 'string (optional) – filter by language relevance: ko|ja|zh|en',
      category: 'string (optional) – filter by theme',
      __mock: 'boolean (optional) – return sample data for development',
    },
  },
  {
    name: 'signals.xiaohongshu',
    description: 'Scrape Xiaohongshu (RED) trending topics, hashtags, and aesthetic styles. Uses discover page or partner API if XHS_API_KEY is set. Results cached 15 min.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      limit: 'number (optional, default 20, max 50)',
      language: 'string (optional) – filter by language relevance: ko|ja|zh|en',
      category: 'string (optional) – filter by theme',
      __mock: 'boolean (optional) – return sample data for development',
    },
  },
  {
    name: 'signals.all',
    description: 'Scrape all trend platforms (TikTok, Instagram, Xiaohongshu) concurrently and return merged results. Partial failures return warnings but do not crash. Results cached per-platform for 15 min.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      platforms: 'string[] (optional) – subset: ["tiktok","instagram","xiaohongshu"]',
      limit: 'number (optional, default 20 per platform, max 50)',
      language: 'string (optional) – filter by language relevance: ko|ja|zh|en',
      category: 'string (optional) – filter by theme',
      __mock: 'boolean (optional) – return sample data for development',
    },
  },
  {
    name: 'signals.extract_brief',
    description: 'Extract a structured product brief from multimodal inputs (text, images, repo context) via Gemini Flash. The brief is used for keyword generation and relevance scoring.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      text: 'string (optional) – product description or campaign goal',
      imageUrls: 'string[] (optional) – screenshot/product image URLs',
      repoContext: 'boolean (optional) – read CLAUDE.md + package.json for product context',
      executionMode: 'string (optional) – "live"|"mock"|"preflight"',
    },
  },
  {
    name: 'signals.filter.engagement',
    description: 'Filter search results by engagement thresholds (views, likes). Pure function, free, instant.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      results: 'object[] (required) – scraped results with .stats.views/.stats.likes',
      minViews: 'number (optional, default 0)',
      minLikes: 'number (optional, default 0)',
    },
  },
  {
    name: 'signals.filter.relevance',
    description: 'Score search results for relevance to a product brief using Gemini Flash on thumbnails + metadata.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      results: 'object[] (required) – search results',
      brief: 'object (required) – { description, keywords?, targetAudience? }',
      batchSize: 'number (optional, default 5)',
      executionMode: 'string (optional) – "live"|"mock"|"preflight"',
    },
  },
  {
    name: 'signals.filter.pipeline',
    description: 'Two-pass filter: engagement threshold → Gemini relevance scoring. Returns ranked results.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      results: 'object[] (required) – scraped results',
      brief: 'object (required) – { description, keywords?, targetAudience? }',
      minViews: 'number (optional, default 10000)',
      minLikes: 'number (optional, default 0)',
      topN: 'number (optional) – limit output to top N results',
      executionMode: 'string (optional) – "live"|"mock"|"preflight"',
    },
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

/** Simple multipart/form-data parser for upload endpoints. */
function parseMultipart(body, boundary) {
  const sep = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = body.indexOf(sep) + sep.length;

  while (start < body.length) {
    const nextSep = body.indexOf(sep, start);
    if (nextSep === -1) break;
    const partBuf = body.subarray(start, nextSep);

    // Find header/body separator (double CRLF)
    const headerEnd = partBuf.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = nextSep + sep.length; continue; }

    const headerStr = partBuf.subarray(0, headerEnd).toString('utf8');
    const data = partBuf.subarray(headerEnd + 4, partBuf.length - 2); // strip trailing \r\n

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    if (nameMatch) {
      parts.push({ name: nameMatch[1], filename: filenameMatch?.[1], data });
    }
    start = nextSep + sep.length;
  }
  return parts;
}

function getLang(query) {
  const lang = query.get('lang') || 'ko';
  if (lang === 'ko' || lang === 'ja' || lang === 'zh') return lang;
  return 'ko';
}

function getCityId(query, fallback = 'seoul') {
  const city = query.get('city') || fallback;
  if (city === 'seoul' || city === 'tokyo' || city === 'shanghai') return city;
  return fallback;
}

function getLocationId(query, fallback = 'food_street') {
  const city = getCityId(query);
  return resolveWorldMapLocation(city, query.get('location') || fallback).dagLocationSlot;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateShortId(length = 10) {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += NANOID_ALPHABET[Math.floor(Math.random() * NANOID_ALPHABET.length)];
  }
  return id;
}

const CITY_LANGUAGE_MAP = { seoul: 'ko', tokyo: 'ja', shanghai: 'zh' };

function createPlaytestSession({ city, sceneType, language, locationId, hangoutId, exerciseTypes, seed }) {
  const validCities = ['seoul', 'tokyo', 'shanghai'];
  const validSceneTypes = ['onboarding', 'hangout', 'free_roam', 'exercise'];

  const resolvedCity = validCities.includes(city) ? city : 'seoul';
  const resolvedSceneType = validSceneTypes.includes(sceneType) ? sceneType : 'hangout';
  const resolvedLanguage = language || CITY_LANGUAGE_MAP[resolvedCity] || 'ko';

  let sessionId;
  do {
    sessionId = generateShortId(10);
  } while (state.playtestSessions.has(sessionId));

  const session = {
    sessionId,
    city: resolvedCity,
    sceneType: resolvedSceneType,
    language: resolvedLanguage,
    locationId: typeof locationId === 'string' ? locationId : undefined,
    hangoutId: typeof hangoutId === 'string' ? hangoutId : undefined,
    exerciseTypes: Array.isArray(exerciseTypes) ? exerciseTypes.filter((t) => typeof t === 'string') : undefined,
    seed: typeof seed === 'number' ? seed : undefined,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Remove undefined fields for a clean JSON payload
  for (const key of Object.keys(session)) {
    if (session[key] === undefined) delete session[key];
  }

  state.playtestSessions.set(sessionId, session);
  return session;
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

function getRuntimeObjectiveConfig({ objectiveId = null, lang = null, cityId = null } = {}) {
  if (objectiveId) {
    const resolved = resolveObjectiveIdentity(objectiveId);
    const identity = resolved.identity || null;
    const runtimeConfig = OBJECTIVE_RUNTIME_CONFIG.get(resolved.canonicalObjectiveId) || {};
    if (identity || Object.keys(runtimeConfig).length > 0) {
      const resolvedMapLocation = resolveWorldMapLocation(
        identity?.cityId || cityId || 'seoul',
        identity?.mapLocationId || identity?.locationId || null,
      );
      return {
        objectiveId: resolved.canonicalObjectiveId,
        canonicalObjectiveId: resolved.canonicalObjectiveId,
        legacyObjectiveId: resolved.legacyObjectiveId,
        objectiveAliasIds: resolved.objectiveAliasIds,
        ...(identity || {}),
        locationId: resolvedMapLocation.dagLocationSlot,
        mapLocationId: resolvedMapLocation.mapLocationId,
        dagLocationSlot: resolvedMapLocation.dagLocationSlot,
        ...runtimeConfig,
      };
    }
  }

  for (const identity of objectiveIdentityMap.objectives || []) {
    if (lang && identity.lang !== lang) continue;
    if (cityId && identity.cityId !== cityId) continue;
    const runtimeConfig = OBJECTIVE_RUNTIME_CONFIG.get(identity.canonicalObjectiveId);
    if (!runtimeConfig) continue;
    const resolvedMapLocation = resolveWorldMapLocation(
      identity.cityId,
      identity.mapLocationId || identity.locationId || null,
    );
    return {
      objectiveId: identity.canonicalObjectiveId,
      canonicalObjectiveId: identity.canonicalObjectiveId,
      legacyObjectiveId: identity.legacyObjectiveIds?.[0] || null,
      objectiveAliasIds: [...(identity.legacyObjectiveIds || [])],
      ...identity,
      locationId: resolvedMapLocation.dagLocationSlot,
      mapLocationId: resolvedMapLocation.mapLocationId,
      dagLocationSlot: resolvedMapLocation.dagLocationSlot,
      ...runtimeConfig,
    };
  }

  return null;
}

const CITY_PILOT_LANGUAGE = {
  seoul: 'ko',
  tokyo: 'ja',
  shanghai: 'zh',
};

function getCityPreferredLanguage(profile, city) {
  const targetLanguages = Array.isArray(profile?.targetLanguages)
    ? profile.targetLanguages.filter((lang) => lang === 'ko' || lang === 'ja' || lang === 'zh')
    : [];
  const supportedLanguages = new Set(
    (objectiveIdentityMap.objectives || [])
      .filter((identity) => identity.cityId === city && OBJECTIVE_RUNTIME_CONFIG.has(identity.canonicalObjectiveId))
      .map((identity) => identity.lang),
  );
  return targetLanguages.find((lang) => supportedLanguages.has(lang)) || null;
}

function getBootstrapPilotLanguage(profile, city) {
  if (city && CITY_PILOT_LANGUAGE[city]) {
    const cityPilotLanguage = CITY_PILOT_LANGUAGE[city];
    const targetLanguages = Array.isArray(profile?.targetLanguages)
      ? profile.targetLanguages.filter((lang) => lang === 'ko' || lang === 'ja' || lang === 'zh')
      : [];

    if (targetLanguages.includes(cityPilotLanguage)) {
      return cityPilotLanguage;
    }
  }

  const cityPreferredLanguage = getCityPreferredLanguage(profile, city);
  if (cityPreferredLanguage) {
    return cityPreferredLanguage;
  }

  const weakestTargetLanguage = getWeakestTargetLanguage(profile);
  return weakestTargetLanguage;
}

function uniqueTerms(values = []) {
  return [...new Set(
    values
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0),
  )];
}

function getDominantFallbackSource(ingestion) {
  const youtubeItems = Number(ingestion?.mediaProfile?.sourceBreakdown?.youtube?.itemsConsumed || 0);
  const spotifyItems = Number(ingestion?.mediaProfile?.sourceBreakdown?.spotify?.itemsConsumed || 0);
  return youtubeItems >= spotifyItems ? 'youtube' : 'spotify';
}

function objectiveLinkMatches(link, objectiveId) {
  if (!link || !objectiveId) return false;
  const targetCanonicalId = resolveObjectiveIdentity(objectiveId).canonicalObjectiveId;
  const candidateId =
    link.canonicalObjectiveId || link.objectiveId || link.legacyObjectiveId || null;
  return resolveObjectiveIdentity(candidateId).canonicalObjectiveId === targetCanonicalId;
}

function buildFallbackPlacementHint(objectiveConfig, mode = 'hangout') {
  if (!objectiveConfig) return null;
  return withObjectiveIdentity({
    city: objectiveConfig.cityId,
    location: objectiveConfig.locationId,
    mode,
    placementType: objectiveConfig.objectiveCategory === 'conversation' ? 'mission' : mode,
    reason: objectiveConfig.placementReason || 'Language-aligned placement.',
    clusterId: objectiveConfig.clusterId || null,
  }, objectiveConfig.objectiveId);
}

function buildObjectiveTermBundle({ ingestion, lang, objectiveId, objectiveConfig, dominantCluster }) {
  const insightItems = Array.isArray(ingestion?.insights?.items) ? ingestion.insights.items : [];
  const langItems = insightItems.filter((item) => item?.lang === lang);
  const scopedObjectiveItems = langItems.filter((item) =>
    Array.isArray(item?.objectiveLinks) && item.objectiveLinks.some((link) => objectiveLinkMatches(link, objectiveId)),
  );
  const scopedClusterItems = dominantCluster
    ? langItems.filter((item) => item?.clusterId === dominantCluster.clusterId)
    : [];
  const fallbackTerms = uniqueTerms(objectiveConfig?.fallbackTerms || []);
  const vocabulary = uniqueTerms([
    ...fallbackTerms,
    ...scopedObjectiveItems.map((item) => item.lemma),
    ...scopedClusterItems.map((item) => item.lemma),
  ]).slice(0, 3);
  const topTerms = Array.isArray(ingestion?.mediaProfile?.learningSignals?.topTerms)
    ? ingestion.mediaProfile.learningSignals.topTerms.filter((item) => item?.lang === lang)
    : [];
  const topTermByLemma = new Map(topTerms.map((item) => [item.lemma, item]));
  const fallbackSource = getDominantFallbackSource(ingestion);
  const fallbackPlacementHint = buildFallbackPlacementHint(objectiveConfig);

  return {
    vocabulary,
    personalizedTargets: vocabulary.map((lemma) => {
      const ranked = topTermByLemma.get(lemma);
      const source = ranked?.dominantSource || fallbackSource;
      return {
        lemma,
        source,
        linkedNodeIds: [
          `overlay:${source}:${dominantCluster?.clusterId || objectiveConfig?.clusterId || getDominantClusterId(ingestion)}`,
          `target:${lemma}`,
        ],
      };
    }),
    fallbackRankedTerms: vocabulary.map((lemma, index) => {
      const ranked = topTermByLemma.get(lemma);
      return {
        lemma,
        lang,
        source: ranked?.dominantSource || fallbackSource,
        weightedScore: ranked?.weightedScore || Number((Math.max(0.2, 0.9 - index * 0.2)).toFixed(2)),
        provenance: cloneJson(ranked?.provenance || { sources: [], mediaIds: [], samples: [] }),
        placementHints: fallbackPlacementHint ? [cloneJson(fallbackPlacementHint)] : [],
      };
    }),
    fallbackPlacementHint,
  };
}

function getHangoutCopyBundle({ sceneSession = null, gameSession = null, body = {} } = {}) {
  const objectiveId =
    gameSession?.activeObjective?.objectiveId ||
    sceneSession?.objective?.objectiveId ||
    body.objectiveId ||
    DEFAULT_OBJECTIVE_BY_LANG.ko;
  const objectiveConfig =
    getRuntimeObjectiveConfig({ objectiveId }) ||
    getRuntimeObjectiveConfig({
      lang: body.lang === 'ja' || body.lang === 'zh' || body.lang === 'ko' ? body.lang : 'ko',
      cityId: body.city || gameSession?.cityId || sceneSession?.cityId || 'seoul',
    }) ||
    getRuntimeObjectiveConfig({ objectiveId: DEFAULT_OBJECTIVE_BY_LANG.ko });
  return {
    lang: objectiveConfig?.lang || gameSession?.activeObjective?.lang || sceneSession?.objective?.lang || 'ko',
    copy: objectiveConfig?.hangoutCopy || {},
  };
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
  saveDurableState();
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

function getMatchingPlacementHints(candidates = [], { city, location, mode, lang, objectiveId }) {
  const items = Array.isArray(candidates) ? candidates : [];
  const canonicalObjectiveId = objectiveId ? resolveObjectiveIdentity(objectiveId).canonicalObjectiveId : null;
  const strictMatches = items.filter((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    if (city && candidate.city !== city) return false;
    if (location && candidate.location !== location) return false;
    if (mode && candidate.mode !== mode) return false;
    if (lang && !objectiveMatchesLanguage(candidate.objectiveId, lang)) return false;
    if (
      canonicalObjectiveId &&
      resolveObjectiveIdentity(candidate.objectiveId).canonicalObjectiveId !== canonicalObjectiveId
    ) {
      return false;
    }
    return true;
  });

  if (strictMatches.length > 0) {
    return strictMatches;
  }

  if (lang || canonicalObjectiveId) {
    return [];
  }

  return items.filter((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    if (city && candidate.city !== city) return false;
    if (location && candidate.location !== location) return false;
    if (mode && candidate.mode !== mode) return false;
    return true;
  });
}

function buildRecentMediaRationale({ ingestion, city, location, mode, lang, objectiveId }) {
  const mediaProfile = ingestion?.mediaProfile || FIXTURES.mediaProfile;
  const insights = ingestion?.insights || FIXTURES.insights;
  const objectiveConfig =
    getRuntimeObjectiveConfig({ objectiveId }) || getRuntimeObjectiveConfig({ lang, cityId: city });
  const topTerms = Array.isArray(mediaProfile?.learningSignals?.topTerms) ? mediaProfile.learningSignals.topTerms : [];
  const insightClusters = Array.isArray(insights?.clusters) ? insights.clusters : [];
  const matchingTerms = topTerms.filter((term) => {
    if (!term || typeof term !== 'object') return false;
    if (lang && term.lang !== lang) return false;
    return true;
  });
  const fallbackPlacementHint = buildFallbackPlacementHint(objectiveConfig, mode || 'hangout');
  const fallbackRankedTerms =
    matchingTerms.length > 0
      ? []
      : buildObjectiveTermBundle({
          ingestion,
          lang: objectiveConfig?.lang || lang || 'ko',
          objectiveId: objectiveConfig?.objectiveId || objectiveId || DEFAULT_OBJECTIVE_BY_LANG.ko,
          objectiveConfig,
          dominantCluster: insightClusters[0] || null,
        }).fallbackRankedTerms;
  const scopedTerms = matchingTerms.length > 0 ? matchingTerms : fallbackRankedTerms;
  const selectedTerms = scopedTerms.slice(0, 3);
  const placementHints = selectedTerms.flatMap((term) =>
    getMatchingPlacementHints(term.placementHints, { city, location, mode, lang, objectiveId }),
  );
  const dominantPlacement = placementHints[0] || null;
  const selectedCluster =
    (dominantPlacement?.clusterId && insightClusters.find((cluster) => cluster.clusterId === dominantPlacement.clusterId)) ||
    insightClusters.find((cluster) =>
      getMatchingPlacementHints(cluster?.placementHints, { city, location, mode, lang, objectiveId }).length > 0,
    ) ||
    insightClusters[0] ||
    null;

  const sourceSummary = Object.entries(mediaProfile?.sourceBreakdown || {}).map(([source, value]) => ({
    source,
    itemsConsumed: value?.itemsConsumed || 0,
    minutes: value?.minutes || 0,
    topMedia: cloneJson(Array.isArray(value?.topMedia) ? value.topMedia.slice(0, 2) : []),
  }));
  const clusterPlacementHints = getMatchingPlacementHints(selectedCluster?.placementHints, {
    city,
    location,
    mode,
    lang,
    objectiveId,
  });
  const rationaleReason =
    dominantPlacement?.reason ||
    clusterPlacementHints[0]?.reason ||
    (typeof selectedCluster?.label === 'string' && selectedCluster.label.trim().length > 0
      ? `Recent media signals align with ${selectedCluster.label.toLowerCase()} reinforcement.`
      : null) ||
    'Recent media signals were used to personalize the next lesson and hangout objective.';

  return {
    generatedAtIso: mediaProfile.generatedAtIso || new Date().toISOString(),
    sourceSummary,
    reason: rationaleReason || objectiveConfig?.placementReason || 'Recent media signals were used to personalize the next lesson and hangout objective.',
    rankedTerms: selectedTerms.map((term) => ({
      lemma: term.lemma,
      lang: term.lang,
      source: term.dominantSource || term.source,
      weightedScore: term.weightedScore,
      provenance: cloneJson(term.provenance || {}),
      placementHints: cloneJson(
        getMatchingPlacementHints(term.placementHints, { city, location, mode, lang, objectiveId }).length > 0
          ? getMatchingPlacementHints(term.placementHints, { city, location, mode, lang, objectiveId })
          : fallbackPlacementHint
            ? [fallbackPlacementHint]
            : [],
      ),
    })),
    topicSummary: selectedCluster
      ? {
          clusterId: selectedCluster.clusterId,
          label: selectedCluster.label,
          keywords: cloneJson(selectedCluster.keywords || []),
          topTerms: cloneJson(selectedCluster.topTerms || []),
          placementHints: cloneJson(clusterPlacementHints),
        }
      : null,
    placementHints: cloneJson(
      placementHints.length > 0
        ? placementHints
        : clusterPlacementHints.length > 0
          ? clusterPlacementHints
          : fallbackPlacementHint
            ? [fallbackPlacementHint]
            : [],
    ),
  };
}

function getIntegrationState(userId = DEFAULT_USER_ID, provider) {
  const userState = state.integrationsByUser.get(userId) || {};
  const fixtureConnect = provider === 'spotify' ? FIXTURES.spotifyConnect : FIXTURES.youtubeConnect;
  const fixtureSync = provider === 'spotify' ? FIXTURES.spotifySync : FIXTURES.youtubeSync;
  const providerState = userState[provider] || {};
  return {
    provider,
    userId,
    connected: providerState.connected === true,
    lastSyncAtIso: providerState.lastSyncAtIso ?? null,
    lastSyncItemCount:
      providerState.lastSyncItemCount ??
      0,
    syncWindowHours: providerState.syncWindowHours ?? fixtureSync.windowHours ?? 72,
    tokenExpiresAtIso: providerState.tokenExpiresAtIso ?? null,
    tokenScope: providerState.tokenScope ?? fixtureConnect.scope ?? '',
    demoMode: true,
    configured: provider === 'spotify'
      ? getSecretStatus().spotifyClientIdConfigured
      : getSecretStatus().youtubeApiKeyConfigured,
  };
}

function getConnectedIntegrationSources(userId = DEFAULT_USER_ID, nextProvider = null) {
  const userState = state.integrationsByUser.get(userId) || {};
  const connectedSources = Object.entries(userState)
    .filter(([, providerState]) => providerState?.connected === true)
    .map(([provider]) => provider);

  if (nextProvider) {
    connectedSources.push(nextProvider);
  }

  return normalizeIngestionSources(connectedSources);
}

function setIntegrationState(userId = DEFAULT_USER_ID, provider, patch = {}) {
  const userState = state.integrationsByUser.get(userId) || {};
  userState[provider] = {
    ...(userState[provider] || {}),
    ...patch,
  };
  state.integrationsByUser.set(userId, userState);
  saveDurableState();
  return getIntegrationState(userId, provider);
}

function buildIntegrationConnectPayload(userId = DEFAULT_USER_ID, provider) {
  const fixture = cloneJson(provider === 'spotify' ? FIXTURES.spotifyConnect : FIXTURES.youtubeConnect);
  const integrationState = getIntegrationState(userId, provider);
  return {
    ...fixture,
    userId,
    connected: integrationState.connected,
    demoMode: true,
    configured: integrationState.configured,
    provider,
  };
}

function buildIntegrationStatusPayload(userId = DEFAULT_USER_ID, provider) {
  const fixture = cloneJson(provider === 'spotify' ? FIXTURES.spotifyStatus : FIXTURES.youtubeStatus);
  const integrationState = getIntegrationState(userId, provider);
  return {
    ...fixture,
    userId,
    connected: integrationState.connected,
    demoMode: true,
    ...(provider === 'spotify'
      ? { spotifyConfigured: integrationState.configured }
      : { youtubeConfigured: integrationState.configured }),
    tokenExpiresAtIso: integrationState.tokenExpiresAtIso,
    tokenScope: integrationState.tokenScope,
    lastSyncAtIso: integrationState.lastSyncAtIso,
    lastSyncItemCount: integrationState.lastSyncItemCount,
    syncWindowHours: integrationState.syncWindowHours,
  };
}

function buildIntegrationSyncPayload(userId = DEFAULT_USER_ID, provider, includeSources = []) {
  const normalizedSources = normalizeIngestionSources(includeSources);
  const connectedSources = getConnectedIntegrationSources(userId, provider);
  const effectiveSources =
    connectedSources.length > 0
      ? connectedSources
      : normalizedSources.length > 0
        ? normalizedSources
        : [provider];
  const result = runIngestionForUser(userId, { includeSources: effectiveSources });
  const mediaProfile = result.mediaProfile || FIXTURES.mediaProfile;
  const fixture = cloneJson(provider === 'spotify' ? FIXTURES.spotifySync : FIXTURES.youtubeSync);
  const providerSourceCount = mediaProfile?.sourceBreakdown?.[provider]?.itemsConsumed || 0;
  const nextState = setIntegrationState(userId, provider, {
    connected: true,
    lastSyncAtIso: result.generatedAtIso,
    lastSyncItemCount: providerSourceCount,
    syncWindowHours: fixture.windowHours ?? 72,
  });

  return {
    ...fixture,
    ok: true,
    userId,
    syncedAtIso: result.generatedAtIso,
    windowHours: nextState.syncWindowHours,
    [`${provider}ItemCount`]: providerSourceCount,
    [`${provider}RawItemCount`]: providerSourceCount,
    sourceCount: {
      youtube: mediaProfile?.sourceBreakdown?.youtube?.itemsConsumed || 0,
      spotify: mediaProfile?.sourceBreakdown?.spotify?.itemsConsumed || 0,
    },
    topTerms: cloneJson((result.frequency?.items || []).slice(0, 3)),
    recentMediaRationale: buildRecentMediaRationale({
      ingestion: result,
      city: null,
      location: null,
      mode: null,
      lang: null,
      objectiveId: null,
    }),
  };
}

function buildPersonalizedObjective({
  userId = DEFAULT_USER_ID,
  mode = 'hangout',
  lang = 'ko',
  city = 'seoul',
  location = 'food_street',
}) {
  const resolvedMapLocation = resolveWorldMapLocation(city, location);
  const dagLocationSlot = resolvedMapLocation.dagLocationSlot;
  const ingestion = ensureIngestionForUser(userId);
  const baseObjective = cloneJson(FIXTURES.objectivesNext);
  const dominantClusterId = getDominantClusterId(ingestion);
  const dominantCluster =
    ingestion?.insights?.clusters?.find((cluster) => cluster.clusterId === dominantClusterId) ||
    ingestion?.insights?.clusters?.[0];
  const runtimeObjectiveConfig = getRuntimeObjectiveConfig({ lang, cityId: city });
  const placementCandidates = Array.isArray(ingestion?.mediaProfile?.learningSignals?.placementCandidates)
    ? ingestion.mediaProfile.learningSignals.placementCandidates
    : [];
  const selectedPlacement =
    placementCandidates.find(
      (candidate) =>
        candidate.city === city &&
        candidate.location === dagLocationSlot &&
        candidate.mode === mode &&
        (
          objectiveMatchesLanguage(candidate.objectiveId, lang) ||
          resolveObjectiveIdentity(candidate.objectiveId).canonicalObjectiveId === runtimeObjectiveConfig?.objectiveId
        ),
    ) ||
    placementCandidates.find(
      (candidate) =>
        candidate.city === city &&
        candidate.mode === mode &&
        objectiveMatchesLanguage(candidate.objectiveId, lang),
    ) ||
    null;

  const insightItems = Array.isArray(ingestion?.insights?.items) ? ingestion.insights.items : [];
  const langItems = insightItems.filter((item) => item.lang === lang);
  const scopedItems = langItems;
  const scopedClusterItems = dominantCluster
    ? scopedItems.filter((item) => item.clusterId === dominantCluster.clusterId)
    : scopedItems;

  let objectiveId =
    selectedPlacement?.objectiveId ||
    runtimeObjectiveConfig?.objectiveId ||
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

  const termBundle = buildObjectiveTermBundle({
    ingestion,
    lang,
    objectiveId,
    objectiveConfig: runtimeObjectiveConfig || getRuntimeObjectiveConfig({ objectiveId }),
    dominantCluster,
  });
  const vocabulary = termBundle.vocabulary;
  const personalizedTargets = termBundle.personalizedTargets;

  const resolvedObjective = resolveObjectiveIdentity(objectiveId);
  const objectiveNodeId = canonicalObjectiveNodeId(objectiveId);
  const graphCategory =
    resolvedObjective.identity?.objectiveCategory ||
    (lang === 'zh' ? 'conversation' : lang === 'ja' ? 'vocabulary' : 'vocabulary');
  const graphTargetNodeIds = vocabulary.map((term) => `target:${term}`);
  const prerequisiteByLang = {
    ko: ['ko-pron-food-words'],
    ja: [],
    zh: [],
  };
  const recentMediaRationale = buildRecentMediaRationale({
    ingestion,
    city,
    location: dagLocationSlot,
    mode,
    lang,
    objectiveId,
  });

  return withObjectiveIdentity({
    ...baseObjective,
    mode,
    lang,
    objectiveGraph: {
      objectiveNodeId,
      cityId: city,
      locationId: dagLocationSlot,
      mapLocationId: resolvedMapLocation.mapLocationId,
      dagLocationSlot,
      objectiveCategory: graphCategory,
      targetNodeIds: graphTargetNodeIds,
      prerequisiteObjectiveIds: prerequisiteByLang[lang] || [],
      source: 'knowledge_graph',
    },
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
    recentMediaRationale,
    placementHints: cloneJson(recentMediaRationale.placementHints || []),
    completionCriteria: {
      ...(baseObjective.completionCriteria || {}),
      minEvidenceEvents: baseObjective.completionCriteria?.minEvidenceEvents || 3,
      acceptedEvidenceModes: baseObjective.completionCriteria?.acceptedEvidenceModes || [
        'learn',
        'hangout',
        'mission',
      ],
    },
  }, objectiveId);
}

function buildGameActions(lang, objectiveId) {
  return [
    'Start hangout validation',
    'Review personalized learn targets',
    `Practice ${lang.toUpperCase()} objective ${objectiveId}`,
  ];
}

function buildActiveObjectiveDescriptor({ objective, lang, city, location }) {
  const runtimeObjectiveConfig = getRuntimeObjectiveConfig({ objectiveId: objective.objectiveId });
  const resolvedMapLocation = resolveWorldMapLocation(
    city,
    objective?.objectiveGraph?.mapLocationId || objective?.mapLocationId || location,
  );
  return withObjectiveIdentity({
    lang,
    mode: 'hangout',
    cityId: city,
    locationId: resolvedMapLocation.dagLocationSlot,
    mapLocationId: resolvedMapLocation.mapLocationId,
    dagLocationSlot: resolvedMapLocation.dagLocationSlot,
    objectiveCategory: objective.objectiveGraph?.objectiveCategory,
    objectiveNodeId: objective.objectiveGraph?.objectiveNodeId,
    targetNodeIds: cloneJson(objective.objectiveGraph?.targetNodeIds || []),
    summary:
      runtimeObjectiveConfig?.summary ||
      `Resume ${lang.toUpperCase()} practice at ${location.replace(/_/g, ' ')}.`,
    recentMediaRationale: cloneJson(objective.recentMediaRationale || null),
    placementHints: cloneJson(objective.placementHints || []),
  }, objective.objectiveId);
}

function buildInitialProgression() {
  return {
    ...(cloneJson(FIXTURES.gameStart.progression || {})),
    xp: FIXTURES.gameStart.progression?.xp ?? 110,
    sp: FIXTURES.gameStart.progression?.sp ?? 45,
    rp: FIXTURES.gameStart.progression?.rp ?? 12,
    currentMasteryLevel: FIXTURES.gameStart.progression?.currentMasteryLevel ?? 1,
  };
}

function buildInitialMissionGate(progression) {
  return {
    readiness: 0.34,
    validatedHangouts: 0,
    missionAssessmentUnlocked: false,
    masteryTier: progression.currentMasteryLevel,
  };
}

function buildInitialUnlocks(location) {
  return {
    locationIds: [location],
    missionIds: [],
    rewardIds: [],
  };
}

function getNextLocationUnlock(location) {
  const progressionOrder = ['food_street', 'cafe', 'convenience_store', 'subway_hub', 'practice_studio'];
  const index = progressionOrder.indexOf(location);
  if (index < 0 || index === progressionOrder.length - 1) {
    return null;
  }
  return progressionOrder[index + 1];
}

function ensureProgressionMilestones(gameSession, nowIso) {
  normalizeGameSessionState(gameSession);

  if (gameSession.missionGate.validatedHangouts >= 1) {
    gameSession.missionGate.missionAssessmentUnlocked = true;
  }

  if (gameSession.missionGate.missionAssessmentUnlocked) {
    const missionId = `mission.${gameSession.cityId}.${gameSession.mapLocationId || gameSession.locationId}.assessment`;
    if (!gameSession.unlocks.missionIds.includes(missionId)) {
      gameSession.unlocks.missionIds.push(missionId);
    }
  }

  const nextLocationId = getNextLocationUnlock(gameSession.locationId);
  if (nextLocationId && !gameSession.unlocks.locationIds.includes(nextLocationId)) {
    gameSession.unlocks.locationIds.push(nextLocationId);
  }

  const rewardId = `reward.${gameSession.cityId}.${gameSession.mapLocationId || gameSession.locationId}.validated_hangout`;
  if (gameSession.missionGate.validatedHangouts >= 1 && !gameSession.unlocks.rewardIds.includes(rewardId)) {
    gameSession.unlocks.rewardIds.push(rewardId);
    gameSession.rewards.push({
      rewardId,
      rewardType: 'xp_bonus',
      grantedAtIso: nowIso,
      metadata: {
        source: 'validated_hangout',
        cityId: gameSession.cityId,
        locationId: gameSession.locationId,
      },
    });
    gameSession.progression.xp += 12;
    gameSession.progression.sp += 3;
  }

  normalizeGameSessionState(gameSession);
}

function buildHangoutRoute(city, location, extras = {}) {
  const resolvedMapLocation = resolveWorldMapLocation(city, location);
  return {
    pathname: '/game',
    query: {
      city,
      location: resolvedMapLocation.mapLocationId,
      mode: 'hangout',
      ...extras,
    },
  };
}

function buildScenarioSeeds(gameSession) {
  const lang = gameSession.activeObjective?.lang || 'ko';

  return [
    {
      seedId: 'review_ready',
      label: 'Review-ready food street checkpoint',
      source: 'qa',
      qaOnly: true,
      route: buildHangoutRoute(gameSession.cityId, gameSession.locationId, {
        qa_trace: '1',
        scenarioSeed: 'review_ready',
      }),
      cityId: gameSession.cityId,
      locationId: gameSession.locationId,
      mode: 'hangout',
      objective: cloneJson(gameSession.activeObjective),
      phase: 'review',
      turn: 4,
      activeExercise: {
        exerciseId: 'block_crush_food_003',
        exerciseType: 'block_crush',
        stepIndex: 2,
        prompt: 'Hold before the final review decision.',
        payloadVersion: 1,
        state: {
          targetChar: lang === 'ko' ? '뉴' : lang === 'ja' ? '食' : '单',
          remainingLives: 2,
          boardPieces: lang === 'ko' ? ['ㅁ', 'ㅠ'] : lang === 'ja' ? ['し', 'ょ'] : ['订', '单'],
          requiredMatches: 1,
        },
      },
      progressionDelta: {
        xp: 8,
        sp: 2,
        rp: 1,
        objectiveProgressDelta: 0.25,
        validatedHangoutsDelta: 0,
      },
      rewards: cloneJson(gameSession.rewards || []),
      rng: {
        seed: 'review_ready_seed_v1',
        version: 1,
      },
      notes: 'Use for QA/demo capture only; do not expose as player-facing resume.',
    },
  ];
}

function createCheckpointFromScenarioSeed(gameSession, scenarioSeed, nowIso) {
  const resolvedMapLocation = resolveWorldMapLocation(
    scenarioSeed.cityId,
    scenarioSeed.mapLocationId || scenarioSeed.locationId,
  );
  return {
    checkpointId: `seed_${gameSession.sessionId}_${scenarioSeed.seedId}`,
    gameSessionId: gameSession.sessionId,
    sceneSessionId: gameSession.activeSceneSessionId,
    kind: 'player_resume',
    route: cloneJson(scenarioSeed.route),
    cityId: scenarioSeed.cityId,
    locationId: resolvedMapLocation.dagLocationSlot,
    mapLocationId: resolvedMapLocation.mapLocationId,
    dagLocationSlot: resolvedMapLocation.dagLocationSlot,
    mode: scenarioSeed.mode,
    objective: cloneJson(scenarioSeed.objective),
    phase: scenarioSeed.phase,
    turn: scenarioSeed.turn,
    activeExercise: cloneJson(scenarioSeed.activeExercise),
    progressionDelta: cloneJson(
      scenarioSeed.progressionDelta || {
        xp: 0,
        sp: 0,
        rp: 0,
        objectiveProgressDelta: 0,
        validatedHangoutsDelta: 0,
      },
    ),
    rewards: cloneJson(scenarioSeed.rewards || []),
    missionGate: cloneJson(gameSession.missionGate),
    unlocks: cloneJson(gameSession.unlocks),
    rng: cloneJson(scenarioSeed.rng),
    createdAtIso: nowIso,
  };
}

function createCheckpointRecord(gameSession, sceneSession, boundary, nowIso) {
  const previousCheckpoint = gameSession.activeCheckpointId
    ? state.checkpoints.get(gameSession.activeCheckpointId)
    : null;
  // Use rng.version as the persisted checkpoint revision so resume loaders have
  // an explicit save-version counter without needing a parallel field.
  const checkpointVersion = Math.max(previousCheckpoint?.rng?.version ?? 0, 0) + 1;
  const checkpoint = {
    checkpointId: `ckpt_${gameSession.sessionId}_${String(checkpointVersion).padStart(3, '0')}`,
    gameSessionId: gameSession.sessionId,
    sceneSessionId: sceneSession.sceneSessionId,
    kind: 'player_resume',
    route: buildHangoutRoute(gameSession.cityId, gameSession.locationId, {
      resume: '1',
      checkpoint: String(checkpointVersion),
    }),
    cityId: gameSession.cityId,
    locationId: gameSession.locationId,
    mapLocationId: gameSession.mapLocationId || resolveWorldMapLocation(gameSession.cityId, gameSession.locationId).mapLocationId,
    dagLocationSlot: gameSession.dagLocationSlot || gameSession.locationId,
    mode: gameSession.currentMode,
    objective: cloneJson(gameSession.activeObjective),
    phase: sceneSession.phase,
    turn: sceneSession.turn,
    progressionDelta: cloneJson(sceneSession.progressionDelta),
    rewards: cloneJson(gameSession.rewards || []),
    missionGate: cloneJson(gameSession.missionGate),
    unlocks: cloneJson(gameSession.unlocks),
    rng: {
      seed: `${gameSession.sessionId}_${boundary}`,
      version: checkpointVersion,
    },
    createdAtIso: nowIso,
  };

  if (sceneSession.activeExercise) {
    checkpoint.activeExercise = cloneJson(sceneSession.activeExercise);
  }

  return checkpoint;
}

function persistCheckpoint(gameSession, sceneSession, boundary, nowIso = new Date().toISOString()) {
  normalizeGameSessionState(gameSession);
  const checkpoint = createCheckpointRecord(gameSession, sceneSession, boundary, nowIso);
  normalizeCheckpointState(checkpoint, gameSession);
  gameSession.activeCheckpointId = checkpoint.checkpointId;
  gameSession.updatedAtIso = nowIso;
  sceneSession.updatedAtIso = nowIso;
  state.sessions.set(gameSession.sessionId, gameSession);
  state.sceneSessions.set(sceneSession.sceneSessionId, sceneSession);
  state.checkpoints.set(checkpoint.checkpointId, checkpoint);
  state.activeSessionByUser.set(gameSession.userId, gameSession.sessionId);
  saveDurableState();
  return checkpoint;
}

function restoreGameSessionFromCheckpoint(gameSession, checkpoint) {
  if (!gameSession || !checkpoint) {
    return gameSession;
  }

  gameSession.activeCheckpointId = checkpoint.checkpointId;
  gameSession.activeSceneSessionId = checkpoint.sceneSessionId;
  gameSession.currentMode = checkpoint.mode;
  gameSession.activeObjective = cloneJson(checkpoint.objective);
  gameSession.locationId = checkpoint.dagLocationSlot || checkpoint.locationId;
  gameSession.mapLocationId =
    checkpoint.mapLocationId || resolveWorldMapLocation(gameSession.cityId, checkpoint.locationId).mapLocationId;
  gameSession.dagLocationSlot = checkpoint.dagLocationSlot || checkpoint.locationId;
  gameSession.missionGate = cloneJson(checkpoint.missionGate);
  gameSession.unlocks = cloneJson(checkpoint.unlocks);
  gameSession.rewards = cloneJson(checkpoint.rewards || []);
  gameSession.updatedAtIso = checkpoint.createdAtIso || gameSession.updatedAtIso;
  normalizeGameSessionState(gameSession);
  state.sessions.set(gameSession.sessionId, gameSession);
  return gameSession;
}

function hydrateSceneSessionFromCheckpoint(gameSession, checkpoint) {
  restoreGameSessionFromCheckpoint(gameSession, checkpoint);
  const existing = state.sceneSessions.get(gameSession.activeSceneSessionId);
  const sceneSession = existing || {
    sceneSessionId: checkpoint.sceneSessionId,
    gameSessionId: gameSession.sessionId,
    sceneId: gameSession.activeSceneId,
    cityId: gameSession.cityId,
    locationId: gameSession.locationId,
    mapLocationId: gameSession.mapLocationId,
    dagLocationSlot: gameSession.dagLocationSlot || gameSession.locationId,
    mode: gameSession.currentMode,
    objective: cloneJson(gameSession.activeObjective),
    phase: checkpoint.phase,
    turn: checkpoint.turn,
    route: buildHangoutRoute(gameSession.cityId, gameSession.locationId),
    progressionDelta: cloneJson(checkpoint.progressionDelta),
    checkpointable: true,
    uiPolicy: {
      immersiveFirstPerson: true,
      allowOnlyDialogueAndHints: true,
    },
    startedAtIso: gameSession.startedAtIso,
    updatedAtIso: checkpoint.createdAtIso,
    score: {
      xp: gameSession.progression.xp,
      sp: gameSession.progression.sp,
      rp: gameSession.progression.rp,
    },
  };

  sceneSession.sceneSessionId = checkpoint.sceneSessionId;
  sceneSession.gameSessionId = gameSession.sessionId;
  sceneSession.sceneId = gameSession.activeSceneId;
  sceneSession.cityId = checkpoint.cityId;
  sceneSession.locationId = checkpoint.locationId;
  sceneSession.mapLocationId = checkpoint.mapLocationId || resolveWorldMapLocation(checkpoint.cityId, checkpoint.locationId).mapLocationId;
  sceneSession.dagLocationSlot = checkpoint.dagLocationSlot || checkpoint.locationId;
  sceneSession.mode = checkpoint.mode;
  sceneSession.objective = cloneJson(checkpoint.objective);
  sceneSession.phase = checkpoint.phase;
  sceneSession.turn = checkpoint.turn;
  sceneSession.route = buildHangoutRoute(checkpoint.cityId, checkpoint.locationId);
  sceneSession.progressionDelta = cloneJson(checkpoint.progressionDelta);
  sceneSession.updatedAtIso = checkpoint.createdAtIso;
  sceneSession.checkpointable = true;
  sceneSession.uiPolicy = {
    immersiveFirstPerson: true,
    allowOnlyDialogueAndHints: true,
  };
  sceneSession.score = {
    xp: gameSession.progression.xp,
    sp: gameSession.progression.sp,
    rp: gameSession.progression.rp,
  };

  if (checkpoint.activeExercise) {
    sceneSession.activeExercise = cloneJson(checkpoint.activeExercise);
  } else {
    delete sceneSession.activeExercise;
  }

  state.sceneSessions.set(sceneSession.sceneSessionId, sceneSession);
  return sceneSession;
}

function buildGameStartResponse(gameSession, sceneSession, activeCheckpoint, resumeSource) {
  const effectiveCheckpoint =
    activeCheckpoint ||
    (gameSession.activeCheckpointId ? state.checkpoints.get(gameSession.activeCheckpointId) : null);
  const effectiveSceneSession =
    sceneSession ||
    (gameSession.activeSceneSessionId ? state.sceneSessions.get(gameSession.activeSceneSessionId) : null);

  if (!effectiveSceneSession) {
    throw new Error(`Missing scene session for ${gameSession.sessionId}`);
  }

  const nextResumeSource = resumeSource || gameSession.resumeSource || 'new_session';
  gameSession.resumeSource = nextResumeSource;
  const personalization = buildRecentMediaRationale({
    ingestion: ensureIngestionForUser(gameSession.userId),
    city: gameSession.cityId,
    location: gameSession.locationId,
    mode: gameSession.currentMode,
    lang: gameSession.activeObjective?.lang || getWeakestTargetLanguage(gameSession.profile),
    objectiveId: gameSession.activeObjective?.objectiveId || null,
  });
  gameSession.personalization = cloneJson(personalization);
  const responseSceneSession = cloneJson(effectiveSceneSession);
  delete responseSceneSession.score;

  return {
    ...cloneJson(FIXTURES.gameStart),
    sessionId: gameSession.sessionId,
    city: gameSession.cityId,
    location: gameSession.locationId,
    mapLocationId: gameSession.mapLocationId || resolveWorldMapLocation(gameSession.cityId, gameSession.locationId).mapLocationId,
    dagLocationSlot: gameSession.dagLocationSlot || gameSession.locationId,
    mode: gameSession.currentMode,
    sceneId: gameSession.activeSceneId,
    tongPrompt: FIXTURES.gameStart.tongPrompt || 'tong.system.food_street_intro.v1',
    profile: cloneJson(gameSession.profile),
    progression: cloneJson(gameSession.progression),
    actions: cloneJson(gameSession.availableActions),
    resumeSource: nextResumeSource,
    recentMediaRationale: cloneJson(personalization),
    gameSession: cloneJson(gameSession),
    sceneSession: responseSceneSession,
    activeCheckpoint: effectiveCheckpoint ? cloneJson(effectiveCheckpoint) : null,
    availableScenarioSeeds: buildScenarioSeeds(gameSession),
  };
}

function getCheckpointRouteVersion(checkpoint) {
  const routeVersion = checkpoint?.route?.query?.checkpoint;
  if (typeof routeVersion === 'string' && routeVersion.trim().length > 0) {
    return routeVersion.trim();
  }

  const rngVersion = checkpoint?.rng?.version;
  if (
    Number.isFinite(rngVersion) &&
    typeof checkpoint?.checkpointId === 'string' &&
    checkpoint.checkpointId.startsWith('ckpt_')
  ) {
    return String(rngVersion);
  }

  return null;
}

function resolveResumeCheckpoint({ userId, sessionId, requestedCity, resumeCheckpointId }) {
  if (!resumeCheckpointId) {
    return null;
  }

  const normalizedResumeCheckpointId = String(resumeCheckpointId).trim();
  if (!normalizedResumeCheckpointId) {
    return null;
  }

  const directCheckpoint = state.checkpoints.get(normalizedResumeCheckpointId);
  if (directCheckpoint) {
    return directCheckpoint;
  }

  const activeSessionId = state.activeSessionByUser.get(userId) || null;
  let resolvedCheckpoint = null;

  for (const checkpoint of state.checkpoints.values()) {
    const gameSession = state.sessions.get(checkpoint.gameSessionId);
    if (!gameSession || gameSession.userId !== userId) {
      continue;
    }
    if (sessionId && checkpoint.gameSessionId !== sessionId) {
      continue;
    }
    if (requestedCity && checkpoint.cityId !== requestedCity) {
      continue;
    }
    if (getCheckpointRouteVersion(checkpoint) !== normalizedResumeCheckpointId) {
      continue;
    }

    if (!resolvedCheckpoint) {
      resolvedCheckpoint = checkpoint;
      continue;
    }

    const resolvedIsActive = resolvedCheckpoint.gameSessionId === activeSessionId;
    const candidateIsActive = checkpoint.gameSessionId === activeSessionId;
    if (candidateIsActive && !resolvedIsActive) {
      resolvedCheckpoint = checkpoint;
      continue;
    }
    if (
      candidateIsActive === resolvedIsActive &&
      (checkpoint.createdAtIso || '') > (resolvedCheckpoint.createdAtIso || '')
    ) {
      resolvedCheckpoint = checkpoint;
    }
  }

  return resolvedCheckpoint;
}

function findGameSessionForResume({ userId, sessionId, resumeCheckpointId, requestedCity = null }) {
  if (resumeCheckpointId) {
    const checkpoint = resolveResumeCheckpoint({
      userId,
      sessionId,
      requestedCity,
      resumeCheckpointId,
    });
    if (checkpoint) {
      return state.sessions.get(checkpoint.gameSessionId) || null;
    }
  }

  if (sessionId && state.sessions.has(sessionId)) {
    const gameSession = state.sessions.get(sessionId);
    if (gameSession?.userId === userId) {
      return gameSession;
    }
  }

  const activeSessionId = state.activeSessionByUser.get(userId);
  if (activeSessionId) {
    return state.sessions.get(activeSessionId) || null;
  }

  return null;
}

function createNewGameSession(userId, incomingProfile, requestedCity) {
  const profile = incomingProfile || getProfile(userId) || FIXTURES.gameStart.profile;
  const ingestion = ensureIngestionForUser(userId);
  const dominantClusterId = getDominantClusterId(ingestion);
  const requestedOrDerivedCity =
    requestedCity === 'tokyo' || requestedCity === 'shanghai' || requestedCity === 'seoul'
      ? requestedCity
      : CLUSTER_CITY_MAP[dominantClusterId] || FIXTURES.gameStart.city || 'seoul';
  const bootstrapLang = getBootstrapPilotLanguage(profile, requestedOrDerivedCity);
  const cityRuntimeObjectiveConfig = getRuntimeObjectiveConfig({
    lang: bootstrapLang,
    cityId: requestedOrDerivedCity,
  });
  const city = requestedOrDerivedCity;
  const resolvedMapLocation = resolveWorldMapLocation(
    city,
    cityRuntimeObjectiveConfig?.mapLocationId ||
      cityRuntimeObjectiveConfig?.locationId ||
      CLUSTER_LOCATION_MAP[dominantClusterId] ||
      null,
  );
  const location = resolvedMapLocation.dagLocationSlot;
  const objective = buildPersonalizedObjective({
    userId,
    mode: 'hangout',
    lang: bootstrapLang,
    city,
    location: resolvedMapLocation.mapLocationId,
  });
  const nowIso = new Date().toISOString();
  const sessionId = `sess_${Math.random().toString(36).slice(2, 10)}`;
  const sceneId = `${location}_hangout_intro`;
  const sceneSessionId = `scene_${sessionId}_001`;
  const progression = buildInitialProgression();
  const missionGate = buildInitialMissionGate(progression);
  const unlocks = buildInitialUnlocks(location);
  const activeObjective = buildActiveObjectiveDescriptor({
    objective,
    lang: bootstrapLang,
    city,
    location,
  });
  const gameSession = {
    sessionId,
    userId,
    status: 'active',
    profile: cloneJson(profile),
    cityId: city,
    locationId: location,
    mapLocationId: resolvedMapLocation.mapLocationId,
    dagLocationSlot: location,
    currentMode: 'hangout',
    activeSceneId: sceneId,
    activeSceneSessionId: sceneSessionId,
    activeObjective,
    progression: cloneJson(progression),
    missionGate: cloneJson(missionGate),
    unlocks: cloneJson(unlocks),
    rewards: [],
    availableActions: buildGameActions(bootstrapLang, objective.objectiveId),
    resumeSource: 'new_session',
    startedAtIso: nowIso,
    updatedAtIso: nowIso,
  };
  const sceneSession = {
    sceneSessionId,
    gameSessionId: sessionId,
    sceneId,
    cityId: city,
    locationId: location,
    mapLocationId: resolvedMapLocation.mapLocationId,
    dagLocationSlot: location,
    mode: 'hangout',
    objective: cloneJson(activeObjective),
    phase: 'intro',
    turn: 1,
    route: buildHangoutRoute(city, location),
    progressionDelta: {
      xp: 0,
      sp: 0,
      rp: 0,
      objectiveProgressDelta: 0,
      validatedHangoutsDelta: 0,
    },
    checkpointable: true,
    uiPolicy: {
      immersiveFirstPerson: true,
      allowOnlyDialogueAndHints: true,
    },
    startedAtIso: nowIso,
    updatedAtIso: nowIso,
    score: {
      xp: progression.xp,
      sp: progression.sp,
      rp: progression.rp,
    },
  };

  state.sessions.set(sessionId, gameSession);
  state.sceneSessions.set(sceneSessionId, sceneSession);
  const checkpoint = persistCheckpoint(gameSession, sceneSession, CHECKPOINT_BOUNDARIES.scene_start, nowIso);
  return buildGameStartResponse(gameSession, sceneSession, checkpoint, 'new_session');
}

function resumeGameSession(gameSession, resumeCheckpointId) {
  const checkpoint =
    resolveResumeCheckpoint({
      userId: gameSession.userId,
      sessionId: gameSession.sessionId,
      requestedCity: gameSession.cityId,
      resumeCheckpointId,
    }) ||
    (gameSession.activeCheckpointId ? state.checkpoints.get(gameSession.activeCheckpointId) : null);
  const sceneSession = checkpoint
    ? hydrateSceneSessionFromCheckpoint(gameSession, checkpoint)
    : state.sceneSessions.get(gameSession.activeSceneSessionId);
  const effectiveCheckpoint =
    checkpoint ||
    (sceneSession ? persistCheckpoint(gameSession, sceneSession, CHECKPOINT_BOUNDARIES.scene_start) : null);

  return buildGameStartResponse(gameSession, sceneSession, effectiveCheckpoint, 'checkpoint');
}

function resumeGameSessionFromScenarioSeed(gameSession, scenarioSeedId) {
  const scenarioSeed = buildScenarioSeeds(gameSession).find((seed) => seed.seedId === scenarioSeedId);
  if (!scenarioSeed) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const previousCheckpointId = gameSession.activeCheckpointId || null;
  gameSession.cityId = scenarioSeed.cityId;
  gameSession.locationId = scenarioSeed.locationId;
  gameSession.currentMode = scenarioSeed.mode;
  gameSession.activeObjective = cloneJson(scenarioSeed.objective);
  gameSession.activeSceneId = `${scenarioSeed.locationId}_${scenarioSeed.mode}_intro`;
  gameSession.resumeSource = 'scenario_seed';
  gameSession.updatedAtIso = nowIso;

  const sceneSession = {
    sceneSessionId: gameSession.activeSceneSessionId,
    gameSessionId: gameSession.sessionId,
    sceneId: gameSession.activeSceneId,
    cityId: scenarioSeed.cityId,
    locationId: scenarioSeed.locationId,
    mode: scenarioSeed.mode,
    objective: cloneJson(scenarioSeed.objective),
    phase: scenarioSeed.phase,
    turn: scenarioSeed.turn,
    route: cloneJson(scenarioSeed.route),
    progressionDelta: cloneJson(
      scenarioSeed.progressionDelta || {
        xp: 0,
        sp: 0,
        rp: 0,
        objectiveProgressDelta: 0,
        validatedHangoutsDelta: 0,
      },
    ),
    checkpointable: true,
    uiPolicy: {
      immersiveFirstPerson: true,
      allowOnlyDialogueAndHints: true,
    },
    startedAtIso: gameSession.startedAtIso,
    updatedAtIso: nowIso,
    score: {
      xp: gameSession.progression.xp,
      sp: gameSession.progression.sp,
      rp: gameSession.progression.rp,
    },
  };

  if (scenarioSeed.activeExercise) {
    sceneSession.activeExercise = cloneJson(scenarioSeed.activeExercise);
  }

  const checkpoint = createCheckpointFromScenarioSeed(gameSession, scenarioSeed, nowIso);
  delete gameSession.activeCheckpointId;

  if (previousCheckpointId) {
    state.checkpoints.delete(previousCheckpointId);
  }

  state.sceneSessions.set(sceneSession.sceneSessionId, sceneSession);
  state.sessions.set(gameSession.sessionId, gameSession);
  if (state.activeSessionByUser.get(gameSession.userId) === gameSession.sessionId) {
    state.activeSessionByUser.delete(gameSession.userId);
  }
  saveDurableState();

  return buildGameStartResponse(gameSession, sceneSession, checkpoint, 'scenario_seed');
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
  const existing = state.sceneSessions.get(sceneSessionId);

  if (!existing) {
    return {
      statusCode: 404,
      payload: {
        error: 'unknown_scene_session',
      },
    };
  }

  const initialCopyBundle = getHangoutCopyBundle({ sceneSession: existing, body });
  const goodPatterns = HANGOUT_MATCH_PATTERNS[initialCopyBundle.lang] || HANGOUT_MATCH_PATTERNS.ko;
  const matched = goodPatterns.some((pattern) => userUtterance.includes(pattern));
  const xpDelta = matched ? 8 : 4;
  const spDelta = matched ? 2 : 1;
  const rpDelta = matched ? 1 : 0;
  const objectiveProgressDelta = matched ? 0.25 : 0.1;

  existing.turn += 1;
  existing.phase = 'dialogue';

  if (!existing.gameSessionId) {
    existing.score.xp += xpDelta;
    existing.score.sp += spDelta;
    existing.score.rp += rpDelta;
    state.sceneSessions.set(sceneSessionId, existing);
    const statelessCopy = initialCopyBundle.copy;

    return {
      statusCode: 200,
      payload: {
        accepted: true,
        feedback: {
          tongHint: matched
            ? statelessCopy.successHint || 'Great phrasing. You used practical ordering language.'
            : statelessCopy.retryHint || 'Try adding a food word plus polite ending like 주세요.',
          objectiveProgressDelta,
        },
        nextLine: {
          speaker: 'character',
          text:
            existing.turn % 2 === 0
              ? statelessCopy.nextTurnEven || '좋아요, 맵기는 어느 정도로 할까요?'
              : statelessCopy.nextTurnOdd || '좋아요! 다음 주문도 한국어로 말해 볼까요?',
        },
        state: {
          turn: existing.turn,
          score: { ...existing.score },
        },
      },
    };
  }

  const gameSession = state.sessions.get(existing.gameSessionId);
  if (!gameSession) {
    return {
      statusCode: 404,
      payload: {
        error: 'unknown_game_session',
      },
    };
  }

  const localizedCopy = getHangoutCopyBundle({
    sceneSession: existing,
    gameSession,
    body,
  }).copy;

  gameSession.progression.xp += xpDelta;
  gameSession.progression.sp += spDelta;
  gameSession.progression.rp += rpDelta;
  gameSession.missionGate.readiness = Math.min(
    1,
    Number((gameSession.missionGate.readiness + objectiveProgressDelta).toFixed(2)),
  );
  if (matched) {
    gameSession.missionGate.validatedHangouts += 1;
  }
  existing.progressionDelta.xp += xpDelta;
  existing.progressionDelta.sp += spDelta;
  existing.progressionDelta.rp += rpDelta;
  existing.progressionDelta.objectiveProgressDelta = Number(
    ((existing.progressionDelta.objectiveProgressDelta || 0) + objectiveProgressDelta).toFixed(2),
  );
  existing.progressionDelta.validatedHangoutsDelta =
    (existing.progressionDelta.validatedHangoutsDelta || 0) + (matched ? 1 : 0);
  ensureProgressionMilestones(gameSession, new Date().toISOString());
  existing.score = {
    xp: gameSession.progression.xp,
    sp: gameSession.progression.sp,
    rp: gameSession.progression.rp,
  };

  const nextLine =
    existing.turn % 2 === 0
      ? localizedCopy.nextTurnEven || '좋아요, 맵기는 어느 정도로 할까요?'
      : localizedCopy.nextTurnOdd || '좋아요! 다음 주문도 한국어로 말해 볼까요?';
  const checkpoint = persistCheckpoint(
    gameSession,
    existing,
    CHECKPOINT_BOUNDARIES.turn_end,
    new Date().toISOString(),
  );

  const response = {
    accepted: true,
    feedback: {
      tongHint: matched
        ? localizedCopy.successHint || 'Great phrasing. You used practical ordering language.'
        : localizedCopy.retryHint || 'Try adding a food word plus polite ending like 주세요.',
      objectiveProgressDelta,
    },
    nextLine: {
      speaker: 'character',
      text: nextLine,
    },
    state: {
      turn: existing.turn,
      score: { ...gameSession.progression },
      objectiveProgress: existing.progressionDelta.objectiveProgressDelta,
    },
    activeCheckpoint: checkpoint,
    routeState: {
      sessionId: gameSession.sessionId,
      checkpointId: checkpoint.checkpointId,
    },
  };

  return { statusCode: 200, payload: response };
}

function startHangoutScene(body = {}) {
  const userId = body.userId || DEFAULT_USER_ID;
  const requestedSessionId =
    typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId : null;
  const gameSession =
    findGameSessionForResume({
      userId,
      sessionId: requestedSessionId,
      resumeCheckpointId: null,
    }) || null;

  if (gameSession) {
    const checkpoint = gameSession.activeCheckpointId ? state.checkpoints.get(gameSession.activeCheckpointId) : null;
    const sceneSession = checkpoint
      ? hydrateSceneSessionFromCheckpoint(gameSession, checkpoint)
      : state.sceneSessions.get(gameSession.activeSceneSessionId);

    if (sceneSession) {
      const score = {
        xp: gameSession.progression.xp,
        sp: gameSession.progression.sp,
        rp: gameSession.progression.rp,
      };
      const localizedCopy = getHangoutCopyBundle({
        sceneSession,
        gameSession,
        body,
      }).copy;
      sceneSession.score = score;
      state.sceneSessions.set(sceneSession.sceneSessionId, sceneSession);

      return {
        sceneSessionId: sceneSession.sceneSessionId,
        mode: 'hangout',
        uiPolicy: cloneJson(
          sceneSession.uiPolicy || {
            immersiveFirstPerson: true,
            allowOnlyDialogueAndHints: true,
          },
        ),
        resumeSource: checkpoint ? 'checkpoint' : 'new_session',
        checkpointId: checkpoint?.checkpointId || null,
        activeCheckpoint: checkpoint ? cloneJson(checkpoint) : null,
        state: {
          turn: sceneSession.turn,
          score,
          objectiveProgress: sceneSession.progressionDelta?.objectiveProgressDelta || 0,
        },
        initialLine: {
          speaker: 'character',
          text:
            sceneSession.turn > 1
              ? localizedCopy.resume || '좋아요, 이어서 주문해 볼까요? 방금 멈춘 지점부터예요.'
              : localizedCopy.start || '어서 와요! 오늘은 뭐 먹고 싶어요?',
        },
      };
    }
  }

  const sceneSessionId = `hang_${Math.random().toString(36).slice(2, 8)}`;
  const score = { xp: 0, sp: 0, rp: 0 };
  const initialCopyBundle = getHangoutCopyBundle({ body });
  const statelessObjectiveConfig =
    getRuntimeObjectiveConfig({ objectiveId: body.objectiveId || null }) ||
    getRuntimeObjectiveConfig({
      lang: initialCopyBundle.lang,
      cityId: body.city || null,
    }) ||
    getRuntimeObjectiveConfig({
      objectiveId: DEFAULT_OBJECTIVE_BY_LANG[initialCopyBundle.lang] || DEFAULT_OBJECTIVE_BY_LANG.ko,
    }) ||
    null;
  state.sceneSessions.set(sceneSessionId, {
    userId,
    cityId: body.city || statelessObjectiveConfig?.cityId || 'seoul',
    locationId: resolveWorldMapLocation(
      body.city || statelessObjectiveConfig?.cityId || 'seoul',
      body.location || statelessObjectiveConfig?.mapLocationId || statelessObjectiveConfig?.locationId || 'food_street',
    ).dagLocationSlot,
    mapLocationId: resolveWorldMapLocation(
      body.city || statelessObjectiveConfig?.cityId || 'seoul',
      body.location || statelessObjectiveConfig?.mapLocationId || statelessObjectiveConfig?.locationId || 'food_street',
    ).mapLocationId,
    mode: 'hangout',
    objective: statelessObjectiveConfig
      ? withObjectiveIdentity(
          {
            lang: statelessObjectiveConfig.lang || initialCopyBundle.lang,
            mode: 'hangout',
          },
          statelessObjectiveConfig.objectiveId,
        )
      : null,
    phase: 'intro',
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
      text: initialCopyBundle.copy.start || '어서 와요! 오늘은 뭐 먹고 싶어요?',
    },
  };
}

function listLearnSessions() {
  return [...state.learnSessions].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

function createLearnSession(body = {}) {
  const learnSessionId = `learn_${Math.random().toString(36).slice(2, 8)}`;
  const requestedObjectiveId = body.objectiveId || DEFAULT_OBJECTIVE_BY_LANG.ko;
  const resolvedObjective = resolveObjectiveIdentity(requestedObjectiveId);
  const title = `Food Street ${resolvedObjective.canonicalObjectiveId || 'Objective'} Drill`;
  const item = withObjectiveIdentity({
    learnSessionId,
    title,
    lastMessageAt: new Date().toISOString(),
  }, requestedObjectiveId);
  state.learnSessions.unshift(item);
  saveDurableState();

  return withObjectiveIdentity({
    learnSessionId,
    mode: 'learn',
    uiTheme: 'kakao_like',
    firstMessage: {
      speaker: 'tong',
      text: "New session started. We'll train 주문 phrases for your next hangout.",
    },
  }, item.objectiveId);
}

async function invokeAgentTool(toolName, rawArgs = {}) {
  const args = normalizeObject(rawArgs);
  const userId = typeof args.userId === 'string' && args.userId.trim() ? args.userId : DEFAULT_USER_ID;

  switch (toolName) {
    case 'ingestion.run_mock': {
      if (args.profile && typeof args.profile === 'object') {
        state.profiles.set(userId, { userId, profile: args.profile });
        saveDurableState();
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
      const city =
        args.city === 'tokyo' || args.city === 'shanghai' || args.city === 'seoul' ? args.city : 'seoul';
      const location = resolveWorldMapLocation(city, args.location).mapLocationId;
      const objective = buildPersonalizedObjective({
        userId,
        mode,
        lang,
        city,
        location,
      });
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: objective,
        },
      };
    }
    case 'graph.dashboard.get': {
      const city = args.city === 'tokyo' || args.city === 'shanghai' || args.city === 'seoul' ? args.city : undefined;
      const location = city ? (args.location || undefined) : args.location;
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            worldMapRegistry: cloneJson(WORLD_MAP_REGISTRY),
            ...getGraphDashboard({ ...args, city, location }),
          },
        },
      };
    }
    case 'graph.next_actions.get': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: getGraphNextActions(args),
        },
      };
    }
    case 'graph.lesson_bundle.get': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: getGraphLessonBundle(args),
        },
      };
    }
    case 'graph.hangout_bundle.get': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: getGraphHangoutBundle(args),
        },
      };
    }
    case 'graph.evidence.record': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: recordGraphEvidence(args),
        },
      };
    }
    case 'graph.pack.validate': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: validatePack(args.pack),
        },
      };
    }
    case 'graph.overlay.propose': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: proposeGraphOverlay(args),
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
    case 'volcengine.video.delete': {
      try {
        const result = await deleteVideoTask(args.taskId);
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
    case 'scene-builder.generate-images': {
      try {
        const scenes = args.scenes;
        if (!Array.isArray(scenes) || scenes.length === 0) {
          return {
            statusCode: 400,
            payload: { ok: false, tool: toolName, error: 'scenes array is required' },
          };
        }

        const style = args.style || 'cinematic storyboard concept art, film scene sketch';
        const aspectRatio = args.aspect_ratio || '16:9';

        // Generate all scene images in parallel
        const results = await Promise.allSettled(
          scenes.map(async (scene) => {
            const fullPrompt = `${style}, ${scene.prompt}`;
            const result = await replicateGenerateImage({
              prompt: fullPrompt,
              aspect_ratio: aspectRatio,
              output_format: 'jpg',
              number_of_images: 1,
            });
            return {
              sceneNumber: scene.sceneNumber,
              imageUrl: result.images?.[0] ?? null,
              predictionId: result.id,
              error: result.error,
            };
          })
        );

        const sceneResults = results.map((r, i) => {
          if (r.status === 'fulfilled') return r.value;
          return {
            sceneNumber: scenes[i].sceneNumber,
            imageUrl: null,
            error: r.reason?.message || 'Generation failed',
          };
        });

        return {
          statusCode: 200,
          payload: { ok: true, tool: toolName, result: { scenes: sceneResults } },
        };
      } catch (err) {
        return {
          statusCode: 502,
          payload: { ok: false, tool: toolName, error: err.message },
        };
      }
    }
    // ── Hunyuan 3D tools ─────────────────────────────────────────
    case 'hunyuan3d.status': {
      return {
        statusCode: 200,
        payload: { ok: true, tool: toolName, result: getHunyuan3dStatus() },
      };
    }
    case 'hunyuan3d.pro.submit': {
      try {
        const result = await submitHunyuan3dProJob(args);
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
    case 'hunyuan3d.pro.query': {
      try {
        const result = await queryHunyuan3dProJob(args.jobId);
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
    case 'hunyuan3d.pro.wait': {
      try {
        const result = await waitForHunyuan3dProJob(
          args.jobId,
          args.intervalMs || 5000,
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
    case 'hunyuan3d.rapid.submit': {
      try {
        const result = await submitHunyuan3dRapidJob(args);
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
    case 'hunyuan3d.rapid.query': {
      try {
        const result = await queryHunyuan3dRapidJob(args.jobId);
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
    case 'hunyuan3d.rapid.wait': {
      try {
        const result = await waitForHunyuan3dRapidJob(
          args.jobId,
          args.intervalMs || 3000,
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
    case 'hunyuan3d.texture.submit': {
      try {
        const result = await submitTextureJob(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.texture.query': {
      try {
        const result = await queryTextureJob(args.jobId);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.texture.wait': {
      try {
        const result = await waitForTextureJob(args.jobId, args.intervalMs || 5000, args.timeoutMs || 600000);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.reduceFace.submit': {
      try {
        const result = await submitReduceFaceJob(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.reduceFace.query': {
      try {
        const result = await queryReduceFaceJob(args.jobId);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.reduceFace.wait': {
      try {
        const result = await waitForReduceFaceJob(args.jobId, args.intervalMs || 5000, args.timeoutMs || 600000);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.uv.submit': {
      try {
        const result = await submitUVJob(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.uv.query': {
      try {
        const result = await queryUVJob(args.jobId);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.uv.wait': {
      try {
        const result = await waitForUVJob(args.jobId, args.intervalMs || 5000, args.timeoutMs || 600000);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.part.submit': {
      try {
        const result = await submitPartJob(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.part.query': {
      try {
        const result = await queryPartJob(args.jobId);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.part.wait': {
      try {
        const result = await waitForPartJob(args.jobId, args.intervalMs || 5000, args.timeoutMs || 600000);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.profile.submit': {
      try {
        const result = await submitProfileTo3dJob(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.profile.query': {
      try {
        const result = await queryProfileTo3dJob(args.jobId);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.profile.wait': {
      try {
        const result = await waitForProfileTo3dJob(args.jobId, args.intervalMs || 5000, args.timeoutMs || 600000);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'hunyuan3d.convert': {
      try {
        const result = await convert3dFormat(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    // ── Gemini Video Understanding ─────────────────────────────────
    case 'gemini.video.status': {
      return { statusCode: 200, payload: { ok: true, tool: toolName, result: getGeminiVideoStatus() } };
    }
    case 'gemini.video.upload': {
      try {
        const result = await uploadVideo(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'gemini.video.analyze': {
      try {
        const result = await analyzeVideo(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'gemini.video.analyze_playtest': {
      try {
        const result = await analyzePlaytestSession(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'gemini.video.presets': {
      return { statusCode: 200, payload: { ok: true, tool: toolName, result: listAnalysisPresets() } };
    }
    case 'gemini.video.results': {
      const result = args.analysisId ? getAnalysisResult(args.analysisId) : listAnalysisResults();
      return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
    }
    case 'gemini.video.files': {
      try {
        if (args.action === 'delete' && args.fileName) {
          const result = await deleteUploadedFile(args.fileName);
          return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
        }
        const result = await listUploadedFiles();
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    // ── Auto-fix pipeline ────────────────────────────────────────────
    case 'autofix.status': {
      return { statusCode: 200, payload: { ok: true, tool: toolName, result: getAutoFixStatus() } };
    }
    case 'autofix.run': {
      try {
        const result = await runAutoFix(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'autofix.jobs': {
      const result = args.jobId ? getAutoFixJob(args.jobId) : listAutoFixJobs();
      return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
    }
    // ── Signals keyword + search tools ──────────────────────────────
    case 'signals.keywords.save': {
      try {
        const result = saveKeywordSet(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.keywords.list': {
      return { statusCode: 200, payload: { ok: true, tool: toolName, result: listKeywordSets() } };
    }
    case 'signals.keywords.delete': {
      const deleted = deleteKeywordSet(args.id);
      return { statusCode: 200, payload: { ok: true, tool: toolName, result: { deleted, id: args.id } } };
    }
    case 'signals.search': {
      try {
        const result = await searchPlatform(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.targeted_scrape': {
      try {
        const result = await runTargetedScrape(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    // ── Signals generic tools ─────────────────────────────────────────
    case 'signals.browser_search': {
      try {
        const result = await browserSearch(args.keyword, { platforms: args.platforms, limit: args.limit, executionMode: args.executionMode });
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.browser_status': {
      return { statusCode: 200, payload: { ok: true, tool: toolName, result: getBrowserScraperStatus() } };
    }
    case 'signals.status': {
      return {
        statusCode: 200,
        payload: { ok: true, tool: toolName, result: getTrendStatus() },
      };
    }
    case 'signals.tiktok': {
      try {
        const result = await scrapeTikTokTrends(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.instagram': {
      try {
        const result = await scrapeInstagramTrends(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.xiaohongshu': {
      try {
        const result = await scrapeXHSTrends(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.all': {
      try {
        const result = await scrapeAllTrends(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    // ── Signals filter + brief tools ──────────────────────────────────
    case 'signals.extract_brief': {
      try {
        const result = await extractBriefFromMultimodal(args);
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.filter.engagement': {
      try {
        const result = filterByEngagement(args.results || [], { minViews: args.minViews, minLikes: args.minLikes });
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.filter.relevance': {
      try {
        const result = await scoreRelevance(args.results || [], args.brief || {}, { batchSize: args.batchSize, executionMode: args.executionMode });
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
    }
    case 'signals.filter.pipeline': {
      try {
        const result = await runFilterPipeline(args.results || [], args.brief || {}, { minViews: args.minViews, minLikes: args.minLikes, topN: args.topN, executionMode: args.executionMode });
        return { statusCode: 200, payload: { ok: true, tool: toolName, result } };
      } catch (err) {
        return { statusCode: 502, payload: { ok: false, tool: toolName, error: err.message } };
      }
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

    // Playtest session GET/PATCH — no auth required so sharable URLs work without demo password
    if (pathname.startsWith('/api/v1/playtest/sessions/') && req.method === 'GET') {
      const sessionId = pathname.replace('/api/v1/playtest/sessions/', '').split('/')[0];
      const session = state.playtestSessions.get(sessionId);
      if (!session) {
        jsonResponse(res, 404, { error: 'session_not_found', sessionId });
        return;
      }
      jsonResponse(res, 200, { sessionId: session.sessionId, config: session, status: session.status, createdAt: session.createdAt });
      return;
    }

    // Upload playtest session recording + annotations
    if (pathname.match(/^\/api\/v1\/playtest\/sessions\/[^/]+\/upload$/) && req.method === 'POST') {
      const sessionId = pathname.split('/')[5];
      const session = state.playtestSessions.get(sessionId);
      if (!session) {
        jsonResponse(res, 404, { error: 'session_not_found', sessionId });
        return;
      }

      // Save raw body to disk — multipart parsing for recordings
      const runsDir = path.join(repoRoot, 'apps', 'server', 'data', 'runs', sessionId);
      fs.mkdirSync(runsDir, { recursive: true });

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);

      // Extract content type and boundary
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('multipart/form-data')) {
        const boundaryMatch = contentType.match(/boundary=(.+)/);
        if (boundaryMatch) {
          const boundary = boundaryMatch[1];
          const parts = parseMultipart(body, boundary);

          for (const part of parts) {
            if (part.name === 'recording') {
              fs.writeFileSync(path.join(runsDir, 'recording.webm'), part.data);
            } else if (part.name === 'annotations') {
              fs.writeFileSync(path.join(runsDir, 'annotations.json'), part.data);
            }
          }
        }
      } else {
        // Raw body fallback
        fs.writeFileSync(path.join(runsDir, 'raw-upload'), body);
      }

      // Save session config alongside
      fs.writeFileSync(path.join(runsDir, 'config.json'), JSON.stringify(session, null, 2));

      // Mark session as submitted
      session.status = 'submitted';
      state.playtestSessions.set(sessionId, session);

      jsonResponse(res, 200, {
        ok: true,
        sessionId,
        storedAt: runsDir,
        files: fs.readdirSync(runsDir),
      });
      return;
    }

    if (pathname.startsWith('/api/v1/playtest/sessions/') && req.method === 'PATCH') {
      const sessionId = pathname.replace('/api/v1/playtest/sessions/', '').split('/')[0];
      const session = state.playtestSessions.get(sessionId);
      if (!session) {
        jsonResponse(res, 404, { error: 'session_not_found', sessionId });
        return;
      }
      const body = await readJsonBody(req);
      const validStatuses = ['pending', 'active', 'submitted'];
      if (body.status && validStatuses.includes(body.status)) {
        session.status = body.status;
        state.playtestSessions.set(sessionId, session);
      }
      jsonResponse(res, 200, { sessionId: session.sessionId, config: session, status: session.status, createdAt: session.createdAt });
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

    if (pathname === '/api/v1/graph/personas' && req.method === 'GET') {
      jsonResponse(res, 200, {
        generatedAtIso: new Date().toISOString(),
        items: listGraphPersonas(),
      });
      return;
    }

    if (pathname === '/api/v1/graph/dashboard' && req.method === 'GET') {
      const personaId = url.searchParams.get('personaId') || url.searchParams.get('learnerId') || undefined;
      const city = url.searchParams.get('city') || undefined;
      const location = url.searchParams.get('location') || undefined;
      const userId = getUserIdFromQuery(url.searchParams);
      jsonResponse(res, 200, {
        worldMapRegistry: cloneJson(WORLD_MAP_REGISTRY),
        ...getGraphDashboard({ personaId, userId, city, location }),
      });
      return;
    }

    if (pathname === '/api/v1/graph/next-actions' && req.method === 'GET') {
      const personaId = url.searchParams.get('personaId') || url.searchParams.get('learnerId') || undefined;
      const userId = getUserIdFromQuery(url.searchParams);
      const limit = Number(url.searchParams.get('limit') || 4);
      jsonResponse(res, 200, getGraphNextActions({ personaId, userId, limit }));
      return;
    }

    if (pathname === '/api/v1/graph/evidence' && req.method === 'POST') {
      const body = await readJsonBody(req);
      jsonResponse(res, 200, recordGraphEvidence(body));
      return;
    }

    if (pathname === '/api/v1/ingestion/run-mock' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromQuery(url.searchParams);
      if (body?.profile && typeof body.profile === 'object') {
        state.profiles.set(userId, { userId, profile: body.profile });
        saveDurableState();
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

    if (pathname === '/api/v1/integrations/spotify/connect' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      jsonResponse(res, 200, buildIntegrationConnectPayload(userId, 'spotify'));
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/callback' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      const status = setIntegrationState(userId, 'spotify', { connected: true });
      jsonResponse(res, 200, {
        ok: true,
        provider: 'spotify',
        userId,
        connected: status.connected,
        demoMode: true,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/status' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      jsonResponse(res, 200, buildIntegrationStatusPayload(userId, 'spotify'));
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/sync' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromQuery(url.searchParams);
      jsonResponse(res, 200, buildIntegrationSyncPayload(userId, 'spotify', ['spotify']));
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/connect' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      jsonResponse(res, 200, buildIntegrationConnectPayload(userId, 'youtube'));
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/callback' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      const status = setIntegrationState(userId, 'youtube', { connected: true });
      jsonResponse(res, 200, {
        ok: true,
        provider: 'youtube',
        userId,
        connected: status.connected,
        demoMode: true,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/status' && req.method === 'GET') {
      const userId = getUserIdFromQuery(url.searchParams);
      jsonResponse(res, 200, buildIntegrationStatusPayload(userId, 'youtube'));
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/sync' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromQuery(url.searchParams);
      jsonResponse(res, 200, buildIntegrationSyncPayload(userId, 'youtube', ['youtube']));
      return;
    }

    if (pathname === '/api/v1/game/start-or-resume' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || DEFAULT_USER_ID;
      if (body.profile) {
        state.profiles.set(userId, { userId, profile: body.profile });
        saveDurableState();
      }
      const existingSession = findGameSessionForResume({
        userId,
        sessionId: body.sessionId,
        resumeCheckpointId: body.resumeCheckpointId,
        requestedCity: body.city,
      });

      let response;
      if (body.scenarioSeedId) {
        const targetSession = createNewGameSession(userId, body.profile, body.city).gameSession;
        response = resumeGameSessionFromScenarioSeed(targetSession, body.scenarioSeedId);

        if (!response) {
          jsonResponse(res, 404, {
            error: 'unknown_scenario_seed',
            scenarioSeedId: body.scenarioSeedId,
          });
          return;
        }
      } else {
        response = existingSession
          ? resumeGameSession(existingSession, body.resumeCheckpointId)
          : createNewGameSession(userId, body.profile, body.city);
      }

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
      saveDurableState();
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
        city: getCityId(url.searchParams),
        location: getLocationId(url.searchParams),
      });
      jsonResponse(res, 200, objective);
      return;
    }

    if (pathname === '/api/v1/scenes/hangout/start' && req.method === 'POST') {
      const body = await readJsonBody(req);
      jsonResponse(res, 200, startHangoutScene(body));
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

    /* ── Director: publish generated content ────────────────── */
    if (pathname === '/api/v1/director/publish' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const contentDir = path.join(repoRoot, 'apps/server/data/content');
      if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

      const { pipelineId, concept, characters, curriculum, backdrop } = body;
      const outPath = path.join(contentDir, `${pipelineId.replace(':', '_')}.json`);
      fs.writeFileSync(outPath, JSON.stringify({ pipelineId, concept, characters, curriculum, backdrop, publishedAt: new Date().toISOString() }, null, 2));
      console.log(`[director] Published ${pipelineId} → ${outPath}`);
      jsonResponse(res, 200, { ok: true, pipelineId, path: outPath });
      return;
    }

    if (pathname === '/api/v1/director/content' && req.method === 'GET') {
      const contentDir = path.join(repoRoot, 'apps/server/data/content');
      if (!fs.existsSync(contentDir)) {
        jsonResponse(res, 200, { items: [] });
        return;
      }
      const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.json'));
      const items = files.map(f => JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf8')));
      jsonResponse(res, 200, { items });
      return;
    }

    if (pathname.startsWith('/api/v1/director/content/') && req.method === 'GET') {
      const id = pathname.replace('/api/v1/director/content/', '').replace(':', '_');
      const filePath = path.join(repoRoot, 'apps/server/data/content', `${id}.json`);
      if (fs.existsSync(filePath)) {
        jsonResponse(res, 200, JSON.parse(fs.readFileSync(filePath, 'utf8')));
      } else {
        jsonResponse(res, 404, { error: 'not_found', id });
      }
      return;
    }

    /* ── Auto-fix pipeline (auth required) ── */

    if (pathname === '/api/v1/playtest/autofix' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.sessionId || !body.issue) {
        jsonResponse(res, 400, { error: 'sessionId_and_issue_required' });
        return;
      }
      try {
        const result = await runAutoFix(body);
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    if (pathname === '/api/v1/playtest/autofix/jobs' && req.method === 'GET') {
      const jobId = url.searchParams.get('id');
      const result = jobId ? getAutoFixJob(jobId) : listAutoFixJobs();
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    /* ── Playtest sessions — GET list + POST create (auth required) ── */

    if (pathname === '/api/v1/playtest/sessions' && req.method === 'GET') {
      const allSessions = [...state.playtestSessions.values()]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      jsonResponse(res, 200, { sessions: allSessions });
      return;
    }

    if (pathname === '/api/v1/playtest/sessions' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.city || !body.sceneType) {
        jsonResponse(res, 400, { error: 'city_and_sceneType_required' });
        return;
      }
      const session = createPlaytestSession(body);
      jsonResponse(res, 201, {
        sessionId: session.sessionId,
        url: `/playtest/${session.sessionId}`,
        config: session,
        createdAt: session.createdAt,
      });
      return;
    }

    // ── Signals keyword + search routes (public) ─────────────────────

    if (pathname === '/api/v1/signals/keywords' && req.method === 'GET') {
      jsonResponse(res, 200, { ok: true, sets: listKeywordSets() });
      return;
    }

    if (pathname === '/api/v1/signals/keywords' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const set = saveKeywordSet(body);
      jsonResponse(res, 201, { ok: true, set });
      return;
    }

    if (pathname.match(/^\/api\/v1\/signals\/keywords\/[^/]+$/) && req.method === 'DELETE') {
      const id = pathname.split('/').pop();
      const deleted = deleteKeywordSet(id);
      jsonResponse(res, 200, { ok: true, deleted, id });
      return;
    }

    if (pathname === '/api/v1/signals/search' && req.method === 'POST') {
      const body = await readJsonBody(req);
      try {
        const result = await searchPlatform({
          ...body,
          executionMode: body.executionMode || body.mode,
        });
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    if (pathname === '/api/v1/signals/targeted-scrape' && req.method === 'POST') {
      const body = await readJsonBody(req);
      try {
        const result = await runTargetedScrape({
          ...body,
          executionMode: body.executionMode || body.mode,
        });
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    // ── Browser-based signal search ────────────────────────────────

    if (pathname === '/api/v1/signals/browser-search' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.keyword) {
        jsonResponse(res, 400, { error: 'keyword_required' });
        return;
      }
      try {
        const result = await browserSearch(body.keyword, {
          platforms: body.platforms,
          limit: body.limit,
          executionMode: body.executionMode || body.mode,
        });
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    if (pathname === '/api/v1/signals/browser-status' && req.method === 'GET') {
      jsonResponse(res, 200, { ok: true, ...getBrowserScraperStatus() });
      return;
    }

    // ── Signal filter + brief routes ─────────────────────────────────

    if (pathname === '/api/v1/signals/extract-brief' && req.method === 'POST') {
      const body = await readJsonBody(req);
      try {
        const result = await extractBriefFromMultimodal(body);
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    if (pathname === '/api/v1/signals/generate-keywords' && req.method === 'POST') {
      const body = await readJsonBody(req);
      try {
        // Step 1: extract brief from multimodal inputs
        const { brief } = await extractBriefFromMultimodal(body);
        // Step 2: generate keywords from brief via OpenAI
        const sets = await generateKeywordsFromBrief(brief, { executionMode: body.executionMode || body.mode });
        // Step 3: save keyword sets
        for (const kw of sets) {
          saveKeywordSet({ ...kw, source: 'multimodal' });
        }
        jsonResponse(res, 200, { ok: true, brief, keywordSets: sets, saved: sets.length });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    if (pathname === '/api/v1/signals/filter' && req.method === 'POST') {
      const body = await readJsonBody(req);
      try {
        const result = await runFilterPipeline(
          body.results || [],
          body.brief || {},
          { minViews: body.minViews, minLikes: body.minLikes, topN: body.topN, batchSize: body.batchSize, executionMode: body.executionMode },
        );
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    // ── Signal scheduler routes ─────────────────────────────────────

    if (pathname === '/api/v1/signals/scheduler/status' && req.method === 'GET') {
      jsonResponse(res, 200, { ok: true, ...getSchedulerStatus() });
      return;
    }

    if (pathname === '/api/v1/signals/scheduler/start' && req.method === 'POST') {
      jsonResponse(res, 200, { ok: true, ...startScheduler() });
      return;
    }

    if (pathname === '/api/v1/signals/scheduler/stop' && req.method === 'POST') {
      jsonResponse(res, 200, { ok: true, ...stopScheduler() });
      return;
    }

    if (pathname === '/api/v1/signals/scheduler/run' && req.method === 'POST') {
      const body = await readJsonBody(req);
      try {
        const result = await runSignalGathering(body);
        jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        jsonResponse(res, 502, { ok: false, error: err.message });
      }
      return;
    }

    // ── Signals generic routes ────────────────────────────────────────

    if (pathname === '/api/v1/signals/status' && req.method === 'GET') {
      jsonResponse(res, 200, { ok: true, ...getTrendStatus() });
      return;
    }

    if (pathname === '/api/v1/signals/latest' && req.method === 'GET') {
      const platform = url.searchParams.get('platform') || null;
      const scrapers = {
        tiktok: scrapeTikTokTrends,
        instagram: scrapeInstagramTrends,
        xiaohongshu: scrapeXHSTrends,
      };
      const opts = {
        limit: Number(url.searchParams.get('limit') || 20) || 20,
        language: url.searchParams.get('language') || undefined,
        category: url.searchParams.get('category') || undefined,
      };

      if (platform && scrapers[platform]) {
        const result = await scrapers[platform](opts);
        jsonResponse(res, 200, { ok: true, ...result });
      } else {
        const result = await scrapeAllTrends(opts);
        jsonResponse(res, 200, { ok: true, ...result });
      }
      return;
    }

    if (pathname === '/api/v1/signals/scrape' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const options = {
        platforms: body.platforms || undefined,
        limit: body.options?.limit || body.limit || 20,
        language: body.options?.language || body.language || undefined,
        category: body.options?.category || body.category || undefined,
        __mock: body.options?.__mock || body.__mock || undefined,
      };
      const result = await scrapeAllTrends(options);
      jsonResponse(res, 200, { ok: true, ...result });
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

loadDurableState();
ensureIngestionForUser(DEFAULT_USER_ID);
saveDurableState();

export const __testing = {
  CHECKPOINT_BOUNDARIES,
  state,
  createNewGameSession,
  createCheckpointRecord,
  findGameSessionForResume,
  persistCheckpoint,
  resumeGameSession,
  restoreGameSessionFromCheckpoint,
  resetState() {
    state.profiles.clear();
    state.sessions.clear();
    state.sceneSessions.clear();
    state.checkpoints.clear();
    state.activeSessionByUser.clear();
    state.learnSessions = [...(FIXTURES.learnSessions.items || [])];
    state.ingestionByUser.clear();
    ensureIngestionForUser(DEFAULT_USER_ID);
    saveDurableState();
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  server.listen(PORT, () => {
    console.log(`Tong mock server listening on http://localhost:${PORT}`);
    // Auto-start signal scheduler if enabled
    const schedResult = startScheduler();
    if (schedResult.status === 'started') {
      console.log(`Signal scheduler started (interval: ${schedResult.intervalMs / 1000}s)`);
    }
  });
}

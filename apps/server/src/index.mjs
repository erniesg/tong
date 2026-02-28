import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeneratedSnapshot, runMockIngestion, writeGeneratedSnapshots } from './ingestion.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const PORT = Number(process.env.PORT || 8787);

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
const YOUTUBE_AUTH_URL = process.env.YOUTUBE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_URL = process.env.YOUTUBE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_SCOPE = process.env.YOUTUBE_SCOPE || 'https://www.googleapis.com/auth/youtube.readonly';
const YOUTUBE_STATE_TTL_MS = 10 * 60 * 1000;
const YOUTUBE_DEFAULT_SYNC_WINDOW_HOURS = 72;
const YOUTUBE_MAX_PAGES = 5;
const YOUTUBE_MAX_ITEMS_PER_SYNC = 120;
const YOUTUBE_CONNECT_DOCS_URL = 'https://developers.google.com/youtube/v3/getting-started';
const SPOTIFY_ACCOUNTS_BASE = process.env.SPOTIFY_ACCOUNTS_BASE || 'https://accounts.spotify.com';
const SPOTIFY_API_BASE = process.env.SPOTIFY_API_BASE || 'https://api.spotify.com/v1';
const SPOTIFY_SCOPE = process.env.SPOTIFY_SCOPE || 'user-read-recently-played';
const SPOTIFY_STATE_TTL_MS = 10 * 60 * 1000;
const SPOTIFY_DEFAULT_SYNC_WINDOW_HOURS = 72;
const SPOTIFY_MAX_PAGES = 5;
const SPOTIFY_CONNECT_DOCS_URL = 'https://developer.spotify.com/documentation/web-api';
const INGESTION_SOURCES = new Set(['youtube', 'spotify']);

const state = {
  profiles: new Map(),
  sessions: new Map(),
  learnSessions: [...(FIXTURES.learnSessions.items || [])],
  ingestionByUser: new Map(),
  youtubeAuthStates: new Map(),
  youtubeTokensByUser: new Map(),
  youtubeRecentByUser: new Map(),
  spotifyAuthStates: new Map(),
  spotifyTokensByUser: new Map(),
  spotifyRecentByUser: new Map(),
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
    name: 'integrations.youtube.sync_mock',
    description: 'Refresh mock ingestion from YouTube-only source items.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      profile: 'object (optional)',
    },
  },
  {
    name: 'integrations.youtube.status',
    description: 'Get YouTube connection and sync status for a user.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'integrations.youtube.connect',
    description: 'Generate YouTube OAuth connect URL for a user.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'integrations.youtube.sync',
    description: 'Run real YouTube sync for a connected user.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      windowHours: 'number (optional)',
    },
  },
  {
    name: 'integrations.spotify.sync_mock',
    description: 'Refresh mock ingestion from Spotify-only source items.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      profile: 'object (optional)',
    },
  },
  {
    name: 'integrations.spotify.status',
    description: 'Get Spotify connection and sync status for a user.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'integrations.spotify.connect',
    description: 'Generate Spotify OAuth connect URL for a user.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'integrations.spotify.sync',
    description: 'Run real Spotify sync for a connected user.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      windowHours: 'number (optional)',
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
  {
    name: 'game.start_or_resume',
    description: 'Start or resume game session from profile + ingestion context.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      profile: 'object (optional)',
    },
  },
  {
    name: 'scenes.hangout.start',
    description: 'Start a stateful hangout scene session.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'scenes.hangout.respond',
    description: 'Submit user utterance and advance a stateful hangout scene.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      sceneSessionId: 'string (required)',
      userUtterance: 'string (required)',
      toolContext: 'object (optional)',
    },
  },
  {
    name: 'learn.sessions.list',
    description: 'List recent learn sessions.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
    },
  },
  {
    name: 'learn.sessions.create',
    description: 'Create a new objective-bound learn session.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      userId: 'string (optional)',
      objectiveId: 'string (optional)',
      city: 'string (optional)',
      lang: 'ko|ja|zh (optional)',
    },
  },
];

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function noContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getUserIdFromSearch(searchParams) {
  return searchParams.get('userId') || DEFAULT_USER_ID;
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeIngestionSources(value) {
  if (value == null) return [];

  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return [...new Set(
    raw
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => INGESTION_SOURCES.has(item)),
  )];
}

function getYouTubeRedirectUri() {
  return process.env.YOUTUBE_REDIRECT_URI || `http://127.0.0.1:${PORT}/api/v1/integrations/youtube/callback`;
}

function getYouTubeClientCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function youtubeConfigured() {
  return Boolean(getYouTubeClientCredentials());
}

function youtubeConfigErrorPayload() {
  return {
    error: 'youtube_not_configured',
    message: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET on the API server.',
    docs: YOUTUBE_CONNECT_DOCS_URL,
  };
}

function cleanupYouTubeAuthStates() {
  const now = Date.now();
  for (const [stateToken, payload] of state.youtubeAuthStates.entries()) {
    if (!payload?.createdAtMs || now - payload.createdAtMs > YOUTUBE_STATE_TTL_MS) {
      state.youtubeAuthStates.delete(stateToken);
    }
  }
}

function createYouTubeState(userId) {
  cleanupYouTubeAuthStates();
  const stateToken = crypto.randomBytes(18).toString('hex');
  state.youtubeAuthStates.set(stateToken, {
    userId,
    createdAtMs: Date.now(),
  });
  return stateToken;
}

function buildYouTubeAuthUrl(userId) {
  const creds = getYouTubeClientCredentials();
  if (!creds) return null;

  const stateToken = createYouTubeState(userId);
  const search = new URLSearchParams({
    response_type: 'code',
    client_id: creds.clientId,
    redirect_uri: getYouTubeRedirectUri(),
    scope: YOUTUBE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: stateToken,
  });

  return {
    stateToken,
    authUrl: `${YOUTUBE_AUTH_URL}?${search.toString()}`,
  };
}

function getSpotifyRedirectUri() {
  return process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/api/v1/integrations/spotify/callback`;
}

function getSpotifyClientCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function spotifyConfigured() {
  return Boolean(getSpotifyClientCredentials());
}

function spotifyConfigErrorPayload() {
  return {
    error: 'spotify_not_configured',
    message: 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET on the API server.',
    docs: SPOTIFY_CONNECT_DOCS_URL,
  };
}

function cleanupSpotifyAuthStates() {
  const now = Date.now();
  for (const [stateToken, payload] of state.spotifyAuthStates.entries()) {
    if (!payload?.createdAtMs || now - payload.createdAtMs > SPOTIFY_STATE_TTL_MS) {
      state.spotifyAuthStates.delete(stateToken);
    }
  }
}

function createSpotifyState(userId) {
  cleanupSpotifyAuthStates();
  const stateToken = crypto.randomBytes(18).toString('hex');
  state.spotifyAuthStates.set(stateToken, {
    userId,
    createdAtMs: Date.now(),
  });
  return stateToken;
}

function buildSpotifyAuthUrl(userId) {
  const creds = getSpotifyClientCredentials();
  if (!creds) return null;

  const stateToken = createSpotifyState(userId);
  const search = new URLSearchParams({
    response_type: 'code',
    client_id: creds.clientId,
    redirect_uri: getSpotifyRedirectUri(),
    scope: SPOTIFY_SCOPE,
    state: stateToken,
    show_dialog: 'true',
  });

  return {
    stateToken,
    authUrl: `${SPOTIFY_ACCOUNTS_BASE}/authorize?${search.toString()}`,
  };
}

function parseWindowHours(value, fallback = SPOTIFY_DEFAULT_SYNC_WINDOW_HOURS) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(24 * 14, Math.max(1, Math.round(numeric)));
}

function detectLangFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return 'ko';
  if (/[\p{Script=Hangul}]/u.test(text)) return 'ko';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja';
  if (/[\p{Script=Han}]/u.test(text)) return 'zh';
  return 'ko';
}

function parseIso8601DurationToMinutes(duration, fallbackMinutes = 6) {
  if (typeof duration !== 'string' || !duration.startsWith('P')) return fallbackMinutes;
  const match = duration.match(/P(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?)?/);
  if (!match) return fallbackMinutes;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return fallbackMinutes;
  return Number((totalSeconds / 60).toFixed(2));
}

function getYouTubeActivityVideoId(activity) {
  return (
    activity?.contentDetails?.upload?.videoId ||
    activity?.contentDetails?.playlistItem?.resourceId?.videoId ||
    activity?.contentDetails?.like?.resourceId?.videoId ||
    activity?.contentDetails?.recommendation?.resourceId?.videoId ||
    null
  );
}

function normalizeYouTubeActivityForIngestion(activity, videoDetailsById, index = 0) {
  const activitySnippet = activity?.snippet || {};
  const videoId = getYouTubeActivityVideoId(activity);
  const videoDetails = videoId ? videoDetailsById.get(videoId) : null;
  const videoSnippet = videoDetails?.snippet || {};
  const contentDetails = videoDetails?.contentDetails || {};

  const title = videoSnippet.title || activitySnippet.title || 'YouTube Activity';
  const channelTitle = videoSnippet.channelTitle || activitySnippet.channelTitle || '';
  const description = videoSnippet.description || activitySnippet.description || '';
  const text = `${title} ${channelTitle} ${description}`.trim();
  const playedAtIso = activitySnippet.publishedAt || new Date().toISOString();
  const playedAtEpoch = Date.parse(playedAtIso);

  return {
    id: `yt_recent_${videoId || activity?.id || 'activity'}_${Number.isFinite(playedAtEpoch) ? playedAtEpoch : index}`,
    source: 'youtube',
    title,
    lang: detectLangFromText(text),
    minutes: parseIso8601DurationToMinutes(contentDetails.duration, 8),
    text,
    playedAtIso,
  };
}

function normalizeSpotifyTrackForIngestion(rawTrack, index = 0) {
  const track = rawTrack?.track;
  if (!track || typeof track.name !== 'string') return null;
  const playedAtIso = rawTrack.played_at || new Date().toISOString();
  const playedAtEpoch = Date.parse(playedAtIso);
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist?.name).filter(Boolean).join(' ')
    : '';
  const text = `${track.name} ${artists}`.trim();
  const lang = detectLangFromText(text);

  return {
    id: `sp_recent_${track.id || 'track'}_${Number.isFinite(playedAtEpoch) ? playedAtEpoch : index}`,
    source: 'spotify',
    title: track.name,
    lang,
    minutes: Number((((Number(track.duration_ms) || 0) / 60000) || 0).toFixed(2)),
    text,
    playedAtIso,
  };
}

function buildIngestionSnapshotForUser(userId = DEFAULT_USER_ID, options = {}) {
  const includeSources = normalizeIngestionSources(options.includeSources);
  const snapshot = JSON.parse(fs.readFileSync(mockMediaWindowPath, 'utf8'));
  const youtubeSynced = state.youtubeRecentByUser.get(userId);
  const spotifySynced = state.spotifyRecentByUser.get(userId);
  const hasYouTube = Array.isArray(youtubeSynced?.items) && youtubeSynced.items.length > 0;
  const hasSpotify = Array.isArray(spotifySynced?.items) && spotifySynced.items.length > 0;

  if (!hasYouTube && !hasSpotify) {
    if (includeSources.length > 0) {
      snapshot.sourceItems = (snapshot.sourceItems || []).filter((item) => includeSources.includes(item.source));
    }
    return snapshot;
  }

  const nowIso = new Date().toISOString();
  let sourceItems = [...(snapshot.sourceItems || [])];
  const windowHours = [];

  if (hasYouTube) {
    sourceItems = sourceItems.filter((item) => item.source !== 'youtube');
    sourceItems.push(...youtubeSynced.items);
    windowHours.push(parseWindowHours(youtubeSynced.windowHours, YOUTUBE_DEFAULT_SYNC_WINDOW_HOURS));
  }
  if (hasSpotify) {
    sourceItems = sourceItems.filter((item) => item.source !== 'spotify');
    sourceItems.push(...spotifySynced.items);
    windowHours.push(parseWindowHours(spotifySynced.windowHours, SPOTIFY_DEFAULT_SYNC_WINDOW_HOURS));
  }

  const scopedWindowHours = windowHours.length > 0 ? Math.max(...windowHours) : SPOTIFY_DEFAULT_SYNC_WINDOW_HOURS;
  snapshot.sourceItems = sourceItems;
  snapshot.windowStartIso = new Date(Date.now() - scopedWindowHours * 60 * 60 * 1000).toISOString();
  snapshot.windowEndIso = nowIso;
  snapshot.generatedAtIso = nowIso;

  if (includeSources.length > 0) {
    snapshot.sourceItems = (snapshot.sourceItems || []).filter((item) => includeSources.includes(item.source));
  }

  return snapshot;
}

function formatIngestionRunResponse(result, includeSources = []) {
  return {
    success: true,
    generatedAtIso: result.generatedAtIso,
    includeSources: includeSources.length > 0 ? includeSources : ['youtube', 'spotify'],
    sourceCount: {
      youtube: result.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
      spotify: result.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
    },
    topTerms: result.frequency.items.slice(0, 10),
  };
}

function getYouTubeStatusPayload(userId = DEFAULT_USER_ID) {
  const token = state.youtubeTokensByUser.get(userId);
  const synced = state.youtubeRecentByUser.get(userId);

  return {
    userId,
    youtubeConfigured: youtubeConfigured(),
    connected: Boolean(token?.accessToken),
    tokenExpiresAtIso: token?.expiresAtEpochMs ? new Date(token.expiresAtEpochMs).toISOString() : null,
    tokenScope: token?.scope || null,
    lastSyncAtIso: synced?.syncedAtIso || null,
    lastSyncItemCount: Array.isArray(synced?.items) ? synced.items.length : 0,
    syncWindowHours: synced?.windowHours || null,
  };
}

function getSpotifyStatusPayload(userId = DEFAULT_USER_ID) {
  const token = state.spotifyTokensByUser.get(userId);
  const synced = state.spotifyRecentByUser.get(userId);

  return {
    userId,
    spotifyConfigured: spotifyConfigured(),
    connected: Boolean(token?.accessToken),
    tokenExpiresAtIso: token?.expiresAtEpochMs ? new Date(token.expiresAtEpochMs).toISOString() : null,
    tokenScope: token?.scope || null,
    lastSyncAtIso: synced?.syncedAtIso || null,
    lastSyncItemCount: Array.isArray(synced?.items) ? synced.items.length : 0,
    syncWindowHours: synced?.windowHours || null,
  };
}

async function fetchYouTubeToken(params) {
  const creds = getYouTubeClientCredentials();
  if (!creds) {
    throw new Error('youtube_not_configured');
  }

  const response = await fetch(YOUTUBE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      ...params,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'youtube_token_exchange_failed');
  }
  return data;
}

async function exchangeYouTubeCodeForToken(code) {
  const tokenData = await fetchYouTubeToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getYouTubeRedirectUri(),
  });

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    tokenType: tokenData.token_type,
    scope: tokenData.scope || YOUTUBE_SCOPE,
    expiresAtEpochMs: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
    obtainedAtIso: new Date().toISOString(),
  };
}

async function refreshYouTubeAccessToken(userId) {
  const existing = state.youtubeTokensByUser.get(userId);
  if (!existing?.refreshToken) {
    throw new Error('youtube_refresh_token_missing');
  }

  const tokenData = await fetchYouTubeToken({
    grant_type: 'refresh_token',
    refresh_token: existing.refreshToken,
  });

  const refreshed = {
    ...existing,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || existing.refreshToken,
    tokenType: tokenData.token_type || existing.tokenType,
    scope: tokenData.scope || existing.scope,
    expiresAtEpochMs: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
    obtainedAtIso: new Date().toISOString(),
  };

  state.youtubeTokensByUser.set(userId, refreshed);
  return refreshed.accessToken;
}

async function ensureYouTubeAccessToken(userId) {
  const token = state.youtubeTokensByUser.get(userId);
  if (!token?.accessToken) {
    throw new Error('youtube_not_connected');
  }

  if (token.expiresAtEpochMs && token.expiresAtEpochMs > Date.now() + 60 * 1000) {
    return token.accessToken;
  }

  return refreshYouTubeAccessToken(userId);
}

async function fetchYouTubeActivities(accessToken, windowHours = YOUTUBE_DEFAULT_SYNC_WINDOW_HOURS) {
  const cutoffMs = Date.now() - parseWindowHours(windowHours, YOUTUBE_DEFAULT_SYNC_WINDOW_HOURS) * 60 * 60 * 1000;
  const results = [];
  let pageToken = null;

  for (let page = 0; page < YOUTUBE_MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
    });
    if (pageToken) query.set('pageToken', pageToken);

    const response = await fetch(`${YOUTUBE_API_BASE}/activities?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      const errorMessage = payload?.error?.message || payload?.error || 'youtube_activities_fetch_failed';
      throw new Error(errorMessage);
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    for (const item of items) {
      const publishedAtMs = Date.parse(item?.snippet?.publishedAt || '');
      if (!Number.isFinite(publishedAtMs) || publishedAtMs >= cutoffMs) {
        results.push(item);
      }
    }

    pageToken = payload?.nextPageToken || null;
    if (!pageToken) break;
  }

  return results;
}

async function fetchYouTubeVideosById(accessToken, videoIds = []) {
  const deduped = [...new Set(videoIds.filter(Boolean))];
  const detailsById = new Map();
  if (deduped.length === 0) return detailsById;

  for (let i = 0; i < deduped.length; i += 50) {
    const chunk = deduped.slice(i, i + 50);
    const query = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: chunk.join(','),
      maxResults: String(chunk.length),
    });

    const response = await fetch(`${YOUTUBE_API_BASE}/videos?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      const errorMessage = payload?.error?.message || payload?.error || 'youtube_videos_fetch_failed';
      throw new Error(errorMessage);
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    for (const item of items) {
      if (item?.id) {
        detailsById.set(item.id, item);
      }
    }
  }

  return detailsById;
}

async function syncYouTubeForUser(userId, requestedWindowHours = YOUTUBE_DEFAULT_SYNC_WINDOW_HOURS) {
  const windowHours = parseWindowHours(requestedWindowHours, YOUTUBE_DEFAULT_SYNC_WINDOW_HOURS);
  const accessToken = await ensureYouTubeAccessToken(userId);
  const rawActivities = await fetchYouTubeActivities(accessToken, windowHours);
  const videoIds = rawActivities.map((activity) => getYouTubeActivityVideoId(activity)).filter(Boolean);
  const detailsById = await fetchYouTubeVideosById(accessToken, videoIds);

  const normalizedItems = rawActivities
    .map((activity, index) => normalizeYouTubeActivityForIngestion(activity, detailsById, index))
    .filter(Boolean)
    .slice(0, YOUTUBE_MAX_ITEMS_PER_SYNC);

  state.youtubeRecentByUser.set(userId, {
    syncedAtIso: new Date().toISOString(),
    windowHours,
    items: normalizedItems,
    rawItemCount: rawActivities.length,
  });
  state.ingestionByUser.delete(userId);

  const ingestion = runIngestionForUser(userId);
  return {
    syncedAtIso: state.youtubeRecentByUser.get(userId).syncedAtIso,
    windowHours,
    itemCount: normalizedItems.length,
    rawItemCount: rawActivities.length,
    ingestion,
  };
}

async function fetchSpotifyToken(params) {
  const creds = getSpotifyClientCredentials();
  if (!creds) {
    throw new Error('spotify_not_configured');
  }

  const authHeader = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'spotify_token_exchange_failed');
  }
  return data;
}

async function exchangeSpotifyCodeForToken(code) {
  const tokenData = await fetchSpotifyToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getSpotifyRedirectUri(),
  });

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    tokenType: tokenData.token_type,
    scope: tokenData.scope || SPOTIFY_SCOPE,
    expiresAtEpochMs: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
    obtainedAtIso: new Date().toISOString(),
  };
}

async function refreshSpotifyAccessToken(userId) {
  const existing = state.spotifyTokensByUser.get(userId);
  if (!existing?.refreshToken) {
    throw new Error('spotify_refresh_token_missing');
  }

  const tokenData = await fetchSpotifyToken({
    grant_type: 'refresh_token',
    refresh_token: existing.refreshToken,
  });

  const refreshed = {
    ...existing,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || existing.refreshToken,
    tokenType: tokenData.token_type || existing.tokenType,
    scope: tokenData.scope || existing.scope,
    expiresAtEpochMs: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
    obtainedAtIso: new Date().toISOString(),
  };

  state.spotifyTokensByUser.set(userId, refreshed);
  return refreshed.accessToken;
}

async function ensureSpotifyAccessToken(userId) {
  const token = state.spotifyTokensByUser.get(userId);
  if (!token?.accessToken) {
    throw new Error('spotify_not_connected');
  }

  if (token.expiresAtEpochMs && token.expiresAtEpochMs > Date.now() + 60 * 1000) {
    return token.accessToken;
  }

  return refreshSpotifyAccessToken(userId);
}

async function fetchSpotifyRecentlyPlayed(accessToken, windowHours = SPOTIFY_DEFAULT_SYNC_WINDOW_HOURS) {
  const afterMs = Date.now() - parseWindowHours(windowHours) * 60 * 60 * 1000;
  let nextUrl = `${SPOTIFY_API_BASE}/me/player/recently-played?limit=50&after=${afterMs}`;
  const results = [];

  for (let page = 0; page < SPOTIFY_MAX_PAGES && nextUrl; page += 1) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      const errorMessage = payload?.error?.message || payload?.error || 'spotify_recently_played_failed';
      throw new Error(errorMessage);
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    results.push(...items);
    nextUrl = payload?.next || null;
  }

  return results;
}

async function syncSpotifyForUser(userId, requestedWindowHours = SPOTIFY_DEFAULT_SYNC_WINDOW_HOURS) {
  const windowHours = parseWindowHours(requestedWindowHours);
  const accessToken = await ensureSpotifyAccessToken(userId);
  const rawItems = await fetchSpotifyRecentlyPlayed(accessToken, windowHours);
  const normalizedItems = rawItems
    .map((item, index) => normalizeSpotifyTrackForIngestion(item, index))
    .filter(Boolean);

  state.spotifyRecentByUser.set(userId, {
    syncedAtIso: new Date().toISOString(),
    windowHours,
    items: normalizedItems,
    rawItemCount: rawItems.length,
  });
  state.ingestionByUser.delete(userId);

  const ingestion = runIngestionForUser(userId);
  return {
    syncedAtIso: state.spotifyRecentByUser.get(userId).syncedAtIso,
    windowHours,
    itemCount: normalizedItems.length,
    rawItemCount: rawItems.length,
    ingestion,
  };
}

function normalizeProfile(rawProfile) {
  if (!rawProfile || typeof rawProfile !== 'object') return null;

  const profile = rawProfile.profile && typeof rawProfile.profile === 'object'
    ? rawProfile.profile
    : rawProfile;

  const targetLanguages = Array.isArray(profile.targetLanguages)
    ? profile.targetLanguages.filter((lang) => lang === 'ko' || lang === 'ja' || lang === 'zh')
    : [];

  return {
    nativeLanguage: profile.nativeLanguage || 'en',
    targetLanguages: targetLanguages.length > 0 ? targetLanguages : ['ko', 'ja', 'zh'],
    proficiency: {
      ko: profile?.proficiency?.ko || 'none',
      ja: profile?.proficiency?.ja || 'none',
      zh: profile?.proficiency?.zh || 'none',
    },
  };
}

function upsertProfile(userId, rawProfile) {
  const profile = normalizeProfile(rawProfile);
  if (!profile) return null;
  state.profiles.set(userId, profile);
  state.ingestionByUser.delete(userId);
  return profile;
}

function getProfile(userId) {
  return state.profiles.get(userId) || null;
}

function getWeakestTargetLanguage(profile) {
  if (!profile || !Array.isArray(profile.targetLanguages) || profile.targetLanguages.length === 0) {
    return 'ko';
  }

  return [...profile.targetLanguages].sort((a, b) => {
    const rankA = PROFICIENCY_RANK[profile?.proficiency?.[a] || 'none'] ?? 0;
    const rankB = PROFICIENCY_RANK[profile?.proficiency?.[b] || 'none'] ?? 0;
    return rankA - rankB;
  })[0];
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
  const snapshot = buildIngestionSnapshotForUser(userId, { includeSources });
  const result = runMockIngestion(snapshot, {
    userId,
    profile: getProfile(userId),
  });

  if (userId === DEFAULT_USER_ID) {
    writeGeneratedSnapshots(result);
  }

  state.ingestionByUser.set(userId, result);
  return {
    ...result,
    _meta: {
      includeSources,
    },
  };
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

function buildPersonalizedObjective({ userId, mode = 'hangout', lang = 'ko' }) {
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
        ?.objectiveLinks?.[0]?.objectiveId ||
      insightItems.find((item) => objectiveMatchesLanguage(item?.objectiveLinks?.[0]?.objectiveId, lang))
        ?.objectiveLinks?.[0]?.objectiveId ||
      DEFAULT_OBJECTIVE_BY_LANG[lang];

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
  const ingestion = ensureIngestionForUser(userId);
  const dominantClusterId = getDominantClusterId(ingestion);

  const city = CLUSTER_CITY_MAP[dominantClusterId] || FIXTURES.gameStart.city || 'seoul';
  const location = CLUSTER_LOCATION_MAP[dominantClusterId] || 'food_street';

  const ytMinutes = ingestion?.mediaProfile?.sourceBreakdown?.youtube?.minutes || 0;
  const spMinutes = ingestion?.mediaProfile?.sourceBreakdown?.spotify?.minutes || 0;
  const clusterCount = ingestion?.mediaProfile?.learningSignals?.clusterAffinities?.length || 0;
  const topTermCount = ingestion?.mediaProfile?.learningSignals?.topTerms?.length || 0;
  const crossSourceCount =
    ingestion?.frequency?.items?.filter((item) => Number(item.sourceCount || 0) > 1).length || 0;

  const xp = Math.round(
    Math.min(999, 35 + ytMinutes * 0.45 + spMinutes * 0.4 + topTermCount * 2),
  );
  const sp = Math.round(Math.min(200, 12 + clusterCount * 8 + crossSourceCount * 3));
  const rp = Math.round(Math.min(100, 6 + crossSourceCount * 2 + clusterCount * 2));
  const currentMasteryLevel = xp >= 220 ? 3 : xp >= 140 ? 2 : 1;

  const weakestLang = getWeakestTargetLanguage(profile);
  const objective = buildPersonalizedObjective({
    userId,
    mode: 'hangout',
    lang: weakestLang,
  });

  return {
    ...cloneJson(FIXTURES.gameStart),
    city,
    location,
    mode: 'hangout',
    sceneId: `${location}_hangout_intro`,
    profile: cloneJson(profile),
    progression: {
      xp,
      sp,
      rp,
      currentMasteryLevel,
    },
    actions: [
      'Start hangout validation',
      'Review personalized learn targets',
      `Practice ${weakestLang.toUpperCase()} objective ${objective.objectiveId}`,
    ],
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

function buildGameSession(userId, profile) {
  const sessionId = `sess_${Math.random().toString(36).slice(2, 10)}`;
  const response = {
    ...buildGameStartResponse(userId, profile),
    sessionId,
  };
  state.sessions.set(sessionId, {
    userId,
    turn: 1,
    score: { xp: 0, sp: 0, rp: 0 },
  });
  return response;
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
      if (args.profile) upsertProfile(userId, { profile: args.profile });
      const includeSources = normalizeIngestionSources(args.includeSources);
      const result = runIngestionForUser(userId, { includeSources });
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: formatIngestionRunResponse(result, includeSources),
        },
      };
    }
    case 'integrations.youtube.sync_mock': {
      if (args.profile) upsertProfile(userId, { profile: args.profile });
      const result = runIngestionForUser(userId, { includeSources: ['youtube'] });
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: formatIngestionRunResponse(result, ['youtube']),
        },
      };
    }
    case 'integrations.youtube.status': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: getYouTubeStatusPayload(userId),
        },
      };
    }
    case 'integrations.youtube.connect': {
      if (!youtubeConfigured()) {
        return {
          statusCode: 503,
          payload: {
            ok: false,
            tool: toolName,
            ...youtubeConfigErrorPayload(),
          },
        };
      }
      const connectInfo = buildYouTubeAuthUrl(userId);
      if (!connectInfo) {
        return {
          statusCode: 503,
          payload: {
            ok: false,
            tool: toolName,
            ...youtubeConfigErrorPayload(),
          },
        };
      }
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            userId,
            connected: Boolean(state.youtubeTokensByUser.get(userId)?.accessToken),
            state: connectInfo.stateToken,
            scope: YOUTUBE_SCOPE,
            redirectUri: getYouTubeRedirectUri(),
            authUrl: connectInfo.authUrl,
          },
        },
      };
    }
    case 'integrations.youtube.sync': {
      if (!youtubeConfigured()) {
        return {
          statusCode: 503,
          payload: {
            ok: false,
            tool: toolName,
            ...youtubeConfigErrorPayload(),
          },
        };
      }
      if (!state.youtubeTokensByUser.get(userId)?.accessToken) {
        return {
          statusCode: 400,
          payload: {
            ok: false,
            tool: toolName,
            error: 'youtube_not_connected',
            message: 'Connect YouTube first via integrations.youtube.connect.',
          },
        };
      }
      const synced = await syncYouTubeForUser(userId, args.windowHours);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            userId,
            syncedAtIso: synced.syncedAtIso,
            windowHours: synced.windowHours,
            youtubeItemCount: synced.itemCount,
            youtubeRawItemCount: synced.rawItemCount,
            topTerms: synced.ingestion.frequency.items.slice(0, 10),
            sourceCount: {
              youtube: synced.ingestion.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
              spotify: synced.ingestion.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
            },
          },
        },
      };
    }
    case 'integrations.spotify.sync_mock': {
      if (args.profile) upsertProfile(userId, { profile: args.profile });
      const result = runIngestionForUser(userId, { includeSources: ['spotify'] });
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: formatIngestionRunResponse(result, ['spotify']),
        },
      };
    }
    case 'integrations.spotify.status': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: getSpotifyStatusPayload(userId),
        },
      };
    }
    case 'integrations.spotify.connect': {
      if (!spotifyConfigured()) {
        return {
          statusCode: 503,
          payload: {
            ok: false,
            tool: toolName,
            ...spotifyConfigErrorPayload(),
          },
        };
      }
      const connectInfo = buildSpotifyAuthUrl(userId);
      if (!connectInfo) {
        return {
          statusCode: 503,
          payload: {
            ok: false,
            tool: toolName,
            ...spotifyConfigErrorPayload(),
          },
        };
      }
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            userId,
            connected: Boolean(state.spotifyTokensByUser.get(userId)?.accessToken),
            state: connectInfo.stateToken,
            scope: SPOTIFY_SCOPE,
            redirectUri: getSpotifyRedirectUri(),
            authUrl: connectInfo.authUrl,
          },
        },
      };
    }
    case 'integrations.spotify.sync': {
      if (!spotifyConfigured()) {
        return {
          statusCode: 503,
          payload: {
            ok: false,
            tool: toolName,
            ...spotifyConfigErrorPayload(),
          },
        };
      }
      if (!state.spotifyTokensByUser.get(userId)?.accessToken) {
        return {
          statusCode: 400,
          payload: {
            ok: false,
            tool: toolName,
            error: 'spotify_not_connected',
            message: 'Connect Spotify first via integrations.spotify.connect.',
          },
        };
      }
      const synced = await syncSpotifyForUser(userId, args.windowHours);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            userId,
            syncedAtIso: synced.syncedAtIso,
            windowHours: synced.windowHours,
            spotifyItemCount: synced.itemCount,
            spotifyRawItemCount: synced.rawItemCount,
            topTerms: synced.ingestion.frequency.items.slice(0, 10),
            sourceCount: {
              youtube: synced.ingestion.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
              spotify: synced.ingestion.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
            },
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
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: ingestion.insights || FIXTURES.insights,
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
    case 'game.start_or_resume': {
      const incomingProfile = args.profile ? upsertProfile(userId, { profile: args.profile }) : null;
      const response = buildGameSession(userId, incomingProfile);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: response,
        },
      };
    }
    case 'scenes.hangout.start': {
      const response = startHangoutScene(userId);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: response,
        },
      };
    }
    case 'scenes.hangout.respond': {
      const sceneSessionId = typeof args.sceneSessionId === 'string' ? args.sceneSessionId.trim() : '';
      const userUtterance = typeof args.userUtterance === 'string' ? args.userUtterance : '';
      if (!sceneSessionId || !userUtterance) {
        return {
          statusCode: 400,
          payload: {
            ok: false,
            tool: toolName,
            error: 'sceneSessionId_and_userUtterance_required',
          },
        };
      }
      const result = handleHangoutRespond({
        sceneSessionId,
        userUtterance,
        toolContext: normalizeObject(args.toolContext),
      });
      return {
        statusCode: result.statusCode,
        payload: {
          ok: result.statusCode === 200,
          tool: toolName,
          ...(result.statusCode === 200 ? { result: result.payload } : result.payload),
        },
      };
    }
    case 'learn.sessions.list': {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: {
            items: listLearnSessions(),
          },
        },
      };
    }
    case 'learn.sessions.create': {
      const response = createLearnSession(args);
      return {
        statusCode: 200,
        payload: {
          ok: true,
          tool: toolName,
          result: response,
        },
      };
    }
    default:
      return {
        statusCode: 404,
        payload: {
          ok: false,
          error: 'unknown_tool',
          tool: toolName,
          availableTools: AGENT_TOOL_DEFINITIONS.map((definition) => definition.name),
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

    if (pathname === '/' && req.method === 'GET') {
      jsonResponse(res, 200, {
        ok: true,
        service: 'tong-server',
        message: 'Use /health or /api/v1/* endpoints.',
      });
      return;
    }

    if (pathname === '/health') {
      jsonResponse(res, 200, { ok: true, service: 'tong-server' });
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
      const toolName = typeof body.tool === 'string' ? body.tool.trim() : '';
      if (!toolName) {
        jsonResponse(res, 400, {
          ok: false,
          error: 'tool_required',
          message: 'Provide body.tool to invoke a registered agent tool.',
        });
        return;
      }

      const invocation = await invokeAgentTool(toolName, body.args);
      jsonResponse(res, invocation.statusCode, invocation.payload);
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/status' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      jsonResponse(res, 200, getYouTubeStatusPayload(userId));
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/connect' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      if (!youtubeConfigured()) {
        jsonResponse(res, 503, youtubeConfigErrorPayload());
        return;
      }

      const connectInfo = buildYouTubeAuthUrl(userId);
      if (!connectInfo) {
        jsonResponse(res, 503, youtubeConfigErrorPayload());
        return;
      }

      jsonResponse(res, 200, {
        userId,
        connected: Boolean(state.youtubeTokensByUser.get(userId)?.accessToken),
        state: connectInfo.stateToken,
        scope: YOUTUBE_SCOPE,
        redirectUri: getYouTubeRedirectUri(),
        authUrl: connectInfo.authUrl,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/callback' && req.method === 'GET') {
      if (!youtubeConfigured()) {
        jsonResponse(res, 503, youtubeConfigErrorPayload());
        return;
      }

      const code = url.searchParams.get('code');
      const stateToken = url.searchParams.get('state');
      if (!code || !stateToken) {
        jsonResponse(res, 400, { error: 'youtube_callback_missing_code_or_state' });
        return;
      }

      cleanupYouTubeAuthStates();
      const pending = state.youtubeAuthStates.get(stateToken);
      state.youtubeAuthStates.delete(stateToken);
      if (!pending?.userId) {
        jsonResponse(res, 400, { error: 'youtube_invalid_state' });
        return;
      }

      const tokens = await exchangeYouTubeCodeForToken(code);
      state.youtubeTokensByUser.set(pending.userId, tokens);
      state.ingestionByUser.delete(pending.userId);

      let syncSummary = null;
      try {
        const synced = await syncYouTubeForUser(pending.userId, YOUTUBE_DEFAULT_SYNC_WINDOW_HOURS);
        syncSummary = {
          syncedAtIso: synced.syncedAtIso,
          windowHours: synced.windowHours,
          itemCount: synced.itemCount,
          rawItemCount: synced.rawItemCount,
        };
      } catch (syncError) {
        syncSummary = {
          error: syncError instanceof Error ? syncError.message : 'youtube_sync_failed',
        };
      }

      jsonResponse(res, 200, {
        ok: true,
        userId: pending.userId,
        connected: true,
        tokenExpiresAtIso: new Date(tokens.expiresAtEpochMs).toISOString(),
        sync: syncSummary,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/disconnect' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromSearch(url.searchParams);
      state.youtubeTokensByUser.delete(userId);
      state.youtubeRecentByUser.delete(userId);
      state.ingestionByUser.delete(userId);

      jsonResponse(res, 200, {
        ok: true,
        userId,
        disconnected: true,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/youtube/sync' && req.method === 'POST') {
      if (!youtubeConfigured()) {
        jsonResponse(res, 503, youtubeConfigErrorPayload());
        return;
      }

      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromSearch(url.searchParams);
      if (!state.youtubeTokensByUser.get(userId)?.accessToken) {
        jsonResponse(res, 400, {
          error: 'youtube_not_connected',
          message: 'Connect YouTube first via /api/v1/integrations/youtube/connect.',
        });
        return;
      }

      const synced = await syncYouTubeForUser(userId, body.windowHours);
      jsonResponse(res, 200, {
        ok: true,
        userId,
        syncedAtIso: synced.syncedAtIso,
        windowHours: synced.windowHours,
        youtubeItemCount: synced.itemCount,
        youtubeRawItemCount: synced.rawItemCount,
        topTerms: synced.ingestion.frequency.items.slice(0, 10),
        sourceCount: {
          youtube: synced.ingestion.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
          spotify: synced.ingestion.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
        },
      });
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/status' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      jsonResponse(res, 200, getSpotifyStatusPayload(userId));
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/connect' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      if (!spotifyConfigured()) {
        jsonResponse(res, 503, spotifyConfigErrorPayload());
        return;
      }

      const connectInfo = buildSpotifyAuthUrl(userId);
      if (!connectInfo) {
        jsonResponse(res, 503, spotifyConfigErrorPayload());
        return;
      }

      jsonResponse(res, 200, {
        userId,
        connected: Boolean(state.spotifyTokensByUser.get(userId)?.accessToken),
        state: connectInfo.stateToken,
        scope: SPOTIFY_SCOPE,
        redirectUri: getSpotifyRedirectUri(),
        authUrl: connectInfo.authUrl,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/callback' && req.method === 'GET') {
      if (!spotifyConfigured()) {
        jsonResponse(res, 503, spotifyConfigErrorPayload());
        return;
      }

      const code = url.searchParams.get('code');
      const stateToken = url.searchParams.get('state');
      if (!code || !stateToken) {
        jsonResponse(res, 400, { error: 'spotify_callback_missing_code_or_state' });
        return;
      }

      cleanupSpotifyAuthStates();
      const pending = state.spotifyAuthStates.get(stateToken);
      state.spotifyAuthStates.delete(stateToken);
      if (!pending?.userId) {
        jsonResponse(res, 400, { error: 'spotify_invalid_state' });
        return;
      }

      const tokens = await exchangeSpotifyCodeForToken(code);
      state.spotifyTokensByUser.set(pending.userId, tokens);
      state.ingestionByUser.delete(pending.userId);

      let syncSummary = null;
      try {
        const synced = await syncSpotifyForUser(pending.userId, SPOTIFY_DEFAULT_SYNC_WINDOW_HOURS);
        syncSummary = {
          syncedAtIso: synced.syncedAtIso,
          windowHours: synced.windowHours,
          itemCount: synced.itemCount,
          rawItemCount: synced.rawItemCount,
        };
      } catch (syncError) {
        syncSummary = {
          error: syncError instanceof Error ? syncError.message : 'spotify_sync_failed',
        };
      }

      jsonResponse(res, 200, {
        ok: true,
        userId: pending.userId,
        connected: true,
        tokenExpiresAtIso: new Date(tokens.expiresAtEpochMs).toISOString(),
        sync: syncSummary,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/disconnect' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromSearch(url.searchParams);
      state.spotifyTokensByUser.delete(userId);
      state.spotifyRecentByUser.delete(userId);
      state.ingestionByUser.delete(userId);

      jsonResponse(res, 200, {
        ok: true,
        userId,
        disconnected: true,
      });
      return;
    }

    if (pathname === '/api/v1/integrations/spotify/sync' && req.method === 'POST') {
      if (!spotifyConfigured()) {
        jsonResponse(res, 503, spotifyConfigErrorPayload());
        return;
      }

      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromSearch(url.searchParams);
      if (!state.spotifyTokensByUser.get(userId)?.accessToken) {
        jsonResponse(res, 400, {
          error: 'spotify_not_connected',
          message: 'Connect Spotify first via /api/v1/integrations/spotify/connect.',
        });
        return;
      }

      const synced = await syncSpotifyForUser(userId, body.windowHours);
      jsonResponse(res, 200, {
        ok: true,
        userId,
        syncedAtIso: synced.syncedAtIso,
        windowHours: synced.windowHours,
        spotifyItemCount: synced.itemCount,
        spotifyRawItemCount: synced.rawItemCount,
        topTerms: synced.ingestion.frequency.items.slice(0, 10),
        sourceCount: {
          youtube: synced.ingestion.mediaProfile.sourceBreakdown.youtube.itemsConsumed,
          spotify: synced.ingestion.mediaProfile.sourceBreakdown.spotify.itemsConsumed,
        },
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

    if (pathname === '/api/v1/vocab/frequency' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(res, 200, ingestion.frequency || FIXTURES.frequency);
      return;
    }

    if (pathname === '/api/v1/vocab/insights' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(res, 200, ingestion.insights || FIXTURES.insights);
      return;
    }

    if (pathname === '/api/v1/player/media-profile' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const ingestion = ensureIngestionForUser(userId);
      jsonResponse(res, 200, ingestion.mediaProfile || { ...FIXTURES.mediaProfile, userId });
      return;
    }

    if (pathname === '/api/v1/ingestion/run-mock' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || getUserIdFromSearch(url.searchParams);
      if (body.profile) upsertProfile(userId, { profile: body.profile });
      const includeSources = normalizeIngestionSources(body.includeSources);
      const result = runIngestionForUser(userId, { includeSources });
      jsonResponse(res, 200, formatIngestionRunResponse(result, includeSources));
      return;
    }

    if (pathname === '/api/v1/game/start-or-resume' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const userId = body.userId || DEFAULT_USER_ID;
      const incomingProfile = body.profile ? upsertProfile(userId, { profile: body.profile }) : null;
      const response = buildGameSession(userId, incomingProfile);
      jsonResponse(res, 200, response);
      return;
    }

    if (pathname === '/api/v1/profile/proficiency' && req.method === 'PUT') {
      const body = await readJsonBody(req);
      if (!body.userId) {
        jsonResponse(res, 400, { error: 'userId_required' });
        return;
      }
      const profile = upsertProfile(body.userId, body.profile ? { profile: body.profile } : body);
      const ingestion = ensureIngestionForUser(body.userId);
      jsonResponse(res, 200, { ok: true, profile, mediaProfile: ingestion.mediaProfile });
      return;
    }

    if (pathname === '/api/v1/objectives/next' && req.method === 'GET') {
      const userId = getUserIdFromSearch(url.searchParams);
      const mode = url.searchParams.get('mode') === 'learn' ? 'learn' : 'hangout';
      const objective = buildPersonalizedObjective({
        userId,
        mode,
        lang: getLang(url.searchParams),
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

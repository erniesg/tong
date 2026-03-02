const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';
const DEMO_PASSWORD_STORAGE_KEY = 'tong.demo.password';

function stripDemoPasswordFromUrl() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('demo')) return;
  params.delete('demo');
  const query = params.toString();
  const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', cleanUrl);
}

function getDemoPassword() {
  if (typeof window === 'undefined') return '';

  const fromStorage = window.localStorage.getItem(DEMO_PASSWORD_STORAGE_KEY);
  if (fromStorage) return fromStorage;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('demo');
  if (fromQuery) {
    window.localStorage.setItem(DEMO_PASSWORD_STORAGE_KEY, fromQuery);
    stripDemoPasswordFromUrl();
    return fromQuery;
  }

  return '';
}

export interface CaptionToken {
  text: string;
  lemma: string;
  pos: string;
  dictionaryId: string;
}

export interface CaptionSegment {
  startMs: number;
  endMs: number;
  surface: string;
  romanized: string;
  english: string;
  tokens: CaptionToken[];
}

export interface EnrichedCaptions {
  videoId: string;
  segments: CaptionSegment[];
}

export interface DictionaryEntry {
  term: string;
  lang: 'ko' | 'ja' | 'zh';
  meaning: string;
  examples: string[];
  crossCjk: {
    zhHans: string;
    ja: string;
  };
  readings: {
    ko?: string;
    zhPinyin?: string;
    jaRomaji?: string;
  };
}

export interface ScoreState {
  xp: number;
  sp: number;
  rp: number;
}

export interface LearnSession {
  learnSessionId: string;
  title: string;
  objectiveId: string;
  lastMessageAt: string;
}

export interface FrequencyItem {
  lemma: string;
  lang: 'ko' | 'ja' | 'zh';
  count: number;
  sourceCount: number;
  sourceBreakdown?: {
    youtube: number;
    spotify: number;
  };
}

export interface VocabFrequencyResponse {
  windowStartIso: string;
  windowEndIso: string;
  items: FrequencyItem[];
}

export interface VocabInsightsResponse {
  windowStartIso: string;
  windowEndIso: string;
  clusters: Array<{
    clusterId: string;
    label: string;
    keywords: string[];
    topTerms: string[];
  }>;
  items: Array<{
    lemma: string;
    lang: 'ko' | 'ja' | 'zh';
    score: number;
    frequency: number;
    burst: number;
    clusterId: string;
    objectiveLinks: Array<{ objectiveId: string; reason: string }>;
  }>;
}

export interface MediaProfileResponse {
  userId: string;
  windowDays: number;
  generatedAtIso: string;
  sourceBreakdown: {
    youtube: {
      itemsConsumed: number;
      minutes: number;
      topMedia: Array<{ mediaId: string; title: string; lang: 'ko' | 'ja' | 'zh'; minutes: number }>;
    };
    spotify: {
      itemsConsumed: number;
      minutes: number;
      topMedia: Array<{ mediaId: string; title: string; lang: 'ko' | 'ja' | 'zh'; minutes: number }>;
    };
  };
}

export interface SecretStatusResponse {
  demoPasswordEnabled: boolean;
  youtubeApiKeyConfigured: boolean;
  spotifyClientIdConfigured: boolean;
  spotifyClientSecretConfigured: boolean;
  openAiApiKeyConfigured: boolean;
}

export type CityId = 'seoul' | 'tokyo' | 'shanghai';
export type LocationId =
  | 'food_street'
  | 'cafe'
  | 'convenience_store'
  | 'subway_hub'
  | 'practice_studio';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const demoPassword = getDemoPassword();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(demoPassword ? { 'x-demo-password': demoPassword } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let serverMessage = '';
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      serverMessage = payload.message || payload.error || '';
    } catch {
      serverMessage = '';
    }

    if (response.status === 401) {
      throw new Error(serverMessage || 'Demo password is missing or invalid.');
    }

    throw new Error(`Request failed (${response.status}) for ${path}${serverMessage ? `: ${serverMessage}` : ''}`);
  }

  return (await response.json()) as T;
}

export function getStoredDemoPassword() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(DEMO_PASSWORD_STORAGE_KEY) || '';
}

export function setStoredDemoPassword(password: string) {
  if (typeof window === 'undefined') return;

  const trimmed = password.trim();
  if (!trimmed) return;
  window.localStorage.setItem(DEMO_PASSWORD_STORAGE_KEY, trimmed);
}

export function clearStoredDemoPassword() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEMO_PASSWORD_STORAGE_KEY);
}

export function fetchCaptions(videoId: string, lang: 'ko' | 'ja' | 'zh' = 'ko') {
  return apiFetch<EnrichedCaptions>(
    `/api/v1/captions/enriched?videoId=${encodeURIComponent(videoId)}&lang=${lang}`,
  );
}

export function fetchDictionary(term: string, lang: 'ko' | 'ja' | 'zh' = 'ko') {
  return apiFetch<DictionaryEntry>(
    `/api/v1/dictionary/entry?term=${encodeURIComponent(term)}&lang=${lang}`,
  );
}

export type ProficiencyLevel = 'none' | 'beginner' | 'intermediate' | 'advanced' | 'native';

export interface UserProficiency {
  ko: ProficiencyLevel;
  ja: ProficiencyLevel;
  zh: ProficiencyLevel;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function startOrResumeGame(params?: any) {
  const prof = params?.proficiency ?? params ?? { ko: 'beginner', ja: 'none', zh: 'none' };
  const userId = params?.userId ?? 'demo-user-1';
  const city = params?.city ?? 'seoul';
  const profile = params?.profile ?? {
    nativeLanguage: 'en',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: prof,
  };
  return apiFetch<{
    sessionId: string;
    city: 'seoul' | 'tokyo' | 'shanghai';
    sceneId: string;
    actions: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({ userId, city, profile, preferRomance: params?.preferRomance }),
  });
}

interface ObjectiveNextParams {
  userId?: string;
  city?: CityId;
  location?: LocationId;
  mode?: 'hangout' | 'learn';
  lang?: 'ko' | 'ja' | 'zh';
}

export function fetchObjectiveNext(params: ObjectiveNextParams = {}) {
  const search = new URLSearchParams({
    userId: params.userId || 'demo-user-1',
    city: params.city || 'seoul',
    location: params.location || 'food_street',
    mode: params.mode || 'hangout',
    lang: params.lang || 'ko',
  });

  return apiFetch<{
    objectiveId: string;
    level: number;
    mode: 'hangout' | 'learn';
    coreTargets: {
      vocabulary: string[];
      grammar: string[];
      sentenceStructures: string[];
    };
    completionCriteria: {
      requiredTurns: number;
      requiredAccuracy: number;
    };
  }>(`/api/v1/objectives/next?${search.toString()}`);
}

interface StartHangoutParams {
  objectiveId: string;
  userId?: string;
  sessionId?: string;
  city?: CityId;
  location?: LocationId;
  lang?: 'ko' | 'ja' | 'zh';
  characterId?: string;
  preferRomance?: boolean;
  [key: string]: unknown;
}

export function startHangout(params: StartHangoutParams) {
  const { objectiveId, userId, city, location, lang, ...rest } = params;
  return apiFetch<{
    sceneSessionId: string;
    initialLine: { speaker: 'character' | 'tong'; text: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: { turn: number; score: ScoreState; [k: string]: any };
    uiPolicy: { immersiveFirstPerson: boolean; allowOnlyDialogueAndHints: boolean };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId: userId || 'demo-user-1',
      city: city || 'seoul',
      location: location || 'food_street',
      lang: lang || 'ko',
      objectiveId,
      ...rest,
    }),
  });
}

export function respondHangout(sceneSessionId: string, userUtterance: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiFetch<{
    accepted: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    feedback: { tongHint: string; objectiveProgressDelta: number; [k: string]: any };
    nextLine: { speaker: 'character' | 'tong'; text: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: { turn: number; score: ScoreState; [k: string]: any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>('/api/v1/scenes/hangout/respond', {
    method: 'POST',
    body: JSON.stringify({
      sceneSessionId,
      userUtterance,
      toolContext: { dictionaryEnabled: true, objectiveTrackingEnabled: true },
    }),
  });
}

interface LearnSessionParams {
  userId?: string;
  city?: CityId;
  lang?: 'ko' | 'ja' | 'zh';
}

export function fetchLearnSessions(params: LearnSessionParams = {}) {
  const search = new URLSearchParams({
    userId: params.userId || 'demo-user-1',
    city: params.city || 'seoul',
    lang: params.lang || 'ko',
  });
  return apiFetch<{ items: LearnSession[] }>(`/api/v1/learn/sessions?${search.toString()}`);
}

interface CreateLearnSessionParams {
  objectiveId: string;
  userId?: string;
  city?: CityId;
  lang?: 'ko' | 'ja' | 'zh';
}

export function createLearnSession(params: CreateLearnSessionParams) {
  const { objectiveId, userId, city, lang } = params;
  return apiFetch<{
    learnSessionId: string;
    mode: 'learn';
    uiTheme: 'kakao_like' | 'line_like' | 'wechat_like';
    objectiveId: string;
    firstMessage: { speaker: 'tong'; text: string };
  }>('/api/v1/learn/sessions', {
    method: 'POST',
    body: JSON.stringify({
      userId: userId || 'demo-user-1',
      city: city || 'seoul',
      lang: lang || 'ko',
      objectiveId,
    }),
  });
}

export function runMockIngestion() {
  return apiFetch<{
    success: true;
    generatedAtIso: string;
    sourceCount: { youtube: number; spotify: number };
    topTerms: FrequencyItem[];
  }>('/api/v1/ingestion/run-mock', {
    method: 'POST',
  });
}

export function fetchFrequency() {
  return apiFetch<VocabFrequencyResponse>('/api/v1/vocab/frequency?windowDays=3');
}

export function fetchInsights() {
  return apiFetch<VocabInsightsResponse>('/api/v1/vocab/insights?windowDays=3&lang=ko');
}

export function fetchMediaProfile() {
  return apiFetch<MediaProfileResponse>('/api/v1/player/media-profile?windowDays=3&userId=demo-user-1');
}

export function fetchSecretStatus() {
  return apiFetch<SecretStatusResponse>('/api/v1/demo/secret-status');
}

export function getApiBase() {
  return API_BASE;
}

// ── Tool invocation (generic) ────────────────────────────────────────

export interface ToolInvokeResponse<T = unknown> {
  ok: boolean;
  tool?: string;
  error?: string;
  result?: T;
}

export function invokeTool<T = unknown>(tool: string, args: Record<string, unknown> = {}) {
  return apiFetch<ToolInvokeResponse<T>>('/api/v1/tools/invoke', {
    method: 'POST',
    body: JSON.stringify({ tool, args }),
  });
}

export function fetchTools() {
  return apiFetch<{
    ok: true;
    tools: Array<{ name: string; description: string; args: Record<string, unknown> }>;
  }>('/api/v1/tools');
}

// ── Volcengine / ByteDance tools ─────────────────────────────────────

export interface VolcImageResult {
  url?: string;
  b64Json?: string;
}

export interface VolcImageGenerateResult {
  images: VolcImageResult[];
  model: string;
  seed?: number;
}

export function volcImageGenerate(args: {
  prompt: string;
  model?: string;
  size?: '1K' | '2K' | '4K';
  n?: number;
  seed?: number;
  guidanceScale?: number;
  responseFormat?: 'url' | 'b64_json';
}) {
  return invokeTool<VolcImageGenerateResult>('volcengine.image.generate', args);
}

export type VolcVideoStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface VolcVideoTask {
  id: string;
  model: string;
  status: VolcVideoStatus;
  videoUrl?: string;
  seed?: number;
  resolution?: string;
  ratio?: string;
  duration?: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export function volcVideoCreate(args: {
  content: Array<{ type: 'text'; text: string } | { type: 'image_url'; imageUrl: string }>;
  model?: string;
  resolution?: '480p' | '720p' | '1080p' | '2K';
  ratio?: '16:9' | '9:16' | '4:3' | '1:1';
  duration?: number;
  seed?: number;
  generateAudio?: boolean;
  serviceTier?: 'default' | 'flex';
  callbackUrl?: string;
}) {
  return invokeTool<VolcVideoTask>('volcengine.video.create', args);
}

export function volcVideoGet(taskId: string) {
  return invokeTool<VolcVideoTask>('volcengine.video.get', { taskId });
}

export function volcVideoList(args: { limit?: number; after?: string } = {}) {
  return invokeTool<{ tasks: VolcVideoTask[]; hasMore: boolean }>('volcengine.video.list', args);
}

export interface VolcTTSResult {
  audioBase64: string;
  encoding: string;
  durationMs?: number;
}

export function volcTTSSynthesize(args: {
  text: string;
  voiceType?: string;
  encoding?: 'mp3' | 'wav' | 'ogg' | 'pcm';
  speedRatio?: number;
  volumeRatio?: number;
  pitchRatio?: number;
  emotion?: string;
  language?: 'en' | 'cn' | 'ja' | 'ko';
}) {
  return invokeTool<VolcTTSResult>('volcengine.tts.synthesize', args);
}

export function volcStatus() {
  return invokeTool<{
    arkApiKeyConfigured: boolean;
    ttsAppIdConfigured: boolean;
    ttsAccessTokenConfigured: boolean;
    defaultImageModel: string;
    defaultVideoModel: string;
    defaultTtsVoice: string;
  }>('volcengine.status');
}

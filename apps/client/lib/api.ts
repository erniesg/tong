const FALLBACK_BACKEND_MODE = process.env.NEXT_PUBLIC_TONG_BACKEND_MODE || 'local-server';
const FALLBACK_LOCAL_API_BASE =
  process.env.NEXT_PUBLIC_TONG_LOCAL_API_BASE_URL || process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';
const FALLBACK_REMOTE_API_BASE =
  process.env.NEXT_PUBLIC_TONG_REMOTE_API_BASE_URL || process.env.NEXT_PUBLIC_TONG_API_BASE || FALLBACK_LOCAL_API_BASE;

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (FALLBACK_BACKEND_MODE === 'remote-server' ? FALLBACK_REMOTE_API_BASE : FALLBACK_LOCAL_API_BASE);

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

export type CityId = 'seoul' | 'tokyo' | 'shanghai';
export type LocationId =
  | 'food_street'
  | 'cafe'
  | 'convenience_store'
  | 'subway_hub'
  | 'practice_studio';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
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

export function startOrResumeGame() {
  return apiFetch<{
    sessionId: string;
    city: 'seoul' | 'tokyo' | 'shanghai';
    sceneId: string;
    actions: string[];
  }>('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId: 'demo-user-1',
      profile: {
        nativeLanguage: 'en',
        targetLanguages: ['ko', 'ja', 'zh'],
        proficiency: {
          ko: 'beginner',
          ja: 'none',
          zh: 'none',
        },
      },
    }),
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
  city?: CityId;
  location?: LocationId;
  lang?: 'ko' | 'ja' | 'zh';
}

export function startHangout(params: StartHangoutParams) {
  const { objectiveId, userId, city, location, lang } = params;
  return apiFetch<{
    sceneSessionId: string;
    initialLine: { speaker: 'character' | 'tong'; text: string };
    state: { turn: number; score: ScoreState };
    uiPolicy: { immersiveFirstPerson: boolean; allowOnlyDialogueAndHints: boolean };
  }>('/api/v1/scenes/hangout/start', {
    method: 'POST',
    body: JSON.stringify({
      userId: userId || 'demo-user-1',
      city: city || 'seoul',
      location: location || 'food_street',
      lang: lang || 'ko',
      objectiveId,
    }),
  });
}

export function respondHangout(sceneSessionId: string, userUtterance: string) {
  return apiFetch<{
    accepted: boolean;
    feedback: { tongHint: string; objectiveProgressDelta: number };
    nextLine: { speaker: 'character' | 'tong'; text: string };
    state: { turn: number; score: ScoreState };
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

export function getApiBase() {
  return API_BASE;
}

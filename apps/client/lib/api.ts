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

export type IngestionSnapshotResult = Record<string, any>;

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

export interface GraphPersonaGoal {
  lang: 'ko' | 'ja' | 'zh';
  theme: string;
  objective: string;
}

export interface GraphPersonaSummary {
  learnerId?: string;
  personaId: string;
  userId: string;
  displayName: string;
  focusSummary: string;
  proficiency: UserProficiency;
  goals: GraphPersonaGoal[];
}

export interface GraphPersonaListResponse {
  generatedAtIso: string;
  items: GraphPersonaSummary[];
}

export interface GraphWorldRoadmapLevel {
  level: number;
  label: string;
  status: 'locked' | 'available' | 'active' | 'validated' | 'preview';
}

export interface GraphWorldRoadmapLocation {
  locationId: LocationId;
  mapLocationId?: LocationId;
  dagLocationSlot?: LegacyDagLocationId;
  label: string;
  status: 'active' | 'preview' | 'locked';
  progress: string;
}

export interface GraphWorldRoadmapCity {
  cityId: CityId;
  label: string;
  focus: string;
  proficiency: ProficiencyLevel;
  locations: GraphWorldRoadmapLocation[];
  levels: GraphWorldRoadmapLevel[];
}

export interface GraphSkillObjective {
  objectiveId: string;
  title: string;
  description: string;
  status: 'locked' | 'available' | 'learning' | 'due' | 'validated' | 'mastered';
  mastery_score: number;
  validatedTargetCount: number;
  targetCount: number;
  blockers: string[];
  category: string;
}

export interface GraphSkillLevel {
  level: number;
  name: string;
  description: string;
  estimatedSessionMinutes: number;
  mission: {
    missionId: string;
    title: string;
    requiredObjectiveIds: string[];
    reward: ScoreState;
    status: 'locked' | 'tracking' | 'ready';
  };
  objectives: GraphSkillObjective[];
}

export interface GraphOverlayFocusCard {
  overlayId: string;
  lang: 'ko' | 'ja' | 'zh';
  theme: string;
  title: string;
  description: string;
  nodes: Array<{
    nodeId: string;
    label: string;
    translation: string;
    status: 'locked' | 'available' | 'active';
  }>;
  reason: string;
}

export interface GraphAction {
  actionId: string;
  type: 'lesson' | 'hangout' | 'review' | 'mission' | 'overlay';
  title: string;
  objectiveId: string | null;
  cityId: CityId;
  locationId: LocationId;
  mapLocationId?: LocationId;
  dagLocationSlot?: LegacyDagLocationId;
  reason: string;
  recommendedNodeIds: string[];
}

export interface GraphBundleTarget {
  nodeId: string;
  label: string;
  status: string;
  mastery_score: number;
}

export interface GraphLessonBundle {
  bundleId: string;
  cityId: CityId;
  locationId: LocationId;
  mapLocationId?: LocationId;
  dagLocationSlot?: LegacyDagLocationId;
  objectiveId: string | null;
  title: string;
  mode: 'learn';
  reason: string;
  targets: GraphBundleTarget[];
  explainIn: AppLang;
}

export interface GraphHangoutBundle {
  bundleId: string;
  cityId: CityId;
  locationId: LocationId;
  mapLocationId?: LocationId;
  dagLocationSlot?: LegacyDagLocationId;
  objectiveId: string | null;
  title: string;
  mode: 'hangout';
  reason: string;
  targets: GraphBundleTarget[];
  suggestedPhrases: string[];
}

export interface GraphDashboardResponse {
  generatedAtIso: string;
  persona: GraphPersonaSummary & {
    learnerId?: string;
    topTerms: Array<{ lemma: string; lang: 'ko' | 'ja' | 'zh'; source: 'youtube' | 'spotify'; weight: number }>;
    mediaPreferences: {
      youtube: string[];
      spotify: string[];
    };
  };
  progression: ScoreState;
  worldMapRegistry?: WorldMapRegistry;
  worldRoadmap: GraphWorldRoadmapCity[];
  locationSkillTree: {
    packId: string;
    cityId: CityId;
    locationId: LocationId;
    title: string;
    levels: GraphSkillLevel[];
  };
  personalizedOverlay: {
    focusCards: GraphOverlayFocusCard[];
    summary: string;
  };
  nextActions: GraphAction[];
  lessonBundle: GraphLessonBundle;
  hangoutBundle: GraphHangoutBundle;
  metrics: {
    validatedObjectives: number;
    masteredObjectives: number;
    dueNodeCount: number;
    evidenceCount: number;
  };
}

export interface GraphNextActionsResponse {
  generatedAtIso: string;
  learnerId?: string;
  personaId: string;
  actions: GraphAction[];
}

export interface GraphEvidenceRecordResponse {
  learnerId: string;
  personaId?: string;
  recorded: number;
  events: Array<{
    eventId: string;
    personaId: string;
    userId: string;
    nodeId: string;
    objectiveId: string | null;
    mode: 'learn' | 'hangout' | 'review' | 'mission' | 'exercise' | 'media';
    quality: number;
    occurredAtIso: string;
    source: string;
  }>;
  progression: ScoreState;
  metrics: {
    validatedObjectives: number;
    masteredObjectives: number;
    dueNodeCount: number;
    evidenceCount: number;
  };
}

export interface GraphPackValidateResponse {
  valid: boolean;
  errorCount: number;
  errors: Array<{ code: string; message: string }>;
  summary: string;
}

export interface GraphOverlayProposalResponse {
  generatedAtIso: string;
  learnerId?: string;
  personaId: string;
  overlays: GraphOverlayFocusCard[];
}

export type CityId = 'seoul' | 'tokyo' | 'shanghai';
export type LegacyDagLocationId =
  | 'food_street'
  | 'cafe'
  | 'convenience_store'
  | 'subway_hub'
  | 'practice_studio';
export type LocationId =
  | LegacyDagLocationId
  // Shanghai
  | 'metro_station'
  | 'bbq_stall'
  | 'milk_tea_shop'
  | 'dumpling_shop'
  // Tokyo
  | 'train_station'
  | 'izakaya'
  | 'konbini'
  | 'tea_house'
  | 'ramen_shop';

export interface WorldMapRegistryLocation {
  mapLocationId: LocationId;
  dagLocationSlot: LegacyDagLocationId;
  label: string;
  legacyLocationIds?: LegacyDagLocationId[];
}

export interface WorldMapRegistryCity {
  cityId: CityId;
  defaultMapLocationId: LocationId;
  locations: WorldMapRegistryLocation[];
}

export interface WorldMapRegistry {
  version: string;
  cities: WorldMapRegistryCity[];
}

export interface ObjectiveNextResponse {
  objectiveId: string;
  level: number;
  mode: 'hangout' | 'learn';
  lang: 'ko' | 'ja' | 'zh';
  objectiveGraph: {
    objectiveNodeId: string;
    cityId: CityId;
    locationId: LegacyDagLocationId;
    mapLocationId?: LocationId;
    dagLocationSlot?: LegacyDagLocationId;
    objectiveCategory: 'script' | 'pronunciation' | 'vocabulary' | 'grammar' | 'sentences' | 'conversation' | 'mastery';
    targetNodeIds: string[];
    prerequisiteObjectiveIds: string[];
    source: 'knowledge_graph';
  };
  coreTargets: {
    vocabulary: string[];
    grammar: string[];
    sentenceStructures: string[];
  };
  personalizedTargets: Array<{
    lemma: string;
    source: 'youtube' | 'spotify';
    linkedNodeIds: string[];
  }>;
  completionCriteria: {
    requiredTurns: number;
    requiredAccuracy: number;
    minEvidenceEvents: number;
    acceptedEvidenceModes: Array<'learn' | 'hangout' | 'mission' | 'review' | 'exercise' | 'media'>;
  };
}

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

export type AppLang = 'en' | 'ko' | 'ja' | 'zh';

export type ProficiencyLevel = 'none' | 'beginner' | 'intermediate' | 'advanced' | 'native';

export interface UserProficiency {
  ko: ProficiencyLevel;
  ja: ProficiencyLevel;
  zh: ProficiencyLevel;
}

export interface StartOrResumeGameParams {
  proficiency?: UserProficiency;
  userId?: string;
  city?: CityId;
  profile?: {
    nativeLanguage: string,
    targetLanguages: string[],
    proficiency: Record<string, ProficiencyLevel>,
  };
  preferRomance?: boolean;
  resumeCheckpointId?: string;
  scenarioSeedId?: string;
}

export interface StartOrResumeGameResponse {
  sessionId: string;
  city: 'seoul' | 'tokyo' | 'shanghai';
  sceneId: string;
  actions: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function startOrResumeGame(params?: StartOrResumeGameParams | UserProficiency) {
  const prof = ('ko' in (params || {}) && !('profile' in (params || {})))
    ? (params as UserProficiency)
    : (params as StartOrResumeGameParams | undefined)?.proficiency ?? { ko: 'beginner', ja: 'none', zh: 'none' };
  const typedParams = (params && 'profile' in params) || (params && 'userId' in params) || (params && 'scenarioSeedId' in params) || (params && 'resumeCheckpointId' in params) || (params && 'preferRomance' in params) || (params && 'city' in params) || (params && 'proficiency' in params)
    ? (params as StartOrResumeGameParams)
    : undefined;
  const userId = typedParams?.userId ?? 'demo-user-1';
  const city = typedParams?.city ?? 'seoul';
  const profile = typedParams?.profile ?? {
    nativeLanguage: 'en',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: prof,
  };
  return apiFetch<StartOrResumeGameResponse>('/api/v1/game/start-or-resume', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      city,
      profile,
      preferRomance: typedParams?.preferRomance,
      resumeCheckpointId: typedParams?.resumeCheckpointId,
      scenarioSeedId: typedParams?.scenarioSeedId,
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

  return apiFetch<ObjectiveNextResponse>(`/api/v1/objectives/next?${search.toString()}`);
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

interface FetchGraphDashboardParams {
  personaId?: string;
  learnerId?: string;
  userId?: string;
  city?: CityId;
  location?: LocationId;
}

export function fetchGraphPersonas() {
  return apiFetch<GraphPersonaListResponse>('/api/v1/graph/personas');
}

export function fetchGraphDashboard(params: FetchGraphDashboardParams = {}) {
  const search = new URLSearchParams();
  if (params.personaId) search.set('personaId', params.personaId);
  if (params.learnerId) search.set('learnerId', params.learnerId);
  if (params.userId) search.set('userId', params.userId);
  if (params.city) search.set('city', params.city);
  if (params.location) search.set('location', params.location);
  return apiFetch<GraphDashboardResponse>(`/api/v1/graph/dashboard${search.toString() ? `?${search.toString()}` : ''}`);
}

export function fetchGraphNextActions(params: { personaId?: string; learnerId?: string; userId?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.personaId) search.set('personaId', params.personaId);
  if (params.learnerId) search.set('learnerId', params.learnerId);
  if (params.userId) search.set('userId', params.userId);
  if (params.limit) search.set('limit', String(params.limit));
  return apiFetch<GraphNextActionsResponse>(`/api/v1/graph/next-actions${search.toString() ? `?${search.toString()}` : ''}`);
}

export function recordGraphEvidence(body: {
  personaId?: string;
  userId?: string;
  event?: Record<string, unknown>;
  events?: Record<string, unknown>[];
}) {
  return apiFetch<GraphEvidenceRecordResponse>('/api/v1/graph/evidence', {
    method: 'POST',
    body: JSON.stringify(body),
  });
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

export function graphDashboardTool(args: Record<string, unknown> = {}) {
  return invokeTool<GraphDashboardResponse>('graph.dashboard.get', args);
}

export function graphNextActionsTool(args: Record<string, unknown> = {}) {
  return invokeTool<GraphNextActionsResponse>('graph.next_actions.get', args);
}

export function graphLessonBundleTool(args: Record<string, unknown> = {}) {
  return invokeTool<GraphLessonBundle>('graph.lesson_bundle.get', args);
}

export function graphHangoutBundleTool(args: Record<string, unknown> = {}) {
  return invokeTool<GraphHangoutBundle>('graph.hangout_bundle.get', args);
}

export function graphEvidenceRecordTool(args: Record<string, unknown> = {}) {
  return invokeTool<GraphEvidenceRecordResponse>('graph.evidence.record', args);
}

export function graphPackValidateTool(args: Record<string, unknown> = {}) {
  return invokeTool<GraphPackValidateResponse>('graph.pack.validate', args);
}

export function graphOverlayProposeTool(args: Record<string, unknown> = {}) {
  return invokeTool<GraphOverlayProposalResponse>('graph.overlay.propose', args);
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

// ── Replicate tools ──────────────────────────────────────────────────

export type ReplicatePredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export interface ReplicatePrediction {
  id: string;
  model: string;
  version: string;
  status: ReplicatePredictionStatus;
  output: unknown;
  error: string | null;
  metrics: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ReplicateImageResult {
  id: string;
  status: ReplicatePredictionStatus;
  images: string[];
  error: string | null;
}

export function replicateImageGenerate(args: {
  prompt: string;
  image?: string;
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  output_format?: 'png' | 'jpg' | 'webp';
  output_resolution?: 'auto' | '1024' | '2048';
  number_of_images?: number;
}) {
  return invokeTool<ReplicateImageResult>('replicate.image.generate', args);
}

export function replicateVideoCreate(args: {
  prompt: string;
  image?: string;
  duration?: 4 | 6 | 8;
  resolution?: '720p' | '1080p';
  aspect_ratio?: '16:9' | '9:16';
}) {
  return invokeTool<ReplicatePrediction>('replicate.video.create', args);
}

export function replicatePredictionGet(predictionId: string) {
  return invokeTool<ReplicatePrediction>('replicate.prediction.get', { predictionId });
}

export function replicatePredictionCancel(predictionId: string) {
  return invokeTool<ReplicatePrediction>('replicate.prediction.cancel', { predictionId });
}

export function replicatePredictionWait(predictionId: string, timeoutMs?: number) {
  return invokeTool<ReplicatePrediction>('replicate.prediction.wait', {
    predictionId,
    ...(timeoutMs != null ? { timeoutMs } : {}),
  });
}

export interface ReplicateMusicResult {
  id: string;
  status: ReplicatePredictionStatus;
  audio: string | null;
  error: string | null;
}

export function replicateMusicGenerate(args: {
  prompt: string;
  negative_prompt?: string;
  seed?: number;
}) {
  return invokeTool<ReplicateMusicResult>('replicate.music.generate', args);
}

export function replicateCharacterGenerate(args: {
  characterId: string;
  variant: 'a-pose' | 'grimace' | 'right-profile' | 'casual';
  referenceImage?: string;
  customOverrides?: Record<string, string>;
}) {
  return invokeTool<ReplicateImageResult & { transparentB64: string | null; prompt: string; characterId: string; variant: string }>(
    'replicate.character.generate',
    args,
  );
}

export function replicateCharacterPresets() {
  return invokeTool<{
    characters: Array<{ id: string; name: string }>;
    variants: string[];
  }>('replicate.character.presets');
}

export function replicateStatus() {
  return invokeTool<{ apiTokenConfigured: boolean }>('replicate.status');
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

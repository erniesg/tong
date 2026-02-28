export type TargetLanguage = 'ko' | 'ja' | 'zh';
export type AppLanguage = TargetLanguage | 'en';

export interface EnrichedCaptionToken {
  text: string;
  lemma: string;
  pos: string;
  dictionaryId: string;
}

export interface EnrichedCaptionSegment {
  startMs: number;
  endMs: number;
  surface: string;
  romanized: string;
  english: string;
  tokens: EnrichedCaptionToken[];
}

export interface EnrichedCaptionsResponse {
  videoId: string;
  segments: EnrichedCaptionSegment[];
}

export interface DictionaryEntryResponse {
  term: string;
  lang: TargetLanguage;
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

export interface VocabFrequencyItem {
  lemma: string;
  lang: TargetLanguage;
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
  items: VocabFrequencyItem[];
}

export interface VocabInsightCluster {
  clusterId: string;
  label: string;
  keywords: string[];
  topTerms: string[];
}

export interface VocabInsightItem {
  lemma: string;
  lang: TargetLanguage;
  score: number;
  frequency: number;
  burst: number;
  clusterId: string;
  orthographyFeatures: Record<string, unknown>;
  objectiveLinks: Array<{
    objectiveId: string;
    reason: string;
  }>;
}

export interface VocabInsightsResponse {
  windowStartIso: string;
  windowEndIso: string;
  clusters: VocabInsightCluster[];
  items: VocabInsightItem[];
}

export interface MediaTopItem {
  mediaId: string;
  title: string;
  lang: TargetLanguage;
  minutes: number;
}

export interface MediaSourceBreakdown {
  itemsConsumed: number;
  minutes: number;
  topMedia: MediaTopItem[];
}

export interface PlayerMediaProfileResponse {
  userId: string;
  windowDays: number;
  generatedAtIso: string;
  sourceBreakdown: {
    youtube: MediaSourceBreakdown;
    spotify: MediaSourceBreakdown;
  };
  learningSignals: {
    topTerms: Array<{
      lemma: string;
      lang: TargetLanguage;
      weightedScore: number;
      dominantSource: 'youtube' | 'spotify';
    }>;
    clusterAffinities: Array<{
      clusterId: string;
      label: string;
      score: number;
    }>;
  };
}

export interface StartOrResumeGameRequest {
  userId: string;
  profile: {
    nativeLanguage: AppLanguage;
    targetLanguages: TargetLanguage[];
    proficiency: Record<TargetLanguage, 'none' | 'beginner' | 'intermediate' | 'advanced'>;
  };
}

export interface StartOrResumeGameResponse {
  sessionId: string;
  city: 'seoul' | 'tokyo' | 'shanghai';
  sceneId: string;
  tongPrompt: string;
  actions: string[];
}

export interface ObjectiveNextResponse {
  objectiveId: string;
  level: number;
  mode: 'hangout' | 'learn';
  coreTargets: {
    vocabulary: string[];
    grammar: string[];
    sentenceStructures: string[];
  };
  personalizedTargets: Array<{
    lemma: string;
    source: 'youtube' | 'spotify';
  }>;
  completionCriteria: {
    requiredTurns: number;
    requiredAccuracy: number;
  };
}

export interface HangoutScore {
  xp: number;
  sp: number;
  rp: number;
}

export interface HangoutStartResponse {
  sceneSessionId: string;
  mode: 'hangout';
  uiPolicy: {
    immersiveFirstPerson: boolean;
    allowOnlyDialogueAndHints: boolean;
  };
  state: {
    turn: number;
    score: HangoutScore;
  };
  initialLine: {
    speaker: 'character' | 'tong';
    text: string;
  };
}

export interface HangoutRespondRequest {
  sceneSessionId: string;
  userUtterance: string;
  toolContext?: {
    dictionaryEnabled?: boolean;
    objectiveTrackingEnabled?: boolean;
  };
}

export interface HangoutRespondResponse {
  accepted: boolean;
  feedback: {
    tongHint: string;
    objectiveProgressDelta: number;
  };
  nextLine: {
    speaker: 'character' | 'tong';
    text: string;
  };
  state: {
    turn: number;
    score: HangoutScore;
  };
}

export interface LearnSessionListItem {
  learnSessionId: string;
  title: string;
  objectiveId: string;
  lastMessageAt: string;
}

export interface LearnSessionsResponse {
  items: LearnSessionListItem[];
}

export interface LearnSessionCreateResponse {
  learnSessionId: string;
  mode: 'learn';
  uiTheme: 'kakao_like' | 'line_like' | 'wechat_like';
  objectiveId: string;
  firstMessage: {
    speaker: 'tong';
    text: string;
  };
}

export interface IngestionSourceItem {
  id: string;
  source: 'youtube' | 'spotify';
  title: string;
  lang: TargetLanguage;
  minutes: number;
  text: string;
  mediaId?: string;
  playedAtIso?: string;
  tokens?: string[];
}

export interface MediaIngestionEvent {
  eventId: string;
  userId: string;
  source: 'youtube' | 'spotify';
  mediaId: string;
  title: string;
  lang: TargetLanguage;
  minutes: number;
  consumedAtIso: string;
  tokens: string[];
  text?: string;
}

export interface IngestionSnapshot {
  windowStartIso: string;
  windowEndIso: string;
  generatedAtIso: string;
  sourceItems: IngestionSourceItem[];
}

export interface IngestionRunResponse {
  success: true;
  generatedAtIso: string;
  sourceCount: {
    youtube: number;
    spotify: number;
  };
  topTerms: VocabFrequencyItem[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  method: 'POST';
  path: '/api/v1/tools/invoke';
  args: Record<string, unknown>;
}

export interface AgentToolsResponse {
  ok: true;
  tools: AgentToolDefinition[];
}

export interface AgentToolInvokeRequest {
  tool: string;
  args?: Record<string, unknown>;
}

export interface AgentToolInvokeResponse {
  ok: boolean;
  tool?: string;
  error?: string;
  result?: unknown;
}

export interface DemoSecretStatusResponse {
  demoPasswordEnabled: boolean;
  youtubeApiKeyConfigured: boolean;
  spotifyClientIdConfigured: boolean;
  spotifyClientSecretConfigured: boolean;
  openAiApiKeyConfigured: boolean;
}

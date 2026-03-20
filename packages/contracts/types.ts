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
    canonicalObjectiveId?: string;
    legacyObjectiveId?: string;
    objectiveAliasIds?: string[];
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

export interface PlayerLanguageProfile {
  nativeLanguage: AppLanguage;
  targetLanguages: TargetLanguage[];
  proficiency: Record<TargetLanguage, 'none' | 'beginner' | 'intermediate' | 'advanced'>;
}

export interface HangoutScore {
  xp: number;
  sp: number;
  rp: number;
}

export type SessionMode = 'hangout' | 'learn';
export type ResumeSource = 'new_session' | 'checkpoint' | 'scenario_seed';
export type GameSessionStatus = 'active' | 'paused' | 'completed';
export type ScenePhase = 'intro' | 'dialogue' | 'exercise' | 'review' | 'mission' | 'reward';
export type ScenarioSeedSource = 'qa' | 'demo' | 'dev';

export interface ObjectiveDescriptor {
  objectiveId: string;
  canonicalObjectiveId?: string;
  legacyObjectiveId?: string;
  objectiveAliasIds?: string[];
  lang: TargetLanguage;
  mode: SessionMode;
  cityId: GraphCityId;
  locationId: GraphLocationId;
  objectiveCategory?: ObjectiveCategory;
  objectiveNodeId?: string;
  targetNodeIds?: string[];
  summary?: string;
}

export interface RouteStateDescriptor {
  pathname: string;
  query?: Record<string, string>;
}

export interface ExerciseCheckpointState {
  exerciseId: string;
  exerciseType: string;
  stepIndex?: number;
  prompt?: string;
  payloadVersion: number;
  state: Record<string, unknown>;
}

export interface RewardGrant {
  rewardId: string;
  rewardType:
    | 'xp_bonus'
    | 'sp_bonus'
    | 'rp_bonus'
    | 'mission_unlock'
    | 'video_call'
    | 'polaroid_memory'
    | 'collectible'
    | 'cosmetic';
  grantedAtIso: string;
  metadata?: Record<string, unknown>;
}

export interface MissionGateSnapshot {
  readiness: number;
  validatedHangouts: number;
  missionAssessmentUnlocked: boolean;
  masteryTier: number;
}

export interface UnlockSnapshot {
  locationIds: GraphLocationId[];
  missionIds: string[];
  rewardIds: string[];
}

export interface RngStateSnapshot {
  seed: string;
  version: number;
}

export interface CheckpointProgressionDelta extends HangoutScore {
  objectiveProgressDelta?: number;
  validatedHangoutsDelta?: number;
}

export interface Checkpoint {
  checkpointId: string;
  gameSessionId: string;
  sceneSessionId: string;
  kind: 'player_resume';
  route: RouteStateDescriptor;
  cityId: GraphCityId;
  locationId: GraphLocationId;
  mode: SessionMode;
  objective: ObjectiveDescriptor;
  phase: ScenePhase | string;
  turn: number;
  activeExercise?: ExerciseCheckpointState;
  progressionDelta: CheckpointProgressionDelta;
  rewards: RewardGrant[];
  missionGate: MissionGateSnapshot;
  unlocks: UnlockSnapshot;
  rng: RngStateSnapshot;
  createdAtIso: string;
}

export interface ScenarioSeed {
  seedId: string;
  label: string;
  source: ScenarioSeedSource;
  qaOnly: true;
  route: RouteStateDescriptor;
  cityId: GraphCityId;
  locationId: GraphLocationId;
  mode: SessionMode;
  objective: ObjectiveDescriptor;
  phase: ScenePhase | string;
  turn: number;
  activeExercise?: ExerciseCheckpointState;
  progressionDelta?: CheckpointProgressionDelta;
  rewards?: RewardGrant[];
  rng: RngStateSnapshot;
  notes?: string;
}

export interface GameSessionProgression extends HangoutScore {
  currentMasteryLevel: number;
}

export interface GameSession {
  sessionId: string;
  userId: string;
  status: GameSessionStatus;
  profile: PlayerLanguageProfile;
  cityId: GraphCityId;
  locationId: GraphLocationId;
  currentMode: SessionMode;
  activeSceneId: string;
  activeSceneSessionId: string;
  activeObjective: ObjectiveDescriptor;
  progression: GameSessionProgression;
  missionGate: MissionGateSnapshot;
  unlocks: UnlockSnapshot;
  rewards: RewardGrant[];
  availableActions: string[];
  resumeSource: ResumeSource;
  activeCheckpointId?: string;
  startedAtIso: string;
  updatedAtIso: string;
}

export interface SceneSession {
  sceneSessionId: string;
  gameSessionId: string;
  sceneId: string;
  cityId: GraphCityId;
  locationId: GraphLocationId;
  mode: SessionMode;
  objective: ObjectiveDescriptor;
  phase: ScenePhase | string;
  turn: number;
  route: RouteStateDescriptor;
  activeExercise?: ExerciseCheckpointState;
  progressionDelta: CheckpointProgressionDelta;
  checkpointable: boolean;
  uiPolicy?: {
    immersiveFirstPerson: boolean;
    allowOnlyDialogueAndHints: boolean;
  };
  startedAtIso: string;
  updatedAtIso: string;
}

export interface StartOrResumeGameRequest {
  userId: string;
  city?: GraphCityId;
  profile: PlayerLanguageProfile;
  resumeCheckpointId?: string;
  scenarioSeedId?: string;
  preferRomance?: boolean;
}

export interface StartOrResumeGameResponse {
  sessionId: string;
  city: GraphCityId;
  location: GraphLocationId;
  sceneId: string;
  mode: SessionMode;
  tongPrompt: string;
  profile: PlayerLanguageProfile;
  progression: GameSessionProgression;
  actions: string[];
  resumeSource: ResumeSource;
  gameSession: GameSession;
  sceneSession: SceneSession;
  activeCheckpoint: Checkpoint | null;
  availableScenarioSeeds: ScenarioSeed[];
}

export interface ObjectiveNextResponse {
  objectiveId: string;
  canonicalObjectiveId?: string;
  legacyObjectiveId?: string;
  objectiveAliasIds?: string[];
  level: number;
  mode: SessionMode;
  lang: TargetLanguage;
  objectiveGraph: {
    objectiveNodeId: string;
    cityId: GraphCityId;
    locationId: GraphLocationId;
    objectiveCategory: ObjectiveCategory;
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

export interface HangoutStartResponse {
  sceneSessionId: string;
  mode: SessionMode;
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
  canonicalObjectiveId?: string;
  legacyObjectiveId?: string;
  objectiveAliasIds?: string[];
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
  canonicalObjectiveId?: string;
  legacyObjectiveId?: string;
  objectiveAliasIds?: string[];
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

// ── Curriculum graph / learner dashboard ─────────────────────────────

export type GraphCityId = 'seoul' | 'tokyo' | 'shanghai';

export type GraphLocationId =
  | 'food_street'
  | 'cafe'
  | 'convenience_store'
  | 'subway_hub'
  | 'practice_studio';

export type ObjectiveCategory =
  | 'script'
  | 'pronunciation'
  | 'vocabulary'
  | 'grammar'
  | 'sentences'
  | 'conversation'
  | 'mastery';

export type CurriculumGraphNodeType = 'objective' | 'media_overlay';

export type CurriculumGraphEdgeType = 'requires' | 'reinforces' | 'unlocks';

export type LearnerNodeStatus =
  | 'locked'
  | 'available'
  | 'learning'
  | 'due'
  | 'validated'
  | 'mastered';

export type EvidenceSource = 'learn' | 'hangout' | 'exercise' | 'mission' | 'review' | 'media';

export interface ScriptTarget {
  id: string;
  label: string;
  transliteration?: string;
  notes?: string;
  level: number;
}

export interface PronunciationTarget {
  id: string;
  label: string;
  transliteration?: string;
  notes?: string;
  level: number;
}

export interface VocabularyTarget {
  id: string;
  word: string;
  romanization: string;
  translation: string;
  category: string;
  level: number;
  sceneContext?: string;
  visualCue?: string;
}

export interface GrammarTarget {
  id: string;
  pattern: string;
  explanation: string;
  examples: Array<{
    target: string;
    translation: string;
  }>;
  level: number;
  locationId: string;
}

export interface SentenceFrameTarget {
  id: string;
  pattern: string;
  explanation: string;
  examples: Array<{
    target: string;
    translation: string;
  }>;
  level: number;
}

export interface CurriculumGraphNode {
  nodeId: string;
  type: CurriculumGraphNodeType;
  cityId: GraphCityId;
  locationId: GraphLocationId;
  lang: TargetLanguage;
  level: number;
  title: string;
  description: string;
  tags: string[];
  targetItemIds?: string[];
  targetCount?: number;
  assessmentThreshold?: number;
  objectiveCategory?: ObjectiveCategory;
  personalized?: {
    source: 'youtube' | 'spotify';
    rationale: string;
  };
}

export interface CurriculumGraphEdge {
  edgeId: string;
  type: CurriculumGraphEdgeType;
  fromNodeId: string;
  toNodeId: string;
  rationale?: string;
}

export interface LocationMission {
  missionId: string;
  title: string;
  description: string;
  level: number;
  requiredNodeIds: string[];
  rewards: {
    xp: number;
    sp: number;
    rp: number;
  };
}

export interface LocationScenario {
  scenarioId: string;
  mode: 'learn' | 'hangout';
  title: string;
  description: string;
  targetNodeIds: string[];
}

export interface CurriculumPackLevel {
  level: number;
  label: string;
  description: string;
  objectiveNodeIds: string[];
  assessmentCriteria: {
    minAccuracy: number;
    minItemsCompleted: number;
    requiredNodeIds: string[];
  };
}

export interface LocationCurriculumPack {
  packId: string;
  version: string;
  cityId: GraphCityId;
  locationId: GraphLocationId;
  lang: TargetLanguage;
  title: string;
  summary: string;
  goldStandard: boolean;
  contentVersionPolicy: 'append_only';
  nodes: CurriculumGraphNode[];
  edges: CurriculumGraphEdge[];
  levels: CurriculumPackLevel[];
  scenarios: LocationScenario[];
  missions: LocationMission[];
  content: {
    scriptTargets: ScriptTarget[];
    pronunciationTargets: PronunciationTarget[];
    vocabularyTargets: VocabularyTarget[];
    grammarTargets: GrammarTarget[];
    sentenceFrameTargets: SentenceFrameTarget[];
  };
}

export interface LearnerNodeState {
  learnerId: string;
  nodeId: string;
  status: LearnerNodeStatus;
  masteryScore: number;
  nextReviewAt?: string;
  lastEvidenceAt?: string;
  evidenceCount: number;
  blockerNodeIds: string[];
  recommendedReason?: string;
}

export interface EvidenceEvent {
  eventId: string;
  learnerId: string;
  nodeId: string;
  source: EvidenceSource;
  mode: 'learn' | 'hangout' | 'review' | 'mission';
  correct: boolean;
  qualityScore: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface GraphRecommendation {
  recommendationId: string;
  type: 'lesson' | 'hangout' | 'review' | 'mission' | 'overlay';
  title: string;
  reason: string;
  nodeIds: string[];
  cityId: GraphCityId;
  locationId: GraphLocationId;
  lang: TargetLanguage;
  foundation: boolean;
  priority: number;
}

export interface LearnerPersonaProfile {
  learnerId: string;
  displayName: string;
  targetLanguages: TargetLanguage[];
  proficiency: Record<TargetLanguage, 'none' | 'beginner' | 'intermediate' | 'advanced'>;
  goals: Array<{
    lang: TargetLanguage;
    topic: string;
  }>;
  mediaPreferences: {
    youtube: string[];
    spotify: string[];
  };
}

export interface WorldRoadmapEntry {
  cityId: GraphCityId;
  locationId: GraphLocationId;
  title: string;
  lang: TargetLanguage;
  status: 'ready' | 'in_progress' | 'stub';
  summary: string;
  activeNodeCount: number;
  completedNodeCount: number;
}

export interface LocationSkillTreeNode {
  node: CurriculumGraphNode;
  state: LearnerNodeState;
  blockers: string[];
}

export interface PersonalizedOverlayNode {
  overlayId: string;
  title: string;
  lang: TargetLanguage;
  source: 'youtube' | 'spotify';
  connectedNodeIds: string[];
  rationale: string;
  suggestedTerms: string[];
}

export interface GraphDashboardResponse {
  learner: LearnerPersonaProfile;
  progression: {
    xp: number;
    sp: number;
    rp: number;
  };
  roadmap: WorldRoadmapEntry[];
  selectedPack: {
    pack: LocationCurriculumPack;
    nodes: LocationSkillTreeNode[];
  };
  overlays: PersonalizedOverlayNode[];
  recommendations: GraphRecommendation[];
  evidence: {
    totalEvents: number;
    lastUpdatedAt?: string;
  };
}

export interface GraphLessonBundleResponse {
  learnerId: string;
  nodeIds: string[];
  objectiveIds: string[];
  title: string;
  reason: string;
}

export interface GraphHangoutBundleResponse {
  learnerId: string;
  nodeIds: string[];
  objectiveIds: string[];
  scenarioId: string;
  title: string;
  reason: string;
}

export interface GraphPackValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

export interface GraphPackValidationResponse {
  valid: boolean;
  packId: string;
  issues: GraphPackValidationIssue[];
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
    canonicalObjectiveId?: string | null;
    legacyObjectiveId?: string | null;
    objectiveAliasIds?: string[];
    mode: 'learn' | 'hangout' | 'mission' | 'review' | 'exercise' | 'media';
    quality: number;
    occurredAtIso: string;
    source: string;
  }>;
  progression: {
    xp: number;
    sp: number;
    rp: number;
  };
  metrics: {
    validatedObjectives: number;
    masteredObjectives: number;
    dueNodeCount: number;
    evidenceCount: number;
  };
}

export interface GraphOverlayProposalResponse {
  learnerId: string;
  overlays: PersonalizedOverlayNode[];
}

// ── Volcengine / ByteDance API types ────────────────────────────────

/** Image generation request (Seedream) */
export interface VolcImageGenerateArgs {
  prompt: string;
  model?: string;
  size?: '1K' | '2K' | '4K';
  n?: number;
  seed?: number;
  guidanceScale?: number;
  responseFormat?: 'url' | 'b64_json';
}

export interface VolcImageResult {
  url?: string;
  b64Json?: string;
}

export interface VolcImageGenerateResponse {
  images: VolcImageResult[];
  model: string;
  seed?: number;
}

/** Video generation task (Seedance) – async, task-based */
export type VolcVideoStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface VolcVideoContentItem {
  type: 'text' | 'image_url';
  text?: string;
  imageUrl?: string;
}

export interface VolcVideoCreateArgs {
  model?: string;
  content: VolcVideoContentItem[];
  resolution?: '480p' | '720p' | '1080p' | '2K';
  ratio?: '16:9' | '9:16' | '4:3' | '3:4' | '1:1';
  duration?: number;
  seed?: number;
  generateAudio?: boolean;
  serviceTier?: 'default' | 'flex';
  callbackUrl?: string;
}

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

export interface VolcVideoGetArgs {
  taskId: string;
}

export interface VolcVideoListArgs {
  limit?: number;
  after?: string;
}

export interface VolcVideoListResponse {
  tasks: VolcVideoTask[];
  hasMore: boolean;
}

/** Text-to-speech (Volcengine TTS) */
export interface VolcTTSSynthesizeArgs {
  text: string;
  voiceType?: string;
  encoding?: 'mp3' | 'wav' | 'ogg' | 'pcm';
  speedRatio?: number;
  volumeRatio?: number;
  pitchRatio?: number;
  emotion?: string;
  language?: 'en' | 'cn' | 'ja' | 'ko' | 'zh';
}

export interface VolcTTSSynthesizeResponse {
  audioBase64: string;
  encoding: string;
  durationMs?: number;
}

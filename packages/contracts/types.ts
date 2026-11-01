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
  clusterId?: string;
  sourceBreakdown?: {
    youtube: number;
    spotify: number;
  };
  provenance?: IngestionProvenance;
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
  placementHints?: PlacementHint[];
}

export interface IngestionProvenanceSample {
  source: 'youtube' | 'spotify';
  mediaId: string;
  title?: string;
  consumedAtIso: string;
}

export interface IngestionProvenance {
  sources: Array<'youtube' | 'spotify'>;
  mediaIds: string[];
  samples: IngestionProvenanceSample[];
}

export interface PlacementHint {
  city: string;
  location: string;
  mode: 'hangout' | 'learn';
  placementType: string;
  reason: string;
  clusterId: string;
  objectiveId: string;
  canonicalObjectiveId?: string;
  legacyObjectiveId?: string;
  objectiveAliasIds?: string[];
  confidence?: number;
}

export interface VocabInsightItem {
  lemma: string;
  lang: TargetLanguage;
  score: number;
  frequency: number;
  burst: number;
  clusterId: string;
  orthographyFeatures: Record<string, unknown>;
  provenance?: IngestionProvenance;
  placementHints?: PlacementHint[];
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
      provenance?: IngestionProvenance;
      placementHints?: PlacementHint[];
    }>;
    clusterAffinities: Array<{
      clusterId: string;
      label: string;
      score: number;
    }>;
    placementCandidates?: PlacementHint[];
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
  mapLocationId?: MapLocationId;
  dagLocationSlot?: GraphLocationId;
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

export type ScriptedMessagingTranslationMode =
  | 'primary_only'
  | 'primary_with_english'
  | 'primary_local_explanation_with_english';

export type ScriptedMessagingPlayerState = 'idle' | 'playing' | 'paused' | 'finished';

export interface ScriptedMessagingSpeaker {
  id: 'tong' | 'player' | 'character';
  displayName: string;
  avatarEmoji?: string;
}

export interface ScriptedMessagingRow {
  rowId: string;
  speakerId: ScriptedMessagingSpeaker['id'];
  atMs: number;
  typingMs?: number;
  primaryText: string;
  localExplanationText?: string;
  englishText?: string;
}

export interface ScriptedMessagingScene {
  sceneId: string;
  cityId: GraphCityId;
  objectiveId: string;
  title: string;
  hookText?: string;
  speakers: ScriptedMessagingSpeaker[];
  rows: ScriptedMessagingRow[];
}

export interface ScriptedMessagingSceneList {
  scenes: ScriptedMessagingScene[];
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

export type MapLocationId =
  | GraphLocationId
  | 'metro_station'
  | 'bbq_stall'
  | 'milk_tea_shop'
  | 'dumpling_shop'
  | 'train_station'
  | 'izakaya'
  | 'konbini'
  | 'tea_house'
  | 'ramen_shop';

export interface WorldMapLocationRegistryEntry {
  mapLocationId: MapLocationId;
  dagLocationSlot: GraphLocationId;
  label: string;
  legacyLocationIds?: GraphLocationId[];
}

export interface WorldMapCityRegistry {
  cityId: GraphCityId;
  defaultMapLocationId: MapLocationId;
  locations: WorldMapLocationRegistryEntry[];
}

export interface WorldMapRegistry {
  version: string;
  cities: WorldMapCityRegistry[];
}

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

export interface EvidenceTargetResult {
  targetId: string;
  correct: boolean;
  qualityScore?: number;
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
  targetResults?: EvidenceTargetResult[];
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
  mapLocationId?: MapLocationId;
  dagLocationSlot?: GraphLocationId;
  title: string;
  lang: TargetLanguage;
  status: 'ready' | 'in_progress' | 'stub';
  summary: string;
  activeNodeCount: number;
  completedNodeCount: number;
}

export interface LanguageTierInfo {
  level: number;
  label: string;
  description: string;
}

export interface LanguageProgressCategoryStat {
  category: ObjectiveCategory;
  masteryScore: number;
  nodeCount: number;
}

export interface LanguageProgressSummary {
  learnerId: string;
  lang: TargetLanguage;
  languageTier: LanguageTierInfo;
  progressToNextTier: number;
  completedNodeCount: number;
  activeNodeCount: number;
  totalNodeCount: number;
  nextUnlockNodeIds: string[];
  strongestCategories: LanguageProgressCategoryStat[];
  weakestCategories: LanguageProgressCategoryStat[];
  recommendedAction: 'lesson' | 'hangout' | 'review' | 'mission';
}

export interface NodeTargetProgress {
  nodeId: string;
  totalTargetCount: number;
  completedTargetCount: number;
  completionRatio: number;
  remainingTargetIds: string[];
  weakTargetIds: string[];
  lastPracticedTargetIds: string[];
}

export interface MissionGateStatus {
  missionId: string;
  title: string;
  description: string;
  level: number;
  status: 'blocked' | 'ready' | 'completed';
  ready: boolean;
  completed: boolean;
  completedAt?: string;
  requiredNodeIds: string[];
  completedRequiredNodeIds: string[];
  remainingRequiredNodeIds: string[];
  reason: string;
  rewards: {
    xp: number;
    sp: number;
    rp: number;
  };
}

export interface GraphNextUnlock {
  nodeId: string;
  title: string;
  level: number;
  objectiveCategory?: ObjectiveCategory;
  remainingBlockerNodeIds: string[];
  pathNodeIds: string[];
  reason: string;
}

export interface GraphReadinessState {
  ready: boolean;
  reason: string;
  blockingNodeIds: string[];
}

export interface LocationSkillTreeNode {
  node: CurriculumGraphNode;
  state: LearnerNodeState;
  blockers: string[];
  targetProgress?: NodeTargetProgress;
  unlocksNodeIds?: string[];
  missionCritical?: boolean;
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
  languageSummary?: LanguageProgressSummary;
  progression: {
    xp: number;
    sp: number;
    rp: number;
  };
  worldMapRegistry?: WorldMapRegistry;
  roadmap: WorldRoadmapEntry[];
  nextUnlocks?: GraphNextUnlock[];
  selectedPack: {
    pack: LocationCurriculumPack;
    nodes: LocationSkillTreeNode[];
    missionGate?: MissionGateStatus | null;
    lessonBundle?: GraphLessonBundleResponse;
    hangoutBundle?: GraphHangoutBundleResponse;
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
  lang?: TargetLanguage;
  cityId?: GraphCityId;
  locationId?: GraphLocationId;
  mapLocationId?: MapLocationId;
  dagLocationSlot?: GraphLocationId;
  title: string;
  reason: string;
  focusNodeId?: string;
  focusTargetIds?: string[];
  targetProgress?: NodeTargetProgress[];
  nextUnlockNodeIds?: string[];
}

export interface GraphHangoutBundleResponse {
  learnerId: string;
  nodeIds: string[];
  objectiveIds: string[];
  lang?: TargetLanguage;
  cityId?: GraphCityId;
  locationId?: GraphLocationId;
  mapLocationId?: MapLocationId;
  dagLocationSlot?: GraphLocationId;
  scenarioId: string;
  title: string;
  reason: string;
  ready?: boolean;
  focusNodeId?: string;
  focusTargetIds?: string[];
  targetProgress?: NodeTargetProgress[];
  readiness?: GraphReadinessState;
  missionGate?: MissionGateStatus | null;
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
  accepted?: boolean;
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
  event?: EvidenceEvent;
  state?: LearnerNodeState;
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

/* ── Cozy 3D game ↔ host page bridge (window.postMessage) ───────────────
 * The cozy Three.js game (apps/client/public/cozy) runs in an iframe on /cozy.
 * It never keeps its own learning progress: it asks the host page to run the
 * shared exercise components and to read/write the shared game store.
 * Messages are same-origin only; the host also checks event.source.
 */

export const COZY_BRIDGE_PROTOCOL = 'tong-cozy-bridge' as const;
export const COZY_BRIDGE_VERSION = 1 as const;

export type CozyExerciseType = 'block_crush' | 'sentence_builder' | 'multiple_choice' | 'pronunciation_select' | 'matching';
export type CozyExerciseStage = 'intro' | 'recognition' | 'recall';
export type CozyItemCategory = 'script' | 'vocabulary' | 'grammar';
export type CozyCityId = 'seoul' | 'tokyo' | 'shanghai';

export interface CozyExerciseRequest {
  exerciseType: CozyExerciseType;
  /**
   * What is practised. block_crush: one Hangul word (["우유"]).
   * sentence_builder: the tokens in their correct order (["떡볶이", "주세요"]).
   * Other types: hint items passed to the shared generators.
   */
  targetItems: string[];
  /** Objective id from the shared curriculum, e.g. "ko-script-blocks-2part". */
  objectiveId: string;
  /** Omit to let the host choose from the player's mastery. */
  stage?: CozyExerciseStage;
  /** How the world frames the exercise; shown above it. */
  framing: { speakerId?: string; ko?: string; en: string };
  /** Meaning of the target (block_crush, sentence_builder). */
  meaning?: string;
  /** Extra wrong tiles for sentence_builder. */
  distractors?: string[];
  cityId: CozyCityId;
  /** Shared location id, e.g. "convenience_store", "food_street". */
  locationId: string;
  characterId?: string;
}

export type CozyExerciseOutcome = 'completed' | 'dismissed' | 'unavailable';

export interface CozyRecordedItem {
  itemId: string;
  category: CozyItemCategory;
  correct: boolean;
}

export interface CozyExerciseResult {
  outcome: CozyExerciseOutcome;
  /** null unless outcome is 'completed'. */
  correct: boolean | null;
  exerciseId: string | null;
  exerciseType: CozyExerciseType;
  /** Mastery results the host recorded in the shared store. */
  recordedItems: CozyRecordedItem[];
  xpAwarded: number;
  progress: CozyProgressSnapshot;
  /** Why the exercise could not run (outcome 'unavailable'). */
  reason?: string;
}

/**
 * World events the cozy game reports; the host validates and applies them.
 * beatId names the story beat that earned the event (e.g. "aff:greet#1",
 * "hangout:convenience_store:day3"); the host applies each beat once, so
 * replaying scripted scenes or restarting the cozy world cannot farm progress.
 */
export type CozyProgressEvent =
  | { kind: 'affinity'; characterId: string; delta: number; beatId?: string }
  | { kind: 'item_seen'; itemId: string; category: CozyItemCategory }
  | { kind: 'location_hangout'; cityId: CozyCityId; locationId: string; beatId?: string };

export interface CozyRelationshipSnapshot {
  affinity: number;
  stage: 'strangers' | 'acquaintances' | 'colleagues' | 'friends' | 'close' | 'romantic';
}

export interface CozyItemSnapshot {
  masteryLevel: 'new' | 'seen' | 'learning' | 'familiar' | 'mastered';
  correct: number;
  incorrect: number;
}

/** Read-only view of the shared game store sent to the cozy game. */
export interface CozyProgressSnapshot {
  xp: number;
  sp: number;
  level: number | null;
  relationships: Record<string, CozyRelationshipSnapshot>;
  /** Keyed "seoul:convenience_store". */
  locationHangoutCounts: Record<string, number>;
  items: Record<string, CozyItemSnapshot>;
}

/** One-time import of a legacy cozy save (localStorage "tong-cozy-seoul-v2"). */
export interface CozyLegacyMigration {
  /** Deterministic id of the legacy save; a repeat import is ignored. */
  saveId: string;
  /** Cozy hearts per character (Ha-eun 0–8, Jin 0–2 in the legacy save). */
  hearts: { characterId: 'haeun' | 'jin'; hearts: number }[];
  /** Phrase book entries the player met. */
  phrases: { ko: string; en?: string }[];
}

export interface CozyMigrationResult {
  applied: boolean;
  progress: CozyProgressSnapshot;
}

/**
 * Tong's practice modes, opened by tapping Tong in the world.
 * learn: a Tong lesson for the place the player stands in.
 * review: fresh exercises on words the player has met, harder as they master them.
 */
export type CozyPracticeMode = 'learn' | 'review';

export interface CozyPracticeWord {
  ko: string;
  rom?: string;
  en?: string;
}

export interface CozyPracticeRequest {
  mode: CozyPracticeMode;
  cityId: CozyCityId;
  /** Shared location id of the place the player is at, e.g. "food_street". */
  locationId: string;
  /** The player's phrase book (review draws from it); at most 400. */
  words: CozyPracticeWord[];
}

export interface CozyPracticeResult {
  outcome: CozyExerciseOutcome;
  mode: CozyPracticeMode;
  exercises: number;
  correct: number;
  xpAwarded: number;
  progress: CozyProgressSnapshot;
  reason?: string;
}

interface CozyEnvelope<T extends string, P> {
  protocol: typeof COZY_BRIDGE_PROTOCOL;
  version: typeof COZY_BRIDGE_VERSION;
  type: T;
  /** Set on requests; echoed on the matching reply. */
  requestId?: string;
  payload: P;
}

/** Cozy game → host page. */
export type CozyToHostMessage =
  | CozyEnvelope<'cozy:hello', Record<string, never>>
  | CozyEnvelope<'cozy:exercise', CozyExerciseRequest>
  | CozyEnvelope<'cozy:progress', { events: CozyProgressEvent[] }>
  | CozyEnvelope<'cozy:migrate', CozyLegacyMigration>
  | CozyEnvelope<'cozy:practice', CozyPracticeRequest>;

/** The host page's safe-area insets in CSS px; an iframe cannot read them itself on iOS. */
export interface CozyViewport {
  safeArea: { top: number; right: number; bottom: number; left: number };
}

/**
 * Host page → cozy game. 'host:progress' is also pushed unprompted when the
 * store changes, and 'host:viewport' after ready and on resize/rotation.
 */
export type HostToCozyMessage =
  | CozyEnvelope<'host:ready', { progress: CozyProgressSnapshot }>
  | CozyEnvelope<'host:viewport', CozyViewport>
  | CozyEnvelope<'host:progress', { progress: CozyProgressSnapshot }>
  | CozyEnvelope<'host:exercise-result', CozyExerciseResult>
  | CozyEnvelope<'host:migrated', CozyMigrationResult>
  | CozyEnvelope<'host:practice-result', CozyPracticeResult>
  | CozyEnvelope<'host:error', { reason: string }>;

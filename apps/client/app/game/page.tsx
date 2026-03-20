'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from 'ai/react';
import type { ToolInvocation, UIMessage } from 'ai';
import { startOrResumeGame, type CityId, type LocationId, type ProficiencyLevel, type ScoreState, type UserProficiency, type AppLang } from '@/lib/api';
import type { SessionMessage, ToolQueueItem, SceneSummary, ExerciseData, BlockCrushCharStep, BlockCrushExercise } from '@/lib/types/hangout';
import type { CompletedSession } from '@/lib/store/session-store';
import type { DialogueChoice } from '@/components/scene/ChoiceButtons';
import type { Character } from '@/lib/types/relationship';
import { SceneView } from '@/components/scene/SceneView';
import { generateExercise } from '@/lib/exercises/generators';
import { getTargetByChar } from '@/lib/content/block-crush-data';
import { parseExerciseData } from '@/lib/exercises/validate';
import { extractTargetItems } from '@/lib/exercises/extract-targets';
import { summarizeExercise } from '@/lib/utils/summarize-exercise';
import { useGameState, dispatch, getRelationship, getMasterySnapshot, getGameState } from '@/lib/store/game-store';
import type { PlayerProfile } from '@/lib/store/game-store';
import { CHARACTER_MAP, HAEUN, TUTORIAL_VIDEO_CONFIG, pickRandom } from '@/lib/content/characters';
import { type TongExpression, TONG_EXPRESSIONS } from '@/lib/content/tong-expressions';
import { useVideoGeneration } from '@/lib/hooks/useVideoGeneration';
import { POJANGMACHA } from '@/lib/content/pojangmacha';
import { getLocationOrDefault, getLanguageForCity } from '@/lib/content/locations';
import { getRelationshipStage } from '@/lib/types/relationship';
import { CityMap, CITY_ORDER } from '@/components/city-map/CityMap';
import { KoreanText } from '@/components/shared/KoreanText';
import { LearnPanel } from '@/components/learn/LearnPanel';
import { sessionLogger } from '@/lib/debug/session-logger';
import { UILangProvider } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import type { UILang } from '@/lib/i18n/ui-strings';
import { GameHUD } from '@/components/hud/GameHUD';
import { ExerciseModal } from '@/components/learn/ExerciseModal';
import { resolveRuntimeAssetUrl, runtimeAssetUrl } from '@/lib/runtime-assets';
import { buildResumePrompt, hydrateResumeState, type ResumeBootstrapPayload } from '@/lib/store/checkpoint-resume';

/* ── scene constants ────────────────────────────────────── */

const GAME_LOGO_URL = runtimeAssetUrl('app.logo.transparent.default');
const GAME_INTRO_VIDEO_URL = runtimeAssetUrl('app.intro.video.default');
const SEOUL_FOOD_STREET_BACKDROP_URL = runtimeAssetUrl('city.seoul.location.food-street.backdrop.default');

const NPC_SPRITES: Record<string, { name: string; nameLocal: string; nameZh: string; src: string; idleVideo?: string; color: string }> = {
  haeun: { name: 'Ha-eun', nameLocal: '하은', nameZh: '夏恩', src: runtimeAssetUrl('character.haeun.portrait.default'), color: '#e8485c' },
  jin: { name: 'Jin', nameLocal: '진', nameZh: '珍', src: runtimeAssetUrl('character.jin.portrait.default'), color: '#4a90d9' },
};

const NPC_POOL = ['haeun', 'jin'] as const;

/** Pick an NPC that belongs to the given city, falling back to any NPC. */
function pickNpcForCity(cityId: CityId): string {
  const cityNpcs = NPC_POOL.filter((id) => CHARACTER_MAP[id]?.cityId === cityId);
  const pool = cityNpcs.length > 0 ? cityNpcs : NPC_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ── Charge notification (auto-dismisses via parent timer) ── */
function ChargeNotif({ text }: { text: string }) {
  return (
    <div className="charge-notif">
      {text}
    </div>
  );
}


/* ── constants ──────────────────────────────────────────── */


const GAME_LEVELS = [
  { level: 0, name: 'SCRIPT',        desc: 'Learning to read the symbols',        tongLangPct: 5 },
  { level: 1, name: 'PRONUNCIATION', desc: 'Starting to sound things out',        tongLangPct: 10 },
  { level: 2, name: 'VOCABULARY',    desc: 'Building a word bank',                tongLangPct: 20 },
  { level: 3, name: 'GRAMMAR',       desc: 'Forming basic sentences',             tongLangPct: 35 },
  { level: 4, name: 'SENTENCES',     desc: 'Expressing ideas clearly',            tongLangPct: 50 },
  { level: 5, name: 'CONVERSATION',  desc: 'Holding real conversations',          tongLangPct: 70 },
  { level: 6, name: 'MASTERY',       desc: 'Thinking in this language',           tongLangPct: 90 },
] as const;

const SLIDER_TO_LEVEL: ProficiencyLevel[] = ['none', 'none', 'beginner', 'beginner', 'intermediate', 'advanced', 'advanced'];

const LANG_KEYS: (keyof UserProficiency)[] = ['ko', 'ja', 'zh'];

const LANG_LABELS: { key: keyof UserProficiency; name: string; native: string; flag: string }[] = [
  { key: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
  { key: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
  { key: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
];

const LANG_TO_CITY: Record<string, CityId> = { ko: 'seoul', ja: 'tokyo', zh: 'shanghai' };

const EXPLAIN_LANG_OPTIONS: { value: AppLang; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
];


const CITY_EXPLAIN_ROWS: { cityId: CityId; label: string; target: string }[] = [
  { cityId: 'shanghai', label: 'Shanghai', target: 'Chinese' },
  { cityId: 'tokyo', label: 'Tokyo', target: 'Japanese' },
  { cityId: 'seoul', label: 'Seoul', target: 'Korean' },
];

const CITY_NAMES: Record<CityId, { en: string; local: string }> = {
  seoul: { en: 'Seoul', local: '서울' },
  tokyo: { en: 'Tokyo', local: '東京' },
  shanghai: { en: 'Shanghai', local: '上海' },
};

const LOCATION_NAMES: Record<LocationId, string> = {
  food_street: 'Food Street',
  cafe: 'Cafe',
  convenience_store: 'Convenience Store',
  subway_hub: 'Subway Hub',
  practice_studio: 'Practice Studio',
  // Shanghai
  metro_station: 'Metro Station',
  bbq_stall: 'BBQ Stall',
  milk_tea_shop: 'Milk Tea Shop',
  dumpling_shop: 'Dumpling Shop',
  // Tokyo
  train_station: 'Train Station',
  izakaya: 'Izakaya',
  konbini: 'Convenience Store',
  tea_house: 'Tea House',
  ramen_shop: 'Ramen Shop',
};


/* ── types ──────────────────────────────────────────────── */

type Phase = 'opening' | 'menu' | 'tong-intro' | 'hangout' | 'city_map' | 'learn' | 'dev';

type NpcSpeakToolArgs = {
  characterId?: string;
  text?: string;
  translation?: string | null;
};

const ACTIVE_HANGOUT_RESUME_STORAGE_KEY = 'tong_active_hangout_resume';

interface ActiveHangoutResumeSnapshot {
  sessionId: string | null;
  checkpointId: string | null;
  resumeSource: string | null;
  cityId: CityId;
  locationId: LocationId;
  npcId: string;
  playerLevel: number;
  phase: string;
  turn: number;
  objectiveSummary: string | null;
  currentMessage: SessionMessage | null;
  currentExercise: ExerciseData | null;
  choices: DialogueChoice[] | null;
  choicePrompt: string | null;
  tongTip: { message: string; translation?: string } | null;
  score: ScoreState;
  savedAtIso: string;
}


/* ── helpers ────────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStoredHangoutResume(): ActiveHangoutResumeSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_HANGOUT_RESUME_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveHangoutResumeSnapshot;
  } catch (error) {
    console.warn('[RESUME] Failed to read stored active hangout snapshot.', error);
    return null;
  }
}

function writeStoredHangoutResume(snapshot: ActiveHangoutResumeSnapshot | null) {
  if (typeof window === 'undefined') return;

  if (!snapshot) {
    window.localStorage.removeItem(ACTIVE_HANGOUT_RESUME_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_HANGOUT_RESUME_STORAGE_KEY, JSON.stringify(snapshot));
}

function getNpcSpeakArgs(invocation: ToolInvocation): NpcSpeakToolArgs | null {
  if (invocation.toolName !== 'npc_speak' || !('args' in invocation) || !isRecord(invocation.args)) {
    return null;
  }

  return invocation.args as NpcSpeakToolArgs;
}

function getLatestNpcSpeakInvocation(messages: UIMessage[]): ToolInvocation | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const toolInvocations = messages[messageIndex]?.toolInvocations;
    if (!toolInvocations?.length) continue;

    for (let invocationIndex = toolInvocations.length - 1; invocationIndex >= 0; invocationIndex -= 1) {
      const invocation = toolInvocations[invocationIndex];
      if (invocation.toolName === 'npc_speak') {
        return invocation;
      }
    }
  }

  return null;
}

function buildStreamedNpcMessage(
  invocation: ToolInvocation,
  fallbackCharacterId: string,
): SessionMessage | null {
  const args = getNpcSpeakArgs(invocation);
  if (!args) return null;

  return {
    id: invocation.toolCallId,
    role: 'npc',
    characterId: typeof args.characterId === 'string' ? args.characterId : fallbackCharacterId,
    content: typeof args.text === 'string' ? args.text : '',
    translation: typeof args.translation === 'string' ? args.translation : undefined,
  };
}

/** Build rich context block for API messages using game store data. */
function buildContextBlock(
  level: number,
  npcId: string,
  cityId: CityId,
  locationId: LocationId,
  npcChar: Character,
  explainIn: AppLang = 'en',
  introCtx?: {
    isIntroduction: boolean;
    playerName: string;
    videoStatus: 'generating' | 'ready' | 'failed';
    exitVideoUrl: string | null;
    exitLine: string;
    exercisesDone: number;
    introAct?: 1 | 2;
    backdropUrl?: string;
    chargePercent?: number;
    chargeComplete?: boolean;
  },
): string {
  // explainIn is resolved per-city by the caller
  const loc = getLocationOrDefault(cityId, locationId);
  const rel = getRelationship(npcId);
  const stage = getRelationshipStage(rel.affinity);
  const mastery = getMasterySnapshot(loc);
  const isFirstEncounter = rel.interactionCount === 0;

  const locLevel = Math.min(level, loc.levels.length - 1);
  const objectives = loc.levels[locLevel]?.objectives ?? [];

  const ctx = JSON.stringify({
    playerLevel: level,
    playerProfile: getGameState().playerProfile,
    characterId: npcId,
    city: cityId,
    location: locationId,
    stage,
    relationship: rel,
    mastery,
    isFirstEncounter,
    selfAssessedLevel: level,
    calibratedLevel: rel.interactionCount > 0 ? level : null,
    locationLevel: locLevel,
    objectives,
    explainIn,
    ...(introCtx ?? {}),
  });
  return `[HANGOUT_CONTEXT]${ctx}[/HANGOUT_CONTEXT] `;
}

/** Find the weakest language (lowest slider value), breaking ties left-to-right. */
function getWeakestLangIndex(sliders: [number, number, number]): number {
  let minIdx = 0;
  for (let i = 1; i < sliders.length; i++) {
    if (sliders[i] < sliders[minIdx]) minIdx = i;
  }
  return minIdx;
}

/* ── component ──────────────────────────────────────────── */

export default function GamePage() {
  const searchParams = useSearchParams();
  const gameState = useGameState();

  /* phase state — ?phase=hangout|city_map skips straight there, ?dev=exercise opens dev tester, ?dev_intro=1 fresh intro hangout, ?fresh=1 replay from opening */
  const phaseParam = searchParams.get('phase');
  const devParam = searchParams.get('dev');
  const devIntro = searchParams.get('dev_intro') === '1';
  const freshStart = searchParams.get('fresh') === '1';
  const freshNpc = searchParams.get('npc') ?? undefined; // pre-select NPC for fresh start
  const freshLang = searchParams.get('lang') as AppLang | null; // pre-set explain language
  const qaRunId = searchParams.get('qa_run_id') ?? undefined;
  const qaTrace = searchParams.get('qa_trace') === '1';
  const skipToHangout = phaseParam === 'hangout';
  const skipToCityMap = phaseParam === 'city_map';
  const skipToLearn = phaseParam === 'learn';
  const [phase, setPhase] = useState<Phase>(
    freshStart ? 'opening' : devIntro ? 'hangout' : devParam === 'exercise' ? 'dev' : skipToHangout ? 'hangout' : skipToCityMap ? 'city_map' : skipToLearn ? 'learn' : 'opening'
  );
  const openingVideoRef = useRef<HTMLVideoElement>(null);

  /* ?fresh=1 — full reset: clear game state + force back to opening.
     Done synchronously during render so no stale-state effects can fire.
     Only runs once per mount — after reset, the normal flow takes over. */
  const freshResetDone = useRef(false);
  if (freshStart && !freshResetDone.current) {
    freshResetDone.current = true;
    console.log('[FRESH] Resetting game state, forcing phase=opening');
    dispatch({ type: 'RESET' });
    writeStoredHangoutResume(null);
    // Pre-set explainIn language from ?lang= param for all cities
    if (freshLang && ['en', 'ko', 'ja', 'zh'].includes(freshLang)) {
      dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId: 'seoul', lang: freshLang });
      dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId: 'tokyo', lang: freshLang });
      dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId: 'shanghai', lang: freshLang });
    }
    if (phase !== 'opening') {
      setPhase('opening');
    }
  }

  /* tong-intro typewriter — random set each playthrough */
  const TONG_INTRO_SETS = [
    [
      "They call me Tong. I connect people \u2014 it\u2019s what I do.",
      "Learn the words. Read the room. Build the bonds.",
      "Three cities are about to change your life.",
    ],
    [
      "I\u2019m Tong. I\u2019ve been waiting for you.",
      "Seoul, Tokyo, Shanghai \u2014 each one has something you need.",
      "Speak their language, earn their trust, and doors will open.",
    ],
    [
      "The name\u2019s Tong. Think of me as your edge.",
      "Nobody makes it in this industry without the right connections.",
      "Lucky for you, I know everyone. Let\u2019s get started.",
    ],
    [
      "I\u2019m Tong. Every star you\u2019ve heard of? They started exactly where you are.",
      "Three cities. Three languages. One shot to make it.",
      "Stay sharp and follow my lead.",
    ],
  ];
  const [introSetIdx] = useState(() => Math.floor(Math.random() * TONG_INTRO_SETS.length));
  const TONG_INTRO_LINES = TONG_INTRO_SETS[introSetIdx];
  const CHARS_PER_TICK = 2;
  const TICK_MS = 30;
  const [introLineIdx, setIntroLineIdx] = useState(0);
  const [introCharIdx, setIntroCharIdx] = useState(0);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase !== 'tong-intro') return;
    const line = TONG_INTRO_LINES[introLineIdx];
    if (!line || introCharIdx >= line.length) return; // wait for tap
    introTimerRef.current = setTimeout(() => setIntroCharIdx((c) => Math.min(c + CHARS_PER_TICK, line.length)), TICK_MS);
    return () => { if (introTimerRef.current) clearTimeout(introTimerRef.current); };
  }, [phase, introLineIdx, introCharIdx]);

  /* tong-intro sub-steps: 0=meet, 1=name, 2=language, 3=world-drop */
  const [introStep, setIntroStep] = useState(0);
  const [tongExpression, setTongExpression] = useState<TongExpression>('cheerful');
  const [tongPulse, setTongPulse] = useState(false);

  function changeTongExpression(expr: TongExpression) {
    setTongExpression(expr);
    setTongPulse(true);
    setTimeout(() => setTongPulse(false), 300);
  }

  /* world-drop typewriter (step 3) */
  const [dropLineIdx, setDropLineIdx] = useState(0);
  const [dropCharIdx, setDropCharIdx] = useState(0);
  const [dropDone, setDropDone] = useState(false);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dropLinesRef = useRef([
    "", // single line — filled with player name on step 3 entry
  ]);

  useEffect(() => {
    if (phase !== 'tong-intro' || introStep !== 3 || dropDone) return;
    const line = dropLinesRef.current[dropLineIdx];
    if (!line || dropCharIdx >= line.length) return;
    dropTimerRef.current = setTimeout(() => setDropCharIdx((c) => Math.min(c + CHARS_PER_TICK, line.length)), TICK_MS);
    return () => { if (dropTimerRef.current) clearTimeout(dropTimerRef.current); };
  }, [phase, introStep, dropLineIdx, dropCharIdx, dropDone]);

  /* proficiency sliders (0-6 each, maps directly to GAME_LEVELS) */
  const [sliders, setSliders] = useState<[number, number, number]>([0, 0, 0]);

  /* hangout state */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [city, setCity] = useState<CityId>('seoul');
  const [location, setLocation] = useState<LocationId>('food_street');
  const [score, setScore] = useState<ScoreState>({ xp: 0, sp: 0, rp: 0 });
  const [activeNpc, setActiveNpc] = useState<string>('haeun');
  const [playerLevel, setPlayerLevel] = useState(0);

  /* city map state */
  const [mapCityIndex, setMapCityIndex] = useState(1); // default Seoul
  const [selectedLocation, setSelectedLocation] = useState<LocationId | null>(null);
  const [reviewSession, setReviewSession] = useState<CompletedSession | null>(null);

  /* dev exercise tester state */
  const [devExType, setDevExType] = useState(searchParams.get('type') ?? 'stroke_tracing');
  const [devObjective, setDevObjective] = useState('ko-script-consonants');
  const [devExercise, setDevExercise] = useState<ExerciseData | null>(null);
  const [devLastResult, setDevLastResult] = useState<{ correct: boolean; id: string } | null>(null);

  /* NPC character ref — set during proficiency confirmation */
  const npcRef = useRef<Character>(HAEUN);

  /* VN scene state */
  const [toolQueue, setToolQueue] = useState<ToolQueueItem[]>([]);
  const [currentMessage, setCurrentMessage] = useState<SessionMessage | null>(null);
  const [tongTip, setTongTip] = useState<{ message: string; translation?: string } | null>(null);
  const [choices, setChoices] = useState<DialogueChoice[] | null>(null);
  const [choicePrompt, setChoicePrompt] = useState<string | null>(null);
  const [currentExercise, setCurrentExercise] = useState<ExerciseData | null>(null);
  const [sceneSummary, setSceneSummary] = useState<SceneSummary | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [continuePending, setContinuePending] = useState(false);
  const [sceneTurn, setSceneTurn] = useState<number>(1);
  const [hangoutCheckpointPhase, setHangoutCheckpointPhase] = useState<string | null>(null);
  const [activeHangoutResume, setActiveHangoutResume] = useState<ActiveHangoutResumeSnapshot | null>(null);
  const [dynamicBackdrop, setDynamicBackdrop] = useState<{ url: string; transition: 'fade' | 'cut'; ambientDescription?: string } | null>(null);
  const [cinematic, setCinematic] = useState<{ videoUrl: string; caption?: string; captionTranslation?: string; autoAdvance: boolean; muted?: boolean } | null>(null);

  const traceQA = useCallback((event: string, data: Record<string, unknown> = {}) => {
    if (!qaTrace) return;
    sessionLogger.logTrace(event, { qaRunId, ...data });
  }, [qaRunId, qaTrace]);

  /* tutorial state */
  const mockVideo = searchParams.get('mock_video') === '1';
  const liveVideo = searchParams.get('live_video') === '1';
  const [profileInput, setProfileInput] = useState<PlayerProfile>({ englishName: '', chineseName: '' });
  const exitLineRef = useRef('');
  const exitLineTranslationRef = useRef('');
  const introVideoUrlRef = useRef<string | null>(null);
  const exitVideoUrlRef = useRef<string | null>(null);
  const exitVideoPlayedRef = useRef(false);
  const cinematicCaptionRef = useRef<string | null>(null);
  const pendingResumePromptRef = useRef<string | null>(null);
  const exitVideoGen = useVideoGeneration({ mock: mockVideo });
  const [isIntroHangout, setIsIntroHangout] = useState(false);
  const [introExerciseCount, setIntroExerciseCount] = useState(0);
  const [introAct, setIntroAct] = useState<1 | 2>(1);
  const [npcRevealed, setNpcRevealed] = useState(false);
  const MIN_INTRO_EXERCISES = 3;
  // Random charge time between 1.5–3 minutes (simulates video generation)
  const [chargeDurationMs] = useState(() => Math.round((1.5 + Math.random() * 1.5) * 60 * 1000));
  const [chargeStart] = useState(() => Date.now());
  const [chargePercent, setChargePercent] = useState(0);
  const [chargeNotifShown, setChargeNotifShown] = useState(false);
  const chargeNotifFiredRef = useRef(false);
  const activeHangoutSessionIdRef = useRef<string | null>(null);
  const activeHangoutCheckpointIdRef = useRef<string | null>(null);
  const activeHangoutResumeSourceRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = readStoredHangoutResume();
    if (stored) {
      setActiveHangoutResume(stored);
    }
  }, []);

  // Time-based charge bar: 0→100% over random duration
  useEffect(() => {
    if (!isIntroHangout) return;
    const tick = () => {
      const elapsed = Date.now() - chargeStart;
      const pct = Math.min(100, Math.round((elapsed / chargeDurationMs) * 100));
      setChargePercent(pct);
      if (pct >= 100 && !chargeNotifFiredRef.current) {
        chargeNotifFiredRef.current = true;
        setChargeNotifShown(true);
        setTimeout(() => setChargeNotifShown(false), 5000);
      }
      if (pct < 100) rafId = requestAnimationFrame(tick);
    };
    let rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isIntroHangout, chargeStart, chargeDurationMs]);

  // Sync generated video URL back to exitVideoUrlRef when generation succeeds
  useEffect(() => {
    if (exitVideoGen.status === 'succeeded' && exitVideoGen.videoUrl) {
      console.log('[VideoGen] Succeeded — updating exitVideoUrl:', exitVideoGen.videoUrl);
      exitVideoUrlRef.current = exitVideoGen.videoUrl;
    } else if (exitVideoGen.status === 'failed' || exitVideoGen.status === 'error') {
      console.log('[VideoGen] Failed — keeping pre-gen fallback:', exitVideoUrlRef.current);
    }
  }, [exitVideoGen.status, exitVideoGen.videoUrl]);

  const processingRef = useRef(false);
  const pausedRef = useRef(false);
  const processedToolCallsRef = useRef(new Set<string>());
  const lastContinueRef = useRef(0);
  const sceneStartedRef = useRef(false);
  const lastExerciseRef = useRef<ExerciseData | null>(null);

  /* ── handlers ─────────────────────────────────────────── */

  function handleSlider(langIdx: number, value: number) {
    setSliders((prev) => {
      const next = [...prev] as [number, number, number];
      next[langIdx] = value;
      return next;
    });
  }

  /** Build introduction context if in introduction mode */
  function getIntroCtx() {
    if (!isIntroHangout) return undefined;

    // Map exitVideoGen.status → introduction 3-state model
    let videoStatus: 'generating' | 'ready' | 'failed';
    let exitVideoUrl = exitVideoUrlRef.current; // pre-gen fallback

    const genStatus = exitVideoGen.status;
    if (genStatus === 'idle') {
      // No generation started (default / live_video not enabled) — use pre-gen
      videoStatus = 'ready';
    } else if (genStatus === 'succeeded' && exitVideoGen.videoUrl) {
      videoStatus = 'ready';
      exitVideoUrl = exitVideoGen.videoUrl;
    } else if (genStatus === 'failed' || genStatus === 'error') {
      // Generation failed — fall back to pre-gen
      videoStatus = 'ready';
    } else {
      // queued or running
      videoStatus = 'generating';
    }

    // Use Chinese name when explain language is zh
    const explainLangForCtx = gameState.explainIn[city] ?? 'en';
    const ctxName = explainLangForCtx === 'zh' && gameState.playerProfile?.chineseName
      ? gameState.playerProfile.chineseName : (gameState.playerName || 'Player');

    return {
      isIntroduction: true,
      playerName: ctxName,
      videoStatus,
      exitVideoUrl,
      introVideoUrl: introVideoUrlRef.current,
      exitLine: exitLineRef.current,
      exercisesDone: introExerciseCount,
      introAct,
      backdropUrl: SEOUL_FOOD_STREET_BACKDROP_URL,
      chargePercent,
      chargeComplete: chargePercent >= 100,
    };
  }

  function buildScenePrompt(action: string) {
    const ctx = buildContextBlock(
      playerLevel,
      activeNpc,
      city,
      location,
      npcRef.current,
      gameState.explainIn[city] ?? 'en',
      getIntroCtx(),
    );
    const resumePrompt = pendingResumePromptRef.current ? `${pendingResumePromptRef.current} ` : '';
    pendingResumePromptRef.current = null;
    return `${ctx}${resumePrompt}${action}`;
  }

  async function handleConfirmProficiency() {
    console.log('[FLOW] handleConfirmProficiency called, phase:', phase, 'freshStart:', freshStart);
    setError('');
    setLoading(true);

    const weakIdx = getWeakestLangIndex(sliders);
    const primaryLang = LANG_KEYS[weakIdx] as 'ko' | 'ja' | 'zh';

    const weakLevel = sliders[weakIdx];
    const preferredCity = (LANG_TO_CITY[primaryLang] ?? 'seoul') as CityId;
    const npcId = freshNpc && CHARACTER_MAP[freshNpc] ? freshNpc : pickNpcForCity(preferredCity);
    const npcChar = CHARACTER_MAP[npcId] ?? HAEUN;
    // Use the NPC's actual city — if no NPC exists for the preferred city,
    // the fallback NPC's city determines the target language.
    const primaryCity = (npcChar.cityId ?? preferredCity) as CityId;
    setCity(primaryCity);
    setLocation('food_street');
    setActiveNpc(npcId);
    setPlayerLevel(weakLevel);
    setScore({ xp: 0, sp: 0, rp: 0 });
    setCurrentMessage(null);
    setCurrentExercise(null);
    setToolQueue([]);
    setChoices(null);
    setChoicePrompt(null);
    setTongTip(null);
    setSceneSummary(null);
    setSceneReady(false);

    // Store player profile
    const name = profileInput.englishName.trim() || 'Player';
    const profile: PlayerProfile = { ...profileInput, englishName: name };
    dispatch({ type: 'SET_PLAYER_PROFILE', profile });
    // Use Chinese name when explain language is zh and Chinese name is available
    const cityExplainLang = gameState.explainIn[primaryCity as CityId] ?? 'en';
    const displayName = cityExplainLang === 'zh' && profileInput.chineseName?.trim()
      ? profileInput.chineseName.trim() : name;

    // Store self-assessed level
    dispatch({ type: 'SET_SELF_ASSESSED_LEVEL', level: weakLevel });

    // Detect introduction (first encounter with this NPC, or forced via ?force_tutorial=1)
    const rel = getRelationship(npcId);
    const forceTutorial = searchParams.get('force_tutorial') === '1';
    const isIntro = forceTutorial || rel.interactionCount === 0;
    setIsIntroHangout(isIntro);
    setIntroExerciseCount(0);
    setIntroAct(1);
    sceneStartedRef.current = true;

    // Select pre-generated intro/exit videos for introduction
    let introCtx: ReturnType<typeof getIntroCtx> = undefined;
    if (isIntro) {
      const config = TUTORIAL_VIDEO_CONFIG[npcId];
      if (config) {
        const clip = pickRandom(config.exitClips);
        const cnName = profileInput.chineseName?.trim() || displayName;
        const exitLine = clip.line.replace(/{playerName}/g, displayName).replace(/{chineseName}/g, cnName);
        exitLineRef.current = exitLine;
        exitLineTranslationRef.current = clip.translation.replace(/{playerName}/g, displayName).replace(/{chineseName}/g, cnName);

        introVideoUrlRef.current = pickRandom(config.introVideoUrls);
        exitVideoUrlRef.current = clip.video;

        // Start dynamic video generation when enabled (?live_video=1 or ?mock_video=1)
        if (liveVideo || mockVideo) {
          const prompt = config.exitVideoPromptTemplate.replace(/{exitLine}/g, exitLine);
          exitVideoGen.startGeneration({
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', imageUrl: config.sceneImageUrl },
            ],
            ratio: '9:16',
            duration: 10,
            generateAudio: true,
          });
        }
      }

      // Initial video status: 'generating' if gen started, 'ready' with pre-gen otherwise
      const initialVideoStatus = (liveVideo || mockVideo) ? 'generating' as const : 'ready' as const;
      introCtx = {
        isIntroduction: true,
        playerName: displayName,
        videoStatus: initialVideoStatus,
        exitVideoUrl: exitVideoUrlRef.current,
        introVideoUrl: introVideoUrlRef.current,
        exitLine: exitLineRef.current,
        exercisesDone: 0,
        introAct: 1 as const,
        backdropUrl: SEOUL_FOOD_STREET_BACKDROP_URL,
        chargePercent: 0,
        chargeComplete: false,
      };
    }

    try {
      const bootstrap = (await startOrResumeGame({
        userId: 'local',
        city: primaryCity,
        profile: buildBootstrapProfile(),
        preferRomance: true,
      })) as ResumeBootstrapPayload;
      syncActiveResumeMeta(bootstrap);

      const resumed = hydrateResumeState(bootstrap);
      if (resumed) {
        clearActiveHangoutResume();
        setCity(resumed.cityId);
        setLocation(resumed.locationId);
        setScore({
          xp: bootstrap.progression?.xp ?? 0,
          sp: bootstrap.progression?.sp ?? 0,
          rp: bootstrap.progression?.rp ?? 0,
        });
        setPhase('hangout');
        setSceneReady(true);
        setSceneTurn(resumed.turn);
        setHangoutCheckpointPhase(resumed.phase);
        setCurrentMessage(
          resumed.exercise
            ? null
            : {
                id: `resume-turn-${resumed.turn}`,
                role: 'narrator',
                content: resumed.objectiveSummary
                  ? `Resumed turn ${resumed.turn} at ${resumed.phase}. ${resumed.objectiveSummary}`
                  : `Resumed turn ${resumed.turn} at ${resumed.phase}.`,
              },
        );
        setCurrentExercise(resumed.exercise);
        if (resumed.exercise) {
          lastExerciseRef.current = resumed.exercise;
        }
        setToolQueue([]);
        setChoices(null);
        setChoicePrompt(null);
        setTongTip(null);
        setSceneSummary(null);
        pendingResumePromptRef.current = buildResumePrompt({
          phase: resumed.phase,
          turn: resumed.turn,
          objectiveSummary: resumed.objectiveSummary,
          exercise: resumed.exercise,
        });
        setLoading(false);
        return;
      }
    } catch (resumeError) {
      console.warn('[RESUME] Failed to hydrate checkpoint resume, falling back to new hangout bootstrap.', resumeError);
    }

    clearActiveHangoutResume();
    setHangoutCheckpointPhase(null);
    setSceneTurn(1);
    setPhase('hangout');
    setLoading(false);

    const startMsg = `${buildContextBlock(weakLevel, npcId, primaryCity as CityId, 'food_street', npcChar, gameState.explainIn[primaryCity as CityId] ?? 'en', introCtx)}Start the scene.`;
    sessionLogger.start({ mode: 'hangout', cityId: primaryCity, locationId: 'food_street', surface: 'game', qaRunId, npcId, playerLevel: weakLevel });
    sessionLogger.logAIRequest(startMsg);
    void append({ role: 'user', content: startMsg });
  }

  /* ── useChat integration ──────────────────────────────────── */

  const { append, messages, isLoading: chatLoading } = useChat({
    api: '/api/ai/hangout',
    maxSteps: 1,
    onResponse: () => {
      pausedRef.current = false;
      traceQA('chat_response_started', { paused: pausedRef.current });
    },
    onToolCall: ({ toolCall }) => {
      const { toolName, toolCallId, args } = toolCall;
      if (processedToolCallsRef.current.has(toolCallId)) return args;
      if (pausedRef.current) {
        // Queue the tool for after the exercise/choice — don't lose it
        console.log(`[VN] onToolCall QUEUED (paused): ${toolName}`);
        processedToolCallsRef.current.add(toolCallId);
        sessionLogger.logToolCall(toolName, toolCallId, args as Record<string, unknown>);
        traceQA('tool_call_queued_while_paused', { toolName, toolCallId, queueLength: toolQueue.length + 1 });
        setToolQueue((prev) => [
          ...prev,
          { toolCallId, toolName, args: args as Record<string, unknown> },
        ]);
        return args;
      }
      processedToolCallsRef.current.add(toolCallId);
      if (!sceneReady) setSceneReady(true);
      sessionLogger.logToolCall(toolName, toolCallId, args as Record<string, unknown>);
      traceQA('tool_call_received', { toolName, toolCallId });

      setToolQueue((prev) => [
        ...prev,
        { toolCallId, toolName, args: args as Record<string, unknown> },
      ]);

      if (toolName === 'show_exercise' || toolName === 'offer_choices') {
        pausedRef.current = true;
      }

      return args;
    },
    onError: (err) => {
      sessionLogger.logError('useChat error', err?.message ?? err);
      traceQA('chat_error', { message: err?.message ?? String(err) });
    },
    onFinish: (msg) => {
      sessionLogger.logAIResponse(msg.role, msg.toolInvocations?.length ?? 0);
      traceQA('chat_finish', { role: msg.role, toolCount: msg.toolInvocations?.length ?? 0 });
    },
  });

  useEffect(() => {
    if (!continuePending) return;

    let nextBusySource: string | null = null;
    if (chatLoading) nextBusySource = 'chat_loading';
    else if (toolQueue.length > 0) nextBusySource = 'tool_queue';
    else if (currentMessage) nextBusySource = 'current_message';
    else if (currentExercise) nextBusySource = 'current_exercise';
    else if (choices) nextBusySource = 'choices';
    else if (tongTip) nextBusySource = 'tong_tip';
    else if (sceneSummary) nextBusySource = 'scene_summary';
    else if (cinematic) nextBusySource = 'cinematic';

    if (!nextBusySource) return;

    traceQA('continue_pending_cleared', { nextBusySource, queueLength: toolQueue.length });
    setContinuePending(false);
  }, [
    continuePending,
    chatLoading,
    toolQueue.length,
    currentMessage,
    currentExercise,
    choices,
    tongTip,
    sceneSummary,
    cinematic,
    traceQA,
  ]);

  const latestNpcSpeakInvocation = getLatestNpcSpeakInvocation(messages);
  const queuedNpcSpeakId = toolQueue[0]?.toolName === 'npc_speak' ? toolQueue[0].toolCallId : null;
  const shouldRenderStreamedNpcMessage = latestNpcSpeakInvocation != null && (
    ((latestNpcSpeakInvocation.state === 'partial-call' || latestNpcSpeakInvocation.state === 'call') && chatLoading)
    || latestNpcSpeakInvocation.toolCallId === queuedNpcSpeakId
    || latestNpcSpeakInvocation.toolCallId === currentMessage?.id
  );
  const streamedNpcMessage = shouldRenderStreamedNpcMessage && latestNpcSpeakInvocation
    ? buildStreamedNpcMessage(latestNpcSpeakInvocation, activeNpc)
    : null;
  const displayMessage = streamedNpcMessage ?? currentMessage;
  const dialogueIsStreaming = Boolean(
    streamedNpcMessage
    && latestNpcSpeakInvocation
    && chatLoading
    && (latestNpcSpeakInvocation.state === 'partial-call' || latestNpcSpeakInvocation.state === 'call')
  );
  const canReturnToMap =
    !loading &&
    !chatLoading &&
    !continuePending &&
    !dialogueIsStreaming &&
    !choices &&
    !tongTip &&
    !currentExercise &&
    !sceneSummary &&
    sceneReady;

  /* Auto-start scene when skipping to hangout */
  useEffect(() => {
    if (skipToHangout && !sceneStartedRef.current) {
      console.log('[FLOW] skipToHangout auto-start triggered');
      sceneStartedRef.current = true;
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
      void append({ role: 'user', content: `${ctx}Start the scene.` });
    }
  }, [skipToHangout, append, playerLevel, activeNpc, city, location, gameState.explainIn]);

  /* Dev intro bypass: ?dev_intro=1 — fresh introduction hangout, clears stale state
     Optional: ?dev_act=2 — skip Act 1, start at Act 2 (NPC entrance) with exercises pre-done */
  const devAct = Number(searchParams.get('dev_act') || '1') as 1 | 2;
  useEffect(() => {
    if (!devIntro || sceneStartedRef.current) return;
    sceneStartedRef.current = true;

    // Reset game state for a true fresh start
    dispatch({ type: 'RESET' });

    const npcId = searchParams.get('npc') ?? 'haeun';
    const npcChar = CHARACTER_MAP[npcId] ?? HAEUN;
    const devCity = (npcChar.cityId ?? 'seoul') as CityId;
    const devLang = (searchParams.get('lang') ?? 'en') as AppLang;
    const englishName = searchParams.get('name') ?? 'Player';
    const chineseName = searchParams.get('cn_name') ?? '';
    // Use Chinese name when lang=zh and it's available, otherwise English
    const displayName = devLang === 'zh' && chineseName ? chineseName : englishName;

    npcRef.current = npcChar;
    setCity(devCity);
    setLocation('food_street');
    setActiveNpc(npcId);
    setPlayerLevel(0);
    setIsIntroHangout(true);

    // If skipping to Act 2, pretend Act 1 exercises are done
    const startAct = devAct >= 2 ? 2 : 1;
    const fakeExercises = startAct === 2 ? 4 : 0;
    setIntroExerciseCount(fakeExercises);
    setIntroAct(startAct as 1 | 2);
    // Don't set npcRevealed here — let the intro cinematic handle the reveal

    // Set player profile and language preference
    dispatch({ type: 'SET_PLAYER_PROFILE', profile: { englishName, chineseName } });
    dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId: devCity, lang: devLang });

    // Pick intro/exit videos
    const config = TUTORIAL_VIDEO_CONFIG[npcId];
    if (config) {
      introVideoUrlRef.current = pickRandom(config.introVideoUrls);
      const clip = pickRandom(config.exitClips);
      exitVideoUrlRef.current = clip.video;
      const cnName = chineseName || displayName;
      exitLineRef.current = clip.line.replace(/{playerName}/g, displayName).replace(/{chineseName}/g, cnName);
      exitLineTranslationRef.current = clip.translation.replace(/{playerName}/g, displayName).replace(/{chineseName}/g, cnName);
    }

    const introCtx = {
      isIntroduction: true,
      playerName: displayName,
      videoStatus: 'ready' as const,
      exitVideoUrl: exitVideoUrlRef.current,
      introVideoUrl: introVideoUrlRef.current,
      exitLine: exitLineRef.current,
      exercisesDone: fakeExercises,
      introAct: startAct as 1 | 2,
      backdropUrl: SEOUL_FOOD_STREET_BACKDROP_URL,
    };

    const startMsg = `${buildContextBlock(0, npcId, devCity, 'food_street', npcChar, devLang, introCtx)}${startAct === 2 ? 'Act 1 complete. Player already learned basic jamo (ㅎ, ㅏ, ㅇ, ㅡ, ㄴ) and built syllable blocks. Start Act 2 — NPC entrance.' : 'Start the scene.'}`;
    sessionLogger.start({ mode: 'hangout', cityId: devCity, locationId: 'food_street', surface: 'game', qaRunId, npcId, playerLevel: 0 });
    sessionLogger.logAIRequest(startMsg);
    console.log('[DevIntro] Starting introduction hangout for', npcId, 'act:', startAct, 'lang:', devLang);
    void append({ role: 'user', content: startMsg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devIntro, qaRunId]);

  /* ── Tool queue processor ───────────────────────────────── */
  useEffect(() => {
    if (toolQueue.length === 0 || processingRef.current) return;
    processingRef.current = true;

    const item = toolQueue[0];
    traceQA('tool_queue_process_start', { toolName: item.toolName, toolCallId: item.toolCallId, queueLength: toolQueue.length });

    switch (item.toolName) {
      case 'npc_speak': {
        const args = item.args as {
          characterId: string;
          text: string;
          translation?: string | null;
          expression?: string | null;
          affinityDelta?: number | null;
        };
        // If AI calls npc_speak during Act 1, auto-promote to Act 2 (NPC arrived)
        if (isIntroHangout && introAct === 1) {
          setIntroAct(2);
          console.log('[VN] Act 1 → Act 2 transition triggered by npc_speak');
        }
        if (isIntroHangout && !npcRevealed) setNpcRevealed(true);
        traceQA('tool_queue_blocking_message', { toolName: item.toolName, toolCallId: item.toolCallId });
        setCurrentMessage({
          id: item.toolCallId,
          role: 'npc',
          characterId: args.characterId,
          content: args.text,
          translation: args.translation ?? undefined,
        });
        // Update affinity if delta provided
        if (args.affinityDelta && args.characterId) {
          dispatch({ type: 'UPDATE_AFFINITY', characterId: args.characterId, delta: args.affinityDelta });
        }
        console.log('[VN] npc_speak BLOCK:', args.text.slice(0, 40));
        return; // BLOCK — wait for tap
      }
      case 'tong_whisper': {
        const args = item.args as { message: string; translation?: string | null };
        setTongTip({ message: args.message, translation: args.translation ?? undefined });
        traceQA('tool_queue_tong_whisper', { toolCallId: item.toolCallId });
        console.log('[VN] tong_whisper BLOCK — message:', JSON.stringify(args.message), 'translation:', args.translation ?? '(none)');
        return; // ALWAYS BLOCK — user must tap to dismiss before proceeding
      }
      case 'show_exercise': {
        const args = item.args as {
          exerciseType: string;
          objectiveId: string;
          exerciseData?: Record<string, unknown> | null;
          hintItems?: string[] | null;
          hintCount?: number | null;
          hintSubType?: string | null;
        };
        console.log('[EX] AI sent show_exercise:', {
          type: args.exerciseType,
          objectiveId: args.objectiveId,
          hintItems: args.hintItems,
          hintCount: args.hintCount,
          hintSubType: args.hintSubType,
          hasExerciseData: !!args.exerciseData,
          exerciseData: args.exerciseData,
        });
        let exercise: ExerciseData;
        // For pronunciation_select, always use the generator — AI-constructed data is unreliable
        const parsed = args.exerciseType === 'pronunciation_select' ? null : parseExerciseData(args.exerciseData);
        if (parsed) {
          console.log('[EX] Using AI-provided exerciseData:', { type: parsed.type, id: parsed.id, targetChar: (parsed as any).targetChar, components: (parsed as any).components });
          exercise = parsed;
        } else {
          const npcChar = CHARACTER_MAP[activeNpc];
          const npcCity = (npcChar?.cityId ?? city) as CityId;
          const lang = getLanguageForCity(npcCity);
          const explainLang_ = getGameState().explainIn[npcCity] ?? 'en';
          console.log('[EX] Generating locally:', { type: args.exerciseType, lang, hintItems: args.hintItems, objectiveId: args.objectiveId });
          exercise = generateExercise(args.exerciseType, {
            hintItems: args.hintItems ?? undefined,
            hintCount: args.hintCount ?? undefined,
            hintSubType: args.hintSubType ?? undefined,
            objectiveId: args.objectiveId,
            language: lang as 'ko' | 'zh' | 'ja',
            cityId: city,
            locationId: location,
            mastery: getGameState().itemMastery,
            explainIn: explainLang_ as UILang,
          });
          console.log('[EX] Generated exercise:', { type: exercise.type, id: exercise.id, targetChar: (exercise as any).targetChar, components: (exercise as any).components?.map((c: any) => ({ slot: c.slot, piece: c.piece })), stage: (exercise as any).stage });
        }
        // block_crush: auto-decompose from our database — AI just says WHAT to build
        if (exercise.type === 'block_crush') {
          const bc = exercise as any;
          const npcCharRef = CHARACTER_MAP[activeNpc];
          const npcCityRef = (npcCharRef?.cityId ?? city) as CityId;
          const langRef = getLanguageForCity(npcCityRef) as 'ko' | 'zh' | 'ja';
          const targetStr: string = bc.targetChar || '';
          const chars = [...targetStr];

          if (chars.length >= 1) {
            // Look up decomposition for every character
            const steps: BlockCrushCharStep[] = [];
            for (const ch of chars) {
              const target = getTargetByChar(ch);
              if (target && target.components.length >= 2) {
                steps.push({
                  targetChar: target.char,
                  components: target.components,
                  romanization: target.romanization,
                  meaning: target.meaning,
                });
              } else {
                console.warn('[EX] block_crush: no decomposition data for', ch);
              }
            }

            if (steps.length >= 2) {
              // Multi-char: side-by-side grids
              const first = steps[0];
              exercise = {
                type: 'block_crush',
                id: `ai-bc-multi-${Date.now()}`,
                objectiveId: args.objectiveId,
                difficulty: bc.difficulty ?? 2,
                prompt: bc.prompt || `Build: ${targetStr}`,
                language: langRef,
                targetChar: first.targetChar,
                components: first.components,
                romanization: first.romanization,
                meaning: first.meaning,
                stage: bc.stage || 'intro',
                sequence: steps,
                fullWord: targetStr,
              } as BlockCrushExercise;
              console.log('[EX] block_crush multi-char:', steps.map(s => s.targetChar).join(''));
            } else if (steps.length === 1) {
              // Single char with full decomposition
              const s = steps[0];
              exercise = {
                type: 'block_crush',
                id: bc.id || `ai-bc-${Date.now()}`,
                objectiveId: args.objectiveId,
                difficulty: bc.difficulty ?? 1,
                prompt: bc.prompt || `Build: ${s.targetChar}`,
                language: langRef,
                targetChar: s.targetChar,
                components: s.components,
                romanization: s.romanization,
                meaning: s.meaning,
                stage: bc.stage || 'intro',
              } as BlockCrushExercise;
              console.log('[EX] block_crush single:', s.targetChar);
            } else {
              // No decomposition data at all — log error, keep exercise as-is
              console.error('[EX] block_crush: no decomposition found for any char in', targetStr);
            }
          }
        }
        setCurrentMessage(null);
        setTongTip(null);
        setCurrentExercise(exercise);
        traceQA('tool_queue_show_exercise', { toolCallId: item.toolCallId, exerciseId: exercise.id, exerciseType: exercise.type });
        lastExerciseRef.current = exercise;
        sessionLogger.logExerciseShown(args.exerciseType, exercise.id, { objectiveId: args.objectiveId, hintItems: args.hintItems });
        return; // BLOCK — wait for exercise completion
      }
      case 'offer_choices': {
        const args = item.args as { prompt: string; choices: { id: string; text: string }[] };
        setChoicePrompt(args.prompt);
        setChoices(args.choices);
        traceQA('tool_queue_offer_choices', { toolCallId: item.toolCallId, choiceCount: args.choices.length });
        setCurrentMessage(null);
        sessionLogger.logChoiceShown(args.prompt, args.choices);
        return; // BLOCK — wait for choice
      }
      case 'assess_result': {
        const args = item.args as {
          objectiveId: string;
          score: number;
          feedback: string;
        };
        // Find all target items for this objective from the location data
        const loc = getLocationOrDefault(city, location);
        const allObjectives = loc.levels.flatMap((l) => l.objectives);
        const objective = allObjectives.find((o) => o.id === args.objectiveId);
        if (objective) {
          const isScript = objective.category === 'script' || objective.category === 'pronunciation';
          const isGrammar = objective.category === 'grammar';
          const category: 'script' | 'vocabulary' | 'grammar' = isScript ? 'script' : isGrammar ? 'grammar' : 'vocabulary';
          // Mark items as seen/correct based on assessment score
          const correct = args.score >= 70;
          for (const itemId of objective.targetItems) {
            dispatch({ type: 'RECORD_ITEM_RESULT', itemId, category, correct });
          }
        }
        console.log('[VN] assess_result dispatched:', args.objectiveId, args.score);
        break; // auto-advance
      }
      case 'end_scene': {
        const args = item.args as {
          summary: string;
          xpEarned: number;
          affinityChanges: { characterId: string; delta: number }[];
          calibratedLevel?: number | null;
        };
        setSceneSummary(args);
        setScore((prev) => ({ ...prev, xp: prev.xp + args.xpEarned }));
        setCurrentMessage(null);

        sessionLogger.logSceneSummary(args);
        sessionLogger.end();

        // Dispatch store updates
        dispatch({ type: 'ADD_XP', amount: args.xpEarned });
        dispatch({ type: 'ADD_SP', amount: Math.round(args.xpEarned * 0.5) });
        for (const ac of args.affinityChanges) {
          dispatch({ type: 'UPDATE_AFFINITY', characterId: ac.characterId, delta: ac.delta });
        }
        if (args.calibratedLevel != null) {
          dispatch({ type: 'SET_CALIBRATED_LEVEL', level: args.calibratedLevel });
        }
        // Increment interaction count for active NPC
        dispatch({ type: 'INCREMENT_INTERACTION', characterId: activeNpc });
        break; // auto-advance
      }
      case 'set_backdrop': {
        const args = item.args as {
          backdropUrl: string;
          transition: 'fade' | 'cut';
          ambientDescription?: string | null;
        };
        setDynamicBackdrop({
          url: args.backdropUrl,
          transition: args.transition,
          ambientDescription: args.ambientDescription ?? undefined,
        });
        console.log('[VN] set_backdrop:', args.backdropUrl, args.transition);
        break; // auto-advance
      }
      case 'play_cinematic': {
        const args = item.args as {
          videoUrl: string;
          caption?: string | null;
          autoAdvance: boolean;
        };
        // Exit video (pre-generated with audio) should be unmuted
        const isExitVideo = isIntroHangout && exitVideoUrlRef.current && args.videoUrl === exitVideoUrlRef.current;
        if (isExitVideo) {
          exitVideoPlayedRef.current = true;
          // Hide NPC now — cinematic covers the screen, so when it fades out only backdrop remains
          setNpcRevealed(false);
        }
        // Intro video triggers Act 1 → Act 2 transition
        const isIntroVideo = isIntroHangout && introAct === 1 && introVideoUrlRef.current && args.videoUrl === introVideoUrlRef.current;
        if (isIntroVideo) {
          setIntroAct(2);
          console.log('[VN] Act 1 → Act 2 transition triggered by intro cinematic');
        }
        // Store caption to show as narrator line after cinematic ends
        cinematicCaptionRef.current = args.caption ?? null;
        // For exit videos, show the exit line as subtitle overlay
        const exitCaption = isExitVideo && exitLineRef.current ? exitLineRef.current : (args.caption ?? undefined);
        const exitCaptionTranslation = isExitVideo && exitLineTranslationRef.current ? exitLineTranslationRef.current : undefined;
        setCinematic({
          videoUrl: args.videoUrl,
          autoAdvance: args.autoAdvance,
          muted: false,
          caption: exitCaption,
          captionTranslation: exitCaptionTranslation,
        });
        console.log('[VN] play_cinematic BLOCK:', args.videoUrl, isExitVideo ? '(exit video, unmuted)' : '', isIntroVideo ? '(intro video, act transition)' : '');
        return; // BLOCK — wait for video end or tap
      }
      default:
        break; // auto-advance
    }

    // Auto-advance: dequeue and release lock
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
    traceQA('tool_queue_auto_advance', { toolName: item.toolName, remainingQueueLength: Math.max(toolQueue.length - 1, 0) });
  }, [toolQueue, activeNpc, isIntroHangout, introAct]);

  /* ── Hangout handlers ───────────────────────────────────── */

  const handleContinue = useCallback(() => {
    const now = Date.now();
    if (now - lastContinueRef.current < 400) {
      traceQA('handle_continue_debounced', { elapsedMs: now - lastContinueRef.current });
      return;
    }
    lastContinueRef.current = now;

    if (processingRef.current) {
      // If the current blocking tool is show_exercise and exercise was dismissed,
      // re-show it from cache instead of dequeuing
      const currentTool = toolQueue[0]?.toolName;
      if (currentTool === 'show_exercise' && !currentExercise && lastExerciseRef.current) {
        console.log('[VN] handleContinue: re-show dismissed exercise');
        traceQA('handle_continue_reshow_exercise', { currentTool, exerciseId: lastExerciseRef.current.id });
        setCurrentExercise(lastExerciseRef.current);
        return;
      }
      console.log('[VN] handleContinue: dequeue blocked tool');
      traceQA('handle_continue_dequeue_blocked_tool', { currentTool, queueLength: toolQueue.length });
      setCurrentMessage(null);
      setTongTip(null);
      const remainingAfterDequeue = toolQueue.length - 1;
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;

      // If nothing left in queue after dequeuing, request next turn
      if (remainingAfterDequeue === 0 && !chatLoading) {
        const msg = buildScenePrompt('Continue.');
        sessionLogger.logUserTap('continue');
        sessionLogger.logAIRequest(msg);
        setContinuePending(true);
        traceQA('handle_continue_request_next_turn_after_dequeue', { queueLength: remainingAfterDequeue });
        void append({ role: 'user', content: msg });
      }
      return;
    }

    if (sceneSummary) {
      traceQA('handle_continue_noop_scene_summary');
      return;
    }
    if (chatLoading) {
      traceQA('handle_continue_noop_chat_loading', { queueLength: toolQueue.length });
      return;
    }

    if (tongTip) {
      traceQA('handle_continue_clear_tong_tip_nonblocking');
      setTongTip(null);
      // tongTip was auto-advanced (not blocking) — fall through to request next turn
    }

    if (!currentExercise && !choices && toolQueue.length === 0) {
      const msg = buildScenePrompt('Continue.');
      sessionLogger.logUserTap('continue');
      sessionLogger.logAIRequest(msg);
      setContinuePending(true);
      traceQA('handle_continue_request_next_turn', { queueLength: toolQueue.length });
      void append({ role: 'user', content: msg });
    } else {
      traceQA('handle_continue_noop_waiting_state', {
        queueLength: toolQueue.length,
        hasExercise: !!currentExercise,
        hasChoices: !!choices,
      });
    }
  }, [sceneSummary, chatLoading, tongTip, currentExercise, choices, toolQueue, append, buildScenePrompt, traceQA]);

  // Store exercise result so handleContinue can advance after user taps
  const exerciseResultRef = useRef<{ exerciseId: string; correct: boolean } | null>(null);

  const handleExerciseResult = useCallback((exerciseId: string, correct: boolean) => {
    sessionLogger.logExerciseResult(exerciseId, correct);

    // Dispatch per-item mastery results using actual target words
    const exercise = lastExerciseRef.current;
    if (exercise) {
      const targets = extractTargetItems(exercise);
      for (const target of targets) {
        dispatch({ type: 'RECORD_ITEM_RESULT', itemId: target.itemId, category: target.category, correct });
      }
    }

    // Increment introduction exercise counter
    if (isIntroHangout) setIntroExerciseCount(prev => prev + 1);

    // Store result — overlay dismiss or auto-advance will pick it up
    exerciseResultRef.current = { exerciseId, correct };
  }, [isIntroHangout, introExerciseCount, introAct]);

  const advanceAfterExercise = useCallback(() => {
    const result = exerciseResultRef.current;
    if (!result) {
      console.log('[VN] advanceAfterExercise: no result ref — clearing exercise UI');
      traceQA('advance_after_exercise_missing_result');
      setCurrentExercise(null);
      return;
    }
    exerciseResultRef.current = null;
    setCurrentExercise(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;

    const msg = buildScenePrompt(summarizeExercise(result.exerciseId, result.correct));
    console.log('[VN] advanceAfterExercise:', result.exerciseId, result.correct, 'chatLoading:', chatLoading);
    sessionLogger.logAIRequest(msg);
    setContinuePending(true);
    traceQA('advance_after_exercise', { exerciseId: result.exerciseId, correct: result.correct, chatLoading });
    void append({ role: 'user', content: msg });
  }, [append, buildScenePrompt, chatLoading, traceQA]);

  const handleExerciseDismiss = useCallback(() => {
    if (exerciseResultRef.current) {
      // Exercise completed — advance immediately
      advanceAfterExercise();
    } else {
      // Exercise not completed — just hide temporarily.
      // processingRef stays true. handleContinue will re-show it.
      setCurrentExercise(null);
    }
  }, [advanceAfterExercise]);

  const handleChoice = useCallback((choiceId: string) => {
    setChoices(null);
    setChoicePrompt(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
    sessionLogger.logChoiceSelected(choiceId);

    // SUSPENSE_CHOICE beat: offer_choices response during Act 1 triggers Act 2
    if (isIntroHangout && introAct === 1) {
      setIntroAct(2);
      console.log('[VN] Act 1 → Act 2 transition triggered by SUSPENSE_CHOICE (offer_choices response)');
    }

    const msg = buildScenePrompt(`Choice: ${choiceId}`);
    sessionLogger.logAIRequest(msg);
    setContinuePending(true);
    void append({ role: 'user', content: msg });
  }, [append, buildScenePrompt, isIntroHangout, introAct]);

  const handleCinematicEnd = useCallback(() => {
    setCinematic(null);
    cinematicCaptionRef.current = null;
    if (isIntroHangout && !npcRevealed) setNpcRevealed(true);
    // Hide NPC after exit video ends — she walked away
    if (exitVideoPlayedRef.current) setNpcRevealed(false);
    const remainingAfterDequeue = toolQueue.length - 1;
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;

    // If nothing left in queue after dequeuing, request next AI turn
    if (remainingAfterDequeue === 0 && !chatLoading) {
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
      const msg = `${ctx}Continue.`;
      sessionLogger.logUserTap('cinematic_end');
      sessionLogger.logAIRequest(msg);
      setContinuePending(true);
      void append({ role: 'user', content: msg });
    }
  }, [isIntroHangout, npcRevealed, toolQueue.length, chatLoading, append, playerLevel, activeNpc, city, location, gameState.explainIn]);

  const handleDismissTong = useCallback(() => {
    traceQA('handle_dismiss_tong', { processing: processingRef.current, queueLength: toolQueue.length });
    setTongTip(null);
    if (processingRef.current) {
      // tong_whisper was blocking — dequeue immediately so next tool fires
      setCurrentMessage(null);
      const remainingAfterDequeue = toolQueue.length - 1;
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;

      // If nothing left in queue, request next turn
      if (remainingAfterDequeue === 0 && !chatLoading) {
        const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
        const msg = `${ctx}Continue.`;
        sessionLogger.logUserTap('continue');
        sessionLogger.logAIRequest(msg);
        setContinuePending(true);
        traceQA('handle_dismiss_tong_request_next_turn');
        void append({ role: 'user', content: msg });
      }
    }
  }, [toolQueue.length, chatLoading, append, playerLevel, activeNpc, city, location, gameState.explainIn, isIntroHangout, introExerciseCount, introAct, traceQA]);

  function clearActiveHangoutResume() {
    activeHangoutSessionIdRef.current = null;
    activeHangoutCheckpointIdRef.current = null;
    activeHangoutResumeSourceRef.current = null;
    setActiveHangoutResume(null);
    writeStoredHangoutResume(null);
  }

  function buildBootstrapProfile() {
    return {
      nativeLanguage: 'en',
      targetLanguages: ['ko', 'ja', 'zh'],
      proficiency: {
        ko: SLIDER_TO_LEVEL[sliders[2]] ?? 'none',
        ja: SLIDER_TO_LEVEL[sliders[1]] ?? 'none',
        zh: SLIDER_TO_LEVEL[sliders[0]] ?? 'none',
      },
    };
  }

  function syncActiveResumeMeta(bootstrap?: ResumeBootstrapPayload | null) {
    activeHangoutSessionIdRef.current = bootstrap?.sessionId ?? null;
    activeHangoutCheckpointIdRef.current = bootstrap?.activeCheckpoint?.checkpointId ?? null;
    activeHangoutResumeSourceRef.current = bootstrap?.resumeSource ?? null;
  }

  function saveActiveHangoutResumeSnapshot() {
    const snapshot: ActiveHangoutResumeSnapshot = {
      sessionId: activeHangoutSessionIdRef.current,
      checkpointId: activeHangoutCheckpointIdRef.current,
      resumeSource: activeHangoutResumeSourceRef.current,
      cityId: city,
      locationId: location,
      npcId: activeNpc,
      playerLevel,
      phase: hangoutCheckpointPhase ?? 'hangout',
      turn: sceneTurn,
      objectiveSummary: displayMessage?.content ?? currentMessage?.content ?? null,
      currentMessage: displayMessage ? { ...displayMessage } : null,
      currentExercise: currentExercise ? JSON.parse(JSON.stringify(currentExercise)) : null,
      choices: choices ? JSON.parse(JSON.stringify(choices)) : null,
      choicePrompt,
      tongTip: tongTip ? { ...tongTip } : null,
      score,
      savedAtIso: new Date().toISOString(),
    };

    setActiveHangoutResume(snapshot);
    writeStoredHangoutResume(snapshot);
  }

  function restoreHangoutFromSnapshot(snapshot: ActiveHangoutResumeSnapshot, nextScore?: ScoreState) {
    setCity(snapshot.cityId);
    setLocation(snapshot.locationId);
    setActiveNpc(snapshot.npcId);
    setPlayerLevel(snapshot.playerLevel);
    setScore(nextScore ?? snapshot.score);
    setPhase('hangout');
    setSceneReady(true);
    setSceneTurn(snapshot.turn);
    setHangoutCheckpointPhase(snapshot.phase);
    setCurrentMessage(snapshot.currentMessage ? { ...snapshot.currentMessage } : null);
    setCurrentExercise(snapshot.currentExercise ? JSON.parse(JSON.stringify(snapshot.currentExercise)) : null);
    setToolQueue([]);
    setChoices(snapshot.choices ? JSON.parse(JSON.stringify(snapshot.choices)) : null);
    setChoicePrompt(snapshot.choicePrompt);
    setTongTip(snapshot.tongTip ? { ...snapshot.tongTip } : null);
    setSceneSummary(null);
    pendingResumePromptRef.current = buildResumePrompt({
      phase: snapshot.phase,
      turn: snapshot.turn,
      objectiveSummary: snapshot.objectiveSummary,
      exercise: snapshot.currentExercise,
    });
  }

  const getQaState = useCallback(() => ({
    qaRunId,
    qaTrace,
    route: typeof window !== 'undefined' ? window.location.href : null,
    phase,
    sceneReady,
    chatLoading,
    continuePending,
    processing: processingRef.current,
    toolQueue: toolQueue.map((item) => ({ toolCallId: item.toolCallId, toolName: item.toolName })),
    currentMessage: currentMessage ? { id: currentMessage.id, role: currentMessage.role, characterId: currentMessage.characterId, contentPreview: currentMessage.content.slice(0, 120) } : null,
    streamedMessage: streamedNpcMessage ? { id: streamedNpcMessage.id, role: streamedNpcMessage.role, characterId: streamedNpcMessage.characterId, contentPreview: streamedNpcMessage.content.slice(0, 120), isStreaming: dialogueIsStreaming } : null,
    displayMessage: displayMessage ? { id: displayMessage.id, role: displayMessage.role, characterId: displayMessage.characterId, contentPreview: displayMessage.content.slice(0, 120) } : null,
    tongTip: tongTip ? { messagePreview: tongTip.message.slice(0, 120), hasTranslation: !!tongTip.translation } : null,
    currentExercise: currentExercise ? { id: currentExercise.id, type: currentExercise.type } : null,
    activeHangoutResume: activeHangoutResume
      ? {
          cityId: activeHangoutResume.cityId,
          locationId: activeHangoutResume.locationId,
          checkpointId: activeHangoutResume.checkpointId,
          phase: activeHangoutResume.phase,
          turn: activeHangoutResume.turn,
          hasExercise: !!activeHangoutResume.currentExercise,
        }
      : null,
    canReturnToMap,
    choices: choices ? choices.map((choice) => ({ id: choice.id, text: choice.text })) : null,
    choicePrompt,
    sceneSummary: sceneSummary ? { xpEarned: sceneSummary.xpEarned, calibratedLevel: sceneSummary.calibratedLevel ?? null } : null,
    isIntroHangout,
    introExerciseCount,
    introAct,
    npcRevealed,
  }), [qaRunId, qaTrace, phase, sceneReady, chatLoading, continuePending, toolQueue, currentMessage, streamedNpcMessage, displayMessage, dialogueIsStreaming, tongTip, currentExercise, activeHangoutResume, canReturnToMap, choices, choicePrompt, sceneSummary, isIntroHangout, introExerciseCount, introAct, npcRevealed]);

  useEffect(() => {
    if (!qaTrace) return;
    traceQA('state_snapshot', {
      phase,
      chatLoading,
      continuePending,
      dialogueStreaming: dialogueIsStreaming,
      processing: processingRef.current,
      queueLength: toolQueue.length,
      currentMessageId: currentMessage?.id ?? null,
      displayMessageId: displayMessage?.id ?? null,
      currentExerciseId: currentExercise?.id ?? null,
      choiceCount: choices?.length ?? 0,
      hasTongTip: !!tongTip,
      hasSceneSummary: !!sceneSummary,
    });
  }, [qaTrace, traceQA, phase, chatLoading, continuePending, dialogueIsStreaming, toolQueue.length, currentMessage?.id, displayMessage?.id, currentExercise?.id, choices?.length, tongTip, sceneSummary]);

  useEffect(() => {
    if (typeof window === 'undefined' || !qaRunId) return;

    const downloadJson = (filename: string, data: unknown) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TONG_QA__ = {
      getState: () => getQaState(),
      getLogs: () => {
        const current = sessionLogger.getCurrent();
        const saved = sessionLogger.getAll();
        return current ? [current, ...saved] : saved;
      },
      downloadState: () => downloadJson(`tong-qa-state-${qaRunId}.json`, getQaState()),
      downloadLogs: () => {
        const current = sessionLogger.getCurrent();
        const saved = sessionLogger.getAll();
        const logs = current ? [current, ...saved] : saved;
        downloadJson(`tong-qa-logs-${qaRunId}.json`, logs);
      },
      clearLogs: () => sessionLogger.clear(),
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).__TONG_QA__) delete (window as any).__TONG_QA__;
    };
  }, [qaRunId, getQaState]);

  /* ── renders ──────────────────────────────────────────── */

  /* Opening phase — logo animation */
  if (phase === 'opening') {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <div className="tg-opening-wrap">
            <video
              ref={openingVideoRef}
              className="tg-opening-vid"
              src={GAME_INTRO_VIDEO_URL}
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={() => setPhase('menu')}
              onError={() => setPhase('menu')}
            />
            <button className="btn-skip tg-skip-bottom" type="button" onClick={() => setPhase('menu')}>
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Menu phase — logo + tagline + start/continue */
  if (phase === 'menu') {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <div className="tg-menu">
            <div className="tg-menu-logo">
              <img className="tg-menu-logo-img" src={GAME_LOGO_URL} alt="Tong" />
            </div>
            <p className="tg-menu-tagline">
              Live the drama. <span className="tg-menu-tagline-accent">Learn the language.</span>
            </p>
            <div className="tg-menu-actions">
              <button type="button" className="tg-menu-btn-primary" onClick={() => setPhase('tong-intro')}>
                Start New Game
              </button>
              <button type="button" className="tg-menu-btn-continue" onClick={() => setPhase('city_map')}>
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Tong intro phase — narrative onboarding with sub-steps */
  if (phase === 'tong-intro') {
    const currentLine = TONG_INTRO_LINES[introLineIdx] ?? '';
    const lineFinished = introCharIdx >= currentLine.length;

    const handleIntroTap = () => {
      if (introStep !== 0) return; // only tap-advance on step 0
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      if (!lineFinished) {
        setIntroCharIdx(currentLine.length);
      } else if (introLineIdx < TONG_INTRO_LINES.length - 1) {
        setIntroLineIdx((i) => i + 1);
        setIntroCharIdx(0);
      } else {
        // All intro lines done — advance to name step
        changeTongExpression('thinking');
        setIntroStep(1);
      }
    };

    const handleNameNext = () => {
      if (!profileInput.englishName.trim()) return;
      changeTongExpression('neutral');
      setIntroStep(2);
    };

    const handleLanguageNext = () => {
      changeTongExpression('excited');
      dropLinesRef.current[0] = `Let's head to Seoul, ${profileInput.englishName.trim() || 'trainee'}! I know someone you should meet...`;
      setDropLineIdx(0);
      setDropCharIdx(0);
      setDropDone(false);
      setIntroStep(3);
    };

    const tongAvatarSrc = TONG_EXPRESSIONS[tongExpression];

    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <div className="tg-tong-intro" onClick={introStep === 0 ? handleIntroTap : undefined}>
            {/* Step 0: looping video */}
            {introStep === 0 && (
              <>
                <video
                  className="tg-tong-intro-video"
                autoPlay
                muted
                playsInline
                preload="auto"
                loop
              >
                <source src={GAME_INTRO_VIDEO_URL} type='video/webm; codecs="vp09.02.10.08.01"' />
              </video>
                <div className="tg-tong-intro-subtitle">
                  <p className="dialogue-speaker" style={{ color: 'var(--color-accent-gold, #f0c040)' }}>Tong</p>
                  <p className="dialogue-text">
                    {currentLine.slice(0, introCharIdx)}
                    {!lineFinished && <span className="tg-typewriter-cursor" />}
                  </p>
                  {lineFinished && (
                    <p className="dialogue-continue">Tap to continue</p>
                  )}
                </div>
              </>
            )}

            {/* Steps 1-3: static avatar at top with circular bg */}
            {introStep > 0 && (
              <div className="tong-avatar-wrap">
                <img className="tong-avatar" src={tongAvatarSrc} alt="Tong" />
              </div>
            )}

            {/* Step 1: TRAINEE PROFILE — name input */}
            {introStep === 1 && (
              <div className="tg-trainee-profile">
                <div className="tg-tong-intro-subtitle" style={{ position: 'relative', bottom: 'auto', padding: 0, background: 'none' }}>
                  <p className="dialogue-speaker" style={{ color: 'var(--color-accent-gold, #f0c040)' }}>Tong</p>
                  <p className="dialogue-text">What should I call you?</p>
                </div>
                <div className="tg-name-field">
                  <input
                    type="text"
                    className="tg-name-input"
                    placeholder="Your name"
                    value={profileInput.englishName}
                    onChange={(e) => setProfileInput(p => ({ ...p, englishName: e.target.value }))}
                    maxLength={20}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && profileInput.englishName.trim() && handleNameNext()}
                  />
                </div>
                <div className="tg-name-field">
                  <span className="tg-name-field-label">Chinese name <span className="tg-profile-optional">(optional)</span></span>
                  <input
                    type="text"
                    className="tg-name-input"
                    placeholder="中文名"
                    value={profileInput.chineseName}
                    onChange={(e) => setProfileInput(p => ({ ...p, chineseName: e.target.value }))}
                    maxLength={10}
                    onKeyDown={(e) => e.key === 'Enter' && profileInput.englishName.trim() && handleNameNext()}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className="tg-menu-btn-primary"
                    onClick={() => setIntroStep(0)}
                    style={{ flex: '0 0 auto', padding: '10px 18px', background: 'rgba(255,255,255,0.1)' }}
                  >
                    Back
                  </button>
                  <button
                    className="tg-menu-btn-primary"
                    onClick={handleNameNext}
                    disabled={!profileInput.englishName.trim()}
                    style={{ flex: 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: LANGUAGE CHECK — sliders */}
            {introStep === 2 && (
              <div className="tg-trainee-profile">
                <div className="tg-tong-intro-subtitle" style={{ position: 'relative', bottom: 'auto', padding: 0, background: 'none' }}>
                  <p className="dialogue-speaker" style={{ color: 'var(--color-accent-gold, #f0c040)' }}>Tong</p>
                  <p className="dialogue-text">How familiar are you with these?</p>
                </div>
                <div className="proficiency-panel" style={{ marginTop: 12 }}>
                  {LANG_LABELS.map((lang, idx) => {
                    const val = sliders[idx];
                    const gameLvl = GAME_LEVELS[val];
                    return (
                      <div key={lang.key} className="proficiency-lang">
                        <div className="proficiency-lang-header">
                          <span className="proficiency-lang-name">
                            {lang.flag} {lang.name}
                          </span>
                          <span className="proficiency-lang-level">
                            {gameLvl.name}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={6}
                          step={1}
                          value={val}
                          onChange={(e) => handleSlider(idx, Number(e.target.value))}
                          className="proficiency-slider"
                        />
                        <p className="proficiency-desc">Lv.{gameLvl.level} — {gameLvl.desc}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="explain-in-section" style={{ marginTop: 16 }}>
                  <span className="explain-in-heading">Learn each language in:</span>
                  {CITY_EXPLAIN_ROWS.map((row) => (
                    <div key={row.cityId} className="explain-in-row">
                      <span className="explain-in-label">{row.target}</span>
                      <select
                        className="explain-in-select"
                        value={gameState.explainIn[row.cityId] ?? 'en'}
                        onChange={(e) => dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId: row.cityId, lang: e.target.value as AppLang })}
                      >
                        {EXPLAIN_LANG_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className="tg-menu-btn-primary"
                    onClick={() => { changeTongExpression('thinking'); setIntroStep(1); }}
                    style={{ flex: '0 0 auto', padding: '10px 18px', background: 'rgba(255,255,255,0.1)' }}
                  >
                    Back
                  </button>
                  <button
                    className="tg-menu-btn-primary"
                    onClick={handleLanguageNext}
                    style={{ flex: 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: WORLD DROP — typewriter narration then Let's go */}
            {introStep === 3 && (() => {
              const dropLine = dropLinesRef.current[dropLineIdx] ?? '';
              const dropLineFinished = dropCharIdx >= dropLine.length;

              const handleDropTap = () => {
                if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
                if (!dropLineFinished) {
                  setDropCharIdx(dropLine.length);
                } else if (dropLineIdx < dropLinesRef.current.length - 1) {
                  setDropLineIdx((i) => i + 1);
                  setDropCharIdx(0);
                } else {
                  setDropDone(true);
                }
              };

              return dropDone ? (
                <div className="tg-trainee-profile tg-dialogue-panel">
                  <p className="dialogue-speaker" style={{ color: 'var(--color-accent-gold, #f0c040)' }}>Tong</p>
                  <p className="dialogue-text">{dropLinesRef.current[dropLinesRef.current.length - 1]}</p>
                  <button
                    className="tg-menu-btn-primary"
                    onClick={handleConfirmProficiency}
                    style={{ width: '100%', marginTop: 12 }}
                  >
                    Let&apos;s go!
                  </button>
                </div>
              ) : (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div className="tg-trainee-profile tg-dialogue-panel" onClick={handleDropTap}>
                  <p className="dialogue-speaker" style={{ color: 'var(--color-accent-gold, #f0c040)' }}>Tong</p>
                  <p className="dialogue-text">
                    {dropLine.slice(0, dropCharIdx)}
                    {!dropLineFinished && <span className="tg-typewriter-cursor" />}
                  </p>
                  {dropLineFinished && (
                    <p className="dialogue-continue">Tap to continue</p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  /* ── City map handlers ────────────────────────────────────── */

  async function handleMapHangout(cityId: CityId, locationId: LocationId) {
    const npcId = pickNpcForCity(cityId);
    const npcChar = CHARACTER_MAP[npcId] ?? HAEUN;
    npcRef.current = npcChar;
    const level = gameState.calibratedLevel ?? gameState.selfAssessedLevel ?? 0;

    // Deduct SP cost for hangout (first is free, then 10, 25, 50)
    const hangoutCount = gameState.locationHangoutCounts[`${cityId}:${locationId}`] ?? 0;
    const spCosts = [0, 10, 25, 50];
    const spCost = spCosts[Math.min(hangoutCount, spCosts.length - 1)] ?? 50;
    if (spCost > 0) {
      dispatch({ type: 'ADD_SP', amount: -spCost });
    }

    setCity(cityId);
    setLocation(locationId);
    setActiveNpc(npcId);
    setPlayerLevel(level);
    setScore({ xp: 0, sp: 0, rp: 0 });
    setSelectedLocation(null);

    // Reset scene state
    setToolQueue([]);
    setCurrentMessage(null);
    setTongTip(null);
    setChoices(null);
    setChoicePrompt(null);
    setCurrentExercise(null);
    setSceneSummary(null);
    setSceneReady(false);
    setNpcRevealed(false);
    setDynamicBackdrop(null);
    setCinematic(null);
    setIsIntroHangout(false);
    setIntroExerciseCount(0);
    setIntroAct(1);
    exitLineRef.current = '';
    exitLineTranslationRef.current = '';
    processingRef.current = false;
    pausedRef.current = false;
    processedToolCallsRef.current.clear();

    clearActiveHangoutResume();
    setLoading(true);
    setPhase('hangout');

    try {
      const bootstrap = (await startOrResumeGame({
        userId: 'local',
        city: cityId,
        profile: buildBootstrapProfile(),
        preferRomance: true,
      })) as ResumeBootstrapPayload;
      syncActiveResumeMeta(bootstrap);
      setScore({
        xp: bootstrap.progression?.xp ?? 0,
        sp: bootstrap.progression?.sp ?? 0,
        rp: bootstrap.progression?.rp ?? 0,
      });
      setHangoutCheckpointPhase(bootstrap.activeCheckpoint?.phase ?? 'intro');
      setSceneTurn(bootstrap.activeCheckpoint?.turn ?? 1);
    } catch (bootstrapError) {
      console.warn('[RESUME] Failed to bootstrap map hangout session.', bootstrapError);
      syncActiveResumeMeta(null);
      setHangoutCheckpointPhase('hangout');
      setSceneTurn(1);
    } finally {
      setLoading(false);
    }

    const startMsg = `${buildContextBlock(level, npcId, cityId, locationId, npcChar, gameState.explainIn[cityId] ?? 'en')}Start the scene.`;
    sessionLogger.start({ mode: 'hangout', cityId, locationId, surface: 'game', qaRunId, npcId, playerLevel: level });
    sessionLogger.logAIRequest(startMsg);
    void append({ role: 'user', content: startMsg });
  }

  async function handleResumeActiveHangout() {
    if (!activeHangoutResume) return;

    setLoading(true);
    setSelectedLocation(null);
    setReviewSession(null);

    try {
      const bootstrap = (await startOrResumeGame({
        userId: 'local',
        city: activeHangoutResume.cityId,
        profile: buildBootstrapProfile(),
        preferRomance: true,
      })) as ResumeBootstrapPayload;
      syncActiveResumeMeta(bootstrap);
      restoreHangoutFromSnapshot(activeHangoutResume, {
        xp: bootstrap.progression?.xp ?? activeHangoutResume.score.xp,
        sp: bootstrap.progression?.sp ?? activeHangoutResume.score.sp,
        rp: bootstrap.progression?.rp ?? activeHangoutResume.score.rp,
      });
      traceQA('hangout_resumed_from_map', {
        checkpointId: activeHangoutResume.checkpointId,
        turn: activeHangoutResume.turn,
        phase: activeHangoutResume.phase,
      });
    } catch (resumeError) {
      console.warn('[RESUME] Failed to resume active hangout from world map.', resumeError);
      restoreHangoutFromSnapshot(activeHangoutResume);
    } finally {
      setLoading(false);
    }
  }

  function handleMapLearn(cityId: CityId, locationId: LocationId) {
    setCity(cityId);
    setLocation(locationId);
    setSelectedLocation(null);
    setReviewSession(null);
    setPhase('learn');
  }

  function handleMapReviewSession(session: CompletedSession) {
    setCity(session.cityId as CityId);
    setLocation(session.locationId as LocationId);
    setSelectedLocation(null);
    setReviewSession(session);
    setPhase('learn');
  }

  /* ── City map phase ──────────────────────────────────────── */

  if (phase === 'city_map') {
    const mapCity = CITY_ORDER[mapCityIndex];
    const mapUiLang = (gameState.explainIn[mapCity] ?? 'en') as UILang;
    const mapCityInfo = CITY_NAMES[mapCity] ?? CITY_NAMES.seoul;
    const mapLearnKey = mapCity === 'shanghai' ? 'learn_chinese' : mapCity === 'tokyo' ? 'learn_japanese' : 'learn_korean';
    return (
      <UILangProvider value={mapUiLang}>
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <CityMap
            activeCityIndex={mapCityIndex}
            onCityChange={(idx) => { setMapCityIndex(idx); setSelectedLocation(null); }}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
            onStartHangout={handleMapHangout}
            onStartLearn={handleMapLearn}
            onReviewSession={handleMapReviewSession}
            gameState={gameState}
          />
          {activeHangoutResume && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                top: 64,
                zIndex: 30,
                padding: '14px 16px',
                borderRadius: 18,
                background: 'rgba(6, 10, 20, 0.82)',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 18px 40px rgba(0,0,0,0.26)',
                color: '#f4f7ff',
              }}
            >
              <div style={{ fontSize: 'var(--game-text-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.72 }}>
                Active hangout
              </div>
              <div style={{ marginTop: 4, fontSize: 'var(--game-text-lg)', fontWeight: 700 }}>
                {CITY_NAMES[activeHangoutResume.cityId]?.en ?? activeHangoutResume.cityId} · {t(`loc_${activeHangoutResume.locationId}`, mapUiLang)}
              </div>
              <div style={{ marginTop: 6, fontSize: 'var(--game-text-sm)', lineHeight: 1.5, opacity: 0.88 }}>
                Resume turn {activeHangoutResume.turn} at {activeHangoutResume.phase}
              </div>
              {activeHangoutResume.objectiveSummary && (
                <div style={{ marginTop: 8, fontSize: 'var(--game-text-sm)', lineHeight: 1.5, opacity: 0.88 }}>
                  {activeHangoutResume.objectiveSummary}
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleResumeActiveHangout()}
                style={{
                  marginTop: 12,
                  width: '100%',
                  border: 'none',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #ff7e6b, #ff4d8d)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 'var(--game-text-sm)',
                  padding: '13px 16px',
                  cursor: 'pointer',
                }}
              >
                Resume active hangout
              </button>
            </div>
          )}
          <GameHUD
            xp={gameState.xp}
            sp={gameState.sp}
            cityId={mapCity}
            explainLang={(gameState.explainIn[mapCity] ?? 'en') as AppLang}
            locationLabel={<>{mapCityInfo.en} <span className="korean">{mapCityInfo.local}</span><span className="scene-hud-dot">&middot;</span>{t(mapLearnKey, mapUiLang)}</>}
          />
        </div>
      </div>
      </UILangProvider>
    );
  }

  /* ── Dev exercise tester phase ──────────────────────────────── */

  if (phase === 'dev') {
    const DEV_EX_TYPES = [
      'stroke_tracing', 'block_crush', 'matching', 'multiple_choice', 'drag_drop',
      'sentence_builder', 'fill_blank', 'pronunciation_select',
      'pattern_recognition', 'error_correction', 'free_input',
    ] as const;
    const DEV_OBJECTIVES = [
      { id: 'ko-script-consonants', label: '🇰🇷 Consonants (ㄱㄴㄷ)', lang: 'ko' as const },
      { id: 'ko-script-vowels', label: '🇰🇷 Vowels (ㅏㅓㅗ)', lang: 'ko' as const },
      { id: 'ko-vocab-food-items', label: '🇰🇷 Food vocab', lang: 'ko' as const },
      { id: 'ko-vocab-courtesy', label: '🇰🇷 Courtesy phrases', lang: 'ko' as const },
      { id: 'ko-gram-juseyo', label: '🇰🇷 Grammar (주세요)', lang: 'ko' as const },
      { id: 'ja-script-hiragana', label: '🇯🇵 Hiragana (あいう)', lang: 'ja' as const },
      { id: 'ja-script-katakana', label: '🇯🇵 Katakana (アイウ)', lang: 'ja' as const },
      { id: 'ja-vocab-general', label: '🇯🇵 Vocab (Tokyo)', lang: 'ja' as const },
      { id: 'zh-script-radicals', label: '🇨🇳 Radicals (人口日)', lang: 'zh' as const },
      { id: 'zh-vocab-general', label: '🇨🇳 Vocab (Shanghai)', lang: 'zh' as const },
    ];

    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame" style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg-dark, #1a1a2e)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--color-accent-gold, #d4a843)', fontWeight: 700, fontSize: 'var(--game-text-sm)', letterSpacing: 1 }}>DEV</span>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 'var(--game-text-base)' }}>Exercise Tester</span>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ color: '#ccc', fontSize: 'var(--game-text-sm)' }}>
              Exercise type
              <select
                value={devExType}
                onChange={(e) => { setDevExType(e.target.value); setDevExercise(null); setDevLastResult(null); }}
                style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 'var(--game-text-base)' }}
              >
                {DEV_EX_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </label>

            <label style={{ color: '#ccc', fontSize: 'var(--game-text-sm)' }}>
              Objective
              <select
                value={devObjective}
                onChange={(e) => { setDevObjective(e.target.value); setDevExercise(null); setDevLastResult(null); }}
                style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 'var(--game-text-base)' }}
              >
                {DEV_OBJECTIVES.map((o) => (
                  <option key={o.id} value={o.id}>{o.label} ({o.id})</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                const obj = DEV_OBJECTIVES.find((o) => o.id === devObjective);
                const subtype = searchParams.get('subtype') ?? undefined;
                const ex = generateExercise(devExType, { objectiveId: devObjective, language: obj?.lang ?? 'ko', hintSubType: subtype });
                setDevExercise(ex);
                setDevLastResult(null);
              }}
              style={{ minHeight: 44, padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--color-accent-gold, #d4a843)', color: '#1a1a2e', fontWeight: 700, fontSize: 'var(--game-text-base)', cursor: 'pointer' }}
            >
              Generate {devExType.replace('_', ' ')}
            </button>

            {devLastResult && (
              <div style={{ padding: '8px 12px', borderRadius: 6, background: devLastResult.correct ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)', color: devLastResult.correct ? '#4caf50' : '#f44336', fontSize: 'var(--game-text-sm)', fontWeight: 600 }}>
                {devLastResult.correct ? 'Correct' : 'Incorrect'} — {devLastResult.id}
              </div>
            )}

            {devExercise && (
              <div style={{ fontSize: 'var(--game-text-xs)', color: '#888', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto', padding: '6px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)' }}>
                <strong>Data:</strong> {JSON.stringify(devExercise, null, 0).slice(0, 500)}
              </div>
            )}
          </div>

          {devExercise && (
            <ExerciseModal
              exercise={devExercise}
              onResult={(id, correct) => {
                setDevLastResult({ correct, id });
                setDevExercise(null);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  /* ── Learn phase ─────────────────────────────────────────── */

  if (phase === 'learn') {
    const learnUiLang = (gameState.explainIn[city] ?? 'en') as UILang;
    return (
      <UILangProvider value={learnUiLang}>
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setPhase('city_map')}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', width: 44, height: 44, padding: 0 }}
              type="button"
            >
              &larr;
            </button>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 'var(--game-text-base)' }}>
              {CITY_NAMES[city]?.local ?? ''} {CITY_NAMES[city]?.en ?? ''} &middot; {t(`loc_${location}`, learnUiLang)}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LearnPanel
              cityId={city}
              locationId={location}
              userId="local"
              lang="ko"
              initialReviewSession={reviewSession ?? undefined}
            />
          </div>
        </div>
      </div>
      </UILangProvider>
    );
  }

  /* Hangout phase — immersive VN scene */
  const cityInfo = CITY_NAMES[city] || CITY_NAMES.seoul;
  const npc = NPC_SPRITES[activeNpc] || NPC_SPRITES.haeun;
  const rel = gameState.relationships[activeNpc];
  const affinity = rel?.affinity ?? 10;

  // Derive targetLang from the NPC's home city, not the game's current city.
  // This ensures that talking to a Seoul NPC (Jin) always gives Korean tooltips,
  // even if the game routed to a different city during onboarding.
  const npcChar = CHARACTER_MAP[activeNpc];
  const npcCity = (npcChar?.cityId ?? city) as CityId;
  const targetLang = getLanguageForCity(npcCity);
  const explainLang = (gameState.explainIn[npcCity] ?? 'en') as UILang;
  const resolvedDynamicBackdropUrl = resolveRuntimeAssetUrl(dynamicBackdrop?.url);

  if (sceneSummary) {
    const backdropUrl = resolvedDynamicBackdropUrl || SEOUL_FOOD_STREET_BACKDROP_URL;
    return (
      <UILangProvider value={explainLang}>
        <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="game-frame summary-screen">
            <img className="summary-scene-bg" src={backdropUrl} alt="" />
            <div className="summary-overlay" />
            <div className="summary-content">
              <h2 className="summary-title">{t('scene_complete', explainLang)}</h2>
              <p className="summary-text"><KoreanText text={sceneSummary.summary} targetLang={targetLang} /></p>
              <div className="summary-stats">
                <div className="summary-stat">
                  <div className="summary-stat-value summary-stat-xp">+{sceneSummary.xpEarned}</div>
                  <div className="summary-stat-label">{t('xp_earned', explainLang)}</div>
                </div>
                {/* Merge duplicate characterId entries */}
                {Object.values(sceneSummary.affinityChanges.reduce<Record<string, { characterId: string; delta: number }>>((acc, ac) => {
                  if (acc[ac.characterId]) acc[ac.characterId].delta += ac.delta;
                  else acc[ac.characterId] = { ...ac };
                  return acc;
                }, {})).map((ac) => (
                  <div key={ac.characterId} className="summary-stat">
                    <div className={`summary-stat-value ${ac.delta > 0 ? 'summary-stat-positive' : 'summary-stat-negative'}`}>
                      {ac.delta > 0 ? '+' : ''}{ac.delta}
                    </div>
                    <div className="summary-stat-label">
                      {(() => { const s = NPC_SPRITES[ac.characterId] || NPC_SPRITES.haeun; return `${s.nameLocal} ${explainLang === 'zh' ? s.nameZh : s.name}`; })()}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="btn-go"
                onClick={() => {
                  dispatch({ type: 'INCREMENT_LOCATION_HANGOUT', cityId: city, locationId: location });
                  setSceneSummary(null);
                  setSelectedLocation(null);
                  // Jump map to the city where the hangout was
                  const cityIdx = CITY_ORDER.indexOf(city as CityId);
                  if (cityIdx >= 0) setMapCityIndex(cityIdx);
                  clearActiveHangoutResume();
                  setPhase('city_map');
                }}
              >
                {t('done', explainLang)}
              </button>
            </div>
          </div>
        </div>
      </UILangProvider>
    );
  }
  const continueLabel = t('tap_to_continue', explainLang as UILang);
  const sceneBusy = chatLoading || continuePending || toolQueue.length > 0;

  // Heart meter progress: time-based charge over 2 minutes
  const heartProgress = chargePercent;

  return (
    <UILangProvider value={explainLang}>
    <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="game-frame">
        <SceneView
          backgroundUrl={resolvedDynamicBackdropUrl || SEOUL_FOOD_STREET_BACKDROP_URL}
          backgroundTransition={dynamicBackdrop?.transition}
          ambientDescription={dynamicBackdrop?.ambientDescription ?? 'A warm pojangmacha (street food tent) on a Seoul side street'}
          cinematic={cinematic}
          onCinematicEnd={handleCinematicEnd}
          npcName={`${npc.nameLocal} ${explainLang === 'zh' ? npc.nameZh : npc.name}`}
          npcColor={npc.color}
          npcSpriteUrl={isIntroHangout && !npcRevealed ? '' : currentExercise ? '' : npc.src}
          npcIdleVideoUrl={isIntroHangout && !npcRevealed ? undefined : npc.idleVideo || undefined}
          currentMessage={displayMessage}
          currentExercise={currentExercise}
          choices={choices}
          choicePrompt={choicePrompt}
          tongTip={tongTip}
          isStreaming={chatLoading}
          dialogueIsStreaming={dialogueIsStreaming}
          sceneBusy={sceneBusy}
          sceneReady={sceneReady}
          targetLang={targetLang}
          continueLabel={continueLabel}
          hudContent={
            <GameHUD
              xp={gameState.xp}
              sp={gameState.sp}
              rp={Math.round(affinity)}
              locationLabel={<>{cityInfo.en} <span className="korean">{cityInfo.local}</span><span className="scene-hud-dot">&middot;</span>{t(`loc_${location}`, explainLang)}</>}
              cityId={city}
              explainLang={explainLang as AppLang}
              chargeProgress={isIntroHangout ? heartProgress : undefined}
              chargeLabel={isIntroHangout ? (introAct === 1 ? `${heartProgress}%` : `${npc.nameLocal} ${explainLang === 'zh' ? npc.nameZh : npc.name} · ${heartProgress}%`) : undefined}
              chargeComplete={isIntroHangout && heartProgress >= 100}
            />
          }
          onChoice={handleChoice}
          onContinue={handleContinue}
          onExerciseResult={handleExerciseResult}
          onExerciseDismiss={handleExerciseDismiss}
          onDismissTong={handleDismissTong}
        />
        {/* Charge complete notification (auto-dismisses) */}
        {chargeNotifShown && (
          <ChargeNotif
            text={explainLang === 'zh' ? '⚡ 能量已满' : explainLang === 'ko' ? '⚡ 에너지 충전 완료' : explainLang === 'ja' ? '⚡ エネルギー満タン' : '⚡ Fully Charged'}
          />
        )}
        {canReturnToMap && (
          <button
            type="button"
            onClick={() => {
              saveActiveHangoutResumeSnapshot();
              const cityIdx = CITY_ORDER.indexOf(city as CityId);
              if (cityIdx >= 0) setMapCityIndex(cityIdx);
              setSelectedLocation(null);
              setReviewSession(null);
              traceQA('hangout_return_to_map', {
                checkpointId: activeHangoutCheckpointIdRef.current,
                turn: sceneTurn,
                phase: hangoutCheckpointPhase ?? 'hangout',
              });
              setPhase('city_map');
            }}
            style={{
              position: 'absolute',
              left: 12,
              top: 56,
              zIndex: 30,
              border: '1px solid rgba(255,255,255,0.16)',
              borderRadius: 999,
              background: 'rgba(6, 10, 20, 0.78)',
              color: '#f4f7ff',
              padding: '10px 14px',
              fontSize: 'var(--game-text-xs)',
              fontWeight: 700,
              letterSpacing: '0.02em',
              boxShadow: '0 14px 30px rgba(0,0,0,0.2)',
            }}
          >
            ← Return to world map
          </button>
        )}
        {hangoutCheckpointPhase && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(6, 10, 20, 0.78)',
              color: '#f4f7ff',
              fontSize: 'var(--game-text-xs)',
              lineHeight: 1.4,
              pointerEvents: 'none',
            }}
          >
            Resumed checkpoint · phase {hangoutCheckpointPhase} · turn {sceneTurn}
            {currentExercise ? ` · ${currentExercise.type}` : ''}
          </div>
        )}
      </div>
    </div>
    </UILangProvider>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from 'ai/react';
import type { CityId, LocationId, ProficiencyLevel, ScoreState, UserProficiency, AppLang } from '@/lib/api';
import type { SessionMessage, ToolQueueItem, SceneSummary, ExerciseData } from '@/lib/types/hangout';
import type { CompletedSession } from '@/lib/store/session-store';
import type { DialogueChoice } from '@/components/scene/ChoiceButtons';
import type { Character } from '@/lib/types/relationship';
import { SceneView } from '@/components/scene/SceneView';
import { generateExercise } from '@/lib/exercises/generators';
import { parseExerciseData } from '@/lib/exercises/validate';
import { extractTargetItems } from '@/lib/exercises/extract-targets';
import { summarizeExercise } from '@/lib/utils/summarize-exercise';
import { useGameState, dispatch, getRelationship, getMasterySnapshot, getGameState } from '@/lib/store/game-store';
import type { PlayerProfile } from '@/lib/store/game-store';
import { CHARACTER_MAP, HAEUN, TUTORIAL_VIDEO_CONFIG, pickRandom } from '@/lib/content/characters';
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

/* ── scene constants ────────────────────────────────────── */

const NPC_SPRITES: Record<string, { name: string; nameLocal: string; nameZh: string; src: string; idleVideo?: string; color: string }> = {
  haeun: { name: 'Ha-eun', nameLocal: '하은', nameZh: '夏恩', src: '/assets/characters/haeun/haeun.png', idleVideo: '/assets/characters/haeun/haeun_idle.mp4', color: '#e8485c' },
  jin: { name: 'Jin', nameLocal: '진', nameZh: '珍', src: '/assets/characters/jin/jin.png', color: '#4a90d9' },
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

type TongExpression = 'neutral' | 'cheerful' | 'surprised' | 'proud' | 'love' | 'sad' | 'crying' | 'amazed' | 'excited' | 'thinking';

const TONG_EXPRESSIONS: Record<TongExpression, string> = {
  neutral: '/assets/characters/tong/tong_neutral.png',
  cheerful: '/assets/characters/tong/tong_cheerful.png',
  surprised: '/assets/characters/tong/tong_surprised.png',
  proud: '/assets/characters/tong/tong_proud.png',
  love: '/assets/characters/tong/tong_love.png',
  sad: '/assets/characters/tong/tong_sad.png',
  crying: '/assets/characters/tong/tong_crying.png',
  amazed: '/assets/characters/tong/tong_amazed.png',
  excited: '/assets/characters/tong/tong_excited.png',
  thinking: '/assets/characters/tong/tong_thinking.png',
};

/* ── helpers ────────────────────────────────────────────── */

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

  /* phase state — ?phase=hangout|city_map skips straight there, ?dev=exercise opens dev tester, ?dev_intro=1 fresh intro hangout */
  const phaseParam = searchParams.get('phase');
  const devParam = searchParams.get('dev');
  const devIntro = searchParams.get('dev_intro') === '1';
  const skipToHangout = phaseParam === 'hangout';
  const skipToCityMap = phaseParam === 'city_map';
  const [phase, setPhase] = useState<Phase>(
    devIntro ? 'hangout' : devParam === 'exercise' ? 'dev' : skipToHangout ? 'hangout' : skipToCityMap ? 'city_map' : 'opening'
  );
  const openingVideoRef = useRef<HTMLVideoElement>(null);

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
  const [dynamicBackdrop, setDynamicBackdrop] = useState<{ url: string; transition: 'fade' | 'cut'; ambientDescription?: string } | null>(null);
  const [cinematic, setCinematic] = useState<{ videoUrl: string; caption?: string; autoAdvance: boolean; muted?: boolean } | null>(null);

  /* tutorial state */
  const mockVideo = searchParams.get('mock_video') === '1';
  const liveVideo = searchParams.get('live_video') === '1';
  const [profileInput, setProfileInput] = useState<PlayerProfile>({ englishName: '', chineseName: '' });
  const exitLineRef = useRef('');
  const introVideoUrlRef = useRef<string | null>(null);
  const exitVideoUrlRef = useRef<string | null>(null);
  const cinematicCaptionRef = useRef<string | null>(null);
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
      backdropUrl: '/assets/backdrops/seoul/pojangmacha.png',
      chargePercent,
      chargeComplete: chargePercent >= 100,
    };
  }

  function handleConfirmProficiency() {
    setError('');
    setLoading(true);

    const weakIdx = getWeakestLangIndex(sliders);
    const primaryLang = LANG_KEYS[weakIdx] as 'ko' | 'ja' | 'zh';

    const weakLevel = sliders[weakIdx];
    const preferredCity = (LANG_TO_CITY[primaryLang] ?? 'seoul') as CityId;
    const npcId = pickNpcForCity(preferredCity);
    const npcChar = CHARACTER_MAP[npcId] ?? HAEUN;
    // Use the NPC's actual city — if no NPC exists for the preferred city,
    // the fallback NPC's city determines the target language.
    const primaryCity = (npcChar.cityId ?? preferredCity) as CityId;
    setCity(primaryCity);
    setLocation('food_street');
    setActiveNpc(npcId);
    setPlayerLevel(weakLevel);
    setScore({ xp: 0, sp: 0, rp: 0 });

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

    // Select pre-generated intro/exit videos for introduction
    let introCtx: ReturnType<typeof getIntroCtx> = undefined;
    if (isIntro) {
      const config = TUTORIAL_VIDEO_CONFIG[npcId];
      if (config) {
        const templates = config.exitLineTemplates;
        const template = pickRandom(templates);
        const exitLine = template.replace(/{playerName}/g, displayName);
        exitLineRef.current = exitLine;

        introVideoUrlRef.current = pickRandom(config.introVideoUrls);
        exitVideoUrlRef.current = pickRandom(config.exitVideoUrls);

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
        backdropUrl: '/assets/backdrops/seoul/pojangmacha.png',
        chargePercent: 0,
        chargeComplete: false,
      };
    }

    setPhase('hangout');
    setLoading(false);

    const startMsg = `${buildContextBlock(weakLevel, npcId, primaryCity as CityId, 'food_street', npcChar, gameState.explainIn[primaryCity as CityId] ?? 'en', introCtx)}Start the scene.`;
    sessionLogger.start({ mode: 'hangout', cityId: primaryCity, locationId: 'food_street', npcId, playerLevel: weakLevel });
    sessionLogger.logAIRequest(startMsg);
    void append({ role: 'user', content: startMsg });
  }

  /* ── useChat integration ──────────────────────────────────── */

  const { append, isLoading: chatLoading } = useChat({
    api: '/api/ai/hangout',
    maxSteps: 1,
    onResponse: () => {
      pausedRef.current = false;
    },
    onToolCall: ({ toolCall }) => {
      const { toolName, toolCallId, args } = toolCall;
      if (processedToolCallsRef.current.has(toolCallId)) return args;
      if (pausedRef.current) {
        console.log(`[VN] onToolCall SKIPPED (paused): ${toolName}`);
        return args;
      }
      processedToolCallsRef.current.add(toolCallId);
      if (!sceneReady) setSceneReady(true);
      sessionLogger.logToolCall(toolName, toolCallId, args as Record<string, unknown>);

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
    },
    onFinish: (msg) => {
      sessionLogger.logAIResponse(msg.role, msg.toolInvocations?.length ?? 0);
    },
  });

  /* Auto-start scene when skipping to hangout */
  useEffect(() => {
    if (skipToHangout && !sceneStartedRef.current) {
      sceneStartedRef.current = true;
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
      void append({ role: 'user', content: `${ctx}Start the scene.` });
    }
  }, [skipToHangout, append, playerLevel, activeNpc, city, location, gameState.explainIn]);

  /* Dev intro bypass: ?dev_intro=1 — fresh introduction hangout, clears stale state */
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
    setIntroExerciseCount(0);
    setIntroAct(1);

    // Set player profile and language preference
    dispatch({ type: 'SET_PLAYER_PROFILE', profile: { englishName, chineseName } });
    dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId: devCity, lang: devLang });

    // Pick intro/exit videos
    const config = TUTORIAL_VIDEO_CONFIG[npcId];
    if (config) {
      introVideoUrlRef.current = pickRandom(config.introVideoUrls);
      exitVideoUrlRef.current = pickRandom(config.exitVideoUrls);
      const template = pickRandom(config.exitLineTemplates);
      exitLineRef.current = template.replace(/{playerName}/g, displayName);
    }

    const introCtx = {
      isIntroduction: true,
      playerName: displayName,
      videoStatus: 'ready' as const,
      exitVideoUrl: exitVideoUrlRef.current,
      introVideoUrl: introVideoUrlRef.current,
      exitLine: exitLineRef.current,
      exercisesDone: 0,
      introAct: 1 as const,
      backdropUrl: '/assets/backdrops/seoul/pojangmacha.png',
    };

    const startMsg = `${buildContextBlock(0, npcId, devCity, 'food_street', npcChar, devLang, introCtx)}Start the scene.`;
    sessionLogger.start({ mode: 'hangout', cityId: devCity, locationId: 'food_street', npcId, playerLevel: 0 });
    sessionLogger.logAIRequest(startMsg);
    console.log('[DevIntro] Starting fresh introduction hangout for', npcId, 'lang:', devLang);
    void append({ role: 'user', content: startMsg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devIntro]);

  /* ── Tool queue processor ───────────────────────────────── */
  useEffect(() => {
    if (toolQueue.length === 0 || processingRef.current) return;
    processingRef.current = true;

    const item = toolQueue[0];

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
        console.log('[VN] tong_whisper BLOCK — wait for user dismiss');
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
        let exercise: ExerciseData;
        const parsed = parseExerciseData(args.exerciseData);
        if (parsed) {
          exercise = parsed;
        } else {
          const npcChar = CHARACTER_MAP[activeNpc];
          const npcCity = (npcChar?.cityId ?? city) as CityId;
          const lang = getLanguageForCity(npcCity);
          const explainLang_ = getGameState().explainIn[npcCity] ?? 'en';
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
        }
        setCurrentMessage(null);
        setTongTip(null);
        setCurrentExercise(exercise);
        lastExerciseRef.current = exercise;
        sessionLogger.logExerciseShown(args.exerciseType, exercise.id, { objectiveId: args.objectiveId, hintItems: args.hintItems });
        return; // BLOCK — wait for exercise completion
      }
      case 'offer_choices': {
        const args = item.args as { prompt: string; choices: { id: string; text: string }[] };
        setChoicePrompt(args.prompt);
        setChoices(args.choices);
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
        // Intro video triggers Act 1 → Act 2 transition
        const isIntroVideo = isIntroHangout && introAct === 1 && introVideoUrlRef.current && args.videoUrl === introVideoUrlRef.current;
        if (isIntroVideo) {
          setIntroAct(2);
          console.log('[VN] Act 1 → Act 2 transition triggered by intro cinematic');
        }
        // Store caption to show as narrator line after cinematic ends
        cinematicCaptionRef.current = args.caption ?? null;
        setCinematic({
          videoUrl: args.videoUrl,
          autoAdvance: args.autoAdvance,
          muted: false,
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
  }, [toolQueue, activeNpc, isIntroHangout, introAct]);

  /* ── Hangout handlers ───────────────────────────────────── */

  const handleContinue = useCallback(() => {
    const now = Date.now();
    if (now - lastContinueRef.current < 400) return;
    lastContinueRef.current = now;

    if (processingRef.current) {
      // If the current blocking tool is show_exercise and exercise was dismissed,
      // re-show it from cache instead of dequeuing
      const currentTool = toolQueue[0]?.toolName;
      if (currentTool === 'show_exercise' && !currentExercise && lastExerciseRef.current) {
        console.log('[VN] handleContinue: re-show dismissed exercise');
        setCurrentExercise(lastExerciseRef.current);
        return;
      }
      console.log('[VN] handleContinue: dequeue blocked tool');
      setCurrentMessage(null);
      setTongTip(null);
      const remainingAfterDequeue = toolQueue.length - 1;
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;

      // If nothing left in queue after dequeuing, request next turn
      if (remainingAfterDequeue === 0 && !chatLoading) {
        const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
        const msg = `${ctx}Continue.`;
        sessionLogger.logUserTap('continue');
        sessionLogger.logAIRequest(msg);
        void append({ role: 'user', content: msg });
      }
      return;
    }

    if (sceneSummary) return;
    if (chatLoading) return;

    if (tongTip) {
      setTongTip(null);
      // tongTip was auto-advanced (not blocking) — fall through to request next turn
    }

    if (!currentExercise && !choices && toolQueue.length === 0) {
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
      const msg = `${ctx}Continue.`;
      sessionLogger.logUserTap('continue');
      sessionLogger.logAIRequest(msg);
      void append({ role: 'user', content: msg });
    }
  }, [sceneSummary, chatLoading, tongTip, currentExercise, choices, toolQueue.length, append, playerLevel, activeNpc, city, location, gameState.explainIn, isIntroHangout, introExerciseCount, introAct]);

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
    if (!result) return;
    exerciseResultRef.current = null;
    setCurrentExercise(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;

    const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
    const msg = `${ctx}${summarizeExercise(result.exerciseId, result.correct)}`;
    sessionLogger.logAIRequest(msg);
    void append({ role: 'user', content: msg });
  }, [append, playerLevel, activeNpc, city, location, gameState.explainIn, isIntroHangout, introExerciseCount, introAct]);

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

    const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
    const msg = `${ctx}Choice: ${choiceId}`;
    sessionLogger.logAIRequest(msg);
    void append({ role: 'user', content: msg });
  }, [append, playerLevel, activeNpc, city, location, gameState.explainIn, isIntroHangout, introExerciseCount, introAct]);

  const handleCinematicEnd = useCallback(() => {
    setCinematic(null);
    cinematicCaptionRef.current = null;
    if (isIntroHangout && !npcRevealed) setNpcRevealed(true);
    const remainingAfterDequeue = toolQueue.length - 1;
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;

    // If nothing left in queue after dequeuing, request next AI turn
    if (remainingAfterDequeue === 0 && !chatLoading) {
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en', getIntroCtx());
      const msg = `${ctx}Continue.`;
      sessionLogger.logUserTap('cinematic_end');
      sessionLogger.logAIRequest(msg);
      void append({ role: 'user', content: msg });
    }
  }, [isIntroHangout, npcRevealed, toolQueue.length, chatLoading, append, playerLevel, activeNpc, city, location, gameState.explainIn]);

  const handleDismissTong = useCallback(() => {
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
        void append({ role: 'user', content: msg });
      }
    }
  }, [toolQueue.length, chatLoading, append, playerLevel, activeNpc, city, location, gameState.explainIn, isIntroHangout, introExerciseCount, introAct]);

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
              src="/assets/app/tong_opening.mp4"
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
              <img className="tg-menu-logo-img" src="/assets/app/logo_transparent.png" alt="Tong" />
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
                  src="/assets/tong_intro.webm"
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  loop
                />
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
                <p className="tg-trainee-label">TRAINEE PROFILE</p>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleNameNext()}
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
                    onKeyDown={(e) => e.key === 'Enter' && handleNameNext()}
                  />
                </div>
                <button
                  className="tg-menu-btn-primary"
                  onClick={handleNameNext}
                  disabled={!profileInput.englishName.trim()}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  Next
                </button>
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
                <button
                  className="tg-menu-btn-primary"
                  onClick={handleLanguageNext}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  Next
                </button>
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

  function handleMapHangout(cityId: CityId, locationId: LocationId) {
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
    processingRef.current = false;
    pausedRef.current = false;
    processedToolCallsRef.current.clear();

    setPhase('hangout');

    const startMsg = `${buildContextBlock(level, npcId, cityId, locationId, npcChar, gameState.explainIn[cityId] ?? 'en')}Start the scene.`;
    sessionLogger.start({ mode: 'hangout', cityId, locationId, npcId, playerLevel: level });
    sessionLogger.logAIRequest(startMsg);
    void append({ role: 'user', content: startMsg });
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
          <GameHUD
            xp={gameState.xp}
            sp={gameState.sp}
            cityId={mapCity}
            explainLang={(gameState.explainIn[mapCity] ?? 'en') as AppLang}
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
            <span style={{ color: 'var(--color-accent-gold, #d4a843)', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>DEV</span>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Exercise Tester</span>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ color: '#ccc', fontSize: 13 }}>
              Exercise type
              <select
                value={devExType}
                onChange={(e) => { setDevExType(e.target.value); setDevExercise(null); setDevLastResult(null); }}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14 }}
              >
                {DEV_EX_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </label>

            <label style={{ color: '#ccc', fontSize: 13 }}>
              Objective
              <select
                value={devObjective}
                onChange={(e) => { setDevObjective(e.target.value); setDevExercise(null); setDevLastResult(null); }}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14 }}
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
                const ex = generateExercise(devExType, { objectiveId: devObjective, language: obj?.lang ?? 'ko' });
                setDevExercise(ex);
                setDevLastResult(null);
              }}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--color-accent-gold, #d4a843)', color: '#1a1a2e', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Generate {devExType.replace('_', ' ')}
            </button>

            {devLastResult && (
              <div style={{ padding: '8px 12px', borderRadius: 6, background: devLastResult.correct ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)', color: devLastResult.correct ? '#4caf50' : '#f44336', fontSize: 13, fontWeight: 600 }}>
                {devLastResult.correct ? 'Correct' : 'Incorrect'} — {devLastResult.id}
              </div>
            )}

            {devExercise && (
              <div style={{ fontSize: 11, color: '#888', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto', padding: '6px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)' }}>
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
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}
              type="button"
            >
              &larr;
            </button>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
              {CITY_NAMES[city]?.local ?? ''} {CITY_NAMES[city]?.en ?? ''} &middot; {t(`loc_${location}`, learnUiLang)}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LearnPanel
              cityId={city}
              locationId={location}
              userId="local"
              lang="ko"
              autoStart={!reviewSession}
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

  if (sceneSummary) {
    const backdropUrl = dynamicBackdrop?.url ?? '/assets/backdrops/seoul/pojangmacha.png';
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
                {sceneSummary.affinityChanges.map((ac) => (
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

  // Heart meter progress: time-based charge over 2 minutes
  const heartProgress = chargePercent;

  return (
    <UILangProvider value={explainLang}>
    <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="game-frame">
        <SceneView
          backgroundUrl={dynamicBackdrop?.url ?? '/assets/backdrops/seoul/pojangmacha.png'}
          backgroundTransition={dynamicBackdrop?.transition}
          ambientDescription={dynamicBackdrop?.ambientDescription ?? 'A warm pojangmacha (street food tent) on a Seoul side street'}
          cinematic={cinematic}
          onCinematicEnd={handleCinematicEnd}
          npcName={`${npc.nameLocal} ${explainLang === 'zh' ? npc.nameZh : npc.name}`}
          npcColor={npc.color}
          npcSpriteUrl={isIntroHangout && !npcRevealed ? '' : currentExercise ? '' : npc.src}
          npcIdleVideoUrl={npcRevealed && !currentExercise && npc.idleVideo ? npc.idleVideo : undefined}
          currentMessage={currentMessage}
          currentExercise={currentExercise}
          choices={choices}
          choicePrompt={choicePrompt}
          tongTip={tongTip}
          isStreaming={chatLoading}
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
      </div>
    </div>
    </UILangProvider>
  );
}

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
import { useGameState, dispatch, getRelationship, getMasterySnapshot } from '@/lib/store/game-store';
import { CHARACTER_MAP, HAUEN } from '@/lib/content/characters';
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

const NPC_SPRITES: Record<string, { name: string; nameLocal: string; nameZh: string; src: string; color: string }> = {
  haeun: { name: 'Ha-eun', nameLocal: '하은', nameZh: '夏恩', src: '/assets/characters/haeun/haeun.png', color: '#e8485c' },
  jin: { name: 'Jin', nameLocal: '진', nameZh: '珍', src: '/assets/characters/jin/jin.png', color: '#4a90d9' },
};

const NPC_POOL = ['haeun', 'jin'] as const;

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

const CONTINUE_LABELS: Record<string, string> = {
  en: 'Tap to continue',
  ko: '탭하여 계속',
  ja: 'タップして続く',
  zh: '点击继续',
};

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

type Phase = 'opening' | 'menu' | 'tong-intro' | 'proficiency' | 'hangout' | 'city_map' | 'learn' | 'dev';

/* ── helpers ────────────────────────────────────────────── */

/** Build rich context block for API messages using game store data. */
function buildContextBlock(
  level: number,
  npcId: string,
  cityId: CityId,
  locationId: LocationId,
  npcChar: Character,
  explainIn: AppLang = 'en',
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

  /* phase state — ?phase=hangout|city_map skips straight there, ?dev=exercise opens dev tester */
  const phaseParam = searchParams.get('phase');
  const devParam = searchParams.get('dev');
  const skipToHangout = phaseParam === 'hangout';
  const skipToCityMap = phaseParam === 'city_map';
  const [phase, setPhase] = useState<Phase>(
    devParam === 'exercise' ? 'dev' : skipToHangout ? 'hangout' : skipToCityMap ? 'city_map' : 'opening'
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
  const npcRef = useRef<Character>(HAUEN);

  /* VN scene state */
  const [toolQueue, setToolQueue] = useState<ToolQueueItem[]>([]);
  const [currentMessage, setCurrentMessage] = useState<SessionMessage | null>(null);
  const [tongTip, setTongTip] = useState<{ message: string; translation?: string } | null>(null);
  const [choices, setChoices] = useState<DialogueChoice[] | null>(null);
  const [choicePrompt, setChoicePrompt] = useState<string | null>(null);
  const [currentExercise, setCurrentExercise] = useState<ExerciseData | null>(null);
  const [sceneSummary, setSceneSummary] = useState<SceneSummary | null>(null);
  const [dynamicBackdrop, setDynamicBackdrop] = useState<{ url: string; transition: 'fade' | 'cut'; ambientDescription?: string } | null>(null);
  const [cinematic, setCinematic] = useState<{ videoUrl: string; caption?: string; autoAdvance: boolean } | null>(null);

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

  function handleConfirmProficiency() {
    setError('');
    setLoading(true);

    const weakIdx = getWeakestLangIndex(sliders);
    const primaryLang = LANG_KEYS[weakIdx] as 'ko' | 'ja' | 'zh';
    const primaryCity = LANG_TO_CITY[primaryLang] ?? 'seoul';

    const weakLevel = sliders[weakIdx];
    const npcId = NPC_POOL[Math.floor(Math.random() * NPC_POOL.length)];
    const npcChar = CHARACTER_MAP[npcId] ?? HAUEN;
    npcRef.current = npcChar;

    setCity(primaryCity as CityId);
    setLocation('food_street');
    setActiveNpc(npcId);
    setPlayerLevel(weakLevel);
    setScore({ xp: 0, sp: 0, rp: 0 });

    // Store self-assessed level
    dispatch({ type: 'SET_SELF_ASSESSED_LEVEL', level: weakLevel });

    setPhase('hangout');
    setLoading(false);

    const startMsg = `${buildContextBlock(weakLevel, npcId, primaryCity as CityId, 'food_street', npcChar, gameState.explainIn[primaryCity as CityId] ?? 'en')}Start the scene.`;
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
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en');
      void append({ role: 'user', content: `${ctx}Start the scene.` });
    }
  }, [skipToHangout, append, playerLevel, activeNpc, city, location, gameState.explainIn]);

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
        if (toolQueue.length > 1 && toolQueue[1].toolName === 'show_exercise') {
          console.log('[VN] tong_whisper BLOCK (exercise next)');
          return; // BLOCK
        }
        break; // auto-advance
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
          exercise = generateExercise(args.exerciseType, {
            hintItems: args.hintItems ?? undefined,
            hintCount: args.hintCount ?? undefined,
            hintSubType: args.hintSubType ?? undefined,
            objectiveId: args.objectiveId,
          });
        }
        setCurrentMessage(null);
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
        setCinematic({
          videoUrl: args.videoUrl,
          caption: args.caption ?? undefined,
          autoAdvance: args.autoAdvance,
        });
        console.log('[VN] play_cinematic BLOCK:', args.videoUrl);
        return; // BLOCK — wait for video end or tap
      }
      default:
        break; // auto-advance
    }

    // Auto-advance: dequeue and release lock
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
  }, [toolQueue, activeNpc]);

  /* ── Hangout handlers ───────────────────────────────────── */

  const handleContinue = useCallback(() => {
    const now = Date.now();
    if (now - lastContinueRef.current < 400) return;
    lastContinueRef.current = now;

    if (processingRef.current) {
      console.log('[VN] handleContinue: dequeue blocked tool');
      setCurrentMessage(null);
      setTongTip(null); // Clear any lingering tong tip
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;
      return;
    }

    if (sceneSummary) return;
    if (chatLoading) return;

    if (tongTip) {
      setTongTip(null);
      // tongTip was auto-advanced (not blocking) — fall through to request next turn
    }

    if (!currentExercise && !choices && toolQueue.length === 0) {
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en');
      const msg = `${ctx}Continue.`;
      sessionLogger.logUserTap('continue');
      sessionLogger.logAIRequest(msg);
      void append({ role: 'user', content: msg });
    }
  }, [sceneSummary, chatLoading, tongTip, currentExercise, choices, toolQueue.length, append, playerLevel, activeNpc, city, location, gameState.explainIn]);

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

    // Delay clearing the exercise so user can see feedback (Correct!/Wrong) for 1.5s
    setTimeout(() => {
      setCurrentExercise(null);
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;

      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en');
      const msg = `${ctx}${summarizeExercise(exerciseId, correct)}`;
      sessionLogger.logAIRequest(msg);
      void append({ role: 'user', content: msg });
    }, 1500);
  }, [append, playerLevel, activeNpc, city, location, gameState.explainIn]);

  const handleChoice = useCallback((choiceId: string) => {
    setChoices(null);
    setChoicePrompt(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
    sessionLogger.logChoiceSelected(choiceId);
    const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en');
    const msg = `${ctx}Choice: ${choiceId}`;
    sessionLogger.logAIRequest(msg);
    void append({ role: 'user', content: msg });
  }, [append, playerLevel, activeNpc, city, location, gameState.explainIn]);

  const handleCinematicEnd = useCallback(() => {
    setCinematic(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
  }, []);

  const handleDismissTong = useCallback(() => {
    setTongTip(null);
    if (processingRef.current) {
      // tong_whisper was blocking (exercise next) — dequeue so processor advances
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;
    } else if (!currentExercise && !choices && toolQueue.length === 0) {
      // tong_whisper was auto-advanced, nothing queued — request next turn
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current, gameState.explainIn[city] ?? 'en');
      void append({ role: 'user', content: `${ctx}Continue.` });
    }
  }, [currentExercise, choices, toolQueue.length, append, playerLevel, activeNpc, city, location, gameState.explainIn]);

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

  /* Tong intro phase — mascot video + immersive subtitle dialogue */
  if (phase === 'tong-intro') {
    const currentLine = TONG_INTRO_LINES[introLineIdx] ?? '';
    const lineFinished = introCharIdx >= currentLine.length;

    const handleIntroTap = () => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      if (!lineFinished) {
        // Instant-complete the current line
        setIntroCharIdx(currentLine.length);
      } else if (introLineIdx < TONG_INTRO_LINES.length - 1) {
        // Advance to next line
        setIntroLineIdx((i) => i + 1);
        setIntroCharIdx(0);
      } else {
        // All lines done — proceed
        setPhase('proficiency');
      }
    };

    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <div className="tg-tong-intro" onClick={handleIntroTap}>
            <video
              className="tg-tong-intro-video"
              src="/assets/tong_intro.webm"
              autoPlay
              muted
              playsInline
              preload="auto"
              loop
            />
            {/* Immersive subtitle overlay — pinned to bottom like hangout dialogue */}
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
          </div>
        </div>
      </div>
    );
  }

  /* Proficiency phase */
  if (phase === 'proficiency') {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <div className="tg-proficiency">
            <p className="tg-proficiency-heading">Choose your language settings to get started</p>
            <div className="proficiency-panel">
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
              <div className="explain-in-section">
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
              <button className="tg-menu-btn-primary" onClick={handleConfirmProficiency} style={{ width: '100%', marginTop: 16 }}>
                Let&apos;s go!
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── City map handlers ────────────────────────────────────── */

  function handleMapHangout(cityId: CityId, locationId: LocationId) {
    const npcId = NPC_POOL[Math.floor(Math.random() * NPC_POOL.length)];
    const npcChar = CHARACTER_MAP[npcId] ?? HAUEN;
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
    setDynamicBackdrop(null);
    setCinematic(null);
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
      'stroke_tracing', 'matching', 'multiple_choice', 'drag_drop',
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

  const targetLang = getLanguageForCity(city);
  const explainLang = (gameState.explainIn[city] ?? 'en') as UILang;

  if (sceneSummary) {
    return (
      <UILangProvider value={explainLang}>
        <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="game-frame" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-dark)', padding: '2rem' }}>
            <div style={{ textAlign: 'center', color: 'var(--color-text)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h2 style={{ margin: '0 0 8px', color: 'var(--color-accent-gold)', fontSize: 24 }}>{t('scene_complete', explainLang)}</h2>
              <p style={{ margin: '0 0 20px', color: 'var(--color-text-muted)', fontSize: 14 }}><KoreanText text={sceneSummary.summary} targetLang={targetLang} /></p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-accent-gold)' }}>+{sceneSummary.xpEarned}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t('xp_earned', explainLang)}</div>
                </div>
                {sceneSummary.affinityChanges.map((ac) => (
                  <div key={ac.characterId}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: ac.delta > 0 ? 'var(--color-accent-green)' : '#e8485c' }}>
                      {ac.delta > 0 ? '+' : ''}{ac.delta}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {(NPC_SPRITES[ac.characterId] || NPC_SPRITES.haeun).name}
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
  const continueLabel = CONTINUE_LABELS[explainLang] ?? CONTINUE_LABELS.en;

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
          npcName={npc.name}
          npcColor={npc.color}
          npcSpriteUrl={npc.src}
          currentMessage={currentMessage}
          currentExercise={currentExercise}
          choices={choices}
          choicePrompt={choicePrompt}
          tongTip={tongTip}
          isStreaming={chatLoading}
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
            />
          }
          onChoice={handleChoice}
          onContinue={handleContinue}
          onExerciseResult={handleExerciseResult}
          onDismissTong={handleDismissTong}
        />
      </div>
    </div>
    </UILangProvider>
  );
}

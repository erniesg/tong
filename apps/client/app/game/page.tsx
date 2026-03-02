'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from 'ai/react';
import type { CityId, LocationId, ProficiencyLevel, ScoreState, UserProficiency } from '@/lib/api';
import type { SessionMessage, ToolQueueItem, SceneSummary, ExerciseData } from '@/lib/types/hangout';
import type { DialogueChoice } from '@/components/scene/ChoiceButtons';
import type { Character } from '@/lib/types/relationship';
import { SceneView } from '@/components/scene/SceneView';
import { generateExercise } from '@/lib/exercises/generators';
import { summarizeExercise } from '@/lib/utils/summarize-exercise';
import { useGameState, dispatch, getRelationship, getMasterySnapshot } from '@/lib/store/game-store';
import { CHARACTER_MAP, HAUEN } from '@/lib/content/characters';
import { POJANGMACHA } from '@/lib/content/pojangmacha';
import { getRelationshipStage } from '@/lib/types/relationship';
import { CityMap, CITY_ORDER } from '@/components/city-map/CityMap';
import { LearnPanel } from '@/components/learn/LearnPanel';
import { sessionLogger } from '@/lib/debug/session-logger';

/* ── scene constants ────────────────────────────────────── */

const NPC_SPRITES: Record<string, { name: string; nameLocal: string; src: string; color: string }> = {
  haeun: { name: 'Ha-eun', nameLocal: '하은', src: '/assets/characters/haeun/haeun.png', color: '#e8485c' },
  jin: { name: 'Jin', nameLocal: '진', src: '/assets/characters/jin/jin.png', color: '#4a90d9' },
};

const NPC_POOL = ['haeun', 'jin'] as const;

/* ── constants ──────────────────────────────────────────── */

const TONG_LINES = [
  "Hey! I'm Tong, your language buddy.",
  "I hang out in Seoul, Tokyo and Shanghai.",
  "Tell me how much you know and I'll set things up.",
];

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
  { key: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
  { key: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
  { key: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
];

const LANG_TO_CITY: Record<string, CityId> = { ko: 'seoul', ja: 'tokyo', zh: 'shanghai' };

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
};

const CHARS_PER_TICK = 2;
const TICK_MS = 30;
const PAUSE_BETWEEN_LINES_MS = 600;

/* ── types ──────────────────────────────────────────────── */

type Phase = 'intro' | 'proficiency' | 'hangout' | 'city_map' | 'learn';

/* ── helpers ────────────────────────────────────────────── */

/** Build rich context block for API messages using game store data. */
function buildContextBlock(
  level: number,
  npcId: string,
  cityId: CityId,
  locationId: LocationId,
  npcChar: Character,
): string {
  const rel = getRelationship(npcId);
  const stage = getRelationshipStage(rel.affinity);
  const mastery = getMasterySnapshot(POJANGMACHA);
  const isFirstEncounter = rel.interactionCount === 0;

  const locLevel = Math.min(level, POJANGMACHA.levels.length - 1);
  const objectives = POJANGMACHA.levels[locLevel]?.objectives ?? [];

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

  /* phase state — ?phase=hangout|city_map skips straight there */
  const phaseParam = searchParams.get('phase');
  const skipToHangout = phaseParam === 'hangout';
  const skipToCityMap = phaseParam === 'city_map';
  const [phase, setPhase] = useState<Phase>(
    skipToHangout ? 'hangout' : skipToCityMap ? 'city_map' : 'intro'
  );
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [allLinesDone, setAllLinesDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const advanceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const processingRef = useRef(false);
  const pausedRef = useRef(false);
  const processedToolCallsRef = useRef(new Set<string>());
  const lastContinueRef = useRef(0);
  const sceneStartedRef = useRef(false);

  const currentLine = TONG_LINES[lineIndex] ?? '';

  /* ── typewriter effect ────────────────────────────────── */

  useEffect(() => {
    if (allLinesDone || phase !== 'intro') return;

    setDisplayedChars(0);
    setTypewriterDone(false);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setDisplayedChars((prev) => {
        const next = prev + CHARS_PER_TICK;
        if (next >= currentLine.length) return currentLine.length;
        return next;
      });
    }, TICK_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lineIndex, allLinesDone, currentLine, phase]);

  /* detect when a line finishes typing */
  useEffect(() => {
    if (phase !== 'intro' || allLinesDone) return;
    if (displayedChars >= currentLine.length && currentLine.length > 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
      setTypewriterDone(true);
    }
  }, [displayedChars, currentLine, phase, allLinesDone]);

  /* auto-advance after line finishes */
  useEffect(() => {
    if (!typewriterDone || allLinesDone || phase !== 'intro') return;

    advanceRef.current = setTimeout(() => {
      if (lineIndex < TONG_LINES.length - 1) {
        setLineIndex((i) => i + 1);
      } else {
        setAllLinesDone(true);
        setPhase('proficiency');
      }
    }, PAUSE_BETWEEN_LINES_MS);

    return () => {
      if (advanceRef.current) clearTimeout(advanceRef.current);
    };
  }, [typewriterDone, lineIndex, allLinesDone, phase]);

  /* ── handlers ─────────────────────────────────────────── */

  function handleSkip() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advanceRef.current) clearTimeout(advanceRef.current);
    setAllLinesDone(true);
    setPhase('proficiency');
  }

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

    const startMsg = `${buildContextBlock(weakLevel, npcId, primaryCity as CityId, 'food_street', npcChar)}Start the scene.`;
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
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current);
      void append({ role: 'user', content: `${ctx}Start the scene.` });
    }
  }, [skipToHangout, append, playerLevel, activeNpc, city, location]);

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
          hintItems?: string[] | null;
          hintCount?: number | null;
          hintSubType?: string | null;
        };
        const exercise = generateExercise(args.exerciseType, {
          hintItems: args.hintItems ?? undefined,
          hintCount: args.hintCount ?? undefined,
          hintSubType: args.hintSubType ?? undefined,
          objectiveId: args.objectiveId,
        });
        setCurrentMessage(null);
        setCurrentExercise(exercise);
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
        // Non-blocking — mastery tracking handled by exercise results
        console.log('[VN] assess_result (non-blocking):', item.args);
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
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current);
      const msg = `${ctx}Continue.`;
      sessionLogger.logUserTap('continue');
      sessionLogger.logAIRequest(msg);
      void append({ role: 'user', content: msg });
    }
  }, [sceneSummary, chatLoading, tongTip, currentExercise, choices, toolQueue.length, append, playerLevel, activeNpc, city, location]);

  const handleExerciseResult = useCallback((exerciseId: string, correct: boolean) => {
    setCurrentExercise(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;

    sessionLogger.logExerciseResult(exerciseId, correct);
    dispatch({ type: 'RECORD_ITEM_RESULT', itemId: exerciseId, category: 'vocabulary', correct });

    const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current);
    const msg = `${ctx}${summarizeExercise(exerciseId, correct)}`;
    sessionLogger.logAIRequest(msg);
    void append({ role: 'user', content: msg });
  }, [append, playerLevel, activeNpc, city, location]);

  const handleChoice = useCallback((choiceId: string) => {
    setChoices(null);
    setChoicePrompt(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
    sessionLogger.logChoiceSelected(choiceId);
    const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current);
    const msg = `${ctx}Choice: ${choiceId}`;
    sessionLogger.logAIRequest(msg);
    void append({ role: 'user', content: msg });
  }, [append, playerLevel, activeNpc, city, location]);

  const handleDismissTong = useCallback(() => {
    setTongTip(null);
    if (processingRef.current) {
      // tong_whisper was blocking (exercise next) — dequeue so processor advances
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;
    } else if (!currentExercise && !choices && toolQueue.length === 0) {
      // tong_whisper was auto-advanced, nothing queued — request next turn
      const ctx = buildContextBlock(playerLevel, activeNpc, city, location, npcRef.current);
      void append({ role: 'user', content: `${ctx}Continue.` });
    }
  }, [currentExercise, choices, toolQueue.length, append, playerLevel, activeNpc, city, location]);

  /* ── renders ──────────────────────────────────────────── */

  /* Intro phase */
  if (phase === 'intro') {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <div className="game-shell">
            <div className="tong-avatar">T</div>
            <div className="dialogue-area">
              {TONG_LINES.map((line, i) => {
                if (i < lineIndex) {
                  return (
                    <div key={i} className="dialogue-line muted">
                      {line}
                    </div>
                  );
                }
                if (i === lineIndex && !allLinesDone) {
                  return (
                    <div key={i} className="dialogue-line">
                      {currentLine.slice(0, displayedChars)}
                      {displayedChars < currentLine.length && <span className="typewriter-cursor" />}
                    </div>
                  );
                }
                return null;
              })}
            </div>
            <div style={{ marginTop: 'auto', alignSelf: 'flex-end' }}>
              <button className="btn-skip" onClick={handleSkip}>
                skip
              </button>
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
          <div className="game-shell">
            <div className="tong-avatar">T</div>
            <div className="dialogue-area">
              {TONG_LINES.map((line, i) => (
                <div key={i} className={i === TONG_LINES.length - 1 ? 'dialogue-line' : 'dialogue-line muted'}>
                  {line}
                </div>
              ))}
            </div>

            <div className="proficiency-panel">
              {LANG_LABELS.map((lang, idx) => {
                const val = sliders[idx];
                const gameLvl = GAME_LEVELS[val];
                return (
                  <div key={lang.key} className="proficiency-lang">
                    <div className="proficiency-lang-header">
                      <span className="proficiency-lang-name">
                        {lang.flag} {lang.name} <span className="korean">{lang.native}</span>
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
                    <div className="proficiency-ticks">
                      {GAME_LEVELS.map((gl) => (
                        <span
                          key={gl.level}
                          className={`proficiency-tick${gl.level === val ? ' active' : ''}`}
                        >
                          <span className="proficiency-tick-dot" />
                          <span className="proficiency-tick-num">Lv.{gl.level}</span>
                        </span>
                      ))}
                    </div>
                    <div className="proficiency-level-map">
                      <span className="proficiency-level-tag">{gameLvl.name}</span>
                      <span className="proficiency-level-question">{gameLvl.desc}</span>
                    </div>
                  </div>
                );
              })}
              <button className="btn-go" onClick={handleConfirmProficiency} style={{ width: '100%', marginTop: 8 }}>
                That&apos;s me
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
    processingRef.current = false;
    pausedRef.current = false;
    processedToolCallsRef.current.clear();

    setPhase('hangout');

    const startMsg = `${buildContextBlock(level, npcId, cityId, locationId, npcChar)}Start the scene.`;
    sessionLogger.start({ mode: 'hangout', cityId, locationId, npcId, playerLevel: level });
    sessionLogger.logAIRequest(startMsg);
    void append({ role: 'user', content: startMsg });
  }

  function handleMapLearn(cityId: CityId, locationId: LocationId) {
    setCity(cityId);
    setLocation(locationId);
    setSelectedLocation(null);
    setPhase('learn');
  }

  /* ── City map phase ──────────────────────────────────────── */

  if (phase === 'city_map') {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame">
          <CityMap
            activeCityIndex={mapCityIndex}
            onCityChange={(idx) => { setMapCityIndex(idx); setSelectedLocation(null); }}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
            onStartHangout={handleMapHangout}
            onStartLearn={handleMapLearn}
            gameState={gameState}
          />
        </div>
      </div>
    );
  }

  /* ── Learn phase ─────────────────────────────────────────── */

  if (phase === 'learn') {
    return (
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
              {CITY_NAMES[city]?.en ?? 'Seoul'} &middot; {LOCATION_NAMES[location]}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LearnPanel
              cityId={city}
              locationId={location}
              userId="local"
              lang="ko"
            />
          </div>
        </div>
      </div>
    );
  }

  /* Hangout phase — immersive VN scene */
  const cityInfo = CITY_NAMES[city] || CITY_NAMES.seoul;
  const npc = NPC_SPRITES[activeNpc] || NPC_SPRITES.haeun;
  const rel = gameState.relationships[activeNpc];
  const affinity = rel?.affinity ?? 10;

  if (sceneSummary) {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="game-frame" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-dark)', padding: '2rem' }}>
          <div style={{ textAlign: 'center', color: 'var(--color-text)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--color-accent-gold)', fontSize: 24 }}>Scene Complete!</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--color-text-muted)', fontSize: 14 }}>{sceneSummary.summary}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-accent-gold)' }}>+{sceneSummary.xpEarned}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>XP earned</div>
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
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="game-frame">
        <SceneView
          backgroundUrl="/assets/backgrounds/pojangmacha.png"
          ambientDescription="A warm pojangmacha (street food tent) on a Seoul side street"
          npcName={npc.name}
          npcColor={npc.color}
          npcSpriteUrl={npc.src}
          currentMessage={currentMessage}
          currentExercise={currentExercise}
          choices={choices}
          choicePrompt={choicePrompt}
          tongTip={tongTip}
          isStreaming={chatLoading}
          hudContent={
            <div className="scene-hud">
              <div className="scene-hud-location">
                {cityInfo.en} <span className="korean">{cityInfo.local}</span>
                <span className="scene-hud-dot">&middot;</span>
                {LOCATION_NAMES[location]}
              </div>
              <div className="scene-hud-scores">
                <span className="scene-hud-score"><b>{gameState.xp}</b> XP</span>
                <span className="scene-hud-score"><b>{score.sp}</b> SP</span>
                <span className="scene-hud-score"><b>{Math.round(affinity)}</b> RP</span>
              </div>
            </div>
          }
          onChoice={handleChoice}
          onContinue={handleContinue}
          onExerciseResult={handleExerciseResult}
          onDismissTong={handleDismissTong}
        />
      </div>
    </div>
  );
}

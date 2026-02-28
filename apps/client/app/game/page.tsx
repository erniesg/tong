'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from 'ai/react';
import type { CityId, LocationId, ProficiencyLevel, ScoreState, UserProficiency } from '@/lib/api';
import type { SessionMessage, ToolQueueItem, SceneSummary, ExerciseData } from '@/lib/types/hangout';
import type { DialogueChoice } from '@/components/scene/ChoiceButtons';
import { SceneView } from '@/components/scene/SceneView';
import { generateExercise } from '@/lib/exercises/generators';
import { summarizeExercise } from '@/lib/utils/summarize-exercise';

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

/*
 * Game mastery levels (aligned with Pinpoint's 7-level system).
 * The self-assessment slider (0-3) maps to a starting calibration
 * within the full 0-6 level range used during gameplay.
 *
 *   Slider 0 → starts at Lv.0 SCRIPT
 *   Slider 1 → starts at Lv.1 PRONUNCIATION
 *   Slider 2 → starts at Lv.3 GRAMMAR
 *   Slider 3 → starts at Lv.5 CONVERSATION
 */
const GAME_LEVELS = [
  { level: 0, name: 'SCRIPT',        desc: 'Can I recognise the symbols?',       tongLangPct: 5 },
  { level: 1, name: 'PRONUNCIATION', desc: 'Can I say them correctly?',           tongLangPct: 10 },
  { level: 2, name: 'VOCABULARY',    desc: 'Do I know what they mean?',           tongLangPct: 20 },
  { level: 3, name: 'GRAMMAR',       desc: 'Can I build sentences?',              tongLangPct: 35 },
  { level: 4, name: 'SENTENCES',     desc: 'Can I express ideas?',                tongLangPct: 50 },
  { level: 5, name: 'CONVERSATION',  desc: 'Can I hold a conversation?',          tongLangPct: 70 },
  { level: 6, name: 'MASTERY',       desc: 'Can I think in this language?',       tongLangPct: 90 },
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
};

const CHARS_PER_TICK = 2;
const TICK_MS = 30;
const PAUSE_BETWEEN_LINES_MS = 600;

/* ── types ──────────────────────────────────────────────── */

type Phase = 'intro' | 'proficiency' | 'hangout';

/* ── helpers ────────────────────────────────────────────── */

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

  /* phase state — ?phase=hangout skips straight to scene */
  const skipToHangout = searchParams.get('phase') === 'hangout';
  const [phase, setPhase] = useState<Phase>(skipToHangout ? 'hangout' : 'intro');
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

    setCity(primaryCity as CityId);
    setLocation('food_street');
    setActiveNpc(NPC_POOL[Math.floor(Math.random() * NPC_POOL.length)]);
    setScore({ xp: 0, sp: 0, rp: 0 });
    setPhase('hangout');
    setLoading(false);

    void append({ role: 'user', content: 'Start the scene.' });
  }

  /* ── useChat integration (pinpoint pattern) ──────────────── */

  const { append, isLoading: chatLoading } = useChat({
    api: '/api/ai/hangout',
    maxSteps: 1,
    onResponse: () => {
      // Reset pause for each new server response
      pausedRef.current = false;
    },
    onToolCall: ({ toolCall }) => {
      const { toolName, toolCallId, args } = toolCall;
      if (processedToolCallsRef.current.has(toolCallId)) return;
      // Pause guard: drop tools after interactive ones in the same response
      if (pausedRef.current) {
        console.log(`[VN] onToolCall SKIPPED (paused): ${toolName}`);
        return;
      }
      processedToolCallsRef.current.add(toolCallId);
      console.log(`[VN] onToolCall: ${toolName}`, toolCallId);

      setToolQueue((prev) => [
        ...prev,
        { toolCallId, toolName, args: args as Record<string, unknown> },
      ]);

      // Pause ingestion of further tools after interactive ones
      if (toolName === 'show_exercise' || toolName === 'offer_choices') {
        pausedRef.current = true;
      }
    },
    onError: (err) => {
      console.error('[VN] useChat error:', err);
    },
    onFinish: (msg) => {
      console.log('[VN] onFinish:', msg.role, 'tools:', msg.toolInvocations?.length ?? 0);
    },
  });

  /* Auto-start scene when skipping to hangout */
  useEffect(() => {
    if (skipToHangout && !sceneStartedRef.current) {
      sceneStartedRef.current = true;
      void append({ role: 'user', content: 'Start the scene.' });
    }
  }, [skipToHangout, append]);

  /* ── Tool queue processor (pinpoint pattern) ──────────────
   *
   * Key design: blocking tools (npc_speak, show_exercise, offer_choices)
   * do `return` WITHOUT dequeuing — the item stays at toolQueue[0] and
   * processingRef stays true. The handler (handleContinue, handleExerciseResult,
   * handleChoice) dequeues the item and releases the lock.
   *
   * Non-blocking tools (tong_whisper, end_scene) fall through to the
   * auto-advance at the bottom which dequeues and releases.
   */
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
        console.log('[VN] npc_speak BLOCK:', args.text.slice(0, 40));
        return; // BLOCK — wait for tap
      }
      case 'tong_whisper': {
        const args = item.args as { message: string; translation?: string | null };
        setTongTip({ message: args.message, translation: args.translation ?? undefined });
        // If next item is exercise, block so player reads the tip first
        if (toolQueue.length > 1 && toolQueue[1].toolName === 'show_exercise') {
          console.log('[VN] tong_whisper BLOCK (exercise next)');
          return; // BLOCK
        }
        break; // auto-advance
      }
      case 'show_exercise': {
        const args = item.args as { exerciseType: string; objectiveId: string };
        const exercise = generateExercise(args.exerciseType);
        setCurrentMessage(null);
        setCurrentExercise(exercise);
        console.log('[VN] show_exercise BLOCK:', args.exerciseType);
        return; // BLOCK — wait for exercise completion
      }
      case 'offer_choices': {
        const args = item.args as { prompt: string; choices: { id: string; text: string }[] };
        setChoicePrompt(args.prompt);
        setChoices(args.choices);
        setCurrentMessage(null);
        console.log('[VN] offer_choices BLOCK');
        return; // BLOCK — wait for choice
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
        break; // auto-advance
      }
      default:
        break; // auto-advance
    }

    // Auto-advance: dequeue and release lock
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
  }, [toolQueue]);

  /* ── Hangout handlers ───────────────────────────────────── */

  const handleContinue = useCallback(() => {
    // Debounce: 400ms
    const now = Date.now();
    if (now - lastContinueRef.current < 400) return;
    lastContinueRef.current = now;

    // Case 1: Blocked on a tool — dequeue it and release lock
    if (processingRef.current) {
      console.log('[VN] handleContinue: dequeue blocked tool');
      setCurrentMessage(null);
      setToolQueue((prev) => prev.slice(1));
      processingRef.current = false;
      return;
    }

    // Case 2: Scene done
    if (sceneSummary) return;

    // Case 3: AI streaming
    if (chatLoading) return;

    // Case 4: Dismiss lingering tong tip
    if (tongTip) {
      setTongTip(null);
      return;
    }

    // Case 5: Queue empty, no exercise/choices — request next turn
    if (!currentExercise && !choices && toolQueue.length === 0) {
      console.log('[VN] handleContinue: append Continue');
      void append({ role: 'user', content: 'Continue.' });
    }
  }, [sceneSummary, chatLoading, tongTip, currentExercise, choices, toolQueue.length, append]);

  const handleExerciseResult = useCallback((exerciseId: string, correct: boolean) => {
    setCurrentExercise(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
    void append({ role: 'user', content: summarizeExercise(exerciseId, correct) });
  }, [append]);

  const handleChoice = useCallback((choiceId: string) => {
    setChoices(null);
    setChoicePrompt(null);
    setToolQueue((prev) => prev.slice(1));
    processingRef.current = false;
    void append({ role: 'user', content: `Choice: ${choiceId}` });
  }, [append]);

  const handleDismissTong = useCallback(() => {
    setTongTip(null);
  }, []);

  /* ── renders ──────────────────────────────────────────── */

  /* Intro phase */
  if (phase === 'intro') {
    return (
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
    );
  }

  /* Proficiency phase */
  if (phase === 'proficiency') {
    return (
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
                {/* Tick marks for each game level */}
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
                {/* Show current level description */}
                <div className="proficiency-level-map">
                  <span className="proficiency-level-tag">{gameLvl.name}</span>
                  <span className="proficiency-level-question">{gameLvl.desc}</span>
                </div>
              </div>
            );
          })}
          <button onClick={handleConfirmProficiency} style={{ marginTop: 8 }}>
            That&apos;s me
          </button>
        </div>
      </div>
    );
  }

  /* Hangout phase — immersive VN scene */
  const cityInfo = CITY_NAMES[city] || CITY_NAMES.seoul;
  const npc = NPC_SPRITES[activeNpc] || NPC_SPRITES.haeun;

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
              onClick={() => { setSceneSummary(null); setPhase('proficiency'); }}
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
                <span className="scene-hud-score"><b>{score.xp}</b> XP</span>
                <span className="scene-hud-score"><b>{score.sp}</b> SP</span>
                <span className="scene-hud-score"><b>{score.rp}</b> RP</span>
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

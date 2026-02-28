'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchObjectiveNext,
  respondHangout,
  startHangout,
  startOrResumeGame,
  type CityId,
  type LocationId,
  type ProficiencyLevel,
  type ScoreState,
  type UserProficiency,
} from '@/lib/api';

/* ── scene constants ────────────────────────────────────── */

const SCENE_BACKGROUNDS: Record<CityId, string> = {
  seoul: 'linear-gradient(170deg, #1a1428 0%, #2d1f3d 25%, #1e2a4a 50%, #0f1923 100%)',
  tokyo: 'linear-gradient(170deg, #1a0f28 0%, #2b1840 25%, #1a2848 50%, #0d1520 100%)',
  shanghai: 'linear-gradient(170deg, #281a0f 0%, #3d2b18 25%, #4a3a1e 50%, #231a0f 100%)',
};

const NPC_SPRITES: Record<string, { name: string; nameLocal: string; src: string; color: string }> = {
  haeun: { name: 'Ha-eun', nameLocal: '하은', src: '/assets/characters/haeun/haeun.png', color: '#e8485c' },
  jin: { name: 'Jin', nameLocal: '진', src: '/assets/characters/jin/jin.png', color: '#4a90d9' },
};

const TONG_SPRITE = '/assets/characters/tong/tong_cheerful.png';

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

const PROFICIENCY_LABELS: { label: string; desc: string; startLevel: number }[] = [
  { label: 'Zero',         desc: 'Never studied — start from the writing system',  startLevel: 0 },
  { label: 'Script',       desc: 'Know some characters & basic greetings',         startLevel: 1 },
  { label: 'Phrases',      desc: 'Can order food, ask simple questions',           startLevel: 3 },
  { label: 'Conversation', desc: 'Can hold a simple chat with a local',            startLevel: 5 },
];

const SLIDER_TO_LEVEL: ProficiencyLevel[] = ['none', 'beginner', 'intermediate', 'advanced'];

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

type Phase = 'intro' | 'proficiency' | 'ready' | 'hangout';

interface ChatMessage {
  speaker: 'character' | 'tong' | 'you';
  text: string;
}

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
  /* phase state */
  const [phase, setPhase] = useState<Phase>('intro');
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [allLinesDone, setAllLinesDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const advanceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* proficiency sliders (0-3 each) */
  const [sliders, setSliders] = useState<[number, number, number]>([0, 0, 0]);

  /* hangout state */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [city, setCity] = useState<CityId>('seoul');
  const [location, setLocation] = useState<LocationId>('food_street');
  const [sceneSessionId, setSceneSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [score, setScore] = useState<ScoreState>({ xp: 0, sp: 0, rp: 0 });
  const [hint, setHint] = useState('');
  const [userUtterance, setUserUtterance] = useState('');
  const [activeNpc, setActiveNpc] = useState<string>('haeun');
  const [showDialogue, setShowDialogue] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  /* auto-scroll messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  function buildProficiency(): UserProficiency {
    return {
      ko: SLIDER_TO_LEVEL[sliders[0]] ?? 'none',
      ja: SLIDER_TO_LEVEL[sliders[1]] ?? 'none',
      zh: SLIDER_TO_LEVEL[sliders[2]] ?? 'none',
    };
  }

  function handleConfirmProficiency() {
    setError('');
    setPhase('ready');
  }

  async function handleGo() {
    try {
      setLoading(true);
      setError('');
      const proficiency = buildProficiency();

      /* derive primary language (weakest) and its city */
      const weakIdx = getWeakestLangIndex(sliders);
      const primaryLang = LANG_KEYS[weakIdx] as 'ko' | 'ja' | 'zh';
      const primaryCity = LANG_TO_CITY[primaryLang] ?? 'seoul';

      const [game, objective] = await Promise.all([
        startOrResumeGame(proficiency),
        fetchObjectiveNext({ city: primaryCity, location: 'food_street', mode: 'hangout', lang: primaryLang }),
      ]);

      const assignedCity = (game.city as CityId) || primaryCity;
      setCity(assignedCity);
      setLocation('food_street');

      const hangout = await startHangout({
        objectiveId: objective.objectiveId,
        city: assignedCity,
        location: 'food_street',
        lang: primaryLang,
      });

      /* pick a random NPC for this scene */
      setActiveNpc(NPC_POOL[Math.floor(Math.random() * NPC_POOL.length)]);
      setSceneSessionId(hangout.sceneSessionId);
      setMessages([{ speaker: hangout.initialLine.speaker, text: hangout.initialLine.text }]);
      setScore(hangout.state.score);
      setHint('Stay in-character. Use the target vocabulary in your responses.');
      setShowDialogue(true);
      setPhase('hangout');
    } catch (err) {
      console.error('Failed to start hangout:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect. Check the server is running.');
    } finally {
      setLoading(false);
    }
  }

  async function sendTurn() {
    if (!sceneSessionId || !userUtterance.trim()) return;

    const utterance = userUtterance.trim();
    setUserUtterance('');
    setMessages((prev) => [...prev, { speaker: 'you', text: utterance }]);

    try {
      const response = await respondHangout(sceneSessionId, utterance);
      setMessages((prev) => [...prev, { speaker: response.nextLine.speaker, text: response.nextLine.text }]);
      setScore(response.state.score);
      setHint(response.feedback.tongHint);
    } catch (err) {
      console.error('Hangout respond error:', err);
      setMessages((prev) => [...prev, { speaker: 'tong', text: 'Something went wrong. Try sending again.' }]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendTurn();
    }
  }

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
            const prof = PROFICIENCY_LABELS[val];
            const gameLvl = GAME_LEVELS[prof.startLevel];
            return (
              <div key={lang.key} className="proficiency-lang">
                <div className="proficiency-lang-header">
                  <span className="proficiency-lang-name">
                    {lang.flag} {lang.name} <span className="korean">{lang.native}</span>
                  </span>
                  <span className="proficiency-lang-level">
                    {prof.label}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={val}
                  onChange={(e) => handleSlider(idx, Number(e.target.value))}
                  className="proficiency-slider"
                />
                {/* Tick marks showing game level mapping */}
                <div className="proficiency-ticks">
                  {PROFICIENCY_LABELS.map((p, lvl) => (
                    <span
                      key={lvl}
                      className={`proficiency-tick${lvl === val ? ' active' : ''}`}
                    >
                      <span className="proficiency-tick-dot" />
                      <span className="proficiency-tick-num">Lv.{p.startLevel}</span>
                      <span className="proficiency-tick-label">{p.label}</span>
                    </span>
                  ))}
                </div>
                {/* Show the game level this maps to */}
                <div className="proficiency-level-map">
                  <span className="proficiency-level-tag">{gameLvl.name}</span>
                  <span className="proficiency-level-question">{gameLvl.desc}</span>
                  {/* 7 dots showing the full level range */}
                  <div className="proficiency-dots">
                    {GAME_LEVELS.map((gl) => (
                      <span
                        key={gl.level}
                        className={`proficiency-dot${gl.level <= prof.startLevel ? ' filled' : ''}${gl.level === prof.startLevel ? ' current' : ''}`}
                        title={`Lv.${gl.level} ${gl.name}`}
                      />
                    ))}
                  </div>
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

  /* Ready phase */
  if (phase === 'ready') {
    const weakIdx = getWeakestLangIndex(sliders);
    const weakestLang = LANG_LABELS[weakIdx];
    const weakestLevel = sliders[weakIdx];
    const startLvl = PROFICIENCY_LABELS[weakestLevel].startLevel;
    const gameLvl = GAME_LEVELS[startLvl];
    const responses = [
      `Starting from scratch with ${weakestLang.name}? I'll teach you from the writing system up!`,
      `You know some ${weakestLang.name} script! Let's work on pronunciation next.`,
      `Solid ${weakestLang.name} phrase base! Time to build real grammar.`,
      `You can chat in ${weakestLang.name}! Let's sharpen your conversations.`,
    ];

    return (
      <div className="game-shell">
        <div className="tong-avatar">T</div>
        <div className="ready-panel">
          <p className="ready-text">{responses[weakestLevel]}</p>
          <div className="ready-level-badge">
            <span className="ready-level-num">Lv.{startLvl}</span>
            <span className="ready-level-name">{gameLvl.name}</span>
            <span className="ready-level-desc">{gameLvl.desc}</span>
          </div>
          {/* Level dots showing where you start */}
          <div className="ready-level-dots">
            {GAME_LEVELS.map((gl) => (
              <div key={gl.level} className="ready-dot-col">
                <span
                  className={`ready-dot${gl.level <= startLvl ? ' filled' : ''}${gl.level === startLvl ? ' current' : ''}`}
                />
                <span className={`ready-dot-label${gl.level === startLvl ? ' current' : ''}`}>{gl.level}</span>
              </div>
            ))}
          </div>
          {error && (
            <p style={{ color: '#c94c18', fontSize: 13, textAlign: 'center', margin: 0 }}>{error}</p>
          )}
          <button className="btn-go" onClick={() => void handleGo()} disabled={loading}>
            {loading ? 'Setting up...' : "Let's go!"}
          </button>
        </div>
      </div>
    );
  }

  /* Hangout phase — fully immersive layered scene */
  const cityInfo = CITY_NAMES[city] || CITY_NAMES.seoul;
  const npc = NPC_SPRITES[activeNpc] || NPC_SPRITES.haeun;
  const lastMessage = messages[messages.length - 1];
  const bgStyle = SCENE_BACKGROUNDS[city] || SCENE_BACKGROUNDS.seoul;

  return (
    <div className="scene-root">
      {/* Layer 0: Background */}
      <div className="scene-bg" style={{ background: bgStyle }} />
      <div className="scene-bg-gradient" />

      {/* Layer 1: Character sprite */}
      <div className="scene-character">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={npc.src} alt={npc.name} className="scene-character-img" />
      </div>

      {/* Layer 2: HUD — scores + location (top) */}
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

      {/* Layer 3: Tong whisper overlay */}
      {hint && (
        <div className="scene-tong-tip">
          <span className="scene-tong-icon">T</span>
          <div>
            <p className="scene-tong-name">Tong</p>
            <p className="scene-tong-text">{hint}</p>
          </div>
        </div>
      )}

      {/* Layer 4: Dialogue + input (bottom) */}
      <div className="scene-bottom">
        {/* Recent messages */}
        <div className="scene-dialogue-scroll" ref={messagesEndRef}>
          {messages.map((msg, i) => {
            const isUser = msg.speaker === 'you';
            const isTong = msg.speaker === 'tong';
            const speakerName = isUser ? 'You' : isTong ? 'Tong' : npc.name;
            const speakerColor = isUser ? '#f0c040' : isTong ? '#f0c040' : npc.color;
            return (
              <div key={`${msg.speaker}-${i}`} className={`scene-msg${isUser ? ' scene-msg-user' : ''}`}>
                <span className="scene-msg-name" style={{ color: speakerColor }}>{speakerName}</span>
                <span className="scene-msg-text korean">{msg.text}</span>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="scene-input-row">
          <textarea
            rows={1}
            value={userUtterance}
            placeholder="Type your response..."
            onChange={(e) => setUserUtterance(e.target.value)}
            onKeyDown={handleKeyDown}
            className="scene-input"
          />
          <button
            className="scene-send-btn"
            onClick={() => void sendTurn()}
            disabled={!sceneSessionId || !userUtterance.trim()}
          >
            &uarr;
          </button>
        </div>
      </div>
    </div>
  );
}

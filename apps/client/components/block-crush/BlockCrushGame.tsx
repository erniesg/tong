'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CompositionFrame } from './CompositionFrame';
import { FallingPiece } from './FallingPiece';
import {
  getRandomTarget,
  getDistractors,
  type CompositionTarget,
} from '@/lib/content/block-crush-data';
import { dispatch } from '@/lib/store/game-store';

/* ── TTS helper (reused from StrokeTracing pattern) ──── */

const JAMO_TO_SYLLABLE: Record<string, string> = {
  'ㄱ': '가', 'ㄴ': '나', 'ㄷ': '다', 'ㄹ': '라', 'ㅁ': '마',
  'ㅂ': '바', 'ㅅ': '사', 'ㅇ': '아', 'ㅈ': '자', 'ㅊ': '차',
  'ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하',
  'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
  'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
};

const LANG_BCP47: Record<string, string> = {
  ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN',
};

function playTTS(text: string, lang: string) {
  const ttsText = JAMO_TO_SYLLABLE[text] ?? text;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(ttsText);
  utter.lang = LANG_BCP47[lang] ?? 'ko-KR';
  utter.rate = 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

/* ── Types ───────────────────────────────────────────── */

interface FallingPieceState {
  id: string;
  piece: string;
  column: number;
  y: number;
  speed: number;
  isDistractor: boolean;
  colorHint?: string;
}

type Phase = 'menu' | 'playing' | 'gameover';
type Language = 'ko' | 'zh' | 'ja';

/* ── Constants ───────────────────────────────────────── */

const INITIAL_LIVES = 5;
const LANES = 4;
const BASE_SPEED = 0.00025;     // normalized units per ms — slow enough to read & tap
const SPAWN_INTERVAL = 2400;    // ms between spawns
const MAX_PIECES = 8;           // max simultaneous on screen
const DIFFICULTY_SPEED_MULT = [1, 1.25, 1.5];

/* ── Component ───────────────────────────────────────── */

export function BlockCrushGame() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [language, setLanguage] = useState<Language>('ko');
  const [difficulty, setDifficulty] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [currentTarget, setCurrentTarget] = useState<CompositionTarget | null>(null);
  const [filledSlots, setFilledSlots] = useState<Record<string, string | null>>({});
  const [pieces, setPieces] = useState<FallingPieceState[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [wrongSlot, setWrongSlot] = useState<string | null>(null);
  const [successChar, setSuccessChar] = useState<string | null>(null);

  // Refs for game loop
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const pieceIdRef = useRef(0);
  const piecesRef = useRef(pieces);
  const livesRef = useRef(lives);
  const targetRef = useRef(currentTarget);
  const filledSlotsRef = useRef(filledSlots);
  const difficultyRef = useRef(difficulty);

  // Sync refs
  piecesRef.current = pieces;
  livesRef.current = lives;
  targetRef.current = currentTarget;
  filledSlotsRef.current = filledSlots;
  difficultyRef.current = difficulty;

  /* ── Start a new round ─────────────────────────────── */

  const nextTarget = useCallback((lang: Language, diff: number) => {
    const target = getRandomTarget(lang, diff);
    setCurrentTarget(target);
    setFilledSlots({});
    setSelectedPieceId(null);
    setWrongSlot(null);
    setPieces([]);
    lastSpawnRef.current = 0;
  }, []);

  /* ── Start game ────────────────────────────────────── */

  const startGame = useCallback((lang: Language) => {
    setLanguage(lang);
    setDifficulty(1);
    setScore(0);
    setCombo(0);
    setLives(INITIAL_LIVES);
    setPhase('playing');
    nextTarget(lang, 1);
    lastTimeRef.current = 0;
  }, [nextTarget]);

  /* ── Spawn a new piece ─────────────────────────────── */

  const spawnPiece = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;
    if (piecesRef.current.length >= MAX_PIECES) return;

    const filled = filledSlotsRef.current;
    const unfilledComponents = target.components.filter((c) => !filled[c.slot]);

    // ~60% chance of correct piece if there are unfilled slots
    const spawnCorrect = unfilledComponents.length > 0 && Math.random() < 0.6;

    let piece: string;
    let isDistractor: boolean;
    let colorHint: string | undefined;

    if (spawnCorrect) {
      const comp = unfilledComponents[Math.floor(Math.random() * unfilledComponents.length)];
      piece = comp.piece;
      isDistractor = false;
      colorHint = comp.colorHint;
    } else {
      const correctPieces = target.components.map((c) => c.piece);
      const distractors = getDistractors(target.language, 1, correctPieces);
      piece = distractors[0] ?? correctPieces[0];
      isDistractor = !correctPieces.includes(piece);
    }

    const id = `p${pieceIdRef.current++}`;
    const column = Math.floor(Math.random() * LANES);
    const speedMult = DIFFICULTY_SPEED_MULT[difficultyRef.current - 1] ?? 1;
    const speed = BASE_SPEED * speedMult * (0.8 + Math.random() * 0.4);

    const newPiece: FallingPieceState = {
      id,
      piece,
      column,
      y: -0.05,
      speed,
      isDistractor,
      colorHint: difficultyRef.current <= 2 ? colorHint : undefined,
    };

    setPieces((prev) => [...prev, newPiece]);
  }, []);

  /* ── Game loop ─────────────────────────────────────── */

  const gameLoop = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
      lastSpawnRef.current = timestamp;
    }

    const dt = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Spawn new pieces
    if (timestamp - lastSpawnRef.current > SPAWN_INTERVAL) {
      lastSpawnRef.current = timestamp;
      spawnPiece();
    }

    // Update piece positions
    setPieces((prev) => {
      const next: FallingPieceState[] = [];
      let lostLife = false;

      for (const p of prev) {
        const newY = p.y + p.speed * dt;
        if (newY > 1.05) {
          // Piece fell off — lose a life if it was a useful piece
          if (!p.isDistractor) {
            lostLife = true;
          }
          continue;
        }
        next.push({ ...p, y: newY });
      }

      if (lostLife) {
        setLives((l) => {
          const newLives = l - 1;
          if (newLives <= 0) {
            setPhase('gameover');
          }
          return Math.max(0, newLives);
        });
      }

      return next;
    });

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [spawnPiece]);

  /* ── Start/stop game loop ──────────────────────────── */

  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, gameLoop]);

  /* ── Tap a piece ───────────────────────────────────── */

  const handlePieceTap = useCallback((id: string) => {
    setSelectedPieceId((prev) => (prev === id ? null : id));
  }, []);

  /* ── Tap a slot ────────────────────────────────────── */

  const handleSlotTap = useCallback((slotName: string) => {
    if (!selectedPieceId || !currentTarget) return;

    const piece = pieces.find((p) => p.id === selectedPieceId);
    if (!piece) return;

    // Find which component expects this slot
    const expectedComp = currentTarget.components.find((c) => c.slot === slotName);
    if (!expectedComp) return;

    // Already filled
    if (filledSlots[slotName]) return;

    if (piece.piece === expectedComp.piece) {
      // Correct placement
      const newFilled = { ...filledSlots, [slotName]: piece.piece };
      setFilledSlots(newFilled);
      setPieces((prev) => prev.filter((p) => p.id !== selectedPieceId));
      setSelectedPieceId(null);

      // Check if character is complete
      const allFilled = currentTarget.components.every((c) => newFilled[c.slot]);
      if (allFilled) {
        // Success
        const newCombo = combo + 1;
        const points = 100 * newCombo;
        setScore((s) => s + points);
        setCombo(newCombo);
        setSuccessChar(currentTarget.char);

        playTTS(currentTarget.char, currentTarget.language);

        // Record mastery
        dispatch({
          type: 'RECORD_ITEM_RESULT',
          itemId: currentTarget.char,
          category: 'script',
          correct: true,
        });

        // Auto-advance difficulty
        const newDiff = Math.min(3, Math.floor(((score + points) / 500) + 1));
        setDifficulty(newDiff);

        // Next target after brief flash
        setTimeout(() => {
          setSuccessChar(null);
          nextTarget(language, newDiff);
        }, 800);
      }
    } else {
      // Wrong piece
      setWrongSlot(slotName);
      setCombo(0);
      setTimeout(() => setWrongSlot(null), 400);
      setSelectedPieceId(null);
    }
  }, [selectedPieceId, currentTarget, pieces, filledSlots, combo, score, language, nextTarget]);

  /* ── Render: Menu ──────────────────────────────────── */

  if (phase === 'menu') {
    return (
      <div className="block-crush">
        <div className="block-crush__menu">
          <div>
            <div className="block-crush__menu-title">Block Crush</div>
            <div className="block-crush__menu-subtitle">
              Build characters from their components
            </div>
          </div>
          <div className="block-crush__lang-grid">
            <button className="block-crush__lang-btn" onClick={() => startGame('ko')}>
              <span>한</span>
              <span>Korean</span>
            </button>
            <button className="block-crush__lang-btn" onClick={() => startGame('zh')}>
              <span>中</span>
              <span>Chinese</span>
            </button>
            <button className="block-crush__lang-btn" onClick={() => startGame('ja')}>
              <span>あ</span>
              <span>Japanese</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render: Game Over ─────────────────────────────── */

  if (phase === 'gameover') {
    return (
      <div className="block-crush">
        <div className="block-crush__overlay">
          <div className="block-crush__overlay-title">Game Over</div>
          <div className="block-crush__overlay-score">Score: {score}</div>
          <div className="block-crush__overlay-score">Best combo: {combo}x</div>
          <button
            className="block-crush__btn block-crush__btn--primary"
            onClick={() => startGame(language)}
          >
            Play Again
          </button>
          <button
            className="block-crush__btn block-crush__btn--ghost"
            onClick={() => setPhase('menu')}
          >
            Menu
          </button>
        </div>
      </div>
    );
  }

  /* ── Render: Playing ───────────────────────────────── */

  // Group pieces by lane
  const laneContents: FallingPieceState[][] = Array.from({ length: LANES }, () => []);
  for (const p of pieces) {
    if (p.column >= 0 && p.column < LANES) {
      laneContents[p.column].push(p);
    }
  }

  return (
    <div className="block-crush">
      {/* HUD */}
      <div className="block-crush__hud">
        <div className="block-crush__hud-item">
          <div>
            <div className="block-crush__hud-label">Score</div>
            <div className="block-crush__hud-value">{score}</div>
          </div>
        </div>
        <div className="block-crush__hud-item">
          <div>
            <div className="block-crush__hud-label">Combo</div>
            <div className="block-crush__hud-value block-crush__hud-value--combo">
              {combo > 0 ? `${combo}x` : '-'}
            </div>
          </div>
        </div>
        <div className="block-crush__hud-item">
          <div>
            <div className="block-crush__hud-label">Lives</div>
            <div className="block-crush__hud-lives">
              {'●'.repeat(lives)}{'○'.repeat(Math.max(0, INITIAL_LIVES - lives))}
            </div>
          </div>
        </div>
      </div>

      {/* Target preview */}
      {currentTarget && (
        <div className="block-crush__target">
          <div className="block-crush__target-char">{currentTarget.char}</div>
          <div className="block-crush__target-hint">Lv.{difficulty}</div>
        </div>
      )}

      {/* Falling pieces area */}
      <div className="block-crush__lanes">
        {laneContents.map((lane, laneIdx) => (
          <div key={laneIdx} className="block-crush__lane">
            {lane.map((p) => (
              <FallingPiece
                key={p.id}
                id={p.id}
                piece={p.piece}
                y={p.y}
                selected={p.id === selectedPieceId}
                isDistractor={p.isDistractor}
                colorHint={p.colorHint}
                onTap={handlePieceTap}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Composition frame */}
      {currentTarget && (
        <CompositionFrame
          target={currentTarget}
          filledSlots={filledSlots}
          wrongSlot={wrongSlot}
          showColorHints={difficulty <= 2}
          onSlotTap={handleSlotTap}
        />
      )}

      {/* Success flash */}
      {successChar && (
        <div className="block-crush__success-flash">{successChar}</div>
      )}
    </div>
  );
}

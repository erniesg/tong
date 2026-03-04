'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlockCrushExercise, BlockCrushStage } from '@/lib/types/hangout';
import { getDistractors, getMeaning, getSlotLayout } from '@/lib/content/block-crush-data';
import { getGameState } from '@/lib/store/game-store';
import type { CityId } from '@/lib/api';
import { StrokeOrderAnimation } from './StrokeOrderAnimation';
import { CharAssemblyAnimation } from './CharAssemblyAnimation';

interface Props {
  exercise: BlockCrushExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

/* ── TTS ─────────────────────────────────────────────── */

const JAMO_TO_SYLLABLE: Record<string, string> = {
  'ㄱ': '가', 'ㄴ': '나', 'ㄷ': '다', 'ㄹ': '라', 'ㅁ': '마',
  'ㅂ': '바', 'ㅅ': '사', 'ㅇ': '아', 'ㅈ': '자', 'ㅊ': '차',
  'ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하',
};
const LANG_BCP47: Record<string, string> = { ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' };

/** Map exercise language → city for explainIn lookup */
const LANG_TO_CITY: Record<string, CityId> = { ko: 'seoul', ja: 'tokyo', zh: 'shanghai' };

function getExplainLang(exerciseLang: string): string {
  const city = LANG_TO_CITY[exerciseLang] ?? 'seoul';
  return getGameState().explainIn[city] ?? 'en';
}

function playTTS(text: string, lang: string, thenMeaning?: string) {
  const ttsText = JAMO_TO_SYLLABLE[text] ?? text;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const explainLang = getExplainLang(lang);
  setTimeout(() => {
    const utter = new SpeechSynthesisUtterance(ttsText);
    utter.lang = LANG_BCP47[lang] ?? 'ko-KR';
    utter.rate = 0.8;
    if (thenMeaning) {
      // Translate meaning to explainIn language, then TTS in that language
      const translatedMeaning = getMeaning(thenMeaning, explainLang);
      utter.onend = () => {
        setTimeout(() => {
          const meaningUtter = new SpeechSynthesisUtterance(translatedMeaning);
          meaningUtter.lang = LANG_BCP47[explainLang] ?? 'en-US';
          meaningUtter.rate = 0.85;
          window.speechSynthesis.speak(meaningUtter);
        }, 800);
      };
    }
    window.speechSynthesis.speak(utter);
  }, 50);
}

/* ── Types ───────────────────────────────────────────── */

interface FallingPiece {
  id: string;
  piece: string;
  column: number;
  y: number;
  speed: number;
  isDistractor: boolean;
  colorHint?: string;
}

/* ── Stage config ────────────────────────────────────── */

interface StageConfig {
  speedMult: number;
  distractorRate: number;
  lives: number;
  showColorHints: boolean;
  colorHintOpacity: number;
}

const STAGE_CONFIG: Record<BlockCrushStage, StageConfig> = {
  intro:       { speedMult: 0.5,  distractorRate: 0,    lives: 5, showColorHints: true,  colorHintOpacity: 1 },
  recognition: { speedMult: 1,    distractorRate: 0.4,  lives: 3, showColorHints: true,  colorHintOpacity: 0.5 },
  recall:      { speedMult: 1.2,  distractorRate: 0.6,  lives: 2, showColorHints: false, colorHintOpacity: 0 },
};

const LANES = 4;
const BASE_SPEED = 0.00015;
const SPAWN_INTERVAL = 2400;
const MAX_PIECES = 6;

/** Play a single piece's sound (short, no meaning follow-up). */
function playPieceTTS(piece: string, lang: string) {
  const ttsText = JAMO_TO_SYLLABLE[piece] ?? piece;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(ttsText);
  utter.lang = LANG_BCP47[lang] ?? 'ko-KR';
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

function isStrokeOrderSupported(char: string, language: string): boolean {
  if (language === 'zh') return true;
  if (language === 'ja') {
    // CJK Unified Ideographs range = kanji
    const code = char.codePointAt(0) ?? 0;
    return code >= 0x4E00 && code <= 0x9FFF;
  }
  return false; // Korean → always component-reveal
}

/* ── UI strings by explainIn language ───────────────────── */

const UI_STRINGS: Record<string, {
  intro: (char: string) => string;
  recall: (meaning: string) => string;
  tapToContinue: string;
  wrongTryColor: (piece: string, color: string) => string;
  wrongNotFit: (piece: string) => string;
  wrongPosition: (piece: string, slot: string) => string;
}> = {
  en: {
    intro: (c) => `Let's build ${c}! Drag each piece into its slot`,
    recall: (m) => `Build the character that means "${m}"`,
    tapToContinue: 'Tap to continue',
    wrongTryColor: (p, color) => `That's ${p} — try the ${color} one!`,
    wrongNotFit: (p) => `Not quite — ${p} doesn't fit here`,
    wrongPosition: (p, slot) => `${p} doesn't go in the ${slot} position`,
  },
  zh: {
    intro: (c) => `来组成「${c}」！把每个部分拖到对应位置`,
    recall: (m) => `组成表示"${m}"的字`,
    tapToContinue: '点击继续',
    wrongTryColor: (p, color) => `这是 ${p} — 试试${color === 'gold' ? '金色' : color === 'green' ? '绿色' : '蓝色'}的！`,
    wrongNotFit: (p) => `不太对 — ${p} 放不了这里`,
    wrongPosition: (p, slot) => `${p} 不是放在这个位置`,
  },
  ja: {
    intro: (c) => `「${c}」を作ろう！パーツをスロットにドラッグ`,
    recall: (m) => `「${m}」という意味の文字を作ろう`,
    tapToContinue: 'タップして続ける',
    wrongTryColor: (p, color) => `${p}じゃないよ — ${color === 'gold' ? '金色' : color === 'green' ? '緑' : '青'}のを試して！`,
    wrongNotFit: (p) => `ちょっと違う — ${p} はここに入らない`,
    wrongPosition: (p, slot) => `${p} はここには入らない`,
  },
  ko: {
    intro: (c) => `${c}를 만들어보자! 조각을 슬롯에 드래그하세요`,
    recall: (m) => `"${m}" 뜻의 글자를 만드세요`,
    tapToContinue: '탭하여 계속',
    wrongTryColor: (p, color) => `${p}가 아니에요 — ${color === 'gold' ? '금색' : color === 'green' ? '초록색' : '파란색'}을 시도해보세요!`,
    wrongNotFit: (p) => `아니에요 — ${p}는 여기에 맞지 않아요`,
    wrongPosition: (p, slot) => `${p}는 여기에 들어가지 않아요`,
  },
};

function getUI(lang: string) {
  return UI_STRINGS[lang] ?? UI_STRINGS.en;
}

function getPromptForStage(exercise: BlockCrushExercise, stage: BlockCrushStage, meaning: string, explainLang: string): string {
  const ui = getUI(explainLang);
  switch (stage) {
    case 'intro':
      return ui.intro(exercise.targetChar);
    case 'recall':
      return ui.recall(meaning);
    default:
      return exercise.prompt;
  }
}

function getWrongFeedback(
  stage: BlockCrushStage,
  piece: string,
  slotName: string,
  correctComp?: { piece: string; colorHint: string },
  explainLang?: string,
): string {
  const ui = getUI(explainLang ?? 'en');
  switch (stage) {
    case 'intro': {
      const hintColor = correctComp?.colorHint === '#f0c040' ? 'gold' : correctComp?.colorHint === '#4ecdc4' ? 'green' : 'blue';
      return ui.wrongTryColor(piece, hintColor);
    }
    case 'recognition':
      return ui.wrongNotFit(piece);
    case 'recall':
      return ui.wrongPosition(piece, slotName);
  }
}

export function BlockCrush({ exercise, onResult }: Props) {
  const stage: BlockCrushStage = exercise.stage ?? 'recognition';
  const cfg = STAGE_CONFIG[stage];

  const [pieces, setPieces] = useState<FallingPiece[]>([]);
  const [filledSlots, setFilledSlots] = useState<Record<string, string | null>>({});
  const [wrongSlot, setWrongSlot] = useState<string | null>(null);
  const [wrongFeedback, setWrongFeedback] = useState<{ message: string; slotKey: string } | null>(null);
  const [lives, setLives] = useState(cfg.lives);
  const [done, setDone] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);

  // Drag state — move the actual piece element via transform
  const dragId = useRef<string | null>(null);
  const dragChr = useRef('');
  const dragElRef = useRef<HTMLElement | null>(null);
  const dragStartRect = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const moveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const upRef = useRef<((e: PointerEvent) => void) | null>(null);

  // Piece element refs keyed by piece id so we can style them during drag
  const pieceElRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const pidRef = useRef(0);
  const piecesRef = useRef(pieces);
  const filledRef = useRef(filledSlots);
  const doneRef = useRef(done);

  piecesRef.current = pieces;
  filledRef.current = filledSlots;
  doneRef.current = done;

  const layout = getSlotLayout({
    char: exercise.targetChar, components: exercise.components,
    romanization: exercise.romanization, meaning: exercise.meaning,
    difficulty: exercise.difficulty, language: exercise.language,
  });

  const explainLang = getExplainLang(exercise.language);
  const localMeaning = getMeaning(exercise.meaning, explainLang);

  const ui = getUI(explainLang);
  const prompt = getPromptForStage(exercise, stage, localMeaning, explainLang);

  /* ── Spawn ─────────────────────────────────────────── */

  const spawnPiece = useCallback(() => {
    if (piecesRef.current.length >= MAX_PIECES) return;
    const unfilled = exercise.components.filter((c) => !filledRef.current[c.slot]);
    const correctRate = 1 - cfg.distractorRate;
    const spawnCorrect = unfilled.length > 0 && Math.random() < correctRate;
    let piece: string, isDistractor: boolean, colorHint: string | undefined;
    if (spawnCorrect) {
      const comp = unfilled[Math.floor(Math.random() * unfilled.length)];
      piece = comp.piece; isDistractor = false; colorHint = comp.colorHint;
    } else {
      const correctPieces = exercise.components.map((c) => c.piece);
      const distractors = getDistractors(exercise.language, 1, correctPieces);
      piece = distractors[0] ?? correctPieces[0];
      isDistractor = !correctPieces.includes(piece);
    }
    const id = `p${pidRef.current++}`;
    const column = Math.floor(Math.random() * LANES);
    const speed = BASE_SPEED * cfg.speedMult * (0.8 + Math.random() * 0.4);
    setPieces((prev) => [...prev, { id, piece, column, y: -0.08, speed, isDistractor, colorHint }]);
  }, [exercise.components, exercise.language, cfg.distractorRate, cfg.speedMult]);

  /* ── Game loop ─────────────────────────────────────── */

  const gameLoop = useCallback((ts: number) => {
    if (doneRef.current) return;
    if (lastTimeRef.current === 0) { lastTimeRef.current = ts; lastSpawnRef.current = ts; }
    const dt = ts - lastTimeRef.current;
    lastTimeRef.current = ts;
    if (ts - lastSpawnRef.current > SPAWN_INTERVAL) { lastSpawnRef.current = ts; spawnPiece(); }
    setPieces((prev) => {
      const next: FallingPiece[] = [];
      let lost = false;
      for (const p of prev) {
        const newY = p.y + p.speed * dt;
        if (newY > 1.05) { if (!p.isDistractor) lost = true; continue; }
        next.push({ ...p, y: newY });
      }
      if (lost) {
        setLives((l) => {
          const nl = l - 1;
          if (nl <= 0) { setDone(true); onResult(false, 'Ran out of lives'); }
          return Math.max(0, nl);
        });
      }
      return next;
    });
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [spawnPiece, onResult]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameLoop]);

  /* ── Success handler ──────────────────────────────── */

  const handleSuccess = useCallback(() => {
    setDone(true);
    playTTS(exercise.targetChar, exercise.language, exercise.meaning);

    if (stage === 'intro') {
      // Show detailed overlay, wait for tap
      setAnimationDone(false);
      setShowOverlay(true);
    } else if (stage === 'recognition') {
      // Brief overlay, auto-dismiss after 2s
      setAnimationDone(false);
      setShowOverlay(true);
      setTimeout(() => {
        setShowOverlay(false);
        onResult(true, `Built ${exercise.targetChar} (${exercise.romanization})`);
      }, 2000);
    } else {
      // recall: quick flash only
      setSuccessFlash(true);
      setTimeout(() => onResult(true, `Built ${exercise.targetChar} (${exercise.romanization})`), 500);
    }
  }, [exercise, stage, onResult]);

  const dismissOverlay = useCallback(() => {
    setShowOverlay(false);
    onResult(true, `Built ${exercise.targetChar} (${exercise.romanization})`);
  }, [exercise, onResult]);

  /* ── Drag handlers ──────────────────────────────────── */

  const cleanupDragListeners = useCallback(() => {
    const el = dragElRef.current;
    if (moveRef.current) {
      if (el) el.removeEventListener('pointermove', moveRef.current);
      document.removeEventListener('pointermove', moveRef.current);
      moveRef.current = null;
    }
    if (upRef.current) {
      if (el) { el.removeEventListener('pointerup', upRef.current); el.removeEventListener('pointercancel', upRef.current); }
      document.removeEventListener('pointerup', upRef.current);
      document.removeEventListener('pointercancel', upRef.current);
      upRef.current = null;
    }
    dragElRef.current = null;
  }, []);

  useEffect(() => cleanupDragListeners, [cleanupDragListeners]);

  const startDrag = useCallback((e: React.PointerEvent, p: FallingPiece) => {
    if (done) return;
    e.preventDefault();
    e.stopPropagation();

    // Play piece sound on grab (intro + recognition only)
    if (stage !== 'recall') {
      playPieceTTS(p.piece, exercise.language);
    }

    dragId.current = p.id;
    dragChr.current = p.piece;

    const pieceEl = e.currentTarget as HTMLElement;
    try { pieceEl.setPointerCapture(e.pointerId); } catch { /* ok */ }
    dragElRef.current = pieceEl;

    // Record pointer start position — we'll translate relative to this
    dragStartRect.current = { x: e.clientX, y: e.clientY };

    // Style the piece as "being dragged"
    pieceEl.style.zIndex = '100';
    pieceEl.style.boxShadow = '0 0 20px rgba(240,192,64,0.5), 0 8px 24px rgba(0,0,0,0.4)';
    pieceEl.style.border = '2px solid #f0c040';
    pieceEl.style.transition = 'none';

    setPieces((prev) => prev.map((pp) => pp.id === p.id ? { ...pp, speed: 0 } : pp));

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      // Move the actual piece element by translating relative to start
      const dx = ev.clientX - dragStartRect.current.x;
      const dy = ev.clientY - dragStartRect.current.y;
      pieceEl.style.transform = `translate(calc(-50% + ${dx}px), ${dy}px)`;
    };

    const onUp = (ev: PointerEvent) => {
      try { pieceEl.releasePointerCapture(ev.pointerId); } catch { /* ok */ }
      cleanupDragListeners();

      // Reset piece styling
      pieceEl.style.zIndex = '';
      pieceEl.style.boxShadow = '';
      pieceEl.style.border = '';
      pieceEl.style.transform = 'translateX(-50%)';
      pieceEl.style.transition = '';

      const pid = dragId.current;
      const pchr = dragChr.current;
      dragId.current = null;
      dragChr.current = '';

      if (!pid) return;

      let placed = false;
      for (const comp of exercise.components) {
        const el = slotRefs.current[comp.slot];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          if (!filledRef.current[comp.slot] && pchr === comp.piece) {
            const nf = { ...filledRef.current, [comp.slot]: pchr };
            setFilledSlots(nf);
            setPieces((prev) => prev.filter((pp) => pp.id !== pid));
            placed = true;
            if (exercise.components.every((c) => nf[c.slot])) {
              handleSuccess();
            }
          } else if (!filledRef.current[comp.slot]) {
            // Wrong piece dropped on this slot
            setWrongSlot(comp.slot);
            setTimeout(() => setWrongSlot(null), 400);

            const msg = getWrongFeedback(stage, pchr, comp.slot, comp, explainLang);
            setWrongFeedback({ message: msg, slotKey: comp.slot });
            setTimeout(() => setWrongFeedback(null), 1500);
          }
          break;
        }
      }

      if (!placed) {
        setPieces((prev) => prev.map((pp) =>
          pp.id === pid ? { ...pp, speed: BASE_SPEED * cfg.speedMult * (0.8 + Math.random() * 0.4) } : pp
        ));
      }
    };

    moveRef.current = onMove;
    upRef.current = onUp;
    // Captured element gets events on mobile; document fallback for desktop
    pieceEl.addEventListener('pointermove', onMove);
    pieceEl.addEventListener('pointerup', onUp);
    pieceEl.addEventListener('pointercancel', onUp);
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [done, exercise, handleSuccess, cleanupDragListeners, stage, cfg.speedMult]);

  /* ── Slot renderer ─────────────────────────────────── */

  // Inner slot — no border/radius of its own; the wrapper provides the unified box
  function renderSlot(slotName: string, w: number | string, h: number) {
    const comp = exercise.components.find((c) => c.slot === slotName);
    if (!comp) return null;
    const filled = filledSlots[comp.slot];
    const isWrong = wrongSlot === comp.slot;
    const color = comp.colorHint;

    // Stage-aware color hint on slots
    const slotBorderColor = cfg.showColorHints
      ? `${color}${Math.round(cfg.colorHintOpacity * 255).toString(16).padStart(2, '0')}`
      : 'transparent';

    return (
      <div
        key={comp.slot}
        ref={(el) => { slotRefs.current[comp.slot] = el; }}
        className={isWrong ? 'bc-slot--wrong-shake' : ''}
        style={{
          width: w, height: h,
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 600,
          background: filled ? `${color}cc` : 'transparent',
          color: filled ? '#fff' : 'transparent',
          transition: 'background 0.15s',
          animation: filled ? 'bc-slotGlow 0.6s ease' : 'none',
          textShadow: filled ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
          borderBottom: cfg.showColorHints ? `2px solid ${slotBorderColor}` : 'none',
        }}
      >
        {filled ?? ''}
        {/* Wrong-block feedback toast */}
        {wrongFeedback && wrongFeedback.slotKey === comp.slot && (
          <div className="bc-wrong-toast">{wrongFeedback.message}</div>
        )}
      </div>
    );
  }

  // Unified block wrapper — one rounded border around all slots
  const blockStyle: React.CSSProperties = {
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)',
  };
  // Thin inner divider between slots
  const dividerH: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,0.12)' };
  const dividerV: React.CSSProperties = { width: 1, background: 'rgba(255,255,255,0.12)', alignSelf: 'stretch' };

  /* ── Grid layouts ──────────────────────────────────── */

  const S = 52;
  const W = S * 2 + 1; // +1 for the divider

  function renderGrid() {
    switch (layout) {
      // C | V side by side
      case 'ko-cv-lr':
        return (
          <div style={{ ...blockStyle, display: 'flex', width: W }}>
            {renderSlot('C', S, S * 1.2)}
            <div style={dividerV} />
            {renderSlot('V', S, S * 1.2)}
          </div>
        );
      // C on top, V below
      case 'ko-cv-tb':
        return (
          <div style={{ ...blockStyle, display: 'flex', flexDirection: 'column', width: W }}>
            {renderSlot('C', W, S * 0.7)}
            <div style={dividerH} />
            {renderSlot('V', W, S * 0.5)}
          </div>
        );
      // C|V top, F spanning bottom
      case 'ko-cvf-lr':
        return (
          <div style={{ ...blockStyle, display: 'flex', flexDirection: 'column', width: W }}>
            <div style={{ display: 'flex' }}>
              {renderSlot('C', S, S)}
              <div style={dividerV} />
              {renderSlot('V', S, S)}
            </div>
            <div style={dividerH} />
            {renderSlot('F', W, S * 0.7)}
          </div>
        );
      // C / V / F all stacked
      case 'ko-cvf-tb':
        return (
          <div style={{ ...blockStyle, display: 'flex', flexDirection: 'column', width: W }}>
            {renderSlot('C', W, S * 0.65)}
            <div style={dividerH} />
            {renderSlot('V', W, S * 0.5)}
            <div style={dividerH} />
            {renderSlot('F', W, S * 0.55)}
          </div>
        );
      // left | right
      case 'left-right':
        return (
          <div style={{ ...blockStyle, display: 'flex', width: W }}>
            {renderSlot('left', S, S * 1.2)}
            <div style={dividerV} />
            {renderSlot('right', S, S * 1.2)}
          </div>
        );
      // top / bottom
      case 'top-bottom':
        return (
          <div style={{ ...blockStyle, display: 'flex', flexDirection: 'column', width: W * 0.75 }}>
            {renderSlot('top', W * 0.75, S)}
            <div style={dividerH} />
            {renderSlot('bottom', W * 0.75, S)}
          </div>
        );
      // base + dakuten mark
      case 'dakuten': {
        const markSlot = exercise.components.find((c) => c.slot === 'dakuten' || c.slot === 'handakuten')!.slot;
        return (
          <div style={{ ...blockStyle, display: 'flex', alignItems: 'flex-start' }}>
            {renderSlot('base', S * 1.3, S * 1.3)}
            <div style={dividerV} />
            {renderSlot(markSlot, S * 0.5, S * 0.5)}
          </div>
        );
      }
      // hiragana → katakana
      case 'convert':
        return (
          <div style={{ ...blockStyle, display: 'flex', width: W }}>
            {renderSlot('hiragana', S, S)}
            <div style={dividerV} />
            {renderSlot('convert', S, S)}
          </div>
        );
    }
  }

  /* ── Lanes ─────────────────────────────────────────── */

  const lanes: FallingPiece[][] = Array.from({ length: LANES }, () => []);
  for (const p of pieces) {
    if (p.column >= 0 && p.column < LANES) lanes[p.column].push(p);
  }

  return (
    <div className="exercise-card" style={{ padding: 0, position: 'relative', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}>
      {/* Header */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>{prompt}</span>
        <span style={{ fontSize: 13, opacity: 0.5 }}>
          {'●'.repeat(lives)}{'○'.repeat(Math.max(0, cfg.lives - lives))}
        </span>
      </div>

      {/* Lanes — overflow visible so dragged piece can escape its lane */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${LANES}, 1fr)`,
        gap: 2, height: 280, padding: '0 8px', position: 'relative', overflow: 'visible',
      }}>
        {lanes.map((lane, i) => (
          <div key={i} style={{ position: 'relative', overflow: 'visible' }}>
            {lane.map((p) => {
              // Stage-aware color hint on pieces
              const pieceBorder = cfg.showColorHints && p.colorHint
                ? `2px solid ${p.colorHint}${Math.round(cfg.colorHintOpacity * 255 * 0.33).toString(16).padStart(2, '0')}`
                : '2px solid rgba(255,255,255,0.12)';

              return (
                <div
                  key={p.id}
                  ref={(el) => { pieceElRefs.current[p.id] = el; }}
                  onPointerDown={(e) => startDrag(e, p)}
                  style={{
                    position: 'absolute', left: '50%', top: `${p.y * 100}%`,
                    width: 52, height: 52,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, borderRadius: 10, cursor: 'grab',
                    border: pieceBorder,
                    background: p.isDistractor ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                    transform: 'translateX(-50%)', touchAction: 'none', zIndex: 2,
                    userSelect: 'none', WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                  } as React.CSSProperties}
                >
                  {p.piece}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Grid frame */}
      <div style={{
        padding: '12px 16px 16px', background: 'rgba(0,0,0,0.2)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        {renderGrid()}
        {/* In recall mode, hide romanization/meaning below slots (it's the challenge) */}
        {stage !== 'recall' && (
          <div style={{ fontSize: 13, opacity: 0.4, marginTop: 2 }}>
            {exercise.romanization} — {localMeaning}
          </div>
        )}
      </div>

      {/* Success flash (recall stage only) */}
      {successFlash && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 64, animation: 'bc-successFlash 0.8s ease forwards',
          pointerEvents: 'none', zIndex: 50,
          textShadow: '0 0 40px rgba(78,205,196,0.6)',
        }}>
          {exercise.targetChar}
        </div>
      )}

      {/* Completion overlay (intro + recognition stages) */}
      {showOverlay && (
        <div
          className="bc-overlay"
          onClick={stage === 'intro' && animationDone ? dismissOverlay : undefined}
        >
          {isStrokeOrderSupported(exercise.targetChar, exercise.language) ? (
            <StrokeOrderAnimation
              character={exercise.targetChar}
              duration={stage === 'intro' ? 2000 : 1500}
              onComplete={() => setTimeout(() => setAnimationDone(true), 600)}
            />
          ) : (
            <CharAssemblyAnimation
              targetChar={exercise.targetChar}
              components={exercise.components}
              layout={layout}
              duration={stage === 'intro' ? 2000 : 1500}
              onComplete={() => setTimeout(() => setAnimationDone(true), 600)}
            />
          )}
          <div className="bc-overlay__romanization">{exercise.romanization}</div>
          <div className="bc-overlay__meaning">{localMeaning}</div>
          {stage === 'intro' && (
            <div className="bc-overlay__tap" style={{ opacity: animationDone ? 1 : 0 }}>{ui.tapToContinue}</div>
          )}
        </div>
      )}
    </div>
  );
}

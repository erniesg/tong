'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlockCrushExercise } from '@/lib/types/hangout';
import { getDistractors, getSlotLayout } from '@/lib/content/block-crush-data';

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
const LANG_BCP47: Record<string, string> = { ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN' };

function playTTS(text: string, lang: string) {
  const ttsText = JAMO_TO_SYLLABLE[text] ?? text;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const utter = new SpeechSynthesisUtterance(ttsText);
    utter.lang = LANG_BCP47[lang] ?? 'ko-KR';
    utter.rate = 0.8;
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

const LANES = 4;
const BASE_SPEED = 0.00015;
const SPAWN_INTERVAL = 2400;
const MAX_PIECES = 6;
const LIVES = 3;

export function BlockCrush({ exercise, onResult }: Props) {
  const [pieces, setPieces] = useState<FallingPiece[]>([]);
  const [filledSlots, setFilledSlots] = useState<Record<string, string | null>>({});
  const [wrongSlot, setWrongSlot] = useState<string | null>(null);
  const [lives, setLives] = useState(LIVES);
  const [done, setDone] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

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

  /* ── Spawn ─────────────────────────────────────────── */

  const spawnPiece = useCallback(() => {
    if (piecesRef.current.length >= MAX_PIECES) return;
    const unfilled = exercise.components.filter((c) => !filledRef.current[c.slot]);
    const spawnCorrect = unfilled.length > 0 && Math.random() < 0.6;
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
    const speed = BASE_SPEED * (0.8 + Math.random() * 0.4);
    setPieces((prev) => [...prev, { id, piece, column, y: -0.08, speed, isDistractor, colorHint }]);
  }, [exercise.components, exercise.language]);

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
              setDone(true);
              setSuccessFlash(true);
              playTTS(exercise.targetChar, exercise.language);
              setTimeout(() => onResult(true, `Built ${exercise.targetChar} (${exercise.romanization})`), 1200);
            }
          } else if (!filledRef.current[comp.slot]) {
            setWrongSlot(comp.slot);
            setTimeout(() => setWrongSlot(null), 400);
          }
          break;
        }
      }

      if (!placed) {
        setPieces((prev) => prev.map((pp) =>
          pp.id === pid ? { ...pp, speed: BASE_SPEED * (0.8 + Math.random() * 0.4) } : pp
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
  }, [done, exercise, onResult, cleanupDragListeners]);

  /* ── Slot renderer ─────────────────────────────────── */

  function renderSlot(slotName: string, w: number | string, h: number) {
    const comp = exercise.components.find((c) => c.slot === slotName);
    if (!comp) return null;
    const filled = filledSlots[comp.slot];
    const isWrong = wrongSlot === comp.slot;
    const color = comp.colorHint;

    return (
      <div
        key={comp.slot}
        ref={(el) => { slotRefs.current[comp.slot] = el; }}
        style={{
          width: w, height: h,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 600, borderRadius: 3,
          background: filled ? `${color}cc` : `${color}15`,
          border: filled ? `2px solid ${color}` : `2px solid ${color}33`,
          color: filled ? '#fff' : 'transparent',
          transition: 'background 0.15s',
          animation: isWrong ? 'bc-slotWrong 0.4s ease' : filled ? 'bc-slotGlow 0.6s ease' : 'none',
          textShadow: filled ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {filled ?? ''}
      </div>
    );
  }

  /* ── Grid layouts ──────────────────────────────────── */

  const S = 52;
  const G = 2;
  const W = S * 2 + G;

  function renderGrid() {
    switch (layout) {
      case 'ko-cv-lr':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: G, width: W }}>
            {renderSlot('C', S, S * 1.2)}
            {renderSlot('V', S, S * 1.2)}
          </div>
        );
      case 'ko-cv-tb':
        return (
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: G, width: W }}>
            {renderSlot('C', W, S * 0.7)}
            {renderSlot('V', W, S * 0.5)}
          </div>
        );
      case 'ko-cvf-lr':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr auto', gap: G, width: W }}>
            {renderSlot('C', S, S)}
            {renderSlot('V', S, S)}
            <div style={{ gridColumn: '1 / -1' }}>
              {renderSlot('F', W, S * 0.7)}
            </div>
          </div>
        );
      case 'ko-cvf-tb':
        return (
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto auto', gap: G, width: W }}>
            {renderSlot('C', W, S * 0.65)}
            {renderSlot('V', W, S * 0.5)}
            {renderSlot('F', W, S * 0.55)}
          </div>
        );
      case 'left-right':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: G, width: W }}>
            {renderSlot('left', S, S * 1.2)}
            {renderSlot('right', S, S * 1.2)}
          </div>
        );
      case 'top-bottom':
        return (
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: G, width: W * 0.75 }}>
            {renderSlot('top', W * 0.75, S)}
            {renderSlot('bottom', W * 0.75, S)}
          </div>
        );
      case 'dakuten': {
        const markSlot = exercise.components.find((c) => c.slot === 'dakuten' || c.slot === 'handakuten')!.slot;
        return (
          <div style={{ display: 'flex', gap: G, alignItems: 'flex-start' }}>
            {renderSlot('base', S * 1.3, S * 1.3)}
            {renderSlot(markSlot, S * 0.5, S * 0.5)}
          </div>
        );
      }
      case 'convert':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: G, width: W }}>
            {renderSlot('hiragana', S, S)}
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
        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>{exercise.prompt}</span>
        <span style={{ fontSize: 13, opacity: 0.5 }}>
          {'●'.repeat(lives)}{'○'.repeat(Math.max(0, LIVES - lives))}
        </span>
      </div>

      {/* Lanes — overflow visible so dragged piece can escape its lane */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${LANES}, 1fr)`,
        gap: 2, height: 280, padding: '0 8px', position: 'relative', overflow: 'visible',
      }}>
        {lanes.map((lane, i) => (
          <div key={i} style={{ position: 'relative', overflow: 'visible' }}>
            {lane.map((p) => (
              <div
                key={p.id}
                ref={(el) => { pieceElRefs.current[p.id] = el; }}
                onPointerDown={(e) => startDrag(e, p)}
                style={{
                  position: 'absolute', left: '50%', top: `${p.y * 100}%`,
                  width: 52, height: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, borderRadius: 10, cursor: 'grab',
                  border: p.colorHint ? `2px solid ${p.colorHint}55` : '2px solid rgba(255,255,255,0.12)',
                  background: p.isDistractor ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                  transform: 'translateX(-50%)', touchAction: 'none', zIndex: 2,
                  userSelect: 'none', WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                } as React.CSSProperties}
              >
                {p.piece}
              </div>
            ))}
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
        <div style={{ fontSize: 13, opacity: 0.4, marginTop: 2 }}>
          {exercise.romanization} — {exercise.meaning}
        </div>
      </div>

      {/* Success flash */}
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
    </div>
  );
}

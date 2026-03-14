'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { StrokeTracingExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';
import { getMeaning } from '@/lib/content/block-crush-data';

interface Props {
  exercise: StrokeTracingExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const BRUSH_MIN = 2;
const BRUSH_MAX = 5;
const VELOCITY_CAP = 8;
const PASS_THRESHOLD = 0.80;
const ALPHA_THRESHOLD = 30;
const GOLD_COLOR = '#f0c040';
const CANVAS_FONT_FAMILY = "'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', sans-serif";

/** Map bare jamo to their full Korean names for TTS. */
const JAMO_TO_SYLLABLE: Record<string, string> = {
  '\u3131': '\uAE30\uC5ED', '\u3134': '\uB2C8\uC740', '\u3137': '\uB514\uADCF', '\u3139': '\uB9AC\uC744', '\u3141': '\uBBF8\uC74C',
  '\u3142': '\uBE44\uC74D', '\u3145': '\uC2DC\uC637', '\u3147': '\uC774\uC751', '\u3148': '\uC9C0\uC74F', '\u314A': '\uCE58\uC74F',
  '\u314B': '\uD0A4\uC74D', '\u314C': '\uD2F0\uC74D', '\u314D': '\uD53C\uC74D', '\u314E': '\uD788\uC74F',
  '\u314F': '\uC544', '\u3151': '\uC57C', '\u3153': '\uC5B4', '\u3155': '\uC5EC', '\u3157': '\uC624',
  '\u3159': '\uC694', '\u315C': '\uC6B0', '\u315E': '\uC720', '\u3161': '\uC73C', '\u3163': '\uC774',
};

const LANG_TO_BCP47: Record<string, string> = {
  ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN',
};

function playTTS(text: string, language?: string, thenMeaning?: string, meaningLang?: string) {
  const ttsText = JAMO_TO_SYLLABLE[text] ?? text;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(ttsText);
  utter.lang = LANG_TO_BCP47[language ?? 'ko'] ?? 'ko-KR';
  utter.rate = 0.8;
  window.speechSynthesis.cancel();
  if (thenMeaning && meaningLang) {
    utter.onend = () => {
      setTimeout(() => {
        const meaningUtter = new SpeechSynthesisUtterance(thenMeaning);
        meaningUtter.lang = LANG_TO_BCP47[meaningLang] ?? 'en-US';
        meaningUtter.rate = 0.85;
        window.speechSynthesis.speak(meaningUtter);
      }, 500);
    };
  }
  window.speechSynthesis.speak(utter);
}

/* ── Single cell canvas logic ─────────────────────────────── */

interface CellState {
  done: boolean;
  score: number;
}

interface CellCanvasProps {
  targetChar: string;
  ghostOpacity: number;
  cellIndex: number;
  active: boolean;
  cellState: CellState;
  onPass: (score: number) => void;
  onFail: () => void;
}

function CellCanvas({ targetChar, ghostOpacity, cellIndex, active, cellState, onPass, onFail }: CellCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const revealCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const prevPointRef = useRef<Point | null>(null);
  const prevTimeRef = useRef(0);
  const curBrushRef = useRef(BRUSH_MAX);
  const dprRef = useRef(2);
  const cssSizeRef = useRef({ w: 0, h: 0 });

  const guideColor = `rgba(100, 120, 150, ${ghostOpacity})`;

  const drawChar = useCallback((ctx: CanvasRenderingContext2D, color: string, cssW: number) => {
    ctx.save();
    ctx.font = `${cssW * 0.7}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(targetChar, cssW / 2, cssW / 2);
    ctx.restore();
  }, [targetChar]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const revealCanvas = revealCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !revealCanvas || !tempCanvas) return;

    const ctx = canvas.getContext('2d');
    const tempCtx = tempCanvas.getContext('2d');
    if (!ctx || !tempCtx) return;

    const dpr = dprRef.current;
    const { w: cssW } = cssSizeRef.current;
    const pxW = cssW * dpr;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxW);
    ctx.restore();

    if (ghostOpacity > 0.01) {
      drawChar(ctx, guideColor, cssW);
    }

    tempCtx.save();
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    tempCtx.clearRect(0, 0, pxW, pxW);
    tempCtx.restore();

    drawChar(tempCtx, GOLD_COLOR, cssW);

    tempCtx.save();
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(revealCanvas, 0, 0);
    tempCtx.restore();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
  }, [drawChar, ghostOpacity, guideColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    dprRef.current = dpr;
    const size = rect.width;
    cssSizeRef.current = { w: size, h: size };

    const px = size * dpr;

    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const refCanvas = document.createElement('canvas');
    refCanvas.width = px;
    refCanvas.height = px;
    const refCtx = refCanvas.getContext('2d');
    if (refCtx) {
      refCtx.scale(dpr, dpr);
      refCtx.font = `${size * 0.7}px ${CANVAS_FONT_FAMILY}`;
      refCtx.textAlign = 'center';
      refCtx.textBaseline = 'middle';
      refCtx.fillStyle = 'white';
      refCtx.fillText(targetChar, size / 2, size / 2);
    }
    refCanvasRef.current = refCanvas;

    const revealCanvas = document.createElement('canvas');
    revealCanvas.width = px;
    revealCanvas.height = px;
    revealCanvasRef.current = revealCanvas;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = px;
    tempCanvas.height = px;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) tempCtx.scale(dpr, dpr);
    tempCanvasRef.current = tempCanvas;

    drawScene();
  }, [targetChar, drawScene]);

  const getPoint = useCallback((e: React.TouchEvent | React.MouseEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const stampCircle = useCallback((revealCtx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    const dpr = dprRef.current;
    revealCtx.beginPath();
    revealCtx.arc(x * dpr, y * dpr, radius * dpr, 0, Math.PI * 2);
    revealCtx.fill();
  }, []);

  const revealStroke = useCallback((from: Point | null, to: Point, now: number) => {
    const revealCanvas = revealCanvasRef.current;
    if (!revealCanvas) return;
    const revealCtx = revealCanvas.getContext('2d');
    if (!revealCtx) return;

    let radius = BRUSH_MAX;
    if (from) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = Math.max(now - prevTimeRef.current, 1);
      const velocity = dist / dt;
      const f = Math.min(velocity / VELOCITY_CAP, 1);
      const target = BRUSH_MAX - f * (BRUSH_MAX - BRUSH_MIN);
      radius = curBrushRef.current + (target - curBrushRef.current) * 0.4;
    }
    curBrushRef.current = radius;

    revealCtx.save();
    revealCtx.setTransform(1, 0, 0, 1, 0, 0);
    revealCtx.fillStyle = 'white';

    if (!from) {
      stampCircle(revealCtx, to.x, to.y, radius);
    } else {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = Math.max(radius * 0.4, 1);
      const steps = Math.max(Math.ceil(dist / step), 1);
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        stampCircle(revealCtx, from.x + dx * frac, from.y + dy * frac, radius);
      }
    }

    revealCtx.restore();
    drawScene();
  }, [drawScene, stampCircle]);

  const computeScore = useCallback((): number => {
    const refCanvas = refCanvasRef.current;
    const revealCanvas = revealCanvasRef.current;
    if (!refCanvas || !revealCanvas) return 0;

    const w = refCanvas.width;
    const h = refCanvas.height;
    const refCtx = refCanvas.getContext('2d');
    const revealCtx = revealCanvas.getContext('2d');
    if (!refCtx || !revealCtx) return 0;

    const refData = refCtx.getImageData(0, 0, w, h).data;
    const revealData = revealCtx.getImageData(0, 0, w, h).data;

    let refPixels = 0;
    let revealedPixels = 0;

    for (let i = 0; i < refData.length; i += 4) {
      if (refData[i + 3] > ALPHA_THRESHOLD) {
        refPixels++;
        if (revealData[i + 3] > ALPHA_THRESHOLD) revealedPixels++;
      }
    }

    return refPixels === 0 ? 0 : revealedPixels / refPixels;
  }, []);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!active || cellState.done) return;
    e.preventDefault();
    e.stopPropagation();
    setDrawing(true);
    setHasDrawn(true);
    const pt = getPoint(e);
    if (pt) {
      const now = performance.now();
      prevPointRef.current = pt;
      prevTimeRef.current = now;
      curBrushRef.current = BRUSH_MAX;
      revealStroke(null, pt, now);
    }
  }, [active, cellState.done, getPoint, revealStroke]);

  const moveDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing || !active || cellState.done) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getPoint(e);
    if (!pt) return;
    const now = performance.now();
    revealStroke(prevPointRef.current, pt, now);
    prevPointRef.current = pt;
    prevTimeRef.current = now;
  }, [drawing, active, cellState.done, getPoint, revealStroke]);

  const endDraw = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);
    prevPointRef.current = null;

    // Auto-submit on pen-up if user has drawn
    if (hasDrawn && active && !cellState.done) {
      const score = computeScore();
      if (score >= PASS_THRESHOLD) {
        onPass(score);
      } else if (score > 0.15) {
        // Some effort but not enough — let them keep going
      } else {
        // Barely drew anything — ignore
      }
    }
  }, [drawing, hasDrawn, active, cellState.done, computeScore, onPass]);

  const borderColor = cellState.done
    ? 'rgba(240, 192, 64, 0.4)'
    : active
      ? 'rgba(255,255,255,0.3)'
      : 'rgba(255,255,255,0.08)';

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 8,
        border: `1.5px solid ${borderColor}`,
        background: active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        overflow: 'hidden',
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          touchAction: active && !cellState.done ? 'none' : 'auto',
          cursor: active && !cellState.done ? 'crosshair' : 'default',
          pointerEvents: active && !cellState.done ? 'auto' : 'none',
        }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />
      {cellState.done && (
        <div style={{
          position: 'absolute',
          bottom: 2,
          right: 4,
          fontSize: 10,
          opacity: 0.4,
          color: GOLD_COLOR,
        }}>
          {Math.round(cellState.score * 100)}%
        </div>
      )}
      {/* Cell number */}
      <div style={{
        position: 'absolute',
        top: 2,
        left: 4,
        fontSize: 9,
        opacity: 0.2,
      }}>
        {cellIndex + 1}
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */

export function StrokeTracing({ exercise, onResult }: Props) {
  const lang = useUILang();
  const totalReps = exercise.reps ?? 1;
  const isDrill = totalReps > 1;
  const ttsLang = exercise.language ?? 'ko';

  // Single-trace mode refs (only used when totalReps === 1)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const revealCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPointRef = useRef<Point | null>(null);
  const prevTimeRef = useRef(0);
  const curBrushRef = useRef(BRUSH_MAX);
  const dprRef = useRef(2);
  const cssSizeRef = useRef({ w: 0, h: 0 });

  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; score: number } | null>(null);

  // Drill mode state
  const [cellStates, setCellStates] = useState<CellState[]>(
    () => Array.from({ length: totalReps }, () => ({ done: false, score: 0 })),
  );
  const [activeCell, setActiveCell] = useState(0);
  const allDone = isDrill && cellStates.every((c) => c.done);
  const drillCompletedRef = useRef(false);

  /** Ghost opacity per cell in drill mode — always keeps a faint guide visible. */
  const cellGhostOpacity = useCallback((idx: number) => {
    if (totalReps <= 1) return 0.35;
    const progress = idx / (totalReps - 1);
    return Math.max(0.10, 0.35 * (1 - progress));
  }, [totalReps]);

  const handleCellPass = useCallback((cellIdx: number, score: number) => {
    setCellStates((prev) => {
      const next = [...prev];
      next[cellIdx] = { done: true, score };
      return next;
    });
    // Play TTS — prefer jamo mapping over AI-provided sound
    const ttsChar = JAMO_TO_SYLLABLE[exercise.targetChar] ? exercise.targetChar : (exercise.sound ?? exercise.targetChar);
    playTTS(ttsChar, ttsLang);
    // Advance to next cell
    if (cellIdx < totalReps - 1) {
      setActiveCell(cellIdx + 1);
    }
  }, [totalReps, exercise.sound, exercise.targetChar, ttsLang]);

  // Detect all-done for drill — play TTS but do NOT call onResult yet (wait for user tap)
  useEffect(() => {
    if (drillCompletedRef.current) return;
    if (isDrill && cellStates.every((c) => c.done)) {
      drillCompletedRef.current = true;
      const ttsChar = JAMO_TO_SYLLABLE[exercise.targetChar] ? exercise.targetChar : (exercise.sound ?? exercise.targetChar);
      if (exercise.meaning) {
        const localMeaning = getMeaning(exercise.meaning, lang, exercise.targetChar);
        playTTS(ttsChar, ttsLang, localMeaning, lang);
      } else {
        playTTS(ttsChar, ttsLang);
      }
    }
  }, [cellStates, isDrill, exercise, ttsLang, lang]);

  /* ── Single-trace mode (original) ─────────────────────────── */

  const drawChar = useCallback((ctx: CanvasRenderingContext2D, color: string, cssW: number) => {
    ctx.save();
    ctx.font = `${cssW * 0.7}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(exercise.targetChar, cssW / 2, cssW / 2);
    ctx.restore();
  }, [exercise.targetChar]);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const revealCanvas = revealCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !revealCanvas || !tempCanvas) return;
    const ctx = canvas.getContext('2d');
    const tempCtx = tempCanvas.getContext('2d');
    if (!ctx || !tempCtx) return;
    const dpr = dprRef.current;
    const { w: cssW } = cssSizeRef.current;
    const pxW = cssW * dpr;

    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, pxW, pxW); ctx.restore();
    drawChar(ctx, 'rgba(100, 120, 150, 0.35)', cssW);

    tempCtx.save(); tempCtx.setTransform(1, 0, 0, 1, 0, 0); tempCtx.clearRect(0, 0, pxW, pxW); tempCtx.restore();
    drawChar(tempCtx, GOLD_COLOR, cssW);
    tempCtx.save(); tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(revealCanvas, 0, 0);
    tempCtx.restore();

    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(tempCanvas, 0, 0); ctx.restore();
  }, [drawChar]);

  useEffect(() => {
    if (isDrill) return; // Skip for drill mode
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    dprRef.current = dpr;
    cssSizeRef.current = { w: rect.width, h: rect.height };
    const pxW = rect.width * dpr;
    const pxH = rect.height * dpr;

    canvas.width = pxW; canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const refCanvas = document.createElement('canvas');
    refCanvas.width = pxW; refCanvas.height = pxH;
    const refCtx = refCanvas.getContext('2d');
    if (refCtx) {
      refCtx.scale(dpr, dpr);
      refCtx.font = `${rect.width * 0.7}px ${CANVAS_FONT_FAMILY}`;
      refCtx.textAlign = 'center'; refCtx.textBaseline = 'middle';
      refCtx.fillStyle = 'white';
      refCtx.fillText(exercise.targetChar, rect.width / 2, rect.height / 2);
    }
    refCanvasRef.current = refCanvas;

    const revealCanvas = document.createElement('canvas');
    revealCanvas.width = pxW; revealCanvas.height = pxH;
    revealCanvasRef.current = revealCanvas;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pxW; tempCanvas.height = pxH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) tempCtx.scale(dpr, dpr);
    tempCanvasRef.current = tempCanvas;

    drawScene();
  }, [exercise.targetChar, drawScene, isDrill]);

  const getPoint = useCallback((e: React.TouchEvent | React.MouseEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const stampCircle = useCallback((revealCtx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    const dpr = dprRef.current;
    revealCtx.beginPath();
    revealCtx.arc(x * dpr, y * dpr, radius * dpr, 0, Math.PI * 2);
    revealCtx.fill();
  }, []);

  const revealStroke = useCallback((from: Point | null, to: Point, now: number) => {
    const revealCanvas = revealCanvasRef.current;
    if (!revealCanvas) return;
    const revealCtx = revealCanvas.getContext('2d');
    if (!revealCtx) return;

    let radius = BRUSH_MAX;
    if (from) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = Math.max(now - prevTimeRef.current, 1);
      const velocity = dist / dt;
      const f = Math.min(velocity / VELOCITY_CAP, 1);
      const target = BRUSH_MAX - f * (BRUSH_MAX - BRUSH_MIN);
      radius = curBrushRef.current + (target - curBrushRef.current) * 0.4;
    }
    curBrushRef.current = radius;

    revealCtx.save(); revealCtx.setTransform(1, 0, 0, 1, 0, 0); revealCtx.fillStyle = 'white';
    if (!from) {
      stampCircle(revealCtx, to.x, to.y, radius);
    } else {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = Math.max(radius * 0.4, 1);
      const steps = Math.max(Math.ceil(dist / step), 1);
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        stampCircle(revealCtx, from.x + dx * frac, from.y + dy * frac, radius);
      }
    }
    revealCtx.restore();
    drawScene();
  }, [drawScene, stampCircle]);

  const startDraw_single = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (submitted) return;
    e.preventDefault();
    setDrawing(true); setHasDrawn(true);
    const pt = getPoint(e);
    if (pt) {
      const now = performance.now();
      prevPointRef.current = pt; prevTimeRef.current = now;
      curBrushRef.current = BRUSH_MAX;
      revealStroke(null, pt, now);
    }
  }, [getPoint, submitted, revealStroke]);

  const draw_single = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing || submitted) return;
    e.preventDefault();
    const pt = getPoint(e);
    if (!pt) return;
    const now = performance.now();
    revealStroke(prevPointRef.current, pt, now);
    prevPointRef.current = pt; prevTimeRef.current = now;
  }, [drawing, getPoint, submitted, revealStroke]);

  const endDraw_single = useCallback(() => {
    setDrawing(false); prevPointRef.current = null;
  }, []);

  const computeScore_single = useCallback((): number => {
    const refCanvas = refCanvasRef.current;
    const revealCanvas = revealCanvasRef.current;
    if (!refCanvas || !revealCanvas) return 0;
    const w = refCanvas.width; const h = refCanvas.height;
    const refCtx = refCanvas.getContext('2d');
    const revealCtx = revealCanvas.getContext('2d');
    if (!refCtx || !revealCtx) return 0;
    const refData = refCtx.getImageData(0, 0, w, h).data;
    const revealData = revealCtx.getImageData(0, 0, w, h).data;
    let refPixels = 0; let revealedPixels = 0;
    for (let i = 0; i < refData.length; i += 4) {
      if (refData[i + 3] > ALPHA_THRESHOLD) {
        refPixels++;
        if (revealData[i + 3] > ALPHA_THRESHOLD) revealedPixels++;
      }
    }
    return refPixels === 0 ? 0 : revealedPixels / refPixels;
  }, []);

  const handleSubmit_single = useCallback(() => {
    if (!hasDrawn || submitted) return;
    setSubmitted(true);
    const score = computeScore_single();
    const correct = score >= PASS_THRESHOLD;
    const ttsChar = JAMO_TO_SYLLABLE[exercise.targetChar] ? exercise.targetChar : (exercise.sound ?? exercise.targetChar);
    if (correct && exercise.meaning) {
      const localMeaning = getMeaning(exercise.meaning, lang, exercise.targetChar);
      playTTS(ttsChar, ttsLang, localMeaning, lang);
    } else if (correct) {
      playTTS(ttsChar, ttsLang);
    }
    setResult({ correct, score });
    onResult(correct, `${Math.round(score * 100)}% coverage`);
  }, [hasDrawn, submitted, computeScore_single, onResult, exercise, ttsLang, lang]);

  const handleClear_single = useCallback(() => {
    if (submitted) return;
    const revealCanvas = revealCanvasRef.current;
    if (revealCanvas) {
      const revealCtx = revealCanvas.getContext('2d');
      if (revealCtx) {
        revealCtx.save(); revealCtx.setTransform(1, 0, 0, 1, 0, 0);
        revealCtx.clearRect(0, 0, revealCanvas.width, revealCanvas.height);
        revealCtx.restore();
      }
    }
    prevPointRef.current = null; setHasDrawn(false);
    drawScene();
  }, [submitted, drawScene]);

  /* ── Render ───────────────────────────────────────────────── */

  // Determine grid columns based on total reps
  const cols = totalReps <= 4 ? 2 : totalReps <= 9 ? 3 : 4;

  return (
    <div className="exercise-card p-5">
      <p className="text-[length:var(--game-text-lg)] font-medium mb-3 text-ko m-0">{exercise.prompt}</p>

      {/* Target character + romanization + sound */}
      <div style={{ textAlign: 'center', marginBottom: isDrill ? 8 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: isDrill ? 36 : 48, opacity: 0.6 }} className="text-ko">
            {exercise.targetChar}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); const c = JAMO_TO_SYLLABLE[exercise.targetChar] ? exercise.targetChar : (exercise.sound ?? exercise.targetChar); playTTS(c, ttsLang); }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 44,
              height: 44,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Play sound"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </button>
        </div>
        {exercise.romanization && (
          <div style={{ fontSize: 'var(--game-text-base)', opacity: 0.5, marginTop: 2 }}>
            {exercise.romanization}
          </div>
        )}
        {exercise.meaning && exercise.meaning !== exercise.romanization && (
          <div style={{ fontSize: 'var(--game-text-sm)', opacity: 0.4, marginTop: 1 }}>
            {getMeaning(exercise.meaning, lang, exercise.targetChar)}
          </div>
        )}
      </div>

      {isDrill ? (
        /* ── Drill mode: grid of mini canvases ────────────────── */
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 6,
              maxWidth: 360,
              margin: '0 auto',
            }}
          >
            {cellStates.map((cell, i) => (
              <div key={i} style={{ width: `calc(${100 / cols}% - ${6 * (cols - 1) / cols}px)` }}>
                <CellCanvas
                  targetChar={exercise.targetChar}
                  ghostOpacity={cellGhostOpacity(i)}
                  cellIndex={i}
                  active={i === activeCell}
                  cellState={cell}
                  onPass={(score) => handleCellPass(i, score)}
                  onFail={() => {}}
                />
              </div>
            ))}
          </div>

          {/* Freehand hint */}
          {cellGhostOpacity(activeCell) <= 0.01 && !allDone && (
            <div style={{ textAlign: 'center', fontSize: 'var(--game-text-sm)', opacity: 0.5, marginTop: 8 }}>
              {t('stroke_freehand', lang)}
            </div>
          )}

          {/* Drill progress */}
          <div style={{ textAlign: 'center', fontSize: 'var(--game-text-xs)', opacity: 0.3, marginTop: 8 }}>
            {cellStates.filter((c) => c.done).length}/{totalReps}
          </div>

          {allDone && (
            <div
              className="mt-3 rounded-lg px-4 py-3 text-center text-[length:var(--game-text-base)] bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]"
              onClick={() => {
                const avgScore = cellStates.reduce((a, c) => a + c.score, 0) / cellStates.length;
                onResult(true, `${totalReps} reps, avg ${Math.round(avgScore * 100)}%`);
              }}
              style={{ cursor: 'pointer' }}
            >
              {t('stroke_drill_done', lang)}
              {exercise.meaning && (
                <div className="mt-1 text-[length:var(--game-text-base)] font-semibold" style={{ color: 'var(--color-accent-gold, #f0c040)' }}>
                  {exercise.targetChar} = {getMeaning(exercise.meaning, lang, exercise.targetChar)}
                </div>
              )}
              <div className="mt-1 text-[length:var(--game-text-sm)] opacity-70">
                {totalReps} reps &middot; avg {Math.round(cellStates.reduce((a, c) => a + c.score, 0) / cellStates.length * 100)}%
              </div>
              <div className="scene-continue-label animate-pulse" style={{ marginTop: 8 }}>
                {t('tap_to_continue', lang)}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Single-trace mode (original) ─────────────────────── */
        <>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1', maxWidth: 280, margin: '0 auto' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(255,255,255,0.1)',
                touchAction: submitted ? 'auto' : 'none',
                cursor: submitted ? 'default' : 'crosshair',
                pointerEvents: submitted ? 'none' : 'auto',
              }}
              onMouseDown={startDraw_single}
              onMouseMove={draw_single}
              onMouseUp={endDraw_single}
              onMouseLeave={endDraw_single}
              onTouchStart={startDraw_single}
              onTouchMove={draw_single}
              onTouchEnd={endDraw_single}
            />
          </div>

          {!submitted && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={handleClear_single}
                className="flex-1 min-h-[44px] rounded-lg py-3 text-[length:var(--game-text-base)] font-semibold bg-white/10 text-[var(--color-text-muted)] transition hover:bg-white/20"
              >
                {t('clear', lang)}
              </button>
              <button
                onClick={handleSubmit_single}
                disabled={!hasDrawn}
                className={cn(
                  'flex-1 min-h-[44px] rounded-lg py-3 text-[length:var(--game-text-base)] font-semibold transition',
                  hasDrawn
                    ? 'bg-[var(--color-accent-gold)] text-[#1a1a2e] hover:brightness-110'
                    : 'bg-white/10 text-[var(--color-text-muted)] cursor-not-allowed',
                )}
              >
                {t('done', lang)}
              </button>
            </div>
          )}

          {submitted && result && (
            <div
              className={cn(
                'mt-4 rounded-lg px-4 py-3 text-center text-[length:var(--game-text-base)]',
                result.correct
                  ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
                  : 'bg-red-500/20 text-red-400',
              )}
            >
              {result.correct ? (
                <>
                  {t('stroke_done', lang)}
                  {exercise.meaning && (
                    <div className="mt-1 text-[length:var(--game-text-base)] font-semibold" style={{ color: 'var(--color-accent-gold, #f0c040)' }}>
                      {exercise.targetChar} = {getMeaning(exercise.meaning, lang, exercise.targetChar)}
                    </div>
                  )}
                  <div className="mt-1 text-[length:var(--game-text-sm)] opacity-70">
                    {t('stroke_score', lang)}: {Math.round(result.score * 100)}%
                  </div>
                </>
              ) : (
                <>
                  {t('stroke_try_again', lang)}
                  <div className="mt-1 text-[length:var(--game-text-sm)] opacity-70">
                    {t('stroke_score', lang)}: {Math.round(result.score * 100)}%
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Example words using this character */}
      {exercise.exampleWords && exercise.exampleWords.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 'var(--game-text-sm)', opacity: 0.5, marginBottom: 8 }}>
            {t('stroke_examples', lang)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exercise.exampleWords.map((ex, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); playTTS(ex.word, ttsLang); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  minHeight: 44,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.4, flexShrink: 0 }}>
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
                <span className="text-ko" style={{ fontSize: 'var(--game-text-lg)' }}>{ex.word}</span>
                <span style={{ fontSize: 'var(--game-text-sm)', opacity: 0.5 }}>{ex.romanization}</span>
                <span style={{ fontSize: 'var(--game-text-sm)', opacity: 0.4, marginLeft: 'auto' }}>{getMeaning(ex.meaning, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

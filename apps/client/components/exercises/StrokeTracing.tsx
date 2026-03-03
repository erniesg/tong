'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { StrokeTracingExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface Props {
  exercise: StrokeTracingExercise;
  onResult: (correct: boolean, summary?: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const BRUSH_MIN = 4;   // CSS px — fast swipe (light stroke)
const BRUSH_MAX = 12;  // CSS px — slow/stationary (press down)
const VELOCITY_CAP = 8; // px/ms — speeds above this clamp to min brush
const PASS_THRESHOLD = 0.55;
const ALPHA_THRESHOLD = 30;
const GUIDE_COLOR = 'rgba(100, 120, 150, 0.35)';
const GOLD_COLOR = '#f0c040';

/** Map bare jamo to pronounceable syllables for TTS. */
const JAMO_TO_SYLLABLE: Record<string, string> = {
  'ㄱ': '가', 'ㄴ': '나', 'ㄷ': '다', 'ㄹ': '라', 'ㅁ': '마',
  'ㅂ': '바', 'ㅅ': '사', 'ㅇ': '아', 'ㅈ': '자', 'ㅊ': '차',
  'ㅋ': '카', 'ㅌ': '타', 'ㅍ': '파', 'ㅎ': '하',
  'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
  'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
};

const LANG_TO_BCP47: Record<string, string> = {
  ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN',
};

function playTTS(text: string, language?: string) {
  const ttsText = JAMO_TO_SYLLABLE[text] ?? text;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(ttsText);
  utter.lang = LANG_TO_BCP47[language ?? 'ko'] ?? 'ko-KR';
  utter.rate = 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export function StrokeTracing({ exercise, onResult }: Props) {
  const lang = useUILang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Offscreen: character in white for hit-testing & pixel counting
  const refCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Offscreen: accumulates white circles where user drags
  const revealCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Offscreen: scratch space for compositing gold × reveal
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; score: number } | null>(null);
  const prevPointRef = useRef<Point | null>(null);
  const prevTimeRef = useRef(0);
  const curBrushRef = useRef(BRUSH_MAX); // current smoothed brush radius
  const dprRef = useRef(2);
  const cssSizeRef = useRef({ w: 0, h: 0 });

  const ttsLang = exercise.language ?? 'ko';

  /** Draw character text on a context at CSS-space coordinates (fill only, no stroke outline). */
  const drawChar = useCallback((ctx: CanvasRenderingContext2D, color: string, cssW: number) => {
    ctx.save();
    ctx.font = `${cssW * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    const cssH = cssW; // square canvas
    ctx.fillText(exercise.targetChar, cssW / 2, cssH / 2);
    ctx.restore();
  }, [exercise.targetChar]);

  /** Composite: gray guide + (gold char masked by reveal) → visible canvas. */
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const revealCanvas = revealCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !revealCanvas || !tempCanvas) return;

    const ctx = canvas.getContext('2d');
    const tempCtx = tempCanvas.getContext('2d');
    if (!ctx || !tempCtx) return;

    const dpr = dprRef.current;
    const { w: cssW, h: cssH } = cssSizeRef.current;
    const pxW = cssW * dpr;
    const pxH = cssH * dpr;

    // 1. Clear visible canvas and draw gray guide character
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);
    ctx.restore();

    // Draw guide in gray (scale is already set to dpr)
    drawChar(ctx, GUIDE_COLOR, cssW);

    // 2. On tempCanvas: draw gold character, then destination-in with revealCanvas
    tempCtx.save();
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    tempCtx.clearRect(0, 0, pxW, pxH);
    tempCtx.restore();

    // Draw gold character on temp (uses dpr scale)
    drawChar(tempCtx, GOLD_COLOR, cssW);

    // Mask: only keep gold pixels where revealCanvas has content
    tempCtx.save();
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(revealCanvas, 0, 0);
    tempCtx.restore();

    // 3. Draw the masked gold result onto visible canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
  }, [drawChar]);

  // Initialize canvases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    dprRef.current = dpr;
    cssSizeRef.current = { w: rect.width, h: rect.height };

    const pxW = rect.width * dpr;
    const pxH = rect.height * dpr;

    // Set up visible canvas
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    // Ref canvas: character in white for pixel counting
    const refCanvas = document.createElement('canvas');
    refCanvas.width = pxW;
    refCanvas.height = pxH;
    const refCtx = refCanvas.getContext('2d');
    if (refCtx) {
      refCtx.scale(dpr, dpr);
      refCtx.font = `${rect.width * 0.7}px sans-serif`;
      refCtx.textAlign = 'center';
      refCtx.textBaseline = 'middle';
      refCtx.fillStyle = 'white';
      refCtx.fillText(exercise.targetChar, rect.width / 2, rect.height / 2);
      refCtx.lineWidth = 4;
      refCtx.strokeStyle = 'white';
      refCtx.strokeText(exercise.targetChar, rect.width / 2, rect.height / 2);
    }
    refCanvasRef.current = refCanvas;

    // Reveal canvas: starts empty, accumulates brush strokes
    const revealCanvas = document.createElement('canvas');
    revealCanvas.width = pxW;
    revealCanvas.height = pxH;
    revealCanvasRef.current = revealCanvas;

    // Temp canvas: scratch for compositing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pxW;
    tempCanvas.height = pxH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) tempCtx.scale(dpr, dpr);
    tempCanvasRef.current = tempCanvas;

    // Draw initial scene (gray guide)
    drawScene();
  }, [exercise.targetChar, drawScene]);

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

  /** Paint a circle on revealCanvas at CSS coords (no redraw — caller redraws). */
  const stampCircle = useCallback((revealCtx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    const dpr = dprRef.current;
    revealCtx.beginPath();
    revealCtx.arc(x * dpr, y * dpr, radius * dpr, 0, Math.PI * 2);
    revealCtx.fill();
  }, []);

  /** Reveal along a line with velocity-based brush width, then redraw once. */
  const revealStroke = useCallback((from: Point | null, to: Point, now: number) => {
    const revealCanvas = revealCanvasRef.current;
    if (!revealCanvas) return;
    const revealCtx = revealCanvas.getContext('2d');
    if (!revealCtx) return;

    // Compute velocity → brush radius
    let radius = BRUSH_MAX;
    if (from) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = Math.max(now - prevTimeRef.current, 1); // ms
      const velocity = dist / dt; // px/ms
      const t = Math.min(velocity / VELOCITY_CAP, 1); // 0=slow, 1=fast
      const target = BRUSH_MAX - t * (BRUSH_MAX - BRUSH_MIN);
      // Smooth toward target (ease 40%) for natural feel
      radius = curBrushRef.current + (target - curBrushRef.current) * 0.4;
    }
    curBrushRef.current = radius;

    // Stamp circles along the path
    revealCtx.save();
    revealCtx.setTransform(1, 0, 0, 1, 0, 0);
    revealCtx.fillStyle = 'white';

    if (!from) {
      stampCircle(revealCtx, to.x, to.y, radius);
    } else {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = Math.max(radius * 0.4, 1); // tighter spacing for smooth coverage
      const steps = Math.max(Math.ceil(dist / step), 1);
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        stampCircle(revealCtx, from.x + dx * frac, from.y + dy * frac, radius);
      }
    }

    revealCtx.restore();
    drawScene();
  }, [drawScene, stampCircle]);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (submitted) return;
    e.preventDefault();
    setDrawing(true);
    setHasDrawn(true);
    const pt = getPoint(e);
    if (pt) {
      const now = performance.now();
      prevPointRef.current = pt;
      prevTimeRef.current = now;
      curBrushRef.current = BRUSH_MAX; // start thick (pen down)
      revealStroke(null, pt, now);
    }
  }, [getPoint, submitted, revealStroke]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing || submitted) return;
    e.preventDefault();
    const pt = getPoint(e);
    if (!pt) return;

    const now = performance.now();
    revealStroke(prevPointRef.current, pt, now);
    prevPointRef.current = pt;
    prevTimeRef.current = now;
  }, [drawing, getPoint, submitted, revealStroke]);

  const endDraw = useCallback(() => {
    setDrawing(false);
    prevPointRef.current = null;
  }, []);

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
      const refAlpha = refData[i + 3];
      const revealAlpha = revealData[i + 3];
      const isRef = refAlpha > ALPHA_THRESHOLD;
      const isRevealed = revealAlpha > ALPHA_THRESHOLD;

      if (isRef) {
        refPixels++;
        if (isRevealed) revealedPixels++;
      }
    }

    if (refPixels === 0) return 0;
    return revealedPixels / refPixels;
  }, []);

  const handleSubmit = useCallback(() => {
    if (!hasDrawn || submitted) return;
    setSubmitted(true);

    const score = computeScore();
    const correct = score >= PASS_THRESHOLD;

    setResult({ correct, score });
    onResult(correct, `${Math.round(score * 100)}% coverage`);
  }, [hasDrawn, submitted, computeScore, onResult]);

  const handleClear = useCallback(() => {
    if (submitted) return;

    // Clear the reveal canvas
    const revealCanvas = revealCanvasRef.current;
    if (revealCanvas) {
      const revealCtx = revealCanvas.getContext('2d');
      if (revealCtx) {
        revealCtx.save();
        revealCtx.setTransform(1, 0, 0, 1, 0, 0);
        revealCtx.clearRect(0, 0, revealCanvas.width, revealCanvas.height);
        revealCtx.restore();
      }
    }

    prevPointRef.current = null;
    setHasDrawn(false);

    // Redraw scene (gray guide, no gold)
    drawScene();
  }, [submitted, drawScene]);

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      {/* Target character + romanization + sound */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 48, opacity: 0.6 }} className="text-ko">
            {exercise.targetChar}
          </span>
          <button
            onClick={() => playTTS(exercise.sound ?? exercise.targetChar, ttsLang)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
            aria-label="Play sound"
          >
            🔊
          </button>
        </div>
        {exercise.romanization && (
          <div style={{ fontSize: 16, opacity: 0.5, marginTop: 2 }}>
            {exercise.romanization}
          </div>
        )}
      </div>

      {/* Drawing canvas */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', maxWidth: 280, margin: '0 auto' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '2px solid rgba(255,255,255,0.1)',
            touchAction: 'none',
            cursor: submitted ? 'default' : 'crosshair',
          }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      {!submitted && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={handleClear}
            className="flex-1 rounded-lg py-3 font-semibold bg-white/10 text-[var(--color-text-muted)] transition hover:bg-white/20"
          >
            {t('clear', lang)}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasDrawn}
            className={cn(
              'flex-1 rounded-lg py-3 font-semibold transition',
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
            'mt-4 rounded-lg px-4 py-3 text-center text-sm',
            result.correct
              ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {result.correct ? (
            <>
              {t('stroke_done', lang)}
              <div className="mt-1 text-xs opacity-70">
                {t('stroke_score', lang)}: {Math.round(result.score * 100)}%
              </div>
            </>
          ) : (
            <>
              {t('stroke_try_again', lang)}
              <div className="mt-1 text-xs opacity-70">
                {t('stroke_score', lang)}: {Math.round(result.score * 100)}%
              </div>
            </>
          )}
        </div>
      )}

      {submitted && exercise.explanation && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)] m-0 text-center">{exercise.explanation}</p>
      )}

      {/* Example words using this character */}
      {exercise.exampleWords && exercise.exampleWords.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 8 }}>
            {t('stroke_examples', lang)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exercise.exampleWords.map((ex, i) => (
              <button
                key={i}
                onClick={() => playTTS(ex.word, ttsLang)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 14, opacity: 0.4, flexShrink: 0 }}>🔊</span>
                <span className="text-ko" style={{ fontSize: 18 }}>{ex.word}</span>
                <span style={{ fontSize: 13, opacity: 0.5 }}>{ex.romanization}</span>
                <span style={{ fontSize: 13, opacity: 0.4, marginLeft: 'auto' }}>{ex.meaning}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

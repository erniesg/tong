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

export function StrokeTracing({ exercise, onResult }: Props) {
  const lang = useUILang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const pointsRef = useRef<Point[]>([]);

  // Draw ghost overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Draw ghost character
    if (exercise.ghostOverlay) {
      ctx.save();
      ctx.font = `${rect.width * 0.7}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillText(exercise.targetChar, rect.width / 2, rect.height / 2);
      ctx.restore();
    }
  }, [exercise.targetChar, exercise.ghostOverlay]);

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

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setDrawing(true);
    setHasDrawn(true);
    const pt = getPoint(e);
    if (pt) pointsRef.current = [pt];
  }, [getPoint]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const pt = getPoint(e);
    if (!pt) return;
    pointsRef.current.push(pt);

    // Draw line
    const prev = pointsRef.current[pointsRef.current.length - 2];
    if (prev) {
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = 'var(--color-accent-gold)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }, [drawing, getPoint]);

  const endDraw = useCallback(() => {
    setDrawing(false);
  }, []);

  const handleSubmit = () => {
    if (!hasDrawn || submitted) return;
    setSubmitted(true);
    // For now, always pass — stroke order validation is a future enhancement
    // The value is in motor learning (drawing the character)
    const correct = pointsRef.current.length > 5; // must have drawn something
    onResult(correct);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Redraw ghost
    if (exercise.ghostOverlay) {
      ctx.save();
      ctx.font = `${rect.width * 0.7}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillText(exercise.targetChar, rect.width / 2, rect.height / 2);
      ctx.restore();
    }

    pointsRef.current = [];
    setHasDrawn(false);
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 text-ko m-0">{exercise.prompt}</p>

      {/* Target character display */}
      <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 8, opacity: 0.6 }} className="text-ko">
        {exercise.targetChar}
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
            cursor: 'crosshair',
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

      {submitted && exercise.explanation && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)] m-0 text-center">{exercise.explanation}</p>
      )}

      {submitted && (
        <div className="mt-4 rounded-lg px-4 py-3 text-center text-sm bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]">
          {t('stroke_done', lang)}
        </div>
      )}
    </div>
  );
}

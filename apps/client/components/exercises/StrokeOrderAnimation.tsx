'use client';

import { useEffect, useRef } from 'react';

interface Props {
  character: string;
  duration: number;
  onComplete: () => void;
  size?: number;
  totalStrokes?: number;
  onStrokeChange?: (strokeIndex: number | null) => void;
}

export function StrokeOrderAnimation({
  character,
  duration,
  onComplete,
  size = 160,
  totalStrokes,
  onStrokeChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const onStrokeChangeRef = useRef(onStrokeChange);
  onCompleteRef.current = onComplete;
  onStrokeChangeRef.current = onStrokeChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let writer: any = null;
    let strokeTimer: number | null = null;

    el.innerHTML = '';
    onStrokeChangeRef.current?.(totalStrokes ? 0 : null);

    const startStrokeTimer = () => {
      if (!totalStrokes || totalStrokes <= 0) return;
      const stepMs = Math.max(280, duration / totalStrokes);
      const tick = (index: number) => {
        if (cancelled) return;
        onStrokeChangeRef.current?.(Math.min(index, totalStrokes - 1));
        if (index + 1 < totalStrokes) {
          strokeTimer = window.setTimeout(() => tick(index + 1), stepMs);
        }
      };
      strokeTimer = window.setTimeout(() => tick(1), stepMs);
    };

    import('hanzi-writer').then((mod) => {
      if (cancelled) return;
      const HanziWriter = mod.default || mod;

      const strokeSpeed = Math.min(0.5, 1500 / duration);
      const delayBetween = Math.max(100, (duration * 0.15) / 8);

      writer = HanziWriter.create(el, character, {
        width: size,
        height: size,
        padding: 8,
        strokeColor: '#ffffff',
        outlineColor: 'rgba(255, 255, 255, 0.08)',
        strokeAnimationSpeed: strokeSpeed,
        delayBetweenStrokes: delayBetween,
        showCharacter: false,
        showOutline: true,
        strokeWidth: 2,
        outlineWidth: 1,
      });

      startStrokeTimer();
      writer.animateCharacter({
        onComplete: () => {
          if (!cancelled) {
            onStrokeChangeRef.current?.(null);
            onCompleteRef.current();
          }
        },
      });
    }).catch(() => {
      if (!cancelled) {
        onStrokeChangeRef.current?.(null);
        onCompleteRef.current();
      }
    });

    return () => {
      cancelled = true;
      if (strokeTimer) window.clearTimeout(strokeTimer);
      if (writer) {
        try { writer.pauseAnimation(); } catch { /* ok */ }
      }
      el.innerHTML = '';
    };
  }, [character, duration, size, totalStrokes]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, margin: '0 auto' }}
    />
  );
}

'use client';

import { useEffect, useRef } from 'react';

interface Props {
  character: string;
  duration: number;
  onComplete: () => void;
  size?: number;
}

export function StrokeOrderAnimation({ character, duration, onComplete, size = 160 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let writer: any = null;

    el.innerHTML = '';

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

      writer.animateCharacter({
        onComplete: () => {
          if (!cancelled) onCompleteRef.current();
        },
      });
    }).catch(() => {
      if (!cancelled) onCompleteRef.current();
    });

    return () => {
      cancelled = true;
      if (writer) {
        try { writer.pauseAnimation(); } catch { /* ok */ }
      }
      el.innerHTML = '';
    };
  }, [character, duration, size]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, margin: '0 auto' }}
    />
  );
}

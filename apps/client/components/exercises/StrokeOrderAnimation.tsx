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

type MedianPoint = [number, number] | { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pointFromMedian(point: MedianPoint): { x: number; y: number } | null {
  if (Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number') {
    return { x: point[0], y: point[1] };
  }
  if (!Array.isArray(point) && typeof point.x === 'number' && typeof point.y === 'number') {
    return point;
  }
  return null;
}

function getMedianLength(median: MedianPoint[] | undefined): number {
  if (!Array.isArray(median) || median.length < 2) return 900;
  let length = 0;
  let previous = pointFromMedian(median[0]);
  for (const rawPoint of median.slice(1)) {
    const point = pointFromMedian(rawPoint);
    if (previous && point) {
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    previous = point;
  }
  return Math.max(length, 120);
}

function getStrokeLengths(characterData: any, totalStrokes?: number): number[] {
  if (!totalStrokes || totalStrokes <= 0) return [];
  const medians = Array.isArray(characterData?.medians) ? characterData.medians : [];
  return Array.from({ length: totalStrokes }, (_, index) => getMedianLength(medians[index]));
}

function getAnimationSpeed(strokeLengths: number[], totalDuration: number, delayBetween: number): number {
  if (strokeLengths.length === 0) return Math.min(0.5, 1500 / totalDuration);
  const drawBudget = Math.max(900, totalDuration - delayBetween * Math.max(0, strokeLengths.length - 1));
  const weightedLength = strokeLengths.reduce((sum, length) => sum + length + 600, 0);
  return clamp(weightedLength / (3 * drawBudget), 1.35, 2.5);
}

function getStrokeOffsets(strokeLengths: number[], strokeSpeed: number, delayBetween: number): number[] {
  if (strokeLengths.length === 0) return [];
  const offsets = [0];
  let elapsed = 0;
  for (let index = 1; index < strokeLengths.length; index += 1) {
    elapsed += (strokeLengths[index - 1] + 600) / (3 * strokeSpeed) + delayBetween;
    offsets.push(elapsed);
  }
  return offsets;
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
    const strokeTimers: number[] = [];

    el.innerHTML = '';
    onStrokeChangeRef.current?.(totalStrokes ? 0 : null);

    import('hanzi-writer').then(async (mod) => {
      if (cancelled) return;
      const HanziWriter = mod.default || mod;

      const delayBetween = Math.max(100, (duration * 0.15) / 8);
      const characterData = totalStrokes
        ? await HanziWriter.loadCharacterData(character).catch(() => null)
        : null;
      if (cancelled) return;

      const strokeLengths = getStrokeLengths(characterData, totalStrokes);
      const strokeSpeed = totalStrokes
        ? getAnimationSpeed(strokeLengths, duration, delayBetween)
        : Math.min(0.5, 1500 / duration);

      const writerOptions: Record<string, unknown> = {
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
      };
      if (characterData) {
        writerOptions.charDataLoader = () => Promise.resolve(characterData);
      }

      writer = HanziWriter.create(el, character, writerOptions);

      if (totalStrokes && totalStrokes > 0) {
        const offsets = getStrokeOffsets(strokeLengths, strokeSpeed, delayBetween);
        offsets.forEach((offset, index) => {
          const timer = window.setTimeout(() => {
            if (!cancelled) onStrokeChangeRef.current?.(index);
          }, offset);
          strokeTimers.push(timer);
        });

        writer.animateCharacter({
          onComplete: () => {
            if (!cancelled) {
              onStrokeChangeRef.current?.(null);
              onCompleteRef.current();
            }
          },
        }).catch(() => {
          if (!cancelled) {
            onStrokeChangeRef.current?.(null);
            onCompleteRef.current();
          }
        });
        return;
      }

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
      strokeTimers.forEach((timer) => window.clearTimeout(timer));
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

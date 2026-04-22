'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface ShanghaiPreludeViewportProps {
  imageUrl: string;
  panUnlocked: boolean;
  tappedPair: boolean;
  onPairReveal?: (revealed: boolean) => void;
  onPairTap: () => void;
}

const PANORAMA_WIDTH_RATIO = 1.9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ShanghaiPreludeViewport({
  imageUrl,
  panUnlocked,
  tappedPair,
  onPairReveal,
  onPairTap,
}: ShanghaiPreludeViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [maxPan, setMaxPan] = useState(0);
  const [panX, setPanX] = useState(0);
  const dragRef = useRef<{ pointerId: number; startX: number; startPan: number } | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const nextMaxPan = Math.max(0, viewport.clientWidth * (PANORAMA_WIDTH_RATIO - 1));
      setMaxPan(nextMaxPan);
      setPanX((prev) => clamp(prev, 0, nextMaxPan));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!panUnlocked) {
      setPanX(maxPan);
    }
  }, [panUnlocked, maxPan]);

  const pairVisible = useMemo(() => {
    if (maxPan <= 0) return false;
    return panX <= maxPan * 0.58;
  }, [panX, maxPan]);

  useEffect(() => {
    onPairReveal?.(pairVisible);
  }, [pairVisible, onPairReveal]);

  return (
    <div className="shanghai-prelude absolute inset-0 overflow-hidden">
      <div
        ref={viewportRef}
        className={`shanghai-prelude-viewport ${panUnlocked ? 'is-unlocked' : 'is-guided'}`}
        onPointerDown={(event) => {
          if (!panUnlocked) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startPan: panX,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!panUnlocked || !dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
          const dx = event.clientX - dragRef.current.startX;
          setPanX(clamp(dragRef.current.startPan - dx, 0, maxPan));
        }}
        onPointerUp={(event) => {
          if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onWheel={(event) => {
          if (!panUnlocked) return;
          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (delta === 0) return;
          event.preventDefault();
          setPanX((prev) => clamp(prev + delta, 0, maxPan));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="shanghai-prelude-image"
          style={{ transform: `translate3d(${-panX}px, 0, 0)` }}
          draggable={false}
        />

        <div className="shanghai-prelude-guidance" aria-live="polite">
          {!panUnlocked && 'Tong: Stay still. Listen from this corner first.'}
          {panUnlocked && !pairVisible && 'Tong: Good. Slide left slowly.'}
          {panUnlocked && pairVisible && !tappedPair && 'Tong: There—Shoucheng and Dingman. Tap them.'}
          {tappedPair && 'Tong: Keep low. We are in the conversation now.'}
        </div>

        {panUnlocked && pairVisible && (
          <button
            type="button"
            className={`shanghai-pair-hotspot ${tappedPair ? 'is-locked' : ''}`}
            onClick={onPairTap}
            disabled={tappedPair}
          >
            <span className="shanghai-pair-hotspot-dot" />
            <span className="shanghai-pair-hotspot-label">Shoucheng · Dingman</span>
          </button>
        )}
      </div>
    </div>
  );
}

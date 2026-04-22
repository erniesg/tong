'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fallbackRuntimeAssetCandidates } from '@/lib/runtime-assets';

type ShanghaiPreludeViewportProps = {
  imageUrl: string;
  panUnlocked: boolean;
  pairTapped: boolean;
  onPairTap: () => void;
};

const PANORAMA_WIDTH_FACTOR = 1.9;
const REVEAL_THRESHOLD = 0.42;

export function ShanghaiPreludeViewport({
  imageUrl,
  panUnlocked,
  pairTapped,
  onPairTap,
}: ShanghaiPreludeViewportProps) {
  const candidates = useMemo(() => fallbackRuntimeAssetCandidates(imageUrl), [imageUrl]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(390);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const dragStartRef = useRef<{ x: number; offset: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageUrl]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && Number.isFinite(width)) {
        setViewportWidth(width);
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const panoramaWidth = Math.max(viewportWidth * PANORAMA_WIDTH_FACTOR, viewportWidth + 1);
  const minOffset = viewportWidth - panoramaWidth;

  useEffect(() => {
    setOffsetX(minOffset);
  }, [minOffset, imageUrl]);

  const clamp = (value: number) => Math.min(0, Math.max(minOffset, value));

  const onPointerDown = (x: number) => {
    if (!panUnlocked) return;
    dragStartRef.current = { x, offset: offsetX };
    setDragging(true);
  };

  const onPointerMove = (x: number) => {
    const dragState = dragStartRef.current;
    if (!dragState || !panUnlocked) return;
    const delta = dragState.x - x;
    setOffsetX(clamp(dragState.offset + delta));
  };

  const onPointerEnd = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  const revealProgress = minOffset === 0 ? 0 : (offsetX - minOffset) / (0 - minOffset);
  const pairVisible = panUnlocked && revealProgress >= REVEAL_THRESHOLD;
  const activeImageUrl = candidates[candidateIndex] ?? '';

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        ref={viewportRef}
        className={`shanghai-prelude-viewport${panUnlocked ? ' is-unlocked' : ' is-guided'}${dragging ? ' is-dragging' : ''}`}
        onMouseLeave={onPointerEnd}
        onMouseUp={onPointerEnd}
        onMouseMove={(e) => onPointerMove(e.clientX)}
        onMouseDown={(e) => onPointerDown(e.clientX)}
        onTouchStart={(e) => onPointerDown(e.touches[0]?.clientX ?? 0)}
        onTouchMove={(e) => onPointerMove(e.touches[0]?.clientX ?? 0)}
        onTouchEnd={onPointerEnd}
        onWheel={(e) => {
          if (!panUnlocked) return;
          if (Math.abs(e.deltaX) < 0.5 && Math.abs(e.deltaY) < 0.5) return;
          setOffsetX((prev) => clamp(prev + e.deltaX + e.deltaY * 0.4));
        }}
      >
        {activeImageUrl ? (
          <div
            className="shanghai-prelude-panorama"
            style={{ width: `${panoramaWidth}px`, transform: `translate3d(${offsetX}px, 0, 0)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImageUrl}
              alt="Shanghai dumpling shop prelude"
              className="shanghai-prelude-image"
              onError={(e) => {
                if (candidateIndex + 1 < candidates.length) {
                  setCandidateIndex(candidateIndex + 1);
                  return;
                }
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />

            {pairVisible && !pairTapped && (
              <button
                type="button"
                className="shanghai-prelude-pair-tap"
                onClick={(event) => {
                  event.stopPropagation();
                  onPairTap();
                }}
              >
                <span className="shanghai-prelude-pair-label">守成 · 丁漫</span>
                <span className="shanghai-prelude-pair-sub">Tap to listen in</span>
              </button>
            )}
          </div>
        ) : null}

        {!panUnlocked && (
          <div className="shanghai-prelude-guided-copy">Tong: Hold still. Catch their rhythm before you move.</div>
        )}
        {panUnlocked && !pairTapped && (
          <div className="shanghai-prelude-guided-copy">Tong: Slide left. Shoucheng and Dingman are at the next table.</div>
        )}
        {pairTapped && (
          <div className="shanghai-prelude-guided-copy">Tong: Good. Keep low and listen.</div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
}

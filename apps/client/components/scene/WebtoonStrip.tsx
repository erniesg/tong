'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WebtoonPanel as WebtoonPanelSpec, WebtoonGap } from '@/lib/hangout/fixture-types';
import { WebtoonBubble } from './WebtoonBubble';

interface WebtoonStripProps {
  panels: WebtoonPanelSpec[];
  onComplete?: () => void;
  /** Theme color of the strip surface. Parchment by default for warm indoor scenes. */
  surfaceColor?: string;
}

function gapStyle(gap: WebtoonGap | undefined, surface: string): CSSProperties {
  if (!gap || gap.px <= 0) return {};
  const bg = gap.gradient
    ? `linear-gradient(to bottom, ${gap.gradient[0]}, ${gap.gradient[1]})`
    : gap.color ?? surface;
  return { height: `${gap.px}px`, background: bg };
}

export function WebtoonStrip({ panels, onComplete, surfaceColor = '#f4f0e8' }: WebtoonStripProps) {
  const [completed, setCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (completed) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.panelIndex);
          if (Number.isNaN(index)) continue;
          if (index === panels.length - 1 && entry.intersectionRatio > 0.8) {
            setCompleted(true);
            onComplete?.();
          }
        }
      },
      { root: container, threshold: [0.8] },
    );

    for (const el of panelRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [panels.length, onComplete, completed]);

  const rootStyle: CSSProperties = { ['--wt-surface' as string]: surfaceColor };

  return (
    <div className="wt-strip" ref={containerRef} style={rootStyle} role="region" aria-label="Webtoon strip">
      {panels.map((panel, index) => (
        <div key={panel.id} className="wt-block">
          <div className="wt-gap" aria-hidden="true" style={gapStyle(panel.gapBefore, surfaceColor)} />
          <figure
            ref={(el) => {
              panelRefs.current[index] = el;
            }}
            data-panel-index={index}
            className={`wt-panel wt-panel--${panel.widthType}${panel.isThumbStop ? ' is-thumb-stop' : ''}`}
            aria-label={`${panel.shotType} panel ${index + 1} of ${panels.length}`}
          >
            <img
              className="wt-panel__img"
              src={panel.imageUrl}
              alt={`${panel.shotType} panel ${index + 1}`}
              draggable={false}
              loading={index < 2 ? 'eager' : 'lazy'}
            />
            {panel.bubble && <WebtoonBubble {...panel.bubble} />}
          </figure>
        </div>
      ))}
    </div>
  );
}

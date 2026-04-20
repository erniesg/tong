'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WebtoonPanel as WebtoonPanelSpec } from '@/lib/hangout/fixture-types';
import { WebtoonBubble } from './WebtoonBubble';

interface WebtoonStripProps {
  panels: WebtoonPanelSpec[];
  onComplete?: () => void;
  showProgress?: boolean;
}

export function WebtoonStrip({ panels, onComplete, showProgress = true }: WebtoonStripProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.panelIndex);
          if (Number.isNaN(index)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0.4) {
          setActiveIndex(best.index);
          if (best.index === panels.length - 1 && !completed) {
            setCompleted(true);
            onComplete?.();
          }
        }
      },
      {
        root: container,
        threshold: [0.25, 0.5, 0.75],
      },
    );

    for (const el of panelRefs.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [panels.length, onComplete, completed]);

  return (
    <div className="webtoon-strip" ref={containerRef} role="region" aria-label="Webtoon strip">
      {panels.map((panel, index) => {
        const style: CSSProperties = {
          ['--webtoon-gap-height' as string]: `${panel.gapBefore.px}px`,
          ['--webtoon-gap-color' as string]: panel.gapBefore.color,
          ['--webtoon-panel-aspect' as string]: panel.aspectRatio.replace(':', ' / '),
        };

        return (
          <div key={panel.id} className="webtoon-strip__panel-wrap" style={style}>
            {panel.gapBefore.px > 0 && <div className="webtoon-strip__gap" aria-hidden="true" />}
            <figure
              ref={(el) => {
                panelRefs.current[index] = el;
              }}
              data-panel-index={index}
              className={`webtoon-strip__panel webtoon-strip__panel--${panel.widthType}${
                panel.isThumbStop ? ' is-thumb-stop' : ''
              }`}
              aria-label={`${panel.shotType} panel ${index + 1} of ${panels.length}`}
            >
              <img
                className="webtoon-strip__image"
                src={panel.imageUrl}
                alt={`${panel.shotType} panel ${index + 1}`}
                draggable={false}
                loading={index < 2 ? 'eager' : 'lazy'}
              />
              {panel.bubble && <WebtoonBubble {...panel.bubble} />}
            </figure>
          </div>
        );
      })}

      {showProgress && (
        <div className="webtoon-strip__progress" aria-hidden="true">
          {panels.map((panel, index) => (
            <span
              key={panel.id}
              className={`webtoon-strip__dot${index === activeIndex ? ' is-active' : ''}${
                index < activeIndex ? ' is-complete' : ''
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

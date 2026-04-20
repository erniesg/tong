'use client';

import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import type { WebtoonPanel as WebtoonPanelSpec, WebtoonGap } from '@/lib/hangout/fixture-types';
import { WebtoonBubble } from './WebtoonBubble';

export type WebtoonTheme = 'warm' | 'dark';

interface WebtoonStripProps {
  panels: WebtoonPanelSpec[];
  onComplete?: () => void;
  /** Visual theme. `warm` = parchment daylight; `dark` = near-black night/mood. */
  theme?: WebtoonTheme;
  /** Override the surface color directly. Takes precedence over `theme`. */
  surfaceColor?: string;
  /** Show clickable progress rail. Default true. */
  showProgress?: boolean;
}

const THEME_SURFACE: Record<WebtoonTheme, string> = {
  warm: '#f4f0e8',
  dark: '#0b0b10',
};

function gapStyle(gap: WebtoonGap | undefined, surface: string): CSSProperties {
  if (!gap || gap.px <= 0) return {};
  const bg = gap.gradient
    ? `linear-gradient(to bottom, ${gap.gradient[0]}, ${gap.gradient[1]})`
    : gap.color ?? surface;
  return { height: `${gap.px}px`, background: bg };
}

export function WebtoonStrip({
  panels,
  onComplete,
  theme = 'warm',
  surfaceColor,
  showProgress = true,
}: WebtoonStripProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  const surface = surfaceColor ?? THEME_SURFACE[theme];

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
          if (index === panels.length - 1 && entry.intersectionRatio > 0.8 && !completed) {
            setCompleted(true);
            onComplete?.();
          }
        }
        if (best && best.ratio > 0.35) {
          setActiveIndex(best.index);
        }
      },
      { root: container, threshold: [0.25, 0.5, 0.8] },
    );

    for (const el of panelRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [panels.length, onComplete, completed]);

  const jumpTo = useCallback((index: number) => {
    const el = panelRefs.current[index];
    const container = containerRef.current;
    if (!el || !container) return;
    // Account for the panel's preceding gap so the jump lands on the panel top
    const offsetTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, offsetTop - 8), behavior: 'smooth' });
  }, []);

  const rootStyle: CSSProperties = {
    ['--wt-surface' as string]: surface,
    ['--wt-theme-fg' as string]: theme === 'dark' ? '#fff8ee' : '#12161f',
  };

  return (
    <div
      className={`wt-strip wt-strip--${theme}`}
      ref={containerRef}
      style={rootStyle}
      role="region"
      aria-label="Webtoon strip"
    >
      {panels.map((panel, index) => (
        <div key={panel.id} className="wt-block">
          <div className="wt-gap" aria-hidden="true" style={gapStyle(panel.gapBefore, surface)} />
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

      {showProgress && panels.length > 1 && (
        <nav className={`wt-rail wt-rail--${theme}`} aria-label="Panel navigation">
          {panels.map((panel, index) => (
            <button
              key={panel.id}
              type="button"
              className={`wt-rail__dot${index === activeIndex ? ' is-active' : ''}${index < activeIndex ? ' is-done' : ''}`}
              onClick={() => jumpTo(index)}
              aria-label={`Jump to panel ${index + 1}: ${panel.shotType}`}
            />
          ))}
        </nav>
      )}
    </div>
  );
}

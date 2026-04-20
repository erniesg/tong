'use client';

import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import type {
  WebtoonPanel as WebtoonPanelSpec,
  WebtoonGap,
  WebtoonPanelFrame,
  WebtoonPanelLayout,
} from '@/lib/hangout/fixture-types';
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
  /** When true, all bubble help content is expanded via global toolbar control. */
  showHelp?: boolean;
  /** Where scrolling is owned: the strip itself or the page viewport. */
  scrollRoot?: 'self' | 'page';
}

const THEME_SURFACE: Record<WebtoonTheme, string> = {
  warm: '#ffffff',
  dark: '#0b0b10',
};

function gapStyle(gap: WebtoonGap | undefined, theme: WebtoonTheme, surface: string): CSSProperties {
  if (!gap || gap.px <= 0) return {};
  // In dark theme, prefer the author-provided dark override; fall back to
  // the warm palette if no override exists (still better than default void).
  const themed = theme === 'dark' && gap.dark ? gap.dark : null;
  const gradient = themed?.gradient ?? gap.gradient;
  const color = themed?.color ?? gap.color;
  const bg = gradient
    ? `linear-gradient(to bottom, ${gradient[0]}, ${gradient[1]})`
    : color ?? surface;
  return { height: `${gap.px}px`, background: bg };
}

function frameStyle(frame: WebtoonPanelFrame | undefined, theme: WebtoonTheme): CSSProperties {
  if (!frame) return {};
  const color = theme === 'dark'
    ? frame.dark?.color ?? frame.color ?? 'rgba(255, 248, 238, 0.18)'
    : frame.color ?? 'rgba(49, 37, 24, 0.22)';
  return {
    ['--wt-frame-color' as string]: color,
    ['--wt-frame-width' as string]: `${frame.widthPx ?? 2}px`,
  };
}

function panelLayoutStyle(layout: WebtoonPanelLayout | undefined): CSSProperties {
  if (!layout) return {};
  return {
    alignSelf: layout.align === 'left'
      ? 'flex-start'
      : layout.align === 'right'
        ? 'flex-end'
        : 'center',
    marginTop: layout.liftPx ? `${layout.liftPx * -1}px` : undefined,
    width: layout.widthPct ? `${layout.widthPct}%` : undefined,
    aspectRatio: layout.cropAspectRatio,
  };
}

function blockStyle(layout: WebtoonPanelLayout | undefined, theme: WebtoonTheme): CSSProperties {
  if (!layout?.backdropColor && !(theme === 'dark' && layout?.darkBackdropColor)) return {};
  return {
    background: theme === 'dark'
      ? layout.darkBackdropColor ?? layout.backdropColor
      : layout.backdropColor,
  };
}

function imageStyle(layout: WebtoonPanelLayout | undefined): CSSProperties {
  if (!layout) return {};
  return {
    transform: layout.flipX ? 'scaleX(-1)' : undefined,
    height: layout.cropAspectRatio ? '100%' : undefined,
    objectFit: layout.cropAspectRatio ? 'cover' : undefined,
    objectPosition: layout.cropAspectRatio ? layout.cropPosition ?? 'center center' : undefined,
  };
}

function bubbleReserveStyle(panel: WebtoonPanelSpec): CSSProperties {
  const bubbleLayout = panel.bubble?.layout;
  if (!bubbleLayout?.outside) return {};
  const reserve = bubbleLayout.reserveSpacePx ?? 96;
  if (panel.bubble?.position === 'top') {
    return { paddingTop: `${reserve}px` };
  }
  return { paddingBottom: `${reserve}px` };
}

export function WebtoonStrip({
  panels,
  onComplete,
  theme = 'warm',
  surfaceColor,
  showProgress = true,
  showHelp = false,
  scrollRoot = 'self',
}: WebtoonStripProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  const surface = surfaceColor ?? THEME_SURFACE[theme];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const usePageScroll = scrollRoot === 'page';

    const updateActiveIndex = () => {
      const rootRect = usePageScroll ? null : container.getBoundingClientRect();
      const guideLine = usePageScroll ? window.innerHeight * 0.34 : (rootRect?.height ?? 0) * 0.34;
      let candidate = -1;
      let bestPastTop = -Infinity;
      let nextCandidate = -1;
      let nextTop = Infinity;

      panelRefs.current.forEach((el, index) => {
        if (!el) return;
        const top = usePageScroll
          ? el.getBoundingClientRect().top
          : el.getBoundingClientRect().top - (rootRect?.top ?? 0);
        if (top <= guideLine && top > bestPastTop) {
          bestPastTop = top;
          candidate = index;
        }
        if (top > guideLine && top < nextTop) {
          nextTop = top;
          nextCandidate = index;
        }
      });

      if (candidate !== -1) {
        setActiveIndex(candidate);
      } else if (nextCandidate !== -1) {
        setActiveIndex(nextCandidate);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.panelIndex);
          if (Number.isNaN(index)) continue;
          if (index === panels.length - 1 && entry.intersectionRatio > 0.8 && !completed) {
            setCompleted(true);
            onComplete?.();
          }
        }
      },
      { root: usePageScroll ? null : container, threshold: [0.25, 0.5, 0.8] },
    );

    for (const el of panelRefs.current) {
      if (el) observer.observe(el);
    }

    updateActiveIndex();
    const scrollTarget = usePageScroll ? window : container;
    scrollTarget.addEventListener('scroll', updateActiveIndex, { passive: true });
    return () => {
      scrollTarget.removeEventListener('scroll', updateActiveIndex);
      observer.disconnect();
    };
  }, [panels.length, onComplete, completed, scrollRoot]);

  const jumpTo = useCallback((index: number) => {
    const el = panelRefs.current[index];
    if (!el) return;
    setActiveIndex(index);
    el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  }, []);

  const rootStyle: CSSProperties = {
    ['--wt-surface' as string]: surface,
    ['--wt-theme-fg' as string]: theme === 'dark' ? '#fff8ee' : '#12161f',
  };

  return (
    <div
      className={`wt-strip wt-strip--${theme}${scrollRoot === 'page' ? ' wt-strip--page-scroll' : ''}`}
      ref={containerRef}
      style={rootStyle}
      role="region"
      aria-label="Webtoon strip"
    >
      {panels.map((panel, index) => (
        <div
          key={panel.id}
          className="wt-block"
          style={{ ...blockStyle(panel.layout, theme), ...bubbleReserveStyle(panel) }}
        >
          <div className="wt-gap" aria-hidden="true" style={gapStyle(panel.gapBefore, theme, surface)} />
          <figure
            ref={(el) => {
              panelRefs.current[index] = el;
            }}
            data-panel-index={index}
            className={`wt-panel wt-panel--${panel.widthType}${panel.frame ? ` wt-panel--framed wt-panel--frame-${panel.frame.edges}` : ''}${panel.bubble?.layout?.outside ? ' wt-panel--bubble-outside' : ''}${panel.isThumbStop ? ' is-thumb-stop' : ''}`}
            style={{ ...frameStyle(panel.frame, theme), ...panelLayoutStyle(panel.layout) }}
            aria-label={`${panel.shotType} panel ${index + 1} of ${panels.length}`}
          >
            <img
              className="wt-panel__img"
              src={panel.imageUrl}
              alt={`${panel.shotType} panel ${index + 1}`}
              draggable={false}
              loading={index < 2 ? 'eager' : 'lazy'}
              style={imageStyle(panel.layout)}
            />
            {panel.bubble && <WebtoonBubble {...panel.bubble} showHelp={showHelp} />}
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

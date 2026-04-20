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

const WEBTOON_STRIP_CSS = `
.wt-strip {
  position: relative;
  width: 100%;
  height: 100%;
  max-height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--wt-surface, #f4f0e8);
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.wt-strip--page-scroll {
  height: auto;
  max-height: none;
  overflow: visible;
}

.wt-strip--dark {
  color: #fff8ee;
}

.wt-rail {
  position: fixed;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 8px;
  background: rgba(13, 13, 26, 0.32);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  touch-action: manipulation;
}

.wt-rail--dark {
  background: rgba(255, 248, 238, 0.08);
}

.wt-rail__dot {
  position: relative;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition:
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 200ms ease;
}

.wt-rail__dot::after {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition:
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background 200ms ease,
    box-shadow 200ms ease;
}

.wt-rail__dot:hover::after {
  transform: scale(1.25);
  background: rgba(255, 255, 255, 0.55);
}

.wt-rail__dot.is-done::after {
  background: rgba(244, 210, 172, 0.55);
}

.wt-rail__dot.is-active::after {
  background: #f4d2ac;
  transform: scale(1.6);
  box-shadow: 0 0 0 3px rgba(244, 210, 172, 0.25);
}

.wt-rail__dot:focus-visible {
  outline: 2px solid #f4d2ac;
  outline-offset: 3px;
}

.wt-block {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wt-gap {
  width: 100%;
  display: block;
}

.wt-panel {
  position: relative;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
  isolation: isolate;
}

.wt-panel--bubble-outside {
  overflow: visible;
}

.wt-panel:has(.wt-bubble.is-open) {
  overflow: visible;
  z-index: 8;
}

.wt-panel--framed::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.wt-panel--frame-all::after {
  box-shadow: inset 0 0 0 var(--wt-frame-width, 2px) var(--wt-frame-color, rgba(49, 37, 24, 0.22));
}

.wt-panel--frame-top-bottom::after {
  box-shadow:
    inset 0 var(--wt-frame-width, 2px) 0 0 var(--wt-frame-color, rgba(49, 37, 24, 0.22)),
    inset 0 calc(-1 * var(--wt-frame-width, 2px)) 0 0 var(--wt-frame-color, rgba(49, 37, 24, 0.22));
}

.wt-panel--full-bleed { width: 100%; }
.wt-panel--full-width { width: 96%; }
.wt-panel--inset { width: 62%; }

@media (max-width: 480px) {
  .wt-panel--full-width { width: 100%; }
  .wt-panel--inset { width: 70%; }
}

.wt-panel__img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
}

.wt-panel.is-thumb-stop {
  scroll-snap-align: start;
}

.wt-bubble {
  --wt-bubble-fill: #fffdf9;
  --wt-bubble-border: #1d3a6b;
  --wt-bubble-shadow: 0 18px 38px rgba(10, 15, 30, 0.2), 0 3px 8px rgba(10, 15, 30, 0.08);
  --wt-tail-size: clamp(18px, 3.6vw, 24px);
  --wt-tail-offset: 50%;
  position: absolute;
  left: 50%;
  transform: translate(calc(var(--wt-bubble-shift-x, -50%) + var(--wt-bubble-shift-nudge, 0px)), 0);
  width: auto;
  min-width: 7.5rem;
  max-width: var(--wt-bubble-max-width, min(84vw, 34rem));
  z-index: 4;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.6vw, 12px);
  padding: clamp(13px, 1.4vw + 8px, 20px) clamp(20px, 3.6vw, 34px) clamp(15px, 1.6vw + 8px, 22px);
  min-height: clamp(4.25rem, 13vw, 6rem);
  height: fit-content;
  background: var(--wt-bubble-fill);
  color: #12161f;
  border: 2px solid var(--wt-bubble-border);
  border-radius: 999px;
  box-shadow: var(--wt-bubble-shadow);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  font: inherit;
  font-family: inherit;
  text-align: center;
  isolation: isolate;
  overflow: visible;
  animation: wtBubbleRise 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 220ms ease,
    background 220ms ease,
    border-color 220ms ease,
    border-radius 220ms ease;
}

.wt-bubble::before,
.wt-bubble::after {
  content: '';
  position: absolute;
  left: var(--wt-tail-offset);
  pointer-events: none;
  width: var(--wt-tail-size);
  height: var(--wt-tail-size);
  background: var(--wt-bubble-fill);
  z-index: -1;
}

.wt-bubble--bottom::before,
.wt-bubble--center-bottom::before,
.wt-bubble--bottom::after,
.wt-bubble--center-bottom::after {
  top: calc(var(--wt-tail-size) * -0.28);
  transform: translateX(-50%) rotate(47deg);
}

.wt-bubble--bottom::before,
.wt-bubble--center-bottom::before {
  border-top: 2px solid var(--wt-bubble-border);
  border-left: 2px solid var(--wt-bubble-border);
}

.wt-bubble--bottom::after,
.wt-bubble--center-bottom::after {
  top: calc(var(--wt-tail-size) * -0.18);
}

.wt-bubble--top::before,
.wt-bubble--top::after {
  bottom: calc(var(--wt-tail-size) * -0.28);
  transform: translateX(-50%) rotate(43deg);
}

.wt-bubble--top::before {
  border-right: 2px solid var(--wt-bubble-border);
  border-bottom: 2px solid var(--wt-bubble-border);
}

.wt-bubble--top::after {
  bottom: calc(var(--wt-tail-size) * -0.18);
}

.wt-bubble:hover {
  transform: translate(calc(var(--wt-bubble-shift-x, -50%) + var(--wt-bubble-shift-nudge, 0px)), -2px);
  box-shadow: 0 20px 44px rgba(10, 15, 30, 0.24), 0 4px 10px rgba(10, 15, 30, 0.12);
}

.wt-bubble:active {
  transform: translate(calc(var(--wt-bubble-shift-x, -50%) + var(--wt-bubble-shift-nudge, 0px)), 0);
}

.wt-bubble[aria-disabled='true'] {
  cursor: default;
}

.wt-block:has(.wt-bubble.is-open) {
  z-index: 12;
}

.wt-block:has(.wt-bubble.is-open) + .wt-block .wt-panel {
  margin-top: 0 !important;
}

.wt-bubble.is-open {
  --wt-bubble-fill: #0e1524;
  --wt-bubble-border: rgba(244, 210, 172, 0.55);
  --wt-bubble-shadow: 0 18px 44px rgba(5, 8, 18, 0.5), 0 4px 10px rgba(5, 8, 18, 0.28);
  display: flex;
  align-items: flex-start;
  min-width: min(14rem, 72vw);
  min-height: 0;
  height: fit-content;
  padding: 16px 18px 18px;
  max-width: var(--wt-bubble-max-width, min(88vw, 30rem));
  border-radius: clamp(26px, 6vw, 36px);
  color: #fff8ee;
  text-align: left;
}

.wt-bubble.is-open .wt-bubble__text {
  color: #fff8ee;
}

.wt-bubble--top { top: 6%; }
.wt-bubble--bottom { bottom: 7%; }
.wt-bubble--center-bottom { bottom: 16%; }

@keyframes wtBubbleRise {
  from {
    opacity: 0;
    transform: translate(calc(var(--wt-bubble-shift-x, -50%) + var(--wt-bubble-shift-nudge, 0px)), 10px);
  }
  to {
    opacity: 1;
    transform: translate(calc(var(--wt-bubble-shift-x, -50%) + var(--wt-bubble-shift-nudge, 0px)), 0);
  }
}

.wt-bubble--shoucheng { --wt-bubble-border: #1d3a6b; }
.wt-bubble--dingman { --wt-bubble-border: #9c3a2a; }
.wt-bubble--ayi { --wt-bubble-border: #b5792a; }
.wt-bubble--narrator { --wt-bubble-border: #555862; --wt-bubble-fill: #faf7f2; }

.wt-bubble.is-open.wt-bubble--shoucheng { --wt-bubble-border: rgba(120, 160, 220, 0.6); }
.wt-bubble.is-open.wt-bubble--dingman { --wt-bubble-border: rgba(236, 140, 120, 0.6); }
.wt-bubble.is-open.wt-bubble--ayi { --wt-bubble-border: rgba(244, 210, 172, 0.6); }

.wt-bubble__speaker {
  font-size: clamp(0.74rem, 0.3vw + 0.68rem, 0.86rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(244, 210, 172, 0.75);
  display: block;
}

.wt-bubble__text {
  font-size: clamp(1.18rem, 1.6vw + 0.95rem, 2.3rem);
  line-height: 1.18;
  font-weight: 700;
  color: inherit;
  word-break: normal;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.wt-bubble__help {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.5vw, 12px);
  width: 100%;
  min-width: 0;
  animation: wtHelpReveal 280ms ease-out both;
}

@keyframes wtHelpReveal {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.wt-bubble__ruby {
  font-size: clamp(1.08rem, 1.35vw + 0.92rem, 2rem);
  line-height: 1.72;
  font-weight: 700;
  color: #fff8ee;
  overflow-wrap: anywhere;
}

.wt-ruby {
  ruby-position: over;
  ruby-align: center;
  margin: 0 1px;
}

.wt-ruby rt {
  font-size: 0.52em;
  line-height: 1;
  font-style: italic;
  font-weight: 500;
  color: #f4d2ac;
  letter-spacing: 0.02em;
}

.wt-bubble__en {
  font-size: clamp(0.98rem, 0.55vw + 0.88rem, 1.18rem);
  line-height: 1.45;
  font-weight: 500;
  color: #fff8ee;
  text-wrap: pretty;
}

@media (max-width: 480px) {
  .wt-bubble {
    max-width: min(86vw, 24rem);
  }

  .wt-bubble--center-bottom {
    bottom: 12%;
  }
}
`;

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
    marginTop: layout.liftPx ? `${layout.liftPx * -1}px` : undefined,
    width: layout.widthPct ? `${layout.widthPct}%` : undefined,
    aspectRatio: layout.cropAspectRatio,
  };
}

function blockStyle(layout: WebtoonPanelLayout | undefined, theme: WebtoonTheme): CSSProperties {
  const alignItems = layout?.align === 'left'
    ? 'flex-start'
    : layout?.align === 'right'
      ? 'flex-end'
      : 'center';
  const background = theme === 'dark'
    ? layout?.darkBackdropColor ?? layout?.backdropColor
    : layout?.backdropColor;
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems,
    background,
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
      <style dangerouslySetInnerHTML={{ __html: WEBTOON_STRIP_CSS }} />
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

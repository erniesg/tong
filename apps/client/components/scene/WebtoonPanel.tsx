'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WebtoonPanel as WebtoonPanelSpec } from '@/lib/hangout/fixture-types';
import { WebtoonBubble } from './WebtoonBubble';

interface WebtoonPanelProps {
  panels: WebtoonPanelSpec[];
  autoAdvance?: boolean;
  onComplete: () => void;
}

const HEIGHT_FACTORS: Record<WebtoonPanelSpec['heightClass'], number> = {
  short: 0.5,
  standard: 0.8,
  tall: 1.2,
  'ultra-tall': 2,
};

const AUTO_ADVANCE_MS = 1800;
const FADE_TRANSITION_MS = 220;
const DARKEN_TRANSITION_MS = 800;
const DARKEN_HOLD_MS = 400;
const DARKEN_REVEAL_MS = 320;

export function WebtoonPanel({
  panels,
  autoAdvance = false,
  onComplete,
}: WebtoonPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [transitionMode, setTransitionMode] = useState<'fade' | 'darken' | null>(null);
  const [revealMode, setRevealMode] = useState<'cut' | 'fade' | 'darken'>('cut');
  const timeoutIdsRef = useRef<number[]>([]);

  const currentPanel = panels[currentIndex];
  const isLastPanel = currentIndex >= panels.length - 1;

  const clearTimers = () => {
    for (const timeoutId of timeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    timeoutIdsRef.current = [];
  };

  const schedule = (callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(callback, delayMs);
    timeoutIdsRef.current.push(timeoutId);
  };

  const advance = () => {
    if (!currentPanel) return;

    if (isLastPanel) {
      onComplete();
      return;
    }

    const nextIndex = currentIndex + 1;

    if (currentPanel.transition === 'cut') {
      setRevealMode('cut');
      setCurrentIndex(nextIndex);
      return;
    }

    if (currentPanel.transition === 'fade') {
      setTransitionMode('fade');
      schedule(() => {
        setTransitionMode(null);
        setRevealMode('fade');
        setCurrentIndex(nextIndex);
      }, FADE_TRANSITION_MS);
      return;
    }

    setTransitionMode('darken');
    schedule(() => {
      setRevealMode('darken');
      setCurrentIndex(nextIndex);
    }, DARKEN_TRANSITION_MS + DARKEN_HOLD_MS);
    schedule(() => {
      setTransitionMode(null);
    }, DARKEN_TRANSITION_MS + DARKEN_HOLD_MS + DARKEN_REVEAL_MS);
  };

  useEffect(() => {
    clearTimers();
    setBubbleVisible(false);

    if (currentPanel?.bubble) {
      schedule(() => setBubbleVisible(true), 200);
    }

    if (autoAdvance) {
      schedule(() => advance(), AUTO_ADVANCE_MS);
    }

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, autoAdvance, currentPanel?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'ArrowRight') {
        return;
      }

      event.preventDefault();
      advance();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => clearTimers, []);

  if (!currentPanel) {
    return null;
  }

  const panelStyle = {
    '--webtoon-gap-height': `${currentPanel.gapBefore.px}px`,
    '--webtoon-gap-color': currentPanel.gapBefore.color,
    '--webtoon-panel-height': `calc(min(100svh, var(--viewport-h, 100vh)) * ${HEIGHT_FACTORS[currentPanel.heightClass]})`,
    '--webtoon-panel-aspect': currentPanel.aspectRatio.replace(':', ' / '),
  } as CSSProperties;

  return (
    <div
      className="webtoon-overlay"
      role="region"
      aria-label="Webtoon sequence"
      onClick={advance}
    >
      <div className={`webtoon-transition${transitionMode ? ` webtoon-transition--${transitionMode}` : ''}`} aria-hidden="true" />

      <div className="webtoon-shell">
        <div className={`webtoon-panel-frame webtoon-panel-frame--${currentPanel.widthType}`} style={panelStyle}>
          <div className="webtoon-panel-gap" aria-hidden="true" />

          <figure
            key={currentPanel.id}
            className={`webtoon-panel-surface webtoon-panel-surface--${revealMode}${currentPanel.isThumbStop ? ' is-thumb-stop' : ''}`}
            aria-label={`${currentPanel.shotType} panel ${currentIndex + 1} of ${panels.length}`}
          >
            <img
              className="webtoon-panel-image"
              src={currentPanel.imageUrl}
              alt={`${currentPanel.shotType} panel ${currentIndex + 1}`}
              draggable={false}
            />

            {currentPanel.bubble ? (
              <WebtoonBubble
                {...currentPanel.bubble}
                visible={bubbleVisible}
              />
            ) : null}
          </figure>
        </div>

        <div className="webtoon-panel-progress" aria-hidden="true">
          {panels.map((panel, index) => (
            <span
              key={panel.id}
              className={`webtoon-panel-progress__dot${index === currentIndex ? ' is-active' : ''}${index < currentIndex ? ' is-complete' : ''}`}
            />
          ))}
        </div>

        {!autoAdvance ? (
          <div className="webtoon-panel-hint">
            Tap anywhere, or press Enter, Space, or <kbd>&rarr;</kbd>.
          </div>
        ) : null}
      </div>
    </div>
  );
}

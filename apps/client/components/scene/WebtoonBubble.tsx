'use client';

import { createPortal } from 'react-dom';
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { WebtoonBubble as WebtoonBubbleSpec } from '@/lib/hangout/fixture-types';

interface WebtoonBubbleProps extends WebtoonBubbleSpec {
  reveal?: { kind: 'free' } | { kind: 'credits'; cost: number } | { kind: 'gamePass' };
  showHelp?: boolean;
  autoOpenKey?: string | null;
  onLockedClick?: () => void;
}

const SPEAKER_LABELS: Record<string, string> = {
  ayi: '方阿姨',
  dingman: '丁漫',
  shoucheng: '瞿守成',
  narrator: '旁白',
};

const CJK_RE = /[\u3400-\u9fff]/;

interface RubySegment {
  char: string;
  py?: string;
}

function buildSegments(zh: string, py?: string[]): RubySegment[] {
  const segments: RubySegment[] = [];
  let pyIndex = 0;
  for (const ch of zh) {
    if (CJK_RE.test(ch) && py?.[pyIndex]) {
      segments.push({ char: ch, py: py[pyIndex] });
      pyIndex++;
    } else {
      segments.push({ char: ch });
    }
  }
  return segments;
}

function bubbleStyle(bubble: WebtoonBubbleSpec): CSSProperties {
  const layout = bubble.layout;
  const align = layout?.align ?? 'center';
  const left = align === 'left' ? '0%' : align === 'right' ? '100%' : '50%';
  const shiftX = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%';
  const yOffset = layout?.offsetYPx ?? 0;

  let top: string | undefined;
  let bottom: string | undefined;

  if (layout?.outside) {
    const overlap = layout.outsideOverlapPx ?? 18;
    if (bubble.position === 'top') {
      bottom = `calc(100% - ${overlap}px + ${yOffset}px)`;
    } else {
      top = `calc(100% - ${overlap}px + ${yOffset}px)`;
    }
  } else if (bubble.position === 'top') {
    top = `calc(6% + ${yOffset}px)`;
  } else if (bubble.position === 'center-bottom') {
    bottom = `calc(16% + ${yOffset}px)`;
  } else {
    bottom = `calc(7% + ${yOffset}px)`;
  }

  return {
    left,
    top,
    bottom,
    ['--wt-bubble-shift-x' as string]: shiftX,
    ['--wt-bubble-shift-nudge' as string]: `${layout?.offsetXPx ?? 0}px`,
    ['--wt-tail-offset' as string]: layout?.tailOffsetPct ? `${layout.tailOffsetPct}%` : undefined,
    ['--wt-bubble-max-width' as string]: layout?.maxWidth,
  };
}

function resolveAnchorTopPx(
  bubble: WebtoonBubbleSpec,
  panelHeight: number,
  bubbleHeight: number,
): number {
  const layout = bubble.layout;
  const yOffset = layout?.offsetYPx ?? 0;

  if (layout?.outside) {
    const overlap = layout.outsideOverlapPx ?? 18;
    if (bubble.position === 'top') {
      return panelHeight - overlap + yOffset - bubbleHeight;
    }
    return panelHeight - overlap + yOffset;
  }

  if (bubble.position === 'top') {
    return panelHeight * 0.06 + yOffset;
  }

  const bottomOffset = panelHeight * (bubble.position === 'center-bottom' ? 0.16 : 0.07) + yOffset;
  return panelHeight - bottomOffset - bubbleHeight;
}

function resolveStablePanelHeight(panel: HTMLElement): number {
  const width = panel.clientWidth;
  if (!width) return panel.getBoundingClientRect().height;

  const aspect = getComputedStyle(panel).aspectRatio;
  const aspectMatch = aspect.match(/^\s*([0-9.]+)\s*\/\s*([0-9.]+)\s*$/);
  if (aspectMatch) {
    const [, w, h] = aspectMatch;
    const ratio = Number(w) / Number(h);
    if (ratio > 0) return width / ratio;
  }

  const image = panel.querySelector('.wt-panel__img');
  if (image instanceof HTMLImageElement && image.naturalWidth > 0 && image.naturalHeight > 0) {
    return width * (image.naturalHeight / image.naturalWidth);
  }

  return panel.getBoundingClientRect().height;
}

export function WebtoonBubble({
  zh,
  py,
  en,
  speaker,
  position,
  layout,
  reveal = { kind: 'free' },
  showHelp = false,
  autoOpenKey = null,
  onLockedClick,
}: WebtoonBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorTopPx, setAnchorTopPx] = useState<number | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bubble = { zh, py, en, speaker, position, layout };
  const speakerLabel = SPEAKER_LABELS[speaker] ?? speaker;
  const hasHelp = Boolean((py && py.length) || en);
  const unlocked = reveal.kind === 'free';
  const interactive = hasHelp;
  const expanded = hasHelp && unlocked && (showHelp || isOpen);
  const segments = buildSegments(zh, py);
  const baseStyle = bubbleStyle(bubble);

  useLayoutEffect(() => {
    if (!autoOpenKey || !hasHelp || !unlocked || showHelp) return;
    setIsOpen(true);
  }, [autoOpenKey, hasHelp, showHelp, unlocked]);

  const syncAnchorTop = useCallback(() => {
    const el = bubbleRef.current;
    const panel = el?.offsetParent as HTMLElement | null;
    if (!el || !panel) return;

    const panelHeight = resolveStablePanelHeight(panel);
    const bubbleHeight = el.getBoundingClientRect().height;
    if (!panelHeight || !bubbleHeight) return;

    const nextTop = resolveAnchorTopPx(bubble, panelHeight, bubbleHeight);
    setAnchorTopPx((prev) => (prev !== null && Math.abs(prev - nextTop) < 0.5 ? prev : nextTop));
  }, [bubble]);

  const syncOutsideReserve = useCallback(() => {
    if (!layout?.outside) return;
    const el = bubbleRef.current;
    const block = el?.closest('.wt-block') as HTMLElement | null;
    if (!el || !block) return;

    const reserveVar = position === 'top' ? '--wt-bubble-reserve-top' : '--wt-bubble-reserve-bottom';
    const reserve = Math.ceil(
      el.getBoundingClientRect().height
      + (layout.outsideOverlapPx ?? 18)
      + 28
      + Math.max(0, Math.abs(layout.offsetYPx ?? 0)),
    );
    block.style.setProperty(reserveVar, `${reserve}px`);
  }, [layout?.offsetYPx, layout?.outside, layout?.outsideOverlapPx, position]);

  const syncOverlayPosition = useCallback(() => {
    if (!expanded || typeof window === 'undefined') return;

    const anchor = bubbleRef.current;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const overlay = overlayRef.current;
    const viewportWidth = window.innerWidth;
    const margin = 12;
    const overlayWidth = overlay?.offsetWidth ?? Math.max(anchorRect.width, 220);
    const align = layout?.align ?? 'center';
    const pageLeft = window.scrollX;
    const pageTop = window.scrollY;

    let left = anchorRect.left + (anchorRect.width - overlayWidth) / 2;
    if (align === 'left') {
      left = anchorRect.left;
    } else if (align === 'right') {
      left = anchorRect.right - overlayWidth;
    }
    left = Math.min(Math.max(left + pageLeft, pageLeft + margin), pageLeft + viewportWidth - overlayWidth - margin);

    const top = pageTop + anchorRect.top;

    setOverlayStyle({
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      minWidth: `${Math.ceil(anchorRect.width)}px`,
      maxWidth: layout?.maxWidth
        ? `min(calc(100vw - 24px), ${layout.maxWidth})`
        : 'min(calc(100vw - 24px), 30rem)',
    });
  }, [expanded, layout?.align, layout?.maxWidth]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        syncAnchorTop();
        syncOutsideReserve();
        syncOverlayPosition();
      });
    };

    const observer = new ResizeObserver(schedule);
    if (bubbleRef.current) observer.observe(bubbleRef.current);
    if (overlayRef.current) observer.observe(overlayRef.current);
    const panel = bubbleRef.current?.offsetParent;
    if (panel instanceof HTMLElement) observer.observe(panel);

    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [expanded, syncAnchorTop, syncOutsideReserve, syncOverlayPosition]);

  const helpSuffix = !hasHelp
    ? ''
    : expanded
      ? '. Translation help is open.'
      : unlocked
        ? '. Tap to reveal translation help.'
        : reveal.kind === 'credits'
          ? `. Help unlocks for ${reveal.cost} SP.`
          : '. Help unlocks with Game Pass.';

  const overlay = expanded && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={overlayRef}
          role={unlocked ? 'button' : undefined}
          tabIndex={unlocked && !showHelp ? 0 : undefined}
          className={`wt-bubble wt-bubble--overlay wt-bubble--${position} wt-bubble--${speaker}`}
          aria-label={`${speakerLabel}: ${zh}. Translation help is open.`}
          aria-expanded
          aria-disabled={!unlocked}
          style={overlayStyle ?? { visibility: 'hidden' }}
          onClick={() => {
            if (!unlocked || showHelp) return;
            setIsOpen(false);
          }}
          onKeyDown={(event) => {
            if (!unlocked || showHelp) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setIsOpen(false);
          }}
        >
          <span className="wt-bubble__help">
            <span className="wt-bubble__speaker">{speakerLabel}</span>
            <span className="wt-bubble__ruby">
              {segments.map((seg, i) => (
                seg.py ? (
                  <ruby key={i} className="wt-ruby">
                    {seg.char}
                    <rt>{seg.py}</rt>
                  </ruby>
                ) : (
                  <span key={i} className="wt-ruby-plain">{seg.char}</span>
                )
              ))}
            </span>
            {en && <span className="wt-bubble__en">{en}</span>}
          </span>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive && !showHelp ? 0 : undefined}
        className={`wt-bubble wt-bubble--${position} wt-bubble--${speaker}`}
        data-expanded={expanded ? 'true' : 'false'}
        aria-label={`${speakerLabel}: ${zh}${helpSuffix}`}
        aria-expanded={unlocked ? expanded : undefined}
        aria-disabled={!interactive}
        style={{
          ...baseStyle,
          top: anchorTopPx !== null ? `${Math.round(anchorTopPx)}px` : baseStyle.top,
          bottom: anchorTopPx !== null ? undefined : baseStyle.bottom,
        }}
        ref={bubbleRef}
        onClick={() => {
          if (!interactive || showHelp) return;
          if (!unlocked) {
            onLockedClick?.();
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (!interactive || showHelp) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          if (!unlocked) {
            onLockedClick?.();
            return;
          }
          setIsOpen((prev) => !prev);
        }}
      >
        <span className="wt-bubble__text">{zh}</span>
      </div>
      {overlay}
    </>
  );
}

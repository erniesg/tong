'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { WebtoonBubble as WebtoonBubbleSpec } from '@/lib/hangout/fixture-types';

interface WebtoonBubbleProps extends WebtoonBubbleSpec {
  reveal?: { kind: 'free' } | { kind: 'credits'; cost: number } | { kind: 'gamePass' };
  showHelp?: boolean;
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

function bubbleStyle(bubble: WebtoonBubbleSpec, lockedTopPx: number | null): CSSProperties {
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

  if (lockedTopPx !== null && !layout?.outside && bubble.position !== 'top') {
    top = `${lockedTopPx}px`;
    bottom = undefined;
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

export function WebtoonBubble({
  zh,
  py,
  en,
  speaker,
  position,
  layout,
  reveal = { kind: 'free' },
  showHelp = false,
}: WebtoonBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [closedTopPx, setClosedTopPx] = useState<number | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const measuredTopRef = useRef<number | null>(null);
  const bubble = { zh, py, en, speaker, position, layout };
  const speakerLabel = SPEAKER_LABELS[speaker] ?? speaker;
  const hasHelp = Boolean((py && py.length) || en);
  const unlocked = reveal.kind === 'free';
  const interactive = hasHelp && unlocked;
  const expanded = interactive && (showHelp || isOpen);
  const segments = buildSegments(zh, py);

  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el || expanded) return;
    const nextTop = el.offsetTop;
    if (measuredTopRef.current === nextTop) return;
    measuredTopRef.current = nextTop;
    setClosedTopPx(nextTop);
  });

  const helpSuffix = !hasHelp
    ? ''
    : expanded
      ? '. Translation help is open.'
      : unlocked
        ? '. Tap to reveal translation help.'
        : reveal.kind === 'credits'
          ? `. Help unlocks for ${reveal.cost} credits.`
          : '. Help unlocks with Game Pass.';

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive && !showHelp ? 0 : undefined}
      className={`wt-bubble wt-bubble--${position} wt-bubble--${speaker}${expanded ? ' is-open' : ''}`}
      aria-label={`${speakerLabel}: ${zh}${helpSuffix}`}
      aria-expanded={interactive ? expanded : undefined}
      aria-disabled={!interactive}
      style={bubbleStyle(bubble, expanded ? closedTopPx : null)}
      ref={bubbleRef}
      onClick={() => {
        if (!interactive || showHelp) return;
        setIsOpen((prev) => !prev);
      }}
      onKeyDown={(event) => {
        if (!interactive || showHelp) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }}
    >
      {!expanded && (
        <span className="wt-bubble__text">{zh}</span>
      )}

      {expanded && (
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
      )}
    </div>
  );
}

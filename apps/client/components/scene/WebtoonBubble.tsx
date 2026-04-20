'use client';

import { useState } from 'react';
import type { WebtoonBubble as WebtoonBubbleSpec } from '@/lib/hangout/fixture-types';

interface WebtoonBubbleProps extends WebtoonBubbleSpec {
  reveal?: { kind: 'free' } | { kind: 'credits'; cost: number } | { kind: 'gamePass' };
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

export function WebtoonBubble({ zh, py, en, speaker, position, reveal = { kind: 'free' } }: WebtoonBubbleProps) {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(reveal.kind === 'free');
  const speakerLabel = SPEAKER_LABELS[speaker] ?? speaker;
  const hasHelp = Boolean((py && py.length) || en);
  const segments = buildSegments(zh, py);

  const handleTap = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!hasHelp) return;
    if (!unlocked) {
      setUnlocked(true);
      setOpen(true);
      return;
    }
    setOpen((prev) => !prev);
  };

  return (
    <button
      type="button"
      className={`wt-bubble wt-bubble--${position} wt-bubble--${speaker}${open ? ' is-open' : ''}`}
      aria-label={`${speakerLabel}: ${zh}${hasHelp ? '. Tap for help.' : ''}`}
      aria-expanded={hasHelp ? open : undefined}
      onClick={handleTap}
    >
      {/* Closed state — just the line, no speaker label. Identity lives in
          the border-color accent. Help hint is a subtle pill. */}
      {!open && (
        <>
          <span className="wt-bubble__text">{zh}</span>
          {hasHelp && (
            <span className="wt-bubble__hint" aria-hidden="true">
              {!unlocked && reveal.kind === 'credits' && `Tap · ${reveal.cost} credits`}
              {!unlocked && reveal.kind === 'gamePass' && 'Tap · Game Pass'}
              {unlocked && 'Tap for help'}
            </span>
          )}
        </>
      )}

      {/* Expanded — speaker name appears, plus ruby-aligned pinyin + english. */}
      {open && unlocked && (
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
          <span className="wt-bubble__hint wt-bubble__hint--open" aria-hidden="true">Tap to hide</span>
        </span>
      )}
    </button>
  );
}

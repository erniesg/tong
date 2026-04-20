'use client';

import { useState } from 'react';
import type { WebtoonBubble as WebtoonBubbleSpec } from '@/lib/hangout/fixture-types';

interface WebtoonBubbleProps extends WebtoonBubbleSpec {
  reveal?: { kind: 'free' } | { kind: 'credits'; cost: number } | { kind: 'gamePass' };
}

const SPEAKER_LABELS: Record<string, string> = {
  ayi: '方阿姨',
  dingman: '丁漫',
  shoucheng: '守成',
  narrator: '旁白',
};

export function WebtoonBubble({ zh, py, en, speaker, position, reveal = { kind: 'free' } }: WebtoonBubbleProps) {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(reveal.kind === 'free');
  const speakerLabel = SPEAKER_LABELS[speaker] ?? speaker;
  const hasTooltip = Boolean(py || en);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!hasTooltip) return;
    if (!unlocked) {
      setUnlocked(true);
      setOpen(true);
      return;
    }
    setOpen((prev) => !prev);
  };

  return (
    <div
      className={`webtoon-bubble webtoon-bubble--${position}`}
      role="note"
      aria-label={`${speakerLabel}: ${zh}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="webtoon-bubble__button"
        aria-expanded={hasTooltip ? open : undefined}
        onClick={handleClick}
      >
        <span className="webtoon-bubble__speaker">{speakerLabel}</span>
        <span className="webtoon-bubble__text">{zh}</span>
        {!unlocked && reveal.kind === 'credits' && (
          <span className="webtoon-bubble__lock">🔒 {reveal.cost} credits</span>
        )}
        {!unlocked && reveal.kind === 'gamePass' && (
          <span className="webtoon-bubble__lock">🔒 Game Pass</span>
        )}
      </button>

      {hasTooltip && unlocked && open && (
        <div className="webtoon-bubble__tooltip" role="dialog">
          {py ? <p className="webtoon-bubble__tooltip-line webtoon-bubble__tooltip-line--py">{py}</p> : null}
          {en ? <p className="webtoon-bubble__tooltip-line webtoon-bubble__tooltip-line--en">{en}</p> : null}
        </div>
      )}
    </div>
  );
}

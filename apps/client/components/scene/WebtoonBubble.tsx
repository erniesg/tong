'use client';

import { useState } from 'react';
import type { WebtoonBubble as WebtoonBubbleSpec } from '@/lib/hangout/fixture-types';

interface WebtoonBubbleProps extends WebtoonBubbleSpec {
  visible?: boolean;
}

const SPEAKER_LABELS: Record<string, string> = {
  ayi: '方阿姨',
  dingman: '丁漫',
  shoucheng: '守成',
  narrator: '旁白',
};

export function WebtoonBubble({
  zh,
  py,
  en,
  speaker,
  position,
  visible = false,
}: WebtoonBubbleProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const hasTooltip = Boolean(py || en);
  const speakerLabel = SPEAKER_LABELS[speaker] ?? speaker;

  return (
    <div
      className={`webtoon-bubble webtoon-bubble--${position}${visible ? ' is-visible' : ''}`}
      role="note"
      aria-label={`${speakerLabel}: ${zh}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="webtoon-bubble__button"
        aria-expanded={hasTooltip ? tooltipOpen : undefined}
        aria-label={hasTooltip ? `${speakerLabel}: ${zh}. Tap to toggle pinyin and translation.` : `${speakerLabel}: ${zh}`}
        onClick={() => {
          if (!hasTooltip) return;
          setTooltipOpen((open) => !open);
        }}
      >
        <span className="webtoon-bubble__speaker">{speakerLabel}</span>
        <span className="webtoon-bubble__text">{zh}</span>
      </button>

      {hasTooltip && tooltipOpen && (
        <div className="webtoon-bubble__tooltip" role="dialog" aria-label="Bubble translation">
          {py ? <p className="webtoon-bubble__tooltip-line webtoon-bubble__tooltip-line--py">{py}</p> : null}
          {en ? <p className="webtoon-bubble__tooltip-line webtoon-bubble__tooltip-line--en">{en}</p> : null}
        </div>
      )}
    </div>
  );
}

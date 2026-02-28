'use client';

import { useState, useEffect, useRef } from 'react';
import { KoreanText } from '@/components/shared/KoreanText';

interface DialogueBoxProps {
  speakerName?: string;
  speakerColor?: string;
  content: string;
  translation?: string;
  isStreaming?: boolean;
  onContinue?: () => void;
}

const CHARS_PER_TICK = 2;
const TICK_MS = 30;

export function DialogueBox({
  speakerName,
  speakerColor = 'var(--color-primary)',
  content,
  translation,
  isStreaming,
  onContinue,
}: DialogueBoxProps) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const [typewriterDone, setTypewriterDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    setDisplayedChars(0);
    setTypewriterDone(false);

    const timer = setInterval(() => {
      setDisplayedChars((prev) => {
        const next = prev + CHARS_PER_TICK;
        if (next >= content.length) {
          clearInterval(timer);
          setTypewriterDone(true);
          return content.length;
        }
        return next;
      });
    }, TICK_MS);

    timerRef.current = timer;
    return () => clearInterval(timer);
  }, [content]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.text-ko[data-korean]')) return;

    if (!typewriterDone) {
      if (timerRef.current) clearInterval(timerRef.current);
      setDisplayedChars(content.length);
      setTypewriterDone(true);
      return;
    }
    if (!isStreaming && onContinue) {
      onContinue();
    }
  };

  const visibleText = content.slice(0, displayedChars);

  return (
    <div
      className="dialogue-subtitle absolute bottom-0 left-0 right-0 cursor-pointer fade-in"
      onClick={handleClick}
    >
      {speakerName && (
        <div
          className="dialogue-speaker"
          style={{ color: speakerColor }}
        >
          {speakerName}
        </div>
      )}

      <div className="dialogue-text text-ko">
        {typewriterDone ? (
          <KoreanText text={content} />
        ) : (
          <>
            {visibleText}
            <span className="typewriter-cursor" />
          </>
        )}
      </div>

      {typewriterDone && translation && (
        <p className="dialogue-translation">{translation}</p>
      )}

      {typewriterDone && !isStreaming && onContinue && (
        <div className="dialogue-continue animate-pulse">
          tap to continue ▼
        </div>
      )}
    </div>
  );
}

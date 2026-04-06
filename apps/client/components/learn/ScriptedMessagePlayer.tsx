'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCitySkin } from '@/lib/theme/city-skins';
import { tongAvatarUrl } from './TongBubble';
import { ChatRow } from './ChatRow';

type ScriptedMessagingPlayerState = 'idle' | 'playing' | 'paused' | 'finished';

type ScriptedMessagingTranslationMode =
  | 'primary_only'
  | 'primary_with_english'
  | 'primary_with_local_and_english';

type ScriptedMessagingSpeaker = 'tong' | 'partner' | 'player';

interface ScriptedMessagingSceneRow {
  rowId: string;
  speaker: ScriptedMessagingSpeaker;
  speakerLabel: string;
  primaryText: string;
  englishText?: string;
  localExplanationText?: string;
  typingDurationMs: number;
  revealDelayMs: number;
}

interface ScriptedMessagingScene {
  sceneId: string;
  cityId: 'seoul' | 'tokyo' | 'shanghai';
  lang: 'ko' | 'ja' | 'zh';
  title: string;
  hookText: string;
  defaultTranslationMode: ScriptedMessagingTranslationMode;
  rows: ScriptedMessagingSceneRow[];
}

interface ScriptedMessagePlayerProps {
  scene: ScriptedMessagingScene;
  translationMode?: ScriptedMessagingTranslationMode;
  autoPlay?: boolean;
  onStateChange?: (state: ScriptedMessagingPlayerState) => void;
}

function getVisibleRows(
  rows: ScriptedMessagingSceneRow[],
  mode: ScriptedMessagingTranslationMode,
): ScriptedMessagingSceneRow[] {
  return rows.map((row) => {
    if (mode === 'primary_only') {
      return { ...row, englishText: undefined, localExplanationText: undefined };
    }
    if (mode === 'primary_with_english') {
      return { ...row, localExplanationText: undefined };
    }
    return row;
  });
}

export function ScriptedMessagePlayer({
  scene,
  translationMode,
  autoPlay = false,
  onStateChange,
}: ScriptedMessagePlayerProps) {
  const [playerState, setPlayerState] = useState<ScriptedMessagingPlayerState>('idle');
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  const timerRef = useRef<number | null>(null);

  const effectiveTranslationMode = translationMode ?? scene.defaultTranslationMode;
  const rows = useMemo(
    () => getVisibleRows(scene.rows, effectiveTranslationMode),
    [scene.rows, effectiveTranslationMode],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const emitState = useCallback((state: ScriptedMessagingPlayerState) => {
    setPlayerState(state);
    onStateChange?.(state);
  }, [onStateChange]);

  const stop = useCallback(() => {
    clearTimer();
    setActiveRowIndex(null);
  }, [clearTimer]);

  const scheduleNext = useCallback((nextIndex: number) => {
    if (nextIndex >= rows.length) {
      setActiveRowIndex(null);
      emitState('finished');
      return;
    }

    const row = rows[nextIndex];
    setActiveRowIndex(nextIndex);

    timerRef.current = window.setTimeout(() => {
      setVisibleCount((current) => Math.max(current, nextIndex + 1));
      setActiveRowIndex(null);

      timerRef.current = window.setTimeout(() => {
        scheduleNext(nextIndex + 1);
      }, row.revealDelayMs);
    }, row.typingDurationMs);
  }, [emitState, rows]);

  const start = useCallback(() => {
    stop();
    setVisibleCount(0);
    emitState('playing');
    scheduleNext(0);
  }, [emitState, scheduleNext, stop]);

  const pause = useCallback(() => {
    if (playerState !== 'playing') return;
    clearTimer();
    emitState('paused');
  }, [clearTimer, emitState, playerState]);

  const resume = useCallback(() => {
    if (playerState !== 'paused') return;
    emitState('playing');
    scheduleNext(visibleCount);
  }, [emitState, playerState, scheduleNext, visibleCount]);

  const replay = useCallback(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (autoPlay) {
      start();
    }
    return () => {
      stop();
    };
  }, [autoPlay, start, stop]);

  useEffect(() => {
    stop();
    setVisibleCount(0);
    emitState('idle');
  }, [scene.sceneId, effectiveTranslationMode, emitState, stop]);

  return (
    <div data-city-skin={getCitySkin(scene.cityId)} className="learn-chat-container">
      <div className="session-picker__header mb-4">
        <div className="session-picker__title">{scene.title}</div>
        <div className="session-picker__subtitle">{scene.hookText}</div>
      </div>

      <div className="learn-chat-scroll">
        {rows.slice(0, visibleCount).map((row) => {
          const side = row.speaker === 'player' ? 'right' : 'left';
          const avatarUrl = row.speaker === 'tong' ? tongAvatarUrl('cheerful') : undefined;
          return (
            <ChatRow key={row.rowId} side={side} avatarUrl={avatarUrl} name={side === 'left' ? row.speakerLabel : undefined}>
              <div className={`msg-bubble ${side === 'left' ? 'msg-bubble--npc bubble-tail-left' : 'msg-bubble--user bubble-tail-right'}`}>
                <p className="m-0 text-ko">{row.primaryText}</p>
                {row.localExplanationText && (
                  <p className="m-0 mt-1 text-[length:var(--game-text-sm)] msg-bubble__translation">{row.localExplanationText}</p>
                )}
                {row.englishText && (
                  <p className="m-0 mt-1 text-[length:var(--game-text-sm)] msg-bubble__translation">{row.englishText}</p>
                )}
              </div>
            </ChatRow>
          );
        })}

        {activeRowIndex !== null && (
          <ChatRow
            side={rows[activeRowIndex]?.speaker === 'player' ? 'right' : 'left'}
            avatarUrl={rows[activeRowIndex]?.speaker === 'tong' ? tongAvatarUrl('thinking') : undefined}
            name={rows[activeRowIndex]?.speaker !== 'player' ? rows[activeRowIndex]?.speakerLabel : undefined}
          >
            <div className="msg-bubble msg-bubble--npc">
              <div className="typing-indicator">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </ChatRow>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="session-picker__start-btn" type="button" onClick={start} disabled={playerState === 'playing'}>
          Start
        </button>
        <button className="session-picker__start-btn" type="button" onClick={pause} disabled={playerState !== 'playing'}>
          Pause
        </button>
        <button className="session-picker__start-btn" type="button" onClick={resume} disabled={playerState !== 'paused'}>
          Resume
        </button>
        <button className="session-picker__start-btn" type="button" onClick={replay}>
          Replay
        </button>
        <span className="session-picker__subtitle self-center">state: {playerState}</span>
      </div>
    </div>
  );
}

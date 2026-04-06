'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import type {
  ScriptedMessagingPlayerState,
  ScriptedMessagingScene,
  ScriptedMessagingTranslationMode,
} from '../../../../packages/contracts';
import { getCitySkin, type CitySkinId } from '@/lib/theme/city-skins';

import { ChatRow } from './ChatRow';

interface ScriptedMessagingPlayerProps {
  scene: ScriptedMessagingScene;
  translationMode: ScriptedMessagingTranslationMode;
  tickMs?: number;
  hookOverlayMs?: number;
  showHookOverlay?: boolean;
  showControls?: boolean;
  onStateChange?: (state: ScriptedMessagingPlayerState) => void;
  onElapsedChange?: (elapsedMs: number) => void;
}

export interface ScriptedMessagingPlayerHandle {
  play: () => void;
  pause: () => void;
  restart: () => void;
  jumpToSceneStart: () => void;
  getSnapshot: () => {
    state: ScriptedMessagingPlayerState;
    elapsedMs: number;
  };
}

function byCityPalette(skin: CitySkinId) {
  if (skin === 'tokyo') return { bg: 'rgba(237, 246, 255, 0.75)', border: 'rgba(37, 99, 235, 0.24)' };
  if (skin === 'shanghai') return { bg: 'rgba(238, 250, 246, 0.75)', border: 'rgba(15, 118, 110, 0.26)' };
  return { bg: 'rgba(255, 243, 231, 0.72)', border: 'rgba(249, 115, 22, 0.25)' };
}

export const ScriptedMessagingPlayer = forwardRef<ScriptedMessagingPlayerHandle, ScriptedMessagingPlayerProps>(function ScriptedMessagingPlayer(
  {
    scene,
    translationMode,
    tickMs = 100,
    hookOverlayMs = 1800,
    showHookOverlay = false,
    showControls = true,
    onStateChange,
    onElapsedChange,
  },
  ref,
) {
  const [state, setState] = useState<ScriptedMessagingPlayerState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const skin = getCitySkin(scene.cityId);
  const palette = byCityPalette(skin);

  const maxAtMs = useMemo(
    () => scene.rows.reduce((max, row) => Math.max(max, row.atMs), 0),
    [scene.rows],
  );

  useEffect(() => {
    setState('idle');
    setElapsedMs(0);
  }, [scene.sceneId]);

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    onElapsedChange?.(elapsedMs);
  }, [elapsedMs, onElapsedChange]);

  useEffect(() => {
    if (state !== 'playing') return;

    const timer = window.setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + tickMs;
        if (next >= maxAtMs + 1000) {
          setState('finished');
          return maxAtMs + 1000;
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [maxAtMs, state, tickMs]);

  const visibleRows = scene.rows.filter((row) => row.atMs <= elapsedMs);
  const typingRow = scene.rows.find((row) => {
    const typingMs = row.typingMs ?? 0;
    return typingMs > 0 && elapsedMs >= row.atMs - typingMs && elapsedMs < row.atMs;
  });

  const play = useCallback(() => {
    setState((prev) => {
      if (prev === 'finished') {
        setElapsedMs(0);
      }
      return 'playing';
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => (prev === 'playing' ? 'paused' : prev));
  }, []);

  const restart = useCallback(() => {
    setElapsedMs(0);
    setState('playing');
  }, []);

  const jumpToSceneStart = useCallback(() => {
    setElapsedMs(0);
    setState((prev) => (prev === 'playing' ? 'paused' : prev === 'finished' ? 'idle' : prev));
  }, []);

  useImperativeHandle(ref, () => ({
    play,
    pause,
    restart,
    jumpToSceneStart,
    getSnapshot: () => ({ state, elapsedMs }),
  }), [elapsedMs, jumpToSceneStart, pause, play, restart, state]);

  const progress = maxAtMs > 0 ? Math.min(100, (elapsedMs / (maxAtMs + 1000)) * 100) : 0;
  const showHookCard = Boolean(scene.hookText) && showHookOverlay && elapsedMs < hookOverlayMs;

  return (
    <section className="learn-chat-container" data-city-skin={skin} style={{ position: 'relative' }}>
      {showHookCard && scene.hookText && (
        <div
          style={{
            position: 'absolute',
            inset: 12,
            zIndex: 2,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background: 'rgba(8, 15, 32, 0.72)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {scene.hookText}
        </div>
      )}

      <div style={{ padding: 12, borderRadius: 14, background: palette.bg, border: `1px solid ${palette.border}`, margin: 10 }}>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>{scene.title}</p>
        {!showHookOverlay && scene.hookText && <p style={{ margin: '4px 0 0', fontSize: 13 }}>{scene.hookText}</p>}
        <p style={{ margin: '8px 0 0', fontSize: 12 }}>
          <strong>state:</strong> {state} · <strong>t:</strong> {elapsedMs}ms
        </p>
        <div aria-hidden style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'rgba(0, 0, 0, 0.08)' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'rgba(0,0,0,0.35)' }} />
        </div>
      </div>

      <div className="learn-chat-scroll" style={{ maxHeight: 420 }}>
        {visibleRows.map((row) => {
          const speaker = scene.speakers.find((item) => item.id === row.speakerId);
          const side = row.speakerId === 'player' ? 'right' : 'left';
          const showEnglish = translationMode !== 'primary_only' && row.englishText;
          const showLocal = translationMode === 'primary_local_explanation_with_english' && row.localExplanationText;

          return (
            <ChatRow
              key={row.rowId}
              side={side}
              name={speaker?.displayName}
              avatarEmoji={speaker?.avatarEmoji}
            >
              <div className={`msg-bubble ${side === 'left' ? 'msg-bubble--npc bubble-tail-left' : 'msg-bubble--user bubble-tail-right'}`}>
                <div>{row.primaryText}</div>
                {showLocal && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{row.localExplanationText}</div>}
                {showEnglish && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{row.englishText}</div>}
              </div>
            </ChatRow>
          );
        })}

        {typingRow && (
          <ChatRow side={typingRow.speakerId === 'player' ? 'right' : 'left'}>
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

      {showControls && (
        <div style={{ display: 'flex', gap: 8, padding: 8, flexWrap: 'wrap' }}>
          <button type="button" className="tg-chip" onClick={play}>Play</button>
          <button type="button" className="tg-chip" onClick={pause}>Pause</button>
          <button type="button" className="tg-chip" onClick={restart}>Restart</button>
          <button type="button" className="tg-chip" onClick={jumpToSceneStart}>Jump to scene start</button>
        </div>
      )}
    </section>
  );
});

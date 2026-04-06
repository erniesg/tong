'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  initialElapsedMs?: number;
  initialState?: ScriptedMessagingPlayerState;
  sceneStartMs?: number;
  hideDefaultControls?: boolean;
  controlSignal?: {
    id: number;
    action: 'play' | 'pause' | 'restart' | 'jump_to_scene_start';
  };
  onElapsedChange?: (elapsedMs: number) => void;
  onStateChange?: (state: ScriptedMessagingPlayerState) => void;
}

function byCityPalette(skin: CitySkinId) {
  if (skin === 'tokyo') return { bg: 'rgba(237, 246, 255, 0.75)', border: 'rgba(37, 99, 235, 0.24)' };
  if (skin === 'shanghai') return { bg: 'rgba(238, 250, 246, 0.75)', border: 'rgba(15, 118, 110, 0.26)' };
  return { bg: 'rgba(255, 243, 231, 0.72)', border: 'rgba(249, 115, 22, 0.25)' };
}

export function ScriptedMessagingPlayer({
  scene,
  translationMode,
  tickMs = 100,
  initialElapsedMs = 0,
  initialState = 'idle',
  sceneStartMs,
  hideDefaultControls = false,
  controlSignal,
  onElapsedChange,
  onStateChange,
}: ScriptedMessagingPlayerProps) {
  const [state, setState] = useState<ScriptedMessagingPlayerState>(initialState);
  const [elapsedMs, setElapsedMs] = useState(initialElapsedMs);
  const skin = getCitySkin(scene.cityId);
  const palette = byCityPalette(skin);
  const effectiveSceneStartMs = sceneStartMs ?? scene.rows[0]?.atMs ?? 0;

  const maxAtMs = useMemo(
    () => scene.rows.reduce((max, row) => Math.max(max, row.atMs), 0),
    [scene.rows],
  );

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    onElapsedChange?.(elapsedMs);
  }, [elapsedMs, onElapsedChange]);

  useEffect(() => {
    setElapsedMs(initialElapsedMs);
    setState(initialState);
  }, [initialElapsedMs, initialState, scene.sceneId]);

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

  useEffect(() => {
    if (!controlSignal) return;
    if (controlSignal.action === 'play') {
      setState('playing');
      return;
    }
    if (controlSignal.action === 'pause') {
      setState((prev) => (prev === 'playing' ? 'paused' : prev));
      return;
    }
    if (controlSignal.action === 'restart') {
      setElapsedMs(0);
      setState('playing');
      return;
    }
    setElapsedMs(effectiveSceneStartMs);
    setState('paused');
  }, [controlSignal, effectiveSceneStartMs]);

  const visibleRows = scene.rows.filter((row) => row.atMs <= elapsedMs);
  const typingRow = scene.rows.find((row) => {
    const typingMs = row.typingMs ?? 0;
    return typingMs > 0 && elapsedMs >= row.atMs - typingMs && elapsedMs < row.atMs;
  });

  const start = useCallback(() => {
    setElapsedMs(0);
    setState('playing');
  }, []);

  const pause = useCallback(() => {
    setState((prev) => (prev === 'playing' ? 'paused' : prev));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => (prev === 'paused' ? 'playing' : prev));
  }, []);

  const reset = useCallback(() => {
    setElapsedMs(0);
    setState('idle');
  }, []);

  return (
    <section className="learn-chat-container" data-city-skin={skin}>
      <div style={{ padding: 12, borderRadius: 14, background: palette.bg, border: `1px solid ${palette.border}` }}>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.72 }}>{scene.title}</p>
        {scene.hookText && <p style={{ margin: '4px 0 0', fontSize: 13 }}>{scene.hookText}</p>}
        <p style={{ margin: '8px 0 0', fontSize: 12 }}>
          <strong>state:</strong> {state} · <strong>t:</strong> {elapsedMs}ms
        </p>
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

      {!hideDefaultControls && (
        <div style={{ display: 'flex', gap: 8, padding: 8 }}>
          <button type="button" className="tg-chip" onClick={start}>Start</button>
          <button type="button" className="tg-chip" onClick={pause}>Pause</button>
          <button type="button" className="tg-chip" onClick={resume}>Resume</button>
          <button type="button" className="tg-chip" onClick={reset}>Reset</button>
        </div>
      )}
    </section>
  );
}

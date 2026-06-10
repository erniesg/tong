'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'rrweb/dist/style.css';

export type RrwebEventJson = { type: number; data: unknown; timestamp: number };

/* Minimal Replayer surface — rrweb-player 2.0.1 ships a broken dist (its
   compiled Player never constructs a Replayer), so we drive rrweb's
   Replayer directly with our own controls. */
interface ReplayerLike {
  play: (timeOffset?: number) => void;
  pause: (timeOffset?: number) => void;
  getCurrentTime: () => number;
  getMetaData: () => { startTime: number; endTime: number; totalTime: number };
  setConfig: (config: { speed?: number }) => void;
  on: (event: string, handler: () => void) => void;
  destroy?: () => void;
}

/* The session's true viewport comes from rrweb's Meta event (type 4) */
const metaDimensions = (events: RrwebEventJson[]): { width: number; height: number } => {
  const meta = events.find((e) => e.type === 4) as
    | { data: { width?: number; height?: number } }
    | undefined;
  return {
    width: meta?.data?.width || 390,
    height: meta?.data?.height || 844,
  };
};

const fmtMs = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  events: RrwebEventJson[];
  maxWidth?: number;
  maxHeight?: number;
  onPin?: (timestampMs: number) => void;
}

/**
 * Replays an rrweb event stream. The replay runs in the viewer's real
 * browser engine, so cross-origin art and videos render natively — no
 * html2canvas approximation.
 */
export function RrwebReplay({ events, maxWidth = 480, maxHeight = 600, onPin }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<ReplayerLike | null>(null);
  const rafRef = useRef<number>();
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || events.length < 2) return;
    let replayer: ReplayerLike | null = null;
    let cancelled = false;

    void import('rrweb').then(({ Replayer }) => {
      if (cancelled || !stageRef.current) return;
      replayer = new Replayer(events as unknown as ConstructorParameters<typeof Replayer>[0], {
        root: el,
        UNSAFE_replayCanvas: true, // StrokeTracing exercises record canvas
        showWarning: false,
      }) as unknown as ReplayerLike;
      replayerRef.current = replayer;
      setTotalMs(replayer.getMetaData().totalTime);

      // Scale the native-viewport iframe into the stage box
      const native = metaDimensions(events);
      const scale = Math.min(maxWidth / native.width, maxHeight / native.height, 1);
      el.style.width = `${Math.round(native.width * scale)}px`;
      el.style.height = `${Math.round(native.height * scale)}px`;
      const wrapper = el.querySelector('.replayer-wrapper') as HTMLElement | null;
      if (wrapper) {
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.transformOrigin = 'top left';
      }

      replayer.on('finish', () => setPlaying(false));
      replayer.pause(0); // render the first frame
      setReady(true);
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { replayer?.pause(); } catch { /* not started */ }
      try { replayer?.destroy?.(); } catch { /* already gone */ }
      replayerRef.current = null;
      el.innerHTML = '';
      setReady(false);
      setPlaying(false);
      setCurrentMs(0);
    };
  }, [events, maxWidth, maxHeight]);

  // Progress readout while playing
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const r = replayerRef.current;
      if (r) setCurrentMs(Math.min(r.getCurrentTime(), totalMs));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, totalMs]);

  const togglePlay = useCallback(() => {
    const r = replayerRef.current;
    if (!r) return;
    if (playing) {
      r.pause(r.getCurrentTime());
      setPlaying(false);
    } else {
      r.play(currentMs >= totalMs ? 0 : currentMs);
      setPlaying(true);
    }
  }, [playing, currentMs, totalMs]);

  const seek = useCallback((ms: number) => {
    const r = replayerRef.current;
    if (!r) return;
    if (playing) r.play(ms);
    else r.pause(ms);
    setCurrentMs(ms);
  }, [playing]);

  const cycleSpeed = useCallback(() => {
    const next = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    replayerRef.current?.setConfig({ speed: next });
    setSpeed(next);
  }, [speed]);

  return (
    <div className="pv-rrweb-player">
      <div ref={stageRef} className="pv-rrweb-stage" />
      <div className="pv-filmstrip-controls">
        <button onClick={togglePlay} disabled={!ready}>
          {playing ? '⏸' : '▶'}
        </button>
        <span className="pv-filmstrip-time">{fmtMs(currentMs)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, totalMs)}
          value={Math.min(currentMs, totalMs)}
          onChange={(e) => seek(Number(e.target.value))}
          className="pv-filmstrip-scrubber"
          disabled={!ready}
        />
        <span className="pv-filmstrip-time">{fmtMs(totalMs)}</span>
        <button onClick={cycleSpeed} disabled={!ready} title="Playback speed">
          {speed}x
        </button>
        {onPin && (
          <button onClick={() => onPin(currentMs)} disabled={!ready} title="Pin replay timestamp">
            Pin
          </button>
        )}
      </div>
    </div>
  );
}

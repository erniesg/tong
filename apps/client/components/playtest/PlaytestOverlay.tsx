'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

export interface Annotation {
  id: string;
  timestamp: number;
  type: 'draw' | 'comment';
  pathData?: string;
  color?: string;
  text?: string;
  clarified?: boolean;
  category?: string;
  severity?: number;
  screenshot?: string;
  x?: number;
  y?: number;
}

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  sessionId: string;
  onSubmit: (data: {
    recording: Blob;
    annotations: Annotation[];
    screenshots: Map<string, Blob>;
  }) => void;
  onRequestClarification?: (comment: Annotation) => Promise<string | null>;
}

type Tool = 'none' | 'pen' | 'highlight' | 'comment';

/* ── Component ────────────────────────────────────────────────────── */

export function PlaytestOverlay({ targetRef, sessionId, onSubmit, onRequestClarification }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Frame capture: hidden canvas mirrors the game viewport via rAF
  const frameCaptureRef = useRef<HTMLCanvasElement | null>(null);
  const frameLoopRef = useRef<number>(0);

  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [penColor, setPenColor] = useState('#ff6b2c');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentPos, setCommentPos] = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const draggingPin = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPath = useRef<string[]>([]);
  const screenshotBlobsRef = useRef<Map<string, Blob>>(new Map());

  const currentTimestamp = useCallback(() => {
    if (!startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /* ── Frame capture: mirror viewport to hidden canvas ──────────── */

  const startFrameCapture = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;

    // Create a hidden canvas that mirrors the DOM
    let fc = frameCaptureRef.current;
    if (!fc) {
      fc = document.createElement('canvas');
      fc.style.display = 'none';
      document.body.appendChild(fc);
      frameCaptureRef.current = fc;
    }

    const captureFrame = () => {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (fc!.width !== rect.width || fc!.height !== rect.height) {
        fc!.width = rect.width;
        fc!.height = rect.height;
      }

      // Use the target's internal canvases if available (game renders to <canvas>)
      const gameCanvases = target.querySelectorAll('canvas');
      const ctx = fc!.getContext('2d');
      if (ctx && gameCanvases.length > 0) {
        ctx.clearRect(0, 0, fc!.width, fc!.height);
        // Draw game background
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, fc!.width, fc!.height);
        // Composite all game canvases
        for (const gc of gameCanvases) {
          try {
            const gcRect = gc.getBoundingClientRect();
            ctx.drawImage(gc,
              gcRect.left - rect.left, gcRect.top - rect.top,
              gcRect.width, gcRect.height,
            );
          } catch { /* tainted canvas — skip */ }
        }
      }
      frameLoopRef.current = requestAnimationFrame(captureFrame);
    };

    frameLoopRef.current = requestAnimationFrame(captureFrame);
  }, [targetRef]);

  /* ── Screenshot capture ──────────────────────────────────────── */

  const captureScreenshot = useCallback(async (annotationId: string): Promise<void> => {
    const target = targetRef.current;
    if (!target) return;
    try {
      const rect = target.getBoundingClientRect();
      const offscreen = document.createElement('canvas');
      offscreen.width = rect.width;
      offscreen.height = rect.height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      // Try frame capture canvas first (most reliable)
      const fc = frameCaptureRef.current;
      if (fc && fc.width > 0) {
        ctx.drawImage(fc, 0, 0, rect.width, rect.height);
      } else {
        // Fallback: try to capture game canvases directly
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, rect.width, rect.height);
        const gameCanvases = target.querySelectorAll('canvas');
        for (const gc of gameCanvases) {
          try {
            const gcRect = gc.getBoundingClientRect();
            ctx.drawImage(gc, gcRect.left - rect.left, gcRect.top - rect.top, gcRect.width, gcRect.height);
          } catch { /* skip tainted */ }
        }
      }

      // Composite drawing overlay
      const drawingCanvas = canvasRef.current;
      if (drawingCanvas) {
        ctx.drawImage(drawingCanvas, 0, 0);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        offscreen.toBlob(resolve, 'image/png'),
      );
      if (blob) {
        screenshotBlobsRef.current.set(annotationId, blob);
      }
    } catch { /* best-effort */ }
  }, [targetRef]);

  /* ── Recording: auto-start using canvas.captureStream() ────── */

  const startRecording = useCallback(() => {
    const fc = frameCaptureRef.current;
    if (!fc) return;

    try {
      const stream = fc.captureStream(15); // 15 fps — good quality, small files
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
        videoBitsPerSecond: 1_000_000,
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error('Failed to start canvas recording:', err);
    }
  }, []);

  const stopAndSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      // No recording — submit annotations only
      const emptyBlob = new Blob([], { type: 'video/webm' });
      onSubmit({ recording: emptyBlob, annotations, screenshots: screenshotBlobsRef.current });
      return;
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      onSubmit({ recording: blob, annotations, screenshots: screenshotBlobsRef.current });
    };
    if (recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
  }, [annotations, onSubmit]);

  // Auto-start: begin frame capture + recording when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      startFrameCapture();
      // Small delay to let frame capture initialize
      setTimeout(() => startRecording(), 500);
    }, 1000); // Wait for game to render first frame
    return () => clearTimeout(timer);
  }, [startFrameCapture, startRecording]);

  /* ── Drawing ───────────────────────────────────────────────────── */

  const getCanvasPos = useCallback(
    (e: React.PointerEvent): [number, number] => {
      const canvas = canvasRef.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool !== 'pen' && activeTool !== 'highlight') return;
      isDrawing.current = true;
      const [x, y] = getCanvasPos(e);
      currentPath.current = [`M ${x} ${y}`];
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = activeTool === 'highlight' ? 20 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = activeTool === 'highlight' ? 0.35 : 1;
    },
    [activeTool, penColor, getCanvasPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return;
      const [x, y] = getCanvasPos(e);
      currentPath.current.push(`L ${x} ${y}`);
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [getCanvasPos],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.globalAlpha = 1;
    if (currentPath.current.length > 1) {
      const id = `draw-${Date.now()}`;
      setAnnotations((prev) => [...prev, {
        id, timestamp: currentTimestamp(), type: 'draw',
        pathData: currentPath.current.join(' '), color: penColor, screenshot: id,
      }]);
      void captureScreenshot(id);
    }
    currentPath.current = [];
  }, [penColor, currentTimestamp, captureScreenshot]);

  /* ── Comment ───────────────────────────────────────────────────── */

  const submitComment = useCallback(async () => {
    if (!commentText.trim() || !commentPos) return;
    const id = `comment-${Date.now()}`;
    const annotation: Annotation = {
      id, timestamp: currentTimestamp(), type: 'comment',
      text: commentText.trim(), x: commentPos.x, y: commentPos.y,
      clarified: false, screenshot: id,
    };
    setAnnotations((prev) => [...prev, annotation]);
    setCommentText('');
    setAiReply(null);
    void captureScreenshot(id);

    if (onRequestClarification) {
      setAiLoading(true);
      try {
        const reply = await onRequestClarification(annotation);
        if (reply) setAiReply(reply);
      } catch { /* optional */ } finally {
        setAiLoading(false);
      }
    } else {
      setCommentPos(null);
    }
  }, [commentText, commentPos, currentTimestamp, onRequestClarification, captureScreenshot]);

  const handleAiResponse = useCallback(
    (response: string) => {
      setAnnotations((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.type === 'comment') {
          last.text += `\n---\nAI: ${aiReply}\nUser: ${response}`;
          last.clarified = true;
        }
        return updated;
      });
      setAiReply(null);
      setCommentPos(null);
    },
    [aiReply],
  );

  const dismissAi = useCallback(() => {
    setAnnotations((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.type === 'comment') last.clarified = true;
      return updated;
    });
    setAiReply(null);
    setCommentPos(null);
  }, []);

  /* ── Draggable pins ────────────────────────────────────────────── */

  const handlePinDragStart = useCallback((id: string, clientX: number, clientY: number) => {
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    draggingPin.current = { id, startX: clientX, startY: clientY, origX: ann.x ?? 0.5, origY: ann.y ?? 0.5 };
  }, [annotations]);

  const handlePinDragMove = useCallback((clientX: number, clientY: number) => {
    const d = draggingPin.current;
    if (!d) return;
    const dx = (clientX - d.startX) / window.innerWidth;
    const dy = (clientY - d.startY) / window.innerHeight;
    const newX = Math.max(0, Math.min(1, d.origX + dx));
    const newY = Math.max(0, Math.min(1, d.origY + dy));
    setAnnotations((prev) =>
      prev.map((a) => a.id === d.id ? { ...a, x: newX, y: newY } : a),
    );
  }, []);

  const handlePinDragEnd = useCallback(() => {
    draggingPin.current = null;
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => handlePinDragMove(e.clientX, e.clientY);
    const onUp = () => handlePinDragEnd();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handlePinDragMove, handlePinDragEnd]);

  /* ── Resize canvas ─────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [activeTool]);

  /* ── Auto-save on navigate away / tab close ──────────────────── */

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (annotations.length > 0 || chunksRef.current.length > 0) {
        // Try to upload what we have via sendBeacon
        const data = JSON.stringify(annotations);
        navigator.sendBeacon?.(
          `${typeof window !== 'undefined' ? (window as any).__NEXT_DATA__?.runtimeConfig?.NEXT_PUBLIC_TONG_API_BASE || '' : ''}/api/v1/playtest/sessions/${sessionId}/upload`,
          new Blob([
            JSON.stringify({ annotations: data }),
          ], { type: 'application/json' }),
        );
        e.preventDefault();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && annotations.length > 0) {
        // Page going to background — save annotations via sendBeacon
        const formData = new FormData();
        formData.append('annotations', JSON.stringify(annotations));
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          formData.append('recording', blob, `${sessionId}.webm`);
        }
        // sendBeacon with FormData
        navigator.sendBeacon?.(
          `${process.env.NEXT_PUBLIC_TONG_API_BASE || 'https://tong-api.erniesg.workers.dev'}/api/v1/playtest/sessions/${sessionId}/upload`,
          formData,
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [annotations, sessionId]);

  /* ── Cleanup ───────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
      if (frameCaptureRef.current) {
        frameCaptureRef.current.remove();
        frameCaptureRef.current = null;
      }
    };
  }, []);

  const COLORS = ['#ff6b2c', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff'];

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <>
      {/* Drawing canvas overlay — always mounted when a tool is active */}
      {(activeTool === 'pen' || activeTool === 'highlight') && (
        <canvas
          ref={canvasRef}
          className="playtest-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) handlePointerDown({ clientX: touch.clientX, clientY: touch.clientY } as any);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) handlePointerMove({ clientX: touch.clientX, clientY: touch.clientY } as any);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handlePointerUp();
          }}
          style={{ touchAction: 'none' }}
        />
      )}

      {/* Draggable comment pins */}
      {annotations.filter((a) => a.type === 'comment').map((a) => (
        <div
          key={a.id}
          className="playtest-pin"
          style={{
            left: `${(a.x ?? 0.5) * 100}vw`,
            top: `${(a.y ?? 0.5) * 100}vh`,
            cursor: 'grab',
            touchAction: 'none',
          }}
          title={a.text}
          onPointerDown={(e) => {
            e.preventDefault();
            handlePinDragStart(a.id, e.clientX, e.clientY);
          }}
        >
          <span className="playtest-pin-dot" />
          <span className="playtest-pin-label">{a.text}</span>
        </div>
      ))}

      {/* Comment input bar — anchored to bottom of screen */}
      {commentPos && (
        <div className="playtest-comment-bar">
          <textarea
            className="playtest-comment-input"
            placeholder="What felt off? Type your note..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
            }}
            autoFocus
          />
          {aiLoading && <div className="playtest-ai-loading">AI is thinking...</div>}
          {aiReply && (
            <div className="playtest-ai-reply">
              <p className="playtest-ai-text">{aiReply}</p>
              <div className="playtest-ai-actions">
                <input
                  className="playtest-ai-input"
                  placeholder="Reply to AI..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAiResponse((e.target as HTMLInputElement).value);
                  }}
                />
                <button className="playtest-ai-dismiss" onClick={dismissAi}>
                  Clear enough
                </button>
              </div>
            </div>
          )}
          <div className="playtest-comment-actions">
            <button className="playtest-btn-small" onClick={submitComment}>Pin</button>
            <button
              className="playtest-btn-small playtest-btn-muted"
              onClick={() => { setCommentPos(null); setCommentText(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Floating pill toolbar (bottom-right) ──────────────────── */}
      <div className={`playtest-pill ${expanded ? 'playtest-pill-expanded' : ''}`}>
        {/* Collapsed: just recording indicator + expand button */}
        {!expanded && (
          <button className="playtest-pill-toggle" onClick={() => setExpanded(true)}>
            {isRecording && <span className="playtest-recording-indicator" />}
            <span className="playtest-pill-label">
              {isRecording ? fmt(recordingTime) : 'Playtest'}
            </span>
            {annotations.length > 0 && (
              <span className="playtest-pill-badge">{annotations.length}</span>
            )}
          </button>
        )}

        {/* Expanded: full controls */}
        {expanded && (
          <div className="playtest-pill-controls">
            {/* Recording status */}
            <div className="playtest-pill-row">
              {isRecording && <span className="playtest-recording-indicator" />}
              <span className="playtest-pill-time">{fmt(recordingTime)}</span>
              <span className="playtest-pill-notes">
                {annotations.length} note{annotations.length !== 1 ? 's' : ''}
              </span>
              <button
                className="playtest-pill-close"
                onClick={() => setExpanded(false)}
                aria-label="Collapse"
              >
                &#x2715;
              </button>
            </div>

            {/* Tools */}
            <div className="playtest-pill-row">
              <button
                className={`playtest-tool ${activeTool === 'pen' ? 'playtest-tool-active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'pen' ? 'none' : 'pen')}
                title="Pen"
              >&#9998;</button>
              <button
                className={`playtest-tool ${activeTool === 'highlight' ? 'playtest-tool-active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'highlight' ? 'none' : 'highlight')}
                title="Highlight"
              >&#9618;</button>
              <button
                className={`playtest-tool ${commentPos ? 'playtest-tool-active' : ''}`}
                onClick={() => {
                  setActiveTool('none');
                  if (commentPos) {
                    setCommentPos(null);
                    setCommentText('');
                  } else {
                    setCommentPos({ x: 0.5, y: 0.5 });
                  }
                }}
                title="Comment"
              >&#128172;</button>
            </div>

            {/* Color picker (when drawing) */}
            {(activeTool === 'pen' || activeTool === 'highlight') && (
              <div className="playtest-pill-row playtest-colors">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`playtest-color-swatch ${penColor === c ? 'playtest-color-active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setPenColor(c)}
                  />
                ))}
              </div>
            )}

            {/* Submit */}
            <button className="playtest-btn playtest-btn-submit" onClick={stopAndSubmit}>
              Done
            </button>
          </div>
        )}
      </div>
    </>
  );
}

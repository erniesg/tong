'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

export interface Annotation {
  id: string;
  timestamp: number; // seconds into recording
  type: 'draw' | 'comment';
  /** SVG path data for drawings */
  pathData?: string;
  color?: string;
  /** Comment text (user's original + AI clarifications) */
  text?: string;
  clarified?: boolean;
  category?: string;
  severity?: number;
  /** Screenshot data URL at annotation moment */
  screenshot?: string;
  /** Position on viewport (0-1 range) */
  x?: number;
  y?: number;
}

interface Props {
  /** Ref to the game viewport element to record */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Session ID for labeling */
  sessionId: string;
  /** Called when user submits the session */
  onSubmit: (data: {
    recording: Blob;
    annotations: Annotation[];
    screenshots: Map<string, Blob>;
  }) => void;
  /** Optional: AI clarification handler */
  onRequestClarification?: (comment: Annotation) => Promise<string | null>;
}

type Tool = 'none' | 'pen' | 'highlight' | 'comment';

/* ── Component ────────────────────────────────────────────────────── */

export function PlaytestOverlay({ targetRef, sessionId, onSubmit, onRequestClarification }: Props) {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Annotation state
  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [penColor, setPenColor] = useState('#ff6b2c');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentPos, setCommentPos] = useState<{ x: number; y: number } | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Canvas ref for drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPath = useRef<string[]>([]);

  // Screenshot blobs keyed by annotation ID
  const screenshotBlobsRef = useRef<Map<string, Blob>>(new Map());

  const currentTimestamp = useCallback(() => {
    if (!startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, []);

  /* ── Screenshot capture ──────────────────────────────────────── */

  /** Capture the game viewport + drawing overlay as a PNG blob. */
  const captureScreenshot = useCallback(async (annotationId: string): Promise<void> => {
    const target = targetRef.current;
    if (!target) return;
    try {
      // Create an offscreen canvas matching the viewport
      const rect = target.getBoundingClientRect();
      const offscreen = document.createElement('canvas');
      offscreen.width = rect.width;
      offscreen.height = rect.height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      // Capture the game viewport via the MediaRecorder's video stream frame
      // (if recording), or fall back to a white placeholder
      const stream = mediaRecorderRef.current?.stream;
      const videoTrack = stream?.getVideoTracks()[0];
      if (videoTrack && 'ImageCapture' in window) {
        try {
          const capture = new (window as any).ImageCapture(videoTrack);
          const bitmap = await capture.grabFrame();
          ctx.drawImage(bitmap, 0, 0, rect.width, rect.height);
          bitmap.close();
        } catch {
          // ImageCapture not supported or failed — fill with dark bg
          ctx.fillStyle = '#0d0d1a';
          ctx.fillRect(0, 0, rect.width, rect.height);
        }
      } else {
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }

      // Composite the drawing canvas overlay on top
      const drawingCanvas = canvasRef.current;
      if (drawingCanvas) {
        ctx.drawImage(drawingCanvas, 0, 0);
      }

      // Convert to blob and store
      const blob = await new Promise<Blob | null>((resolve) =>
        offscreen.toBlob(resolve, 'image/png'),
      );
      if (blob) {
        screenshotBlobsRef.current.set(annotationId, blob);
      }
    } catch {
      // Screenshot capture is best-effort — don't block annotation
    }
  }, [targetRef]);

  /* ── Recording controls ──────────────────────────────────────── */

  const startRecording = useCallback(async () => {
    const target = targetRef.current;
    if (!target) return;

    try {
      // Capture the game viewport as a media stream
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
        preferCurrentTab: true,
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
        videoBitsPerSecond: 1_000_000, // 1 Mbps — keeps recordings under 100MB for ~10 min
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      };

      recorder.start(1000); // chunk every 1s
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [targetRef]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const stopAndSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      onSubmit({ recording: blob, annotations, screenshots: screenshotBlobsRef.current });
    };

    if (recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
  }, [annotations, onSubmit]);

  /* ── Drawing (pen / highlight) ───────────────────────────────── */

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
      if (activeTool === 'comment') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        setCommentPos({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
        return;
      }

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
      if (activeTool === 'highlight') ctx.globalAlpha = 0.35;
      else ctx.globalAlpha = 1;
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
      const annotation: Annotation = {
        id,
        timestamp: currentTimestamp(),
        type: 'draw',
        pathData: currentPath.current.join(' '),
        color: penColor,
        screenshot: id,
      };
      setAnnotations((prev) => [...prev, annotation]);
      // Capture screenshot with the drawing included (fire-and-forget)
      void captureScreenshot(id);
    }
    currentPath.current = [];
  }, [penColor, currentTimestamp, captureScreenshot]);

  /* ── Comment submission with optional AI clarification ────────── */

  const submitComment = useCallback(async () => {
    if (!commentText.trim() || !commentPos) return;

    const id = `comment-${Date.now()}`;
    const annotation: Annotation = {
      id,
      timestamp: currentTimestamp(),
      type: 'comment',
      text: commentText.trim(),
      x: commentPos.x,
      y: commentPos.y,
      clarified: false,
      screenshot: id,
    };

    setAnnotations((prev) => [...prev, annotation]);
    setCommentText('');
    setAiReply(null);
    // Capture screenshot at comment moment
    void captureScreenshot(id);

    // Request AI clarification if handler provided
    if (onRequestClarification) {
      setAiLoading(true);
      try {
        const reply = await onRequestClarification(annotation);
        if (reply) setAiReply(reply);
      } catch {
        // AI clarification is optional, don't block
      } finally {
        setAiLoading(false);
      }
    } else {
      setCommentPos(null);
    }
  }, [commentText, commentPos, currentTimestamp, onRequestClarification]);

  const handleAiResponse = useCallback(
    (response: string) => {
      // Update the last comment with clarification
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

  /* ── Resize canvas to match viewport ─────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    const target = targetRef.current;
    if (!canvas || !target) return;

    const resize = () => {
      const rect = target.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

  /* ── Cleanup ─────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
    };
  }, []);

  /* ── Format time ─────────────────────────────────────────────── */

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const COLORS = ['#ff6b2c', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff'];

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <>
      {/* Drawing canvas overlay */}
      {activeTool !== 'none' && (
        <canvas
          ref={canvasRef}
          className="playtest-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ cursor: activeTool === 'comment' ? 'crosshair' : 'default' }}
        />
      )}

      {/* Comment pins on viewport */}
      {annotations
        .filter((a) => a.type === 'comment')
        .map((a) => (
          <div
            key={a.id}
            className="playtest-pin"
            style={{ left: `${(a.x ?? 0) * 100}%`, top: `${(a.y ?? 0) * 100}%` }}
            title={a.text}
          >
            <span className="playtest-pin-dot" />
            <span className="playtest-pin-time">{fmt(a.timestamp)}</span>
          </div>
        ))}

      {/* Comment input popover */}
      {commentPos && (
        <div
          className="playtest-comment-popover"
          style={{
            left: `${commentPos.x * 100}%`,
            top: `${commentPos.y * 100}%`,
          }}
        >
          <textarea
            className="playtest-comment-input"
            placeholder="What happened here?"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitComment();
              }
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
            <button className="playtest-btn-small" onClick={submitComment}>
              Pin
            </button>
            <button
              className="playtest-btn-small playtest-btn-muted"
              onClick={() => {
                setCommentPos(null);
                setCommentText('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Toolbar — collapsible from top */}
      <div className={`playtest-toolbar ${showToolbar ? 'playtest-toolbar-open' : ''}`}>
        <button
          className="playtest-toolbar-toggle"
          onClick={() => setShowToolbar((v) => !v)}
          aria-label="Toggle playtest toolbar"
        >
          {showToolbar ? '\u25B2' : '\u25BC'}
        </button>

        {showToolbar && (
          <div className="playtest-toolbar-inner">
            {/* Recording controls */}
            <div className="playtest-toolbar-group">
              {!isRecording ? (
                <button className="playtest-btn playtest-btn-record" onClick={startRecording}>
                  Record
                </button>
              ) : (
                <>
                  <span className="playtest-recording-indicator" />
                  <span className="playtest-time">{fmt(recordingTime)}</span>
                  {isPaused ? (
                    <button className="playtest-btn" onClick={resumeRecording}>
                      Resume
                    </button>
                  ) : (
                    <button className="playtest-btn" onClick={pauseRecording}>
                      Pause
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Annotation tools */}
            <div className="playtest-toolbar-group">
              <button
                className={`playtest-tool ${activeTool === 'pen' ? 'playtest-tool-active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'pen' ? 'none' : 'pen')}
                title="Pen"
              >
                &#9998;
              </button>
              <button
                className={`playtest-tool ${activeTool === 'highlight' ? 'playtest-tool-active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'highlight' ? 'none' : 'highlight')}
                title="Highlight"
              >
                &#9618;
              </button>
              <button
                className={`playtest-tool ${activeTool === 'comment' ? 'playtest-tool-active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'comment' ? 'none' : 'comment')}
                title="Comment"
              >
                &#128172;
              </button>

              {/* Color picker */}
              {(activeTool === 'pen' || activeTool === 'highlight') && (
                <div className="playtest-colors">
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
            </div>

            {/* Submit */}
            <div className="playtest-toolbar-group">
              <span className="playtest-annotation-count">
                {annotations.length} note{annotations.length !== 1 ? 's' : ''}
              </span>
              {isRecording && (
                <button className="playtest-btn playtest-btn-submit" onClick={stopAndSubmit}>
                  Submit Session
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

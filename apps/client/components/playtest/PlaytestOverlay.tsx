'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

export interface Annotation {
  id: string;
  timestamp: number;
  type: 'draw' | 'comment';
  pathData?: string;
  color?: string;
  lineWidth?: number;
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

type Tool = 'none' | 'draw' | 'comment';
type PanelView = 'tools' | 'notes' | 'comment' | 'ai-reply';

/* ── Component ────────────────────────────────────────────────────── */

export function PlaytestOverlay({ targetRef, sessionId, onSubmit, onRequestClarification }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const frameCaptureRef = useRef<HTMLCanvasElement | null>(null);
  const frameLoopRef = useRef<number>(0);

  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [penColor, setPenColor] = useState('#ff6b2c');
  const [penWidth, setPenWidth] = useState<3 | 20>(3);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [commentText, setCommentText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('tools');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  // Undo stack: each entry is the canvas state before a stroke
  const drawHistory = useRef<ImageData[]>([]);
  const recordingMimeRef = useRef('video/webm');

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

  /* ── Frame capture ──────────────────────────────────────────────── */

  const startFrameCapture = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;
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
      const gameCanvases = target.querySelectorAll('canvas');
      const ctx = fc!.getContext('2d');
      if (ctx && gameCanvases.length > 0) {
        ctx.clearRect(0, 0, fc!.width, fc!.height);
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, fc!.width, fc!.height);
        for (const gc of gameCanvases) {
          try {
            const gcRect = gc.getBoundingClientRect();
            ctx.drawImage(gc, gcRect.left - rect.left, gcRect.top - rect.top, gcRect.width, gcRect.height);
          } catch { /* tainted */ }
        }
      }
      frameLoopRef.current = requestAnimationFrame(captureFrame);
    };
    frameLoopRef.current = requestAnimationFrame(captureFrame);
  }, [targetRef]);

  /* ── Screenshot capture ─────────────────────────────────────────── */

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
      const fc = frameCaptureRef.current;
      if (fc && fc.width > 0) {
        ctx.drawImage(fc, 0, 0, rect.width, rect.height);
      } else {
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, rect.width, rect.height);
        const gameCanvases = target.querySelectorAll('canvas');
        for (const gc of gameCanvases) {
          try {
            const gcRect = gc.getBoundingClientRect();
            ctx.drawImage(gc, gcRect.left - rect.left, gcRect.top - rect.top, gcRect.width, gcRect.height);
          } catch { /* skip */ }
        }
      }
      const drawingCanvas = canvasRef.current;
      if (drawingCanvas) ctx.drawImage(drawingCanvas, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, 'image/png'));
      if (blob) screenshotBlobsRef.current.set(annotationId, blob);
    } catch { /* best-effort */ }
  }, [targetRef]);

  /* ── Recording ──────────────────────────────────────────────────── */

  const startRecording = useCallback(() => {
    const fc = frameCaptureRef.current;
    if (!fc) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    if (typeof fc.captureStream !== 'function') { setIsRecording(true); return; }
    try {
      const stream = fc.captureStream(15);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : '';
      if (!mimeType) { setIsRecording(true); return; }
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_000_000 });
      recordingMimeRef.current = mimeType;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { setIsRecording(true); }
  }, []);

  const stopAndSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      onSubmit({ recording: new Blob([], { type: 'video/webm' }), annotations, screenshots: screenshotBlobsRef.current });
      return;
    }
    recorder.onstop = () => {
      onSubmit({ recording: new Blob(chunksRef.current, { type: recordingMimeRef.current }), annotations, screenshots: screenshotBlobsRef.current });
    };
    if (recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
  }, [annotations, onSubmit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      startFrameCapture();
      setTimeout(() => startRecording(), 500);
    }, 1000);
    return () => clearTimeout(timer);
  }, [startFrameCapture, startRecording]);

  /* ── Drawing ────────────────────────────────────────────────────── */

  const startDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (activeTool !== 'draw') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Save canvas state for undo before starting new stroke (cap at 16)
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawHistory.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (drawHistory.current.length > 16) drawHistory.current.shift();
      }
      isDrawing.current = true;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      currentPath.current = [`M ${x} ${y}`];
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = penWidth >= 20 ? 0.35 : 1;
    },
    [activeTool, penColor, penWidth],
  );

  const moveDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      currentPath.current.push(`L ${x} ${y}`);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [],
  );

  const endDraw = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.globalAlpha = 1;
    const pathData = currentPath.current.join(' ');
    if (currentPath.current.length > 1 && pathData) {
      const id = `draw-${Date.now()}`;
      setAnnotations((prev) => [...prev, {
        id, timestamp: currentTimestamp(), type: 'draw',
        pathData, color: penColor, lineWidth: penWidth, screenshot: id,
      }]);
      void captureScreenshot(id);
    }
    currentPath.current = [];
  }, [penColor, penWidth, currentTimestamp, captureScreenshot]);

  const undoDraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prev = drawHistory.current.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      // Remove the last draw annotation
      setAnnotations((a) => {
        let lastDrawIdx = -1;
        for (let i = a.length - 1; i >= 0; i--) {
          if (a[i].type === 'draw') { lastDrawIdx = i; break; }
        }
        if (lastDrawIdx >= 0) return a.filter((_, i) => i !== lastDrawIdx);
        return a;
      });
    }
  }, []);

  /* ── Comment (inside pill panel) ────────────────────────────────── */

  const submitComment = useCallback(async () => {
    if (!commentText.trim()) return;
    const id = `comment-${Date.now()}`;
    const annotation: Annotation = {
      id, timestamp: currentTimestamp(), type: 'comment',
      text: commentText.trim(), x: 0.5, y: 0.5,
      clarified: false, screenshot: id,
    };
    setAnnotations((prev) => [...prev, annotation]);
    setCommentText('');
    void captureScreenshot(id);

    if (onRequestClarification) {
      setAiLoading(true);
      try {
        const reply = await onRequestClarification(annotation);
        if (reply) {
          setAiReply(reply);
          setAiInputText('');
          setPanelView('ai-reply');
          return;
        }
      } catch { /* optional */ } finally {
        setAiLoading(false);
      }
    }
    // No AI reply — go back to tools
    setPanelView('tools');
  }, [commentText, currentTimestamp, onRequestClarification, captureScreenshot]);

  const handleAiResponse = useCallback(() => {
    setAnnotations((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.type === 'comment') {
        const text = aiInputText.trim()
          ? `${last.text}\n---\nAI: ${aiReply}\nUser: ${aiInputText.trim()}`
          : last.text;
        updated[updated.length - 1] = { ...last, text, clarified: true };
      }
      return updated;
    });
    setAiReply(null);
    setAiInputText('');
    setPanelView('tools');
  }, [aiReply, aiInputText]);

  /* ── Edit annotation in notes view ──────────────────────────────── */

  const saveEdit = useCallback((id: string) => {
    setAnnotations((prev) =>
      prev.map((a) => a.id === id ? { ...a, text: editText.trim() || a.text } : a),
    );
    setEditingId(null);
    setEditText('');
  }, [editText]);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  /* ── Resize canvas ──────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawHistory.current = []; // clear history on resize (canvas cleared)
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [activeTool]);

  /* ── Auto-save ──────────────────────────────────────────────────── */

  const uploadUrl = `${process.env.NEXT_PUBLIC_TONG_API_BASE || 'https://tong-api.erniesg.workers.dev'}/api/v1/playtest/sessions/${sessionId}/upload`;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (annotations.length > 0 || chunksRef.current.length > 0) {
        const formData = new FormData();
        formData.append('annotations', JSON.stringify(annotations));
        navigator.sendBeacon?.(uploadUrl, formData);
        e.preventDefault();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && annotations.length > 0) {
        const formData = new FormData();
        formData.append('annotations', JSON.stringify(annotations));
        if (chunksRef.current.length > 0) {
          formData.append('recording', new Blob(chunksRef.current, { type: 'video/webm' }), `${sessionId}.webm`);
        }
        navigator.sendBeacon?.(uploadUrl, formData);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [annotations, sessionId, uploadUrl]);

  /* ── Cleanup ────────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      if (frameCaptureRef.current) { frameCaptureRef.current.remove(); frameCaptureRef.current = null; }
      drawHistory.current = [];
    };
  }, []);

  const COLORS = ['#ff6b2c', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff'];
  const drawCount = annotations.filter((a) => a.type === 'draw').length;

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <>
      {/* Drawing canvas */}
      {activeTool === 'draw' && (
        <canvas
          ref={canvasRef}
          className="playtest-canvas"
          onPointerDown={(e) => { e.preventDefault(); startDraw(e.clientX, e.clientY); }}
          onPointerMove={(e) => moveDraw(e.clientX, e.clientY)}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onPointerCancel={endDraw}
          style={{ touchAction: 'none' }}
        />
      )}

      {/* ── Single pill — everything lives here ───────────────────── */}
      <div className={`playtest-pill ${expanded ? 'playtest-pill-expanded' : ''}`}>
        {/* Collapsed pill */}
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

        {/* Expanded pill — all views render here */}
        {expanded && (
          <div className="playtest-pill-controls">
            {/* ── Header (always visible) ──────────────────────────── */}
            <div className="playtest-pill-row">
              {panelView !== 'tools' && (
                <button
                  className="playtest-pill-back"
                  onClick={() => { setPanelView('tools'); setAiReply(null); setCommentText(''); }}
                  aria-label="Back"
                >
                  &#8249;
                </button>
              )}
              {isRecording && <span className="playtest-recording-indicator" />}
              <span className="playtest-pill-time">{fmt(recordingTime)}</span>
              <span style={{ flex: 1 }} />
              <button
                className="playtest-pill-close"
                onClick={() => { setExpanded(false); setPanelView('tools'); }}
                aria-label="Collapse"
              >
                &#x2715;
              </button>
            </div>

            {/* ── Tools view ───────────────────────────────────────── */}
            {panelView === 'tools' && (
              <>
                <div className="playtest-pill-row">
                  <button
                    className={`playtest-tool ${activeTool === 'draw' ? 'playtest-tool-active' : ''}`}
                    onClick={() => setActiveTool(activeTool === 'draw' ? 'none' : 'draw')}
                    title="Draw"
                  >&#9998;</button>
                  <button
                    className="playtest-tool"
                    onClick={() => { setActiveTool('none'); setPanelView('comment'); }}
                    title="Comment"
                  >&#128172;</button>
                  <button
                    className="playtest-tool"
                    onClick={() => setPanelView('notes')}
                    title="Notes"
                  >
                    &#128221;{annotations.length > 0 ? ` ${annotations.length}` : ''}
                  </button>
                </div>

                {/* Draw options */}
                {activeTool === 'draw' && (
                  <>
                    <div className="playtest-pill-row">
                      <button
                        className={`playtest-tool ${penWidth === 3 ? 'playtest-tool-active' : ''}`}
                        onClick={() => setPenWidth(3)}
                      >
                        <span style={{ display: 'inline-block', width: 14, height: 2, background: 'currentColor', borderRadius: 1 }} />
                      </button>
                      <button
                        className={`playtest-tool ${penWidth === 20 ? 'playtest-tool-active' : ''}`}
                        onClick={() => setPenWidth(20)}
                      >
                        <span style={{ display: 'inline-block', width: 14, height: 8, background: 'currentColor', borderRadius: 2, opacity: 0.5 }} />
                      </button>
                      {drawCount > 0 && (
                        <button className="playtest-tool" onClick={undoDraw} title="Undo">
                          &#8630;
                        </button>
                      )}
                    </div>
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
                  </>
                )}

                <button className="playtest-btn playtest-btn-submit" onClick={stopAndSubmit}>
                  Submit Session
                </button>
              </>
            )}

            {/* ── Comment view (inside pill) ───────────────────────── */}
            {panelView === 'comment' && (
              <div className="playtest-pill-comment">
                <textarea
                  className="playtest-comment-input"
                  placeholder="What felt off?"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
                  }}
                  rows={2}
                  autoFocus
                />
                {aiLoading && <div className="playtest-ai-loading">AI is thinking...</div>}
                <div className="playtest-pill-row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    className="playtest-btn-small playtest-btn-muted"
                    onClick={() => { setPanelView('tools'); setCommentText(''); }}
                  >
                    Cancel
                  </button>
                  <button className="playtest-btn-small" onClick={submitComment}>
                    Pin
                  </button>
                </div>
              </div>
            )}

            {/* ── AI reply view (inside pill) ──────────────────────── */}
            {panelView === 'ai-reply' && aiReply && (
              <div className="playtest-pill-comment">
                <p className="playtest-ai-text">{aiReply}</p>
                <input
                  className="playtest-comment-input"
                  style={{ minHeight: 'auto', padding: '8px' }}
                  placeholder="Reply to AI (optional)..."
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiResponse(); }}
                  autoFocus
                />
                <div className="playtest-pill-row" style={{ justifyContent: 'flex-end' }}>
                  <button className="playtest-btn-small playtest-btn-muted" onClick={handleAiResponse}>
                    Skip
                  </button>
                  <button className="playtest-btn-small" onClick={handleAiResponse}>
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* ── Notes view ───────────────────────────────────────── */}
            {panelView === 'notes' && (
              <div className="playtest-notes-list">
                {annotations.length === 0 && (
                  <p className="playtest-notes-empty">No notes yet</p>
                )}
                {annotations.map((a) => (
                  <div key={a.id} className="playtest-note-item">
                    <span className="playtest-note-time">{fmt(a.timestamp)}</span>
                    <span className="playtest-note-type">{a.type === 'draw' ? '\u270E' : '\uD83D\uDCAC'}</span>
                    {editingId === a.id ? (
                      <div className="playtest-note-edit">
                        <input
                          className="playtest-note-edit-input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(a.id); }}
                          autoFocus
                        />
                        <button className="playtest-note-save" onClick={() => saveEdit(a.id)} aria-label="Save">&#10003;</button>
                      </div>
                    ) : (
                      <span
                        className="playtest-note-text"
                        onClick={() => { setEditingId(a.id); setEditText(a.text || `${a.type} @ ${fmt(a.timestamp)}`); }}
                      >
                        {a.text || `${a.type} annotation`}
                      </span>
                    )}
                    <button className="playtest-note-delete" onClick={() => deleteAnnotation(a.id)} aria-label="Delete">&#x2715;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

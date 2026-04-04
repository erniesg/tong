'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { sessionLogger } from '@/lib/debug/session-logger';

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
    stateLog: unknown;
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

  // Comment placement: tap screen to place, then type
  const [placingComment, setPlacingComment] = useState(false);
  const [commentPos, setCommentPos] = useState<{ x: number; y: number } | null>(null);

  // Temporal marker: expanded popover + drag
  const [expandedMarkerId, setExpandedMarkerId] = useState<string | null>(null);
  const markerDrag = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Draggable pill position
  const [pillPos, setPillPos] = useState<{ x: number; y: number } | null>(null);
  const pillDrag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Undo stack + screenshot blob URLs for timeline thumbnails
  const drawHistory = useRef<ImageData[]>([]);
  const recordingMimeRef = useRef('video/webm');
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

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

  /* ── Screenshot capture (html2canvas — full DOM) ─────────────── */

  const captureScreenshot = useCallback(async (annotationId: string): Promise<void> => {
    const target = targetRef.current;
    if (!target) return;
    try {
      // html2canvas renders the full DOM tree to a canvas — captures everything visible
      const canvas = await html2canvas(target, {
        backgroundColor: '#0d0d1a',
        scale: 1, // 1x for speed; 2x for retina quality if needed
        logging: false,
        useCORS: true,
        allowTaint: true,
        // Ignore the playtest overlay elements so they don't appear in screenshots
        ignoreElements: (el) => {
          const cls = el.className || '';
          return typeof cls === 'string' && (
            cls.includes('playtest-pill') ||
            cls.includes('playtest-canvas') ||
            cls.includes('playtest-place') ||
            cls.includes('playtest-marker') ||
            cls.includes('playtest-submitted')
          );
        },
      });

      // Composite drawing overlay on top if active
      const drawingCanvas = canvasRef.current;
      if (drawingCanvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(drawingCanvas, 0, 0);
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        screenshotBlobsRef.current.set(annotationId, blob);
        const thumbUrl = URL.createObjectURL(blob);
        setThumbnails((prev) => new Map(prev).set(annotationId, thumbUrl));
      }
    } catch (err) {
      console.warn('html2canvas screenshot failed:', err);
    }
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
    // Snapshot final state before submitting
    if (typeof window !== 'undefined' && // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TONG_QA__) {
      const qa = // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TONG_QA__ as { getState: () => Record<string, unknown> };
      sessionLogger.logStateSnapshot(qa.getState());
    }
    const stateLog = sessionLogger.getCurrent();
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      onSubmit({ recording: new Blob([], { type: 'video/webm' }), annotations, screenshots: screenshotBlobsRef.current, stateLog });
      return;
    }
    recorder.onstop = () => {
      onSubmit({ recording: new Blob(chunksRef.current, { type: recordingMimeRef.current }), annotations, screenshots: screenshotBlobsRef.current, stateLog });
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

  // Periodic state snapshots every 10s for replay reconstruction
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TONG_QA__) {
        const qa = // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TONG_QA__ as { getState: () => Record<string, unknown> };
        sessionLogger.logStateSnapshot(qa.getState());
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Draggable pill ─────────────────────────────────────────────── */

  const onPillDragStart = useCallback((clientX: number, clientY: number) => {
    const pos = pillPos || { x: window.innerWidth - 100, y: window.innerHeight - 60 };
    pillDrag.current = { startX: clientX, startY: clientY, origX: pos.x, origY: pos.y };
  }, [pillPos]);

  const onPillDragMove = useCallback((clientX: number, clientY: number) => {
    const d = pillDrag.current;
    if (!d) return;
    const nx = Math.max(0, Math.min(window.innerWidth - 60, d.origX + (clientX - d.startX)));
    const ny = Math.max(0, Math.min(window.innerHeight - 40, d.origY + (clientY - d.startY)));
    setPillPos({ x: nx, y: ny });
  }, []);

  const onPillDragEnd = useCallback(() => { pillDrag.current = null; }, []);

  // Distinguish drag from tap: track distance moved
  const pillTapStart = useRef<{ x: number; y: number } | null>(null);
  const handlePillPointerDown = useCallback((e: React.PointerEvent) => {
    pillTapStart.current = { x: e.clientX, y: e.clientY };
    onPillDragStart(e.clientX, e.clientY);
  }, [onPillDragStart]);

  const handlePillClick = useCallback(() => {
    // Only expand if we didn't drag more than 5px
    const t = pillTapStart.current;
    const p = pillPos || { x: window.innerWidth - 100, y: window.innerHeight - 60 };
    if (t) {
      const dist = Math.sqrt((p.x - (t.x - (pillDrag.current?.startX ?? t.x) + (pillDrag.current?.origX ?? p.x))) ** 2);
      // Simple: if pillDrag is null (ended), check if pos changed significantly
    }
    // The click event only fires if pointerup was close to pointerdown (browser default)
    setExpanded(true);
  }, [pillPos]);

  /* ── Place comment on screen ─────────────────────────────────── */

  const handlePlaceTap = useCallback((e: React.PointerEvent) => {
    if (!placingComment) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    setCommentPos({ x, y });
    setPlacingComment(false);
    setPanelView('comment');
    setExpanded(true);
  }, [placingComment]);

  /* ── Marker drag ────────────────────────────────────────────────── */

  const onMarkerDragStart = useCallback((id: string, clientX: number, clientY: number) => {
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    markerDrag.current = { id, startX: clientX, startY: clientY, origX: ann.x ?? 0.5, origY: ann.y ?? 0.5 };
  }, [annotations]);

  const onMarkerDragMove = useCallback((clientX: number, clientY: number) => {
    const d = markerDrag.current;
    if (!d) return;
    const dx = (clientX - d.startX) / window.innerWidth;
    const dy = (clientY - d.startY) / window.innerHeight;
    const nx = Math.max(0.02, Math.min(0.98, d.origX + dx));
    const ny = Math.max(0.02, Math.min(0.98, d.origY + dy));
    setAnnotations((prev) =>
      prev.map((a) => a.id === d.id ? { ...a, x: nx, y: ny } : a),
    );
  }, []);

  const onMarkerDragEnd = useCallback(() => {
    const d = markerDrag.current;
    markerDrag.current = null;
    // If barely moved, treat as tap → toggle popover
    if (d) {
      const ann = annotations.find((a) => a.id === d.id);
      if (ann) {
        const moved = Math.abs((ann.x ?? 0.5) - d.origX) + Math.abs((ann.y ?? 0.5) - d.origY);
        if (moved < 0.01) {
          setExpandedMarkerId((prev) => prev === d.id ? null : d.id);
        }
      }
    }
  }, [annotations]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      onPillDragMove(e.clientX, e.clientY);
      onMarkerDragMove(e.clientX, e.clientY);
    };
    const onUp = () => {
      onPillDragEnd();
      onMarkerDragEnd();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [onPillDragMove, onPillDragEnd, onMarkerDragMove, onMarkerDragEnd]);

  /* ── Drawing ────────────────────────────────────────────────────── */

  const startDraw = useCallback(
    (clientX: number, clientY: number) => {
      if (activeTool !== 'draw') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
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

  /* ── Comment ────────────────────────────────────────────────────── */

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
    setCommentPos(null);
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
    setPanelView('tools');
  }, [commentText, commentPos, currentTimestamp, onRequestClarification, captureScreenshot]);

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

  /* ── Edit/delete ────────────────────────────────────────────────── */

  const saveEdit = useCallback((id: string) => {
    setAnnotations((prev) =>
      prev.map((a) => a.id === id ? { ...a, text: editText.trim() || a.text } : a),
    );
    setEditingId(null);
    setEditText('');
  }, [editText]);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    // Revoke thumbnail URL
    setThumbnails((prev) => {
      const next = new Map(prev);
      const url = next.get(id);
      if (url) URL.revokeObjectURL(url);
      next.delete(id);
      return next;
    });
  }, []);

  /* ── Resize canvas ──────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawHistory.current = [];
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
      // Revoke all thumbnail URLs
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const COLORS = ['#ff6b2c', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff'];
  const drawCount = annotations.filter((a) => a.type === 'draw').length;

  // Pill position style
  const pillStyle: React.CSSProperties = pillPos
    ? { position: 'fixed', left: pillPos.x, top: pillPos.y, right: 'auto', bottom: 'auto', zIndex: 9999, touchAction: 'none' }
    : {};

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

      {/* Tap-to-place overlay — covers screen when placing a comment */}
      {placingComment && (
        <div
          className="playtest-place-overlay"
          onPointerDown={handlePlaceTap}
          style={{ touchAction: 'none' }}
        >
          <div className="playtest-place-hint">Tap where you want to add a note</div>
        </div>
      )}

      {/* Preview marker while placing */}
      {commentPos && panelView === 'comment' && (
        <div
          className="playtest-marker playtest-marker-placing"
          style={{ left: `${commentPos.x * 100}%`, top: `${commentPos.y * 100}%` }}
        >
          <span className="playtest-marker-dot" />
        </div>
      )}

      {/* ── Temporal comment markers ──────────────────────────────── */}
      {annotations.filter((a) => a.type === 'comment' && a.x != null && a.y != null).map((a) => {
        const delta = Math.abs(recordingTime - a.timestamp);
        const PIN_WINDOW = 4;
        if (delta > PIN_WINDOW) return null;
        const opacity = delta <= 2 ? 1 : 1 - (delta - 2) / (PIN_WINDOW - 2);
        const isExpanded = expandedMarkerId === a.id;
        return (
          <div
            key={`marker-${a.id}`}
            className={`playtest-marker ${isExpanded ? 'playtest-marker-expanded' : ''}`}
            style={{
              left: `${(a.x ?? 0.5) * 100}%`,
              top: `${(a.y ?? 0.5) * 100}%`,
              opacity,
              pointerEvents: opacity > 0.2 ? 'auto' : 'none',
              touchAction: 'none',
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkerDragStart(a.id, e.clientX, e.clientY);
            }}
          >
            <span className="playtest-marker-dot" />
            {isExpanded && (
              <div className="playtest-marker-popover">
                {editingId === a.id ? (
                  <>
                    <input
                      className="playtest-marker-edit-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { saveEdit(a.id); setExpandedMarkerId(null); } }}
                      autoFocus
                    />
                    <div className="playtest-marker-edit-actions">
                      <button onClick={() => { saveEdit(a.id); setExpandedMarkerId(null); }}>Save</button>
                      <button onClick={() => { deleteAnnotation(a.id); setExpandedMarkerId(null); }}>Delete</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="playtest-marker-text">{a.text}</p>
                    <div className="playtest-marker-edit-actions">
                      <button onClick={() => { setEditingId(a.id); setEditText(a.text || ''); }}>Edit</button>
                      <button onClick={() => { deleteAnnotation(a.id); setExpandedMarkerId(null); }}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Draggable pill ────────────────────────────────────────── */}
      <div
        className={`playtest-pill ${expanded ? 'playtest-pill-expanded' : ''}`}
        style={pillStyle}
      >
        {/* Collapsed — draggable + tap to expand */}
        {!expanded && (
          <button
            className="playtest-pill-toggle"
            onPointerDown={handlePillPointerDown}
            onClick={handlePillClick}
            style={{ touchAction: 'none', cursor: 'grab' }}
          >
            {isRecording && <span className="playtest-recording-indicator" />}
            <span className="playtest-pill-label">
              {isRecording ? fmt(recordingTime) : 'Playtest'}
            </span>
            {annotations.length > 0 && (
              <span className="playtest-pill-badge">{annotations.length}</span>
            )}
          </button>
        )}

        {/* Expanded — header is drag handle */}
        {expanded && (
          <div className="playtest-pill-controls">
            {/* ── Drag handle header ──────────────────────────────── */}
            <div
              className="playtest-pill-row playtest-pill-drag-handle"
              onPointerDown={(e) => { e.preventDefault(); onPillDragStart(e.clientX, e.clientY); }}
              style={{ touchAction: 'none', cursor: 'grab' }}
            >
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
              <span className="playtest-pill-drag-hint">&#8942;&#8942;</span>
              <span style={{ flex: 1 }} />
              <button
                className="playtest-pill-close"
                onClick={() => { setExpanded(false); setPanelView('tools'); }}
                aria-label="Minimize"
                title="Minimize"
              >
                &#x25BE;
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
                    className={`playtest-tool ${placingComment ? 'playtest-tool-active' : ''}`}
                    onClick={() => {
                      setActiveTool('none');
                      setPlacingComment(!placingComment);
                      setExpanded(false); // collapse pill so user can tap the game
                    }}
                    title="Comment — tap screen to place"
                  >&#128172;</button>
                  <button
                    className="playtest-tool"
                    onClick={() => setPanelView('notes')}
                    title="Notes"
                  >
                    &#128221;{annotations.length > 0 ? ` ${annotations.length}` : ''}
                  </button>
                </div>

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
                        <button className="playtest-tool" onClick={undoDraw} title="Undo">&#8630;</button>
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

            {/* ── Comment view ─────────────────────────────────────── */}
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
                  >Cancel</button>
                  <button className="playtest-btn-small" onClick={submitComment}>Pin</button>
                </div>
              </div>
            )}

            {/* ── AI reply view ────────────────────────────────────── */}
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
                  <button className="playtest-btn-small playtest-btn-muted" onClick={handleAiResponse}>Skip</button>
                  <button className="playtest-btn-small" onClick={handleAiResponse}>Save</button>
                </div>
              </div>
            )}

            {/* ── Notes view with thumbnail timeline ───────────────── */}
            {panelView === 'notes' && (
              <div className="playtest-notes-panel">
                {/* Thumbnail timeline strip */}
                {annotations.length > 0 && (
                  <div className="playtest-timeline">
                    {annotations.map((a) => (
                      <button
                        key={a.id}
                        className={`playtest-timeline-thumb ${editingId === a.id ? 'playtest-timeline-thumb-active' : ''}`}
                        onClick={() => { setEditingId(a.id); setEditText(a.text || `${a.type} @ ${fmt(a.timestamp)}`); }}
                        title={`${fmt(a.timestamp)} — ${a.type}`}
                      >
                        {thumbnails.get(a.id) ? (
                          <img src={thumbnails.get(a.id)} alt="" className="playtest-timeline-img" />
                        ) : (
                          <span className="playtest-timeline-placeholder">
                            {a.type === 'draw' ? '\u270E' : '\uD83D\uDCAC'}
                          </span>
                        )}
                        <span className="playtest-timeline-time">{fmt(a.timestamp)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Annotation list */}
                <div className="playtest-notes-list">
                  {annotations.length === 0 && (
                    <p className="playtest-notes-empty">No notes yet</p>
                  )}
                  {annotations.map((a) => (
                    <div key={a.id} className={`playtest-note-item ${editingId === a.id ? 'playtest-note-item-active' : ''}`}>
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
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

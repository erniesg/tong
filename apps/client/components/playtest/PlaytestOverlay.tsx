'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { sessionLogger } from '@/lib/debug/session-logger';
import { getPublicApiBase } from '@/lib/public-api-base';
import { takeDisplayStream } from '@/lib/playtest/display-stream';

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
    filmstrip: { ts: number; blob: Blob }[];
  }) => void;
  onRequestClarification?: (comment: Annotation) => Promise<string | null>;
}

type Tool = 'none' | 'draw' | 'comment';
type PanelView = 'tools' | 'notes' | 'comment' | 'ai-reply';

/* Shared html2canvas options — exclude playtest UI from captures */
const ignorePlaytestElements = (el: Element) => {
  const cls = el.className || '';
  return typeof cls === 'string' && (
    cls.includes('playtest-pill') ||
    cls.includes('playtest-canvas') ||
    cls.includes('playtest-place') ||
    cls.includes('playtest-marker') ||
    cls.includes('playtest-submitted')
  );
};

/* html2canvas clones the DOM into an iframe where CSS animations restart at
   keyframe 0 — animated elements (fade-ins etc.) render at opacity 0 and
   captures come out near-black. Before cloning, tag each animated element
   with its live computed state; in the clone, freeze it at that state.
   (Matching by attribute, not index — the clone drops script tags.) */
const FREEZE_ATTR = 'data-playtest-freeze';

const tagAnimatedElements = (): Element[] => {
  const tagged: Element[] = [];
  document.documentElement.querySelectorAll('*').forEach((el) => {
    const cs = window.getComputedStyle(el);
    if (cs.animationName !== 'none') {
      el.setAttribute(FREEZE_ATTR, JSON.stringify({
        o: cs.opacity, t: cs.transform, f: cs.filter,
      }));
      tagged.push(el);
    }
  });
  return tagged;
};

const freezeAnimationsInClone = (clonedDoc: Document) => {
  clonedDoc.querySelectorAll(`[${FREEZE_ATTR}]`).forEach((el) => {
    const dst = el as HTMLElement;
    if (!dst.style) return;
    try {
      const s = JSON.parse(dst.getAttribute(FREEZE_ATTR) || '{}');
      dst.style.animation = 'none';
      dst.style.transition = 'none';
      if (s.o) dst.style.opacity = s.o;
      if (s.t && s.t !== 'none') dst.style.transform = s.t;
      if (s.f && s.f !== 'none') dst.style.filter = s.f;
    } catch { /* skip */ }
  });
};

/* The game loads cross-origin images (assets.tong.berlayar.ai) as plain
   <img>, so the browser caches them without CORS approval; html2canvas's
   crossOrigin re-fetch then hits that cache entry and fails, dropping the
   image from captures. In the clone: add a query param so fetches bypass
   the poisoned entry (R2 ignores query strings), AND mark the clone img
   crossorigin — otherwise the clone iframe's own plain load poisons the
   busted URL before html2canvas's CORS loader gets to it. */
const bustCrossOriginImagesInClone = (clonedDoc: Document) => {
  clonedDoc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
    try {
      const u = new URL(src, window.location.href);
      if (u.origin !== window.location.origin) {
        u.searchParams.set('playtest-cors', '1');
        img.setAttribute('crossorigin', 'anonymous');
        img.setAttribute('src', u.toString());
      }
    } catch { /* relative or malformed — leave as-is */ }
  });
};

/* html2canvas cannot render <video> elements — cinematic scenes captured as
   black boxes. Before cloning, grab each playing video's current frame as a
   data URL (taint-tested on a scratch canvas so a non-CORS video can never
   poison the recording canvas); in the clone, swap the video for an <img>
   with the same box. Game videos carry crossorigin="anonymous" so the grab
   stays origin-clean. */
const VIDEO_FRAME_ATTR = 'data-playtest-video-frame';

const tagVideoFrames = (): Element[] => {
  const tagged: Element[] = [];
  document.querySelectorAll('video').forEach((v) => {
    if (v.readyState < 2 || v.videoWidth === 0) return;
    const rect = v.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    try {
      const scratch = document.createElement('canvas');
      const scale = Math.min(1, 640 / v.videoWidth);
      scratch.width = Math.max(2, Math.round(v.videoWidth * scale));
      scratch.height = Math.max(2, Math.round(v.videoHeight * scale));
      const ctx = scratch.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, scratch.width, scratch.height);
      // PNG keeps alpha for transparent overlay videos; JPEG otherwise
      const corner = ctx.getImageData(0, 0, 1, 1).data; // throws if tainted
      const hasAlpha = corner[3] < 255;
      const url = scratch.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', 0.7);
      v.setAttribute(VIDEO_FRAME_ATTR, url);
      tagged.push(v);
    } catch { /* tainted or unreadable — leave as-is (renders blank) */ }
  });
  return tagged;
};

const swapVideosInClone = (clonedDoc: Document) => {
  clonedDoc.querySelectorAll(`video[${VIDEO_FRAME_ATTR}]`).forEach((v) => {
    const frame = v.getAttribute(VIDEO_FRAME_ATTR);
    if (!frame) return;
    const img = clonedDoc.createElement('img');
    img.src = frame;
    img.className = v.className;
    img.setAttribute('style', v.getAttribute('style') || '');
    const view = clonedDoc.defaultView || window;
    const cs = view.getComputedStyle(v);
    img.style.width = cs.width;
    img.style.height = cs.height;
    img.style.objectFit = cs.objectFit || 'cover';
    v.replaceWith(img);
  });
};

const prepareClone = (clonedDoc: Document) => {
  freezeAnimationsInClone(clonedDoc);
  bustCrossOriginImagesInClone(clonedDoc);
  swapVideosInClone(clonedDoc);
};

const snapshotOptions = (scale: number) => ({
  backgroundColor: '#0d0d1a',
  scale,
  width: window.innerWidth,
  height: window.innerHeight,
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight,
  scrollX: 0,
  scrollY: 0,
  logging: false,
  useCORS: true,
  // allowTaint must stay false: one tainted snapshot painted onto the
  // recording canvas permanently kills its captureStream (no frames, no
  // error). Non-CORS images are skipped instead — game asset hosts must
  // serve CORS headers (tong-assets R2 bucket has a CORS rule for this).
  allowTaint: false,
  ignoreElements: ignorePlaytestElements,
  onclone: prepareClone,
});

/* Capture the visible page with animation and video state preserved */
const captureDom = async (scale: number): Promise<HTMLCanvasElement> => {
  const tagged = tagAnimatedElements();
  const taggedVideos = tagVideoFrames();
  try {
    return await html2canvas(document.documentElement, snapshotOptions(scale));
  } finally {
    tagged.forEach((el) => el.removeAttribute(FREEZE_ATTR));
    taggedVideos.forEach((el) => el.removeAttribute(VIDEO_FRAME_ATTR));
  }
};

/* Snapshot cadence: every tick feeds the video recorder; every 2nd tick
   (5s) is kept as a filmstrip frame for the replay page. */
const SNAPSHOT_INTERVAL_MS = 2500;
const FILMSTRIP_EVERY_NTH = 2;

/* ── Component ────────────────────────────────────────────────────── */

export function PlaytestOverlay({ targetRef, sessionId, onSubmit, onRequestClarification }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const frameCaptureRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotCountRef = useRef(0);
  const snapshotBusyRef = useRef(false);

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

  // Filmstrip: periodic full-DOM screenshots for playback on mobile
  const filmstripRef = useRef<{ ts: number; blob: Blob }[]>([]);

  // Continuous upload: stream recorder chunks to the server during the
  // session so abandoned sessions (tab closed, no Submit) still have video
  const uploadedChunkCountRef = useRef(0);
  const chunkSeqRef = useRef(0);
  const chunkFlushBusyRef = useRef(false);

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

  // Hidden canvas that MediaRecorder records via captureStream(). The game is
  // DOM-rendered (no canvas elements), so frames come from periodic
  // html2canvas snapshots painted into this canvas — each paint emits a
  // video frame, producing a low-fps but real recording on every platform.
  const ensureFrameCaptureCanvas = useCallback((): HTMLCanvasElement => {
    let fc = frameCaptureRef.current;
    if (!fc) {
      fc = document.createElement('canvas');
      // Match the 0.5-scale snapshots; even dimensions for the video encoder
      fc.width = Math.max(2, Math.floor(window.innerWidth / 2) & ~1);
      fc.height = Math.max(2, Math.floor(window.innerHeight / 2) & ~1);
      fc.style.display = 'none';
      document.body.appendChild(fc);
      const ctx = fc.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, fc.width, fc.height);
      }
      frameCaptureRef.current = fc;
    }
    return fc;
  }, []);

  const captureSnapshot = useCallback(async () => {
    if (snapshotBusyRef.current) return; // html2canvas can be slow; don't overlap
    snapshotBusyRef.current = true;
    try {
      const canvas = await captureDom(0.5);
      // 1. Paint into the recording canvas → emits a frame on the capture stream
      const fc = frameCaptureRef.current;
      const ctx = fc?.getContext('2d');
      if (fc && ctx) ctx.drawImage(canvas, 0, 0, fc.width, fc.height);
      // 2. Keep every Nth snapshot as a filmstrip frame for replay
      if (snapshotCountRef.current % FILMSTRIP_EVERY_NTH === 0) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.7),
        );
        if (blob && startTimeRef.current) {
          const ts = Math.floor((Date.now() - startTimeRef.current) / 1000);
          filmstripRef.current.push({ ts, blob });
          // Cap at 120 frames (10 min at 5s intervals) to limit memory
          if (filmstripRef.current.length > 120) filmstripRef.current.shift();
        }
      }
      snapshotCountRef.current++;
    } catch { /* best-effort */ } finally {
      snapshotBusyRef.current = false;
    }
  }, []);

  /* ── Screenshot capture (html2canvas — full DOM) ─────────────── */

  const captureScreenshot = useCallback(async (annotationId: string): Promise<void> => {
    try {
      const canvas = await captureDom(1);

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
  }, []);

  /* ── Recording: HD display stream → snapshot canvas → screenshots-only ── */

  const displayStreamRef = useRef<MediaStream | null>(null);

  const startRecordingFromStream = useCallback((stream: MediaStream) => {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : '';
    if (!mimeType) { setIsRecording(true); return; }
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
    recordingMimeRef.current = mimeType;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const startRecording = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Tier 1: HD screen share handed over from the /playtest entry page,
    // where the user gesture happened (getDisplayMedia can't be called here —
    // recording auto-starts with no gesture, and mobile doesn't support it).
    const shared = takeDisplayStream();
    if (shared) {
      displayStreamRef.current = shared;
      shared.getVideoTracks()[0]?.addEventListener('ended', () => {
        // User stopped sharing via browser UI — keep what we recorded
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== 'inactive') rec.stop();
        displayStreamRef.current = null;
      });
      startRecordingFromStream(shared);
      return;
    }

    // Tier 2: record the snapshot canvas — works on any DOM-rendered scene
    try {
      const fc = ensureFrameCaptureCanvas();
      if (typeof fc.captureStream === 'function') {
        const stream = fc.captureStream(15);
        startRecordingFromStream(stream);
        return;
      }
    } catch { /* fall through */ }

    // Tier 3: screenshots only — no video recording
    setIsRecording(true);
  }, [ensureFrameCaptureCanvas, startRecordingFromStream]);

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
    const filmstrip = filmstripRef.current.slice(); // copy
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      onSubmit({ recording: new Blob([], { type: 'video/webm' }), annotations, screenshots: screenshotBlobsRef.current, stateLog, filmstrip });
      return;
    }
    recorder.onstop = () => {
      onSubmit({ recording: new Blob(chunksRef.current, { type: recordingMimeRef.current }), annotations, screenshots: screenshotBlobsRef.current, stateLog, filmstrip });
    };
    if (recorder.state !== 'inactive') recorder.stop();
    setIsRecording(false);
  }, [annotations, onSubmit]);

  useEffect(() => {
    // Log browser metadata at session start
    sessionLogger.logTrace('playtest_session_start', {
      sessionId,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      touchSupport: 'ontouchstart' in window,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: (navigator as any).connection
        ? { effectiveType: (navigator as any).connection.effectiveType, downlink: (navigator as any).connection.downlink }
        : null,
    });

    const timer = setTimeout(() => startRecording(), 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRecording]);

  // Periodic state snapshots every 10s for replay reconstruction
  useEffect(() => {
    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== 'undefined' && (window as any).__TONG_QA__) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qa = (window as any).__TONG_QA__ as { getState: () => Record<string, unknown> };
        sessionLogger.logStateSnapshot(qa.getState());
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Snapshot loop: feeds the video recorder every tick + filmstrip every Nth
  useEffect(() => {
    const interval = setInterval(() => {
      if (!startTimeRef.current) return; // not recording yet
      void captureSnapshot();
    }, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [captureSnapshot]);

  /* ── Continuous chunk upload ────────────────────────────────────── */

  // Send recorder chunks accumulated since the last flush. Chunks from one
  // MediaRecorder session concatenate into a playable file server-side, so
  // even sessions that never hit Submit leave a recording behind.
  const flushChunks = useCallback(async (keepalive = false) => {
    if (chunkFlushBusyRef.current) return;
    const pending = chunksRef.current.slice(uploadedChunkCountRef.current);
    if (pending.length === 0) return;
    chunkFlushBusyRef.current = true;
    const seq = chunkSeqRef.current;
    const body = new Blob(pending, { type: recordingMimeRef.current });
    // keepalive bodies are capped (~64KB); a few seconds of low-fps video
    // fits, but skip rather than fail loudly if this flush is too large
    if (keepalive && body.size > 60_000) {
      chunkFlushBusyRef.current = false;
      return;
    }
    try {
      const res = await fetch(
        `${getPublicApiBase()}/api/v1/playtest/sessions/${sessionId}/recording-chunks?seq=${seq}`,
        { method: 'POST', body, keepalive },
      );
      if (res.ok) {
        uploadedChunkCountRef.current += pending.length;
        chunkSeqRef.current = seq + 1;
      }
    } catch { /* retry on next flush */ } finally {
      chunkFlushBusyRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    const interval = setInterval(() => { void flushChunks(); }, 10_000);
    return () => clearInterval(interval);
  }, [flushChunks]);

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
    const target = targetRef.current;
    if (!canvas) return;
    const resize = () => {
      // Size canvas to game container, not window — prevents drawing outside game area
      const rect = target?.getBoundingClientRect();
      canvas.width = rect?.width || window.innerWidth;
      canvas.height = rect?.height || window.innerHeight;
      drawHistory.current = [];
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [activeTool, targetRef]);

  /* ── Auto-save ──────────────────────────────────────────────────── */

  const uploadUrl = `${getPublicApiBase()}/api/v1/playtest/sessions/${sessionId}/upload`;

  useEffect(() => {
    // partial=1: save artifacts without finalizing the session — hiding the
    // tab or navigating away must not mark it submitted or trigger analysis
    const savePartial = () => {
      void flushChunks(true);
      if (annotations.length > 0) {
        const formData = new FormData();
        formData.append('annotations', JSON.stringify(annotations));
        navigator.sendBeacon?.(`${uploadUrl}?partial=1`, formData);
      }
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (annotations.length > 0 || chunksRef.current.length > 0) {
        savePartial();
        e.preventDefault();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') savePartial();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [annotations, sessionId, uploadUrl, flushChunks]);

  /* ── Cleanup ────────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      if (frameCaptureRef.current) { frameCaptureRef.current.remove(); frameCaptureRef.current = null; }
      if (displayStreamRef.current) {
        displayStreamRef.current.getTracks().forEach((t) => t.stop());
        displayStreamRef.current = null;
      }
      drawHistory.current = [];
      // Revoke all thumbnail URLs
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const COLORS = ['#ff6b2c', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff'];
  const drawCount = annotations.filter((a) => a.type === 'draw').length;

  // Pill position style — clamp so expanded panel stays in viewport
  const pillStyle: React.CSSProperties = pillPos
    ? {
        position: 'fixed',
        left: Math.min(pillPos.x, window.innerWidth - (expanded ? 256 : 120)),
        top: Math.min(pillPos.y, window.innerHeight - (expanded ? 300 : 50)),
        right: 'auto', bottom: 'auto', zIndex: 9999, touchAction: 'none',
      }
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

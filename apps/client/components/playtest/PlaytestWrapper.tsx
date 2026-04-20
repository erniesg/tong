'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaytestOverlay, type Annotation, type ClarificationPrompt } from './PlaytestOverlay';
import { sessionLogger } from '@/lib/debug/session-logger';

const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';

/**
 * Wraps game content and conditionally mounts the PlaytestOverlay
 * when a playtest session is detected in sessionStorage.
 */
export function PlaytestWrapper({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<Record<string, unknown> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tong_playtest_session');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.sessionId) {
          setSessionId(data.sessionId);
          setSessionMeta(data);
        }
      }
    } catch {
      // Not a playtest session
    }
  }, []);

  const handleSubmit = useCallback(
    async (data: { recording: Blob; annotations: Annotation[]; screenshots: Map<string, Blob>; stateLog: unknown; filmstrip: { ts: number; blob: Blob }[] }) => {
      if (!sessionId) return;

      // Upload recording + annotations + screenshots + state log as multipart form data
      const formData = new FormData();
      // Only include recording if it has actual content (not the empty fallback blob)
      if (data.recording.size > 0) {
        formData.append('recording', data.recording, `${sessionId}.webm`);
      }
      formData.append('annotations', JSON.stringify(data.annotations));
      if (data.stateLog) {
        formData.append('stateLog', JSON.stringify(data.stateLog));
      }

      // Append each screenshot keyed by annotation ID
      for (const [annotationId, blob] of data.screenshots) {
        formData.append(`screenshot:${annotationId}`, blob, `${annotationId}.png`);
      }

      // Append filmstrip frames (periodic full-DOM captures)
      for (const frame of data.filmstrip) {
        formData.append(`filmstrip:${frame.ts}`, frame.blob, `frame-${frame.ts}.jpg`);
      }

      try {
        setUploading(true);
        await fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/upload`, {
          method: 'POST',
          body: formData,
        });

        sessionStorage.removeItem('tong_playtest_session');
        setUploading(false);
        setSubmitted(true);
      } catch (err) {
        console.error('Failed to upload playtest session:', err);
        setUploading(false);
      }
    },
    [sessionId],
  );

  const handleClarification = useCallback(
    async (comment: Annotation): Promise<ClarificationPrompt | null> => {
      try {
        const currentSession = sessionLogger.getCurrent();
        const stateLogExcerpt = currentSession?.entries
          ?.filter((entry) => entry.kind === 'state_snapshot' || entry.kind === 'qa_trace')
          .slice(-5)
          .map((entry) => ({ ts: entry.ts, kind: entry.kind, data: entry.data })) || [];

        const res = await fetch('/api/ai/playtest-clarify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: comment.text,
            timestamp: comment.timestamp,
            sessionId,
            sceneContext: sessionMeta?.sceneType ? String(sessionMeta.sceneType) : undefined,
            sessionMetadata: sessionMeta || undefined,
            screenshotContext: {
              hasScreenshot: Boolean(comment.screenshot),
              x: comment.x,
              y: comment.y,
            },
            stateLogExcerpt,
          }),
        });

        if (!res.ok) return null;
        const payload = await res.json();
        if (payload?.status !== 'FOLLOW_UP') return null;

        return {
          question: String(payload.question || ''),
          options: Array.isArray(payload.options)
            ? payload.options.slice(0, 3).map((option: unknown) => String(option))
            : [],
          allowOther: payload.allowOther !== false,
          rationale: payload.rationale ? String(payload.rationale) : undefined,
        };
      } catch {
        return null;
      }
    },
    [sessionId, sessionMeta],
  );

  const isActive = Boolean(sessionId) && !submitted && !uploading;

  return (
    <div ref={frameRef} className="playtest-wrapper" style={{ position: 'relative', width: '100%', minHeight: '100dvh' }}>
      {children}
      {isActive && (
        <PlaytestOverlay
          targetRef={frameRef}
          sessionId={sessionId!}
          onSubmit={handleSubmit}
          onRequestClarification={handleClarification}
        />
      )}
      {uploading && (
        <div className="playtest-uploading-toast">
          Uploading session...
        </div>
      )}
      {submitted && (
        <div className="playtest-submitted-toast">
          Session submitted — thanks for playtesting!
        </div>
      )}
    </div>
  );
}

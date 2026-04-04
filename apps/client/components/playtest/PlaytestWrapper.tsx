'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaytestOverlay, type Annotation } from './PlaytestOverlay';

const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';

/**
 * Wraps game content and conditionally mounts the PlaytestOverlay
 * when a playtest session is detected in sessionStorage.
 */
export function PlaytestWrapper({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tong_playtest_session');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.sessionId) setSessionId(data.sessionId);
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
      formData.append('recording', data.recording, `${sessionId}.webm`);
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
        await fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/upload`, {
          method: 'POST',
          body: formData,
        });

        // Mark as submitted but keep sessionId so wrapper div stays mounted
        // (prevents React from remounting children and resetting game state)
        sessionStorage.removeItem('tong_playtest_session');
        setSubmitted(true);
      } catch (err) {
        console.error('Failed to upload playtest session:', err);
      }
    },
    [sessionId],
  );

  const handleClarification = useCallback(
    async (comment: Annotation): Promise<string | null> => {
      try {
        const res = await fetch('/api/ai/playtest-clarify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: comment.text,
            timestamp: comment.timestamp,
            sessionId,
          }),
        });

        if (!res.ok) return null;

        // Read the streaming response as text
        const reader = res.body?.getReader();
        if (!reader) return null;

        let text = '';
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }

        // Parse Vercel AI SDK data stream format — extract text chunks
        const lines = text.split('\n').filter(Boolean);
        let reply = '';
        for (const line of lines) {
          // Vercel AI SDK streams as "0:text\n" format
          if (line.startsWith('0:')) {
            try {
              reply += JSON.parse(line.slice(2));
            } catch {
              reply += line.slice(2);
            }
          }
        }

        if (!reply || reply.trim() === 'CLEAR') return null;
        return reply.trim();
      } catch {
        return null;
      }
    },
    [sessionId],
  );

  const isActive = Boolean(sessionId) && !submitted;

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
      {submitted && (
        <div className="playtest-submitted-toast">
          Session submitted — thanks for playtesting!
        </div>
      )}
    </div>
  );
}

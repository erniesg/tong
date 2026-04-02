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
    async (data: { recording: Blob; annotations: Annotation[]; screenshots: Map<string, Blob> }) => {
      if (!sessionId) return;

      // Upload recording + annotations + screenshots as multipart form data
      const formData = new FormData();
      formData.append('recording', data.recording, `${sessionId}.webm`);
      formData.append('annotations', JSON.stringify(data.annotations));

      // Append each screenshot keyed by annotation ID
      for (const [annotationId, blob] of data.screenshots) {
        formData.append(`screenshot:${annotationId}`, blob, `${annotationId}.png`);
      }

      try {
        await fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/upload`, {
          method: 'POST',
          body: formData,
        });

        // Clear the playtest session marker
        sessionStorage.removeItem('tong_playtest_session');
        setSessionId(null);
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

  if (!sessionId) return <>{children}</>;

  return (
    <div ref={frameRef} style={{ position: 'relative', width: '100%', minHeight: '100dvh' }}>
      {children}
      <PlaytestOverlay
        targetRef={frameRef}
        sessionId={sessionId}
        onSubmit={handleSubmit}
        onRequestClarification={handleClarification}
      />
    </div>
  );
}

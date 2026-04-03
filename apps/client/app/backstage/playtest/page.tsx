'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

interface PlaytestSession {
  sessionId: string;
  city: string;
  sceneType: string;
  language: string;
  status: 'pending' | 'active' | 'submitted';
  createdAt: string;
}

interface Annotation {
  id: string;
  timestamp: number;
  type: 'draw' | 'comment';
  pathData?: string;
  color?: string;
  lineWidth?: number;
  text?: string;
  clarified?: boolean;
  screenshotUrl?: string;
  x?: number;
  y?: number;
}

/* ── API ──────────────────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';
const RUNS_BASE = 'https://runs.tong.berlayar.ai';

async function fetchSessions(): Promise<PlaytestSession[]> {
  const res = await fetch(`${API_BASE}/api/v1/playtest/sessions`, {
    headers: { 'x-demo-password': localStorage.getItem('tong_demo_pw') || '' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.sessions || data || []).map((s: Record<string, unknown>) => ({
    sessionId: s.sessionId || s.session_id,
    city: s.city,
    sceneType: s.sceneType || s.scene_type,
    language: s.language,
    status: s.status,
    createdAt: s.createdAt || s.created_at,
  }));
}

async function fetchAnnotations(sessionId: string): Promise<Annotation[]> {
  try {
    const res = await fetch(`${RUNS_BASE}/playtest/${sessionId}/annotations.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.annotations || [];
  } catch {
    return [];
  }
}

function recordingUrl(sessionId: string) {
  return `${RUNS_BASE}/playtest/${sessionId}/recording.webm`;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const STATUS_COLORS: Record<string, string> = {
  submitted: '#22c55e',
  active: '#3b82f6',
  pending: '#94a3b8',
};

/* ── Component ────────────────────────────────────────────────────── */

export default function PlaytestViewerPage() {
  const [sessions, setSessions] = useState<PlaytestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchSessions().then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, []);

  const selectSession = useCallback(async (sessionId: string) => {
    setSelected(sessionId);
    setAnnotations([]);
    setActiveAnnotation(null);
    setScreenshotPreview(null);
    setLoadingAnnotations(true);

    // Check if recording exists
    try {
      const res = await fetch(recordingUrl(sessionId), { method: 'HEAD' });
      setHasRecording(res.ok && (res.headers.get('content-length') || '0') !== '0');
    } catch {
      setHasRecording(false);
    }

    const anns = await fetchAnnotations(sessionId);
    setAnnotations(anns);
    setLoadingAnnotations(false);
  }, []);

  const seekToAnnotation = useCallback((ann: Annotation) => {
    setActiveAnnotation(ann.id);
    if (videoRef.current && ann.timestamp) {
      videoRef.current.currentTime = ann.timestamp;
    }
    if (ann.screenshotUrl) {
      setScreenshotPreview(ann.screenshotUrl);
    }
  }, []);

  const selectedSession = sessions.find((s) => s.sessionId === selected);
  const submittedCount = sessions.filter((s) => s.status === 'submitted').length;

  return (
    <div>
      <div className="triage-header">
        <h1 className="triage-title">Playtest Viewer</h1>
        <p className="triage-subtitle">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} ·{' '}
          {submittedCount} submitted
        </p>
      </div>

      <div className="triage-layout">
        {/* ── Session list ──────────────────────────────────────── */}
        <div className="triage-sidebar">
          <h2 className="triage-section-title">Sessions</h2>
          {loading && <p className="triage-muted">Loading...</p>}
          {!loading && sessions.length === 0 && (
            <p className="triage-muted">No playtest sessions yet.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              className={`triage-session-card ${selected === s.sessionId ? 'triage-session-selected' : ''}`}
              onClick={() => selectSession(s.sessionId)}
            >
              <div className="triage-session-top">
                <span className="triage-session-id">{s.sessionId.slice(0, 8)}</span>
                <span
                  className="triage-status"
                  style={{ color: STATUS_COLORS[s.status] || '#94a3b8' }}
                >
                  {s.status}
                </span>
              </div>
              <div className="triage-session-meta">
                {s.city} · {s.sceneType} · {s.language}
              </div>
              <div className="triage-session-time">
                {new Date(s.createdAt + 'Z').toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {/* ── Viewer panel ──────────────────────────────────────── */}
        <div className="triage-main">
          {!selected && (
            <div className="triage-empty">Select a session to view</div>
          )}

          {selected && (
            <div className="playtest-viewer">
              {/* Session info */}
              <div className="playtest-viewer-header">
                <h2 className="triage-section-title">
                  {selectedSession?.city} / {selectedSession?.sceneType}
                </h2>
                <span className="triage-session-id" style={{ fontSize: 12 }}>
                  {selected}
                </span>
              </div>

              {/* Recording player */}
              {hasRecording && (
                <div className="playtest-viewer-video">
                  <video
                    ref={videoRef}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', borderRadius: 8, background: '#000' }}
                  >
                    <source src={recordingUrl(selected)} type="video/webm" />
                  </video>
                </div>
              )}

              {!hasRecording && !loadingAnnotations && (
                <div className="playtest-viewer-no-video">
                  No recording available (annotations-only session)
                </div>
              )}

              {/* Screenshot preview */}
              {screenshotPreview && (
                <div className="playtest-viewer-screenshot">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Screenshot</span>
                    <button
                      onClick={() => setScreenshotPreview(null)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16 }}
                    >
                      &times;
                    </button>
                  </div>
                  <img
                    src={screenshotPreview}
                    alt="Annotation screenshot"
                    style={{ width: '100%', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}

              {/* Annotations timeline */}
              <div className="playtest-viewer-annotations">
                <h3 className="triage-section-title">
                  Annotations ({annotations.length})
                </h3>

                {loadingAnnotations && <p className="triage-muted">Loading...</p>}

                {!loadingAnnotations && annotations.length === 0 && (
                  <p className="triage-muted">No annotations in this session.</p>
                )}

                {annotations.map((ann) => (
                  <button
                    key={ann.id}
                    className={`playtest-viewer-ann ${activeAnnotation === ann.id ? 'playtest-viewer-ann-active' : ''}`}
                    onClick={() => seekToAnnotation(ann)}
                  >
                    <div className="playtest-viewer-ann-header">
                      <span className="playtest-viewer-ann-time">{fmt(ann.timestamp)}</span>
                      <span className="playtest-viewer-ann-type">
                        {ann.type === 'draw' ? '\u270E draw' : '\uD83D\uDCAC comment'}
                      </span>
                      {ann.clarified && (
                        <span className="playtest-viewer-ann-clarified">AI clarified</span>
                      )}
                      {ann.screenshotUrl && (
                        <span className="playtest-viewer-ann-has-screenshot"
                          title="Has screenshot"
                        >
                          \uD83D\uDCF7
                        </span>
                      )}
                    </div>
                    {ann.text && (
                      <p className="playtest-viewer-ann-text">{ann.text}</p>
                    )}
                    {ann.type === 'draw' && ann.pathData && (
                      <div className="playtest-viewer-ann-draw">
                        <svg viewBox="0 0 400 400" style={{ width: 60, height: 60 }}>
                          <path
                            d={ann.pathData}
                            fill="none"
                            stroke={ann.color || '#ff6b2c'}
                            strokeWidth={ann.lineWidth || 3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Quick actions */}
              <div className="playtest-viewer-actions">
                <a
                  href={`/backstage/triage`}
                  className="triage-btn-analyze"
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  Triage this session
                </a>
                <a
                  href={`${RUNS_BASE}/playtest/${selected}/annotations.json`}
                  target="_blank"
                  rel="noopener"
                  className="triage-btn-analyze"
                  style={{ textDecoration: 'none', textAlign: 'center', background: 'rgba(255,255,255,0.1)' }}
                >
                  Raw JSON
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const pw = typeof window !== 'undefined' ? localStorage.getItem('tong_demo_pw') || '' : '';
  const headers: Record<string, string> = {};
  if (pw) headers['x-demo-password'] = pw;
  const res = await fetch(`${API_BASE}/api/v1/playtest/sessions`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  const list = data.sessions || data || [];
  return (Array.isArray(list) ? list : []).map((s: Record<string, unknown>) => ({
    sessionId: String(s.sessionId || s.session_id || ''),
    city: String(s.city || ''),
    sceneType: String(s.sceneType || s.scene_type || ''),
    language: String(s.language || ''),
    status: (s.status || 'pending') as PlaytestSession['status'],
    createdAt: String(s.createdAt || s.created_at || ''),
  }));
}

async function fetchAnnotations(sessionId: string): Promise<Annotation[]> {
  // Try Worker API proxy first (avoids R2 CORS issues), fallback to direct R2
  try {
    const res = await fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/annotations`, {
      headers: { 'x-demo-password': localStorage.getItem('tong_demo_pw') || '' },
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data.annotations || [];
    }
  } catch { /* try direct */ }
  try {
    const res = await fetch(`${RUNS_BASE}/playtest/${sessionId}/annotations.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.annotations || [];
  } catch {
    return [];
  }
}

async function checkRecording(sessionId: string): Promise<string | null> {
  // Try Worker API proxy first, fallback to direct R2
  const proxyUrl = `${API_BASE}/api/v1/playtest/sessions/${sessionId}/recording`;
  try {
    const res = await fetch(proxyUrl, { method: 'HEAD' });
    if (res.ok) return proxyUrl;
  } catch { /* try direct */ }
  const directUrl = `${RUNS_BASE}/playtest/${sessionId}/recording.webm`;
  try {
    const res = await fetch(directUrl, { method: 'HEAD' });
    if (res.ok && (res.headers.get('content-length') || '0') !== '0') return directUrl;
  } catch { /* no recording */ }
  return null;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

interface StateLogEntry {
  ts: number;
  kind: string;
  data: Record<string, unknown>;
}

interface StateLog {
  id: string;
  mode: string;
  cityId: string;
  locationId: string;
  startedAt: number;
  endedAt?: number;
  entries: StateLogEntry[];
}

async function fetchStateLog(sessionId: string): Promise<StateLog | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/state-log`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const LOG_KIND_LABELS: Record<string, string> = {
  session_start: 'Session started',
  ai_request: 'User message',
  ai_response: 'AI response',
  tool_call: 'Tool call',
  tool_result: 'Tool result',
  exercise_shown: 'Exercise shown',
  exercise_result: 'Exercise result',
  choice_shown: 'Choices offered',
  choice_selected: 'Choice selected',
  user_tap: 'User tap',
  phase_change: 'Phase change',
  scene_summary: 'Scene summary',
  state_snapshot: 'State snapshot',
  qa_trace: 'QA trace',
  error: 'Error',
};

const LOG_KIND_COLORS: Record<string, string> = {
  ai_request: '#3b82f6',
  ai_response: '#8b5cf6',
  tool_call: '#f59e0b',
  exercise_shown: '#22c55e',
  exercise_result: '#22c55e',
  phase_change: '#ef4444',
  state_snapshot: '#94a3b8',
  user_tap: '#06b6d4',
  error: '#ef4444',
};

/* Status uses triage-status-{status} classes for consistent styling */

/* ── Component ────────────────────────────────────────────────────── */

export default function PlaytestViewerPage() {
  const [sessions, setSessions] = useState<PlaytestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);
  const [recordingSrc, setRecordingSrc] = useState<string | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [stateLog, setStateLog] = useState<StateLog | null>(null);
  const [showStateLog, setShowStateLog] = useState(false);
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
    setRecordingSrc(null);
    setStateLog(null);
    setShowStateLog(false);
    setLoadingAnnotations(true);

    const [recUrl, anns, log] = await Promise.all([
      checkRecording(sessionId),
      fetchAnnotations(sessionId),
      fetchStateLog(sessionId),
    ]);
    setRecordingSrc(recUrl);
    setStateLog(log);
    setAnnotations(anns);
    setLoadingAnnotations(false);
  }, []);

  const seekToAnnotation = useCallback((ann: Annotation) => {
    setActiveAnnotation(ann.id);
    if (videoRef.current && ann.timestamp) {
      videoRef.current.currentTime = ann.timestamp;
    }
    if (ann.screenshotUrl && selected) {
      // Use Worker proxy to avoid CORS issues with R2 direct URLs
      const proxyUrl = `${API_BASE}/api/v1/playtest/sessions/${selected}/screenshots/${ann.id}.png`;
      setScreenshotPreview(proxyUrl);
    }
  }, [selected]);

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
                <span className={`triage-status triage-status-${s.status}`}>
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
              {recordingSrc && (
                <div className="playtest-viewer-video">
                  <video
                    ref={videoRef}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', borderRadius: 8, background: '#000' }}
                  >
                    <source src={recordingSrc} type="video/webm" />
                  </video>
                </div>
              )}

              {!recordingSrc && !loadingAnnotations && (
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

              {/* State replay log */}
              {stateLog && (
                <div className="playtest-viewer-statelog">
                  <button
                    className="playtest-viewer-statelog-toggle"
                    onClick={() => setShowStateLog(!showStateLog)}
                  >
                    <h3 className="triage-section-title" style={{ margin: 0 }}>
                      State Log ({stateLog.entries.length} events)
                    </h3>
                    <span>{showStateLog ? '\u25B4' : '\u25BE'}</span>
                  </button>

                  {showStateLog && (
                    <div className="playtest-viewer-statelog-entries">
                      {stateLog.entries.map((entry, i) => {
                        const relTime = Math.floor((entry.ts - stateLog.startedAt) / 1000);
                        const color = LOG_KIND_COLORS[entry.kind] || '#94a3b8';
                        return (
                          <div key={i} className="playtest-statelog-entry">
                            <span className="playtest-statelog-time">{fmt(relTime)}</span>
                            <span className="playtest-statelog-kind" style={{ color }}>
                              {LOG_KIND_LABELS[entry.kind] || entry.kind}
                            </span>
                            <span className="playtest-statelog-data">
                              {entry.kind === 'tool_call' && `${entry.data.toolName}()`}
                              {entry.kind === 'ai_request' && String(entry.data.content || '').slice(0, 80)}
                              {entry.kind === 'exercise_shown' && `${entry.data.exerciseType}: ${entry.data.exerciseId}`}
                              {entry.kind === 'exercise_result' && (entry.data.correct ? 'Correct' : 'Incorrect')}
                              {entry.kind === 'choice_selected' && `→ ${entry.data.choiceId}`}
                              {entry.kind === 'user_tap' && String(entry.data.action || '')}
                              {entry.kind === 'phase_change' && `${entry.data.from} → ${entry.data.to}`}
                              {entry.kind === 'state_snapshot' && `phase:${entry.data.phase}`}
                              {entry.kind === 'error' && String(entry.data.message || '')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

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

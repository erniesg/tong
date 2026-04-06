'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

interface DeviceMeta {
  userAgent?: string;
  platform?: string;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  touchSupport?: boolean;
}

interface PlaytestSession {
  sessionId: string;
  city: string;
  sceneType: string;
  language: string;
  status: 'pending' | 'active' | 'submitted';
  createdAt: string;
  device?: DeviceMeta;
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

/** Fetch device metadata from the session's state log (qa_trace → playtest_session_start) */
async function fetchDeviceMeta(sessionId: string): Promise<DeviceMeta | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/state-log`);
    if (!res.ok) return null;
    const data = await res.json();
    const entries = data.logs || data.entries || [];
    const qaEntry = entries.find(
      (e: { kind: string; data?: { event?: string } }) =>
        e.kind === 'qa_trace' && e.data?.event === 'playtest_session_start',
    );
    if (!qaEntry?.data) return null;
    const d = qaEntry.data;
    return {
      userAgent: d.userAgent,
      platform: d.platform,
      screenWidth: d.screenWidth,
      screenHeight: d.screenHeight,
      viewportWidth: d.viewportWidth,
      viewportHeight: d.viewportHeight,
      devicePixelRatio: d.devicePixelRatio,
      touchSupport: d.touchSupport,
    };
  } catch {
    return null;
  }
}

async function deleteSessions(sessionIds: string[]): Promise<void> {
  await Promise.allSettled(
    sessionIds.map((id) =>
      fetch(`${API_BASE}/api/v1/playtest/sessions/${id}`, { method: 'DELETE' }),
    ),
  );
}

async function fetchAnnotations(sessionId: string): Promise<Annotation[]> {
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
  const proxyUrl = `${API_BASE}/api/v1/playtest/sessions/${sessionId}/recording`;
  try {
    const res = await fetch(proxyUrl, { method: 'HEAD' });
    if (res.ok && (res.headers.get('content-length') || '0') !== '0') return proxyUrl;
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

function parseDevice(meta: DeviceMeta | undefined): string {
  if (!meta) return '';
  const parts: string[] = [];
  if (meta.platform) parts.push(meta.platform);
  if (meta.screenWidth && meta.screenHeight) parts.push(`${meta.screenWidth}x${meta.screenHeight}`);
  if (meta.devicePixelRatio && meta.devicePixelRatio > 1) parts.push(`${meta.devicePixelRatio}x`);
  if (meta.touchSupport) parts.push('touch');
  // Extract browser from UA
  const ua = meta.userAgent || '';
  if (ua.includes('Safari') && !ua.includes('Chrome')) parts.push('Safari');
  else if (ua.includes('Chrome')) parts.push('Chrome');
  else if (ua.includes('Firefox')) parts.push('Firefox');
  return parts.join(' · ');
}

/** Check if annotation has real AI clarification content (not just auto-tagged) */
function hasRealClarification(ann: Annotation): boolean {
  if (!ann.clarified || !ann.text) return false;
  // Real clarification has the "---\nAI:" separator appended by handleAiResponse
  return ann.text.includes('\n---\nAI:');
}

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
  const [filmstrip, setFilmstrip] = useState<{ ts: number; url: string }[]>([]);
  const [filmstripIdx, setFilmstripIdx] = useState(0);
  const [filmstripPlaying, setFilmstripPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Bulk selection state
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSessions().then(async (list) => {
      setSessions(list);
      setLoading(false);
      // Fetch device metadata for each session in parallel (best-effort)
      const metas = await Promise.allSettled(
        list.map((s) => fetchDeviceMeta(s.sessionId)),
      );
      setSessions((prev) =>
        prev.map((s, i) => ({
          ...s,
          device: metas[i].status === 'fulfilled' && metas[i].value ? metas[i].value! : undefined,
        })),
      );
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

    const [recUrl, anns, log, filmstripData] = await Promise.all([
      checkRecording(sessionId),
      fetchAnnotations(sessionId),
      fetchStateLog(sessionId),
      fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/filmstrip`)
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []) as Promise<{ ts: number; url: string }[]>,
    ]);
    setRecordingSrc(recUrl);
    setStateLog(log);
    setFilmstrip((filmstripData || []).map((f: { ts: number; url: string }) => ({
      ts: f.ts,
      url: `${API_BASE}/api/v1/playtest/sessions/${sessionId}/filmstrip/frame-${f.ts}.jpg`,
    })));
    setFilmstripIdx(0);
    setFilmstripPlaying(false);
    setAnnotations(anns);
    setLoadingAnnotations(false);
  }, []);

  const seekToAnnotation = useCallback((ann: Annotation) => {
    setActiveAnnotation(ann.id);
    if (videoRef.current && ann.timestamp) {
      videoRef.current.currentTime = ann.timestamp;
    }
    if (ann.screenshotUrl && selected) {
      const proxyUrl = `${API_BASE}/api/v1/playtest/sessions/${selected}/screenshots/${ann.id}.png`;
      setScreenshotPreview(proxyUrl);
    }
  }, [selected]);

  // Filmstrip auto-play
  useEffect(() => {
    if (!filmstripPlaying || filmstrip.length === 0) return;
    const interval = setInterval(() => {
      setFilmstripIdx((prev) => {
        if (prev >= filmstrip.length - 1) { setFilmstripPlaying(false); return prev; }
        return prev + 1;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [filmstripPlaying, filmstrip.length]);

  // Bulk selection helpers
  const allChecked = sessions.length > 0 && checked.size === sessions.length;
  const someChecked = checked.size > 0;

  const toggleAll = () => {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(sessions.map((s) => s.sessionId)));
    }
  };

  const toggleOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (checked.size === 0) return;
    const confirmed = confirm(`Delete ${checked.size} session${checked.size > 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;
    setDeleting(true);
    await deleteSessions([...checked]);
    setSessions((prev) => prev.filter((s) => !checked.has(s.sessionId)));
    if (selected && checked.has(selected)) setSelected(null);
    setChecked(new Set());
    setDeleting(false);
  };

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 className="triage-section-title" style={{ margin: 0 }}>Sessions</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted, #888)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
                All
              </label>
              {someChecked && (
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 11,
                    cursor: deleting ? 'wait' : 'pointer',
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'Deleting...' : `Delete (${checked.size})`}
                </button>
              )}
            </div>
          </div>
          {loading && <p className="triage-muted">Loading...</p>}
          {!loading && sessions.length === 0 && (
            <p className="triage-muted">No playtest sessions yet.</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.sessionId}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}
            >
              <input
                type="checkbox"
                checked={checked.has(s.sessionId)}
                onClick={(e) => toggleOne(s.sessionId, e)}
                onChange={() => {}}
                style={{ marginTop: 10, cursor: 'pointer', flexShrink: 0 }}
              />
              <button
                className={`triage-session-card ${selected === s.sessionId ? 'triage-session-selected' : ''}`}
                onClick={() => selectSession(s.sessionId)}
                style={{ flex: 1 }}
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
                {s.device && (
                  <div className="triage-session-meta" style={{ fontSize: 10, opacity: 0.6 }}>
                    {parseDevice(s.device)}
                  </div>
                )}
                <div className="triage-session-time">
                  {new Date(s.createdAt + 'Z').toLocaleString()}
                </div>
              </button>
            </div>
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
                {selectedSession?.device && (
                  <div style={{ fontSize: 12, color: 'var(--muted, #888)', marginTop: 4 }}>
                    {selectedSession.device.platform}
                    {selectedSession.device.screenWidth ? ` · ${selectedSession.device.screenWidth}x${selectedSession.device.screenHeight}` : ''}
                    {selectedSession.device.devicePixelRatio ? ` · ${selectedSession.device.devicePixelRatio}x DPR` : ''}
                    {selectedSession.device.viewportWidth ? ` · viewport ${selectedSession.device.viewportWidth}x${selectedSession.device.viewportHeight}` : ''}
                    {selectedSession.device.touchSupport ? ' · touch' : ''}
                  </div>
                )}
              </div>

              {/* Recording player — only show if non-empty */}
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

              {/* Filmstrip player */}
              {filmstrip.length > 0 && (
                <div className="playtest-filmstrip-player">
                  <div className="playtest-filmstrip-frame">
                    <img src={filmstrip[filmstripIdx]?.url} alt={`Frame at ${fmt(filmstrip[filmstripIdx]?.ts || 0)}`} />
                  </div>
                  <div className="playtest-filmstrip-controls">
                    <button onClick={() => setFilmstripIdx(Math.max(0, filmstripIdx - 1))} disabled={filmstripIdx === 0}>&lt;</button>
                    <button onClick={() => setFilmstripPlaying(!filmstripPlaying)}>
                      {filmstripPlaying ? '\u23F8' : '\u25B6'}
                    </button>
                    <button onClick={() => setFilmstripIdx(Math.min(filmstrip.length - 1, filmstripIdx + 1))} disabled={filmstripIdx >= filmstrip.length - 1}>&gt;</button>
                    <span className="playtest-filmstrip-time">{fmt(filmstrip[filmstripIdx]?.ts || 0)}</span>
                    <input
                      type="range"
                      min={0}
                      max={filmstrip.length - 1}
                      value={filmstripIdx}
                      onChange={(e) => { setFilmstripIdx(Number(e.target.value)); setFilmstripPlaying(false); }}
                      className="playtest-filmstrip-scrubber"
                    />
                    <span className="playtest-filmstrip-counter">{filmstripIdx + 1}/{filmstrip.length}</span>
                  </div>
                </div>
              )}

              {!recordingSrc && filmstrip.length === 0 && !loadingAnnotations && (
                <div className="playtest-viewer-no-video">
                  No recording or filmstrip available
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
                      {hasRealClarification(ann) && (
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

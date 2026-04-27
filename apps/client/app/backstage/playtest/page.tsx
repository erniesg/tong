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
  screenshot?: string;
  x?: number;
  y?: number;
}

interface AnalysisResult {
  sessionId: string;
  mode: string;
  preset: string;
  model: string;
  analysisId: string;
  screenshotCount: number;
  tokensUsed: { inputTokens: number; outputTokens: number; totalTokens: number };
  result: {
    sessionSummary: string;
    issues: Array<{
      timestamp: string;
      category: string;
      severity: number;
      description: string;
      suggestedFix: string;
      autoFixable: boolean;
      affectedComponent?: string;
    }>;
    overallScore: number;
    topPriority: string;
  };
  summary: { issueCount: number; autoFixableCount: number };
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

type ViewerTab = 'filmstrip' | 'annotations' | 'gallery' | 'analysis' | 'statelog' | 'trace';

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

async function fetchStateLog(sessionId: string): Promise<StateLog | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/state-log`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchAnalysis(sessionId: string): Promise<AnalysisResult | null> {
  try {
    const res = await fetch(`${RUNS_BASE}/playtest/${sessionId}/analysis.json`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchAgentTrace(sessionId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${RUNS_BASE}/playtest/${sessionId}/agent-trace.json`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
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
  const ua = meta.userAgent || '';
  if (ua.includes('Safari') && !ua.includes('Chrome')) parts.push('Safari');
  else if (ua.includes('Chrome')) parts.push('Chrome');
  else if (ua.includes('Firefox')) parts.push('Firefox');
  return parts.join(' · ');
}

function hasRealClarification(ann: Annotation): boolean {
  if (!ann.clarified || !ann.text) return false;
  return ann.text.includes('\n---\nAI:');
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

const SEVERITY_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#fbbf24', 4: '#f97316', 5: '#ef4444',
};

/* ── Component ────────────────────────────────────────────────────── */

export default function PlaytestViewerPage() {
  const [sessions, setSessions] = useState<PlaytestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  // Viewer data
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [stateLog, setStateLog] = useState<StateLog | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [agentTrace, setAgentTrace] = useState<Record<string, unknown> | null>(null);
  const [filmstrip, setFilmstrip] = useState<{ ts: number; url: string }[]>([]);
  const [filmstripIdx, setFilmstripIdx] = useState(0);
  const [filmstripPlaying, setFilmstripPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewerTab>('filmstrip');
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [expandedLogEntries, setExpandedLogEntries] = useState<Set<number>>(new Set());

  // Bulk selection
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Filter & sort
  const [statusFilter, setStatusFilter] = useState<'all' | PlaytestSession['status']>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Ref for filmstrip interval
  const filmstripTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSessions().then(async (list) => {
      setSessions(list);
      setLoading(false);
      const BATCH = 5;
      const metas: PromiseSettledResult<DeviceMeta | null>[] = [];
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = await Promise.allSettled(
          list.slice(i, i + BATCH).map((s) => fetchDeviceMeta(s.sessionId)),
        );
        metas.push(...batch);
      }
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
    setStateLog(null);
    setAnalysis(null);
    setAgentTrace(null);
    setExpandedLogEntries(new Set());
    setActiveTab('filmstrip');
    setLoadingData(true);

    const [anns, log, anal, trace, filmstripData] = await Promise.all([
      fetchAnnotations(sessionId),
      fetchStateLog(sessionId),
      fetchAnalysis(sessionId),
      fetchAgentTrace(sessionId),
      fetch(`${API_BASE}/api/v1/playtest/sessions/${sessionId}/filmstrip`)
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []) as Promise<{ ts: number; url: string }[]>,
    ]);
    setAnnotations(anns.sort((a, b) => a.timestamp - b.timestamp));
    setStateLog(log);
    setAnalysis(anal);
    setAgentTrace(trace);
    setFilmstrip((filmstripData || []).map((f: { ts: number; url: string }) => ({
      ts: f.ts,
      url: `${API_BASE}/api/v1/playtest/sessions/${sessionId}/filmstrip/frame-${f.ts}.jpg`,
    })));
    setFilmstripIdx(0);
    setFilmstripPlaying(false);
    setLoadingData(false);

    // Default to annotations if no filmstrip
    if ((!filmstripData || filmstripData.length === 0) && anns.length > 0) {
      setActiveTab('annotations');
    }
  }, []);

  // Filmstrip auto-play
  useEffect(() => {
    if (filmstripTimerRef.current) {
      clearInterval(filmstripTimerRef.current);
      filmstripTimerRef.current = null;
    }
    if (!filmstripPlaying || filmstrip.length === 0) return;
    filmstripTimerRef.current = setInterval(() => {
      setFilmstripIdx((prev) => {
        if (prev >= filmstrip.length - 1) { setFilmstripPlaying(false); return prev; }
        return prev + 1;
      });
    }, 500);
    return () => { if (filmstripTimerRef.current) clearInterval(filmstripTimerRef.current); };
  }, [filmstripPlaying, filmstrip.length]);

  const seekToAnnotation = useCallback((ann: Annotation) => {
    setActiveAnnotation(ann.id);
    if (ann.screenshotUrl && selected) {
      const proxyUrl = `${API_BASE}/api/v1/playtest/sessions/${selected}/screenshots/${ann.id}.png`;
      setScreenshotPreview(proxyUrl);
    }
  }, [selected]);

  // Bulk selection helpers
  const filteredSessions = sessions
    .filter((s) => statusFilter === 'all' || s.status === statusFilter)
    .sort((a, b) => {
      const ta = new Date(a.createdAt + 'Z').getTime() || 0;
      const tb = new Date(b.createdAt + 'Z').getTime() || 0;
      return sortOrder === 'desc' ? tb - ta : ta - tb;
    });

  const filteredIds = new Set(filteredSessions.map((s) => s.sessionId));
  const allChecked = filteredSessions.length > 0 && filteredSessions.every((s) => checked.has(s.sessionId));
  const someChecked = checked.size > 0;

  const toggleAll = () => {
    if (allChecked) {
      setChecked((prev) => {
        const next = new Set(prev);
        filteredSessions.forEach((s) => next.delete(s.sessionId));
        return next;
      });
    } else {
      setChecked((prev) => {
        const next = new Set(prev);
        filteredSessions.forEach((s) => next.add(s.sessionId));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
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
  const pendingCount = sessions.filter((s) => s.status === 'pending').length;
  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const screenshotAnnotations = annotations.filter((a) => a.screenshotUrl || a.screenshot);
  const checkedInView = [...checked].filter((id) => filteredIds.has(id)).length;

  return (
    <div>
      <div className="triage-header">
        <h1 className="triage-title">Playtest Viewer</h1>
        <p className="triage-subtitle">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} ·{' '}
          {submittedCount} submitted · {activeCount} active · {pendingCount} pending
        </p>
      </div>

      <div className="pv-layout">
        {/* ── Sidebar ──────────────────────────────────────────── */}
        <div className="pv-sidebar">
          {/* Select-all bar — above everything */}
          <div className="pv-bulk-bar">
            <label className="pv-select-all">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                onChange={toggleAll}
              />
              <span>Select all</span>
            </label>
            {checkedInView > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="pv-delete-btn"
              >
                {deleting ? 'Deleting...' : `Delete (${checkedInView})`}
              </button>
            )}
          </div>

          {/* Filter & sort */}
          <div className="playtest-filter-bar">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="playtest-filter-select"
            >
              <option value="all">All ({sessions.length})</option>
              <option value="submitted">Submitted ({submittedCount})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="pending">Pending ({pendingCount})</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => o === 'desc' ? 'asc' : 'desc')}
              className="playtest-filter-sort"
              title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
            >
              {sortOrder === 'desc' ? '\u2193 New' : '\u2191 Old'}
            </button>
          </div>

          {/* Session list */}
          <div className="pv-session-list">
            {loading && <p className="triage-muted">Loading...</p>}
            {!loading && sessions.length === 0 && (
              <p className="triage-muted">No playtest sessions yet.</p>
            )}
            {!loading && sessions.length > 0 && filteredSessions.length === 0 && (
              <p className="triage-muted">No {statusFilter} sessions.</p>
            )}
            {filteredSessions.map((s) => (
              <div
                key={s.sessionId}
                className={`pv-card ${selected === s.sessionId ? 'pv-card-selected' : ''}`}
                onClick={() => selectSession(s.sessionId)}
              >
                <input
                  type="checkbox"
                  className="pv-card-check"
                  checked={checked.has(s.sessionId)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleOne(s.sessionId)}
                />
                <div className="pv-card-top">
                  <span className="pv-card-id">{s.sessionId.slice(0, 8)}</span>
                  <span className={`triage-status triage-status-${s.status}`}>
                    {s.status}
                  </span>
                </div>
                <div className="pv-card-meta">
                  {s.city || '—'} · {s.sceneType || '—'} · {s.language || '—'}
                </div>
                {s.device && (
                  <div className="pv-card-device">{parseDevice(s.device)}</div>
                )}
                <div className="pv-card-time">
                  {s.createdAt ? new Date(s.createdAt + 'Z').toLocaleString() : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main viewer panel ────────────────────────────────── */}
        <div className="pv-main">
          {!selected && (
            <div className="triage-empty">Select a session to view</div>
          )}

          {selected && (
            <div className="pv-viewer">
              {/* Session header */}
              <div className="pv-viewer-header">
                <div>
                  <h2 className="triage-section-title" style={{ margin: 0 }}>
                    {selectedSession?.city} / {selectedSession?.sceneType}
                  </h2>
                  <span className="pv-viewer-id">{selected}</span>
                </div>
                {selectedSession?.device && (
                  <div className="pv-viewer-device">
                    {selectedSession.device.platform}
                    {selectedSession.device.screenWidth ? ` · ${selectedSession.device.screenWidth}x${selectedSession.device.screenHeight}` : ''}
                    {selectedSession.device.devicePixelRatio ? ` · ${selectedSession.device.devicePixelRatio}x` : ''}
                    {selectedSession.device.touchSupport ? ' · touch' : ''}
                  </div>
                )}
              </div>

              {/* Tab bar */}
              <div className="pv-tabs">
                {([
                  ['filmstrip', `Filmstrip${filmstrip.length ? ` (${filmstrip.length})` : ''}`],
                  ['annotations', `Annotations (${annotations.length})`],
                  ['gallery', `Screenshots (${screenshotAnnotations.length})`],
                  ['analysis', `Analysis${analysis ? ` (${analysis.summary.issueCount})` : ''}`],
                  ['statelog', `State Log${stateLog ? ` (${stateLog.entries.length})` : ''}`],
                  ['trace', `Trace${agentTrace ? '' : ' (none)'}`],
                ] as [ViewerTab, string][]).map(([tab, label]) => (
                  <button
                    key={tab}
                    className={`pv-tab ${activeTab === tab ? 'pv-tab-active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loadingData && <p className="triage-muted" style={{ padding: 24 }}>Loading session data...</p>}

              {/* ── Filmstrip tab ────────────────────────────── */}
              {!loadingData && activeTab === 'filmstrip' && (
                <div>
                  {filmstrip.length > 0 ? (
                    <div className="pv-filmstrip">
                      <div className="pv-filmstrip-frame">
                        <img src={filmstrip[filmstripIdx]?.url} alt={`Frame at ${fmt(filmstrip[filmstripIdx]?.ts || 0)}`} />
                      </div>
                      <div className="pv-filmstrip-controls">
                        <button onClick={() => setFilmstripIdx(Math.max(0, filmstripIdx - 1))} disabled={filmstripIdx === 0}>&lt;</button>
                        <button onClick={() => setFilmstripPlaying(!filmstripPlaying)}>
                          {filmstripPlaying ? '\u23F8' : '\u25B6'}
                        </button>
                        <button onClick={() => setFilmstripIdx(Math.min(filmstrip.length - 1, filmstripIdx + 1))} disabled={filmstripIdx >= filmstrip.length - 1}>&gt;</button>
                        <span className="pv-filmstrip-time">{fmt(filmstrip[filmstripIdx]?.ts || 0)}</span>
                        <input
                          type="range"
                          min={0}
                          max={filmstrip.length - 1}
                          value={filmstripIdx}
                          onChange={(e) => { setFilmstripIdx(Number(e.target.value)); setFilmstripPlaying(false); }}
                          className="pv-filmstrip-scrubber"
                        />
                        <span className="pv-filmstrip-counter">{filmstripIdx + 1}/{filmstrip.length}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="pv-empty-tab">
                      No filmstrip frames captured for this session.
                    </div>
                  )}
                </div>
              )}

              {/* ── Annotations tab ─────────────────────────── */}
              {!loadingData && activeTab === 'annotations' && (
                <div className="pv-annotations">
                  {annotations.length === 0 ? (
                    <div className="pv-empty-tab">No annotations in this session.</div>
                  ) : (
                    <>
                      {/* Screenshot preview */}
                      {screenshotPreview && (
                        <div className="pv-screenshot-preview">
                          <div className="pv-screenshot-header">
                            <span>Screenshot</span>
                            <button onClick={() => setScreenshotPreview(null)}>&times;</button>
                          </div>
                          <img
                            src={screenshotPreview}
                            alt="Annotation screenshot"
                          />
                        </div>
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
                              <span className="playtest-viewer-ann-has-screenshot" title="Has screenshot">
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
                    </>
                  )}
                </div>
              )}

              {/* ── Gallery tab ──────────────────────────────── */}
              {!loadingData && activeTab === 'gallery' && (
                <div>
                  {screenshotAnnotations.length === 0 ? (
                    <div className="pv-empty-tab">No screenshots. Session may predate screenshot capture.</div>
                  ) : (
                    <div className="pv-gallery">
                      {screenshotAnnotations.map((ann) => (
                        <div
                          key={ann.id}
                          className="pv-gallery-card"
                          onClick={() => {
                            setActiveTab('annotations');
                            seekToAnnotation(ann);
                          }}
                        >
                          {ann.screenshotUrl ? (
                            <img src={ann.screenshotUrl} alt={ann.id} className="pv-gallery-img" />
                          ) : (
                            <div className="pv-empty-tab" style={{ height: 120, minHeight: 'auto' }}>No URL</div>
                          )}
                          <div className="pv-gallery-label">
                            <span className="playtest-viewer-ann-time">{fmt(ann.timestamp)}</span>
                            <span className="triage-auto-badge">{ann.type}</span>
                          </div>
                          {ann.text && (
                            <p className="pv-gallery-text">{ann.text.slice(0, 80)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Analysis tab ─────────────────────────────── */}
              {!loadingData && activeTab === 'analysis' && (
                <div>
                  {!analysis ? (
                    <div className="pv-empty-tab">
                      No analysis results yet. Run: <code>/analyze-playtest {selected}</code>
                    </div>
                  ) : (
                    <>
                      <div className="triage-summary-bar">
                        <div className="triage-score">
                          <span className="triage-score-number">{analysis.result.overallScore}</span>
                          <span className="triage-score-label">/10</span>
                        </div>
                        <div className="triage-summary-text">
                          <p className="triage-summary-desc">{analysis.result.sessionSummary}</p>
                          <p className="triage-top-priority">Top priority: {analysis.result.topPriority}</p>
                        </div>
                        <div className="triage-token-cost">
                          {analysis.tokensUsed.totalTokens.toLocaleString()} tokens
                          {analysis.mode === 'screenshots' ? ' (screenshots)' : ' (video)'}
                        </div>
                      </div>

                      <div className="triage-issues">
                        {analysis.result.issues.map((issue, idx) => (
                          <div key={idx} className="triage-issue">
                            <div className="triage-issue-header">
                              <span className="triage-issue-time">{issue.timestamp}</span>
                              <span
                                className="triage-issue-severity"
                                style={{ background: SEVERITY_COLORS[issue.severity] || '#94a3b8' }}
                              >
                                {issue.severity}/5
                              </span>
                              <span className="triage-issue-category">{issue.category.replace(/_/g, ' ')}</span>
                              {issue.autoFixable && <span className="triage-auto-badge">auto-fixable</span>}
                            </div>
                            <p className="triage-issue-desc">{issue.description}</p>
                            {issue.suggestedFix && <p className="triage-issue-fix">Fix: {issue.suggestedFix}</p>}
                            {issue.affectedComponent && (
                              <p className="triage-issue-component">Component: <code>{issue.affectedComponent}</code></p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── State Log tab ────────────────────────────── */}
              {!loadingData && activeTab === 'statelog' && (
                <div>
                  {!stateLog || stateLog.entries.length === 0 ? (
                    <div className="pv-empty-tab">No state log for this session.</div>
                  ) : (
                    <div className="pv-statelog">
                      {stateLog.entries.map((entry, i) => {
                        const relTime = Math.floor((entry.ts - stateLog.startedAt) / 1000);
                        const color = LOG_KIND_COLORS[entry.kind] || '#94a3b8';
                        const isExpanded = expandedLogEntries.has(i);
                        const hasData = entry.data && Object.keys(entry.data).length > 0;
                        const summaryText =
                          entry.kind === 'tool_call' ? `${entry.data.toolName}()` :
                          entry.kind === 'ai_request' ? String(entry.data.content || '').slice(0, 80) :
                          entry.kind === 'exercise_shown' ? `${entry.data.exerciseType}: ${entry.data.exerciseId}` :
                          entry.kind === 'exercise_result' ? (entry.data.correct ? 'Correct' : 'Incorrect') :
                          entry.kind === 'choice_selected' ? `\u2192 ${entry.data.choiceId}` :
                          entry.kind === 'user_tap' ? String(entry.data.action || '') :
                          entry.kind === 'phase_change' ? `${entry.data.from} \u2192 ${entry.data.to}` :
                          entry.kind === 'state_snapshot' ? `phase:${entry.data.phase}` :
                          entry.kind === 'error' ? String(entry.data.message || '') :
                          '';
                        return (
                          <div key={i} className={`playtest-statelog-row ${isExpanded ? 'playtest-statelog-row-expanded' : ''}`}>
                            <div
                              className="playtest-statelog-entry"
                              onClick={() => {
                                if (!hasData) return;
                                setExpandedLogEntries((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                });
                              }}
                              style={hasData ? { cursor: 'pointer' } : undefined}
                            >
                              {hasData && (
                                <span className="playtest-statelog-toggle">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                              )}
                              <span className="playtest-statelog-time">{fmt(relTime)}</span>
                              <span className="playtest-statelog-kind" style={{ color }}>
                                {LOG_KIND_LABELS[entry.kind] || entry.kind}
                              </span>
                              <span className="playtest-statelog-data">
                                {summaryText}
                              </span>
                            </div>
                            {isExpanded && hasData && (
                              <pre className="playtest-statelog-json">{JSON.stringify(entry.data, null, 2)}</pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Trace tab ────────────────────────────────── */}
              {!loadingData && activeTab === 'trace' && (
                <div>
                  {!agentTrace ? (
                    <div className="pv-empty-tab">No agent trace for this session.</div>
                  ) : (
                    <div className="triage-issues">
                      {(Array.isArray((agentTrace as Record<string, unknown>).steps) ? (agentTrace as Record<string, unknown>).steps as Record<string, unknown>[] : [agentTrace]).map((step: Record<string, unknown>, idx: number) => (
                        <div key={idx} className="triage-issue">
                          <div className="triage-issue-header">
                            <span className="triage-auto-badge">{String(step.action || step.type || 'step')}</span>
                            {step.prUrl != null && (
                              <a href={String(step.prUrl)} target="_blank" rel="noopener noreferrer"
                                className="triage-issue-time" style={{ color: 'var(--mint)' }}>
                                {String(step.prUrl)}
                              </a>
                            )}
                          </div>
                          {step.reasoning != null && <p className="triage-issue-desc">{String(step.reasoning)}</p>}
                          {step.result != null && <p className="triage-issue-fix">{String(step.result)}</p>}
                          {step.error != null && (
                            <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{String(step.error)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick actions */}
              <div className="pv-actions">
                <a
                  href="/backstage/triage"
                  className="triage-btn-analyze"
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  Triage
                </a>
                <a
                  href={`${RUNS_BASE}/playtest/${selected}/annotations.json`}
                  target="_blank"
                  rel="noopener"
                  className="pv-action-secondary"
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

'use client';

import { useCallback, useEffect, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

interface PlaytestSession {
  session_id: string;
  city: string;
  scene_type: string;
  language: string;
  status: string;
  created_at: string;
}

interface Annotation {
  id: string;
  timestamp: number;
  type: 'draw' | 'comment';
  pathData?: string;
  color?: string;
  text?: string;
  x?: number;
  y?: number;
  screenshot?: string;
  screenshotUrl?: string;
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
  summary: {
    issueCount: number;
    autoFixableCount: number;
  };
}

type Tab = 'session' | 'gallery' | 'analysis' | 'trace';

/* ── API helpers ──────────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';
const R2_BASE = 'https://runs.tong.berlayar.ai';

async function fetchSessions(): Promise<PlaytestSession[]> {
  const res = await fetch(`${API_BASE}/api/v1/playtest/sessions`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.sessions || [];
}

async function fetchAnnotations(sessionId: string): Promise<Annotation[]> {
  try {
    const res = await fetch(`${R2_BASE}/playtest/${sessionId}/annotations.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.annotations || (Array.isArray(data) ? data : []);
  } catch {
    return [];
  }
}

async function fetchAnalysis(sessionId: string): Promise<AnalysisResult | null> {
  try {
    const res = await fetch(`${R2_BASE}/playtest/${sessionId}/analysis.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchAgentTrace(sessionId: string): Promise<any | null> {
  try {
    const res = await fetch(`${R2_BASE}/playtest/${sessionId}/agent-trace.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* ── Helpers ──────────────────────────────────────────────────────── */

const SEVERITY_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#fbbf24', 4: '#f97316', 5: '#ef4444',
};

function fmtTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ── Component ────────────────────────────────────────────────────── */

export default function ReplayPage() {
  const [sessions, setSessions] = useState<PlaytestSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [agentTrace, setAgentTrace] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('session');
  const [activeAnnotation, setActiveAnnotation] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions().then((s) => {
      setSessions(s.filter((x) => x.status === 'submitted' || x.status === 'analyzing'));
      setLoading(false);
    });
  }, []);

  const loadSession = useCallback(async (id: string) => {
    setSelectedId(id);
    setActiveAnnotation(0);
    setActiveTab('session');
    const [anns, anal, trace] = await Promise.all([
      fetchAnnotations(id),
      fetchAnalysis(id),
      fetchAgentTrace(id),
    ]);
    setAnnotations(anns.sort((a, b) => a.timestamp - b.timestamp));
    setAnalysis(anal);
    setAgentTrace(trace);
  }, []);

  const selected = sessions.find((s) => s.session_id === selectedId);
  const currentAnn = annotations[activeAnnotation];
  const screenshotAnnotations = annotations.filter((a) => a.screenshotUrl || a.screenshot);

  return (
    <div>
      <div className="triage-header">
        <h1 className="triage-title">Session Replay</h1>
        <p className="triage-subtitle">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} with recordings
        </p>
      </div>

      <div className="triage-layout">
        {/* ── Session sidebar ──────────────────────────────────── */}
        <div className="triage-sidebar">
          <h2 className="triage-section-title">Sessions</h2>
          {loading && <p className="triage-muted">Loading...</p>}
          {!loading && sessions.length === 0 && (
            <p className="triage-muted">No submitted sessions yet.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.session_id}
              className={`triage-session-card ${selectedId === s.session_id ? 'triage-session-selected' : ''}`}
              onClick={() => loadSession(s.session_id)}
            >
              <div className="triage-session-top">
                <span className="triage-session-id">{s.session_id.slice(0, 8)}</span>
                <span className={`triage-status triage-status-${s.status}`}>{s.status}</span>
              </div>
              <div className="triage-session-meta">
                {s.city} / {s.scene_type} / {s.language}
              </div>
              <div className="triage-session-time">
                {new Date(s.created_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {/* ── Main panel ───────────────────────────────────────── */}
        <div className="triage-main">
          {!selectedId && (
            <div className="triage-empty">Select a session to replay</div>
          )}

          {selectedId && (
            <>
              {/* Tab bar */}
              <div className="signals-controls" style={{ marginBottom: 16 }}>
                {(['session', 'gallery', 'analysis', 'trace'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    className={`signals-platform-btn ${activeTab === tab ? 'signals-platform-active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'session' ? `Session (${annotations.length})` :
                     tab === 'gallery' ? `Screenshots (${screenshotAnnotations.length})` :
                     tab === 'analysis' ? `Analysis${analysis ? ` (${analysis.summary.issueCount})` : ''}` :
                     `Agent Trace${agentTrace ? '' : ' (none)'}`}
                  </button>
                ))}
              </div>

              {/* ── Session tab: video + timeline + annotations ── */}
              {activeTab === 'session' && (
                <div>
                  {/* Video player */}
                  <div className="replay-video-container">
                    <video
                      className="replay-video"
                      src={`${R2_BASE}/playtest/${selectedId}/recording.webm`}
                      controls
                      playsInline
                      preload="metadata"
                    />
                    <div className="replay-video-meta">
                      <span>{selected?.city} / {selected?.scene_type}</span>
                      <span>{selected?.language}</span>
                      <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
                      <span>{screenshotAnnotations.length} screenshot{screenshotAnnotations.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {annotations.length === 0 ? (
                    <div className="triage-empty">No annotations in this session</div>
                  ) : (
                    <>
                      {/* Timeline bar */}
                      <div className="replay-timeline-bar">
                        {annotations.map((ann, idx) => (
                          <button
                            key={ann.id}
                            className={`replay-timeline-marker ${idx === activeAnnotation ? 'replay-timeline-active' : ''} replay-marker-${ann.type}`}
                            onClick={() => setActiveAnnotation(idx)}
                            title={`${fmtTime(ann.timestamp)} — ${ann.type}${ann.text ? ': ' + ann.text.slice(0, 50) : ''}`}
                            style={{ left: `${annotations.length === 1 ? 50 : (idx / (annotations.length - 1)) * 100}%` }}
                          />
                        ))}
                      </div>

                      {/* Navigation */}
                      <div className="replay-nav">
                        <button
                          className="triage-action"
                          disabled={activeAnnotation === 0}
                          onClick={() => setActiveAnnotation((p) => Math.max(0, p - 1))}
                        >
                          Prev
                        </button>
                        <span className="triage-muted">
                          {activeAnnotation + 1} / {annotations.length} — {fmtTime(currentAnn?.timestamp || 0)}
                        </span>
                        <button
                          className="triage-action"
                          disabled={activeAnnotation === annotations.length - 1}
                          onClick={() => setActiveAnnotation((p) => Math.min(annotations.length - 1, p + 1))}
                        >
                          Next
                        </button>
                      </div>

                      {/* Annotation viewer */}
                      {currentAnn && (
                        <div className="replay-viewer">
                          {/* Screenshot or placeholder */}
                          <div className="replay-screenshot-container">
                            {currentAnn.screenshotUrl ? (
                              <img
                                src={currentAnn.screenshotUrl}
                                alt={`Screenshot at ${fmtTime(currentAnn.timestamp)}`}
                                className="replay-screenshot"
                              />
                            ) : (
                              <div className="replay-no-screenshot">
                                No screenshot captured
                              </div>
                            )}

                            {/* Overlay: SVG drawing */}
                            {currentAnn.type === 'draw' && currentAnn.pathData && (
                              <svg className="replay-svg-overlay" viewBox="0 0 1280 800">
                                <path
                                  d={currentAnn.pathData}
                                  stroke={currentAnn.color || '#ff6b2c'}
                                  strokeWidth="3"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}

                            {/* Overlay: comment pin */}
                            {currentAnn.type === 'comment' && currentAnn.x != null && (
                              <div
                                className="replay-pin"
                                style={{ left: `${(currentAnn.x ?? 0) * 100}%`, top: `${(currentAnn.y ?? 0) * 100}%` }}
                              />
                            )}
                          </div>

                          {/* Annotation details */}
                          <div className="replay-details">
                            <div className="replay-detail-header">
                              <span className={`triage-auto-badge`}>{currentAnn.type}</span>
                              <span className="triage-issue-time">{fmtTime(currentAnn.timestamp)}</span>
                              {currentAnn.color && (
                                <span className="replay-color-dot" style={{ background: currentAnn.color }} />
                              )}
                            </div>
                            {currentAnn.text && (
                              <p className="replay-comment-text">{currentAnn.text}</p>
                            )}
                            {currentAnn.pathData && (
                              <p className="triage-muted" style={{ fontSize: '0.7rem' }}>
                                SVG path: {currentAnn.pathData.slice(0, 60)}...
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Gallery tab ───────────────────────────────── */}
              {activeTab === 'gallery' && (
                <div>
                  <p className="triage-muted" style={{ marginBottom: 12 }}>
                    {screenshotAnnotations.length} screenshots captured — these are what Gemini analyzes in screenshot mode.
                  </p>
                  {screenshotAnnotations.length === 0 ? (
                    <div className="triage-empty">No screenshots. Session may predate screenshot capture.</div>
                  ) : (
                    <div className="replay-gallery">
                      {screenshotAnnotations.map((ann) => (
                        <div key={ann.id} className="replay-gallery-card" onClick={() => {
                          setActiveTab('session');
                          setActiveAnnotation(annotations.indexOf(ann));
                        }}>
                          {ann.screenshotUrl ? (
                            <img src={ann.screenshotUrl} alt={ann.id} className="replay-gallery-img" />
                          ) : (
                            <div className="replay-no-screenshot" style={{ height: 120 }}>No URL</div>
                          )}
                          <div className="replay-gallery-label">
                            <span className="triage-issue-time">{fmtTime(ann.timestamp)}</span>
                            <span className="triage-auto-badge">{ann.type}</span>
                          </div>
                          {ann.text && (
                            <p className="replay-gallery-text">{ann.text.slice(0, 80)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Analysis tab ──────────────────────────────── */}
              {activeTab === 'analysis' && (
                <div>
                  {!analysis ? (
                    <div className="triage-empty">
                      No analysis results yet. Run: <code>/analyze-playtest {selectedId}</code>
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
                              <span className="triage-issue-category">
                                {issue.category.replace(/_/g, ' ')}
                              </span>
                              {issue.autoFixable && <span className="triage-auto-badge">auto-fixable</span>}
                            </div>
                            <p className="triage-issue-desc">{issue.description}</p>
                            {issue.suggestedFix && (
                              <p className="triage-issue-fix">Fix: {issue.suggestedFix}</p>
                            )}
                            {issue.affectedComponent && (
                              <p className="triage-issue-component">
                                Component: <code>{issue.affectedComponent}</code>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Agent Trace tab ───────────────────────────── */}
              {activeTab === 'trace' && (
                <div>
                  {!agentTrace ? (
                    <div className="triage-empty">
                      No agent trace for this session. The daily pipeline posts traces after running.
                    </div>
                  ) : (
                    <div className="triage-issues">
                      {(agentTrace.steps || [agentTrace]).map((step: any, idx: number) => (
                        <div key={idx} className="triage-issue">
                          <div className="triage-issue-header">
                            <span className="triage-auto-badge">{step.action || step.type || 'step'}</span>
                            {step.prUrl && (
                              <a href={step.prUrl} target="_blank" rel="noopener noreferrer"
                                className="triage-issue-time" style={{ color: 'var(--mint)' }}>
                                {step.prUrl}
                              </a>
                            )}
                          </div>
                          {step.reasoning && <p className="triage-issue-desc">{step.reasoning}</p>}
                          {step.result && <p className="triage-issue-fix">{step.result}</p>}
                          {step.error && (
                            <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{step.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

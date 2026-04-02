'use client';

import { useCallback, useEffect, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

interface PlaytestSession {
  sessionId: string;
  city: string;
  sceneType: string;
  language: string;
  status: 'pending' | 'active' | 'submitted';
  createdAt: string;
  files?: string[];
}

interface AnalysisIssue {
  timestamp: string;
  category: string;
  severity: number;
  description: string;
  suggestedFix: string;
  autoFixable: boolean;
  affectedComponent?: string;
  whatUserExpected?: string;
  whatActuallyHappened?: string;
}

interface AnalysisResult {
  analysisId: string;
  model: string;
  result: {
    sessionSummary: string;
    issues: AnalysisIssue[];
    overallScore: number;
    topPriority: string;
  };
  tokensUsed: { inputTokens: number; outputTokens: number; totalTokens: number };
  createdAt: string;
}

type TriageAction = 'auto_fix' | 'flag_review' | 'dismiss';

interface TriagedIssue extends AnalysisIssue {
  action?: TriageAction;
}

/* ── API helpers ──────────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';

async function fetchSessions(): Promise<PlaytestSession[]> {
  const res = await fetch(`${API_BASE}/api/v1/playtest/sessions`, {
    headers: { 'x-demo-password': localStorage.getItem('tong_demo_pw') || '' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.sessions || [];
}

async function runAnalysis(
  sessionId: string,
  analysisType: string,
  model: string,
): Promise<AnalysisResult | null> {
  const res = await fetch(`${API_BASE}/api/v1/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-demo-password': localStorage.getItem('tong_demo_pw') || '',
    },
    body: JSON.stringify({
      tool: 'gemini.video.analyze_playtest',
      args: { sessionId, analysisType, model },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result || null;
}

/* ── Severity helpers ─────────────────────────────────────────────── */

const SEVERITY_COLORS: Record<number, string> = {
  1: '#94a3b8',
  2: '#60a5fa',
  3: '#fbbf24',
  4: '#f97316',
  5: '#ef4444',
};

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Minor',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
};

const CATEGORY_ICONS: Record<string, string> = {
  ui_layout: '\u2B1C',
  navigation: '\u2194',
  content: '\u270E',
  translation: '\u{1F310}',
  exercise_ux: '\u{1F3AF}',
  performance: '\u26A1',
  accessibility: '\u267F',
  onboarding: '\u{1F44B}',
  unclear_instruction: '\u2753',
  bug: '\u{1F41B}',
};

/* ── Component ────────────────────────────────────────────────────── */

export default function TriagePage() {
  const [sessions, setSessions] = useState<PlaytestSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [triaged, setTriaged] = useState<Map<number, TriageAction>>(new Map());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisModel, setAnalysisModel] = useState<'flash' | 'pro'>('flash');
  const [analysisType, setAnalysisType] = useState('ux_friction');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions().then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedSession) return;
    setAnalyzing(true);
    setAnalysis(null);
    setTriaged(new Map());
    const result = await runAnalysis(selectedSession, analysisType, analysisModel);
    setAnalysis(result);
    setAnalyzing(false);
  }, [selectedSession, analysisType, analysisModel]);

  const [fixingIdx, setFixingIdx] = useState<number | null>(null);
  const [fixResults, setFixResults] = useState<Map<number, { status: string; pr?: string; error?: string }>>(new Map());

  const handleTriage = useCallback((idx: number, action: TriageAction) => {
    setTriaged((prev) => {
      const next = new Map(prev);
      next.set(idx, action);
      return next;
    });
  }, []);

  const handleAutoFix = useCallback(async (idx: number) => {
    if (!selectedSession || !analysis) return;
    const issue = analysis.result.issues[idx];
    setFixingIdx(idx);

    try {
      const res = await fetch(`${API_BASE}/api/v1/playtest/autofix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-password': localStorage.getItem('tong_demo_pw') || '',
        },
        body: JSON.stringify({ sessionId: selectedSession, issue, dryRun: false }),
      });
      const data = await res.json();
      setFixResults((prev) => {
        const next = new Map(prev);
        next.set(idx, { status: data.status || 'error', pr: data.pr, error: data.error });
        return next;
      });
      handleTriage(idx, 'auto_fix');
    } catch (err) {
      setFixResults((prev) => {
        const next = new Map(prev);
        next.set(idx, { status: 'error', error: String(err) });
        return next;
      });
    } finally {
      setFixingIdx(null);
    }
  }, [selectedSession, analysis, handleTriage]);

  const submittedSessions = sessions.filter((s) => s.status === 'submitted');
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const selectedConfig = sessions.find((s) => s.sessionId === selectedSession);

  const autoFixCount = Array.from(triaged.values()).filter((a) => a === 'auto_fix').length;
  const flaggedCount = Array.from(triaged.values()).filter((a) => a === 'flag_review').length;
  const dismissedCount = Array.from(triaged.values()).filter((a) => a === 'dismiss').length;

  return (
    <div>
      <div className="triage-header">
        <h1 className="triage-title">Playtest Triage</h1>
        <p className="triage-subtitle">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} ·{' '}
          {submittedSessions.length} ready for analysis ·{' '}
          {activeSessions.length} active
        </p>
      </div>

      <div className="triage-layout">
        {/* ── Session list ──────────────────────────────────────── */}
        <div className="triage-sidebar">
          <h2 className="triage-section-title">Sessions</h2>
          {loading && <p className="triage-muted">Loading...</p>}
          {!loading && sessions.length === 0 && (
            <p className="triage-muted">No playtest sessions yet. Create one via the API.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              className={`triage-session-card ${selectedSession === s.sessionId ? 'triage-session-selected' : ''}`}
              onClick={() => {
                setSelectedSession(s.sessionId);
                setAnalysis(null);
                setTriaged(new Map());
              }}
            >
              <div className="triage-session-top">
                <span className="triage-session-id">{s.sessionId}</span>
                <span className={`triage-status triage-status-${s.status}`}>
                  {s.status}
                </span>
              </div>
              <div className="triage-session-meta">
                {s.city} · {s.sceneType} · {s.language}
              </div>
              <div className="triage-session-time">
                {new Date(s.createdAt).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {/* ── Analysis panel ────────────────────────────────────── */}
        <div className="triage-main">
          {!selectedSession && (
            <div className="triage-empty">
              Select a session to analyze
            </div>
          )}

          {selectedSession && !analysis && !analyzing && (
            <div className="triage-analyze-panel">
              <h2 className="triage-section-title">
                Analyze: {selectedConfig?.city} / {selectedConfig?.sceneType}
              </h2>
              <div className="triage-controls">
                <div className="triage-control-group">
                  <label className="triage-label">Analysis type</label>
                  <select
                    className="triage-select"
                    value={analysisType}
                    onChange={(e) => setAnalysisType(e.target.value)}
                  >
                    <option value="ux_friction">UX Friction</option>
                    <option value="translation_quality">Translation Quality</option>
                    <option value="content_engagement">Content Engagement</option>
                    <option value="trend_analysis">Trend Analysis</option>
                  </select>
                </div>
                <div className="triage-control-group">
                  <label className="triage-label">Model</label>
                  <select
                    className="triage-select"
                    value={analysisModel}
                    onChange={(e) => setAnalysisModel(e.target.value as 'flash' | 'pro')}
                  >
                    <option value="flash">Flash ($0.05/5min)</option>
                    <option value="pro">Pro ($0.18/5min)</option>
                  </select>
                </div>
                <button className="triage-btn-analyze" onClick={handleAnalyze}>
                  Run Analysis
                </button>
              </div>
            </div>
          )}

          {analyzing && (
            <div className="triage-loading">
              <div className="triage-spinner" />
              <p>Analyzing session with Gemini {analysisModel}...</p>
            </div>
          )}

          {analysis && (
            <div className="triage-results">
              {/* Summary bar */}
              <div className="triage-summary-bar">
                <div className="triage-score">
                  <span className="triage-score-number">{analysis.result.overallScore}</span>
                  <span className="triage-score-label">/10</span>
                </div>
                <div className="triage-summary-text">
                  <p className="triage-summary-desc">{analysis.result.sessionSummary}</p>
                  <p className="triage-top-priority">
                    Top priority: {analysis.result.topPriority}
                  </p>
                </div>
                <div className="triage-token-cost">
                  {analysis.tokensUsed.totalTokens.toLocaleString()} tokens ·{' '}
                  {analysis.model.includes('pro') ? 'Pro' : 'Flash'}
                </div>
              </div>

              {/* Triage stats */}
              <div className="triage-stats">
                <span>{analysis.result.issues.length} issues found</span>
                {autoFixCount > 0 && (
                  <span className="triage-stat-auto">
                    {autoFixCount} auto-fix
                  </span>
                )}
                {flaggedCount > 0 && (
                  <span className="triage-stat-flag">
                    {flaggedCount} flagged
                  </span>
                )}
                {dismissedCount > 0 && (
                  <span className="triage-stat-dismiss">
                    {dismissedCount} dismissed
                  </span>
                )}
              </div>

              {/* Issue list */}
              <div className="triage-issues">
                {analysis.result.issues.map((issue, idx) => {
                  const action = triaged.get(idx);
                  return (
                    <div
                      key={idx}
                      className={`triage-issue ${action ? `triage-issue-${action}` : ''}`}
                    >
                      <div className="triage-issue-header">
                        <span className="triage-issue-time">{issue.timestamp}</span>
                        <span
                          className="triage-issue-severity"
                          style={{ background: SEVERITY_COLORS[issue.severity] || '#94a3b8' }}
                        >
                          {SEVERITY_LABELS[issue.severity] || 'Unknown'}
                        </span>
                        <span className="triage-issue-category">
                          {CATEGORY_ICONS[issue.category] || '\u2022'} {issue.category.replace(/_/g, ' ')}
                        </span>
                        {issue.autoFixable && (
                          <span className="triage-auto-badge">auto-fixable</span>
                        )}
                      </div>
                      <p className="triage-issue-desc">{issue.description}</p>
                      {issue.suggestedFix && (
                        <p className="triage-issue-fix">
                          Fix: {issue.suggestedFix}
                        </p>
                      )}
                      {issue.affectedComponent && (
                        <p className="triage-issue-component">
                          Component: <code>{issue.affectedComponent}</code>
                        </p>
                      )}
                      <div className="triage-issue-actions">
                        <button
                          className={`triage-action ${action === 'auto_fix' ? 'triage-action-active' : ''}`}
                          onClick={() => handleAutoFix(idx)}
                          disabled={!issue.autoFixable || fixingIdx === idx}
                          title={issue.autoFixable ? 'Run auto-fix pipeline' : 'Not auto-fixable'}
                        >
                          {fixingIdx === idx ? 'Fixing...' : 'Auto-fix'}
                        </button>
                        <button
                          className={`triage-action triage-action-flag ${action === 'flag_review' ? 'triage-action-active' : ''}`}
                          onClick={() => handleTriage(idx, 'flag_review')}
                        >
                          Flag for review
                        </button>
                        <button
                          className={`triage-action triage-action-dismiss ${action === 'dismiss' ? 'triage-action-active' : ''}`}
                          onClick={() => handleTriage(idx, 'dismiss')}
                        >
                          Dismiss
                        </button>
                      </div>
                      {fixResults.get(idx) && (
                        <div style={{ marginTop: 6, fontSize: '0.75rem' }}>
                          {fixResults.get(idx)!.status === 'completed' && (
                            <span style={{ color: 'var(--mint)' }}>
                              PR created: {fixResults.get(idx)!.pr}
                            </span>
                          )}
                          {fixResults.get(idx)!.status === 'validation_failed' && (
                            <span style={{ color: '#f59e0b' }}>Validation failed — needs manual fix</span>
                          )}
                          {fixResults.get(idx)!.status === 'skipped' && (
                            <span style={{ color: 'var(--muted)' }}>AI could not determine a fix</span>
                          )}
                          {fixResults.get(idx)!.status === 'error' && (
                            <span style={{ color: '#ef4444' }}>Error: {fixResults.get(idx)!.error}</span>
                          )}
                          {fixResults.get(idx)!.status === 'dry_run' && (
                            <span style={{ color: '#3b82f6' }}>Dry run — fix generated but not applied</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchGraphDashboard,
  fetchGraphPersonas,
  fetchTools,
  graphHangoutBundleTool,
  graphLessonBundleTool,
  graphPackValidateTool,
  recordGraphEvidence,
  type GraphDashboardResponse,
  type GraphHangoutBundle,
  type GraphLessonBundle,
  type GraphPackMission,
  type GraphPackValidateResponse,
  type GraphPersonaGoal,
  type GraphPersonaSummary,
  type GraphSelectedPackNode,
  type ToolInvokeResponse,
} from '@/lib/api';

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  locked: { bg: '#f5efe7', fg: '#8a6b53', border: '#e7d5c5' },
  available: { bg: '#fff1e8', fg: '#9b401c', border: '#f0c8b2' },
  active: { bg: '#fff1e8', fg: '#9b401c', border: '#f0c8b2' },
  learning: { bg: '#fff1e8', fg: '#9b401c', border: '#f0c8b2' },
  due: { bg: '#fff6db', fg: '#8c6b00', border: '#e8d38f' },
  validated: { bg: '#e6f7f2', fg: '#0f766e', border: '#b5e7dc' },
  mastered: { bg: '#dbf4ff', fg: '#14537a', border: '#b6ddf4' },
  tracking: { bg: '#fff6db', fg: '#8c6b00', border: '#e8d38f' },
  ready: { bg: '#e6f7f2', fg: '#0f766e', border: '#b5e7dc' },
  preview: { bg: '#f5efe7', fg: '#8a6b53', border: '#e7d5c5' },
  in_progress: { bg: '#fff1e8', fg: '#9b401c', border: '#f0c8b2' },
  stub: { bg: '#f5efe7', fg: '#8a6b53', border: '#e7d5c5' },
  lesson: { bg: '#fff1e8', fg: '#9b401c', border: '#f0c8b2' },
  hangout: { bg: '#e6f7f2', fg: '#0f766e', border: '#b5e7dc' },
  review: { bg: '#fff6db', fg: '#8c6b00', border: '#e8d38f' },
  mission: { bg: '#dbf4ff', fg: '#14537a', border: '#b6ddf4' },
  overlay: { bg: '#f5efe7', fg: '#8a6b53', border: '#e7d5c5' },
  error: { bg: '#ffe5e5', fg: '#9f1239', border: '#f2b2b2' },
  warning: { bg: '#fff6db', fg: '#8c6b00', border: '#e8d38f' },
};

function toneForStatus(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.locked;
}

function percent(value: number) {
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized * 100)));
}

function formatDateTime(value?: string) {
  if (!value) return 'No evidence yet';

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatGoal(goal: GraphPersonaGoal) {
  return `${goal.lang.toUpperCase()} ${goal.topic}`;
}

function describePersona(persona: GraphPersonaSummary) {
  if (persona.goals.length > 0) {
    return persona.goals.map((goal) => formatGoal(goal)).join(' • ');
  }

  if (persona.targetLanguages.length > 0) {
    return `Target languages: ${persona.targetLanguages.map((lang) => lang.toUpperCase()).join(', ')}`;
  }

  return 'No goals configured yet.';
}

function isCompletedStatus(status?: string) {
  return status === 'validated' || status === 'mastered';
}

function StatusPill({ status }: { status: string }) {
  const tone = toneForStatus(status);
  return (
    <span
      className="pill"
      style={{
        background: tone.bg,
        color: tone.fg,
        borderColor: tone.border,
        textTransform: 'capitalize',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: 10,
        borderRadius: 999,
        background: '#f3e7d8',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${percent(value)}%`,
          height: '100%',
          borderRadius: 999,
          background: 'linear-gradient(90deg, var(--accent), #ff9f63)',
        }}
      />
    </div>
  );
}

function unwrapToolResult<T>(payload: ToolInvokeResponse<T>, fallbackMessage: string): T {
  if (payload.ok && payload.result) {
    return payload.result;
  }

  throw new Error(payload.error || fallbackMessage);
}

function nodeLabel(nodeId: string, nodeEntriesById: Map<string, GraphSelectedPackNode>) {
  return nodeEntriesById.get(nodeId)?.node.title || nodeId;
}

type PackLevelSection = {
  level: number;
  label: string;
  description: string;
  mission?: GraphPackMission;
  missionStatus: 'ready' | 'tracking' | 'stub';
  nodes: GraphSelectedPackNode[];
};

export default function DashboardPage() {
  const [personas, setPersonas] = useState<GraphPersonaSummary[]>([]);
  const [learnerId, setLearnerId] = useState('');
  const [dashboard, setDashboard] = useState<GraphDashboardResponse | null>(null);
  const [lessonBundle, setLessonBundle] = useState<GraphLessonBundle | null>(null);
  const [hangoutBundle, setHangoutBundle] = useState<GraphHangoutBundle | null>(null);
  const [graphTools, setGraphTools] = useState<Array<{ name: string; description: string }>>([]);
  const [validation, setValidation] = useState<GraphPackValidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<'learn' | 'hangout' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!learnerId) return;
    void refreshDashboard(learnerId);
  }, [learnerId]);

  async function bootstrap() {
    try {
      setLoading(true);
      setError(null);
      const [personaPayload, toolPayload, validationPayload] = await Promise.all([
        fetchGraphPersonas(),
        fetchTools(),
        graphPackValidateTool(),
      ]);

      const requestedLearnerId =
        typeof window === 'undefined'
          ? ''
          : new URLSearchParams(window.location.search).get('learnerId') ||
            new URLSearchParams(window.location.search).get('personaId') ||
            '';
      const defaultLearnerId =
        personaPayload.items.find((item) => item.learnerId === requestedLearnerId)?.learnerId ||
        personaPayload.items[0]?.learnerId ||
        '';

      setPersonas(personaPayload.items);
      setLearnerId((current) => current || defaultLearnerId);
      setGraphTools(toolPayload.tools.filter((tool) => tool.name.startsWith('graph.')));
      setValidation(unwrapToolResult(validationPayload, 'Failed to validate canonical graph pack.'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard setup.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard(activeLearnerId = learnerId) {
    if (!activeLearnerId) return;

    try {
      setLoading(true);
      setError(null);
      const [nextDashboard, lessonPayload, hangoutPayload] = await Promise.all([
        fetchGraphDashboard({ learnerId: activeLearnerId }),
        graphLessonBundleTool({ learnerId: activeLearnerId }),
        graphHangoutBundleTool({ learnerId: activeLearnerId }),
      ]);

      setDashboard(nextDashboard);
      setLessonBundle(unwrapToolResult(lessonPayload, 'Failed to load lesson bundle.'));
      setHangoutBundle(unwrapToolResult(hangoutPayload, 'Failed to load hangout bundle.'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load learner dashboard.');
    } finally {
      setLoading(false);
    }
  }

  async function simulateEvidence(mode: 'learn' | 'hangout') {
    const bundle = mode === 'learn' ? lessonBundle : hangoutBundle;
    const targetNodeId = bundle?.nodeIds?.[0];
    if (!learnerId || !targetNodeId) return;

    try {
      setRecording(mode);
      setError(null);
      await recordGraphEvidence({
        learnerId,
        event: {
          nodeId: targetNodeId,
          mode,
          quality: mode === 'learn' ? 0.86 : 0.92,
          source: `dashboard.${mode}`,
        },
      });
      await refreshDashboard(learnerId);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : 'Failed to record evidence.');
    } finally {
      setRecording(null);
    }
  }

  const selectedPersona = useMemo(
    () => personas.find((item) => item.learnerId === learnerId) || null,
    [personas, learnerId],
  );

  const selectedPackNodes = dashboard?.selectedPack.nodes || [];

  const nodeEntriesById = useMemo(
    () => new Map(selectedPackNodes.map((entry) => [entry.node.nodeId, entry] as const)),
    [selectedPackNodes],
  );

  const packStats = useMemo(() => {
    const stats = {
      available: 0,
      learning: 0,
      due: 0,
      validated: 0,
      mastered: 0,
      locked: 0,
      averageMastery: 0,
    };

    if (selectedPackNodes.length === 0) return stats;

    let masteryTotal = 0;
    for (const entry of selectedPackNodes) {
      masteryTotal += entry.state.masteryScore;
      if (entry.state.status in stats) {
        stats[entry.state.status as keyof typeof stats] += 1;
      }
    }

    stats.averageMastery = masteryTotal / selectedPackNodes.length;
    return stats;
  }, [selectedPackNodes]);

  const packSections = useMemo(() => {
    if (!dashboard) {
      return { levels: [] as PackLevelSection[], ungrouped: [] as GraphSelectedPackNode[] };
    }

    const assignedNodeIds = new Set<string>();
    const levels = dashboard.selectedPack.pack.levels.map((level) => {
      const nodes = (level.objectiveNodeIds || [])
        .map((nodeId) => {
          const entry = nodeEntriesById.get(nodeId);
          if (entry) assignedNodeIds.add(nodeId);
          return entry;
        })
        .filter((entry): entry is GraphSelectedPackNode => Boolean(entry));

      const mission = dashboard.selectedPack.pack.missions.find((item) => item.level === level.level);
      const missionStatus: PackLevelSection['missionStatus'] = mission
        ? mission.requiredNodeIds.every((nodeId) => isCompletedStatus(nodeEntriesById.get(nodeId)?.state.status))
          ? 'ready'
          : 'tracking'
        : 'stub';

      return {
        level: level.level,
        label: level.label,
        description: level.description,
        mission,
        missionStatus,
        nodes,
      };
    });

    const ungrouped = selectedPackNodes.filter((entry) => !assignedNodeIds.has(entry.node.nodeId));
    return { levels, ungrouped };
  }, [dashboard, nodeEntriesById, selectedPackNodes]);

  const lessonEntries = useMemo(
    () =>
      (lessonBundle?.nodeIds || [])
        .map((nodeId) => nodeEntriesById.get(nodeId))
        .filter((entry): entry is GraphSelectedPackNode => Boolean(entry)),
    [lessonBundle, nodeEntriesById],
  );

  const hangoutEntries = useMemo(
    () =>
      (hangoutBundle?.nodeIds || [])
        .map((nodeId) => nodeEntriesById.get(nodeId))
        .filter((entry): entry is GraphSelectedPackNode => Boolean(entry)),
    [hangoutBundle, nodeEntriesById],
  );

  const activeLearner = dashboard?.learner || selectedPersona;

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Learner Graph Dashboard</p>
        <h1 className="page-title">Canonical graph runtime dashboard</h1>
        <p className="page-copy">
          This view reads the current curriculum graph runtime directly: learner profile, roadmap, selected pack node
          state, media overlays, bundles, recommendations, and pack validation.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/graph" className="nav-link">
            Graph
          </Link>
          <Link href="/insights" className="nav-link">
            Insights
          </Link>
          <Link href="/integrations" className="nav-link">
            Integrations
          </Link>
          <Link href="/overlay" className="nav-link">
            Overlay
          </Link>
          <Link href="/game" className="nav-link">
            Game UI
          </Link>
        </div>
      </header>

      <section className="card stack" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <div className="stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Learner</h3>
                <p>Switch between runtime personas and re-read the canonical graph state for that learner.</p>
              </div>
              {validation && <StatusPill status={validation.valid ? 'validated' : 'error'} />}
            </div>
            <select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} disabled={loading}>
              {personas.map((persona) => (
                <option key={persona.learnerId} value={persona.learnerId}>
                  {persona.displayName}
                </option>
              ))}
            </select>
            {activeLearner && (
              <p>
                <strong>{activeLearner.displayName}</strong>: {describePersona(activeLearner)}
              </p>
            )}
          </div>

          <div className="stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Runtime Controls</h3>
                <p>Record a single lesson or hangout event and re-read the current graph-driven progression.</p>
              </div>
              <button className="secondary" onClick={() => void refreshDashboard()} disabled={loading || !learnerId}>
                Refresh
              </button>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              <button onClick={() => void simulateEvidence('learn')} disabled={recording !== null || !lessonBundle?.nodeIds.length}>
                {recording === 'learn' ? 'Recording lesson...' : 'Record Lesson Evidence'}
              </button>
              <button onClick={() => void simulateEvidence('hangout')} disabled={recording !== null || !hangoutBundle?.nodeIds.length}>
                {recording === 'hangout' ? 'Recording hangout...' : 'Record Hangout Evidence'}
              </button>
            </div>
            {validation && (
              <p>
                Pack <strong>{validation.packId}</strong> {validation.valid ? 'is valid.' : `has ${validation.issues.length} issue(s).`}
              </p>
            )}
          </div>
        </div>
        {error && <p style={{ color: '#9f1239' }}>{error}</p>}
        {loading && <p>Loading learner graph...</p>}
      </section>

      {!!dashboard && (
        <>
          <section className="grid grid-3" style={{ marginBottom: 16 }}>
            {[
              { label: 'XP', value: dashboard.progression.xp, detail: `${packStats.validated} validated · ${packStats.mastered} mastered` },
              { label: 'SP', value: dashboard.progression.sp, detail: `${lessonBundle?.nodeIds.length || 0} lesson nodes queued` },
              { label: 'RP', value: dashboard.progression.rp, detail: `${hangoutBundle?.nodeIds.length || 0} hangout nodes queued` },
            ].map((item) => (
              <article key={item.label} className="card stack">
                <span className="kicker">{item.label}</span>
                <h2 style={{ margin: 0 }}>{item.value}</h2>
                <p>{item.detail}</p>
              </article>
            ))}
          </section>

          <section className="grid grid-2" style={{ marginBottom: 16 }}>
            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Learner Profile</h3>
                  <p>{describePersona(dashboard.learner)}</p>
                </div>
                <span className="pill">{dashboard.learner.learnerId}</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {dashboard.learner.targetLanguages.map((lang) => (
                  <span key={lang} className="pill">
                    {lang.toUpperCase()}
                  </span>
                ))}
                {Object.entries(dashboard.learner.proficiency).map(([lang, level]) => (
                  <span key={lang} className="pill">
                    {lang.toUpperCase()} {level}
                  </span>
                ))}
                <span className="pill">{dashboard.evidence.totalEvents} evidence events</span>
                <span className="pill">Updated {formatDateTime(dashboard.evidence.lastUpdatedAt)}</span>
              </div>
              <div className="stack">
                <span className="pill">Goals</span>
                {dashboard.learner.goals.map((goal) => (
                  <p key={`${goal.lang}-${goal.topic}`}>
                    <strong>{goal.lang.toUpperCase()}</strong> {goal.topic}
                  </p>
                ))}
              </div>
              <div className="stack">
                <span className="pill">Media preferences</span>
                <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {[...dashboard.learner.mediaPreferences.youtube, ...dashboard.learner.mediaPreferences.spotify].length > 0 ? (
                    [...dashboard.learner.mediaPreferences.youtube, ...dashboard.learner.mediaPreferences.spotify].map((item) => (
                      <span key={item} className="pill">
                        {item}
                      </span>
                    ))
                  ) : (
                    <p>No media preferences configured for this learner.</p>
                  )}
                </div>
              </div>
            </article>

            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Agent Tool Surface</h3>
                  <p>Reusable graph tools the app and future agent skills can consume.</p>
                </div>
                <span className="pill">{graphTools.length} tools</span>
              </div>
              {graphTools.map((tool) => (
                <div key={tool.name} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                  <strong>{tool.name}</strong>
                  <p style={{ marginTop: 4 }}>{tool.description}</p>
                </div>
              ))}
            </article>
          </section>

          <section className="card stack" style={{ marginBottom: 16 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3>World Roadmap</h3>
                <p>The runtime roadmap is now a flat set of city-location entries with active and completed node counts.</p>
              </div>
              <span className="pill">{dashboard.roadmap.length} routes</span>
            </div>
            <div className="grid grid-3">
              {dashboard.roadmap.map((entry) => (
                <article key={`${entry.cityId}-${entry.locationId}`} className="card stack" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>{entry.title}</strong>
                      <p>{entry.summary}</p>
                    </div>
                    <StatusPill status={entry.status} />
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <span className="pill">{entry.cityId.toUpperCase()}</span>
                    <span className="pill">{entry.locationId.replace(/_/g, ' ')}</span>
                    <span className="pill">{entry.lang.toUpperCase()}</span>
                  </div>
                  <div className="row">
                    <div>
                      <strong>{entry.activeNodeCount}</strong>
                      <p>Active nodes</p>
                    </div>
                    <div>
                      <strong>{entry.completedNodeCount}</strong>
                      <p>Completed nodes</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid grid-2" style={{ marginBottom: 16 }}>
            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>{dashboard.selectedPack.pack.title}</h3>
                  <p>{dashboard.selectedPack.pack.summary}</p>
                </div>
                <span className="pill">{dashboard.selectedPack.pack.packId}</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                <span className="pill">{dashboard.selectedPack.pack.lang.toUpperCase()}</span>
                <span className="pill">{dashboard.selectedPack.pack.cityId}</span>
                <span className="pill">{dashboard.selectedPack.pack.locationId.replace(/_/g, ' ')}</span>
                <span className="pill">v{dashboard.selectedPack.pack.version}</span>
                <span className="pill">{selectedPackNodes.length} nodes</span>
              </div>
              <div className="grid grid-3">
                {[
                  { label: 'Available', value: packStats.available + packStats.learning + packStats.due },
                  { label: 'Completed', value: packStats.validated + packStats.mastered },
                  { label: 'Avg mastery', value: `${percent(packStats.averageMastery)}%` },
                ].map((item) => (
                  <div key={item.label} className="card stack" style={{ padding: 12 }}>
                    <strong>{item.value}</strong>
                    <p>{item.label}</p>
                  </div>
                ))}
              </div>
              {packSections.levels.map((section) => (
                <div key={section.level} className="card stack" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>
                        L{section.level} · {section.label}
                      </strong>
                      <p>{section.description}</p>
                    </div>
                    <StatusPill status={section.missionStatus} />
                  </div>
                  {section.mission ? (
                    <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                      <span className="pill">{section.mission.title}</span>
                      <span className="pill">
                        Reward {section.mission.rewards.xp} XP / {section.mission.rewards.sp} SP / {section.mission.rewards.rp} RP
                      </span>
                    </div>
                  ) : (
                    <p>No mission is authored for this level yet.</p>
                  )}
                  {section.nodes.map((entry) => (
                    <div key={entry.node.nodeId} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <strong>{entry.node.title}</strong>
                          <p>{entry.node.description}</p>
                        </div>
                        <StatusPill status={entry.state.status} />
                      </div>
                      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 8 }}>
                        <span className="pill">{entry.node.objectiveCategory}</span>
                        <span className="pill">{entry.node.targetCount} targets</span>
                        <span className="pill">{entry.state.evidenceCount} evidence</span>
                        {entry.blockers.length > 0 && <span className="pill">Blocked by {entry.blockers.length}</span>}
                        {entry.state.nextReviewAt && <span className="pill">Review {formatDateTime(entry.state.nextReviewAt)}</span>}
                      </div>
                      <ProgressBar value={entry.state.masteryScore} />
                      {entry.state.recommendedReason && <p style={{ marginTop: 8 }}>{entry.state.recommendedReason}</p>}
                    </div>
                  ))}
                </div>
              ))}
              {packSections.ungrouped.length > 0 && (
                <div className="card stack" style={{ padding: 14 }}>
                  <strong>Additional nodes</strong>
                  {packSections.ungrouped.map((entry) => (
                    <div key={entry.node.nodeId} className="row">
                      <div>
                        <strong>{entry.node.title}</strong>
                        <p>{entry.node.description}</p>
                      </div>
                      <StatusPill status={entry.state.status} />
                    </div>
                  ))}
                </div>
              )}
              {selectedPackNodes.length === 0 && <p>This pack has no authored node graph yet.</p>}
            </article>

            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Personalized Overlays</h3>
                  <p>Current overlay candidates are returned as canonical runtime overlays, not focus-card wrappers.</p>
                </div>
                <span className="pill">{dashboard.overlays.length} overlays</span>
              </div>
              {dashboard.overlays.length === 0 && <p>No personalized overlays are available for this learner yet.</p>}
              {dashboard.overlays.map((overlay) => (
                <div key={overlay.overlayId} className="card stack" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>{overlay.title}</strong>
                      <p>{overlay.rationale}</p>
                    </div>
                    <span className="pill">
                      {overlay.lang.toUpperCase()} · {overlay.source}
                    </span>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {overlay.suggestedTerms.map((term) => (
                      <span key={term} className="pill">
                        {term}
                      </span>
                    ))}
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {overlay.connectedNodeIds.map((nodeId) => (
                      <span key={nodeId} className="pill">
                        {nodeLabel(nodeId, nodeEntriesById)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </article>
          </section>

          <section className="grid grid-2" style={{ marginBottom: 16 }}>
            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Lesson Bundle</h3>
                  <p>{lessonBundle?.reason || 'No lesson bundle is available.'}</p>
                </div>
                <span className="pill">learn</span>
              </div>
              <strong>{lessonBundle?.title || 'No lesson bundle'}</strong>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {(lessonBundle?.nodeIds || []).length > 0 ? (
                  (lessonEntries.length > 0 ? lessonEntries : lessonBundle?.nodeIds || []).map((item) =>
                    typeof item === 'string' ? (
                      <span key={item} className="pill">
                        {nodeLabel(item, nodeEntriesById)}
                      </span>
                    ) : (
                      <span key={item.node.nodeId} className="pill">
                        {item.node.title} · {percent(item.state.masteryScore)}%
                      </span>
                    ),
                  )
                ) : (
                  <p>No lesson nodes queued.</p>
                )}
              </div>
            </article>

            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Hangout Bundle</h3>
                  <p>{hangoutBundle?.reason || 'No hangout bundle is available.'}</p>
                </div>
                <span className="pill">hangout</span>
              </div>
              <strong>{hangoutBundle?.title || 'No hangout bundle'}</strong>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {hangoutBundle?.scenarioId && <span className="pill">{hangoutBundle.scenarioId}</span>}
                <span className="pill">{hangoutBundle?.objectiveIds.length || 0} objectives</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {(hangoutBundle?.nodeIds || []).length > 0 ? (
                  (hangoutEntries.length > 0 ? hangoutEntries : hangoutBundle?.nodeIds || []).map((item) =>
                    typeof item === 'string' ? (
                      <span key={item} className="pill">
                        {nodeLabel(item, nodeEntriesById)}
                      </span>
                    ) : (
                      <span key={item.node.nodeId} className="pill">
                        {item.node.title} · {percent(item.state.masteryScore)}%
                      </span>
                    ),
                  )
                ) : (
                  <p>No hangout nodes queued.</p>
                )}
              </div>
            </article>
          </section>

          <section className="grid grid-2">
            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Recommendations</h3>
                  <p>Canonical next actions are surfaced as graph recommendations.</p>
                </div>
                <span className="pill">{dashboard.recommendations.length} items</span>
              </div>
              {dashboard.recommendations.map((recommendation) => (
                <div key={recommendation.recommendationId} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>{recommendation.title}</strong>
                      <p>{recommendation.reason}</p>
                    </div>
                    <StatusPill status={recommendation.type} />
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <span className="pill">Priority {recommendation.priority}</span>
                    <span className="pill">{recommendation.lang.toUpperCase()}</span>
                    <span className="pill">{recommendation.cityId}</span>
                    <span className="pill">{recommendation.locationId.replace(/_/g, ' ')}</span>
                    <span className="pill">{recommendation.foundation ? 'foundation' : 'overlay'}</span>
                    {recommendation.nodeIds.map((nodeId) => (
                      <span key={nodeId} className="pill">
                        {nodeLabel(nodeId, nodeEntriesById)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </article>

            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Validation Results</h3>
                  <p>Canonical pack validation now returns issue objects with severity and optional node ids.</p>
                </div>
                {validation && <StatusPill status={validation.valid ? 'validated' : 'error'} />}
              </div>
              {validation ? (
                <>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <span className="pill">{validation.packId}</span>
                    <span className="pill">{validation.issues.length} issues</span>
                  </div>
                  {validation.issues.length === 0 ? (
                    <p>No validation issues detected.</p>
                  ) : (
                    validation.issues.map((issue) => (
                      <div key={`${issue.code}-${issue.nodeId || 'global'}`} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                        <div className="row" style={{ alignItems: 'flex-start' }}>
                          <div>
                            <strong>{issue.code}</strong>
                            <p>{issue.message}</p>
                          </div>
                          <StatusPill status={issue.severity} />
                        </div>
                        {issue.nodeId && <span className="pill">{issue.nodeId}</span>}
                      </div>
                    ))
                  )}
                </>
              ) : (
                <p>Validation has not loaded yet.</p>
              )}
            </article>
          </section>
        </>
      )}
    </main>
  );
}

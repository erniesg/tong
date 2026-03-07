'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchGraphDashboard,
  fetchGraphPersonas,
  fetchTools,
  graphPackValidateTool,
  recordGraphEvidence,
  type GraphDashboardResponse,
  type GraphPackValidateResponse,
  type GraphPersonaSummary,
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
};

function toneForStatus(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.locked;
}

function percent(value: number) {
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized * 100)));
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

export default function DashboardPage() {
  const [personas, setPersonas] = useState<GraphPersonaSummary[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [dashboard, setDashboard] = useState<GraphDashboardResponse | null>(null);
  const [graphTools, setGraphTools] = useState<Array<{ name: string; description: string }>>([]);
  const [validation, setValidation] = useState<GraphPackValidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<'learn' | 'hangout' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!personaId) return;
    void refreshDashboard(personaId);
  }, [personaId]);

  async function bootstrap() {
    try {
      setLoading(true);
      setError(null);
      const [personaPayload, toolPayload, validationPayload] = await Promise.all([
        fetchGraphPersonas(),
        fetchTools(),
        graphPackValidateTool(),
      ]);

      setPersonas(personaPayload.items);
      setPersonaId((current) => current || personaPayload.items[0]?.personaId || '');
      setGraphTools(toolPayload.tools.filter((tool) => tool.name.startsWith('graph.')));
      setValidation(validationPayload.result || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard setup.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard(activePersonaId = personaId) {
    try {
      setLoading(true);
      setError(null);
      const next = await fetchGraphDashboard({ personaId: activePersonaId });
      setDashboard(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load learner dashboard.');
    } finally {
      setLoading(false);
    }
  }

  async function simulateEvidence(mode: 'learn' | 'hangout') {
    const bundle = mode === 'learn' ? dashboard?.lessonBundle : dashboard?.hangoutBundle;
    const target = bundle?.targets?.[0];
    if (!personaId || !target) return;

    try {
      setRecording(mode);
      setError(null);
      await recordGraphEvidence({
        personaId,
        event: {
          nodeId: target.nodeId,
          mode,
          quality: mode === 'learn' ? 0.86 : 0.92,
          source: `dashboard.${mode}`,
        },
      });
      await refreshDashboard(personaId);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : 'Failed to record evidence.');
    } finally {
      setRecording(null);
    }
  }

  const selectedPersona = useMemo(
    () => personas.find((item) => item.personaId === personaId) || null,
    [personas, personaId],
  );

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Learner Graph Dashboard</p>
        <h1 className="page-title">Foundation map + user-specific media overlays</h1>
        <p className="page-copy">
          This view shows the curriculum graph, learner progression, K-pop/creator overlays, and the reusable agent
          tools that can drive recommendations for lessons and hangouts.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
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
                <h3 style={{ marginBottom: 6 }}>Persona</h3>
                <p>Switch between mocked learner profiles to preview foundation and personalized overlays.</p>
              </div>
              {validation && <StatusPill status={validation.valid ? 'validated' : 'locked'} />}
            </div>
            <select value={personaId} onChange={(event) => setPersonaId(event.target.value)} disabled={loading}>
              {personas.map((persona) => (
                <option key={persona.personaId} value={persona.personaId}>
                  {persona.displayName}
                </option>
              ))}
            </select>
            {selectedPersona && (
              <p>
                <strong>{selectedPersona.displayName}</strong>: {selectedPersona.focusSummary}
              </p>
            )}
          </div>

          <div className="stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>Runtime Controls</h3>
                <p>Record mock evidence to prove the dashboard reacts to graph-driven progression.</p>
              </div>
              <button className="secondary" onClick={() => void refreshDashboard()} disabled={loading || !personaId}>
                Refresh
              </button>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              <button onClick={() => void simulateEvidence('learn')} disabled={recording !== null || !dashboard?.lessonBundle.targets?.length}>
                {recording === 'learn' ? 'Recording lesson...' : 'Record Lesson Evidence'}
              </button>
              <button onClick={() => void simulateEvidence('hangout')} disabled={recording !== null || !dashboard?.hangoutBundle.targets?.length}>
                {recording === 'hangout' ? 'Recording hangout...' : 'Record Hangout Evidence'}
              </button>
            </div>
            {validation && (
              <p>
                Canonical pack validation: <strong>{validation.summary || (validation.valid ? 'valid' : 'invalid')}</strong>
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
              { label: 'XP', value: dashboard.progression.xp, detail: `${dashboard.metrics.validatedObjectives} validated objectives` },
              { label: 'SP', value: dashboard.progression.sp, detail: `${dashboard.lessonBundle.targets.length} lesson targets queued` },
              { label: 'RP', value: dashboard.progression.rp, detail: `${dashboard.hangoutBundle.targets.length} hangout targets queued` },
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
                  <p>{dashboard.persona.focusSummary}</p>
                </div>
                <span className="pill">{dashboard.persona.userId}</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {Object.entries(dashboard.persona.proficiency).map(([lang, level]) => (
                  <span key={lang} className="pill">
                    {lang.toUpperCase()} {level}
                  </span>
                ))}
              </div>
              <div className="stack">
                <span className="pill">Goals</span>
                {dashboard.persona.goals.map((goal) => (
                  <p key={`${goal.lang}-${goal.theme}`}>
                    <strong>{goal.lang.toUpperCase()}</strong> {goal.objective}
                  </p>
                ))}
              </div>
              <div className="stack">
                <span className="pill">Top terms from media</span>
                <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {dashboard.persona.topTerms.map((term) => (
                    <span key={`${term.lang}-${term.lemma}`} className="pill">
                      {term.lemma} · {term.source}
                    </span>
                  ))}
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
                <p>Foundation-first progression across the three cities, with Seoul active and the other routes ready for future packs or overlays.</p>
              </div>
              <span className="pill">{dashboard.worldRoadmap.length} cities</span>
            </div>
            <div className="grid grid-3">
              {dashboard.worldRoadmap.map((city) => (
                <article key={city.cityId} className="card stack" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>{city.label}</strong>
                      <p>{city.focus}</p>
                    </div>
                    <StatusPill status={city.locations[0]?.status || 'preview'} />
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <span className="pill">{city.cityId.toUpperCase()}</span>
                    <span className="pill">Proficiency {city.proficiency}</span>
                  </div>
                  <div className="stack">
                    {city.locations.map((location) => (
                      <div key={location.locationId} className="row">
                        <div>
                          <strong>{location.label}</strong>
                          <p>{location.progress}</p>
                        </div>
                        <StatusPill status={location.status} />
                      </div>
                    ))}
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {city.levels.map((level) => (
                      <span key={`${city.cityId}-${level.level}`} className="pill">
                        L{level.level} {level.label}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid grid-2" style={{ marginBottom: 16 }}>
            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>{dashboard.locationSkillTree.title}</h3>
                  <p>Core path for the first reference location. Each objective state is derived from graph evidence, not hardcoded UI progress.</p>
                </div>
                <span className="pill">{dashboard.locationSkillTree.packId}</span>
              </div>
              {dashboard.locationSkillTree.levels.map((level) => (
                <div key={level.level} className="card stack" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>
                        L{level.level} · {level.name}
                      </strong>
                      <p>{level.description}</p>
                    </div>
                    <StatusPill status={level.mission.status} />
                  </div>
                  <p>Mission: {level.mission.title}</p>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <span className="pill">~{level.estimatedSessionMinutes} min</span>
                    <span className="pill">
                      Reward {level.mission.reward.xp} XP / {level.mission.reward.sp} SP / {level.mission.reward.rp} RP
                    </span>
                  </div>
                  {level.objectives.map((objective) => (
                    <div key={objective.objectiveId} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <strong>{objective.title}</strong>
                          <p>{objective.description}</p>
                        </div>
                        <StatusPill status={objective.status} />
                      </div>
                      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 8 }}>
                        <span className="pill">{objective.category}</span>
                        <span className="pill">
                          {objective.validatedTargetCount}/{objective.targetCount} targets
                        </span>
                        {objective.blockers.length > 0 && <span className="pill">Blocked by {objective.blockers.length}</span>}
                      </div>
                      <ProgressBar value={objective.mastery_score} />
                    </div>
                  ))}
                </div>
              ))}
            </article>

            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Personalized Overlay</h3>
                  <p>{dashboard.personalizedOverlay.summary}</p>
                </div>
                <span className="pill">{dashboard.personalizedOverlay.focusCards.length} focus cards</span>
              </div>
              {dashboard.personalizedOverlay.focusCards.map((card) => (
                <div key={card.overlayId} className="card stack" style={{ padding: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <strong>{card.title}</strong>
                      <p>{card.description}</p>
                    </div>
                    <span className="pill">
                      {card.lang.toUpperCase()} · {card.theme}
                    </span>
                  </div>
                  <p>{card.reason}</p>
                  <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {card.nodes.map((node) => (
                      <span key={node.nodeId} className="pill">
                        {node.label} · {node.translation}
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
                  <p>{dashboard.lessonBundle.reason}</p>
                </div>
                <span className="pill">learn</span>
              </div>
              <strong>{dashboard.lessonBundle.title}</strong>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {dashboard.lessonBundle.targets.map((target) => (
                  <span key={target.nodeId} className="pill">
                    {target.label} · {percent(target.mastery_score)}%
                  </span>
                ))}
              </div>
            </article>

            <article className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>Hangout Bundle</h3>
                  <p>{dashboard.hangoutBundle.reason}</p>
                </div>
                <span className="pill">hangout</span>
              </div>
              <strong>{dashboard.hangoutBundle.title}</strong>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {dashboard.hangoutBundle.targets.map((target) => (
                  <span key={target.nodeId} className="pill">
                    {target.label} · {percent(target.mastery_score)}%
                  </span>
                ))}
              </div>
              <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {dashboard.hangoutBundle.suggestedPhrases.map((phrase) => (
                  <span key={phrase} className="pill">
                    {phrase}
                  </span>
                ))}
              </div>
            </article>
          </section>

          <section className="card stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3>Next Actions</h3>
                <p>Deterministic graph recommendations surfaced for both product UI and agentic tooling.</p>
              </div>
              <span className="pill">{dashboard.nextActions.length} actions</span>
            </div>
            {dashboard.nextActions.map((action) => (
              <div key={action.actionId} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <strong>{action.title}</strong>
                    <p>{action.reason}</p>
                  </div>
                  <span className="pill">{action.type}</span>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

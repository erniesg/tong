'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchGraphDashboard,
  fetchGraphPersonas,
  fetchTools,
  getApiBase,
  graphPackValidateTool,
  recordGraphEvidence,
  type GraphDashboardResponse,
  type GraphPackValidateResponse,
  type GraphPersonaSummary,
} from '@/lib/api';

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  foundation_authored: { bg: '#e6f7f2', fg: '#0f766e', border: '#9ed8ca' },
  overlay_only: { bg: '#eef4ff', fg: '#294f8f', border: '#c8d8ff' },
  missing: { bg: '#f8e7eb', fg: '#9f1239', border: '#f3c7d4' },
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
      style={{ background: tone.bg, color: tone.fg, borderColor: tone.border, textTransform: 'capitalize' }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#f3e7d8', overflow: 'hidden' }}>
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

const SHARED_LOCATION_ORDER = [
  { locationId: 'food_street', label: 'Food Street' },
  { locationId: 'cafe', label: 'Cafe' },
  { locationId: 'convenience_store', label: 'Convenience Store' },
  { locationId: 'subway_hub', label: 'Subway Hub' },
  { locationId: 'practice_studio', label: 'Practice Studio' },
] as const;

type ValidatorSurfaceStatus = 'foundation_authored' | 'overlay_only' | 'preview' | 'missing';

function classifyValidatorStatus(args: {
  cityId: string;
  locationId: string;
  roadmapStatus?: string;
  progress?: string;
  authoredPack?: { cityId: string; locationId: string } | null;
}) {
  const progress = (args.progress || '').toLowerCase();
  const matchesAuthoredPack =
    args.authoredPack?.cityId === args.cityId && args.authoredPack?.locationId === args.locationId;
  if (matchesAuthoredPack) return 'foundation_authored' as const;
  if (progress.includes('overlay')) return 'overlay_only' as const;
  if (args.roadmapStatus === 'preview') return 'preview' as const;
  return 'missing' as const;
}

function validatorStatusDescription(status: ValidatorSurfaceStatus, progress: string) {
  switch (status) {
    case 'foundation_authored':
      return 'Foundation-authored pack present.';
    case 'overlay_only':
      return 'Overlay only; no authored foundation pack.';
    case 'preview':
      return progress || 'Preview scaffold, not yet authored.';
    case 'missing':
    default:
      return progress || 'No pack surfaced yet.';
  }
}

/* ── Chevron for expand/collapse ──────────────────────── */
function Chevron({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        transition: 'transform 200ms ease',
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        fontSize: 14,
        color: 'var(--muted)',
        flexShrink: 0,
      }}
    >
      &#9654;
    </span>
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
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set());
  const apiBase = getApiBase();

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!personaId) return;
    void refreshDashboard(personaId);
  }, [personaId]);

  // Auto-expand active city and active skill tree level
  useEffect(() => {
    if (!dashboard) return;
    const activeCity = dashboard.worldRoadmap.find((c) =>
      c.locations.some((l) => l.status === 'active' || l.status === 'learning'),
    );
    if (activeCity) setExpandedCities(new Set([activeCity.cityId]));

    const activeLevel = dashboard.locationSkillTree.levels.find(
      (l) => l.mission.status === 'active' || l.mission.status === 'learning' || l.mission.status === 'tracking',
    );
    if (activeLevel) setExpandedLevels(new Set([activeLevel.level]));
  }, [dashboard]);

  async function bootstrap() {
    try {
      setLoading(true);
      setError(null);
      const [personaResult, toolResult, validationResult] = await Promise.allSettled([
        fetchGraphPersonas(),
        fetchTools(),
        graphPackValidateTool(),
      ]);
      if (personaResult.status !== 'fulfilled') throw personaResult.reason;
      setPersonas(personaResult.value.items);
      setPersonaId((current) => current || personaResult.value.items[0]?.personaId || '');
      setGraphTools(
        toolResult.status === 'fulfilled'
          ? toolResult.value.tools.filter((tool) => tool.name.startsWith('graph.'))
          : [],
      );
      setValidation(validationResult.status === 'fulfilled' ? validationResult.value.result || null : null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dashboard.';
      setError(`${message} API: ${apiBase}`);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard(activePersonaId = personaId) {
    try {
      setLoading(true);
      setError(null);
      setDashboard(await fetchGraphDashboard({ personaId: activePersonaId }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dashboard.';
      setDashboard(null);
      setError(`${message} API: ${apiBase}`);
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
        event: { nodeId: target.nodeId, mode, quality: mode === 'learn' ? 0.86 : 0.92, source: `dashboard.${mode}` },
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

  const validatorCities = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.worldRoadmap.map((city) => {
      const locations = SHARED_LOCATION_ORDER.map((shared) => {
        const roadmapLoc = city.locations.find((l) => l.locationId === shared.locationId);
        const validatorStatus = classifyValidatorStatus({
          cityId: city.cityId,
          locationId: shared.locationId,
          roadmapStatus: roadmapLoc?.status,
          progress: roadmapLoc?.progress,
          authoredPack: { cityId: dashboard.locationSkillTree.cityId, locationId: dashboard.locationSkillTree.locationId },
        });
        return {
          locationId: shared.locationId,
          label: shared.label,
          validatorStatus,
          roadmapStatus: roadmapLoc?.status || 'locked',
          progress: roadmapLoc?.progress || 'Missing.',
          note: validatorStatusDescription(validatorStatus, roadmapLoc?.progress || ''),
        };
      });
      const summary = locations.reduce<Record<ValidatorSurfaceStatus, number>>(
        (s, l) => { s[l.validatorStatus] += 1; return s; },
        { foundation_authored: 0, overlay_only: 0, preview: 0, missing: 0 },
      );
      return { ...city, validatorSummary: summary, validatorLocations: locations };
    });
  }, [dashboard]);

  function toggleCity(cityId: string) {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      next.has(cityId) ? next.delete(cityId) : next.add(cityId);
      return next;
    });
  }

  function toggleLevel(level: number) {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }

  return (
    <main className="app-shell">
      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="dash-nav">
        <Link href="/">Home</Link>
        <Link href="/insights">Insights</Link>
        <Link href="/integrations">Integrations</Link>
        <Link href="/overlay">Overlay</Link>
        <Link href="/graph">Graph</Link>
        <Link href="/game">Game</Link>
      </nav>

      {/* ── Toolbar: persona + stats + validation ────── */}
      <section className="dash-toolbar">
        <select
          className="dash-persona-select"
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          disabled={loading}
        >
          {personas.map((p) => (
            <option key={p.personaId} value={p.personaId}>{p.displayName}</option>
          ))}
        </select>

        {dashboard && (
          <div className="dash-stats">
            <span className="dash-stat"><strong>{dashboard.progression.xp}</strong> XP</span>
            <span className="dash-stat"><strong>{dashboard.progression.sp}</strong> SP</span>
            <span className="dash-stat"><strong>{dashboard.progression.rp}</strong> RP</span>
          </div>
        )}

        {validation && <StatusPill status={validation.valid ? 'validated' : 'locked'} />}

        <button
          className="secondary"
          onClick={() => void refreshDashboard()}
          disabled={loading || !personaId}
          style={{ marginLeft: 'auto' }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </section>

      {selectedPersona && (
        <p className="dash-subtitle">{selectedPersona.focusSummary}</p>
      )}
      {error && <p className="dash-error">{error}</p>}

      {!!dashboard && (
        <>
          {/* ── What's Next: bundles + actions ──────── */}
          <section className="dash-section">
            <h2 className="dash-heading">What&apos;s Next</h2>
            <div className="grid grid-2">
              <article className="card stack" style={{ padding: 14 }}>
                <div className="row">
                  <strong>{dashboard.lessonBundle.title}</strong>
                  <span className="pill">lesson</span>
                </div>
                <p>{dashboard.lessonBundle.reason}</p>
                <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {dashboard.lessonBundle.targets.map((t) => (
                    <span key={t.nodeId} className="pill">{t.label} {percent(t.mastery_score)}%</span>
                  ))}
                </div>
                <button
                  onClick={() => void simulateEvidence('learn')}
                  disabled={recording !== null || !dashboard.lessonBundle.targets.length}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {recording === 'learn' ? 'Recording...' : 'Record Evidence'}
                </button>
              </article>

              <article className="card stack" style={{ padding: 14 }}>
                <div className="row">
                  <strong>{dashboard.hangoutBundle.title}</strong>
                  <span className="pill">hangout</span>
                </div>
                <p>{dashboard.hangoutBundle.reason}</p>
                <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {dashboard.hangoutBundle.targets.map((t) => (
                    <span key={t.nodeId} className="pill">{t.label} {percent(t.mastery_score)}%</span>
                  ))}
                  {dashboard.hangoutBundle.suggestedPhrases.map((p) => (
                    <span key={p} className="pill">{p}</span>
                  ))}
                </div>
                <button
                  onClick={() => void simulateEvidence('hangout')}
                  disabled={recording !== null || !dashboard.hangoutBundle.targets.length}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {recording === 'hangout' ? 'Recording...' : 'Record Evidence'}
                </button>
              </article>
            </div>

            {dashboard.nextActions.length > 0 && (
              <div className="dash-actions-bar">
                {dashboard.nextActions.map((a) => (
                  <span key={a.actionId} className="pill" title={a.reason}>
                    {a.type}: {a.title}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* ── Skill Tree (collapsible levels) ─────── */}
          <section className="dash-section">
            <div className="row">
              <h2 className="dash-heading" style={{ margin: 0 }}>{dashboard.locationSkillTree.title}</h2>
              <span className="pill">{dashboard.locationSkillTree.packId}</span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {dashboard.locationSkillTree.levels.map((level) => {
                const isOpen = expandedLevels.has(level.level);
                return (
                  <div key={level.level} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button
                      type="button"
                      className="dash-collapsible-header"
                      onClick={() => toggleLevel(level.level)}
                    >
                      <Chevron open={isOpen} />
                      <span style={{ flex: 1 }}>
                        <strong>L{level.level}</strong> {level.name}
                      </span>
                      <span className="pill" style={{ fontSize: 11 }}>{level.objectives.length} obj</span>
                      <StatusPill status={level.mission.status} />
                    </button>
                    {isOpen && (
                      <div className="stack" style={{ padding: '0 14px 14px', gap: 10 }}>
                        <p>{level.description}</p>
                        <div className="row" style={{ justifyContent: 'flex-start' }}>
                          <span className="pill">~{level.estimatedSessionMinutes} min</span>
                          <span className="pill">
                            {level.mission.reward.xp} XP / {level.mission.reward.sp} SP / {level.mission.reward.rp} RP
                          </span>
                        </div>
                        {level.objectives.map((obj) => (
                          <div key={obj.objectiveId} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                            <div className="row" style={{ marginBottom: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong>{obj.title}</strong>
                                <p>{obj.description}</p>
                              </div>
                              <StatusPill status={obj.status} />
                            </div>
                            <div className="row" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
                              <span className="pill">{obj.category}</span>
                              <span className="pill">{obj.validatedTargetCount}/{obj.targetCount} targets</span>
                              {obj.blockers.length > 0 && <span className="pill">Blocked by {obj.blockers.length}</span>}
                            </div>
                            <ProgressBar value={obj.mastery_score} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── World Roadmap (collapsible cities) ──── */}
          <section className="dash-section">
            <h2 className="dash-heading">World Roadmap</h2>
            <div className="stack" style={{ gap: 6 }}>
              {dashboard.worldRoadmap.map((city) => {
                const isOpen = expandedCities.has(city.cityId);
                const activeCount = city.locations.filter((l) => l.status === 'active' || l.status === 'learning').length;
                return (
                  <div key={city.cityId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button
                      type="button"
                      className="dash-collapsible-header"
                      onClick={() => toggleCity(city.cityId)}
                    >
                      <Chevron open={isOpen} />
                      <span style={{ flex: 1 }}>
                        <strong>{city.label}</strong>
                        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                          {city.focus} · {city.proficiency}
                        </span>
                      </span>
                      <span className="pill">{activeCount}/{city.locations.length} active</span>
                    </button>
                    {isOpen && (
                      <div className="stack" style={{ padding: '0 14px 14px', gap: 6 }}>
                        {city.locations.map((loc) => (
                          <div key={loc.locationId} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong>{loc.label}</strong>
                              <p style={{ fontSize: 12 }}>{loc.progress}</p>
                            </div>
                            <StatusPill status={loc.status} />
                          </div>
                        ))}
                        <div className="row" style={{ justifyContent: 'flex-start' }}>
                          {city.levels.map((lvl) => (
                            <span key={`${city.cityId}-${lvl.level}`} className="pill" style={{ fontSize: 11 }}>
                              L{lvl.level} {lvl.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Personalized Overlay (collapsed) ────── */}
          <details className="dash-details">
            <summary className="dash-details-summary">
              <h3 style={{ margin: 0 }}>Personalized Overlay</h3>
              <span className="pill">{dashboard.personalizedOverlay.focusCards.length} cards</span>
            </summary>
            <div className="dash-details-body">
              <p>{dashboard.personalizedOverlay.summary}</p>
              {dashboard.personalizedOverlay.focusCards.map((card) => (
                <div key={card.overlayId} className="card stack" style={{ padding: 12 }}>
                  <div className="row">
                    <strong>{card.title}</strong>
                    <span className="pill">{card.lang.toUpperCase()} · {card.theme}</span>
                  </div>
                  <p>{card.reason}</p>
                  <div className="row" style={{ justifyContent: 'flex-start' }}>
                    {card.nodes.map((n) => (
                      <span key={n.nodeId} className="pill">{n.label} · {n.translation}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>

          {/* ── Learner Profile (collapsed) ─────────── */}
          <details className="dash-details">
            <summary className="dash-details-summary">
              <h3 style={{ margin: 0 }}>Learner Profile</h3>
              <span className="pill">{dashboard.persona.userId}</span>
            </summary>
            <div className="dash-details-body">
              <div className="row" style={{ justifyContent: 'flex-start' }}>
                {Object.entries(dashboard.persona.proficiency).map(([lang, level]) => (
                  <span key={lang} className="pill">{lang.toUpperCase()} {level}</span>
                ))}
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <strong>Goals</strong>
                {dashboard.persona.goals.map((g) => (
                  <p key={`${g.lang}-${g.theme}`}><strong>{g.lang.toUpperCase()}</strong> {g.objective}</p>
                ))}
              </div>
              {dashboard.persona.topTerms.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <strong>Top terms from media</strong>
                  <div className="row" style={{ justifyContent: 'flex-start' }}>
                    {dashboard.persona.topTerms.map((t) => (
                      <span key={`${t.lang}-${t.lemma}`} className="pill">{t.lemma} · {t.source}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* ── Validator Dashboard (collapsed) ──────── */}
          <details className="dash-details">
            <summary className="dash-details-summary">
              <h3 style={{ margin: 0 }}>Validator</h3>
              <div className="row" style={{ justifyContent: 'flex-start', gap: 6 }}>
                {validatorCities.map((c) => (
                  <span key={c.cityId} className="pill" style={{ fontSize: 11 }}>
                    {c.label}: {c.validatorSummary.foundation_authored}A {c.validatorSummary.preview}P {c.validatorSummary.missing}M
                  </span>
                ))}
              </div>
            </summary>
            <div className="dash-details-body">
              {validatorCities.map((city) => (
                <div key={`v-${city.cityId}`} className="stack" style={{ gap: 6 }}>
                  <strong>{city.label}</strong>
                  {city.validatorLocations.map((loc) => (
                    <div key={`${city.cityId}-${loc.locationId}`} className="row" style={{ padding: '4px 0' }}>
                      <span style={{ minWidth: 120 }}>{loc.label}</span>
                      <StatusPill status={loc.validatorStatus} />
                      <p style={{ flex: 1, fontSize: 12 }}>{loc.note}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>

          {/* ── Agent Tools (collapsed) ─────────────── */}
          <details className="dash-details">
            <summary className="dash-details-summary">
              <h3 style={{ margin: 0 }}>Agent Tools</h3>
              <span className="pill">{graphTools.length} tools</span>
            </summary>
            <div className="dash-details-body">
              {graphTools.map((tool) => (
                <div key={tool.name} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <strong>{tool.name}</strong>
                  <p style={{ marginTop: 2 }}>{tool.description}</p>
                </div>
              ))}
            </div>
          </details>
        </>
      )}

      <p className="demo-access-hint" style={{ marginTop: 16 }}>API: {apiBase}</p>
    </main>
  );
}

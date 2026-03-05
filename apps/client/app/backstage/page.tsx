'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import {
  useDirectorState,
  createPipeline,
  setActivePipeline,
  deletePipeline,
  setPlan,
  approvePlan,
  addBackdropProposal,
  selectBackdrop,
  markPublished,
  goToStage,
  exportPipeline,
} from '@/lib/store/director-store';
import type {
  DirectorStage,
  LocationPipeline,
  LocationPlan,
  BackdropConcept,
} from '@/lib/types/director';
import { DIRECTOR_STAGES, STAGE_LABELS } from '@/lib/types/director';
import { getRegisteredLocationKeys, getLocation } from '@/lib/content/locations';

/* ── City config ───────────────────────────────────────────── */

const CITIES = [
  { id: 'seoul', label: 'Seoul', lang: 'ko' },
  { id: 'shanghai', label: 'Shanghai', lang: 'zh' },
  { id: 'tokyo', label: 'Tokyo', lang: 'ja' },
];

const LANG_MAP: Record<string, string> = { seoul: 'ko', shanghai: 'zh', tokyo: 'ja' };

function getLocationEntries() {
  return getRegisteredLocationKeys().map((key) => {
    const [cityId, locationId] = key.split(':');
    const loc = getLocation(cityId, locationId);
    if (!loc) return null;
    const hasContent = loc.vocabularyTargets.length > 0 && loc.levels.some((l) => l.objectives.length > 0);
    const localName = Object.entries(loc.name).find(([k]) => k !== 'en')?.[1] || '';
    return { cityId, locationId: loc.id, label: loc.name.en || loc.id, local: localName, domain: loc.domain, hasContent, stub: loc as unknown as Record<string, unknown> };
  }).filter(Boolean) as Array<{
    cityId: string; locationId: string; label: string; local: string; domain: string; hasContent: boolean; stub: Record<string, unknown>;
  }>;
}

/** Convert { en, local } name from AI to { en, <langCode> }. */
function expandName(raw: { en?: string; local?: string } | Record<string, string>, cityId: string): Record<string, string> {
  if (!raw) return { en: '' };
  if (!('local' in raw)) return raw as Record<string, string>;
  const code = LANG_MAP[cityId] || 'ko';
  return { en: (raw as { en: string }).en || '', [code]: (raw as { local: string }).local || '' };
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function BackstagePage() {
  const directorState = useDirectorState();
  const [selectedCity, setSelectedCity] = useState('seoul');
  const [newLocationId, setNewLocationId] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [directorMessages, setDirectorMessages] = useState<string[]>([]);

  const activePipeline = directorState.activePipelineId
    ? directorState.pipelines[directorState.activePipelineId]
    : null;

  const pipelineRef = useRef(activePipeline);
  pipelineRef.current = activePipeline;
  const processedToolCalls = useRef(new Set<string>());

  /* ── AI Chat hook ──────────────────────────────────────── */
  const { messages, setMessages, append, isLoading } = useChat({
    api: '/api/ai/director',
    body: { pipeline: activePipeline, feedback: feedbackText || undefined },
  });

  /* ── Extract tool results from streamed messages ──────── */
  useEffect(() => {
    const p = pipelineRef.current;
    if (!p) return;
    const pid = p.id;

    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.toolInvocations) continue;
      for (const inv of msg.toolInvocations) {
        if (inv.state !== 'result') continue;
        const callId = inv.toolCallId;
        if (processedToolCalls.current.has(callId)) continue;
        processedToolCalls.current.add(callId);

        const data = (inv.result ?? inv.args) as Record<string, unknown>;

        switch (inv.toolName) {
          case 'propose_plan': {
            const plan = data as unknown as { concept: Record<string, unknown>; characters: Record<string, unknown>[]; curriculum: Record<string, unknown> };
            // Expand names from { en, local } → { en, ko/zh/ja }
            const concept = { ...plan.concept, name: expandName(plan.concept.name as { en: string; local: string }, plan.concept.cityId as string) };
            const characters = plan.characters.map((c) => ({
              ...c,
              name: expandName(c.name as { en: string; local: string }, c.cityId as string),
            }));
            setPlan(pid, { concept, characters, curriculum: plan.curriculum } as unknown as LocationPlan);
            break;
          }
          case 'propose_backdrop':
            addBackdropProposal(pid, data as unknown as BackdropConcept);
            break;
          case 'director_message':
            setDirectorMessages((prev) => [...prev, (data as { message: string }).message]);
            break;
        }
      }
    }
  }, [messages]);

  /* ── Actions ───────────────────────────────────────────── */

  const handleCreatePipeline = useCallback((cityId?: string, locId?: string, stub?: Record<string, unknown>) => {
    const city = cityId || selectedCity;
    const loc = locId || newLocationId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!loc) return;
    const pipelineId = `${city}:${loc}`;
    if (directorState.pipelines[pipelineId]) {
      setActivePipeline(pipelineId);
    } else {
      createPipeline(city, loc, stub);
    }
    setNewLocationId('');
  }, [selectedCity, newLocationId, directorState.pipelines]);

  const handleGenerate = useCallback(() => {
    if (!activePipeline) return;
    setDirectorMessages([]);
    setMessages([]);
    processedToolCalls.current.clear();
    const stage = activePipeline.currentStage;
    append({
      role: 'user',
      content: feedbackText
        ? `Regenerate the ${stage}. Feedback: ${feedbackText}`
        : `Generate the ${stage} for this location.`,
    });
    setFeedbackText('');
  }, [activePipeline, feedbackText, append, setMessages]);

  const handlePublish = useCallback(async () => {
    if (!activePipeline) return;
    const exported = exportPipeline(activePipeline.id);
    if (!exported) return;
    try {
      const serverUrl = process.env.NEXT_PUBLIC_TONG_SERVER_URL || 'http://localhost:8787';
      await fetch(`${serverUrl}/api/v1/director/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId: activePipeline.id, ...exported }),
      });
      markPublished(activePipeline.id);
    } catch (err) {
      console.error('Publish failed:', err);
      markPublished(activePipeline.id);
    }
  }, [activePipeline]);

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="backstage">
      <header className="backstage-header">
        <h1>Backstage</h1>
        <span className="backstage-subtitle">AI Director</span>
      </header>

      <div className="backstage-layout">
        {/* ── Sidebar ───────────────────────────────────── */}
        <aside className="backstage-sidebar">
          {CITIES.map((city) => {
            const stubs = getLocationEntries().filter((s) => s.cityId === city.id);
            return (
              <div key={city.id} className="backstage-city-group">
                <h2>{city.label}</h2>
                <ul className="backstage-pipeline-list">
                  {stubs.map((stub) => {
                    const pipelineId = `${stub.cityId}:${stub.locationId}`;
                    const pipeline = directorState.pipelines[pipelineId];
                    const isActive = directorState.activePipelineId === pipelineId;
                    return (
                      <li
                        key={pipelineId}
                        className={`backstage-pipeline-item ${isActive ? 'active' : ''} ${stub.hasContent ? 'has-content' : ''}`}
                        onClick={() => handleCreatePipeline(stub.cityId, stub.locationId, stub.stub as Record<string, unknown>)}
                      >
                        <div className="pipeline-info">
                          <span className="pipeline-label">{stub.local}</span>
                          <span className="pipeline-sublabel">{stub.label}</span>
                        </div>
                        {stub.hasContent ? (
                          <span className="pipeline-stage published">live</span>
                        ) : pipeline ? (
                          <span className={`pipeline-stage ${pipeline.currentStage}`}>{pipeline.currentStage}</span>
                        ) : (
                          <span className="pipeline-stage empty">stub</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="backstage-city-group">
            <h2>Custom</h2>
            <div className="backstage-create">
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                {CITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input
                type="text"
                placeholder="new_location_id"
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePipeline()}
              />
              <button onClick={() => handleCreatePipeline()} disabled={!newLocationId.trim()}>+ New</button>
            </div>
          </div>
        </aside>

        {/* ── Main ──────────────────────────────────────── */}
        <main className="backstage-main">
          {!activePipeline ? (
            <div className="backstage-empty">Select a location to get started.</div>
          ) : (
            <>
              {/* Stage stepper + controls row */}
              <div className="backstage-toolbar">
                <div className="stage-stepper">
                  {DIRECTOR_STAGES.map((stage, i) => {
                    const isCurrent = activePipeline.currentStage === stage;
                    const isPast = DIRECTOR_STAGES.indexOf(activePipeline.currentStage) > i;
                    return (
                      <button
                        key={stage}
                        className={`stage-step ${isCurrent ? 'current' : ''} ${isPast ? 'done' : ''}`}
                        onClick={() => goToStage(activePipeline.id, stage)}
                      >
                        <span className="stage-dot">{isPast ? '\u2713' : i + 1}</span>
                        <span className="stage-label">{STAGE_LABELS[stage]}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="toolbar-actions">
                  {activePipeline.currentStage !== 'published' && (
                    <button
                      className="btn-generate"
                      onClick={handleGenerate}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Generating...' : `Generate ${STAGE_LABELS[activePipeline.currentStage]}`}
                    </button>
                  )}
                  {activePipeline.currentStage === 'published' && !activePipeline.publishedAt && (
                    <button className="btn-publish" onClick={handlePublish}>Publish to Server</button>
                  )}
                </div>
              </div>

              {/* Feedback bar */}
              {activePipeline.currentStage !== 'published' && (
                <div className="feedback-bar">
                  <input
                    type="text"
                    className="feedback-input-inline"
                    placeholder="Feedback for AI Director (optional)..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                </div>
              )}

              {/* Director messages */}
              {directorMessages.length > 0 && (
                <div className="director-messages">
                  {directorMessages.map((msg, i) => (
                    <div key={i} className="director-msg">{msg}</div>
                  ))}
                </div>
              )}

              {/* Stage content */}
              <div className="stage-content">
                <StagePanel pipeline={activePipeline} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Stage Panel ───────────────────────────────────────────── */

function StagePanel({ pipeline }: { pipeline: LocationPipeline }) {
  switch (pipeline.currentStage) {
    case 'plan':
      return <PlanStage pipeline={pipeline} />;
    case 'backdrops':
      return <BackdropsStage pipeline={pipeline} />;
    case 'published':
      return <PublishedStage pipeline={pipeline} />;
    default:
      return null;
  }
}

/* ── Plan Stage ────────────────────────────────────────────── */

function PlanStage({ pipeline }: { pipeline: LocationPipeline }) {
  const plan = pipeline.plan;

  if (!plan) {
    return <div className="stage-empty">Click "Generate Plan" to create a complete location plan.</div>;
  }

  const { concept, characters, curriculum } = plan.data;

  return (
    <div className="plan-review">
      {/* Concept section */}
      <section className="plan-section">
        <h3 className="plan-section-title">Location Concept</h3>
        <div className="plan-card">
          <div className="proposal-header">
            <h4>{concept.name.en}</h4>
            <span className="proposal-native">{Object.values(concept.name).find((_, i) => i === 1) || ''}</span>
          </div>
          <div className="proposal-meta">
            <span className="tag">{concept.domain}</span>
            <span className="tag">{concept.suggestedNpcCount} NPCs</span>
          </div>
          <p className="proposal-desc">{concept.ambientDescription}</p>
          <p className="proposal-hook"><strong>Cultural:</strong> {concept.culturalHook}</p>
          <p className="proposal-hook"><strong>Narrative:</strong> {concept.narrativeHook}</p>
        </div>
      </section>

      {/* Characters section */}
      <section className="plan-section">
        <h3 className="plan-section-title">Characters ({characters.length})</h3>
        <div className="proposal-grid">
          {characters.map((char, i) => (
            <div key={char.id || i} className="plan-card">
              <div className="proposal-header">
                <h4>{char.name.en}</h4>
                <span className="proposal-native">{Object.values(char.name).find((_, i) => i === 1) || ''}</span>
              </div>
              <div className="proposal-meta">
                <span className="tag">{char.archetype}</span>
                <span className="tag">{char.role}</span>
                {char.romanceable && <span className="tag romance">romanceable</span>}
              </div>
              <p className="proposal-desc">{char.context}</p>
              <p className="proposal-hook"><strong>Personality:</strong> {char.personality.traits.join(', ')}</p>
              <p className="proposal-hook"><strong>Backstory:</strong> {char.backstory}</p>
              <details>
                <summary>Speech Style</summary>
                <pre className="speech-preview">{JSON.stringify(char.speechStyle, null, 2)}</pre>
              </details>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum section */}
      <section className="plan-section">
        <h3 className="plan-section-title">Curriculum</h3>
        <div className="plan-card wide">
          <div className="curriculum-summary">
            <div className="curriculum-stat"><strong>{curriculum.levels.length}</strong> levels</div>
            <div className="curriculum-stat"><strong>{curriculum.vocabularyTargets.length}</strong> vocab items</div>
            <div className="curriculum-stat"><strong>{curriculum.grammarTargets.length}</strong> grammar patterns</div>
            <div className="curriculum-stat">
              <strong>{curriculum.levels.reduce((sum: number, l: { objectives: unknown[] }) => sum + l.objectives.length, 0)}</strong> objectives
            </div>
          </div>

          {curriculum.levels.map((level: { level: number; name: string; description: string; objectives: { id: string; title: string; description: string; targetCount: number; assessmentThreshold: number; prerequisites: string[] }[] }) => (
            <details key={level.level} className="level-detail">
              <summary>L{level.level}: {level.name} — {level.description} ({level.objectives.length} objectives)</summary>
              <ul className="objective-list">
                {level.objectives.map((obj) => (
                  <li key={obj.id}>
                    <strong>{obj.title}</strong> — {obj.description}
                    <br />
                    <span className="obj-meta">
                      {obj.targetCount} items | threshold: {obj.assessmentThreshold}
                      {obj.prerequisites.length > 0 && ` | prereqs: ${obj.prerequisites.join(', ')}`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}

          <details className="vocab-detail">
            <summary>Vocabulary ({curriculum.vocabularyTargets.length} items)</summary>
            <div className="vocab-grid">
              {curriculum.vocabularyTargets.slice(0, 20).map((v: { word: string; romanization: string; translation: string }, i: number) => (
                <div key={i} className="vocab-item">
                  <span className="vocab-word">{v.word}</span>
                  <span className="vocab-rom">{v.romanization}</span>
                  <span className="vocab-trans">{v.translation}</span>
                </div>
              ))}
              {curriculum.vocabularyTargets.length > 20 && (
                <div className="vocab-more">+{curriculum.vocabularyTargets.length - 20} more</div>
              )}
            </div>
          </details>
        </div>
      </section>

      {/* Approve button */}
      {plan.status === 'proposed' && (
        <button className="btn-advance" onClick={() => approvePlan(pipeline.id)}>
          Approve Plan &amp; Continue to Backdrops
        </button>
      )}
      {plan.status === 'approved' && (
        <div className="status-badge approved" style={{ textAlign: 'center', marginTop: 16 }}>Plan Approved</div>
      )}
    </div>
  );
}

/* ── Backdrops Stage ───────────────────────────────────────── */

function BackdropsStage({ pipeline }: { pipeline: LocationPipeline }) {
  if (pipeline.backdrops.length === 0) {
    return <div className="stage-empty">Click "Generate Backdrops" to create backdrop concepts.</div>;
  }

  return (
    <div className="proposal-grid">
      {pipeline.backdrops.map((p) => (
        <div key={p.id} className={`proposal-card ${p.status}`}>
          <h3>Backdrop Option</h3>
          <div className="proposal-meta">
            <span className="tag">{p.data.timeOfDay}</span>
            <span className="tag">{p.data.mood}</span>
          </div>
          <p className="proposal-desc">{p.data.prompt}</p>
          {p.data.imageUrl && (
            <img src={p.data.imageUrl} alt="Generated backdrop" className="backdrop-preview" />
          )}
          <div className="proposal-actions">
            {p.status === 'proposed' && (
              <button className="btn-approve" onClick={() => selectBackdrop(pipeline.id, p.id)}>Select</button>
            )}
            {p.status === 'approved' && <span className="status-badge approved">Selected</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Published Stage ───────────────────────────────────────── */

function PublishedStage({ pipeline }: { pipeline: LocationPipeline }) {
  const exported = exportPipeline(pipeline.id);

  return (
    <div className="published-view">
      <h3>{pipeline.publishedAt ? 'Published' : 'Ready to Publish'}</h3>
      {pipeline.publishedAt && (
        <p className="publish-date">Published at: {new Date(pipeline.publishedAt).toLocaleString()}</p>
      )}
      <div className="published-summary">
        <div className="summary-section">
          <h4>Location</h4>
          <p>{exported?.concept?.name?.en || pipeline.id}</p>
          <p>{exported?.concept?.ambientDescription}</p>
        </div>
        <div className="summary-section">
          <h4>Characters ({exported?.characters?.length || 0})</h4>
          {exported?.characters?.map((c: { id: string; name: Record<string, string>; role: string; archetype: string }) => (
            <p key={c.id}>{c.name.en} — {c.role} ({c.archetype})</p>
          ))}
        </div>
        <div className="summary-section">
          <h4>Curriculum</h4>
          <p>{exported?.curriculum?.levels?.length || 0} levels, {exported?.curriculum?.vocabularyTargets?.length || 0} vocab, {exported?.curriculum?.grammarTargets?.length || 0} grammar</p>
        </div>
        <div className="summary-section">
          <h4>Backdrop</h4>
          <p>{exported?.backdrop?.timeOfDay} / {exported?.backdrop?.mood}</p>
        </div>
      </div>
      <details>
        <summary>Raw JSON Export</summary>
        <pre className="json-export">{JSON.stringify(exported, null, 2)}</pre>
      </details>
    </div>
  );
}

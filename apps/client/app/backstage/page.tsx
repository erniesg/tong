'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import {
  useDirectorState,
  createPipeline,
  setActivePipeline,
  deletePipeline,
  addConceptProposal,
  selectConcept,
  addCharacterProposal,
  selectCharacter,
  advanceFromCharacters,
  addCurriculumProposal,
  selectCurriculum,
  addBackdropProposal,
  selectBackdrop,
  markPublished,
  goToStage,
  exportPipeline,
} from '@/lib/store/director-store';
import type {
  DirectorStage,
  LocationPipeline,
  LocationConcept,
  CharacterConcept,
  CurriculumConcept,
  BackdropConcept,
  Proposal,
} from '@/lib/types/director';
import { DIRECTOR_STAGES, STAGE_LABELS } from '@/lib/types/director';
import { getRegisteredLocationKeys, getLocation } from '@/lib/content/locations';

/* ── City config ───────────────────────────────────────────── */

const CITIES = [
  { id: 'seoul', label: 'Seoul', lang: 'ko' },
  { id: 'shanghai', label: 'Shanghai', lang: 'zh' },
  { id: 'tokyo', label: 'Tokyo', lang: 'ja' },
];

/** Derive location list from the single source of truth (location registry). */
function getLocationEntries() {
  return getRegisteredLocationKeys().map((key) => {
    const [cityId, locationId] = key.split(':');
    const loc = getLocation(cityId, locationId);
    if (!loc) return null;
    const hasContent = loc.vocabularyTargets.length > 0 && loc.levels.some((l) => l.objectives.length > 0);
    const localName = Object.entries(loc.name).find(([k]) => k !== 'en')?.[1] || '';
    return {
      cityId,
      locationId: loc.id,
      label: loc.name.en || loc.id,
      local: localName,
      domain: loc.domain,
      hasContent,
    };
  }).filter(Boolean) as Array<{
    cityId: string;
    locationId: string;
    label: string;
    local: string;
    domain: string;
    hasContent: boolean;
  }>;
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

  // Refs so callbacks always see the latest values
  const pipelineRef = useRef(activePipeline);
  pipelineRef.current = activePipeline;
  const feedbackRef = useRef(feedbackText);
  feedbackRef.current = feedbackText;

  // Track which tool invocations we've already processed
  const processedToolCalls = useRef(new Set<string>());

  /* ── AI Chat hook ──────────────────────────────────────── */
  const { messages, setMessages, append, isLoading } = useChat({
    api: '/api/ai/director',
    body: {
      pipeline: activePipeline,
      feedback: feedbackText || undefined,
    },
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
        console.log('[director] tool result:', inv.toolName, data);

        // The API returns name as { en, local }. Convert to { en, <langCode> } for the store.
        const langMap: Record<string, string> = { seoul: 'ko', shanghai: 'zh', tokyo: 'ja' };

        function expandName(raw: unknown, cityId: string): Record<string, string> {
          const n = raw as { en?: string; local?: string } | Record<string, string> | undefined;
          if (!n) return { en: '' };
          // Already expanded (has a lang code key)?
          if (!('local' in n)) return n as Record<string, string>;
          const code = langMap[cityId] || 'ko';
          return { en: n.en || '', [code]: n.local || '' };
        }

        switch (inv.toolName) {
          case 'propose_concept': {
            const d = data as Record<string, unknown> & { name: unknown; cityId: string };
            addConceptProposal(pid, { ...d, name: expandName(d.name, d.cityId) } as unknown as LocationConcept);
            break;
          }
          case 'propose_character': {
            const d = data as Record<string, unknown> & { name: unknown; cityId: string };
            addCharacterProposal(pid, { ...d, name: expandName(d.name, d.cityId) } as unknown as CharacterConcept);
            break;
          }
          case 'propose_curriculum':
            addCurriculumProposal(pid, data as unknown as CurriculumConcept);
            break;
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

  const handleCreatePipeline = useCallback((cityId?: string, locId?: string) => {
    const city = cityId || selectedCity;
    const loc = locId || newLocationId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!loc) return;
    const pipelineId = `${city}:${loc}`;
    // Don't recreate if already exists — just select it
    if (directorState.pipelines[pipelineId]) {
      setActivePipeline(pipelineId);
    } else {
      createPipeline(city, loc);
    }
    setNewLocationId('');
  }, [selectedCity, newLocationId, directorState.pipelines]);

  const handleGenerate = useCallback(() => {
    if (!activePipeline) return;
    setDirectorMessages([]);
    setMessages([]);
    processedToolCalls.current.clear();
    append({
      role: 'user',
      content: feedbackText
        ? `Regenerate proposals for ${activePipeline.currentStage}. Feedback: ${feedbackText}`
        : `Generate proposals for the ${activePipeline.currentStage} stage.`,
    });
    setFeedbackText('');
  }, [activePipeline, feedbackText, append, setMessages]);

  const handlePublish = useCallback(async () => {
    if (!activePipeline) return;
    const exported = exportPipeline(activePipeline.id);
    if (!exported) return;

    // Save to server
    try {
      const serverUrl = process.env.NEXT_PUBLIC_TONG_SERVER_URL || 'http://localhost:8787';
      await fetch(`${serverUrl}/api/v1/director/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: activePipeline.id,
          ...exported,
        }),
      });
      markPublished(activePipeline.id);
    } catch (err) {
      console.error('Publish failed:', err);
      // Still mark locally
      markPublished(activePipeline.id);
    }
  }, [activePipeline]);

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="backstage">
      <header className="backstage-header">
        <h1>Backstage</h1>
        <span className="backstage-subtitle">AI Director Content Pipeline</span>
      </header>

      <div className="backstage-layout">
        {/* ── Sidebar: Locations ─────────────────────────── */}
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
                        onClick={() => handleCreatePipeline(stub.cityId, stub.locationId)}
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

          {/* Custom location */}
          <div className="backstage-city-group">
            <h2>Custom</h2>
            <div className="backstage-create">
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="new_location_id"
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePipeline()}
              />
              <button onClick={() => handleCreatePipeline()} disabled={!newLocationId.trim()}>
                + New
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main: Active Pipeline ─────────────────────── */}
        <main className="backstage-main">
          {!activePipeline ? (
            <div className="backstage-empty">
              Select or create a pipeline to get started.
            </div>
          ) : (
            <>
              {/* Stage stepper */}
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

              {/* Controls */}
              <div className="backstage-controls">
                <textarea
                  className="feedback-input"
                  placeholder="Feedback for AI Director (optional)..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={2}
                />
                <div className="control-buttons">
                  <button
                    className="btn-generate"
                    onClick={handleGenerate}
                    disabled={isLoading || activePipeline.currentStage === 'published'}
                  >
                    {isLoading ? 'Generating...' : `Generate ${STAGE_LABELS[activePipeline.currentStage]}`}
                  </button>
                  {activePipeline.currentStage === 'published' && !activePipeline.publishedAt && (
                    <button className="btn-publish" onClick={handlePublish}>
                      Publish to Server
                    </button>
                  )}
                  <button
                    className="btn-delete"
                    onClick={() => {
                      if (confirm('Delete this pipeline?')) deletePipeline(activePipeline.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
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
    case 'concept':
      return <ConceptStage pipeline={pipeline} />;
    case 'characters':
      return <CharactersStage pipeline={pipeline} />;
    case 'curriculum':
      return <CurriculumStage pipeline={pipeline} />;
    case 'backdrops':
      return <BackdropsStage pipeline={pipeline} />;
    case 'published':
      return <PublishedStage pipeline={pipeline} />;
    default:
      return null;
  }
}

/* ── Concept Stage ─────────────────────────────────────────── */

function ConceptStage({ pipeline }: { pipeline: LocationPipeline }) {
  if (pipeline.concepts.length === 0) {
    return <div className="stage-empty">Click "Generate" to create location concepts.</div>;
  }

  return (
    <div className="proposal-grid">
      {pipeline.concepts.map((p) => (
        <div key={p.id} className={`proposal-card ${p.status}`}>
          <div className="proposal-header">
            <h3>{p.data.name.en}</h3>
            <span className="proposal-native">{Object.values(p.data.name).find((_, i) => i === 1) || ''}</span>
          </div>
          <div className="proposal-meta">
            <span className="tag">{p.data.domain}</span>
            <span className="tag">{p.data.suggestedNpcCount} NPCs</span>
          </div>
          <p className="proposal-desc">{p.data.ambientDescription}</p>
          <p className="proposal-hook"><strong>Cultural:</strong> {p.data.culturalHook}</p>
          <p className="proposal-hook"><strong>Narrative:</strong> {p.data.narrativeHook}</p>
          <div className="proposal-actions">
            {p.status === 'proposed' && (
              <button className="btn-approve" onClick={() => selectConcept(pipeline.id, p.id)}>
                Select
              </button>
            )}
            {p.status === 'approved' && <span className="status-badge approved">Selected</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Characters Stage ──────────────────────────────────────── */

function CharactersStage({ pipeline }: { pipeline: LocationPipeline }) {
  if (pipeline.characters.length === 0) {
    return <div className="stage-empty">Click "Generate" to create NPC characters.</div>;
  }

  const allDecided = pipeline.characters.every((c) => c.status !== 'proposed');

  return (
    <>
      <div className="proposal-grid">
        {pipeline.characters.map((p) => (
          <div key={p.id} className={`proposal-card ${p.status}`}>
            <div className="proposal-header">
              <h3>{p.data.name.en}</h3>
              <span className="proposal-native">{Object.values(p.data.name).find((_, i) => i === 1) || ''}</span>
            </div>
            <div className="proposal-meta">
              <span className="tag">{p.data.archetype}</span>
              <span className="tag">{p.data.role}</span>
              {p.data.romanceable && <span className="tag romance">romanceable</span>}
            </div>
            <p className="proposal-desc">{p.data.context}</p>
            <p className="proposal-hook"><strong>Personality:</strong> {p.data.personality.traits.join(', ')}</p>
            <p className="proposal-hook"><strong>Backstory:</strong> {p.data.backstory}</p>
            <details>
              <summary>Speech Style</summary>
              <pre className="speech-preview">{JSON.stringify(p.data.speechStyle, null, 2)}</pre>
            </details>
            <div className="proposal-actions">
              {p.status === 'proposed' && (
                <>
                  <button className="btn-approve" onClick={() => selectCharacter(pipeline.id, p.id, true)}>
                    Approve
                  </button>
                  <button className="btn-reject" onClick={() => selectCharacter(pipeline.id, p.id, false)}>
                    Reject
                  </button>
                </>
              )}
              {p.status === 'approved' && <span className="status-badge approved">Approved</span>}
              {p.status === 'rejected' && <span className="status-badge rejected">Rejected</span>}
            </div>
          </div>
        ))}
      </div>
      {allDecided && pipeline.selectedCharacters.length > 0 && (
        <button className="btn-advance" onClick={() => advanceFromCharacters(pipeline.id)}>
          Continue with {pipeline.selectedCharacters.length} character(s)
        </button>
      )}
    </>
  );
}

/* ── Curriculum Stage ──────────────────────────────────────── */

function CurriculumStage({ pipeline }: { pipeline: LocationPipeline }) {
  if (pipeline.curriculum.length === 0) {
    return <div className="stage-empty">Click "Generate" to create the curriculum.</div>;
  }

  return (
    <div className="proposal-grid">
      {pipeline.curriculum.map((p) => (
        <div key={p.id} className={`proposal-card wide ${p.status}`}>
          <h3>Curriculum Proposal</h3>
          <div className="curriculum-summary">
            <div className="curriculum-stat">
              <strong>{p.data.levels.length}</strong> levels
            </div>
            <div className="curriculum-stat">
              <strong>{p.data.vocabularyTargets.length}</strong> vocab items
            </div>
            <div className="curriculum-stat">
              <strong>{p.data.grammarTargets.length}</strong> grammar patterns
            </div>
            <div className="curriculum-stat">
              <strong>{p.data.levels.reduce((sum, l) => sum + l.objectives.length, 0)}</strong> objectives
            </div>
          </div>

          {/* Levels overview */}
          {p.data.levels.map((level) => (
            <details key={level.level} className="level-detail">
              <summary>
                L{level.level}: {level.name} — {level.description} ({level.objectives.length} objectives)
              </summary>
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

          {/* Vocab sample */}
          <details className="vocab-detail">
            <summary>Vocabulary ({p.data.vocabularyTargets.length} items)</summary>
            <div className="vocab-grid">
              {p.data.vocabularyTargets.slice(0, 20).map((v, i) => (
                <div key={i} className="vocab-item">
                  <span className="vocab-word">{v.word}</span>
                  <span className="vocab-rom">{v.romanization}</span>
                  <span className="vocab-trans">{v.translation}</span>
                </div>
              ))}
              {p.data.vocabularyTargets.length > 20 && (
                <div className="vocab-more">+{p.data.vocabularyTargets.length - 20} more</div>
              )}
            </div>
          </details>

          <div className="proposal-actions">
            {p.status === 'proposed' && (
              <button className="btn-approve" onClick={() => selectCurriculum(pipeline.id, p.id)}>
                Approve Curriculum
              </button>
            )}
            {p.status === 'approved' && <span className="status-badge approved">Approved</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Backdrops Stage ───────────────────────────────────────── */

function BackdropsStage({ pipeline }: { pipeline: LocationPipeline }) {
  if (pipeline.backdrops.length === 0) {
    return <div className="stage-empty">Click "Generate" to create backdrop concepts.</div>;
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
              <button className="btn-approve" onClick={() => selectBackdrop(pipeline.id, p.id)}>
                Select
              </button>
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
          {exported?.characters?.map((c) => (
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

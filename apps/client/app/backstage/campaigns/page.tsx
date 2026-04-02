'use client';

import { useCallback, useRef, useState } from 'react';
import { useChat } from 'ai/react';

interface CampaignConcept {
  name: string;
  concept: string;
  inspiredBy: { trendName: string; platform: string; why: string };
  hook: { description: string; type: string };
  scenes: Array<{ order: number; description: string; duration: number; assetType: string; city?: string }>;
  platformVariants: Array<{ platform: string; format: string; hashtags: string[]; soundStrategy: string; adaptationNotes: string }>;
  production: { effort: string; existingAssets: string[]; newAssets: string[]; estimatedClips: number };
  targetAudience: string;
  callToAction: string;
}

export default function CampaignsPage() {
  const [concepts, setConcepts] = useState<CampaignConcept[]>([]);
  const [brief, setBrief] = useState('');
  const processedCalls = useRef(new Set<string>());

  const { messages, append, isLoading } = useChat({
    api: '/api/ai/campaign',
    body: { brief: brief || undefined },
    onToolCall({ toolCall }) {
      if (processedCalls.current.has(toolCall.toolCallId)) return;
      processedCalls.current.add(toolCall.toolCallId);

      if (toolCall.toolName === 'propose_campaign') {
        const args = toolCall.args as unknown as CampaignConcept;
        setConcepts((prev) => [...prev, args]);
      }
    },
  });

  const handleGenerate = useCallback(() => {
    setConcepts([]);
    processedCalls.current.clear();
    append({
      role: 'user',
      content: brief
        ? `Generate campaign concepts focusing on: ${brief}`
        : 'Generate 3-5 campaign concepts based on current social media trends for a language learning dating sim game.',
    });
  }, [append, brief]);

  const EFFORT_COLORS: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

  return (
    <div>
      <div className="backstage-section-header">
        <h2 className="backstage-section-title">Campaign Ideation</h2>
        <div className="signals-controls">
          <input
            className="triage-select"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Creative brief (optional)..."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
          />
          <button
            className="triage-btn-analyze"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate Concepts'}
          </button>
        </div>
      </div>

      {concepts.length > 0 && (
        <p className="triage-muted" style={{ marginBottom: 16 }}>
          {concepts.length} concept{concepts.length !== 1 ? 's' : ''} generated
        </p>
      )}

      <div className="triage-issues">
        {concepts.map((c, idx) => (
          <div key={idx} className="triage-issue">
            <div className="triage-issue-header">
              <span className="triage-issue-severity" style={{ background: EFFORT_COLORS[c.production.effort] || '#94a3b8' }}>
                {c.production.effort} effort
              </span>
              <span className="triage-issue-category">
                {c.production.estimatedClips} clip{c.production.estimatedClips !== 1 ? 's' : ''}
              </span>
              <span className="triage-auto-badge">{c.hook.type}</span>
            </div>
            <p className="triage-issue-desc" style={{ fontWeight: 700, fontSize: '1rem' }}>{c.name}</p>
            <p className="triage-issue-desc">{c.concept}</p>

            {/* Hook */}
            <div style={{ margin: '8px 0', padding: '8px 10px', background: 'rgba(255,107,44,0.06)', borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>Hook (first 3s)</p>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>{c.hook.description}</p>
            </div>

            {/* Inspired by */}
            <p className="triage-issue-fix">
              Inspired by: {c.inspiredBy.trendName} ({c.inspiredBy.platform}) — {c.inspiredBy.why}
            </p>

            {/* Platform variants */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
              {c.platformVariants.map((v) => (
                <div key={v.platform} className="triage-issue-time" style={{ padding: '4px 8px' }}>
                  <strong>{v.platform}</strong>: {v.format} · {v.soundStrategy}
                </div>
              ))}
            </div>

            {/* Assets */}
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
              <span style={{ color: 'var(--mint)' }}>Reuse: {c.production.existingAssets.join(', ') || 'none'}</span>
              {c.production.newAssets.length > 0 && (
                <span> · Generate: {c.production.newAssets.join(', ')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {concepts.length === 0 && !isLoading && (
        <div className="triage-empty">
          Enter a creative brief or hit "Generate Concepts" for AI-driven campaign ideas.
        </div>
      )}
    </div>
  );
}

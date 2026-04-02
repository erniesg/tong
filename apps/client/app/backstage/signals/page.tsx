'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';

const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';

/* ── Types ────────────────────────────────────────────────────────── */

interface KeywordSet {
  id: string;
  theme: string;
  description: string;
  keywords: { global: string[]; tiktok: string[]; instagram: string[]; xiaohongshu: string[] };
  priority: string;
  languages: string[];
  source: string;
  createdAt: string;
}

interface SearchResult {
  platform: string;
  keyword: string;
  type: string;
  title: string;
  author?: string;
  stats: { views?: number; likes?: number };
  scrapedAt: string;
}

/* ── Component ────────────────────────────────────────────────────── */

export default function SignalsPage() {
  const [keywordSets, setKeywordSets] = useState<KeywordSet[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'keywords' | 'results'>('keywords');
  const [topics, setTopics] = useState('');
  const processedCalls = useRef(new Set<string>());

  // Fetch existing keyword sets on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/signals/keywords`)
      .then((r) => r.json())
      .then((d) => setKeywordSets(d.sets || []))
      .catch(() => {});
  }, []);

  // AI keyword generation
  const { append, isLoading: aiLoading } = useChat({
    api: '/api/ai/signal-keywords',
    body: {
      mode: topics.trim() ? 'directed' : 'autonomous',
      topics: topics.trim() ? topics.split(',').map((t) => t.trim()) : undefined,
    },
    onToolCall({ toolCall }) {
      if (processedCalls.current.has(toolCall.toolCallId)) return;
      processedCalls.current.add(toolCall.toolCallId);

      if (toolCall.toolName === 'emit_keyword_set') {
        const args = toolCall.args as unknown as KeywordSet;
        // Save to server
        fetch(`${API_BASE}/api/v1/signals/keywords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...args, source: 'ai' }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.set) setKeywordSets((prev) => [d.set, ...prev]);
          })
          .catch(() => {});
      }
    },
  });

  const handleGenerate = useCallback(() => {
    processedCalls.current.clear();
    setGenerating(true);
    append({
      role: 'user',
      content: topics.trim()
        ? `Generate keyword sets focusing on: ${topics}`
        : 'Generate a comprehensive daily keyword set for signal scraping.',
    }).finally(() => setGenerating(false));
  }, [append, topics]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/api/v1/signals/keywords/${id}`, { method: 'DELETE' });
    setKeywordSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleRunScrape = useCallback(async () => {
    setLoading(true);
    setActiveTab('results');
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/targeted-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, []);

  const totalKeywords = keywordSets.reduce(
    (sum, s) => sum + (s.keywords?.global?.length || 0) + (s.keywords?.tiktok?.length || 0) + (s.keywords?.instagram?.length || 0) + (s.keywords?.xiaohongshu?.length || 0),
    0,
  );

  return (
    <div>
      <div className="backstage-section-header">
        <h2 className="backstage-section-title">Signals Intelligence</h2>
        <div className="signals-controls">
          <button
            className={`signals-platform-btn ${activeTab === 'keywords' ? 'signals-platform-active' : ''}`}
            onClick={() => setActiveTab('keywords')}
          >
            Keywords ({keywordSets.length} sets, {totalKeywords} terms)
          </button>
          <button
            className={`signals-platform-btn ${activeTab === 'results' ? 'signals-platform-active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Results ({searchResults.length})
          </button>
        </div>
      </div>

      {/* ── Keywords tab ──────────────────────────────────────── */}
      {activeTab === 'keywords' && (
        <>
          <div className="signals-controls" style={{ marginBottom: 16 }}>
            <input
              className="triage-select"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Topics to research (comma-separated, or leave blank for autonomous)..."
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
            />
            <button
              className="triage-btn-analyze"
              onClick={handleGenerate}
              disabled={aiLoading || generating}
            >
              {aiLoading || generating ? 'Generating...' : 'AI Generate Keywords'}
            </button>
            {keywordSets.length > 0 && (
              <button
                className="triage-btn-analyze"
                style={{ background: 'var(--mint)' }}
                onClick={handleRunScrape}
                disabled={loading}
              >
                {loading ? 'Scraping...' : 'Run Targeted Scrape'}
              </button>
            )}
          </div>

          {keywordSets.length === 0 && !aiLoading && (
            <div className="triage-empty">
              No keyword sets yet. Generate them with AI or add manually via the API.
            </div>
          )}

          <div className="triage-issues">
            {keywordSets.map((set) => (
              <div key={set.id} className="triage-issue">
                <div className="triage-issue-header">
                  <span className="triage-issue-severity" style={{
                    background: set.priority === 'high' ? '#ef4444' : set.priority === 'medium' ? '#f59e0b' : '#94a3b8'
                  }}>
                    {set.priority}
                  </span>
                  <span className="triage-issue-category">{set.theme}</span>
                  <span className="triage-auto-badge">{set.source || 'manual'}</span>
                  {set.languages?.map((l) => (
                    <span key={l} className="triage-issue-time">{l}</span>
                  ))}
                  <button
                    className="triage-action triage-action-dismiss"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => handleDelete(set.id)}
                  >
                    Delete
                  </button>
                </div>
                <p className="triage-issue-desc">{set.description}</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: '0.75rem' }}>
                  {set.keywords?.global?.length > 0 && (
                    <div>
                      <strong style={{ color: 'var(--muted)' }}>Global:</strong>{' '}
                      {set.keywords.global.slice(0, 8).join(', ')}
                      {set.keywords.global.length > 8 && ` +${set.keywords.global.length - 8}`}
                    </div>
                  )}
                  {set.keywords?.tiktok?.length > 0 && (
                    <div>
                      <strong style={{ color: 'var(--muted)' }}>TikTok:</strong>{' '}
                      {set.keywords.tiktok.slice(0, 6).join(', ')}
                      {set.keywords.tiktok.length > 6 && ` +${set.keywords.tiktok.length - 6}`}
                    </div>
                  )}
                  {set.keywords?.instagram?.length > 0 && (
                    <div>
                      <strong style={{ color: 'var(--muted)' }}>IG:</strong>{' '}
                      {set.keywords.instagram.slice(0, 6).join(', ')}
                    </div>
                  )}
                  {set.keywords?.xiaohongshu?.length > 0 && (
                    <div>
                      <strong style={{ color: 'var(--muted)' }}>XHS:</strong>{' '}
                      {set.keywords.xiaohongshu.slice(0, 6).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Results tab ───────────────────────────────────────── */}
      {activeTab === 'results' && (
        <>
          {loading && (
            <div className="triage-loading">
              <div className="triage-spinner" />
              <p>Running targeted scrape across platforms...</p>
            </div>
          )}

          {!loading && searchResults.length === 0 && (
            <div className="triage-empty">
              No results yet. Generate keywords first, then run a targeted scrape.
            </div>
          )}

          {!loading && searchResults.length > 0 && (
            <div className="triage-issues">
              {searchResults.map((r, i) => (
                <div key={i} className="triage-issue">
                  <div className="triage-issue-header">
                    <span className="triage-issue-time">{r.platform}</span>
                    <span className="triage-auto-badge">{r.keyword}</span>
                    <span className="triage-issue-category">{r.type}</span>
                    {r.stats?.views && (
                      <span className="triage-issue-time">{r.stats.views.toLocaleString()} views</span>
                    )}
                    {r.stats?.likes && (
                      <span className="triage-issue-time">{r.stats.likes.toLocaleString()} likes</span>
                    )}
                  </div>
                  <p className="triage-issue-desc">{r.title}</p>
                  {r.author && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                      @{r.author}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

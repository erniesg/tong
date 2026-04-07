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
  stats: { views?: number | string; likes?: number | string };
  videoPageUrl?: string;
  thumbnailUrl?: string;
  scrapedAt: string;
  _parsedViews?: number;
  _relevance?: { relevanceScore: number; reasoning: string; matchedKeywords: string[] };
}

interface Brief {
  productName: string;
  description: string;
  targetAudience?: string;
  campaignGoals?: string[];
  keywords: string[];
  platforms?: string[];
  contentAngles?: string[];
  languages?: string[];
}

/* ── Component ────────────────────────────────────────────────────── */

export default function SignalsPage() {
  const [keywordSets, setKeywordSets] = useState<KeywordSet[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'keywords' | 'results'>('pipeline');
  const [topics, setTopics] = useState('');
  const [briefText, setBriefText] = useState('');
  const [repoContext, setRepoContext] = useState(true);
  const [minViews, setMinViews] = useState(10000);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pipelineStep, setPipelineStep] = useState('');
  const [filterStats, setFilterStats] = useState<Record<string, number> | null>(null);
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

  // ── Pipeline handlers ────────────────────────────────────────────
  const handleExtractBrief = useCallback(async () => {
    setLoading(true);
    setPipelineStep('Extracting brief...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/extract-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: briefText || 'Tong - dating sim language learning game', repoContext }),
      });
      const data = await res.json();
      if (data.brief) setBrief(data.brief);
    } catch { /* noop */ } finally { setLoading(false); setPipelineStep(''); }
  }, [briefText, repoContext]);

  const handleGenerateKeywordsFromBrief = useCallback(async () => {
    setLoading(true);
    setPipelineStep('Generating keywords...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/generate-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: briefText || 'Tong - dating sim language learning game', repoContext }),
      });
      const data = await res.json();
      if (data.brief) setBrief(data.brief);
      if (data.keywordSets) setKeywordSets(data.keywordSets.map((s: KeywordSet, i: number) => ({ ...s, id: s.id || `gen-${i}` })));
    } catch { /* noop */ } finally { setLoading(false); setPipelineStep(''); }
  }, [briefText, repoContext]);

  const handleBrowserSearch = useCallback(async () => {
    setLoading(true);
    setPipelineStep('Searching platforms...');
    try {
      const keyword = searchKeyword || brief?.keywords?.slice(0, 3).join(' ') || 'language learning';
      const res = await fetch(`${API_BASE}/api/v1/signals/browser-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, platforms: ['tiktok', 'instagram'], limit: 10 }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
      setActiveTab('results');
    } catch { /* noop */ } finally { setLoading(false); setPipelineStep(''); }
  }, [searchKeyword, brief]);

  const handleFilter = useCallback(async () => {
    if (!searchResults.length) return;
    setLoading(true);
    setPipelineStep('Filtering & scoring...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: searchResults,
          brief: brief || { description: briefText || 'language learning game', keywords: [] },
          minViews,
          executionMode: 'mock', // use mock for now until live scoring is tested
        }),
      });
      const data = await res.json();
      setFilteredResults(data.ranked || []);
      setFilterStats(data.stats || null);
    } catch { /* noop */ } finally { setLoading(false); setPipelineStep(''); }
  }, [searchResults, brief, briefText, minViews]);

  const handleLoadCachedRun = useCallback(async () => {
    setLoading(true);
    setPipelineStep('Loading cached run...');
    try {
      const [kwRes, searchRes, filterRes] = await Promise.all([
        fetch('/signals-cache/01-keywords.json').then((r) => r.json()),
        fetch('/signals-cache/02-search-with-urls.json').then((r) => r.json()),
        fetch('/signals-cache/03-filtered.json').then((r) => r.json()),
      ]);
      if (kwRes.brief) setBrief(kwRes.brief);
      if (kwRes.keywordSets) setKeywordSets(kwRes.keywordSets.map((s: KeywordSet, i: number) => ({ ...s, id: s.id || `cached-${i}` })));
      setSearchResults(searchRes.results || []);
      setFilteredResults(filterRes.ranked || []);
      setFilterStats(filterRes.stats || null);
      setActiveTab('results');
    } catch { setPipelineStep('Cache not found'); } finally { setLoading(false); setPipelineStep(''); }
  }, []);

  const handleRunFullPipeline = useCallback(async () => {
    setLoading(true);
    setPipelineStep('Step 1/4: Extracting brief...');
    try {
      // Step 1+2: brief + keywords
      setPipelineStep('Step 1/4: Brief + Keywords...');
      const kwRes = await fetch(`${API_BASE}/api/v1/signals/generate-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: briefText || 'Tong - dating sim language learning game', repoContext }),
      });
      const kwData = await kwRes.json();
      if (kwData.brief) setBrief(kwData.brief);
      if (kwData.keywordSets) setKeywordSets(kwData.keywordSets.map((s: KeywordSet, i: number) => ({ ...s, id: s.id || `gen-${i}` })));

      // Step 3: search
      setPipelineStep('Step 2/4: Searching platforms...');
      const keyword = kwData.brief?.keywords?.slice(0, 3).join(' ') || 'language learning';
      const searchRes = await fetch(`${API_BASE}/api/v1/signals/browser-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, platforms: ['tiktok', 'instagram'], limit: 10 }),
      });
      const searchData = await searchRes.json();
      setSearchResults(searchData.results || []);

      // Step 4: filter
      setPipelineStep('Step 3/4: Filtering...');
      const filterRes = await fetch(`${API_BASE}/api/v1/signals/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: searchData.results || [],
          brief: kwData.brief || { description: 'language learning game', keywords: [] },
          minViews,
          executionMode: 'mock',
        }),
      });
      const filterData = await filterRes.json();
      setFilteredResults(filterData.ranked || []);
      setFilterStats(filterData.stats || null);

      setPipelineStep('Done');
      setActiveTab('results');
    } catch { setPipelineStep('Error'); } finally { setLoading(false); }
  }, [briefText, repoContext, minViews]);

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
            className={`signals-platform-btn ${activeTab === 'pipeline' ? 'signals-platform-active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            Pipeline
          </button>
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
            Results ({filteredResults.length || searchResults.length})
          </button>
        </div>
      </div>

      {/* ── Pipeline tab ─────────────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <>
          <div className="card" style={{ display: 'grid', gap: 12, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>1. Product Brief</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="triage-select"
                style={{ flex: 1, minWidth: 200 }}
                placeholder="Product description or campaign goal..."
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input type="checkbox" checked={repoContext} onChange={(e) => setRepoContext(e.target.checked)} />
                Repo context
              </label>
              <button className="triage-btn-analyze" onClick={handleExtractBrief} disabled={loading}>
                Extract Brief
              </button>
            </div>
            {brief && (
              <div style={{ fontSize: 13, display: 'grid', gap: 4, background: 'var(--card-bg)', borderRadius: 8, padding: 12 }}>
                <strong>{brief.productName}</strong>
                <p style={{ margin: 0, opacity: 0.8 }}>{brief.description}</p>
                {brief.targetAudience && <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Audience: {brief.targetAudience}</p>}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {brief.keywords?.slice(0, 12).map((k) => (
                    <span key={k} className="triage-auto-badge">{k}</span>
                  ))}
                  {(brief.keywords?.length || 0) > 12 && <span className="triage-issue-time">+{brief.keywords.length - 12}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'grid', gap: 12, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>2. Search + Filter</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="triage-select"
                style={{ flex: 1, minWidth: 150 }}
                placeholder="Search keyword (or auto from brief)..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                Min views:
                <input
                  type="number"
                  className="triage-select"
                  style={{ width: 80 }}
                  value={minViews}
                  onChange={(e) => setMinViews(Number(e.target.value))}
                />
              </label>
              <button className="triage-btn-analyze" onClick={handleBrowserSearch} disabled={loading}>
                Search
              </button>
              <button className="triage-btn-analyze" onClick={handleFilter} disabled={loading || !searchResults.length}>
                Filter & Score
              </button>
            </div>
            {filterStats && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {filterStats.total} total → {filterStats.afterEngagementFilter} after engagement filter → {filterStats.returned} returned
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'grid', gap: 12, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Full Pipeline</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="triage-btn-analyze"
                style={{ background: 'var(--mint)' }}
                onClick={handleRunFullPipeline}
                disabled={loading}
              >
                {loading ? pipelineStep : 'Run Full Pipeline'}
              </button>
              <button
                className="triage-btn-analyze"
                onClick={handleGenerateKeywordsFromBrief}
                disabled={loading}
              >
                Keywords Only
              </button>
              <button
                className="triage-btn-analyze"
                style={{ background: '#64748b' }}
                onClick={handleLoadCachedRun}
                disabled={loading}
              >
                Load Cached Run
              </button>
            </div>
          </div>
        </>
      )}

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

          {!loading && (filteredResults.length > 0 || searchResults.length > 0) && (
            <div className="triage-issues">
              {(filteredResults.length > 0 ? filteredResults : searchResults).map((r, i) => (
                <div key={i} className="triage-issue">
                  <div className="triage-issue-header">
                    <span className="triage-issue-time">{r.platform}</span>
                    {r._relevance && (
                      <span className="triage-issue-severity" style={{ background: r._relevance.relevanceScore > 70 ? '#22c55e' : r._relevance.relevanceScore > 40 ? '#f59e0b' : '#94a3b8' }}>
                        {r._relevance.relevanceScore}%
                      </span>
                    )}
                    <span className="triage-auto-badge">{r.keyword}</span>
                    {(r._parsedViews || r.stats?.views) && (
                      <span className="triage-issue-time">{(r._parsedViews || r.stats.views)?.toLocaleString()} views</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {r.thumbnailUrl && (
                      <img src={r.thumbnailUrl} alt="" style={{ width: 60, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p className="triage-issue-desc" style={{ margin: 0 }}>{r.title || '(no title)'}</p>
                      {r.author && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '2px 0 0' }}>@{r.author}</p>}
                      {r._relevance?.reasoning && <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: '4px 0 0' }}>{r._relevance.reasoning}</p>}
                      {r.videoPageUrl && (
                        <a href={r.videoPageUrl} target="_blank" rel="noopener" style={{ fontSize: '0.7rem', color: 'var(--mint)' }}>
                          View on {r.platform}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

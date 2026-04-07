'use client';

import { useCallback, useRef, useState } from 'react';
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
  thumbnailCached?: string;
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

interface FilterStats {
  total: number;
  afterEngagementFilter: number;
  dropped: number;
  returned: number;
}

interface DroppedResult {
  title?: string;
  platform?: string;
  author?: string;
  _parsedViews?: number;
  stats?: { views?: number | string };
  reason?: string;
}

type StepStatus = 'idle' | 'loading' | 'done' | 'error';

interface PipelineState {
  brief: StepStatus;
  keywords: StepStatus;
  search: StepStatus;
  filter: StepStatus;
  score: StepStatus;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function formatViews(n?: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n.replace(/[^0-9.]/g, '')) : n;
  if (!v || isNaN(v)) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function platformColor(platform: string): string {
  if (platform === 'tiktok') return '#000';
  if (platform === 'instagram') return '#833AB4';
  if (platform === 'xiaohongshu' || platform === 'xhs') return '#ff2442';
  return '#64748b';
}

function priorityColor(p: string): string {
  if (p === 'high') return '#ef4444';
  if (p === 'medium') return '#f59e0b';
  return '#94a3b8';
}

function relevanceColor(score: number): string {
  if (score > 70) return '#22c55e';
  if (score > 40) return '#f59e0b';
  return '#94a3b8';
}

/* ── Sub-components ───────────────────────────────────────────────── */

function StepHeader({
  number,
  title,
  status,
  summary,
}: {
  number: number;
  title: string;
  status: StepStatus;
  summary?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          background:
            status === 'done'
              ? 'var(--mint)'
              : status === 'loading'
              ? 'var(--accent)'
              : status === 'error'
              ? '#ef4444'
              : 'var(--line)',
          color: status === 'idle' ? 'var(--muted)' : '#fff',
        }}
      >
        {status === 'done' ? '✓' : status === 'loading' ? '…' : number}
      </span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {summary && (
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--muted)', opacity: 0.8 }}>
            {summary}
          </span>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--muted)',
          fontSize: 12,
          fontFamily: 'inherit',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? '▾' : '▸'}</span>
        {label}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function Chip({
  label,
  onClick,
  active,
  dim,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 9px',
        borderRadius: 12,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        background: active ? 'rgba(255,107,44,0.12)' : 'transparent',
        color: dim ? 'var(--muted)' : active ? 'var(--accent)' : 'var(--ink)',
        fontSize: 12,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        transition: 'all 0.12s',
        opacity: dim ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

function ThumbnailCard({ result }: { result: SearchResult }) {
  const views = result._parsedViews || (result.stats?.views as number) || 0;
  const score = result._relevance?.relevanceScore;

  return (
    <a
      href={result.videoPageUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.03)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Thumbnail area — 9:16 aspect */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '9/16',
          background: '#1e293b',
          overflow: 'hidden',
        }}
      >
        {(result.thumbnailCached || result.thumbnailUrl) ? (
          <img
            src={result.thumbnailCached || result.thumbnailUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const fallback = parent.querySelector('.thumb-fallback') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }
            }}
          />
        ) : null}

        {/* Fallback shown when no thumbnail or image fails */}
        <div
          className="thumb-fallback"
          style={{
            display: result.thumbnailUrl ? 'none' : 'flex',
            position: 'absolute',
            inset: 0,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: 'rgba(255,255,255,0.25)',
            fontSize: 11,
          }}
        >
          <span style={{ fontSize: 28 }}>▶</span>
          <span>No preview</span>
        </div>

        {/* Relevance score badge */}
        {score !== undefined && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              padding: '2px 7px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              background: relevanceColor(score),
              color: '#fff',
            }}
          >
            {score}
          </span>
        )}

        {/* Platform badge */}
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: 10,
            background: platformColor(result.platform),
            color: '#fff',
            textTransform: 'capitalize',
          }}
        >
          {result.platform}
        </span>

        {/* Views badge */}
        {views > 0 && (
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              padding: '2px 6px',
              borderRadius: 6,
              fontSize: 10,
              background: 'rgba(0,0,0,0.72)',
              color: '#fff',
            }}
          >
            {formatViews(views)}
          </span>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: '8px 10px 10px' }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {result.title || '(no title)'}
        </p>
        {result.author && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--muted)' }}>
            @{result.author}
          </p>
        )}
        {result._relevance?.reasoning &&
          result._relevance.reasoning !== '[mock] synthetic relevance score' && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 10,
                color: 'var(--muted)',
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {result._relevance.reasoning}
            </p>
          )}
      </div>
    </a>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */

export default function SignalsPage() {
  // Step data
  const [brief, setBriefData] = useState<Brief | null>(null);
  const [keywordSets, setKeywordSets] = useState<KeywordSet[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [droppedResults, setDroppedResults] = useState<DroppedResult[]>([]);
  const [filterStats, setFilterStats] = useState<FilterStats | null>(null);

  // Inputs
  const [briefText, setBriefText] = useState('');
  const [repoContext, setRepoContext] = useState(true);
  const [minViews, setMinViews] = useState(2000);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['tiktok', 'instagram']);
  const [activeSearchKeyword, setActiveSearchKeyword] = useState<string | null>(null);

  // UI state
  const [stepStatus, setStepStatus] = useState<PipelineState>({
    brief: 'idle',
    keywords: 'idle',
    search: 'idle',
    filter: 'idle',
    score: 'idle',
  });
  const [stepMessages, setStepMessages] = useState<Partial<Record<keyof PipelineState, string>>>({});
  const [expandedKeywordSets, setExpandedKeywordSets] = useState<Set<string>>(new Set());
  const [fullPipelineRunning, setFullPipelineRunning] = useState(false);
  const [topics, setTopics] = useState('');

  const processedCalls = useRef(new Set<string>());

  // ── AI keyword fallback via useChat ───────────────────────────────
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

  // ── Helper: update a single step status ───────────────────────────
  const setStatus = useCallback(
    (step: keyof PipelineState, status: StepStatus, message?: string) => {
      setStepStatus((prev) => ({ ...prev, [step]: status }));
      if (message !== undefined) {
        setStepMessages((prev) => ({ ...prev, [step]: message }));
      }
    },
    [],
  );

  // ── Step 1: Extract Brief ──────────────────────────────────────────
  const handleExtractBrief = useCallback(async () => {
    setStatus('brief', 'loading', 'Extracting brief...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/extract-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: briefText || 'Tong - dating sim language learning game',
          repoContext,
        }),
      });
      const data = await res.json();
      if (data.brief) {
        setBriefData(data.brief);
        setStatus('brief', 'done');
      } else {
        setStatus('brief', 'error', 'No brief returned');
      }
    } catch {
      setStatus('brief', 'error', 'Request failed');
    }
  }, [briefText, repoContext, setStatus]);

  // ── Step 2: Generate Keywords ──────────────────────────────────────
  const handleGenerateKeywords = useCallback(async () => {
    setStatus('keywords', 'loading', 'Generating keywords...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/generate-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: briefText || 'Tong - dating sim language learning game',
          repoContext,
        }),
      });
      const data = await res.json();
      if (data.brief) setBriefData(data.brief);
      if (data.keywordSets) {
        const sets = data.keywordSets.map((s: KeywordSet, i: number) => ({
          ...s,
          id: s.id || `gen-${i}`,
        }));
        setKeywordSets(sets);
        setStatus('keywords', 'done');
      } else {
        setStatus('keywords', 'error', 'No keyword sets returned');
      }
    } catch {
      setStatus('keywords', 'error', 'Request failed');
    }
  }, [briefText, repoContext, setStatus]);

  const handleAIGenerateKeywords = useCallback(() => {
    processedCalls.current.clear();
    append({
      role: 'user',
      content: topics.trim()
        ? `Generate keyword sets focusing on: ${topics}`
        : 'Generate a comprehensive daily keyword set for signal scraping.',
    });
  }, [append, topics]);

  // ── Step 3: Search ─────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (overrideKeyword?: string) => {
      const keyword =
        overrideKeyword ||
        activeSearchKeyword ||
        brief?.keywords?.slice(0, 3).join(' ') ||
        'language learning';
      setStatus('search', 'loading', `Searching "${keyword}"...`);
      try {
        const res = await fetch(`${API_BASE}/api/v1/signals/browser-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, platforms: selectedPlatforms, limit: 20 }),
        });
        const data = await res.json();
        const results: SearchResult[] = data.results || [];
        setSearchResults(results);
        setStatus(
          'search',
          'done',
          `${results.length} results across ${selectedPlatforms.join(', ')}`,
        );
      } catch {
        setStatus('search', 'error', 'Request failed');
      }
    },
    [activeSearchKeyword, brief, selectedPlatforms, setStatus],
  );

  // ── Step 4: Filter ─────────────────────────────────────────────────
  const handleFilter = useCallback(async () => {
    if (!searchResults.length) return;
    setStatus('filter', 'loading', 'Filtering by engagement...');
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: searchResults,
          brief: brief || { description: briefText || 'language learning game', keywords: [] },
          minViews,
          executionMode: 'live',
        }),
      });
      const data = await res.json();
      const ranked: SearchResult[] = data.ranked || [];
      setFilteredResults(ranked);

      const stats: FilterStats = data.stats || {
        total: searchResults.length,
        afterEngagementFilter: ranked.length,
        dropped: searchResults.length - ranked.length,
        returned: ranked.length,
      };
      setFilterStats(stats);

      // Compute dropped list from difference
      const rankedUrls = new Set(ranked.map((r) => r.videoPageUrl));
      const dropped = searchResults
        .filter((r) => !rankedUrls.has(r.videoPageUrl))
        .map((r) => ({
          title: r.title,
          platform: r.platform,
          author: r.author,
          _parsedViews: r._parsedViews,
          stats: r.stats,
          reason: `< ${minViews.toLocaleString()} views`,
        }));
      setDroppedResults(dropped);

      setStatus('filter', 'done');
    } catch {
      setStatus('filter', 'error', 'Request failed');
    }
  }, [searchResults, brief, briefText, minViews, setStatus]);

  // ── Step 5: Score is done inside filter in this API, so we surface the ranked output
  // The /filter endpoint with executionMode:'live' already scores — we just expose the output.
  const handleScore = useCallback(async () => {
    // Score = re-run filter with live mode to trigger relevance scoring
    await handleFilter();
    if (filteredResults.length > 0) {
      setStatus('score', 'done');
    }
  }, [handleFilter, filteredResults.length, setStatus]);

  // ── Load Cached Run ────────────────────────────────────────────────
  const handleLoadCachedRun = useCallback(async () => {
    setFullPipelineRunning(true);
    try {
      const [kwRes, searchRes, filterRes] = await Promise.all([
        fetch('/signals-cache/01-keywords.json').then((r) => r.json()),
        fetch('/signals-cache/02-search-with-urls.json').then((r) => r.json()),
        fetch('/signals-cache/03-filtered.json').then((r) => r.json()),
      ]);
      if (kwRes.brief) setBriefData(kwRes.brief);
      if (kwRes.keywordSets)
        setKeywordSets(
          kwRes.keywordSets.map((s: KeywordSet, i: number) => ({ ...s, id: s.id || `cached-${i}` })),
        );
      const rawResults: SearchResult[] = searchRes.results || [];
      const ranked: SearchResult[] = filterRes.ranked || [];
      setSearchResults(rawResults);
      setFilteredResults(ranked);
      const stats: FilterStats = filterRes.stats || {
        total: rawResults.length,
        afterEngagementFilter: ranked.length,
        dropped: rawResults.length - ranked.length,
        returned: ranked.length,
      };
      setFilterStats(stats);

      const rankedUrls = new Set(ranked.map((r: SearchResult) => r.videoPageUrl));
      setDroppedResults(
        rawResults
          .filter((r) => !rankedUrls.has(r.videoPageUrl))
          .map((r) => ({
            title: r.title,
            platform: r.platform,
            author: r.author,
            _parsedViews: r._parsedViews,
            stats: r.stats,
            reason: `< ${minViews.toLocaleString()} views`,
          })),
      );

      setStepStatus({ brief: 'done', keywords: 'done', search: 'done', filter: 'done', score: 'done' });
    } catch {
      // cache files not found — show error on brief step
      setStatus('brief', 'error', 'Cache files not found at /signals-cache/*.json');
    } finally {
      setFullPipelineRunning(false);
    }
  }, [minViews, setStatus]);

  // ── Run Full Pipeline ──────────────────────────────────────────────
  const handleRunFullPipeline = useCallback(async () => {
    setFullPipelineRunning(true);
    // Reset everything
    setBriefData(null);
    setKeywordSets([]);
    setSearchResults([]);
    setFilteredResults([]);
    setDroppedResults([]);
    setFilterStats(null);
    setStepStatus({ brief: 'idle', keywords: 'idle', search: 'idle', filter: 'idle', score: 'idle' });

    try {
      // Step 1+2: generate-keywords returns both brief and sets
      setStatus('brief', 'loading');
      setStatus('keywords', 'loading');
      const kwRes = await fetch(`${API_BASE}/api/v1/signals/generate-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: briefText || 'Tong - dating sim language learning game',
          repoContext,
        }),
      });
      const kwData = await kwRes.json();
      const resolvedBrief: Brief | null = kwData.brief || null;
      if (resolvedBrief) setBriefData(resolvedBrief);
      if (kwData.keywordSets) {
        setKeywordSets(
          kwData.keywordSets.map((s: KeywordSet, i: number) => ({ ...s, id: s.id || `gen-${i}` })),
        );
      }
      setStatus('brief', 'done');
      setStatus('keywords', 'done');

      // Step 3: search
      setStatus('search', 'loading');
      const keyword = resolvedBrief?.keywords?.slice(0, 3).join(' ') || 'language learning';
      const searchRes = await fetch(`${API_BASE}/api/v1/signals/browser-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, platforms: selectedPlatforms, limit: 20 }),
      });
      const searchData = await searchRes.json();
      const rawResults: SearchResult[] = searchData.results || [];
      setSearchResults(rawResults);
      setStatus('search', 'done', `${rawResults.length} raw results`);

      // Step 4+5: filter + score
      setStatus('filter', 'loading');
      setStatus('score', 'loading');
      const filterRes = await fetch(`${API_BASE}/api/v1/signals/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: rawResults,
          brief: resolvedBrief || { description: 'language learning game', keywords: [] },
          minViews,
          executionMode: 'live',
        }),
      });
      const filterData = await filterRes.json();
      const ranked: SearchResult[] = filterData.ranked || [];
      setFilteredResults(ranked);
      const stats: FilterStats = filterData.stats || {
        total: rawResults.length,
        afterEngagementFilter: ranked.length,
        dropped: rawResults.length - ranked.length,
        returned: ranked.length,
      };
      setFilterStats(stats);

      const rankedUrls = new Set(ranked.map((r: SearchResult) => r.videoPageUrl));
      setDroppedResults(
        rawResults
          .filter((r) => !rankedUrls.has(r.videoPageUrl))
          .map((r) => ({
            title: r.title,
            platform: r.platform,
            author: r.author,
            _parsedViews: r._parsedViews,
            stats: r.stats,
            reason: `< ${minViews.toLocaleString()} views`,
          })),
      );
      setStatus('filter', 'done');
      setStatus('score', 'done');
    } catch {
      // Mark any still-loading steps as errored
      setStepStatus((prev) => {
        const next = { ...prev };
        (Object.keys(next) as (keyof PipelineState)[]).forEach((k) => {
          if (next[k] === 'loading') next[k] = 'error';
        });
        return next;
      });
    } finally {
      setFullPipelineRunning(false);
    }
  }, [briefText, repoContext, selectedPlatforms, minViews, setStatus]);

  // ── Derived values ─────────────────────────────────────────────────
  const allKeywordChips = keywordSets.flatMap((s) => [
    ...(s.keywords?.global || []),
    ...(s.keywords?.tiktok || []),
    ...(s.keywords?.instagram || []),
    ...(s.keywords?.xiaohongshu || []),
  ]);
  const uniqueKeywordChips = [...new Set(allKeywordChips)].slice(0, 30);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const toggleKeywordSet = (id: string) => {
    setExpandedKeywordSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAnyLoading = fullPipelineRunning || Object.values(stepStatus).some((s) => s === 'loading');

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div>
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="backstage-section-header">
        <h2 className="backstage-section-title">Signals Intelligence</h2>
        <div className="signals-controls">
          <button
            className="triage-btn-analyze"
            style={{ background: 'var(--mint)', opacity: isAnyLoading ? 0.6 : 1 }}
            onClick={handleRunFullPipeline}
            disabled={isAnyLoading}
          >
            {fullPipelineRunning ? 'Running...' : 'Run Full Pipeline'}
          </button>
          <button
            className="signals-platform-btn"
            onClick={handleLoadCachedRun}
            disabled={isAnyLoading}
          >
            Load Cached Run
          </button>
        </div>
      </div>

      {/* ── Pipeline steps ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── STEP 1: Product Brief ──────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={1}
            title="Product Brief"
            status={stepStatus.brief}
            summary={brief ? brief.productName : undefined}
          />

          {/* Input */}
          <CollapsibleSection label="Input" defaultOpen={!brief}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                className="triage-select"
                style={{ resize: 'vertical', minHeight: 72, fontSize: 13, width: '100%' }}
                placeholder="Product description or campaign goal (leave blank to use repo context)..."
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={repoContext}
                  onChange={(e) => setRepoContext(e.target.checked)}
                />
                Include repo context (CLAUDE.md, package.json)
              </label>
            </div>
          </CollapsibleSection>

          {/* Output */}
          {brief && (
            <CollapsibleSection label={`Output — extracted brief`} defaultOpen>
              <div
                style={{
                  fontSize: 13,
                  display: 'grid',
                  gap: 6,
                  background: 'rgba(255,107,44,0.04)',
                  borderRadius: 8,
                  padding: 12,
                  border: '1px solid rgba(255,107,44,0.12)',
                }}
              >
                <strong style={{ fontSize: 15 }}>{brief.productName}</strong>
                {brief.description && (
                  <p style={{ margin: 0, color: 'var(--muted)' }}>{brief.description}</p>
                )}
                {brief.targetAudience && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                    Audience: {brief.targetAudience}
                  </p>
                )}
                {brief.campaignGoals && brief.campaignGoals.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Goals: {brief.campaignGoals.join(' · ')}
                  </div>
                )}
                {brief.keywords && brief.keywords.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Seed keywords
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {brief.keywords.map((k) => (
                        <Chip key={k} label={k} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {stepStatus.brief === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div className="triage-spinner" style={{ width: 18, height: 18 }} />
              {stepMessages.brief || 'Extracting brief...'}
            </div>
          )}
          {stepStatus.brief === 'error' && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{stepMessages.brief}</p>
          )}

          <button
            className="triage-btn-analyze"
            style={{ alignSelf: 'flex-start' }}
            onClick={handleExtractBrief}
            disabled={isAnyLoading}
          >
            Extract Brief
          </button>
        </div>

        {/* ── STEP 2: Keywords ───────────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={2}
            title="Keywords"
            status={stepStatus.keywords}
            summary={keywordSets.length > 0 ? `${keywordSets.length} sets` : undefined}
          />

          {/* Input */}
          <CollapsibleSection label="Input" defaultOpen={keywordSets.length === 0}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {brief ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Using brief: <strong style={{ color: 'var(--ink)' }}>{brief.productName}</strong>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  Run Step 1 first to use a brief, or keywords will be generated from product text directly.
                </p>
              )}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  AI fallback — directed topics
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="triage-select"
                    style={{ flex: 1, fontSize: 13 }}
                    placeholder="Comma-separated topics (optional)..."
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAIGenerateKeywords(); }}
                  />
                  <button
                    className="signals-platform-btn"
                    onClick={handleAIGenerateKeywords}
                    disabled={isAnyLoading || aiLoading}
                  >
                    {aiLoading ? 'AI generating...' : 'AI Generate'}
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Output — keyword set cards */}
          {keywordSets.length > 0 && (
            <CollapsibleSection label={`Output — ${keywordSets.length} keyword set${keywordSets.length !== 1 ? 's' : ''}`} defaultOpen>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {keywordSets.map((set) => {
                  const isExpanded = expandedKeywordSets.has(set.id);
                  const total =
                    (set.keywords?.global?.length || 0) +
                    (set.keywords?.tiktok?.length || 0) +
                    (set.keywords?.instagram?.length || 0) +
                    (set.keywords?.xiaohongshu?.length || 0);
                  return (
                    <div
                      key={set.id}
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => toggleKeywordSet(set.id)}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <span
                          className="triage-issue-severity"
                          style={{ background: priorityColor(set.priority) }}
                        >
                          {set.priority}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{set.theme}</span>
                        <span className="triage-auto-badge">{total} keywords</span>
                        {set.source && (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{set.source}</span>
                        )}
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--line)' }}>
                          {set.description && (
                            <p style={{ margin: '8px 0', fontSize: 12, color: 'var(--muted)' }}>
                              {set.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                            {[
                              { label: 'Global', chips: set.keywords?.global },
                              { label: 'TikTok', chips: set.keywords?.tiktok },
                              { label: 'Instagram', chips: set.keywords?.instagram },
                              { label: 'XHS', chips: set.keywords?.xiaohongshu },
                            ]
                              .filter((g) => g.chips?.length)
                              .map((group) => (
                                <div key={group.label}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: 'var(--muted)',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      marginRight: 6,
                                    }}
                                  >
                                    {group.label}
                                  </span>
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      flexWrap: 'wrap',
                                      gap: 4,
                                      marginTop: 4,
                                    }}
                                  >
                                    {group.chips!.map((k) => (
                                      <Chip key={k} label={k} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {stepStatus.keywords === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div className="triage-spinner" style={{ width: 18, height: 18 }} />
              {stepMessages.keywords || 'Generating keyword sets...'}
            </div>
          )}
          {stepStatus.keywords === 'error' && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{stepMessages.keywords}</p>
          )}

          <button
            className="triage-btn-analyze"
            style={{ alignSelf: 'flex-start' }}
            onClick={handleGenerateKeywords}
            disabled={isAnyLoading}
          >
            Generate Keywords
          </button>
        </div>

        {/* ── STEP 3: Search ─────────────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={3}
            title="Search"
            status={stepStatus.search}
            summary={
              stepStatus.search === 'done'
                ? `${searchResults.length} raw results`
                : stepMessages.search
            }
          />

          {/* Input */}
          <CollapsibleSection label="Input" defaultOpen={stepStatus.search === 'idle'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Platform toggles */}
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Platforms
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['tiktok', 'instagram', 'xiaohongshu'].map((p) => (
                    <button
                      key={p}
                      className={`signals-platform-btn ${selectedPlatforms.includes(p) ? 'signals-platform-active' : ''}`}
                      onClick={() => togglePlatform(p)}
                    >
                      {p === 'xiaohongshu' ? 'XHS' : p === 'instagram' ? 'IG' : 'TikTok'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyword chips — click to search */}
              {uniqueKeywordChips.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Click a keyword to search with it
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {uniqueKeywordChips.map((k) => (
                      <Chip
                        key={k}
                        label={k}
                        active={activeSearchKeyword === k}
                        onClick={() => {
                          setActiveSearchKeyword(k);
                          handleSearch(k);
                        }}
                      />
                    ))}
                    {allKeywordChips.length > 30 && (
                      <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
                        +{allKeywordChips.length - 30} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {keywordSets.length === 0 && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  Run Step 2 to populate keyword chips, or search will use brief keywords.
                </p>
              )}
            </div>
          </CollapsibleSection>

          {/* Output — raw result counts */}
          {searchResults.length > 0 && stepStatus.search === 'done' && (
            <CollapsibleSection label={`Output — ${searchResults.length} raw results`} defaultOpen>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(['tiktok', 'instagram', 'xiaohongshu'] as const).map((p) => {
                  const count = searchResults.filter((r) => r.platform === p).length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={p}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                    >
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          background: platformColor(p),
                          color: '#fff',
                          textTransform: 'capitalize',
                          minWidth: 72,
                          textAlign: 'center',
                        }}
                      >
                        {p === 'xiaohongshu' ? 'XHS' : p === 'instagram' ? 'Instagram' : 'TikTok'}
                      </span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                      <span style={{ color: 'var(--muted)' }}>results</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {stepStatus.search === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div className="triage-spinner" style={{ width: 18, height: 18 }} />
              {stepMessages.search || 'Searching platforms...'}
            </div>
          )}
          {stepStatus.search === 'error' && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{stepMessages.search}</p>
          )}

          <button
            className="triage-btn-analyze"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => handleSearch()}
            disabled={isAnyLoading}
          >
            Search Platforms
          </button>
        </div>

        {/* ── STEP 4: Filter ─────────────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={4}
            title="Filter by Engagement"
            status={stepStatus.filter}
            summary={
              filterStats
                ? `${filterStats.total} → ${filterStats.returned} passed`
                : undefined
            }
          />

          {/* Input */}
          <CollapsibleSection label="Input" defaultOpen={stepStatus.filter === 'idle'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                Min views threshold:
                <input
                  type="number"
                  className="triage-select"
                  style={{ width: 90 }}
                  value={minViews}
                  onChange={(e) => setMinViews(Number(e.target.value))}
                />
              </label>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {searchResults.length > 0
                  ? `${searchResults.length} raw results going in`
                  : 'No search results yet — run Step 3 first'}
              </span>
            </div>
          </CollapsibleSection>

          {/* Output — stats + dropped list */}
          {filterStats && (
            <CollapsibleSection label="Output — filter stats" defaultOpen>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Funnel summary */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '8px 12px',
                    background: 'rgba(15,118,110,0.06)',
                    borderRadius: 8,
                    border: '1px solid rgba(15,118,110,0.15)',
                  }}
                >
                  <span>{filterStats.total} raw</span>
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>→</span>
                  <span style={{ color: '#ef4444' }}>
                    {filterStats.total - filterStats.afterEngagementFilter} dropped (&lt;{minViews.toLocaleString()} views)
                  </span>
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>→</span>
                  <span style={{ color: 'var(--mint)' }}>{filterStats.returned} passed</span>
                </div>

                {/* Dropped results collapsible */}
                {droppedResults.length > 0 && (
                  <CollapsibleSection
                    label={`What was dropped (${droppedResults.length})`}
                    defaultOpen={false}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {droppedResults.map((r, i) => {
                        const views = r._parsedViews || (r.stats?.views as number) || 0;
                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              padding: '4px 0',
                              borderBottom: i < droppedResults.length - 1 ? '1px solid var(--line)' : 'none',
                              opacity: 0.7,
                            }}
                          >
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                background: platformColor(r.platform || ''),
                                color: '#fff',
                                textTransform: 'capitalize',
                                flexShrink: 0,
                              }}
                            >
                              {r.platform}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {r.title || '(no title)'}
                            </span>
                            {r.author && (
                              <span style={{ color: 'var(--muted)', flexShrink: 0 }}>
                                @{r.author}
                              </span>
                            )}
                            <span style={{ color: '#ef4444', flexShrink: 0 }}>
                              {formatViews(views)} views
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            </CollapsibleSection>
          )}

          {stepStatus.filter === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div className="triage-spinner" style={{ width: 18, height: 18 }} />
              {stepMessages.filter || 'Filtering results...'}
            </div>
          )}
          {stepStatus.filter === 'error' && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{stepMessages.filter}</p>
          )}

          <button
            className="triage-btn-analyze"
            style={{ alignSelf: 'flex-start' }}
            onClick={handleFilter}
            disabled={isAnyLoading || searchResults.length === 0}
          >
            Filter by Engagement
          </button>
        </div>

        {/* ── STEP 5: Score & Rank ───────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={5}
            title="Score & Rank"
            status={stepStatus.score}
            summary={
              filteredResults.length > 0
                ? `${filteredResults.length} ranked results`
                : undefined
            }
          />

          {/* Input */}
          <CollapsibleSection label="Input" defaultOpen={stepStatus.score === 'idle'}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {filteredResults.length > 0 ? (
                <>
                  {filteredResults.length} engagement-filtered results + brief relevance scoring
                </>
              ) : filterStats ? (
                <>
                  {filterStats.returned} results from filter step · using brief for relevance
                </>
              ) : (
                'Run Steps 3 & 4 first to get results to score.'
              )}
            </div>
          </CollapsibleSection>

          {/* Output — thumbnail gallery */}
          {filteredResults.length > 0 && (
            <CollapsibleSection
              label={`Output — ${filteredResults.length} scored results`}
              defaultOpen
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 10,
                }}
              >
                {filteredResults.map((r, i) => (
                  <ThumbnailCard key={i} result={r} />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {stepStatus.score === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div className="triage-spinner" style={{ width: 18, height: 18 }} />
              {stepMessages.score || 'Scoring results...'}
            </div>
          )}
          {stepStatus.score === 'error' && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{stepMessages.score}</p>
          )}

          {filteredResults.length === 0 && stepStatus.score !== 'loading' && stepStatus.score !== 'error' && (
            <div className="triage-empty" style={{ padding: '20px 0' }}>
              No scored results yet. Run Step 4 first (filtering also triggers scoring).
            </div>
          )}

          <button
            className="triage-btn-analyze"
            style={{ alignSelf: 'flex-start' }}
            onClick={handleScore}
            disabled={isAnyLoading || searchResults.length === 0}
          >
            Score Relevance
          </button>
        </div>

      </div>
    </div>
  );
}

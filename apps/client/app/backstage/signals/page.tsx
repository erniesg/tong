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

interface FingerprintScene {
  start: string;
  end: string;
  type: string;
  audio?: string;
  automationDifficulty?: string;
  description: string;
}

interface FingerprintResult {
  hookTechnique?: string;
  contentFormat?: string;
  automatabilityScore?: number;
  audioLanguage?: string;
  hasVoiceover?: string;
  hasTrendingSound?: string;
  transcript?: string;
  totalDurationEstimate?: number;
  scenes?: FingerprintScene[];
}

interface Fingerprint {
  source: {
    id?: string;
    platform?: string;
    author?: string;
    title?: string;
    caption?: string;
    views?: string | number;
    likes?: string | number;
    videoUrl?: string;
    thumbnailUrl?: string;
    relevanceScore?: number;
  };
  preset?: string;
  analysisId?: string;
  model?: string;
  tokensUsed?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  result: FingerprintResult | null;
  error?: string;
  analyzedAt?: string;
}

interface FingerprintData {
  preset: string;
  model: string;
  analyzedAt: string;
  stats: { total: number; successful: number; failed: number; totalTokens: number };
  fingerprints: Fingerprint[];
}

interface DownloadedVideo {
  filePath: string;
  filename: string;
  size: number;
  duration?: number;
  title?: string;
  url: string;
  platform?: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  sourceStats?: { views?: number | string; likes?: number | string };
}

interface DownloadResult {
  downloads: DownloadedVideo[];
  errors: { error: string; url: string; platform?: string }[];
  total: number;
  skipped: number;
}

interface ClusterScene {
  video_id: string;
  scene_idx: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  keyframe_path: string;
  audio_path: string;
  transcript: string;
  thumbnail?: string;
  umap?: Record<string, [number, number]>;
  clusters?: Record<string, number>;
}

interface ClusterInfo {
  n_clusters: number;
  n_noise: number;
  labels: number[];
}

interface SceneClusterData {
  total_scenes: number;
  clustering: Record<string, ClusterInfo>;
  scenes: ClusterScene[];
}

type StepStatus = 'idle' | 'loading' | 'done' | 'error';

interface PipelineState {
  brief: StepStatus;
  keywords: StepStatus;
  search: StepStatus;
  filter: StepStatus;
  score: StepStatus;
  download: StepStatus;
  fingerprint: StepStatus;
  sceneClusters: StepStatus;
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

function automationColor(difficulty?: string): string {
  if (difficulty === 'trivial') return '#22c55e';
  if (difficulty === 'moderate') return '#f59e0b';
  if (difficulty === 'hard') return '#ef4444';
  return '#94a3b8';
}

function sceneTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    talking_head: 'Talking Head',
    text_overlay: 'Text Overlay',
    product_shot: 'Product Shot',
    data_viz: 'Data Viz',
    b_roll: 'B-Roll',
    screen_recording: 'Screen Rec',
    split_screen: 'Split Screen',
    transition: 'Transition',
    outro_cta: 'Outro/CTA',
  };
  return labels[type] || type;
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
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
  const [fingerprintData, setFingerprintData] = useState<FingerprintData | null>(null);
  const [expandedFingerprints, setExpandedFingerprints] = useState<Set<number>>(new Set());
  const [sceneClusterData, setSceneClusterData] = useState<SceneClusterData | null>(null);
  const [activeClusterTab, setActiveClusterTab] = useState('clip');

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
    download: 'idle',
    fingerprint: 'idle',
    sceneClusters: 'idle',
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
  const handleScore = useCallback(async () => {
    await handleFilter();
    if (filteredResults.length > 0) {
      setStatus('score', 'done');
    }

  // ── Step 6: Download videos ─────────────────────────────────────────
  }, [handleFilter, filteredResults.length, setStatus]);

  const handleDownload = useCallback(async () => {
    if (!filteredResults.length) return;
    setStatus('download', 'loading', `Downloading ${filteredResults.length} videos...`);
    try {
      const res = await fetch(`${API_BASE}/api/v1/signals/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: filteredResults,
          concurrency: 2,
          timeout: 120000,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDownloadResult(data as DownloadResult);
        setStatus('download', 'done', `${data.downloads?.length || 0} downloaded, ${data.errors?.length || 0} failed`);
      } else {
        setStatus('download', 'error', data.error || 'Download failed');
      }
    } catch {
      setStatus('download', 'error', 'Request failed');
    }
  }, [filteredResults, setStatus]);

  // ── Load Cached Run ────────────────────────────────────────────────
  const handleLoadCachedRun = useCallback(async () => {
    setFullPipelineRunning(true);
    try {
      const [kwRes, searchRes, filterRes, fpRes, scRes] = await Promise.all([
        fetch('/signals-cache/01-keywords.json').then((r) => r.json()),
        fetch('/signals-cache/02-search-with-urls.json').then((r) => r.json()),
        fetch('/signals-cache/03-filtered.json').then((r) => r.json()),
        fetch('/signals-cache/04-fingerprints.json').then((r) => r.json()).catch(() => null),
        fetch('/signals-cache/05-scene-clusters.json').then((r) => r.json()).catch(() => null),
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

      if (fpRes && fpRes.fingerprints) setFingerprintData(fpRes);
      if (scRes && scRes.scenes) setSceneClusterData(scRes);

      setStepStatus({
        brief: 'done', keywords: 'done', search: 'done', filter: 'done', score: 'done',
        download: fpRes?.fingerprints ? 'done' : 'idle',
        fingerprint: fpRes?.fingerprints ? 'done' : 'idle',
        sceneClusters: scRes?.scenes ? 'done' : 'idle',
      });
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
    setStepStatus({ brief: 'idle', keywords: 'idle', search: 'idle', filter: 'idle', score: 'idle', download: 'idle', fingerprint: 'idle', sceneClusters: 'idle' });

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['tiktok', 'instagram', 'xiaohongshu'] as const).map((p) => {
                  const platformResults = searchResults.filter((r) => r.platform === p);
                  if (platformResults.length === 0) return null;
                  const label = p === 'xiaohongshu' ? 'XHS' : p === 'instagram' ? 'Instagram' : 'TikTok';
                  return (
                    <CollapsibleSection
                      key={p}
                      label={`${label} — ${platformResults.length} results`}
                      defaultOpen={platformResults.length > 0 && platformResults.length <= 20}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {platformResults.map((r, ri) => {
                          const views = r._parsedViews || (typeof r.stats?.views === 'number' ? r.stats.views : 0);
                          return (
                            <a
                              key={ri}
                              href={r.videoPageUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 1fr auto auto',
                                gap: 8,
                                alignItems: 'center',
                                padding: '4px 6px',
                                borderRadius: 6,
                                fontSize: 12,
                                textDecoration: 'none',
                                color: 'inherit',
                                background: ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                              }}
                            >
                              {(r.thumbnailCached || r.thumbnailUrl) ? (
                                <img
                                  src={r.thumbnailCached || r.thumbnailUrl}
                                  alt=""
                                  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--line)', borderRadius: 4, fontSize: 16, color: 'var(--muted)' }}>
                                  {r.type === 'reel' || r.type === 'video' ? '▶' : '◻'}
                                </span>
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.title || '(no title)'}
                              </span>
                              {r.author && (
                                <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: 11 }}>
                                  @{r.author}
                                </span>
                              )}
                              <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: 11, minWidth: 50, textAlign: 'right' }}>
                                {views > 0 ? formatViews(views) : r.stats?.likes ? `${formatViews(r.stats.likes)} likes` : '—'}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    </CollapsibleSection>
                  );
                })}
                {/* Provider/scraper breakdown */}
                {(() => {
                  const providers = new Set(searchResults.map((r) => (r as SearchResult & { _provider?: string; _scraper?: string })._provider || (r as SearchResult & { _scraper?: string })._scraper || 'puppeteer'));
                  return (
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                      Scrapers: {[...providers].join(', ')}
                    </div>
                  );
                })()}
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
                  <span style={{ color: 'var(--mint)' }}>{filterStats.afterEngagementFilter} passed</span>
                  {filterStats.returned < filterStats.afterEngagementFilter && (
                    <>
                      <span style={{ color: 'var(--muted)', fontWeight: 400 }}>→</span>
                      <span>{filterStats.returned} returned (top N)</span>
                    </>
                  )}
                </div>

                {/* Dropped results collapsible */}
                {droppedResults.length > 0 && (
                  <CollapsibleSection
                    label={`What was dropped (${filterStats ? filterStats.total - filterStats.afterEngagementFilter : droppedResults.length})`}
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

        {/* ── STEP 6: Download ────────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={6}
            title="Download Videos"
            status={stepStatus.download}
            summary={
              downloadResult
                ? `${downloadResult.downloads.length} downloaded, ${downloadResult.errors.length} failed`
                : undefined
            }
          />

          <CollapsibleSection label="Input" defaultOpen={!downloadResult}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {filteredResults.length > 0
                ? `${filteredResults.length} ranked videos ready for download via yt-dlp.`
                : 'Run Steps 3-5 first to get ranked videos.'}
            </div>
          </CollapsibleSection>

          {downloadResult && downloadResult.downloads.length > 0 && (
            <CollapsibleSection
              label={`Output — ${downloadResult.downloads.length} videos (${downloadResult.errors.length} errors)`}
              defaultOpen
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {downloadResult.downloads.map((dl, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto auto',
                      gap: 8,
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dl.sourceTitle || dl.title || dl.filename}
                    </span>
                    {dl.platform && (
                      <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: platformColor(dl.platform), color: '#fff' }}>
                        {dl.platform}
                      </span>
                    )}
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                      {(dl.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {dl.duration && (
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                        {Math.round(dl.duration)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {downloadResult.errors.length > 0 && (
                <CollapsibleSection label={`${downloadResult.errors.length} errors`}>
                  <div style={{ fontSize: 11, color: '#ef4444' }}>
                    {downloadResult.errors.map((e, i) => (
                      <div key={i}>{e.platform}: {e.error?.slice(0, 80)}</div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </CollapsibleSection>
          )}

          {stepStatus.download === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div className="triage-spinner" style={{ width: 18, height: 18 }} />
              {stepMessages.download || 'Downloading videos...'}
            </div>
          )}
          {stepStatus.download === 'error' && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>{stepMessages.download}</p>
          )}

          <button
            className="triage-btn-analyze"
            style={{ alignSelf: 'flex-start' }}
            onClick={handleDownload}
            disabled={isAnyLoading || filteredResults.length === 0}
          >
            Download Videos
          </button>
        </div>

        {/* ── STEP 7: Fingerprints ──────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={7}
            title="Scene Fingerprints"
            status={stepStatus.fingerprint}
            summary={
              fingerprintData
                ? `${fingerprintData.stats.successful}/${fingerprintData.stats.total} videos analyzed`
                : undefined
            }
          />

          {/* Input */}
          <CollapsibleSection label="Input" defaultOpen={!fingerprintData}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {filteredResults.length > 0 ? (
                <>
                  {filteredResults.length} ranked videos available for fingerprinting.
                  Run <code style={{ fontSize: 11, background: 'var(--line)', padding: '1px 4px', borderRadius: 3 }}>
                    node scripts/signals-pipeline.mjs fingerprint --results-from ./03-filtered.json --top 5
                  </code> to generate, then load cached run.
                </>
              ) : (
                'Run Steps 3-5 first to get ranked videos to fingerprint.'
              )}
            </div>
          </CollapsibleSection>

          {/* Output — fingerprint cards with scene timelines */}
          {fingerprintData && fingerprintData.fingerprints.length > 0 && (
            <CollapsibleSection
              label={`Output — ${fingerprintData.stats.successful} fingerprints (${fingerprintData.stats.totalTokens.toLocaleString()} tokens)`}
              defaultOpen
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fingerprintData.fingerprints.map((fp, idx) => {
                  const isExpanded = expandedFingerprints.has(idx);
                  const r = fp.result;
                  const source = fp.source;

                  return (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header row */}
                      <button
                        onClick={() =>
                          setExpandedFingerprints((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            return next;
                          })
                        }
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
                        {source?.platform && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 6,
                              fontSize: 10,
                              background: platformColor(source.platform),
                              color: '#fff',
                              textTransform: 'capitalize',
                              flexShrink: 0,
                            }}
                          >
                            {source.platform}
                          </span>
                        )}
                        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {source?.title || source?.author ? `@${source.author}` : `Video ${idx + 1}`}
                        </span>
                        {r ? (
                          <>
                            <span className="triage-auto-badge" style={{ background: automationColor(r.automatabilityScore && r.automatabilityScore > 70 ? 'trivial' : r.automatabilityScore && r.automatabilityScore > 40 ? 'moderate' : 'hard'), color: '#fff' }}>
                              {r.automatabilityScore ?? '?'}/100
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                              {r.scenes?.length ?? 0} scenes
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: '#ef4444', flexShrink: 0 }}>
                            {fp.error || 'failed'}
                          </span>
                        )}
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && r && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--line)' }}>
                          {/* Meta row */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                              gap: 8,
                              marginTop: 10,
                              fontSize: 12,
                            }}
                          >
                            {r.hookTechnique && (
                              <div>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hook</span>
                                {r.hookTechnique}
                              </div>
                            )}
                            {r.contentFormat && (
                              <div>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Format</span>
                                {r.contentFormat}
                              </div>
                            )}
                            {r.audioLanguage && (
                              <div>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Language</span>
                                {r.audioLanguage}
                              </div>
                            )}
                            {r.totalDurationEstimate && (
                              <div>
                                <span style={{ color: 'var(--muted)', display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</span>
                                ~{r.totalDurationEstimate}s
                              </div>
                            )}
                          </div>

                          {/* Transcript */}
                          {r.transcript && (
                            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                              {r.transcript.slice(0, 200)}{r.transcript.length > 200 ? '...' : ''}
                            </div>
                          )}

                          {/* Scene timeline */}
                          {r.scenes && r.scenes.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                                Scene Timeline
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                                {r.scenes.map((scene, si) => (
                                  <div
                                    key={si}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '60px 100px 80px 1fr',
                                      gap: 8,
                                      alignItems: 'center',
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      background: si % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                      fontSize: 12,
                                    }}
                                  >
                                    <span style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: 11 }}>
                                      {scene.start}–{scene.end}
                                    </span>
                                    <span>
                                      <Chip label={sceneTypeLabel(scene.type)} />
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: automationColor(scene.automationDifficulty),
                                      }}
                                    >
                                      {scene.automationDifficulty || '—'}
                                      {scene.audio && (
                                        <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>
                                          {scene.audio}
                                        </span>
                                      )}
                                    </span>
                                    <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {scene.description}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Token usage */}
                          {fp.tokensUsed && (
                            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
                              {fp.model} · {fp.tokensUsed.totalTokens?.toLocaleString()} tokens
                              {fp.analyzedAt && ` · ${new Date(fp.analyzedAt).toLocaleString()}`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {stepStatus.fingerprint === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
              <div className="triage-spinner" style={{ width: 18, height: 18 }} />
              Analyzing videos...
            </div>
          )}
          {stepStatus.fingerprint === 'error' && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: 12 }}>Failed to load fingerprints</p>
          )}

          {!fingerprintData && stepStatus.fingerprint !== 'loading' && (
            <div className="triage-empty" style={{ padding: '20px 0' }}>
              No fingerprints yet. Run the CLI fingerprint command, then Load Cached Run.
            </div>
          )}
        </div>

        {/* ── STEP 8: Scene Clusters ────────────────────────────── */}
        <div className="card" style={{ display: 'grid', gap: 14 }}>
          <StepHeader
            number={8}
            title="Scene Clusters"
            status={stepStatus.sceneClusters}
            summary={
              sceneClusterData
                ? `${sceneClusterData.total_scenes} scenes, ${Object.keys(sceneClusterData.clustering).length} embeddings`
                : undefined
            }
          />

          {/* Input */}
          <CollapsibleSection label="Input" defaultOpen={!sceneClusterData}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Unsupervised scene clustering via embeddings (CLIP, VideoMAE, Whisper, audio).
              Run <code style={{ fontSize: 11, background: 'var(--line)', padding: '1px 4px', borderRadius: 3 }}>
                python3 scripts/embed-scenes.py
              </code> to generate, then Load Cached Run.
            </div>
          </CollapsibleSection>

          {/* Output */}
          {sceneClusterData && sceneClusterData.scenes.length > 0 && (() => {
            const clusterKeys = Object.keys(sceneClusterData.clustering);
            const activeInfo = sceneClusterData.clustering[activeClusterTab];
            const scenes = sceneClusterData.scenes;

            // Group scenes by cluster for the active tab
            const clusterGroups: Record<number, ClusterScene[]> = {};
            scenes.forEach((s) => {
              const label = s.clusters?.[activeClusterTab] ?? -1;
              if (!clusterGroups[label]) clusterGroups[label] = [];
              clusterGroups[label].push(s);
            });

            // UMAP bounds
            const umapPoints = scenes.map((s) => s.umap?.[activeClusterTab] || [0, 0]);
            const xs = umapPoints.map((p) => p[0]);
            const ys = umapPoints.map((p) => p[1]);
            const xMin = Math.min(...xs), xMax = Math.max(...xs);
            const yMin = Math.min(...ys), yMax = Math.max(...ys);
            const xRange = xMax - xMin || 1;
            const yRange = yMax - yMin || 1;

            const CLUSTER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'];

            return (
              <CollapsibleSection
                label={`Output — ${scenes.length} scenes across ${clusterKeys.length} embedding types`}
                defaultOpen
              >
                {/* Embedding type tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {clusterKeys.map((key) => {
                    const info = sceneClusterData.clustering[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveClusterTab(key)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 8,
                          border: `1px solid ${activeClusterTab === key ? 'var(--accent)' : 'var(--line)'}`,
                          background: activeClusterTab === key ? 'rgba(255,107,44,0.12)' : 'transparent',
                          color: activeClusterTab === key ? 'var(--accent)' : 'var(--muted)',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {key} ({info.n_clusters}c / {info.n_noise}n)
                      </button>
                    );
                  })}
                </div>

                {/* UMAP scatter with keyframe thumbnails */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    background: '#0f172a',
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: 16,
                  }}
                >
                  {scenes.map((s, i) => {
                    const [ux, uy] = s.umap?.[activeClusterTab] || [0, 0];
                    const left = ((ux - xMin) / xRange) * 90 + 5;
                    const top = ((uy - yMin) / yRange) * 85 + 5;
                    const cluster = s.clusters?.[activeClusterTab] ?? -1;
                    const borderColor = cluster >= 0 ? CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] : '#475569';

                    return (
                      <div
                        key={i}
                        title={`${s.video_id} scene ${s.scene_idx}\n${s.start_sec.toFixed(1)}-${s.end_sec.toFixed(1)}s\n${s.transcript?.slice(0, 80) || '(silence)'}`}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          top: `${top}%`,
                          transform: 'translate(-50%, -50%)',
                          width: 48,
                          height: 48,
                          borderRadius: 6,
                          border: `2px solid ${borderColor}`,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'transform 0.15s, z-index 0s',
                          zIndex: 1,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translate(-50%, -50%) scale(2.5)';
                          e.currentTarget.style.zIndex = '10';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translate(-50%, -50%)';
                          e.currentTarget.style.zIndex = '1';
                        }}
                      >
                        {s.thumbnail && (
                          <img
                            src={s.thumbnail}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Stats bar */}
                {activeInfo && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                    <strong>{activeClusterTab}</strong>: {activeInfo.n_clusters} clusters, {activeInfo.n_noise} noise points
                  </div>
                )}

                {/* Cluster groups with keyframe strips */}
                {Object.keys(clusterGroups)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((cid) => {
                    const label = Number(cid) >= 0 ? `Cluster ${cid}` : 'Noise';
                    const color = Number(cid) >= 0 ? CLUSTER_COLORS[Number(cid) % CLUSTER_COLORS.length] : '#475569';
                    const group = clusterGroups[Number(cid)];

                    return (
                      <div key={cid} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: color, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{group.length} scenes</span>
                        </div>
                        <div style={{
                          display: 'flex', gap: 6, overflowX: 'auto',
                          paddingBottom: 6,
                        }}>
                          {group.map((s, gi) => (
                            <div
                              key={gi}
                              style={{
                                flexShrink: 0,
                                width: 100,
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: '1px solid var(--line)',
                                background: 'var(--panel)',
                              }}
                            >
                              {s.thumbnail && (
                                <img
                                  src={s.thumbnail}
                                  alt=""
                                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                                />
                              )}
                              <div style={{ padding: '4px 6px' }}>
                                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--muted)' }}>
                                  {s.start_sec.toFixed(1)}-{s.end_sec.toFixed(1)}s
                                </div>
                                <div style={{
                                  fontSize: 10, color: 'var(--ink)',
                                  overflow: 'hidden', textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {s.transcript?.slice(0, 30) || '(silence)'}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--muted)' }}>
                                  {s.video_id.slice(0, 8)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </CollapsibleSection>
            );
          })()}

          {!sceneClusterData && stepStatus.sceneClusters !== 'loading' && (
            <div className="triage-empty" style={{ padding: '20px 0' }}>
              No scene clusters yet. Run embed-scenes.py, then Load Cached Run.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

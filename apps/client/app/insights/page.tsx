'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchFrequency,
  fetchInsights,
  fetchMediaProfile,
  runMockIngestion,
  type MediaProfileResponse,
  type VocabFrequencyResponse,
  type VocabInsightsResponse,
} from '@/lib/api';

export default function InsightsPage() {
  const [frequency, setFrequency] = useState<VocabFrequencyResponse | null>(null);
  const [insights, setInsights] = useState<VocabInsightsResponse | null>(null);
  const [mediaProfile, setMediaProfile] = useState<MediaProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const [freq, insightPayload, media] = await Promise.all([
        fetchFrequency(),
        fetchInsights(),
        fetchMediaProfile(),
      ]);
      setFrequency(freq);
      setInsights(insightPayload);
      setMediaProfile(media);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }

  async function runIngestionNow() {
    try {
      setRunning(true);
      await runMockIngestion();
      await refresh();
    } finally {
      setRunning(false);
    }
  }

  const maxCount = useMemo(() => {
    if (!frequency?.items?.length) return 1;
    return Math.max(...frequency.items.map((item) => item.count), 1);
  }, [frequency]);

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Ingestion + Topic Review</p>
        <h1 className="page-title">72h YouTube/Spotify frequency + topic visualization</h1>
        <p className="page-copy">
          Run mock ingestion and inspect ranked terms, source contribution, and cluster labels used to shape
          objectives.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
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
        <div className="row">
          <h3 style={{ margin: 0 }}>Ingestion Controls</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="secondary" onClick={() => void refresh()} disabled={loading || running}>
              Refresh
            </button>
            <button onClick={() => void runIngestionNow()} disabled={running}>
              {running ? 'Running...' : 'Run mock ingestion'}
            </button>
          </div>
        </div>
        {error && <p style={{ color: '#9f1239' }}>{error}</p>}
        {loading && <p>Loading snapshots...</p>}
        {!loading && frequency && (
          <p>
            Window: {new Date(frequency.windowStartIso).toLocaleString()} to{' '}
            {new Date(frequency.windowEndIso).toLocaleString()}
          </p>
        )}
      </section>

      <section className="grid grid-2">
        <article className="card stack">
          <h3>Frequency ranking</h3>
          {!frequency?.items?.length && <p>No frequency data yet.</p>}
          {!!frequency?.items?.length && (
            <table className="table">
              <thead>
                <tr>
                  <th>Lemma</th>
                  <th>Count</th>
                  <th>Sources</th>
                  <th>Spread</th>
                </tr>
              </thead>
              <tbody>
                {frequency.items.slice(0, 14).map((item) => (
                  <tr key={`${item.lemma}-${item.lang}`}>
                    <td>
                      <strong>{item.lemma}</strong>
                    </td>
                    <td>{item.count}</td>
                    <td>
                      {item.sourceBreakdown
                        ? `YT ${item.sourceBreakdown.youtube} / SP ${item.sourceBreakdown.spotify}`
                        : item.sourceCount}
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div className="spark">
                        <span style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="card stack">
          <h3>Topic clusters</h3>
          {!insights?.clusters?.length && <p>No cluster data yet.</p>}
          {!!insights?.clusters?.length &&
            insights.clusters.slice(0, 6).map((cluster) => (
              <div key={cluster.clusterId} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <strong>{cluster.label}</strong>
                    <p style={{ margin: 0 }}>Top terms: {cluster.topTerms.join(', ') || '-'}</p>
                  </div>
                  <span className="pill">{cluster.clusterId}</span>
                </div>
                <p style={{ marginTop: 8 }}>Keywords: {cluster.keywords.join(', ')}</p>
              </div>
            ))}
        </article>
      </section>

      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card stack">
          <h3>Top insight items</h3>
          {!insights?.items?.length && <p>No insight items yet.</p>}
          {!!insights?.items?.length &&
            insights.items.slice(0, 10).map((item) => (
              <div key={`${item.lemma}-${item.clusterId}`} className="row" style={{ borderBottom: '1px solid #eadbc9', paddingBottom: 8 }}>
                <div>
                  <strong>{item.lemma}</strong>
                  <p style={{ margin: 0 }}>
                    cluster: {item.clusterId} · objective: {item.objectiveLinks[0]?.objectiveId}
                  </p>
                </div>
                <span className="pill">score {item.score}</span>
              </div>
            ))}
        </article>

        <article className="card stack">
          <h3>Source breakdown</h3>
          {!mediaProfile && <p>No media profile loaded.</p>}
          {!!mediaProfile && (
            <>
              <div className="row">
                <div>
                  <strong>YouTube</strong>
                  <p style={{ margin: 0 }}>
                    {mediaProfile.sourceBreakdown.youtube.itemsConsumed} items ·{' '}
                    {mediaProfile.sourceBreakdown.youtube.minutes} min
                  </p>
                </div>
                <span className="pill">video</span>
              </div>

              <div className="row">
                <div>
                  <strong>Spotify</strong>
                  <p style={{ margin: 0 }}>
                    {mediaProfile.sourceBreakdown.spotify.itemsConsumed} items ·{' '}
                    {mediaProfile.sourceBreakdown.spotify.minutes} min
                  </p>
                </div>
                <span className="pill">audio</span>
              </div>

              <div className="stack">
                <span className="pill">Top YouTube media</span>
                {mediaProfile.sourceBreakdown.youtube.topMedia.slice(0, 3).map((media) => (
                  <p key={media.mediaId}>{media.title}</p>
                ))}
              </div>

              <div className="stack">
                <span className="pill">Top Spotify tracks</span>
                {mediaProfile.sourceBreakdown.spotify.topMedia.slice(0, 3).map((media) => (
                  <p key={media.mediaId}>{media.title}</p>
                ))}
              </div>
            </>
          )}
        </article>
      </section>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchCaptions,
  fetchTools,
  getApiBase,
  invokeTool,
  type CaptionSegment,
  type IngestionSnapshotResult,
} from '@/lib/api';

const USER_ID = 'demo-user-1';
const DEFAULT_WINDOW_HOURS = 72;

type SpotifyStatusResult = {
  userId: string;
  spotifyConfigured: boolean;
  connected: boolean;
  tokenExpiresAtIso: string | null;
  tokenScope: string | null;
  lastSyncAtIso: string | null;
  lastSyncItemCount: number;
  syncWindowHours: number | null;
};

type YouTubeStatusResult = {
  userId: string;
  youtubeConfigured: boolean;
  connected: boolean;
  tokenExpiresAtIso: string | null;
  tokenScope: string | null;
  lastSyncAtIso: string | null;
  lastSyncItemCount: number;
  syncWindowHours: number | null;
};

function truncate(text: string, max = 90) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export default function IntegrationsPage() {
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatusResult | null>(null);
  const [youtubeStatus, setYouTubeStatus] = useState<YouTubeStatusResult | null>(null);
  const [snapshot, setSnapshot] = useState<IngestionSnapshotResult | null>(null);
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);
  const [videoId, setVideoId] = useState('karina-variety-demo');
  const [spotifyAuthUrl, setSpotifyAuthUrl] = useState<string | null>(null);
  const [youtubeAuthUrl, setYouTubeAuthUrl] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolNames, setToolNames] = useState<string[]>([]);

  useEffect(() => {
    void refreshAll();
    void loadTranscriptSample('karina-variety-demo');
  }, []);

  const sourceItems = snapshot?.sourceItems || [];
  const spotifyItems = useMemo(
    () => sourceItems.filter((item) => item.source === 'spotify'),
    [sourceItems],
  );
  const youtubeItems = useMemo(
    () => sourceItems.filter((item) => item.source === 'youtube'),
    [sourceItems],
  );

  async function refreshAll() {
    try {
      setRefreshing(true);
      setError(null);
      const [spotify, youtube, sourceSnapshot, toolCatalog] = await Promise.all([
        invokeTool<SpotifyStatusResult>('integrations.spotify.status', { userId: USER_ID }),
        invokeTool<YouTubeStatusResult>('integrations.youtube.status', { userId: USER_ID }),
        invokeTool<IngestionSnapshotResult>('ingestion.snapshot.get', { userId: USER_ID }),
        fetchTools(),
      ]);

      if (!spotify.ok) {
        throw new Error(spotify.message || spotify.error || 'Spotify status check failed');
      }
      if (!youtube.ok) {
        throw new Error(youtube.message || youtube.error || 'YouTube status check failed');
      }
      if (!sourceSnapshot.ok) {
        throw new Error(sourceSnapshot.message || sourceSnapshot.error || 'Snapshot fetch failed');
      }

      setSpotifyStatus(spotify.result || null);
      setYouTubeStatus(youtube.result || null);
      setSnapshot(sourceSnapshot.result || null);
      setToolNames((toolCatalog.tools || []).map((tool) => tool.name));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to refresh integration validation');
    } finally {
      setRefreshing(false);
    }
  }

  async function loadTranscriptSample(nextVideoId?: string) {
    try {
      setWorkingAction('transcript-load');
      const id = nextVideoId || videoId;
      const payload = await fetchCaptions(id, 'ko');
      setCaptions(payload.segments.slice(0, 6));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load transcript sample');
    } finally {
      setWorkingAction(null);
    }
  }

  async function requestConnect(source: 'spotify' | 'youtube') {
    try {
      setError(null);
      setWorkingAction(`${source}-connect`);
      const tool = source === 'spotify' ? 'integrations.spotify.connect' : 'integrations.youtube.connect';
      const response = await invokeTool<{ authUrl: string }>(tool, { userId: USER_ID });
      if (!response.ok) {
        throw new Error(response.message || response.error || `${source} connect failed`);
      }
      const authUrl = response.result?.authUrl;
      if (!authUrl) {
        throw new Error(`${source} connect did not return authUrl`);
      }
      if (source === 'spotify') {
        setSpotifyAuthUrl(authUrl);
      } else {
        setYouTubeAuthUrl(authUrl);
      }
      await refreshAll();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : `Failed to build ${source} auth URL`);
    } finally {
      setWorkingAction(null);
    }
  }

  async function runSync(tool: string) {
    try {
      setError(null);
      setWorkingAction(tool);
      const args =
        tool === 'integrations.spotify.sync' || tool === 'integrations.youtube.sync'
          ? { userId: USER_ID, windowHours: DEFAULT_WINDOW_HOURS }
          : { userId: USER_ID };
      const response = await invokeTool(tool, args);
      if (!response.ok) {
        throw new Error(response.message || response.error || `${tool} failed`);
      }
      await refreshAll();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : `Failed to run ${tool}`);
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Live Integration Validation</p>
        <h1 className="page-title">Connect, sync, and inspect source text before topic modeling</h1>
        <p className="page-copy">
          Validate YouTube + Spotify ingestion payloads and inspect transcript/lyric candidates first. Then move
          to frequency/topic analysis separately.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/overlay" className="nav-link">
            Overlay
          </Link>
          <Link href="/insights" className="nav-link">
            Insights
          </Link>
        </div>
      </header>

      <section className="card stack" style={{ marginBottom: 16 }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>Environment + Tool Registration</h3>
          <span className="pill">API {getApiBase()}</span>
        </div>
        <p>
          Registered integration tools:{' '}
          {toolNames.filter((name) => name.includes('integrations.') || name === 'ingestion.snapshot.get').join(', ')}
        </p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <button className="secondary" disabled={refreshing || Boolean(workingAction)} onClick={() => void refreshAll()}>
            {refreshing ? 'Refreshing...' : 'Refresh validation data'}
          </button>
          <Link href="/insights" className="button">
            Step 2: Topic + Frequency
          </Link>
        </div>
        {error && <p style={{ color: '#9f1239' }}>{error}</p>}
      </section>

      <section className="grid grid-2" style={{ marginBottom: 16 }}>
        <article className="card stack">
          <div className="row">
            <h3 style={{ margin: 0 }}>Spotify</h3>
            <span className="pill">{spotifyStatus?.connected ? 'Connected' : 'Not connected'}</span>
          </div>
          <p>Configured: {spotifyStatus?.spotifyConfigured ? 'yes' : 'no'}</p>
          <p>Last sync: {spotifyStatus?.lastSyncAtIso ? new Date(spotifyStatus.lastSyncAtIso).toLocaleString() : '-'}</p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <button onClick={() => void requestConnect('spotify')} disabled={Boolean(workingAction)}>
              {workingAction === 'spotify-connect' ? 'Building URL...' : 'Get Spotify auth URL'}
            </button>
            <button
              className="secondary"
              onClick={() => void runSync('integrations.spotify.sync')}
              disabled={Boolean(workingAction)}
            >
              {workingAction === 'integrations.spotify.sync' ? 'Syncing...' : 'Run Spotify live sync'}
            </button>
            <button
              className="ghost"
              onClick={() => void runSync('integrations.spotify.sync_mock')}
              disabled={Boolean(workingAction)}
            >
              {workingAction === 'integrations.spotify.sync_mock' ? 'Running...' : 'Run Spotify mock sync'}
            </button>
          </div>
          {spotifyAuthUrl && (
            <p>
              <a href={spotifyAuthUrl} target="_blank" rel="noreferrer">
                Open Spotify consent screen
              </a>
            </p>
          )}
        </article>

        <article className="card stack">
          <div className="row">
            <h3 style={{ margin: 0 }}>YouTube</h3>
            <span className="pill">{youtubeStatus?.connected ? 'Connected' : 'Not connected'}</span>
          </div>
          <p>Configured: {youtubeStatus?.youtubeConfigured ? 'yes' : 'no'}</p>
          <p>Last sync: {youtubeStatus?.lastSyncAtIso ? new Date(youtubeStatus.lastSyncAtIso).toLocaleString() : '-'}</p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <button onClick={() => void requestConnect('youtube')} disabled={Boolean(workingAction)}>
              {workingAction === 'youtube-connect' ? 'Building URL...' : 'Get YouTube auth URL'}
            </button>
            <button
              className="secondary"
              onClick={() => void runSync('integrations.youtube.sync')}
              disabled={Boolean(workingAction)}
            >
              {workingAction === 'integrations.youtube.sync' ? 'Syncing...' : 'Run YouTube live sync'}
            </button>
            <button
              className="ghost"
              onClick={() => void runSync('integrations.youtube.sync_mock')}
              disabled={Boolean(workingAction)}
            >
              {workingAction === 'integrations.youtube.sync_mock' ? 'Running...' : 'Run YouTube mock sync'}
            </button>
          </div>
          {youtubeAuthUrl && (
            <p>
              <a href={youtubeAuthUrl} target="_blank" rel="noreferrer">
                Open YouTube consent screen
              </a>
            </p>
          )}
        </article>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 16 }}>
        <article className="card stack">
          <div className="row">
            <h3 style={{ margin: 0 }}>Captured Source Items</h3>
            <span className="pill">{sourceItems.length} items</span>
          </div>
          {snapshot?.windowStartIso && snapshot?.windowEndIso && (
            <p>
              Window: {new Date(snapshot.windowStartIso).toLocaleString()} to{' '}
              {new Date(snapshot.windowEndIso).toLocaleString()}
            </p>
          )}
          {!sourceItems.length && <p>No source items yet. Run a sync first.</p>}
          {!!sourceItems.length && (
            <table className="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Title</th>
                  <th>Lang</th>
                  <th>Text Signal</th>
                </tr>
              </thead>
              <tbody>
                {sourceItems.slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td>{item.source.toUpperCase()}</td>
                    <td>{truncate(item.title, 38)}</td>
                    <td>{item.lang.toUpperCase()}</td>
                    <td>{truncate(item.text, 76)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="card stack">
          <h3>Transcript + Lyric Candidate Checks</h3>
          <p>{snapshot?.notes.youtube || 'YouTube candidates appear after sync.'}</p>
          <p>{snapshot?.notes.spotify || 'Spotify candidates appear after sync.'}</p>
          <div className="row" style={{ alignItems: 'flex-end', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="videoIdInput">Transcript sample videoId</label>
              <input
                id="videoIdInput"
                value={videoId}
                onChange={(event) => setVideoId(event.target.value)}
                placeholder="karina-variety-demo"
              />
            </div>
            <button
              className="secondary"
              disabled={Boolean(workingAction)}
              onClick={() => void loadTranscriptSample()}
            >
              {workingAction === 'transcript-load' ? 'Loading...' : 'Load transcript sample'}
            </button>
          </div>

          <div className="stack">
            <span className="pill">YouTube transcript candidates ({youtubeItems.length})</span>
            {!snapshot?.transcriptCandidates?.length && <p>No YouTube transcript candidates yet.</p>}
            {snapshot?.transcriptCandidates?.slice(0, 4).map((item) => (
              <p key={item.id}>
                <strong>{item.title}:</strong> {truncate(item.text, 120)}
              </p>
            ))}
          </div>

          <div className="stack">
            <span className="pill">Spotify lyric candidates ({spotifyItems.length})</span>
            {!snapshot?.lyricCandidates?.length && <p>No Spotify lyric candidates yet.</p>}
            {snapshot?.lyricCandidates?.slice(0, 4).map((item) => (
              <p key={item.id}>
                <strong>{item.title}:</strong> {truncate(item.text, 120)}
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="card stack">
        <h3>Caption Transcript Sample</h3>
        {!captions.length && <p>No transcript sample loaded.</p>}
        {!!captions.length &&
          captions.map((segment, index) => (
            <div key={`${segment.startMs}-${segment.endMs}`} className="card" style={{ padding: 12 }}>
              <p style={{ marginBottom: 6 }}>
                Segment {index + 1}: {segment.startMs}ms - {segment.endMs}ms
              </p>
              <p className="korean">{segment.surface}</p>
              <p>{segment.romanized}</p>
              <p>{segment.english}</p>
            </div>
          ))}
      </section>
    </main>
  );
}


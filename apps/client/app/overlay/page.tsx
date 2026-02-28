'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchCaptions, fetchDictionary, type CaptionSegment, type DictionaryEntry } from '@/lib/api';

export default function OverlayPage() {
  const [videoId, setVideoId] = useState('karina-variety-demo');
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dictionary, setDictionary] = useState<DictionaryEntry | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);

  const maxMs = useMemo(() => {
    const last = segments[segments.length - 1];
    return last ? last.endMs + 800 : 17000;
  }, [segments]);

  const activeSegment = useMemo(
    () => segments.find((segment) => currentMs >= segment.startMs && currentMs <= segment.endMs),
    [segments, currentMs],
  );

  useEffect(() => {
    void loadCaptions();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCurrentMs((prev) => {
        const next = prev + 180;
        if (next >= maxMs) {
          setPlaying(false);
          return maxMs;
        }
        return next;
      });
    }, 180);

    return () => window.clearInterval(id);
  }, [playing, maxMs]);

  async function loadCaptions() {
    try {
      setLoading(true);
      setError(null);
      const payload = await fetchCaptions(videoId, 'ko');
      setSegments(payload.segments);
      setCurrentMs(payload.segments[0]?.startMs || 0);
      setDictionary(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load captions');
    } finally {
      setLoading(false);
    }
  }

  async function openDictionary(term: string) {
    try {
      setDictionaryLoading(true);
      const entry = await fetchDictionary(term, 'ko');
      setDictionary(entry);
    } catch {
      setDictionary(null);
    } finally {
      setDictionaryLoading(false);
    }
  }

  const elapsedSeconds = (currentMs / 1000).toFixed(1);

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Overlay Review</p>
        <h1 className="page-title">YouTube caption overlay lanes + dictionary popover</h1>
        <p className="page-copy">
          Use this route to test script/romanization/English lane rendering and per-token dictionary lookup.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/game" className="nav-link">
            Game UI
          </Link>
          <Link href="/insights" className="nav-link">
            Insights
          </Link>
        </div>
      </header>

      <section className="card stack" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <label className="stack">
            <span className="pill">Video ID</span>
            <input value={videoId} onChange={(event) => setVideoId(event.target.value)} />
          </label>
          <div className="stack" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => void loadCaptions()} disabled={loading}>
              {loading ? 'Loading captions...' : 'Reload from API'}
            </button>
          </div>
        </div>

        <div className="row">
          <div className="pill">t={elapsedSeconds}s</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="secondary" onClick={() => setPlaying((prev) => !prev)}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="secondary" onClick={() => setCurrentMs(0)}>
              Reset
            </button>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={maxMs}
          value={currentMs}
          onChange={(event) => setCurrentMs(Number(event.target.value))}
        />
      </section>

      <section className="grid grid-2">
        <article className="card stack">
          <h3>Overlay Preview</h3>
          <div className="video-frame">
            <div className="pill" style={{ background: 'rgba(255,255,255,0.17)', color: '#fff' }}>
              Demo playback surface
            </div>

            <div className="overlay-lanes">
              {activeSegment ? (
                <>
                  <div className="overlay-script korean">{activeSegment.surface}</div>
                  <div className="overlay-romanized">{activeSegment.romanized}</div>
                  <div className="overlay-english">{activeSegment.english}</div>
                  <div className="token-row">
                    {activeSegment.tokens.map((token) => (
                      <button
                        key={`${token.dictionaryId}-${token.text}`}
                        className="token-button"
                        onClick={() => void openDictionary(token.lemma || token.text)}
                      >
                        {token.text}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="overlay-english">No active segment at this timestamp.</div>
              )}
            </div>
          </div>
          {error && <p style={{ color: '#9f1239' }}>{error}</p>}
        </article>

        <article className="card stack">
          <h3>Dictionary Popover</h3>
          {dictionaryLoading && <p>Loading dictionary entry...</p>}
          {!dictionaryLoading && dictionary && (
            <>
              <div className="row">
                <strong className="korean" style={{ fontSize: 22 }}>
                  {dictionary.term}
                </strong>
                <span className="pill">{dictionary.lang.toUpperCase()}</span>
              </div>
              <p>{dictionary.meaning}</p>
              <div className="stack">
                <span className="pill">Readings</span>
                <p>
                  KO: {dictionary.readings.ko || '-'} | ZH: {dictionary.readings.zhPinyin || '-'} | JA:{' '}
                  {dictionary.readings.jaRomaji || '-'}
                </p>
              </div>
              <div className="stack">
                <span className="pill">Cross-CJK</span>
                <p>
                  简: {dictionary.crossCjk.zhHans} / 日: {dictionary.crossCjk.ja}
                </p>
              </div>
              <div className="stack">
                <span className="pill">Examples</span>
                {dictionary.examples.map((example) => (
                  <p key={example} className="korean">
                    {example}
                  </p>
                ))}
              </div>
            </>
          )}
          {!dictionaryLoading && !dictionary && (
            <p>Click any token in the active segment to inspect dictionary details.</p>
          )}
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Review Checklist</h3>
        <p>
          Verify lane sync at different timestamps, token click behavior, and dictionary payload consistency.
        </p>
      </section>
    </main>
  );
}

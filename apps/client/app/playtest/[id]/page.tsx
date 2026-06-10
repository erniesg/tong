'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { dispatch } from '@/lib/store/game-store';
import type { CityId, AppLang } from '@/lib/api';
import { getPublicApiBase } from '@/lib/public-api-base';
import { setDisplayStream } from '@/lib/playtest/display-stream';

/* ── Types ────────────────────────────────────────────────── */

type PlaytestStatus = 'pending' | 'active' | 'submitted';

interface PlaytestConfig {
  sessionId: string;
  city: CityId;
  sceneType: 'onboarding' | 'hangout' | 'free_roam' | 'exercise';
  language: string;
  locationId?: string;
  hangoutId?: string;
  exerciseTypes?: string[];
  seed?: number;
  npc?: string;
  playerName?: string;
  chineseName?: string;
  status: PlaytestStatus;
  createdAt: string;
}

interface PlaytestSessionResponse {
  sessionId: string;
  config: PlaytestConfig;
  status: PlaytestStatus;
  createdAt: string;
}

/* ── City language defaults (CITY_ORDER = ['tokyo','seoul','shanghai']) ── */

const CITY_TO_LANG: Record<string, AppLang> = { seoul: 'ko', tokyo: 'ja', shanghai: 'zh' };

/* ── API helper — no demo password required for GET/PATCH ──── */

const API_BASE = getPublicApiBase();

async function fetchSession(id: string): Promise<PlaytestSessionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/playtest/sessions/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error === 'session_not_found' ? 'Session not found' : `Server error: ${res.status}`);
  }
  return res.json();
}

async function markSessionActive(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/playtest/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  });
}

/* ── Build game URL from session config ───────────────────── */

function buildGameUrl(config: PlaytestConfig): string {
  const params = new URLSearchParams();

  switch (config.sceneType) {
    case 'hangout': {
      if (config.hangoutId) {
        params.set('phase', 'hangout');
        params.set('mode', 'fixture');
        params.set('fixtureId', config.hangoutId);
        if (config.city) params.set('city', config.city);
        if (config.locationId) params.set('location', config.locationId);
      } else if (config.npc) {
        // Intro hangout: use dev_intro mode with NPC + player profile
        params.set('dev_intro', '1');
        params.set('npc', config.npc);
        if (config.playerName) params.set('name', config.playerName);
        if (config.chineseName) params.set('cn_name', config.chineseName);
      } else {
        params.set('phase', 'hangout');
      }
      if (config.locationId) params.set('location', config.locationId);
      if (config.city) params.set('city', config.city);
      break;
    }
    case 'free_roam': {
      params.set('phase', 'city_map');
      if (config.city) params.set('city', config.city);
      break;
    }
    case 'exercise': {
      params.set('dev', 'exercise');
      if (config.exerciseTypes?.[0]) params.set('type', config.exerciseTypes[0]);
      break;
    }
    case 'onboarding':
    default: {
      params.set('fresh', '1');
      break;
    }
  }

  // Propagate language preference
  if (config.language) {
    params.set('lang', config.language);
  }

  // Propagate deterministic seed when present (no built-in game support yet — pass as extra param for future use)
  if (config.seed !== undefined) {
    params.set('seed', String(config.seed));
  }

  params.set('qa_run_id', config.sessionId);
  params.set('qa_trace', '1');

  return `/game?${params.toString()}`;
}

/* ── Initialise game store state for the target city ─────── */

function primeGameStoreForSession(config: PlaytestConfig) {
  const cityId = config.city as CityId;
  const lang = (config.language as AppLang) || CITY_TO_LANG[cityId] || 'en';

  // Unlock the playtest target location so the city map renders it accessible
  if (config.locationId) {
    dispatch({ type: 'UNLOCK_LOCATION', cityId, locationId: config.locationId });
  }

  // Set explain language for this city to match the session language
  const explainIn: AppLang = ['en', 'ko', 'ja', 'zh'].includes(lang) ? lang as AppLang : 'en';
  dispatch({ type: 'SET_EXPLAIN_LANGUAGE', cityId, lang: explainIn });
}

/* ── Component ────────────────────────────────────────────── */

type LoadState = 'loading' | 'ready' | 'error';

/* Desktop browsers can contribute a pixel-perfect recording via screen
   share. getDisplayMedia needs a user gesture, so it must happen here on
   the entry page — the stream is handed to the overlay via module state. */
function canOfferHdRecording(): boolean {
  return typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getDisplayMedia)
    && window.matchMedia('(pointer: fine)').matches;
}

export default function PlaytestPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [gameUrl, setGameUrl] = useState('');
  const [offerHd, setOfferHd] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setErrorMsg('Missing session ID');
      setLoadState('error');
      return;
    }

    try {
      const { config } = await fetchSession(id);

      // Prime the game store before navigating
      primeGameStoreForSession(config);

      // Persist session ID so the game page can mount the playtest overlay
      sessionStorage.setItem('tong_playtest_session', JSON.stringify({
        sessionId: config.sessionId,
        city: config.city,
        sceneType: config.sceneType,
        language: config.language,
      }));

      // Mark session active (fire-and-forget — don't block UX on this)
      markSessionActive(id).catch(() => { /* non-critical */ });

      setGameUrl(buildGameUrl(config));
      setOfferHd(canOfferHdRecording());
      setLoadState('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load playtest session');
      setLoadState('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Once we have the game URL, navigate using Next.js router (no full page reload,
  // preserves React tree, sessionStorage, and game store state). Desktop
  // holds at the ready screen so the user can opt into HD screen recording.
  useEffect(() => {
    if (loadState === 'ready' && gameUrl && !offerHd) {
      router.push(gameUrl);
    }
  }, [loadState, gameUrl, offerHd, router]);

  const startWithHd = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: false,
      });
      setDisplayStream(stream);
    } catch { /* denied — fall through to standard recording */ }
    router.push(gameUrl);
  }, [gameUrl, router]);

  const startWithoutHd = useCallback(() => {
    router.push(gameUrl);
  }, [gameUrl, router]);

  /* ── Loading ──────────────────────────────────────────────── */
  if (loadState === 'loading') {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a', minHeight: '100dvh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.12)',
              borderTopColor: '#d4a843',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0, fontFamily: 'var(--font-game, sans-serif)' }}>
            Loading playtest session...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────── */
  if (loadState === 'error') {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a', minHeight: '100dvh' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            maxWidth: 360,
            textAlign: 'center',
            padding: '0 24px',
          }}
        >
          <p style={{ color: '#e8485c', fontSize: 16, margin: 0, fontFamily: 'var(--font-game, sans-serif)', fontWeight: 600 }}>
            Could not load session
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, fontFamily: 'var(--font-game, sans-serif)' }}>
            {errorMsg}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: 0, fontFamily: 'monospace' }}>
            ID: {id}
          </p>
        </div>
      </div>
    );
  }

  /* ── Ready — desktop offers HD screen recording; mobile auto-starts ── */
  if (offerHd) {
    return (
      <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a', minHeight: '100dvh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: 380, textAlign: 'center', padding: '0 24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, margin: 0, fontFamily: 'var(--font-game, sans-serif)', fontWeight: 600 }}>
            Ready to playtest
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, fontFamily: 'var(--font-game, sans-serif)' }}>
            Share this tab to capture a full-quality recording of exactly what you see. You can also continue without it.
          </p>
          <button
            type="button"
            onClick={() => void startWithHd()}
            style={{
              background: '#e8b93e', color: '#1a1408', border: 'none', borderRadius: 24,
              padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-game, sans-serif)',
            }}
          >
            Start &amp; share screen (HD)
          </button>
          <button
            type="button"
            onClick={startWithoutHd}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 24,
              padding: '10px 24px', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-game, sans-serif)',
            }}
          >
            Continue without
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a', minHeight: '100dvh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.12)',
            borderTopColor: '#4a90d9',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0, fontFamily: 'var(--font-game, sans-serif)' }}>
          Starting playtest...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

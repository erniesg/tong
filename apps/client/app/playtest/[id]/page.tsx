'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { dispatch } from '@/lib/store/game-store';
import type { CityId, AppLang } from '@/lib/api';

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

const API_BASE = process.env.NEXT_PUBLIC_TONG_API_BASE || 'http://localhost:8787';

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
      params.set('phase', 'hangout');
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

export default function PlaytestPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [gameUrl, setGameUrl] = useState('');

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
  // preserves React tree, sessionStorage, and game store state)
  useEffect(() => {
    if (loadState === 'ready' && gameUrl) {
      router.push(gameUrl);
    }
  }, [loadState, gameUrl, router]);

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

  /* ── Ready — brief redirect state while router.push navigates ── */
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

'use client';

import { useEffect, useState } from 'react';
import { fetchSecretStatus, type SecretStatusResponse } from '@/lib/api';

function label(flag: boolean) {
  return flag ? 'Configured' : 'Missing';
}

export default function SecretStatusCard() {
  const [status, setStatus] = useState<SecretStatusResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    void fetchSecretStatus()
      .then((data) => {
        if (!mounted) return;
        setStatus(data);
        setError('');
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load secret status.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="card stack" style={{ marginBottom: 16 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2>Secret-backed integrations</h2>
          <p>
            This endpoint is demo-password protected. It only reports configured/missing state, never secret values.
          </p>
        </div>
        <span className="pill">secure status</span>
      </div>
      {error && <p style={{ color: '#9f1239' }}>{error}</p>}
      {!error && !status && <p>Checking secret configuration...</p>}
      {!!status && (
        <div className="grid grid-2">
          <p>Demo password gate: {label(status.demoPasswordEnabled)}</p>
          <p>YouTube API key: {label(status.youtubeApiKeyConfigured)}</p>
          <p>Spotify client ID: {label(status.spotifyClientIdConfigured)}</p>
          <p>Spotify client secret: {label(status.spotifyClientSecretConfigured)}</p>
          <p>OpenAI API key: {label(status.openAiApiKeyConfigured)}</p>
        </div>
      )}
    </section>
  );
}

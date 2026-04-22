'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function ShanghaiOnboardingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const requestedEntry = searchParams.get('entry');
  const requestedSeat = searchParams.get('seat') === 'shoucheng' ? 'shoucheng' : 'dingman';
  const qaRunId = searchParams.get('qa_run_id');
  const qaTrace = searchParams.get('qa_trace');
  const requestedLang = searchParams.get('lang');

  useEffect(() => {
    const params = new URLSearchParams({
      phase: 'hangout',
      city: 'shanghai',
      scene: 'h1',
      mode: requestedMode === 'dynamic' ? 'dynamic' : 'fixture',
      seat: requestedSeat,
    });

    if (requestedEntry === 'panorama' || requestedEntry === 'cover') {
      params.set('entry', requestedEntry);
    }
    if (qaRunId) params.set('qa_run_id', qaRunId);
    if (qaTrace === '1') params.set('qa_trace', '1');
    if (requestedLang && ['en', 'ko', 'ja', 'zh'].includes(requestedLang)) {
      params.set('lang', requestedLang);
    }

    router.replace(`/game?${params.toString()}`);
  }, [qaRunId, qaTrace, requestedEntry, requestedLang, requestedMode, requestedSeat, router]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#0d0d1a',
        color: '#fff8ee',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center', display: 'grid', gap: 12 }}>
        <p style={{ fontSize: '0.9rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f4d2ac' }}>
          Shanghai Onboarding
        </p>
        <h1 style={{ fontSize: '1.6rem', lineHeight: 1.2, margin: 0 }}>
          Entering canonical H1 hangout
        </h1>
        <p style={{ margin: 0, color: 'rgba(255,248,238,0.72)' }}>
          Redirecting into the shared Shanghai H1 runtime so Tong’s setup, the eavesdropped scene, and the webtoon cliffhanger all stay on one canonical path.
        </p>
      </div>
    </main>
  );
}

export default function ShanghaiOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <ShanghaiOnboardingRedirect />
    </Suspense>
  );
}

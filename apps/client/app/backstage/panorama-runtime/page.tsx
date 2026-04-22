'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { UILangProvider } from '@/lib/i18n/UILangContext';
import { SceneView } from '@/components/scene/SceneView';

const DEMO_ACCESS_TOKEN = 'TONG-DEMO-ACCESS';
const COVER_TEST_VIDEO = '/assets/cinematics/jin/intro_1.mp4';
const PANORAMA_STANDIN = '/assets/webtoon/shanghai/h1/0.png';

export default function BackstagePanoramaRuntimePage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'panorama' | 'cover'>('panorama');
  const [deltaX, setDeltaX] = useState(0);
  const demoToken = searchParams.get('demo');

  if (demoToken !== DEMO_ACCESS_TOKEN) {
    return (
      <main className="min-h-screen bg-[#0c1024] p-6 text-[#f3f5ff]">
        <h1 className="text-xl font-semibold">Panorama Runtime Backstage</h1>
        <p className="mt-3 max-w-2xl text-sm text-[#b8c2f0]">
          Access restricted. Open this route with{' '}
          <code className="rounded bg-black/30 px-1 py-0.5">?demo={DEMO_ACCESS_TOKEN}</code>.
        </p>
      </main>
    );
  }

  return (
    <UILangProvider value="en">
      <main className="min-h-screen bg-[#060914] text-[#f3f5ff]">
        <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
          <h1 className="text-lg font-semibold">Backstage · Panorama runtime</h1>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${mode === 'panorama' ? 'border-[#91a8ff] bg-[#1a2758]' : 'border-white/20 bg-black/35'}`}
            onClick={() => setMode('panorama')}
          >
            Panorama mode
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${mode === 'cover' ? 'border-[#91a8ff] bg-[#1a2758]' : 'border-white/20 bg-black/35'}`}
            onClick={() => setMode('cover')}
          >
            Cover mode
          </button>
          <p className="ml-auto text-xs text-[#a7b5ea]">Drag delta: {deltaX.toFixed(2)}px</p>
        </header>

        <section className="mx-auto w-full max-w-5xl px-4 pb-6">
          <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_24px_50px_rgba(0,0,0,0.45)]">
            <SceneView
              backgroundUrl={PANORAMA_STANDIN}
              ambientDescription="Keep your head down. Listen before they notice you."
              cinematic={{
                videoUrl: mode === 'panorama' ? PANORAMA_STANDIN : COVER_TEST_VIDEO,
                caption: mode === 'panorama'
                  ? 'Panorama runtime drag test: move left/right and verify transform delta updates.'
                  : 'Cover mode baseline: legacy cinematic behavior should remain unchanged.',
                autoAdvance: false,
                muted: true,
              }}
              cinematicMode={mode}
              panoramaAuthoredWidth={mode === 'panorama' ? 3072 : undefined}
              panoramaAuthoredHeight={mode === 'panorama' ? 1080 : undefined}
              panoramaMinOverflowPx={mode === 'panorama' ? 220 : undefined}
              onPanoramaTransformChange={setDeltaX}
              onCinematicEnd={() => {}}
            />
          </div>
        </section>
      </main>
    </UILangProvider>
  );
}

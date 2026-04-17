'use client';

import { useMemo, useState } from 'react';
import { SHANGHAI_H1_NEGOTIATION_FIXTURE } from '@/lib/content/shanghai/fixtures';
import type { WebtoonPanel as WebtoonPanelSpec } from '@/lib/hangout/fixture-types';
import { WebtoonPanel } from '@/components/scene/WebtoonPanel';

type PreviewMode = 'placeholders' | 'assets';
type ViewportMode = 'mobile' | 'desktop';

const VIEWPORTS: Record<ViewportMode, { width: number; height: number; label: string }> = {
  mobile: { width: 390, height: 844, label: 'Mobile 390×844' },
  desktop: { width: 1024, height: 900, label: 'Desktop 1024×900' },
};

function buildPlaceholderUrl(panel: WebtoonPanelSpec): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2b211c" />
          <stop offset="100%" stop-color="#564338" />
        </linearGradient>
      </defs>
      <rect width="800" height="1200" fill="url(#bg)" />
      <rect x="32" y="32" width="736" height="1136" rx="28" fill="rgba(255,248,238,0.08)" stroke="rgba(255,248,238,0.32)" stroke-width="4" />
      <text x="64" y="118" fill="#fff8ee" font-family="Arial, sans-serif" font-size="30" font-weight="700">${panel.id}</text>
      <text x="64" y="166" fill="#f4d2ac" font-family="Arial, sans-serif" font-size="24">${panel.shotType}</text>
      <text x="64" y="212" fill="#d4c0ae" font-family="Arial, sans-serif" font-size="22">${panel.aspectRatio} · ${panel.widthType} · ${panel.heightClass}</text>
      <text x="64" y="316" fill="#fff8ee" font-family="Arial, sans-serif" font-size="48" font-weight="700">${panel.isThumbStop ? 'THUMB-STOP' : 'PANEL'}</text>
      <text x="64" y="386" fill="#d4c0ae" font-family="Arial, sans-serif" font-size="24">Gap before: ${panel.gapBefore.px}px ${panel.gapBefore.color}</text>
      <text x="64" y="456" fill="#fff8ee" font-family="Arial, sans-serif" font-size="26">Replace with real art by adding:</text>
      <text x="64" y="498" fill="#f4d2ac" font-family="Arial, sans-serif" font-size="22">${panel.imageUrl}</text>
      <rect x="64" y="646" width="672" height="360" rx="32" fill="rgba(255,248,238,0.08)" stroke="rgba(255,248,238,0.18)" stroke-dasharray="14 10" />
      <text x="400" y="820" text-anchor="middle" fill="#fff8ee" font-family="Arial, sans-serif" font-size="30">composition safe area</text>
      <text x="400" y="862" text-anchor="middle" fill="#d4c0ae" font-family="Arial, sans-serif" font-size="22">center 80% readable zone</text>
      ${panel.id === 'p3' ? `
        <rect x="64" y="910" width="672" height="190" rx="28" fill="rgba(0,0,0,0.22)" />
        <text x="400" y="1010" text-anchor="middle" fill="#fff8ee" font-family="Arial, sans-serif" font-size="28">leave lower 40% empty for bubble overlay</text>
      ` : ''}
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function WebtoonLabPage() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('placeholders');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('mobile');
  const [runKey, setRunKey] = useState(0);
  const [completed, setCompleted] = useState(false);
  const liveFixtureHref = '/game?phase=hangout&city=shanghai&scene=h1&mode=fixture';

  const viewport = VIEWPORTS[viewportMode];
  const fixturePanels = SHANGHAI_H1_NEGOTIATION_FIXTURE.cliffhanger?.webtoon.panels ?? [];

  const panels = useMemo(
    () => fixturePanels.map((panel) => ({
      ...panel,
      imageUrl: previewMode === 'assets' ? panel.imageUrl : buildPlaceholderUrl(panel),
    })),
    [fixturePanels, previewMode],
  );

  const restart = () => {
    setCompleted(false);
    setRunKey((value) => value + 1);
  };

  return (
    <div className="backstage webtoon-lab">
      <header className="backstage-header">
        <h1>Webtoon Lab</h1>
        <span className="backstage-subtitle">Shanghai H1 panel layout harness</span>
      </header>

      <div className="webtoon-lab-layout">
        <section className="webtoon-lab-sidebar">
          <div className="webtoon-lab-card">
            <h2 className="webtoon-lab-card__title">Preview</h2>
            <p className="webtoon-lab-card__text">
              This is a backstage layout harness, not the player-facing review surface. Use it for panel sizing and bubble-safe-area checks only.
            </p>
            <p className="webtoon-lab-card__text">
              For actual mobile feedback, use the live scene route:
              {' '}
              <a href={liveFixtureHref}>{liveFixtureHref}</a>
              .
            </p>
            <p className="webtoon-lab-card__text">
              Switch to real assets the moment you drop `p1.png`, `p2.png`, and `p3.png` into the final public paths.
            </p>

            <div className="webtoon-lab-toggle-group">
              <span className="webtoon-lab-toggle-label">Asset mode</span>
              <div className="webtoon-lab-toggle-row">
                <button
                  className={`webtoon-lab-toggle${previewMode === 'placeholders' ? ' is-active' : ''}`}
                  onClick={() => {
                    setPreviewMode('placeholders');
                    restart();
                  }}
                >
                  Placeholders
                </button>
                <button
                  className={`webtoon-lab-toggle${previewMode === 'assets' ? ' is-active' : ''}`}
                  onClick={() => {
                    setPreviewMode('assets');
                    restart();
                  }}
                >
                  Real Assets
                </button>
              </div>
            </div>

            <div className="webtoon-lab-toggle-group">
              <span className="webtoon-lab-toggle-label">Viewport</span>
              <div className="webtoon-lab-toggle-row">
                <button
                  className={`webtoon-lab-toggle${viewportMode === 'mobile' ? ' is-active' : ''}`}
                  onClick={() => {
                    setViewportMode('mobile');
                    restart();
                  }}
                >
                  Mobile
                </button>
                <button
                  className={`webtoon-lab-toggle${viewportMode === 'desktop' ? ' is-active' : ''}`}
                  onClick={() => {
                    setViewportMode('desktop');
                    restart();
                  }}
                >
                  Desktop
                </button>
              </div>
            </div>

            <button className="webtoon-lab-restart" onClick={restart}>
              Restart Sequence
            </button>
          </div>

          <div className="webtoon-lab-card">
            <h2 className="webtoon-lab-card__title">Wire In Art</h2>
            <p className="webtoon-lab-card__text">
              Final fixture art plugs in at:
            </p>
            <code className="webtoon-lab-code">apps/client/public/assets/webtoon/shanghai/h1/p1.png</code>
            <code className="webtoon-lab-code">apps/client/public/assets/webtoon/shanghai/h1/p2.png</code>
            <code className="webtoon-lab-code">apps/client/public/assets/webtoon/shanghai/h1/p3.png</code>
            <p className="webtoon-lab-card__text">
              Once those files exist, switch this lab to <b>Real Assets</b>. No fixture-content change is required.
            </p>
          </div>

          <div className="webtoon-lab-card">
            <h2 className="webtoon-lab-card__title">Future Direction</h2>
            <p className="webtoon-lab-card__text">
              Yes, dynamic per-panel layout is relevant. The important boundary is to keep the renderer metadata-driven now, without forcing a full strip compositor into H1.
            </p>
            <p className="webtoon-lab-card__text">
              The working references are this lab plus `docs/shanghai/webtoon-layout-system.md`.
            </p>
          </div>
        </section>

        <section className="webtoon-lab-preview">
          <div className="webtoon-lab-preview__header">
            <div>
              <h2 className="webtoon-lab-preview__title">{viewport.label}</h2>
              <p className="webtoon-lab-preview__subtitle">
                {previewMode === 'assets' ? 'Using real asset paths from the H1 fixture.' : 'Using generated placeholder art for layout-only testing.'}
              </p>
            </div>
            <div className="webtoon-lab-preview__meta">
              {panels.map((panel) => (
                <div key={panel.id} className="webtoon-lab-preview__meta-item">
                  <span>{panel.id}</span>
                  <small>{panel.widthType} · {panel.aspectRatio}</small>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`webtoon-lab-stage webtoon-lab-stage--${viewportMode}`}
            style={{
              width: `${viewport.width}px`,
              height: `${viewport.height}px`,
              ['--viewport-h' as string]: `${viewport.height}px`,
            }}
          >
            {!completed ? (
              <WebtoonPanel
                key={`${runKey}-${previewMode}-${viewportMode}`}
                panels={panels}
                autoAdvance={false}
                onComplete={() => setCompleted(true)}
              />
            ) : (
              <div className="webtoon-lab-stage__complete">
                <h3>Sequence Complete</h3>
                <p>Restart to re-check panel pacing, gap behavior, and bubble placement.</p>
                <button className="webtoon-lab-restart" onClick={restart}>
                  Restart
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

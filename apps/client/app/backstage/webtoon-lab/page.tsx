'use client';

import { useMemo, useState } from 'react';
import { WEBTOON_FIXTURES, getWebtoonFixture } from '@/lib/content/shanghai/fixtures';
import type { WebtoonPanel as WebtoonPanelSpec } from '@/lib/hangout/fixture-types';
import { WebtoonStrip } from '@/components/scene/WebtoonStrip';

type ViewportMode = 'mobile' | 'desktop';
type SourceMode = 'fixture' | 'adhoc';

const VIEWPORTS: Record<ViewportMode, { width: number; height: number; label: string }> = {
  mobile: { width: 390, height: 844, label: 'Mobile 390×844' },
  desktop: { width: 1024, height: 900, label: 'Desktop 1024×900' },
};

export default function WebtoonLabPage() {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('mobile');
  const [sourceMode, setSourceMode] = useState<SourceMode>('fixture');
  const [fixtureId, setFixtureId] = useState<string>(WEBTOON_FIXTURES[0]?.id ?? '');
  const [adhocJson, setAdhocJson] = useState<string>('');
  const [adhocError, setAdhocError] = useState<string>('');
  const [runKey, setRunKey] = useState(0);

  const fixture = useMemo(() => getWebtoonFixture(fixtureId), [fixtureId]);

  const panels = useMemo<WebtoonPanelSpec[]>(() => {
    if (sourceMode === 'fixture') {
      return fixture?.spec.panels ?? [];
    }
    if (!adhocJson.trim()) return [];
    try {
      const parsed = JSON.parse(adhocJson);
      const arr = Array.isArray(parsed) ? parsed : parsed?.panels;
      if (!Array.isArray(arr)) {
        setAdhocError('Expected an array or { panels: [...] }.');
        return [];
      }
      setAdhocError('');
      return arr as WebtoonPanelSpec[];
    } catch (err) {
      setAdhocError(err instanceof Error ? err.message : 'Invalid JSON');
      return [];
    }
  }, [sourceMode, fixture, adhocJson]);

  const viewport = VIEWPORTS[viewportMode];
  const inspectionUrl = `/backstage/webtoon-lab`;

  const reset = () => setRunKey((n) => n + 1);

  return (
    <div className="webtoon-lab">
      <header className="webtoon-lab__header">
        <h1>Webtoon Lab v2</h1>
        <p className="webtoon-lab__subtitle">
          Continuous-scroll strip inspector. Any fixture or ad-hoc panels JSON.
        </p>
      </header>

      <div className="webtoon-lab__layout">
        <aside className="webtoon-lab__sidebar">
          <section className="webtoon-lab__card">
            <h3>Source</h3>
            <div className="webtoon-lab__toggle-row">
              <button
                type="button"
                className={`webtoon-lab__toggle${sourceMode === 'fixture' ? ' is-active' : ''}`}
                onClick={() => {
                  setSourceMode('fixture');
                  reset();
                }}
              >
                Fixture
              </button>
              <button
                type="button"
                className={`webtoon-lab__toggle${sourceMode === 'adhoc' ? ' is-active' : ''}`}
                onClick={() => {
                  setSourceMode('adhoc');
                  reset();
                }}
              >
                Ad-hoc JSON
              </button>
            </div>

            {sourceMode === 'fixture' ? (
              <>
                <label htmlFor="fixture-select">Fixture</label>
                <select
                  id="fixture-select"
                  className="webtoon-lab__fixture-select"
                  value={fixtureId}
                  onChange={(e) => {
                    setFixtureId(e.target.value);
                    reset();
                  }}
                >
                  {WEBTOON_FIXTURES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                {fixture && <p>{fixture.description}</p>}
              </>
            ) : (
              <>
                <label htmlFor="adhoc-json">Panels JSON</label>
                <textarea
                  id="adhoc-json"
                  className="webtoon-lab__json-input"
                  placeholder='{"panels":[{"id":"p1","imageUrl":"...","widthType":"full-width","heightClass":"standard","aspectRatio":"3:4","shotType":"medium","gapBefore":{"px":120,"color":"#f4f0e8"},"transition":"cut"}]}'
                  value={adhocJson}
                  onChange={(e) => {
                    setAdhocJson(e.target.value);
                    reset();
                  }}
                />
                {adhocError && <p className="webtoon-lab__error">{adhocError}</p>}
              </>
            )}
          </section>

          <section className="webtoon-lab__card">
            <h3>Viewport</h3>
            <div className="webtoon-lab__toggle-row">
              <button
                type="button"
                className={`webtoon-lab__toggle${viewportMode === 'mobile' ? ' is-active' : ''}`}
                onClick={() => setViewportMode('mobile')}
              >
                Mobile
              </button>
              <button
                type="button"
                className={`webtoon-lab__toggle${viewportMode === 'desktop' ? ' is-active' : ''}`}
                onClick={() => setViewportMode('desktop')}
              >
                Desktop
              </button>
            </div>
            <p>{viewport.label}</p>
          </section>

          <section className="webtoon-lab__card">
            <h3>Panels ({panels.length})</h3>
            <div className="webtoon-lab__meta-list">
              {panels.map((panel, i) => (
                <div key={panel.id ?? i} className="webtoon-lab__meta-item">
                  <strong>{panel.id ?? `#${i + 1}`}</strong> · {panel.widthType} · {panel.heightClass}
                  <small>
                    {panel.shotType} · {panel.aspectRatio} · gap {panel.gapBefore.px}px {panel.gapBefore.color}
                    {panel.isThumbStop && ' · ⭐ thumb-stop'}
                  </small>
                  {panel.bubble && (
                    <small>
                      💬 {panel.bubble.speaker}: {panel.bubble.zh}
                    </small>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="webtoon-lab__card">
            <h3>Share</h3>
            <p>
              Send teammates: <code>{inspectionUrl}</code>
            </p>
            <p>Scrolling strip is standalone — no hangout context required.</p>
          </section>
        </aside>

        <section className="webtoon-lab__stage-wrapper">
          <div
            key={`${runKey}-${viewportMode}-${sourceMode}-${fixtureId}`}
            className={`webtoon-lab__stage webtoon-lab__stage--${viewportMode}`}
            style={{
              width: `${viewport.width}px`,
              height: `${viewport.height}px`,
            }}
          >
            {panels.length > 0 ? (
              <WebtoonStrip panels={panels} />
            ) : (
              <div style={{ padding: 24, color: 'rgba(255,255,255,0.55)' }}>
                {sourceMode === 'adhoc' ? 'Paste panels JSON on the left.' : 'No panels in this fixture.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

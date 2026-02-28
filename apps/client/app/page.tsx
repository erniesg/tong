import Link from 'next/link';
import { getApiBase } from '@/lib/api';

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Tong Hackathon Demo Tracks</p>
        <h1 className="page-title">Review + test all critical demo surfaces</h1>
        <p className="page-copy">
          This workspace now exposes dedicated review routes for caption overlays, mobile game flow, and
          72-hour YouTube/Spotify ingestion insights.
        </p>
      </header>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2>Environment</h2>
            <p>
              Client expects server API at <code>{getApiBase()}</code>.
            </p>
          </div>
          <span className="pill">local-mock ready</span>
        </div>
      </section>

      <section className="grid grid-3">
        <article className="card stack">
          <span className="pill">Web Overlay</span>
          <h3>Caption overlay review</h3>
          <p>Triple-lane subtitle rendering + token dictionary popover with playback simulation controls.</p>
          <Link className="button" href="/overlay">
            Open /overlay
          </Link>
        </article>

        <article className="card stack">
          <span className="pill">Mobile Game UI</span>
          <h3>Session + progression flow</h3>
          <p>Start/resume, city/location, hangout XP/SP/RP updates, and objective-bound learn sessions.</p>
          <Link className="button" href="/game">
            Open /game
          </Link>
        </article>

        <article className="card stack">
          <span className="pill">Ingestion Insights</span>
          <h3>YouTube/Spotify 72h analytics</h3>
          <p>Run mock ingestion and inspect frequency ranking, source breakdown, and topic clusters.</p>
          <Link className="button" href="/insights">
            Open /insights
          </Link>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Chrome extension track</h3>
        <p>
          Load extension from <code>/Users/erniesg/code/erniesg/tong/apps/extension</code> in
          <code>chrome://extensions</code> to test YouTube in-page overlays.
        </p>
      </section>
    </main>
  );
}

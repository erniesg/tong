import Link from 'next/link';

const PUBLIC_DOMAIN = process.env.NEXT_PUBLIC_TONG_PUBLIC_DOMAIN || 'tong.berlayar.ai';
const EXTENSION_ZIP_URL = process.env.NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL || '';
const DEMO_PASSWORD_HINT =
  process.env.NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT || 'Ask the Tong team for the demo password.';
const YOUTUBE_DEMO_URL = process.env.NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

export default function JudgeOnboardingPage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Tong Judge Onboarding</p>
        <h1 className="page-title">Use Tong in under 5 minutes</h1>
        <p className="page-copy">
          This page is the official start point for judges at <code>{PUBLIC_DOMAIN}</code>. Follow the steps below to
          unlock demo access, test web flows, and install the Chrome extension overlay.
        </p>
      </header>

      <section className="card stack" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <h2>Step 1: Unlock Demo Access</h2>
          <span className="pill">required</span>
        </div>
        <ol className="step-list">
          <li>Use the sticky <strong>Demo Access</strong> bar at the top of the page.</li>
          <li>Enter the demo password and click <strong>Save</strong>.</li>
          <li>
            If you need the password, use this hint: <code>{DEMO_PASSWORD_HINT}</code>
          </li>
        </ol>
      </section>

      <section className="grid grid-3">
        <article className="card stack">
          <span className="pill">Step 2A</span>
          <h3>Caption Overlay</h3>
          <p>Validate Korean script + romanization + English lanes and dictionary popover.</p>
          <Link className="button" href="/overlay">
            Open /overlay
          </Link>
        </article>

        <article className="card stack">
          <span className="pill">Step 2B</span>
          <h3>Game Flow</h3>
          <p>Test objective-specific start/resume, hangout turns, and learn session controls.</p>
          <Link className="button" href="/game">
            Open /game
          </Link>
        </article>

        <article className="card stack">
          <span className="pill">Step 2C</span>
          <h3>Insights</h3>
          <p>Inspect 72-hour YouTube/Spotify derived frequency and topic clusters.</p>
          <Link className="button" href="/insights">
            Open /insights
          </Link>
        </article>
      </section>

      <section className="card stack" style={{ marginTop: 16 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <h2>Step 3: Install Chrome Extension</h2>
          <span className="pill">optional</span>
        </div>

        {EXTENSION_ZIP_URL ? (
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <a className="button" href={EXTENSION_ZIP_URL} target="_blank" rel="noreferrer">
              Download extension package
            </a>
          </div>
        ) : (
          <p>
            Extension package link is not configured yet. Set <code>NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL</code> on the
            frontend deployment.
          </p>
        )}

        <ol className="step-list">
          <li>Download and unzip the extension package (or use local <code>apps/extension</code>).</li>
          <li>Open Chrome and go to <code>chrome://extensions</code>.</li>
          <li>Enable <strong>Developer mode</strong>.</li>
          <li>Click <strong>Load unpacked</strong> and select the extracted <code>apps/extension</code> folder.</li>
          <li>
            Open a YouTube page, for example:
            {' '}
            <a href={YOUTUBE_DEMO_URL} target="_blank" rel="noreferrer">
              demo video
            </a>
            .
          </li>
          <li>Verify overlay lanes render and token click opens dictionary info.</li>
        </ol>
      </section>

      <section className="card stack" style={{ marginTop: 16 }}>
        <h3>Quick Links</h3>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            / (this page)
          </Link>
          <Link href="/judges" className="nav-link">
            /judges
          </Link>
          <Link href="/overlay" className="nav-link">
            /overlay
          </Link>
          <Link href="/game" className="nav-link">
            /game
          </Link>
          <Link href="/insights" className="nav-link">
            /insights
          </Link>
        </div>
      </section>
    </main>
  );
}

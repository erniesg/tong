'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  getStoredDemoPassword,
  setStoredDemoPassword,
  clearStoredDemoPassword,
} from '@/lib/api';

const TABS = [
  { href: '/backstage', label: 'Overview', exact: true },
  { href: '/backstage/director', label: 'Director' },
  { href: '/backstage/signals', label: 'Signals' },
  { href: '/backstage/campaigns', label: 'Campaigns' },
  { href: '/backstage/studio', label: 'Studio' },
  { href: '/backstage/playtest', label: 'Playtest' },
  { href: '/backstage/triage', label: 'Triage' },
];

const HINT_TEXT =
  process.env.NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT ||
  'Ask the Tong team for the demo password.';

export default function BackstageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [unlocked, setUnlocked] = useState(false);
  const [showPwInput, setShowPwInput] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check URL query param first
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('demo') || '').trim();
    if (fromQuery) {
      setStoredDemoPassword(fromQuery);
      params.delete('demo');
      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
    }

    const pw = getStoredDemoPassword();
    setUnlocked(!!pw);
    setMounted(true);
  }, []);

  function handleSave() {
    if (!pwInput.trim()) return;
    setStoredDemoPassword(pwInput.trim());
    setUnlocked(true);
    setShowPwInput(false);
    setPwInput('');
  }

  function handleClear() {
    clearStoredDemoPassword();
    setUnlocked(false);
    setPwInput('');
    setShowPwInput(false);
  }

  // Don't render anything until mounted (avoid hydration mismatch)
  if (!mounted) return null;

  return (
    <main className="app-shell">
      <div className="backstage-topbar">
        <h1 className="backstage-logo">Backstage</h1>
        {unlocked && (
          <nav className="backstage-nav">
            {TABS.map((tab) => {
              const active = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`backstage-tab ${active ? 'backstage-tab-active' : ''}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
        <button
          className="backstage-settings-btn"
          onClick={() => setShowPwInput((prev) => !prev)}
          title={unlocked ? 'Password settings' : 'Enter password'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {unlocked ? (
              /* gear icon */
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </>
            ) : (
              /* lock icon */
              <>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Password input popover */}
      {showPwInput && (
        <div className="backstage-pw-popover">
          <input
            type="password"
            value={pwInput}
            placeholder="Enter demo password"
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <button onClick={handleSave} disabled={!pwInput.trim()}>Save</button>
          {unlocked && (
            <button className="secondary" onClick={handleClear}>Clear</button>
          )}
          <p className="backstage-pw-hint">{HINT_TEXT}</p>
        </div>
      )}

      {/* Gate content */}
      {unlocked ? (
        children
      ) : (
        <div className="backstage-locked">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p>Enter the demo password to access Backstage.</p>
          <button className="backstage-unlock-btn" onClick={() => setShowPwInput(true)}>
            Unlock
          </button>
        </div>
      )}
    </main>
  );
}

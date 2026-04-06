'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const TABS = [
  { href: '/backstage', label: 'Overview', exact: true },
  { href: '/backstage/director', label: 'Director' },
  { href: '/backstage/signals', label: 'Signals' },
  { href: '/backstage/campaigns', label: 'Campaigns' },
  { href: '/backstage/playtest', label: 'Playtest' },
  { href: '/backstage/triage', label: 'Triage' },
];

export default function BackstageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-shell">
      <div className="backstage-topbar">
        <h1 className="backstage-logo">Backstage</h1>
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
      </div>
      {children}
    </main>
  );
}

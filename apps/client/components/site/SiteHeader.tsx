'use client';

import Image from 'next/image';
import Link from 'next/link';

import { ROADMAP_PROJECT_URL, ROADMAP_REPO_URL } from '@/lib/content/roadmap';

type SiteHeaderProps = {
  current: 'home' | 'roadmap';
  tone?: 'light' | 'dark';
};

function getNavLinkClassName(isActive: boolean) {
  return `nav-link${isActive ? ' is-active' : ''}`;
}

export default function SiteHeader({ current, tone = 'light' }: SiteHeaderProps) {
  return (
    <nav className={`landing-nav site-header site-header--${tone}`}>
      <Link href="/" className="landing-nav-brand site-brand">
        <span className="site-brand-mark">
          <Image
            src="/assets/app/logo_transparent.png"
            alt="Tong"
            width={30}
            height={30}
            className="landing-nav-logo"
          />
        </span>
        <div className="landing-brand-cycle">
          <span>tōng</span>
          <span>통</span>
          <span>つう</span>
        </div>
      </Link>

      <div className="landing-nav-links">
        <Link href="/" className={getNavLinkClassName(current === 'home')} aria-current={current === 'home' ? 'page' : undefined}>
          Home
        </Link>
        <Link
          href="/roadmap"
          className={getNavLinkClassName(current === 'roadmap')}
          aria-current={current === 'roadmap' ? 'page' : undefined}
        >
          Roadmap
        </Link>
        <a href={ROADMAP_REPO_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
          GitHub
        </a>
        <a href={ROADMAP_PROJECT_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
          Project
        </a>
      </div>
    </nav>
  );
}

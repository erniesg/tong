'use client';

import Image from 'next/image';
import Link from 'next/link';

import { ROADMAP_PROJECT_URL, ROADMAP_REPO_URL } from '@/lib/content/roadmap';

type SiteFooterProps = {
  current: 'home' | 'roadmap';
  variant?: 'home' | 'roadmap';
};

function getNavLinkClassName(isActive: boolean) {
  return `nav-link${isActive ? ' is-active' : ''}`;
}

export default function SiteFooter({ current, variant = current }: SiteFooterProps) {
  return (
    <footer className={`landing-footer site-footer site-footer--${variant}`}>
      <div className="landing-footer-brand site-footer-brand">
        <span className="site-brand-mark site-brand-mark--footer">
          <Image
            src="/assets/app/logo_transparent.png"
            alt="Tong"
            width={30}
            height={30}
            className="landing-nav-logo"
          />
        </span>
        <span>Tong — Live the drama. Learn the language.</span>
      </div>
      <div className="landing-footer-links site-footer-links">
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
        <a href={ROADMAP_PROJECT_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
          Project
        </a>
        <a href={ROADMAP_REPO_URL} target="_blank" rel="noopener noreferrer" className="nav-link">
          GitHub
        </a>
        <span className="landing-footer-sep">&middot;</span>
        <span>
          Built by{' '}
          <a href="https://berlayar.ai" target="_blank" rel="noopener noreferrer">
            Berlayar
          </a>
        </span>
      </div>
    </footer>
  );
}

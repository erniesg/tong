'use client';

import Image from 'next/image';
import Link from 'next/link';

import { SITE_NAV_ITEMS, type SitePage } from '@/components/site/siteNav';

type SiteFooterProps = {
  current: SitePage;
  variant?: SitePage;
};

function getNavLinkClassName(isActive: boolean) {
  return `nav-link${isActive ? ' is-active' : ''}`;
}

export default function SiteFooter({ current, variant = current }: SiteFooterProps) {
  return (
    <footer className={`landing-footer site-footer site-footer--${variant}`}>
      <div className="landing-footer-brand site-footer-brand">
        <Image
          src="/assets/app/logo_trimmed.png"
          alt="Tong"
          width={30}
          height={30}
          className="landing-nav-logo landing-nav-logo--brand"
        />
        <span>Tong — Live the drama. Learn the language.</span>
      </div>
      <div className="landing-footer-links site-footer-links">
        {SITE_NAV_ITEMS.map((item) => {
          const isActive = item.page === current;

          if (item.external) {
            return (
              <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" className="nav-link">
                {item.label}
              </a>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={getNavLinkClassName(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
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

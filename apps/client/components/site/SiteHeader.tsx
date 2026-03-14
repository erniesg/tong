'use client';

import Image from 'next/image';
import Link from 'next/link';

import { SITE_NAV_ITEMS, type SitePage } from '@/components/site/siteNav';

type SiteHeaderProps = {
  current: SitePage;
};

function getNavLinkClassName(isActive: boolean) {
  return `nav-link${isActive ? ' is-active' : ''}`;
}

export default function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <nav className="landing-nav site-header">
      <Link href="/" className="landing-nav-brand site-brand">
        <Image
          src="/assets/app/logo_trimmed.png"
          alt="Tong"
          width={30}
          height={30}
          className="landing-nav-logo"
        />
        <div className="landing-brand-cycle">
          <span>tōng</span>
          <span>통</span>
          <span>つう</span>
        </div>
      </Link>

      <div className="landing-nav-links">
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
      </div>
    </nav>
  );
}

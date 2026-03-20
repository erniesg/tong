'use client';

import Image from 'next/image';
import Link from 'next/link';

import { type SiteNavItem } from '@/components/site/siteNav';

type SiteHeaderProps = {
  className?: string;
  items: SiteNavItem[];
};

export default function SiteHeader({ className = 'landing-nav', items }: SiteHeaderProps) {
  return (
    <nav className={className}>
      <Link href="/" className="landing-nav-brand">
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
        {items.map((item) => {
          if (item.disabled) {
            return (
              <span key={item.key} className={item.className ?? 'nav-link'}>
                {item.label}
              </span>
            );
          }
          if (item.external) {
            return (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={item.className ?? 'nav-link'}
              >
                {item.label}
              </a>
            );
          }

          return (
            <Link key={item.key} href={item.href ?? '/'} className={item.className ?? 'nav-link'}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';

import { type SiteNavItem } from '@/components/site/siteNav';

type SiteFooterProps = {
  className?: string;
  items: SiteNavItem[];
};

export default function SiteFooter({ className = 'landing-footer', items }: SiteFooterProps) {
  return (
    <footer className={className}>
      <Link href="/" className="landing-footer-brand">
        <Image
          src="/assets/app/logo_trimmed.png"
          alt="Tong"
          width={30}
          height={30}
          className="landing-nav-logo"
        />
        <span>Tong — Live the drama. Learn the language.</span>
      </Link>
      <div className="landing-footer-links">
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

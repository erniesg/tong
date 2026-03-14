import { ROADMAP_REPO_URL } from '@/lib/content/roadmap';

export type SiteNavItem = {
  className?: string;
  disabled?: boolean;
  external?: boolean;
  href?: string;
  key: string;
  label: string;
};

export const LANDING_HEADER_ITEMS: SiteNavItem[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'roadmap', label: 'Roadmap', href: '/roadmap' },
  { key: 'github', label: 'GitHub', href: ROADMAP_REPO_URL, external: true },
  { key: 'coming-soon', label: 'Coming Soon', disabled: true, className: 'button landing-play-btn disabled' },
];

export const LANDING_FOOTER_ITEMS: SiteNavItem[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'roadmap', label: 'Roadmap', href: '/roadmap' },
  { key: 'github', label: 'GitHub', href: ROADMAP_REPO_URL, external: true },
];

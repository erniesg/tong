import { ROADMAP_PROJECT_URL, ROADMAP_REPO_URL } from '@/lib/content/roadmap';

export type SiteNavItem = {
  className?: string;
  disabled?: boolean;
  external?: boolean;
  href?: string;
  key: string;
  label: string;
};

export const LANDING_HEADER_ITEMS: SiteNavItem[] = [
  { key: 'roadmap', label: 'Roadmap', href: '/roadmap' },
  { key: 'github', label: 'GitHub', href: ROADMAP_REPO_URL, external: true },
  { key: 'coming-soon', label: 'Coming Soon', disabled: true, className: 'button landing-play-btn disabled' },
];

export const LANDING_FOOTER_ITEMS: SiteNavItem[] = [
  { key: 'roadmap', label: 'Roadmap', href: '/roadmap' },
  { key: 'project', label: 'Project', href: ROADMAP_PROJECT_URL, external: true },
  { key: 'github', label: 'GitHub', href: ROADMAP_REPO_URL, external: true },
];

export const ROADMAP_HEADER_ITEMS: SiteNavItem[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'github-repo', label: 'GitHub Repo', href: ROADMAP_REPO_URL, external: true },
  { key: 'github-project', label: 'GitHub Project', href: ROADMAP_PROJECT_URL, external: true },
];

import { ROADMAP_PROJECT_URL, ROADMAP_REPO_URL } from '@/lib/content/roadmap';

export type SitePage = 'home' | 'roadmap';

export type SiteNavItem = {
  href: string;
  label: string;
  key: 'home' | 'roadmap' | 'project' | 'github';
  external?: boolean;
  page?: SitePage;
};

export const SITE_NAV_ITEMS: SiteNavItem[] = [
  { key: 'home', label: 'Home', href: '/', page: 'home' },
  { key: 'roadmap', label: 'Roadmap', href: '/roadmap', page: 'roadmap' },
  { key: 'project', label: 'Project', href: ROADMAP_PROJECT_URL, external: true },
  { key: 'github', label: 'GitHub', href: ROADMAP_REPO_URL, external: true },
];

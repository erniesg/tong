'use client';

import Link from 'next/link';

const SECTIONS = [
  {
    href: '/backstage/director',
    title: 'Director',
    description: 'Generate locations, NPCs, backdrops, and hangout scripts per city.',
    status: 'active',
  },
  {
    href: '/backstage/webtoon-lab',
    title: 'Webtoon Lab',
    description: 'Panel layout harness for Shanghai H1. Test gaps, widths, bubbles, and placeholder vs real art.',
    status: 'active',
  },
  {
    href: '/backstage/panorama-lab',
    title: 'Panorama Lab',
    description: 'Non-production cinematic harness for panorama panning and overlay anchor behavior.',
    status: 'active',
  },
  {
    href: '/backstage/signals',
    title: 'Signals',
    description: 'Social media intelligence — trending formats, sounds, aesthetics from TikTok/IG/XHS.',
    status: 'active',
  },
  {
    href: '/backstage/campaigns',
    title: 'Campaigns',
    description: 'AI-driven campaign ideation — trend data + game assets = platform-ready content.',
    status: 'active',
  },
  {
    href: '/backstage/triage',
    title: 'Triage',
    description: 'Playtest session analysis — Gemini video understanding, issue extraction, auto-fix pipeline.',
    status: 'active',
  },
];

export default function BackstageOverview() {
  return (
    <div className="backstage-overview">
      <div className="backstage-overview-header">
        <h2 className="backstage-overview-title">Admin Hub</h2>
        <p className="backstage-overview-subtitle">
          Content generation, platform intelligence, campaign production, and QA triage.
        </p>
      </div>
      <div className="backstage-cards">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="backstage-card">
            <h3 className="backstage-card-title">{s.title}</h3>
            <p className="backstage-card-desc">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

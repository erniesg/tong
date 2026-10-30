import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tong — 홍대 한 바퀴 (cozy 3D Seoul)',
  description: 'A cozy, walkable 3D Seoul neighbourhood with day and night: order coffee, buy banana milk, watch the Han River and share tteokbokki with Ha-eun.',
};

/**
 * The cozy 3D Seoul neighbourhood is a self-contained Three.js game in
 * public/cozy/ so it can run without extra bundle dependencies.
 */
export default function CozyPojangmachaPage() {
  return <iframe className="cozy-frame" src="/cozy/index.html" title="홍대 한 바퀴 — cozy 3D Seoul" allow="autoplay; fullscreen" />;
}

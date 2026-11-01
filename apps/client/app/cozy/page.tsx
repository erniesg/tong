import type { Metadata, Viewport } from 'next';
import { CozyHost } from '@/components/cozy/CozyHost';

export const metadata: Metadata = {
  title: 'Tong — 홍대 한 바퀴 (cozy 3D Seoul)',
  description: 'A cozy, walkable 3D Seoul neighbourhood with day and night: order coffee, buy banana milk, watch the Han River and share tteokbokki with Ha-eun.',
};

// Full-bleed game: let the page reach under notches; CozyHost passes the insets to the game.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * The cozy 3D Seoul neighbourhood is a self-contained Three.js game in
 * public/cozy/. CozyHost runs it in an iframe and bridges it to the shared
 * progress store and exercise components.
 */
export default function CozyPojangmachaPage() {
  return <CozyHost />;
}

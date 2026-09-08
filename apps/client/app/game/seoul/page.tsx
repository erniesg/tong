import type { Metadata } from 'next';
import SeoulAdventure from '@/components/seoul-world/SeoulAdventure';

export const metadata: Metadata = {
  title: 'Seoul at your own pace | TONG',
  description: 'A cozy Korean language adventure in Seoul.',
};

export default function SeoulAdventurePage() {
  return <SeoulAdventure />;
}

import type { Metadata } from 'next';
import DemoPasswordBar from '@/components/demo-password-bar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tong Hackathon Demo',
  description:
    'Review harness for YouTube caption overlays, mobile game UI, and YouTube/Spotify ingestion insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoPasswordBar />
        {children}
      </body>
    </html>
  );
}

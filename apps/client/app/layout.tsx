import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tong — Learn CJK by living in them',
  description:
    'An open-source game that drops you into the streets of Seoul, Shanghai and Tokyo — where every conversation teaches you something new.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import { loadHydratedRuntimeAssetManifest } from '@/lib/runtime-assets.server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tong — Learn CJK by living in them',
  description:
    'An open-source game that drops you into the streets of Seoul, Shanghai and Tokyo — where every conversation teaches you something new.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const runtimeAssetManifest = await loadHydratedRuntimeAssetManifest();
  const serializedRuntimeAssetManifest = JSON.stringify(runtimeAssetManifest).replace(/</g, '\\u003c');

  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__TONG_RUNTIME_ASSET_MANIFEST__=${serializedRuntimeAssetManifest};`,
          }}
        />
        {children}
      </body>
    </html>
  );
}

import 'server-only';

import runtimeAssetManifestJson from '../../../assets/manifest/runtime-asset-manifest.json';
import {
  buildRuntimeAssetManifestUrl,
  isRuntimeAssetManifest,
  DEFAULT_RUNTIME_ASSET_MANIFEST_KEY,
  type RuntimeAssetManifest,
} from '@/lib/runtime-assets-contract';

const fallbackRuntimeAssetManifest = runtimeAssetManifestJson as RuntimeAssetManifest;

export function getRuntimeAssetManifestPublicUrl(): string | null {
  return buildRuntimeAssetManifestUrl(
    process.env.NEXT_PUBLIC_TONG_ASSETS_BASE_URL,
    process.env.TONG_RUNTIME_ASSET_MANIFEST_KEY || DEFAULT_RUNTIME_ASSET_MANIFEST_KEY,
  );
}

export async function loadHydratedRuntimeAssetManifest(): Promise<RuntimeAssetManifest> {
  const manifestUrl = getRuntimeAssetManifestPublicUrl();
  if (!manifestUrl) return fallbackRuntimeAssetManifest;

  try {
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'tong-client-runtime-assets/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Manifest fetch failed with ${response.status}`);
    }

    const manifest = await response.json();
    if (isRuntimeAssetManifest(manifest)) {
      return manifest;
    }
  } catch (error) {
    console.warn('[runtime-assets] Falling back to bundled manifest.', error);
  }

  return fallbackRuntimeAssetManifest;
}

import runtimeAssetManifestJson from '../../../assets/manifest/runtime-asset-manifest.json';

type RuntimeAssetManifestEntry = {
  key: string;
  uri: string;
};

type RuntimeAssetLookup = {
  manifestKey: string;
  manifestUri: string;
  assetPath: string;
  r2ObjectKey: string;
};

type RuntimeAssetManifest = {
  assets: RuntimeAssetManifestEntry[];
};

const runtimeAssetManifest = runtimeAssetManifestJson as RuntimeAssetManifest;
const runtimeAssetLookupByPath = buildRuntimeAssetLookupByPath(runtimeAssetManifest);

function safePathFromUri(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }

  pathname = pathname.replace(/^\/+/, '');
  if (pathname.startsWith('assets/')) {
    pathname = pathname.slice('assets/'.length);
  }

  if (!pathname || pathname.includes('..')) return null;
  return pathname;
}

function normalizeAssetRoutePath(rawPath: string): string | null {
  const normalized = rawPath.trim().replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return null;
  return normalized.startsWith('assets/') ? normalized.slice('assets/'.length) : normalized;
}

function buildRuntimeAssetLookupByPath(manifest: RuntimeAssetManifest): Map<string, RuntimeAssetLookup> {
  const lookup = new Map<string, RuntimeAssetLookup>();

  for (const asset of manifest.assets || []) {
    const assetPath = safePathFromUri(String(asset.uri || ''));
    if (!assetPath) continue;

    lookup.set(assetPath, {
      manifestKey: String(asset.key || ''),
      manifestUri: String(asset.uri || ''),
      assetPath,
      r2ObjectKey: `assets/${assetPath}`,
    });
  }

  return lookup;
}

export function resolveRuntimeAssetForProxy(rawPath: string): RuntimeAssetLookup | null {
  const normalizedPath = normalizeAssetRoutePath(rawPath);
  if (!normalizedPath) return null;
  return runtimeAssetLookupByPath.get(normalizedPath) || null;
}

export function guessContentTypeFromAssetPath(assetPath: string): string {
  const ext = assetPath.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

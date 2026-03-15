export interface RuntimeAssetManifestEntry {
  key: string;
  uri: string;
  type: string;
  usage: string;
  source: string;
  status: string;
}

export interface RuntimeAssetManifest {
  manifestVersion: string;
  owner: string;
  keyFormat: string;
  sourceManifest: string;
  notes: string;
  assets: RuntimeAssetManifestEntry[];
}

export const DEFAULT_RUNTIME_ASSET_MANIFEST_KEY = 'runtime-assets/manifest.json';

export function normalizeAssetBaseUrl(baseUrl?: string | null): string | null {
  if (!baseUrl) return null;

  const trimmed = baseUrl.trim();
  if (!trimmed) return null;

  return trimmed.replace(/\/+$/, '');
}

export function buildRuntimeAssetManifestUrl(baseUrl?: string | null, manifestKey?: string | null): string | null {
  const normalizedBaseUrl = normalizeAssetBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return null;

  const trimmedKey = manifestKey?.trim().replace(/^\/+/, '') || DEFAULT_RUNTIME_ASSET_MANIFEST_KEY;
  if (!trimmedKey) return null;

  return `${normalizedBaseUrl}/${trimmedKey}`;
}

function isRuntimeAssetManifestEntry(value: unknown): value is RuntimeAssetManifestEntry {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.uri === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.usage === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.status === 'string'
  );
}

export function isRuntimeAssetManifest(value: unknown): value is RuntimeAssetManifest {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.manifestVersion === 'string' &&
    typeof candidate.owner === 'string' &&
    typeof candidate.keyFormat === 'string' &&
    typeof candidate.sourceManifest === 'string' &&
    typeof candidate.notes === 'string' &&
    Array.isArray(candidate.assets) &&
    candidate.assets.every(isRuntimeAssetManifestEntry)
  );
}

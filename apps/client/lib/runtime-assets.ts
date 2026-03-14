import runtimeAssetManifestJson from '../../../assets/manifest/runtime-asset-manifest.json';

interface RuntimeAssetManifestEntry {
  key: string;
  uri: string;
  type: string;
  usage: string;
  source: string;
  status: string;
}

interface RuntimeAssetManifest {
  manifestVersion: string;
  owner: string;
  keyFormat: string;
  sourceManifest: string;
  notes: string;
  assets: RuntimeAssetManifestEntry[];
}

const runtimeAssetManifest = runtimeAssetManifestJson as RuntimeAssetManifest;
const runtimeAssetsByKey = new Map(runtimeAssetManifest.assets.map((asset) => [asset.key, asset] as const));
const runtimeAssetBaseUrl = normalizeAssetBaseUrl(process.env.NEXT_PUBLIC_TONG_ASSETS_BASE_URL);

function normalizeAssetBaseUrl(baseUrl?: string): string | null {
  if (!baseUrl) return null;

  const trimmed = baseUrl.trim();
  if (!trimmed) return null;

  return trimmed.replace(/\/+$/, '');
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function joinAssetBase(pathname: string): string {
  if (!runtimeAssetBaseUrl) return pathname;

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${runtimeAssetBaseUrl}${normalizedPath}`;
}

export function hasRuntimeAssetKey(key: string): boolean {
  return runtimeAssetsByKey.has(key);
}

export function getRuntimeAssetEntry(key: string): RuntimeAssetManifestEntry | null {
  return runtimeAssetsByKey.get(key) ?? null;
}

export function resolveRuntimeAssetUrl(ref?: string | null): string {
  if (!ref) return '';

  const trimmed = ref.trim();
  if (!trimmed) return '';

  const manifestEntry = runtimeAssetsByKey.get(trimmed);
  if (manifestEntry) {
    return resolveRuntimeAssetUrl(manifestEntry.uri);
  }

  if (isAbsoluteUrl(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/assets/')) {
    return joinAssetBase(trimmed);
  }

  if (trimmed.startsWith('assets/')) {
    return joinAssetBase(trimmed);
  }

  return trimmed;
}

export function resolveRuntimeAssetUrls(refs: Array<string | null | undefined>): string[] {
  const urls = refs
    .map((ref) => resolveRuntimeAssetUrl(ref))
    .filter((ref): ref is string => Boolean(ref));

  return [...new Set(urls)];
}

export function resolveCharacterAssetUrl(pathSegment?: string | null): string {
  if (!pathSegment) return '';
  return resolveRuntimeAssetUrl(`assets/characters/${pathSegment}`);
}

export function runtimeAssetUrl(key: string, fallbackRef?: string): string {
  const manifestEntry = runtimeAssetsByKey.get(key);
  if (manifestEntry) {
    return resolveRuntimeAssetUrl(manifestEntry.uri);
  }

  if (fallbackRef) {
    return resolveRuntimeAssetUrl(fallbackRef);
  }

  throw new Error(`Unknown runtime asset key: ${key}`);
}

export function getRuntimeAssetManifest(): RuntimeAssetManifest {
  return runtimeAssetManifest;
}

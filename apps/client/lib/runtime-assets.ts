import runtimeAssetManifestJson from '../../../assets/manifest/runtime-asset-manifest.json';
import {
  isRuntimeAssetManifest,
  normalizeAssetBaseUrl,
  type RuntimeAssetManifest,
  type RuntimeAssetManifestEntry,
} from '@/lib/runtime-assets-contract';

declare global {
  var __TONG_RUNTIME_ASSET_MANIFEST__: RuntimeAssetManifest | undefined;
}

const fallbackRuntimeAssetManifest = runtimeAssetManifestJson as RuntimeAssetManifest;
const runtimeAssetBaseUrl = normalizeAssetBaseUrl(process.env.NEXT_PUBLIC_TONG_ASSETS_BASE_URL);

let activeRuntimeAssetManifest = fallbackRuntimeAssetManifest;
let activeRuntimeAssetsByKey = buildRuntimeAssetsByKey(fallbackRuntimeAssetManifest);

function buildRuntimeAssetsByKey(manifest: RuntimeAssetManifest): Map<string, RuntimeAssetManifestEntry> {
  return new Map(manifest.assets.map((asset) => [asset.key, asset] as const));
}

function readHydratedRuntimeAssetManifest(): RuntimeAssetManifest | null {
  if (typeof globalThis === 'undefined') return null;

  const candidate = globalThis.__TONG_RUNTIME_ASSET_MANIFEST__;
  return isRuntimeAssetManifest(candidate) ? candidate : null;
}

function ensureRuntimeAssetManifest(): RuntimeAssetManifest {
  const hydratedManifest = readHydratedRuntimeAssetManifest();

  if (hydratedManifest && hydratedManifest !== activeRuntimeAssetManifest) {
    activeRuntimeAssetManifest = hydratedManifest;
    activeRuntimeAssetsByKey = buildRuntimeAssetsByKey(hydratedManifest);
  }

  return activeRuntimeAssetManifest;
}

function runtimeAssetsByKey(): ReadonlyMap<string, RuntimeAssetManifestEntry> {
  ensureRuntimeAssetManifest();
  return activeRuntimeAssetsByKey;
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function normalizeAssetPathname(pathname: string): string {
  if (!pathname) return '';
  if (pathname.startsWith('/assets/')) return pathname;
  if (pathname.startsWith('assets/')) return `/${pathname}`;
  return pathname;
}

function joinAssetBase(pathname: string): string {
  if (!runtimeAssetBaseUrl) return pathname;

  const normalizedPath = normalizeAssetPathname(pathname);
  return `${runtimeAssetBaseUrl}${normalizedPath}`;
}

function assetPathFromResolvedUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/assets/') || trimmed.startsWith('assets/')) {
    return normalizeAssetPathname(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname.startsWith('/assets/')) {
      return null;
    }
    if (runtimeAssetBaseUrl) {
      const normalizedBase = new URL(`${runtimeAssetBaseUrl}/`);
      if (parsed.origin !== normalizedBase.origin) {
        return null;
      }
    }
    return parsed.pathname;
  } catch {
    return null;
  }
}

export function hasRuntimeAssetKey(key: string): boolean {
  return runtimeAssetsByKey().has(key);
}

export function getRuntimeAssetEntry(key: string): RuntimeAssetManifestEntry | null {
  return runtimeAssetsByKey().get(key) ?? null;
}

export function resolveRuntimeAssetUrl(ref?: string | null): string {
  if (!ref) return '';

  const trimmed = ref.trim();
  if (!trimmed) return '';

  const manifestEntry = runtimeAssetsByKey().get(trimmed);
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

export function runtimeAssetLocalUrl(ref?: string | null): string {
  if (!ref) return '';

  const trimmed = ref.trim();
  if (!trimmed) return '';

  const manifestEntry = runtimeAssetsByKey().get(trimmed);
  if (manifestEntry) {
    return runtimeAssetLocalUrl(manifestEntry.uri);
  }

  const assetPath = assetPathFromResolvedUrl(trimmed);
  return assetPath ?? trimmed;
}

export function runtimeAssetCandidateUrls(ref?: string | null): string[] {
  if (!ref) return [];

  const resolved = resolveRuntimeAssetUrl(ref);
  const local = runtimeAssetLocalUrl(ref);

  return [...new Set([resolved, local].filter(Boolean))];
}

export function fallbackRuntimeAssetUrl(resolvedUrl?: string | null): string {
  if (!resolvedUrl) return '';
  const assetPath = assetPathFromResolvedUrl(resolvedUrl);
  return assetPath ?? '';
}

export function fallbackRuntimeAssetCandidates(resolvedUrl?: string | null): string[] {
  if (!resolvedUrl) return [];
  const fallback = fallbackRuntimeAssetUrl(resolvedUrl);
  return [...new Set([resolvedUrl, fallback].filter(Boolean))];
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
  const manifestEntry = runtimeAssetsByKey().get(key);
  if (manifestEntry) {
    return resolveRuntimeAssetUrl(manifestEntry.uri);
  }

  if (fallbackRef) {
    return resolveRuntimeAssetUrl(fallbackRef);
  }

  throw new Error(`Unknown runtime asset key: ${key}`);
}

export function getRuntimeAssetManifest(): RuntimeAssetManifest {
  return ensureRuntimeAssetManifest();
}

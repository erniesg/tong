const DOMAIN_TO_API: Record<string, string> = {
  'tong.berlayar.ai': 'https://tong-api.erniesg.workers.dev',
  'staging.tong.berlayar.ai': 'https://tong-api.erniesg.workers.dev',
};

export function getPublicApiBase(): string {
  if (process.env.NEXT_PUBLIC_TONG_API_BASE) {
    return process.env.NEXT_PUBLIC_TONG_API_BASE;
  }

  if (typeof window !== 'undefined') {
    const mapped = DOMAIN_TO_API[window.location.hostname];
    if (mapped) return mapped;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8787';
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:8787`;
}

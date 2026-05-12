const PROD_API_HOSTS: Record<string, string> = {
  'tong.berlayar.ai': 'https://tong-api.erniesg.workers.dev',
};

export function getPublicApiBase(): string {
  if (process.env.NEXT_PUBLIC_TONG_API_BASE) {
    return process.env.NEXT_PUBLIC_TONG_API_BASE;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8787';
  }

  const prodBase = PROD_API_HOSTS[window.location.hostname];
  if (prodBase) return prodBase;

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:8787`;
}

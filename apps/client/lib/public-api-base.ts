const PRODUCTION_API = 'https://tong-api.erniesg.workers.dev';

const KNOWN_DOMAINS: Record<string, string> = {
  'tong.berlayar.ai': PRODUCTION_API,
  'staging.tong.berlayar.ai': PRODUCTION_API,
};

export function getPublicApiBase(): string {
  if (process.env.NEXT_PUBLIC_TONG_API_BASE) {
    return process.env.NEXT_PUBLIC_TONG_API_BASE;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8787';
  }

  const hostname = window.location.hostname;

  if (KNOWN_DOMAINS[hostname]) {
    return KNOWN_DOMAINS[hostname];
  }

  if (hostname.endsWith('.tong-berlayar-web.pages.dev')) {
    return PRODUCTION_API;
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${hostname}:8787`;
}

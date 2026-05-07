const PROD_API_BASE = 'https://tong-api.erniesg.workers.dev';
const PROD_HOSTNAME = 'tong.berlayar.ai';

export function getPublicApiBase(): string {
  if (process.env.NEXT_PUBLIC_TONG_API_BASE) {
    return process.env.NEXT_PUBLIC_TONG_API_BASE;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8787';
  }

  if (window.location.hostname === PROD_HOSTNAME) {
    return PROD_API_BASE;
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:8787`;
}

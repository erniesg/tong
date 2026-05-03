const PROD_API = 'https://tong-api.erniesg.workers.dev';
const PROD_HOSTS = ['tong.berlayar.ai', 'staging.tong.berlayar.ai'];

export function getPublicApiBase(): string {
  if (process.env.NEXT_PUBLIC_TONG_API_BASE) {
    return process.env.NEXT_PUBLIC_TONG_API_BASE;
  }

  if (typeof window !== 'undefined' && PROD_HOSTS.includes(window.location.hostname)) {
    return PROD_API;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8787';
  }

  return `${window.location.protocol}//${window.location.hostname}:8787`;
}

export function getPublicApiBase(): string {
  if (process.env.NEXT_PUBLIC_TONG_API_BASE) {
    return process.env.NEXT_PUBLIC_TONG_API_BASE;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8787';
  }

  const host = window.location.hostname;
  if (host === 'tong.berlayar.ai' || host === 'staging.tong.berlayar.ai') {
    return 'https://tong-api.erniesg.workers.dev';
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${host}:8787`;
}

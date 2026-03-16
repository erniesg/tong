import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

function buildAssetRemotePattern(baseUrl) {
  if (!baseUrl) return null;

  try {
    const parsed = new URL(baseUrl);
    return {
      protocol: parsed.protocol.replace(':', ''),
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: '/assets/**',
    };
  } catch {
    return null;
  }
}

const assetRemotePattern = buildAssetRemotePattern(
  process.env.NEXT_PUBLIC_TONG_ASSETS_BASE_URL || 'https://assets.tong.berlayar.ai',
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  images: assetRemotePattern
    ? {
        remotePatterns: [assetRemotePattern],
      }
    : undefined,
};

export default nextConfig;

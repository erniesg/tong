try {
  const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
} catch {
  // OpenNext Cloudflare adapter unavailable or broken — skip for local dev
}

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

const isStaticExportBuild = process.env.TONG_BUILD_MODE === 'static-export';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isStaticExportBuild ? 'export' : 'standalone',
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  images: assetRemotePattern
    ? {
        remotePatterns: [assetRemotePattern],
        unoptimized: isStaticExportBuild,
      }
    : isStaticExportBuild
      ? { unoptimized: true }
      : undefined,
};

export default nextConfig;

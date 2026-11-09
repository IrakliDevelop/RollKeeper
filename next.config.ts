import type { NextConfig } from "next";

const NO_REFERRER = [{ key: 'Referrer-Policy', value: 'no-referrer' }];

const nextConfig: NextConfig = {
  experimental: {
    // Recompile production assets instead of restoring persisted compiler output.
    // Development keeps its separate default cache.
    turbopackFileSystemCacheForBuild: false,
  },
  // `/` is a static page built from the React launcher by
  // scripts/build-launcher.mjs, so it ships no React or Next.js runtime.
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/launcher.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rollkeeper-images.s3.eu-central-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // PR05 E8: display pages that hold a display credential never send a
  // Referer (the credential itself is never in a URL that reaches a server).
  async headers() {
    return [
      { source: '/table-display/:path*', headers: NO_REFERRER },
      {
        source: '/dm/campaign/:code/battlemaps/:id/display',
        headers: NO_REFERRER,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

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
};

export default nextConfig;

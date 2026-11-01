import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Recompile production assets instead of restoring persisted compiler output.
    // Development keeps its separate default cache.
    turbopackFileSystemCacheForBuild: false,
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rollkeeper-images.s3.eu-central-1.amazonaws.com',
        port: '',
        pathname: '/avatars/**',
      },
    ],
  },
  outputFileTracingIncludes: {
    '/**': ['./json/**'],
  },
};

export default nextConfig;

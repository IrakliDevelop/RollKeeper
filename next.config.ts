import type { NextConfig } from "next";

const NO_REFERRER = [{ key: 'Referrer-Policy', value: 'no-referrer' }];

const nextConfig: NextConfig = {
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

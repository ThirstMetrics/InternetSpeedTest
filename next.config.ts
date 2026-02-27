import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  headers: async () => [
    {
      // Prevent Varnish from caching HTML pages for too long
      source: '/((?!_next/static|test-files).*)',
      headers: [
        { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=30' },
      ],
    },
  ],
};

export default nextConfig;

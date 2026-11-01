import type { NextConfig } from 'next';

const apiOrigin = process.env.API_URL ?? 'http://127.0.0.1:4307';

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${apiOrigin}/:path*` }];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;

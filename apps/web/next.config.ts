import type { NextConfig } from 'next';

const apiOrigin = process.env.API_URL ?? 'http://127.0.0.1:4307';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    turbopackFileSystemCacheForDev: process.env.FABLE_DISABLE_COMPILER_CACHE !== '1',
    turbopackFileSystemCacheForBuild: process.env.FABLE_DISABLE_COMPILER_CACHE !== '1',
  },
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

import type { NextConfig } from 'next';

/**
 * `/api/*` is rewritten in `proxy.ts` to Adonis (`API_INTERNAL_URL`) so session
 * cookies stay first-party on the web origin. Required — no localhost default.
 */
if (!process.env.API_INTERNAL_URL?.trim()) {
  throw new Error('API_INTERNAL_URL is required (Adonis origin for Next /api rewrites)');
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@elynd/shared'],
};

export default nextConfig;

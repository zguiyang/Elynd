import type { NextConfig } from 'next';

/**
 * `/api/*` is rewritten in `proxy.ts` to Adonis (`API_INTERNAL_URL`, default
 * `http://localhost:3333`) so session cookies stay first-party on the web origin.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@elynd/shared'],
};

export default nextConfig;

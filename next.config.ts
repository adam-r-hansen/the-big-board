import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Don’t run ESLint as part of `next build` (Vercel deploys).
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep type-checks ON (build will still fail for TS errors).
    ignoreBuildErrors: false,
  },
}

export default nextConfig

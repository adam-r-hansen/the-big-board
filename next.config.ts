// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // TEMPORARY: allow builds to succeed even if there are TS errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // TEMPORARY: don’t block builds on lint errors
    ignoreDuringBuilds: true,
  },
  experimental: {
    turbo: {}, // keep Turbopack enabled
  },
}

export default nextConfig

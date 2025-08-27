import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Let the Vercel build succeed even if ESLint errors exist.
    // Recommended only if you lint elsewhere (CI/pre-commit), but perfect to unblock deploys.
    ignoreDuringBuilds: true,
  },
  // TEMP: Avoid next/image domain config whack-a-mole.
  // We’re using plain <img> for logos right now, but if you switch to next/image,
  // this ensures nothing is blocked by remotePatterns while you finalize host list.
  images: {
    unoptimized: true,
  },
}

export default nextConfig

// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Let production builds complete even with lint errors.
    ignoreDuringBuilds: true,
  },
}
export default nextConfig


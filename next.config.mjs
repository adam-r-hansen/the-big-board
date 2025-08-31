/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Do not fail the production build on ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // CI/CD: don’t run ESLint during `next build`
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;


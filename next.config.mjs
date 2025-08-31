// next.config.mjs
const supa = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const host = supa ? new URL(supa).hostname : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: host ? [
      { protocol: 'https', hostname: host, pathname: '/storage/v1/object/public/**' },
      // If you have other CDNs/domains for team logos, add them here:
      // { protocol: 'https', hostname: 'a.espncdn.com', pathname: '/**' },
    ] : [],
  },
};
export default nextConfig;


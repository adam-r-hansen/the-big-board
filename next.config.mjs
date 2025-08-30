/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase storage & public buckets
      { protocol: 'https', hostname: '**.supabase.co' },
      // If you ever point logos to ESPN or NFL CDNs, these keep working:
      { protocol: 'https', hostname: 'a.espncdn.com' },
      { protocol: 'https', hostname: 'static.www.nfl.com' },
    ],
  },
};
export default nextConfig;


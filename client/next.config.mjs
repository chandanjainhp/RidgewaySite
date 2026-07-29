/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for client/Dockerfile runtime (node server.js from .next/standalone)
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Proxy API calls to the Express server so the browser stays same-origin
  // (cookies + single Cloudflare hostname). Prefer API_UPSTREAM_URL for
  // container networking (http://server:8000); fall back to NEXT_PUBLIC_API_URL
  // for local SSR / legacy configs.
  async rewrites() {
    const upstream =
      process.env.API_UPSTREAM_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${upstream}/api/v1/:path*`,
      },
    ];
  },
}

export default nextConfig


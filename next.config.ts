import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // output: 'export', // Removed to enable server-side rendering, API routes, and fix issues with dynamic routes like [gameId] not having generateStaticParams.
};

export default nextConfig;

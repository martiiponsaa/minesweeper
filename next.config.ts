import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // This line was present and commented as "Removed to enable server-side rendering and API routes"
  // Removing it entirely to ensure standard Next.js behavior.
};

export default nextConfig;

import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
       {
         protocol: 'https',
         hostname: 'www.gstatic.com', // Add gstatic.com for Firebase provider icons
         port: '',
         pathname: '/**',
       },
    ],
  },
};

export default nextConfig;

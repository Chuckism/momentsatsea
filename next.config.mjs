import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
  dest: 'public',
  register: false,        // Capacitor handles app lifecycle
  skipWaiting: false,
  disable: isDev,         // PWA disabled in dev
})({
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Required for Capacitor: prevents Next from trying to optimize images
  images: {
    unoptimized: true,
  },

  // Required so static assets export clearly for Capacitor webDir
  output: 'export',

  // Ensures API routes still work in dev
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost'],
    },
  },
});

export default nextConfig;

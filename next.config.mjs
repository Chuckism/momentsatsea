import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
  dest: 'public',
  
  // ✅ CRITICAL CHANGES: Enable PWA for proper offline support
  register: true,         // CHANGED from false - registers service worker
  skipWaiting: true,      // CHANGED from false - activates new SW immediately
  disable: false,         // CHANGED from isDev - always active (even in dev for testing)
  
  // ✅ FIXED: Runtime caching strategy for permanent offline support
  runtimeCaching: [
    {
      urlPattern: /^https?.*/, // Cache all network requests
      handler: 'NetworkFirst', // ✅ FIXED: Changed from CacheFirst to NetworkFirst
      options: {
        cacheName: 'moments-offline-cache',
        networkTimeoutSeconds: 3, // Give up on network after 3 seconds, use cache
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year - never expires during cruise
        },
      },
    },
  ],
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
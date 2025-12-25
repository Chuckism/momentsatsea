const CACHE_NAME = 'moments-v1';
const OFFLINE_URL = '/offline.html';

// Install: Pre-cache critical files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll([
          '/',
          '/index.html',
          '/offline.html',
          '/manifest.webmanifest',
          '/icon-192.png',
          '/icon-512.png',
        ]);
      })
      .then(() => {
        console.log('[SW] Installed, skipping waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Install failed:', err);
      })
  );
});

// Activate: Take control and clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((names) => {
        return Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim(),
    ]).then(() => {
      console.log('[SW] Activated and claimed clients');
    })
  );
});

// Fetch: Handle all requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // CRITICAL: Navigation requests (page loads)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the page for next time
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: return cached index.html
          console.log('[SW] Offline navigation, serving cached index.html');
          return caches.match('/index.html')
            .then((cached) => {
              if (cached) {
                return cached;
              }
              // Fallback to offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // All other requests: Cache-first with network update
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        // Return cached immediately if available
        if (cached) {
          console.log('[SW] Serving from cache:', url.pathname);
          
          // Update cache in background
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response.clone());
                });
              }
            })
            .catch(() => {
              // Offline, that's fine - we have cache
            });
          
          return cached;
        }

        // Not cached: fetch from network and cache
        console.log('[SW] Fetching from network:', url.pathname);
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', url.pathname, error);
            throw error;
          });
      })
  );
});
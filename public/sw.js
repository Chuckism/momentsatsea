const CACHE_NAME = "mas-v18";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/globals.css",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // STRATEGY: Cache-First for EVERYTHING
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 1. If found in cache, serve it immediately - NO NETWORK CHECK
      if (cached) return cached;

      // 2. If not in cache, fetch from network and SAVE IT
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => {
        // 3. FINAL FALLBACK: For page navigations, always return root
        if (event.request.mode === "navigate") {
          return caches.match("/");
        }
      });
    })
  );
});
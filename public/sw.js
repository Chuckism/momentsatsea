const CACHE_NAME = "mas-v20";
const OFFLINE_ASSETS = ["/", "/globals.css", "/manifest.webmanifest", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 1. Serve from cache immediately if we have it
      if (cached) return cached;

      // 2. Otherwise, try the network
      return fetch(event.request).then((res) => {
        // Cache new stuff as we go
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return res;
      }).catch(() => {
        // 3. If network fails and it's a page, show the "Enter Journal" bridge
        if (event.request.mode === "navigate") {
          return caches.match("/offline.html");
        }
      });
    })
  );
});
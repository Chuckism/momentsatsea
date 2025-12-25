const CACHE_NAME = "mas-v17";
const ASSETS = ["/", "/index.html", "/globals.css", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
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
      // If we have it, return it immediately (No waiting for network!)
      if (cached) return cached;

      // If not in cache, try network
      return fetch(event.request).then((response) => {
        let copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => {
        // If everything fails, show the home page
        return caches.match("/");
      });
    })
  );
});
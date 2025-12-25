const CACHE_NAME = "mas-v21"; // Changed version
const OFFLINE_ASSETS = ["/", "/globals.css", "/manifest.webmanifest", "/offline.html"];

self.addEventListener("install", (e) => {
  // Force the new service worker to become the active one immediately
  self.skipWaiting(); 
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(OFFLINE_ASSETS)));
});

self.addEventListener("activate", (e) => {
  // Take control of all open tabs immediately
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((ks) => Promise.all(ks.map((k) => k !== CACHE_NAME && caches.delete(k))))
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return res;
      }).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("/offline.html");
        }
      });
    })
  );
});
/* ============================
   MomentsAtSea - PWA Service Worker (v11)
   The "Full Visuals" Offline Version
   ============================ */

   const CACHE_VERSION = "mas-shell-v11"; 
   const CACHE_NAME = CACHE_VERSION;
   
   const PRECACHE_ASSETS = [
     "/",
     "/index.html",
     "/offline.html",
     "/manifest.webmanifest",
     "/globals.css",
     "/icon-192.png",
     "/icon-512.png",
     "/favicon.ico"
   ];
   
   self.addEventListener("install", (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
     );
     self.skipWaiting();
   });
   
   self.addEventListener("activate", (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
       )
     );
     self.clients.claim();
   });
   
   self.addEventListener("fetch", (event) => {
     const { request } = event;
     if (request.method !== "GET") return;
   
     // 1. Navigation
     if (request.mode === "navigate") {
       event.respondWith(
         fetch(request).catch(async () => {
           const cache = await caches.open(CACHE_NAME);
           return (await cache.match(request)) || (await cache.match("/index.html"));
         })
       );
       return;
     }
   
     // 2. Resource Caching (The Icon Fix)
     event.respondWith(
       caches.match(request).then((cachedResponse) => {
         if (cachedResponse) return cachedResponse;
   
         return fetch(request).then((networkResponse) => {
           // We want to cache JS, CSS, Fonts, and Images (Icons)
           const contentType = networkResponse.headers.get('content-type');
           
           if (networkResponse.status === 200 && (
               request.destination === 'font' || 
               request.destination === 'image' || 
               request.destination === 'script' || 
               request.destination === 'style' ||
               (contentType && contentType.includes('svg'))
           )) {
             const responseToCache = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
               cache.put(request, responseToCache);
             });
           }
           return networkResponse;
         }).catch(() => {
           // Offline and not in cache
         });
       })
     );
   });
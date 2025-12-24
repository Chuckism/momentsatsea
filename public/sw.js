/* ============================
   MomentsAtSea - PWA Service Worker (v9)
   The "Lean & Mean" Static Export Version
   ============================ */

   const CACHE_VERSION = "mas-shell-v9"; 
   const CACHE_NAME = CACHE_VERSION;
   
   // Explicitly list the core "App Shell"
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
   
   /* 1. Install - Download the shell */
   self.addEventListener("install", (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => {
         console.log("[SW] Precaching shell assets");
         return cache.addAll(PRECACHE_ASSETS);
       })
     );
     self.skipWaiting();
   });
   
   /* 2. Activate - Nuke old versions */
   self.addEventListener("activate", (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(
           keys.map((key) => {
             if (key !== CACHE_NAME) return caches.delete(key);
           })
         )
       )
     );
     self.clients.claim();
   });
   
   /* 3. Fetch - The "No Dinosaur" Logic */
   self.addEventListener("fetch", (event) => {
     const { request } = event;
     if (request.method !== "GET") return;
   
     // NAVIGATION (Refreshes / Cold Starts)
     if (request.mode === "navigate") {
       event.respondWith(
         fetch(request).catch(async () => {
           const cache = await caches.open(CACHE_NAME);
           // Try to find a match, otherwise force the homepage
           return (await cache.match(request)) || 
                  (await cache.match("/index.html")) || 
                  (await cache.match("/"));
         })
       );
       return;
     }
   
     // ASSETS (Styles, Images, Scripts)
     event.respondWith(
       caches.match(request).then((cached) => {
         return cached || fetch(request).then((networkResponse) => {
           // Cache new assets as we find them
           if (networkResponse.status === 200) {
             const cacheCopy = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => cache.put(request, cacheCopy));
           }
           return networkResponse;
         }).catch(() => {
           // If everything fails, return nothing (or a cached icon if available)
         });
       })
     );
   });
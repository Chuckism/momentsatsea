/* ============================
   MomentsAtSea - Optimized PWA Service Worker
   ============================ */

   const CACHE_VERSION = "mas-shell-v7"; // Incremented version
   const CACHE_NAME = CACHE_VERSION;
   
   // Assets to cache immediately on install
   const PRECACHE_ASSETS = [
     "/",
     "/index.html",
     "/offline.html",
     "/manifest.webmanifest", // Ensure this matches your actual filename
     "/icon-192.png",
     "/icon-512.png",
     "/favicon.ico"
   ];
   
   /* 1. Install - Pre-cache the App Shell */
   self.addEventListener("install", (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => {
         console.log("[SW] Pre-caching App Shell");
         return cache.addAll(PRECACHE_ASSETS);
       })
     );
     self.skipWaiting();
   });
   
   /* 2. Activate - Cleanup old caches */
   self.addEventListener("activate", (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(
           keys.map((key) => {
             if (key !== CACHE_NAME) {
               console.log("[SW] Deleting old cache:", key);
               return caches.delete(key);
             }
           })
         )
       )
     );
     self.clients.claim();
   });
   
   /* 3. Fetch - The "Deep Link" Fix */
   self.addEventListener("fetch", (event) => {
     const { request } = event;
     const url = new URL(request.url);
   
     // Only handle GET requests
     if (request.method !== "GET") return;
   
     // STRATEGY: Navigation Requests (Page Loads/Refreshes)
     if (request.mode === "navigate") {
       event.respondWith(
         fetch(request).catch(async () => {
           const cache = await caches.open(CACHE_NAME);
           
           // 1. Try to find an exact match (e.g., /journal.html)
           const exactMatch = await cache.match(request);
           if (exactMatch) return exactMatch;
   
           // 2. Fallback to the root index.html (The SPA Shell)
           // This allows client-side routing to take over once loaded
           const shell = await cache.match("/");
           if (shell) return shell;
   
           // 3. Last resort: Offline page
           return cache.match("/offline.html");
         })
       );
       return;
     }
   
     // STRATEGY: Static Assets (JS, CSS, Images)
     // Cache-First, then Network
     event.respondWith(
       caches.match(request).then((cachedResponse) => {
         if (cachedResponse) return cachedResponse;
   
         return fetch(request).then((networkResponse) => {
           // Don't cache non-ok responses or external API calls here 
           // unless you specifically want to.
           if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
             return networkResponse;
           }
   
           const responseToCache = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => {
             cache.put(request, responseToCache);
           });
   
           return networkResponse;
         });
       })
     );
   });
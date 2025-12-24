/* ============================
   MomentsAtSea - PWA Service Worker (v8)
   Focused on Cold-Start Offline Reliability
   ============================ */

   const CACHE_VERSION = "mas-shell-v8"; 
   const CACHE_NAME = CACHE_VERSION;
   
   // 1. Every file needed to make the "Shell" work without internet
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
   
   /* --- Install: Grab the basics --- */
   self.addEventListener("install", (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => {
         console.log("[SW] Pre-caching all shell assets");
         return cache.addAll(PRECACHE_ASSETS);
       })
     );
     self.skipWaiting();
   });
   
   /* --- Activate: Clear old versions --- */
   self.addEventListener("activate", (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(
           keys.map((key) => {
             if (key !== CACHE_NAME) {
               return caches.delete(key);
             }
           })
         )
       )
     );
     self.clients.claim();
   });
   
   /* --- Fetch: The "Cold Launch" Magic --- */
   self.addEventListener("fetch", (event) => {
     const { request } = event;
   
     if (request.method !== "GET") return;
   
     // Handling Navigation (Opening the app/Refreshing)
     if (request.mode === "navigate") {
       event.respondWith(
         fetch(request).catch(async () => {
           const cache = await caches.open(CACHE_NAME);
           
           // Match logic: Exact URL -> Root (/) -> index.html -> offline.html
           const match = await cache.match(request) || 
                         await cache.match("/") || 
                         await cache.match("/index.html");
           
           return match || cache.match("/offline.html");
         })
       );
       return;
     }
   
     // Handling Assets (CSS, JS, Images)
     event.respondWith(
       caches.match(request).then((cachedResponse) => {
         if (cachedResponse) return cachedResponse;
   
         return fetch(request).then((networkResponse) => {
           if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             const responseToCache = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
               cache.put(request, responseToCache);
             });
           }
           return networkResponse;
         }).catch(() => {
           // Fail silently if network fails and not in cache
         });
       })
     );
   });
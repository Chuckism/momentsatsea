/* ============================
   MomentsAtSea - Deterministic Service Worker
   ============================ */

   const CACHE_VERSION = "mas-shell-v4";
   const SHELL_CACHE = CACHE_VERSION;
   
   /* ============================
      Install
      ============================ */
   self.addEventListener("install", (event) => {
     event.waitUntil(
       (async () => {
         const cache = await caches.open(SHELL_CACHE);
   
         // 1. Cache minimal shell
         await cache.addAll([
           "/",
           "/offline.html",
           "/icon-192.png",
           "/icon-512.png",
         ]);
   
         // 2. Precache Next.js build assets for offline hydration
         const res = await fetch("/_next/static/buildManifest.json");
         if (!res.ok) return;
   
         const manifest = await res.json();
         const assets = new Set();
   
         Object.values(manifest).forEach((entry) => {
           if (Array.isArray(entry)) {
             entry.forEach((file) => {
               if (file.endsWith(".js") || file.endsWith(".css")) {
                 assets.add("/_next/static/" + file);
               }
             });
           }
         });
   
         await cache.addAll([...assets]);
       })()
     );
   
     self.skipWaiting();
   });
   
   /* ============================
      Activate
      ============================ */
   self.addEventListener("activate", (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(
           keys.map((key) => {
             if (key !== SHELL_CACHE) {
               return caches.delete(key);
             }
           })
         )
       )
     );
   
     self.clients.claim();
   });
   
   /* ============================
      Fetch
      ============================ */
   self.addEventListener("fetch", (event) => {
     const request = event.request;
   
     if (request.method !== "GET") return;
   
     // Navigation requests
     if (request.mode === "navigate") {
       event.respondWith(
         (async () => {
           try {
             return await fetch(request);
           } catch {
             const cache = await caches.open(SHELL_CACHE);
             const cachedRoot = await cache.match("/");
             if (cachedRoot) return cachedRoot;
             return cache.match("/offline.html");
           }
         })()
       );
       return;
     }
   
     // Static assets: cache-first
     event.respondWith(
       (async () => {
         const cached = await caches.match(request);
         if (cached) return cached;
   
         try {
           const response = await fetch(request);
           const cache = await caches.open(SHELL_CACHE);
           cache.put(request, response.clone());
           return response;
         } catch {
           return cached;
         }
       })()
     );
   });
   
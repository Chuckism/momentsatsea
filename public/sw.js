/* ============================
   MomentsAtSea - Deterministic Service Worker
   ============================ */

   const CACHE_VERSION = "mas-shell-v6";
   const CACHE_NAME = CACHE_VERSION;
   
   /* ============================
      Install
      ============================ */
   self.addEventListener("install", (event) => {
     event.waitUntil(
       (async () => {
         const cache = await caches.open(CACHE_NAME);
   
         // 1. Cache base shell
         await cache.addAll([
           "/",
           "/offline.html",
           "/icon-192.png",
           "/icon-512.png",
         ]);
   
         // 2. Load Next.js static build manifest (STATIC EXPORT SAFE)
         const res = await fetch("/_next/static/_buildManifest.js");
         if (!res.ok) return;
   
         const text = await res.text();
   
         // The manifest defines self.__BUILD_MANIFEST
         const sandbox = {};
         new Function("self", text)(sandbox);
   
         const manifest = sandbox.__BUILD_MANIFEST;
         if (!manifest) return;
   
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
             if (key !== CACHE_NAME) {
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
   
     // Navigation
     if (request.mode === "navigate") {
        event.respondWith(
          (async () => {
            const cache = await caches.open(CACHE_NAME);
      
            // ALWAYS serve cached shell for navigation
            const cached = await cache.match("/");
            if (cached) return cached;
      
            // Absolute fallback
            return cache.match("/offline.html");
          })()
        );
        return;
      }
      
   
     // Assets
     event.respondWith(
       (async () => {
         const cached = await caches.match(request);
         if (cached) return cached;
   
         try {
           const response = await fetch(request);
           const cache = await caches.open(CACHE_NAME);
           cache.put(request, response.clone());
           return response;
         } catch {
           return cached;
         }
       })()
     );
   });
   
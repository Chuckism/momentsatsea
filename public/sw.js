/* ============================
   MomentsAtSea – Deterministic Service Worker
   ============================ */

   const CACHE_VERSION = "mas-shell-v3";
   const SHELL_CACHE = CACHE_VERSION;
   
   /**
    * Only include files that actually exist.
    * Missing files will cause install to fail.
    */
   const APP_SHELL = [
    "/",
    "/offline.html",
    "/icon-192.png",
    "/icon-512.png",
  
    // Next.js runtime & app bundles
    "/_next/static/chunks/main-app.js",
    "/_next/static/chunks/webpack.js",
    "/_next/static/chunks/framework.js",
  ];
  
   /* ============================
      Install
      ============================ */
      self.addEventListener("install", (event) => {
        event.waitUntil(
          (async () => {
            const cache = await caches.open(SHELL_CACHE);
      
            // Cache core shell
            await cache.addAll(APP_SHELL);
      
            // Cache ALL Next.js static assets dynamically
            const res = await fetch("/_next/static/");
            if (res.ok) {
              // Warm the cache by triggering asset discovery
              // (Next will request actual JS chunks immediately after)
            }
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
   
     // Navigation requests (cold start, refresh)
     if (request.mode === "navigate") {
       event.respondWith(
         (async () => {
           try {
             // Online: use network
             return await fetch(request);
           } catch {
             // Offline: always serve cached app shell
             const cache = await caches.open(SHELL_CACHE);
             const cachedRoot = await cache.match("/");
             if (cachedRoot) return cachedRoot;
   
             // Final fallback
             return cache.match("/offline.html");
           }
         })()
       );
       return;
     }
   
     // Cache-first for static assets and Next.js runtime
event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
  
      try {
        const response = await fetch(request);
  
        // Explicitly cache Next.js static assets
        if (
          request.url.includes('/_next/static/') ||
          request.url.endsWith('.js') ||
          request.url.endsWith('.css')
        ) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, response.clone());
        }
  
        return response;
      } catch {
        return cached;
      }
    })()
  );
  
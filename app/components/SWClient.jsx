'use client';
import { useEffect, useRef } from 'react';

export default function SWClient() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (typeof window === 'undefined') return;

    let didSoftReload = false;
    let updateTimer = null;

    const promoteWaiting = (reg) => {
      try {
        reg?.waiting?.postMessage?.({ type: 'SKIP_WAITING' });
      } catch (e) {
        // no-op
      }
    };

    const register = async () => {
      try {
        // Register under site root; sw.js is at /public/sw.js
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // If a new SW is already waiting (common after deploy), activate it now
        promoteWaiting(reg);

        // When an update is found, fast-track it once installed
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && reg.waiting) {
              promoteWaiting(reg);
            }
          });
        });

        // (Optional) Periodically check for updates when the tab is visible
        const tick = async () => {
          try {
            if (document.visibilityState === 'visible') {
              await reg.update();
            }
          } catch {}
        };
        updateTimer = window.setInterval(tick, 5 * 60 * 1000); // every 5 minutes
      } catch (err) {
        // Some embedded browsers (FB/IG in-app) block SWs; ignore
        console.error('Service worker registration failed:', err);
      }
    };

    // Register after window load (reduces odd OEM issues on some Androids)
    window.addEventListener('load', register);

    // Soft-reload once when the new SW takes control (ensures fresh assets)
    const onControllerChange = () => {
      if (didSoftReload) return; // prevent loops
      didSoftReload = true;
      // Defer slightly to let the new SW settle
      setTimeout(() => {
        try {
          // Only reload if the tab is visible to avoid interrupting background sessions
          if (document.visibilityState === 'visible') {
            window.location.reload();
          } else {
            // If hidden, reload on next visibility
            const onVisible = () => {
              document.removeEventListener('visibilitychange', onVisible);
              if (document.visibilityState === 'visible') window.location.reload();
            };
            document.addEventListener('visibilitychange', onVisible);
          }
        } catch {}
      }, 150);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (updateTimer) window.clearInterval(updateTimer);
    };
  }, []);

  return null;
}

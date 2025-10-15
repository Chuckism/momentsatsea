'use client';
import { useEffect } from 'react';

export default function SWClient() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // If a new SW is already waiting (e.g., after deploy), activate it now
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

        // When a new SW is found & installed, activate it immediately
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (err) {
        console.error('Service worker registration failed:', err);
      }
    };

    // Register after window load (avoids a few quirky Android OEM issues)
    window.addEventListener('load', register);

    // Optional: observe controller changes (new SW took control)
    const onControllerChange = () => {
      // You could show a “Updated” toast here if you want.
      // We keep it silent for a seamless feel.
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}

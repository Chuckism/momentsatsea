'use client';
import { useEffect } from 'react';

export default function SWClient() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        // We are using sw-v21.js to bypass the Android "Cannot install" error
        const reg = await navigator.serviceWorker.register('/sw-v21.js', { scope: '/' });
        
        // If there's a new version waiting, tell it to take over immediately
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        console.log('Service Worker registered successfully');
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }
    };

    // Register immediately on mount
    register();

    // When the new worker takes over, just log it instead of forcing a reload
    const onControllerChange = () => {
      console.log('New Service Worker in control');
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
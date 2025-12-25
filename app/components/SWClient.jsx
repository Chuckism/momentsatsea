'use client';
import { useEffect } from 'react';

export default function SWClient() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { 
          scope: '/' 
        });
        
        console.log('Service Worker registered:', reg);
        
        // Request persistent storage
        if (navigator.storage?.persist) {
          const granted = await navigator.storage.persist();
          console.log('Persistent storage:', granted ? 'granted' : 'denied');
        }
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }
    };

    // Register immediately
    register();
  }, []);

  return null;
}
'use client';
import { useEffect, useState } from 'react';
import { X, Ship } from 'lucide-react';

const DISMISS_KEY = 'a2hs_ios_dismissed';

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
}

function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Exclude iOS Chrome/Firefox/Edge in-app browsers
  const isSafariEngine = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIOS() && isSafariEngine;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS legacy
    window.navigator.standalone === true
  );
}

export default function A2HSClient() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!isIOSSafari()) return setShow(false);
      if (isStandalone()) return setShow(false);

      let dismissed = false;
      try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
      setShow(!dismissed);
    };

    // Initial check
    check();

    // Hide if user installs while this tab is open
    const onAppInstalled = () => {
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
      setShow(false);
    };

    // Re-check when tab visibility changes (covers back/forward or OS handoffs)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };

    window.addEventListener('appinstalled', onAppInstalled);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('appinstalled', onAppInstalled);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setShow(false);
  };

  return (
    <div className="fixed left-4 right-4 z-[60]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-4 shadow-2xl border border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Ship className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 text-white">
            <div className="font-semibold">Add to Home Screen</div>
            <p className="text-white/90 text-sm mt-0.5">
              On iPhone: tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span>. Works offline at sea.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

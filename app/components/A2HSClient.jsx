'use client';
import { useEffect, useState } from 'react';
import { X, Ship } from 'lucide-react';

const DISMISS_KEY = 'a2hs_ios_dismissed';

export default function A2HSClient() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isStandalone =
      (typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          // iOS Safari legacy flag
          window.navigator.standalone === true));

    const isIOS =
      (typeof navigator !== 'undefined' &&
        /iphone|ipad|ipod/i.test(navigator.userAgent || ''));

    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}

    if (isIOS && !isStandalone && !dismissed) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60]">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-4 shadow-2xl border border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Ship className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 text-white">
            <div className="font-semibold">Add to Home Screen</div>
            <p className="text-white/90 text-sm mt-0.5">
              On iPhone: tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span>.
              Works offline at sea.
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

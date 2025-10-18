'use client';
import { useEffect, useMemo, useState } from 'react';
import { X, Check, ShieldCheck, Film, FileText, Sparkles, Calendar, Ship, MapPin } from 'lucide-react';

const PACKAGES = [
  {
    id: 'bundle_masterpiece',
    title: 'Complete Masterpiece',
    price: 6999, // cents
    best: true,
    includes: [
      'Digital Cruise Book (PDF)',
      'Highlight Reel (60s video)',
      'Feature Film (120s video)',
      'Bonus: 30s Social Video',
    ],
    blurb: '$89.97 value + bonus',
  },
  { id: 'pdf_book', title: 'Digital Cruise Book (PDF)', price: 1499, icon: 'pdf' },
  { id: 'video_60s', title: 'Highlight Reel (60s)', price: 2999, icon: 'film' },
  { id: 'video_120s', title: 'Feature Film (120s)', price: 4499, icon: 'film' },
];

function formatUSD(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function OrderSheet({ open, onClose, cruise, onSubmit }) {
  const [selected, setSelected] = useState('bundle_masterpiece');
  const [removeWM, setRemoveWM] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | saving | done
  const [isOnline, setIsOnline] = useState(true);

  // Derive friendly cruise info for the header
  const { cruiseTitle, dateRange, portShort } = useMemo(() => {
    const title = cruise?.homePort?.split(',')[0] ? `${cruise.homePort.split(',')[0]} Adventure` : 'Cruise Adventure';
    const start = cruise?.departureDate ? new Date(`${cruise.departureDate}T00:00:00`) : null;
    const end = cruise?.returnDate ? new Date(`${cruise.returnDate}T00:00:00`) : null;
    const range = start && end && !Number.isNaN(start) && !Number.isNaN(end)
      ? `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'Dates not set';
    const port = cruise?.homePort?.split(',')[0] || '';
    return { cruiseTitle: title, dateRange: range, portShort: port };
  }, [cruise]);

  useEffect(() => {
    const up = () => setIsOnline(navigator.onLine);
    up();
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', up); };
  }, []);

  // Reset when sheet closes/opens
  useEffect(() => {
    if (!open) { setStatus('idle'); setSelected('bundle_masterpiece'); setRemoveWM(false); }
  }, [open]);

  // Auto-focus the sheet when it opens (helps “auto-open” feel deterministic)
  useEffect(() => {
    if (open) {
      // slight delay lets the backdrop mount
      const t = setTimeout(() => {
        const el = document.getElementById('order-sheet-root');
        el?.focus?.();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const chosen = PACKAGES.find(p => p.id === selected);
  const subtotal = chosen.price;
  const wmAddon = removeWM ? (selected === 'bundle_masterpiece' ? 2000 : 1000) : 0;
  const total = subtotal + wmAddon;

  const startOrder = async () => {
    setStatus('saving');
    // Build a minimal order payload (works offline)
    const order = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      cruiseId: cruise?.id || null,
      cruiseMeta: {
        title: cruiseTitle,
        homePort: cruise?.homePort || null,
        departureDate: cruise?.departureDate || null,
        returnDate: cruise?.returnDate || null,
      },
      packageId: selected,
      removeWatermark: removeWM,
      subtotal,
      watermarkAddon: wmAddon,
      total,
      createdAt: new Date().toISOString(),
      isOnlineAtSubmit: isOnline,
    };

    // If parent provided a callback, let it try to sync
    try { await onSubmit?.(order); } catch {}

    // Mock local save UX
    await new Promise(r => setTimeout(r, 700));
    setStatus('done');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 p-0 md:p-6" id="order-sheet-backdrop">
      <div
        className="w-full md:max-w-2xl bg-slate-900 rounded-t-2xl md:rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden outline-none"
        id="order-sheet-root"
        tabIndex={-1}
        aria-modal="true"
        role="dialog"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <div>
            <div className="text-sm uppercase tracking-wider text-slate-400">Create Your Keepsakes</div>
            <div className="text-xl font-bold text-white">{cruiseTitle}</div>
            <div className="mt-1 text-slate-400 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {dateRange}</span>
              {portShort ? <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" /> {portShort}</span> : null}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-5">
          {/* Packages */}
          <div className="grid grid-cols-1 gap-4">
            {PACKAGES.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`text-left rounded-xl border px-4 py-4 transition-all ${
                  selected === p.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700/60 hover:border-slate-600/80 bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {p.icon === 'pdf' ? <FileText className="w-5 h-5 text-slate-300" /> :
                     p.icon === 'film' ? <Film className="w-5 h-5 text-slate-300" /> :
                     <Sparkles className="w-5 h-5 text-blue-300" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-white">{p.title}</div>
                      {p.best && <span className="text-xs bg-emerald-600/20 text-emerald-300 px-2 py-0.5 rounded">Best value</span>}
                    </div>
                    <div className="text-slate-300 mt-0.5">{formatUSD(p.price)}</div>
                    {p.best && (
                      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-400">
                        {p.includes.map(line => (
                          <li key={line} className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400" /> {line}
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.blurb && <div className="text-xs text-blue-300 mt-2">{p.blurb}</div>}
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                    selected === p.id ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                  }`}>
                    {selected === p.id && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Watermark toggle */}
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-slate-300 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-white">Remove watermark (+{formatUSD(selected==='bundle_masterpiece' ? 2000 : 1000)})</div>
                  <div className="text-sm text-slate-400">
                    Default videos include an elegant, opaque “MomentsAtSea.com” mark. Remove it for a clean master.
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="sr-only" checked={removeWM} onChange={(e)=>setRemoveWM(e.target.checked)} />
                  <span className={`w-10 h-6 rounded-full transition-colors ${removeWM?'bg-emerald-500':'bg-slate-600'}`}>
                    <span className={`block w-5 h-5 bg-white rounded-full mt-0.5 ml-0.5 transition-transform ${removeWM?'translate-x-4':''}`} />
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
            <div className="flex items-center justify-between text-slate-300">
              <span>Subtotal</span><span>{formatUSD(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300 mt-1">
              <span>Remove watermark</span><span>{removeWM ? `+ ${formatUSD(wmAddon)}` : '—'}</span>
            </div>
            <div className="h-px bg-slate-700 my-3" />
            <div className="flex items-center justify-between text-white font-semibold">
              <span>Total</span><span>{formatUSD(total)}</span>
            </div>
          </div>

          {/* Action */}
          {status === 'idle' && (
            <button
              onClick={startOrder}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 rounded-xl shadow-lg transform hover:scale-[1.01] transition-all"
            >
              {isOnline ? 'Finalize My Masterpiece' : 'Save Order (will process when online)'}
            </button>
          )}

          {status === 'saving' && (
            <button disabled className="w-full bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl">
              Preparing your order…
            </button>
          )}

          {status === 'done' && (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-4 text-emerald-200">
              <div className="font-semibold mb-1">Your order is saved ✅</div>
              <div className="text-sm">
                {isOnline
                  ? 'This is a demo flow. In the real version, we’ll send you to payment and then start rendering your videos/PDF automatically.'
                  : 'You’re offline—no problem. We’ll process this the next time you’re online.'}
              </div>
              <div className="mt-3">
                <button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

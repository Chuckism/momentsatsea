'use client';
import { useEffect, useState } from 'react';
import { X, Check, ShieldCheck, Film, FileText, Sparkles } from 'lucide-react';

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

/**
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - cruise: { id, homePort, departureDate, returnDate } | null
 * - onSubmit?: (order) => Promise<void> | void   // optional (for Supabase/Stripe)
 */
export default function OrderSheet({ open, onClose, cruise, onSubmit }) {
  const [selected, setSelected] = useState('bundle_masterpiece');
  const [removeWM, setRemoveWM] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | saving | done | error
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const up = () => setIsOnline(navigator.onLine);
    up();
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', up); };
  }, []);

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setSelected('bundle_masterpiece');
      setRemoveWM(false);
    }
  }, [open]);

  if (!open) return null;

  const chosen = PACKAGES.find(p => p.id === selected);
  const subtotal = chosen.price;
  const wmAddon = removeWM ? (selected === 'bundle_masterpiece' ? 2000 : 1000) : 0; // $20 bundle, $10 single
  const total = subtotal + wmAddon;

  const queueLocalOrder = (order) => {
    try {
      const key = 'moments_orders_queue';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.push(order);
      localStorage.setItem(key, JSON.stringify(prev));
      return true;
    } catch {
      return false;
    }
  };

  const startOrder = async () => {
    if (!cruise?.id) {
      // Guard: shouldn’t happen—UI only opens this when a finished cruise is chosen.
      setStatus('error');
      return;
    }
    setStatus('saving');

    const order = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      cruiseId: cruise.id,
      cruiseSummary: {
        homePort: cruise.homePort ?? null,
        departureDate: cruise.departureDate ?? null,
        returnDate: cruise.returnDate ?? null,
      },
      packageId: selected,
      removeWatermark: removeWM,
      lineItems: [
        { sku: selected, amountCents: subtotal, qty: 1 },
        ...(removeWM ? [{ sku: selected === 'bundle_masterpiece' ? 'wm_bundle' : 'wm_single', amountCents: wmAddon, qty: 1 }] : []),
      ],
      totalCents: total,
      status: isOnline ? 'pending_payment' : 'queued_offline',
      source: 'app_order_sheet_v1',
    };

    // Always queue locally first so offline users are safe.
    const queued = queueLocalOrder(order);
    if (!queued) {
      setStatus('error');
      return;
    }

    // Optional: try to hand it off to caller (e.g., Supabase/Stripe) when online
    if (isOnline && typeof onSubmit === 'function') {
      try {
        await onSubmit(order);
      } catch {
        // Keep queued; caller can process later
      }
    }

    setStatus('done');
  };

  const portName = (cruise?.homePort || '').split(',')[0] || 'Cruise';
  const dateSpan =
    cruise?.departureDate && cruise?.returnDate
      ? `${cruise.departureDate} – ${cruise.returnDate}`
      : 'Dates not set';

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 p-0 md:p-6">
      <div className="w-full md:max-w-2xl bg-slate-900 rounded-t-2xl md:rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <div>
            <div className="text-sm uppercase tracking-wider text-slate-400">Transform Your Journal</div>
            <div className="text-xl font-bold text-white">Create Your Keepsakes</div>
            {cruise && (
              <div className="text-slate-400 text-xs mt-1">
                For: <span className="text-slate-300 font-medium">{portName} Adventure</span> · <span>{dateSpan}</span>
              </div>
            )}
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
                    Default videos include a subtle “MomentsAtSea.com” mark. Remove it for a clean export.
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
              {isOnline ? 'Finalize My Masterpiece' : 'Save Order (works offline)'}
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
                  ? 'We saved your order. Next up: payment and rendering in the cloud.'
                  : 'You’re offline—no problem. We’ll process this when you’re back online.'}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg">Close</button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-xl border border-red-700/40 bg-red-900/20 p-4 text-red-200">
              <div className="font-semibold mb-1">Couldn’t save your order.</div>
              <div className="text-sm">Please try again, or pick a finished cruise first.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

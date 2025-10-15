'use client';
import { X } from 'lucide-react';

export default function OrderSheet({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 sm:p-7">
        <div className="absolute top-3 right-3">
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 pr-8">
          <h3 className="text-xl font-bold text-white">Create Your Keepsakes</h3>
          <p className="text-slate-400 text-sm">
            Turn your journal into a beautiful PDF book and short videos. Choose a package below.
          </p>
        </div>

        {/* ---- CONTENT AREA (replace with your real packages) ---- */}
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Digital Cruise Book (PDF)</div>
                <div className="text-slate-400 text-sm">Beautiful, printable keepsake</div>
              </div>
              <div className="text-white font-bold">$14.99</div>
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
              onClick={() => alert('PDF order flow coming soon')}
            >
              Continue
            </button>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Highlight Reel (60s)</div>
                <div className="text-slate-400 text-sm">Perfect for social</div>
              </div>
              <div className="text-white font-bold">$29.99</div>
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
              onClick={() => alert('60s video order flow coming soon')}
            >
              Continue
            </button>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Feature Film (120s)</div>
                <div className="text-slate-400 text-sm">Tell the full story</div>
              </div>
              <div className="text-white font-bold">$44.99</div>
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
              onClick={() => alert('120s video order flow coming soon')}
            >
              Continue
            </button>
          </div>

          <div className="rounded-lg border-2 border-emerald-600 bg-emerald-600/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Complete Masterpiece</div>
                <div className="text-slate-300 text-xs">
                  PDF + 60s + 120s + 30s social bonus
                </div>
              </div>
              <div className="text-white font-extrabold">$69.99</div>
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5"
              onClick={() => alert('Bundle order flow coming soon')}
            >
              Get the Bundle
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Watermark removal is optional (+$10). High-quality exports by default.
          </p>
        </div>
      </div>
    </div>
  );
}

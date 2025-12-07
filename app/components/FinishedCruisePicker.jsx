'use client';

import React from 'react';

/**
 * FinishedCruisePicker
 * Lightweight modal that lists finished cruises so the user can choose one.
 *
 * Props:
 * - open: boolean
 * - cruises: array of cruise objects (finished only)
 * - onSelect: function(cruise) -> void
 * - onClose: function() -> void
 */
export default function FinishedCruisePicker({ open, cruises = [], onSelect, onClose }) {
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const normalized = (cruises || []).map(c => ({
    raw: c,
    id: c.id ?? c.cruise_id ?? c.localId ?? String(c.startDate || '') + String(c.endDate || ''),
    title: c.title || c.name || 'Unnamed cruise',
    ship: c.ship || '',
    cruiseLine: c.cruise_line || c.cruiseLine || '',
    homePort: c.home_port || c.homePort || '',
    startDate: c.start_date || c.startDate || '',
    endDate: c.end_date || c.endDate || '',
    ports: Array.isArray(c.ports) ? c.ports : [],
  }));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? normalized.filter(n => {
        const hay =
          `${n.title} ${n.ship} ${n.cruiseLine} ${n.homePort} ${n.startDate} ${n.endDate} ${n.ports.join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
    : normalized;

  // Sort most recent endDate first
  filtered.sort((a, b) => {
    const ad = new Date(a.endDate || a.startDate || 0).getTime();
    const bd = new Date(b.endDate || b.startDate || 0).getTime();
    return bd - ad;
  });

  const handleSelect = (n) => {
    onSelect?.(n.raw);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[101] w-full max-w-2xl rounded-2xl bg-slate-900 text-slate-100 shadow-xl ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Choose a finished cruise</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-300 hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ship, port, home port, dates…"
            className="w-full rounded-xl bg-slate-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-2"
          />
        </div>

        {/* List */}
        <div className="max-h-[50vh] overflow-auto px-3 pb-4">
          {filtered.length === 0 ? (
            <div className="px-2 py-8 text-center text-slate-400">
              No finished cruises match your search.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((n) => {
                const dates =
                  (n.startDate ? formatDate(n.startDate) : '') +
                  (n.startDate && n.endDate ? ' — ' : '') +
                  (n.endDate ? formatDate(n.endDate) : '');
                return (
                  <li
                    key={n.id}
                    className="flex items-center justify-between rounded-xl bg-slate-800/60 px-4 py-3 ring-1 ring-white/10"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {n.title}
                        {n.ship ? <span className="text-slate-400"> · {n.ship}</span> : null}
                      </div>
                      <div className="text-xs text-slate-400">
                        {dates || 'Dates unknown'}
                        {n.homePort ? ` · Home: ${n.homePort}` : ''}
                        {n.ports?.length ? ` · Ports: ${n.ports.join(', ')}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelect(n)}
                      className="ml-3 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-white/20 hover:bg-white/10"
                    >
                      Select
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(d) {
  // Accepts 'YYYY-MM-DD' or ISO strings
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

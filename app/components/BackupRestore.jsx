'use client';
import { useRef, useState } from 'react';
import { supabaseConfigured, restoreLatestBackup } from '../../lib/backupSync';

/** Export / Import (local JSON) + optional “Restore from Cloud” (Supabase). */
export default function BackupRestore({ allCruises, setAllCruises, setActiveCruiseId, setAppState }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const hasCloud = supabaseConfigured();

  const exportJSON = () => {
    try {
      const cruises = JSON.parse(localStorage.getItem('allCruises') || '[]');
      const entriesByCruiseId = {};
      for (const c of cruises) {
        const key = `cruiseJournalEntries_${c.id}`;
        const raw = localStorage.getItem(key);
        if (raw) entriesByCruiseId[c.id] = JSON.parse(raw);
      }
      const payload = {
        app: 'MomentsAtSea',
        version: 1,
        exportedAt: new Date().toISOString(),
        allCruises: cruises,
        entriesByCruiseId,
        note: 'Photos are stored on the device (IndexedDB) and are not included in this JSON.',
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const y = new Date();
      const yyyy = y.getFullYear();
      const mm = String(y.getMonth() + 1).padStart(2, '0');
      const dd = String(y.getDate()).padStart(2, '0');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `momentsatsea-backup-${yyyy}${mm}${dd}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
    } catch (e) {
      alert('Export failed. See console for details.');
      console.error(e);
    }
  };

  const importJSON = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || data.app !== 'MomentsAtSea' || !Array.isArray(data.allCruises)) {
        alert('This file does not look like a MomentsAtSea backup.');
        return;
      }

      // Merge: overwrite same-id cruises, keep others
      const existing = JSON.parse(localStorage.getItem('allCruises') || '[]');
      const byId = new Map(existing.map(c => [String(c.id), c]));
      for (const c of data.allCruises) byId.set(String(c.id), c);
      const merged = Array.from(byId.values());

      // Write entries
      const entriesByCruiseId = data.entriesByCruiseId || {};
      for (const [cid, entries] of Object.entries(entriesByCruiseId)) {
        localStorage.setItem(`cruiseJournalEntries_${cid}`, JSON.stringify(entries || []));
      }

      localStorage.setItem('allCruises', JSON.stringify(merged));
      setAllCruises(merged);

      // Nice UX: jump into an active cruise if one exists in the import
      const active = merged.find(c => c.status === 'active') || merged[0];
      if (active) {
        localStorage.setItem('activeCruiseId', active.id);
        setActiveCruiseId?.(active.id);
        setAppState?.('journaling');
      }

      alert('Import complete! (Photos are not included; use Export Photos for those.)');
    } catch (e) {
      alert('Import failed. See console for details.');
      console.error(e);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!hasCloud) return;
    setBusy(true);
    try {
      const ok = await restoreLatestBackup();
      if (ok) {
        // Reload list from localStorage to reflect restored data
        const cruises = JSON.parse(localStorage.getItem('allCruises') || '[]');
        setAllCruises?.(cruises);
        alert('Cloud restore complete! Your cruises and entries were updated.');
      } else {
        alert('No cloud backups found for this device/project yet.');
      }
    } catch (e) {
      alert('Cloud restore failed. See console for details.');
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl bg-slate-800/40 border border-slate-700/60 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-white font-semibold">Export Backup</div>
          <div className="text-slate-400 text-sm">
            Save your journal (text & captions) to a .json file. You can re-import it later.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportJSON}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Export Backup (.json)
          </button>

          <label className={`cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
            <span className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-block">
              Import Backup
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => importJSON(e.target.files?.[0])}
              disabled={busy}
            />
          </label>

          {hasCloud && (
            <button
              type="button"
              onClick={handleRestoreFromCloud}
              disabled={busy}
              className={`text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                busy ? 'bg-emerald-700/60 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              Restore from Cloud
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 mt-2">
        Backups include your journal text and photo captions. Photos are stored on your device and are not in this backup.
        To copy photos too, use <strong>Export Photos (.zip)</strong> below.
      </div>
    </div>
  );
}

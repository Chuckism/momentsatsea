// lib/backupSync.js
import { supabase } from "./supabaseClient";

const LS_KEY = "moments_backup_queue";

/* ---------- Local queue helpers (offline-first) ---------- */
function readQueue() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}
function writeQueue(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list || []));
}

/* ---------- Build a text-only snapshot of current data ---------- */
function snapshotLocal(cruiseId = null) {
  const cruises = JSON.parse(localStorage.getItem("allCruises") || "[]");
  const entriesByCruiseId = {};
  for (const c of cruises) {
    const raw = localStorage.getItem(`cruiseJournalEntries_${c.id}`);
    if (raw) entriesByCruiseId[c.id] = JSON.parse(raw);
  }
  return {
    app: "MomentsAtSea",
    version: 1,
    exportedAt: new Date().toISOString(),
    cruiseIdHint: cruiseId,
    allCruises: cruises,
    entriesByCruiseId,
    note: "Text-only backup snapshot. Photos live in IndexedDB; use Export ZIP in the app.",
    ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
}

/* ---------- Public API ---------- */

/** Queue a backup of current local state and try to sync immediately. */
export async function queueBackupAndSync(cruiseId = null) {
  const backup = {
    id: `backup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cruiseId: cruiseId ?? null,
    payload: snapshotLocal(cruiseId),
  };
  writeQueue([...readQueue(), backup]);
  return await trySyncBackups();
}

/** Attempt to flush queued backups to Supabase (no-op if offline/unconfigured). */
export async function trySyncBackups() {
  if (!supabase) return false;           // env not configured
  const q = readQueue();
  if (!q.length) return true;

  const rows = q.map(b => ({
    id: b.id,
    cruise_id: b.cruiseId,
    payload: b.payload,
  }));

  const { error } = await supabase.from("journal_backups").insert(rows);
  if (error) {
    console.warn("[backupSync] insert failed; will retry later:", error.message);
    return false;
  }
  writeQueue([]); // success → clear queue
  return true;
}

'use client';

import { supabase } from './supabaseClient';

const QUEUE_KEY = 'mas_backup_queue';
const AUTO_KEY  = 'mas_auto_backup';

const log = (...args) => console.log('[BackupSync]', ...args);

/* ---------------------------------
   Queue helpers (localStorage JSON)
---------------------------------- */
function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeQueue(arr) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr || []));
  } catch {}
}
function makeId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

/* ---------------------------
   Config helpers / guards
---------------------------- */
export function supabaseConfigured() {
  return !!supabase;
}
function isAutoBackupEnabled() {
  try {
    const v = localStorage.getItem(AUTO_KEY);
    // default ON unless explicitly disabled
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}
function shouldDeferForNetwork() {
  try {
    const c = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
    // Skip auto-sync on "Save Data" or very slow (2g) links
    return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType)));
  } catch {
    return false;
  }
}

/* ---------------------------
   Payload builder (text-only)
---------------------------- */
function buildPayload(cruiseId) {
  const entriesRaw = localStorage.getItem(`cruiseJournalEntries_${cruiseId}`);
  const entries = entriesRaw ? JSON.parse(entriesRaw) : [];

  let cruiseMeta = null;
  try {
    const all = JSON.parse(localStorage.getItem('allCruises') || '[]');
    const found = all.find((c) => String(c.id) === String(cruiseId));
    if (found) {
      cruiseMeta = {
        id: found.id,
        label: found.label || null,
        homePort: found.homePort || null,
        departureDate: found.departureDate || null,
        returnDate: found.returnDate || null,
        status: found.status || null,
        finishedAt: found.finishedAt || null,
        itinerary: found.itinerary || [],
      };
    }
  } catch {}

  return {
    app: 'MomentsAtSea',
    v: 1,
    ts: new Date().toISOString(),
    cruise: cruiseMeta || { id: cruiseId },
    entries: Array.isArray(entries) ? entries : [],
  };
}

/* ---------------
   Public API
--------------- */

/** Enqueue a backup (text-only) and kick an async sync attempt. */
export async function queueBackupAndSync(cruiseId) {
  try {
    const payload = buildPayload(cruiseId);
    const queue = readQueue();
    const item = { id: makeId(), cruiseId: String(cruiseId), payload };
    queue.push(item);
    writeQueue(queue);
    log(`queued backup for cruise ${cruiseId}. queue size: ${queue.length}`);

    // fire-and-forget
    trySyncBackups().catch(() => {});
  } catch (e) {
    console.warn('[BackupSync] queue failed', e);
  }
}

/** Attempt to sync queued backups to Supabase. Returns true on success/no-op. */
export async function trySyncBackups() {
  if (!supabase) {
    log('supabase not configured; skip sync');
    return false;
  }
  const q = readQueue();
  if (!q.length) return true;

    // Attach user_id when signed in (use getSession for reliability in PWAs)
+  let userId = null;
+  try {
+    const { data: { session } } = await supabase.auth.getSession();
+    userId = session?.user?.id ?? null;
+  } catch {}

  const rows = q.map((b) => ({
    id: b.id,
    cruise_id: b.cruiseId,
    user_id: userId,            // <-- new (safe if null; column allows nulls)
    payload: b.payload,
  }));

  const { data, error } = await supabase
    .from('journal_backups')
    .upsert(rows) // id is PK; upsert prevents dupes
    .select('id');

  if (error) {
    console.warn('[BackupSync] sync failed', error);
    return false;
  }

  const syncedIds = new Set((data || []).map((r) => r.id));
  const remaining = q.filter((b) => !syncedIds.has(b.id));
  writeQueue(remaining);
  log(`synced ${q.length - remaining.length} backup(s) to Supabase`);
  return true;
}

/** Optional: toggle auto-backup (stored locally; default ON). */
export function setAutoBackupEnabled(flag) {
  try {
    localStorage.setItem(AUTO_KEY, flag ? '1' : '0');
  } catch {}
}

/** Optional export for debugging */
export function readQueuePublic() {
  return readQueue();
}

/**
 * Restore the most recent cloud backup.
 * - If cruiseId provided: restores latest for that cruise.
 * - Else: tries activeCruiseId from localStorage; if none, restores the latest backup overall.
 * Writes entries into localStorage and merges minimal cruise meta into 'allCruises'.
 * Returns true on success, false if nothing restored.
 */
export async function restoreLatestBackup(cruiseId) {
  if (!supabase) return false;

  // Try to scope by signed-in user if available (future RLS-friendly).
  let userId = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {}

  // Pick a cruise id if not supplied
  let targetCruiseId = cruiseId;
  if (!targetCruiseId) {
    try {
      const fromLocal = localStorage.getItem('activeCruiseId');
      if (fromLocal) targetCruiseId = fromLocal;
    } catch {}
  }

  // Build the query
  let query = supabase
    .from('journal_backups')
    .select('payload, created_at, cruise_id');

  if (targetCruiseId) query = query.eq('cruise_id', String(targetCruiseId));
  if (userId)         query = query.eq('user_id', userId);

  query = query.order('created_at', { ascending: false }).limit(1);

  const { data, error } = await query;
  if (error || !data || !data.length) return false;

  const row = data[0];
  const payload = row?.payload || {};
  const restoredCruiseId = String(row?.cruise_id || payload?.cruise?.id || targetCruiseId || '');

  try {
    if (payload.entries && restoredCruiseId) {
      localStorage.setItem(
        `cruiseJournalEntries_${restoredCruiseId}`,
        JSON.stringify(payload.entries)
      );
    }
    if (payload.cruise && payload.cruise.id) {
      const all = JSON.parse(localStorage.getItem('allCruises') || '[]');
      const idx = all.findIndex((c) => String(c.id) === String(payload.cruise.id));
      if (idx === -1) all.push(payload.cruise);
      else all[idx] = { ...all[idx], ...payload.cruise };
      localStorage.setItem('allCruises', JSON.stringify(all));
    }
    log('restored backup for cruise', restoredCruiseId || '(unknown)');
    return true;
  } catch (e) {
    console.warn('[BackupSync] restore failed', e);
    return false;
  }
}

/* ---------------------------
   Guarded auto-sync (browser)
---------------------------- */
let _autoSyncTimer;
function scheduleAutoSync() {
  if (!navigator.onLine || !isAutoBackupEnabled() || shouldDeferForNetwork()) return;
  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(() => {
    trySyncBackups().catch(() => {});
  }, 800);
}

/* ---------------------------
   Browser hooks + debug tools
---------------------------- */
if (typeof window !== 'undefined') {
  // Auto attempt on “online” and when tab returns to foreground
  window.addEventListener('online', scheduleAutoSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleAutoSync();
  });

  // Small debug API in DevTools
  window.MAS = window.MAS || {};
  window.MAS.status = () => ({
    supabaseConfigured: !!supabase,
    queueLength: readQueue().length,
  });
  window.MAS.queue = async (cruiseId) => queueBackupAndSync(cruiseId);
  window.MAS.syncNow = () => trySyncBackups();
  window.MAS.clearQueue = () => writeQueue([]);

  // Dev helper: restore latest for a cruise id
  window.MAS.restore = async (cruiseId) => restoreLatestBackup(cruiseId);
}

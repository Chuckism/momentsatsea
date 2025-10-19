'use client';

import { supabase } from './supabaseClient';

const QUEUE_KEY = 'mas_backup_queue';

const log = (...args) => console.log('[BackupSync]', ...args);

/* ---------------------------
   Config helpers / guards
---------------------------- */
export function supabaseConfigured() {
  // Keep this as a FUNCTION because callers do supabaseConfigured()
  // We check both the env and the constructed client.
  try {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      supabase
    );
  } catch {
    return false;
  }
}

/* ---------------------------
   Queue helpers (localStorage)
---------------------------- */
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
   Payload builder (text-only)
---------------------------- */
function buildPayload(cruiseId) {
  const entriesRaw = (typeof window !== 'undefined')
    ? localStorage.getItem(`cruiseJournalEntries_${cruiseId}`)
    : null;
  const entries = entriesRaw ? JSON.parse(entriesRaw) : [];

  let cruiseMeta = null;
  try {
    const all = JSON.parse((typeof window !== 'undefined' ? localStorage.getItem('allCruises') : '[]') || '[]');
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

/* ---------------------------
   Public API
---------------------------- */
export async function queueBackupAndSync(cruiseId) {
  try {
    if (typeof window === 'undefined') return; // SSR safety
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

export async function trySyncBackups() {
  // SSR/Build guard: this touches localStorage, so bail early
  if (typeof window === 'undefined') return false;

  if (!supabaseConfigured()) {
    log('supabase not configured; skip sync');
    return false;
  }
  const q = readQueue();
  if (!q.length) return true;

  const rows = q.map((b) => ({
    id: b.id,
    cruise_id: b.cruiseId,
    payload: b.payload,
  }));

  const { data, error } = await supabase
    .from('journal_backups')
    .upsert(rows) // onConflict: 'id' not needed if 'id' is PK
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

export function setAutoBackupEnabled(flag) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mas_auto_backup', flag ? '1' : '0');
  } catch {}
}

// Optional export for debugging (not used by UI)
export function readQueuePublic() {
  return (typeof window !== 'undefined') ? readQueue() : [];
}

/* ---------------------------
   Restore latest backup (exported)
---------------------------- */
export async function restoreLatestBackup(cruiseId) {
  // We perform the same behavior as the DevTools helper: fetch latest
  // and write it into localStorage. Returns true if applied.
  if (typeof window === 'undefined') return false;
  if (!supabaseConfigured()) return false;

  const { data, error } = await supabase
    .from('journal_backups')
    .select('payload, created_at')
    .eq('cruise_id', String(cruiseId))
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || !data.length) return false;
  const payload = data[0]?.payload || {};
  try {
    if (payload.entries) {
      localStorage.setItem(
        `cruiseJournalEntries_${cruiseId}`,
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
    log('restored backup for cruise', cruiseId);
    return true;
  } catch (e) {
    console.warn('[BackupSync] restore failed', e);
    return false;
  }
}

/* ---------------------------
   Guarded auto-sync (browser)
---------------------------- */
function isAutoBackupEnabled() {
  try {
    if (typeof window === 'undefined') return false;
    const v = localStorage.getItem('mas_auto_backup');
    // default ON unless explicitly disabled
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}
function shouldDeferForNetwork() {
  try {
    const c = (typeof navigator !== 'undefined') &&
      (navigator.connection || navigator.webkitConnection || navigator.mozConnection);
    // Skip auto-sync on "Save Data" or very slow (2g) links
    return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType)));
  } catch {
    return false;
  }
}
let _autoSyncTimer;
function scheduleAutoSync() {
  if (typeof window === 'undefined') return;
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
    supabaseConfigured: supabaseConfigured(),
    queueLength: readQueue().length,
  });
  window.MAS.queue = async (cruiseId) => queueBackupAndSync(cruiseId);
  window.MAS.syncNow = () => trySyncBackups();
  window.MAS.clearQueue = () => writeQueue([]);

  // Keep the DevTools helper, but route through the exported function
  window.MAS.restore = (cruiseId) => restoreLatestBackup(cruiseId);
}

'use client';

import { supabase } from './supabaseClient';
import { ensureFamily } from './familyLink';

const QUEUE_KEY = 'mas_backup_queue';
const AUTO_KEY = 'mas_auto_backup';

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
function isAutoBackupEnabled() {
  try {
    const v = localStorage.getItem(AUTO_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}
function shouldDeferForNetwork() {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const c =
      nav &&
      (nav.connection ||
        nav.webkitConnection ||
        nav.mozConnection);

    // If WebView does not expose any network connection info,
    // we assume "full speed" and DO NOT defer.
    if (!c) return false;

    return !!(c.saveData || /(^|-)2g$/.test(c.effectiveType));
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

/* ---------------  PUBLIC API --------------- */

export async function queueBackupAndSync(cruiseId) {
  try {
    const payload = buildPayload(cruiseId);
    const queue = readQueue();
    const item = { id: makeId(), cruiseId: String(cruiseId), payload };
    queue.push(item);
    writeQueue(queue);
    log(`queued backup for cruise ${cruiseId}. queue size: ${queue.length}`);

    // fire-and-forget sync
    trySyncBackups().catch(() => {});
  } catch (e) {
    console.warn('[BackupSync] queue failed', e);
  }
}

export async function trySyncBackups() {
  if (!supabase) {
    log('supabase not configured; skip sync');
    return false;
  }
  const q = readQueue();
  if (!q.length) return true;

  // 🧭 fetch user + family
  let user = null;
  let familyId = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    user = authData?.user;
    if (user) {
      familyId = await ensureFamily(user);
    }
  } catch (e) {
    console.warn('[BackupSync] user/family lookup failed (non-fatal)', e);
  }

  if (!user?.id) {
    log('signed out; keeping backups local (will sync after sign-in)');
    return true;
  }

  const enriched = q.map((b) => ({
    id: b.id,
    cruise_id: b.cruiseId,
    user_id: user.id,
    family_id: familyId ?? null,
    payload: b.payload,
    synced_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('journal_backups')
    .upsert(enriched)
    .select('id');

  if (error) {
    console.warn('[BackupSync] sync failed', error);
    return false;
  }

  console.log(
    `[BackupSync] synced ${enriched.length} backup(s) ${
      familyId ? `for family ${familyId}` : ''
    }`
  );

  const syncedIds = new Set((data || []).map((r) => r.id));
  const remaining = q.filter((b) => !syncedIds.has(b.id));
  writeQueue(remaining);
  log(`synced ${q.length - remaining.length} backup(s) to Supabase`);
  return true;
}

/* ---------------------------
   Restore
---------------------------- */
export async function restoreLatestBackup(cruiseId) {
  if (!supabase) return false;

  let userId = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {}

  let targetCruiseId = cruiseId;
  if (!targetCruiseId) {
    const fromLocal = localStorage.getItem('activeCruiseId');
    if (fromLocal) targetCruiseId = fromLocal;
  }

  let query = supabase
    .from('journal_backups')
    .select('payload, created_at, cruise_id');
  if (targetCruiseId) query = query.eq('cruise_id', String(targetCruiseId));
  if (userId) query = query.eq('user_id', userId);
  query = query.order('created_at', { ascending: false }).limit(1);

  const { data, error } = await query;
  if (error || !data?.length) return false;

  const row = data[0];
  const payload = row?.payload || {};
  const restoredCruiseId = String(
    row?.cruise_id || payload?.cruise?.id || targetCruiseId || ''
  );

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
    log('restored backup for cruise', restoredCruiseId);
    return true;
  } catch (e) {
    console.warn('[BackupSync] restore failed', e);
    return false;
  }
}

/* ---------------------------
   Browser auto hooks
---------------------------- */
let _autoSyncTimer;
function scheduleAutoSync() {
  if (!navigator.onLine || !isAutoBackupEnabled() || shouldDeferForNetwork()) return;
  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(() => {
    trySyncBackups().catch(() => {});
  }, 800);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', scheduleAutoSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleAutoSync();
  });

  window.MAS = window.MAS || {};
  window.MAS.status = () => ({
    supabaseReady: !!supabase,

    queueLength: readQueue().length,
  });
  window.MAS.queue = async (cruiseId) => queueBackupAndSync(cruiseId);
  window.MAS.syncNow = () => trySyncBackups();
  window.MAS.clearQueue = () => writeQueue([]);
  window.MAS.restore = async (cruiseId) => restoreLatestBackup(cruiseId);
}

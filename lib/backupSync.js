// lib/backupSync.js
import { supabase } from "./supabaseClient";

// ---- Simple queue (localStorage) -------------------------------------------
const LS_KEY = "mas_backup_queue";

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeQueue(q) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(q));
  } catch (e) {
    console.warn("[BackupSync] Failed to write queue:", e);
  }
}

// ---- Public API ------------------------------------------------------------
/** Queue a snapshot of the latest journal entries and try to sync right away. */
export async function queueBackupAndSync(cruiseId) {
  try {
    // read the most recent entries for this cruise from localStorage
    const raw = localStorage.getItem(`cruiseJournalEntries_${cruiseId}`);
    const entries = raw ? JSON.parse(raw) : [];

    const backup = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      cruiseId,
      payload: {
        version: 1,
        savedAt: new Date().toISOString(),
        entries,
      },
      queuedAt: Date.now(),
    };

    const q = readQueue();
    q.push(backup);
    writeQueue(q);

    console.log(
      `[BackupSync] queued backup for cruise ${cruiseId}. queue size: ${q.length}`
    );

    // try an immediate sync (non-blocking for the caller)
    trySyncBackups().catch((err) =>
      console.warn("[BackupSync] trySyncBackups failed:", err)
    );
  } catch (e) {
    console.warn("[BackupSync] queueBackupAndSync failed:", e);
  }
}

/** Push queued backups to Supabase (no-op if env not configured or queue empty). */
export async function trySyncBackups() {
  if (!supabase) {
    console.warn(
      "[BackupSync] Supabase client not configured. Skipping cloud sync."
    );
    return false;
  }

  const q = readQueue();
  if (!q.length) {
    console.log("[BackupSync] queue empty — nothing to sync");
    return true;
  }

  // Prepare rows for insert
  const rows = q.map((b) => ({
    id: b.id,
    cruise_id: b.cruiseId,
    payload: b.payload,
  }));

  const { error } = await supabase.from("journal_backups").insert(rows);

  if (error) {
    console.warn("[BackupSync] insert error:", error);
    return false;
  }

  // clear queue
  writeQueue([]);
  console.log(`[BackupSync] synced ${rows.length} backup(s) to Supabase`);
  return true;
}

// ---- Tiny debug surface for DevTools ---------------------------------------
if (typeof window !== "undefined") {
  window.MAS = Object.assign(window.MAS || {}, {
    // check env + basic status
    status() {
      return {
        supabaseConfigured: !!supabase,
        queueLength: readQueue().length,
      };
    },
    // peek at the first queued backup (if any)
    peek() {
      const q = readQueue();
      return q[0] || null;
    },
    // force a sync now
    forceSync: trySyncBackups,
    // enqueue current cruise’s entries manually
    queue: queueBackupAndSync,
  });
}

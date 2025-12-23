// app/features/journal/journalStorage.js
// LocalStorage persistence + safety guards for journal entries

import { queueBackupAndSync } from "@/lib/backupSync";

/**
 * Key helper
 */
function journalKey(cruiseId) {
  return `cruiseJournalEntries_${cruiseId}`;
}

/**
 * Load all journal entries for a cruise
 * Returns: Array of entries (safe default [])
 */
export function loadJournalEntries(cruiseId) {
  if (!cruiseId) return [];

  try {
    const raw = localStorage.getItem(journalKey(cruiseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[JournalStorage] Failed to load entries:", err);
    return [];
  }
}

/**
 * Save or update a journal entry
 * Handles size limits + sync queueing
 */
export function saveJournalEntry({
  cruiseId,
  entry,
  existingEntries,
  autoSave = false,
}) {
  if (!cruiseId || !entry) {
    console.warn("[JournalStorage] Missing cruiseId or entry");
    return { success: false };
  }

  const existingIndex = existingEntries.findIndex(
    (e) => e.date === entry.date
  );

  const nextEntries =
    existingIndex >= 0
      ? (() => {
          const copy = [...existingEntries];
          copy[existingIndex] = entry;
          return copy;
        })()
      : [...existingEntries, entry];

  const payload = JSON.stringify(nextEntries);

  if (willExceedLocalStorage(payload)) {
    alert(
      "Save aborted: your device’s offline storage is full. Please delete photos or export a backup."
    );
    return { success: false, storageFull: true };
  }

  try {
    localStorage.setItem(journalKey(cruiseId), payload);

    try {
      queueBackupAndSync(cruiseId);
    } catch {
      // Backup sync failure should never block save
    }

    return {
      success: true,
      entries: nextEntries,
      updated: existingIndex >= 0,
    };
  } catch (err) {
    console.error("[JournalStorage] CRITICAL save failure:", err);
    alert("CRITICAL: Failed to save your journal entry.");
    return { success: false };
  }
}

/**
 * Remove all journal data for a cruise
 */
export function deleteJournalEntries(cruiseId) {
  try {
    localStorage.removeItem(journalKey(cruiseId));
  } catch (err) {
    console.warn("[JournalStorage] Failed to delete entries:", err);
  }
}

/**
 * Estimate if a payload will exceed localStorage safety margin
 */
function willExceedLocalStorage(valueStr) {
  try {
    localStorage.setItem("__ls_probe__", "1");
    localStorage.removeItem("__ls_probe__");
    const bytes = new Blob([valueStr]).size;
    return bytes > 4_500_000;
  } catch {
    return true;
  }
}

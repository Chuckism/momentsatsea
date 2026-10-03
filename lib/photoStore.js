// lib/photoStore.js
// IndexedDB photo storage for offline-first journaling.
//
// Each record keeps the original file plus a smaller display copy.
// Keepsakes and thumbnails use the display copy so phones don't have to
// decode dozens of 12MP originals at once; uploads and backups use the
// original.

const DB_NAME = 'momentsatsea';
const STORE = 'photos';

// Long edge of the display copy. Big enough for a full-page magazine
// photo or a 1080p video frame, small enough to decode many at once.
export const DISPLAY_MAX_EDGE = 2048;
const DISPLAY_QUALITY = 0.85;

let _photoDBPromise = null;

function openPhotoDB() {
  if (_photoDBPromise) return _photoDBPromise;

  _photoDBPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byCruise', 'cruiseId');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return _photoDBPromise;
}

function getRecord(id) {
  return openPhotoDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      })
  );
}

function putRecord(record) {
  return openPhotoDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE).put(record);
      })
  );
}

/* ---------------------------
   Display copies
---------------------------- */

function canvasToBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      type,
      quality
    )
  );
}

/**
 * Make a downscaled JPEG of an image blob, honoring EXIF rotation.
 * Returns { blob, width, height }, or null if the browser can't decode
 * the file (for example HEIC on Android). Callers then use the original.
 */
export async function makeDisplayCopy(blob, maxEdge = DISPLAY_MAX_EDGE) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    const out = await canvasToBlob(canvas, 'image/jpeg', DISPLAY_QUALITY);
    return { blob: out, width, height };
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}

/* ---------------------------
   Public API
---------------------------- */

export async function putPhoto({ id, cruiseId, arrayBuffer, type, caption = '' }) {
  const blob = new Blob([arrayBuffer], { type });
  const display = await makeDisplayCopy(blob);

  await putRecord({
    id,
    cruiseId,
    blob,
    type,
    caption,
    createdAt: Date.now(),
    display: display?.blob || null,
    width: display?.width || null,
    height: display?.height || null,
  });
}

/** The original file, as added. Use for uploads and backups. */
export async function getPhotoBlob(id) {
  const record = await getRecord(id);
  return record?.blob || null;
}

/**
 * The display copy, for thumbnails and keepsakes. Photos stored before
 * display copies existed get one made and saved on first request.
 */
export async function getDisplayBlob(id) {
  const record = await getRecord(id);
  if (!record) return null;
  if (record.display) return record.display;
  if (!record.blob) return null;

  const display = await makeDisplayCopy(record.blob);
  if (!display) return record.blob;

  try {
    await putRecord({
      ...record,
      display: display.blob,
      width: display.width,
      height: display.height,
    });
  } catch {
    // Saving the copy is an optimization; the photo still works without it.
  }
  return display.blob;
}

/** Display-copy dimensions, or null if not known yet. */
export async function getPhotoSize(id) {
  const record = await getRecord(id);
  if (!record?.width || !record?.height) return null;
  return { width: record.width, height: record.height };
}

export async function deletePhotoBlob(id) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(id);
  });
}

export async function deleteAllPhotosForCruise(cruiseId) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const idx = store.index('byCruise');
    const req = idx.openKeyCursor(IDBKeyRange.only(cruiseId));

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };

    req.onerror = () => reject(req.error);
  });
}

export async function getAllPhotosForCruise(cruiseId) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const idx = store.index('byCruise');
    const req = idx.openCursor(IDBKeyRange.only(cruiseId));

    const out = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push(cursor.value);
        cursor.continue();
      } else {
        resolve(out);
      }
    };

    req.onerror = () => reject(req.error);
  });
}

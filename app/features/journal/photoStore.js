// app/features/journal/photoStore.js
// IndexedDB photo storage for offline-first journaling

let _photoDBPromise = null;

function openPhotoDB() {
  if (_photoDBPromise) return _photoDBPromise;

  _photoDBPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('momentsatsea', 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) {
        const store = db.createObjectStore('photos', { keyPath: 'id' });
        store.createIndex('byCruise', 'cruiseId');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return _photoDBPromise;
}

export async function putPhoto({ id, cruiseId, arrayBuffer, type, caption = '' }) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const blob = new Blob([arrayBuffer], { type });
    tx.objectStore('photos').put({
      id,
      cruiseId,
      blob,
      type,
      caption,
      createdAt: Date.now(),
    });
  });
}

export async function getPhotoBlob(id) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').get(id);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhotoBlob(id) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('photos').delete(id);
  });
}

export async function deleteAllPhotosForCruise(cruiseId) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
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
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
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

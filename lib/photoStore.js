// app/lib/photoStore.js

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

export async function getPhotoBlob(id) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').get(id);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

// Shared setup for the end-to-end tests.

import { test as base, expect } from '@playwright/test';

export { expect };

export const SHIP = 'Test Ship';

// 1x1 PNG
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Every test fails on page errors, and confirm() prompts are accepted but
 * recorded so tests can check them.
 */
export const test = base.extend({
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await use(errors);
      expect(errors, 'page errors').toEqual([]);
    },
    { auto: true },
  ],
  dialogs: [
    async ({ page }, use) => {
      const dialogs = [];
      page.on('dialog', async (d) => {
        dialogs.push(d.message());
        await d.accept();
      });
      await use(dialogs);
    },
    { auto: true },
  ],
});

export const readStorage = (page, key) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);

/** Create a cruise through the UI and land on its journal. */
export async function createCruise(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Start New Cruise/ }).click();
  await page.getByPlaceholder('Ship name').fill(SHIP);
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill('2026-10-02');
  await dates.nth(1).fill('2026-10-05');
  await page.getByRole('button', { name: 'Generate Itinerary' }).click();
  await page.getByRole('button', { name: 'Begin Your Journal' }).click();
  await expect(page.getByPlaceholder('Weather')).toBeVisible();

  const [cruise] = await readStorage(page, 'allCruises');
  return cruise.id;
}

/** Reloading always lands on the cruise list. */
export async function reopenCruise(page) {
  await page.reload();
  await page.getByRole('heading', { name: SHIP }).click();
  await expect(page.getByPlaceholder('Weather')).toBeVisible();
}

/** Wait for the debounced autosave to write a value. */
export async function expectSaved(page, cruiseId, date, check) {
  await expect
    .poll(async () => {
      const entries = (await readStorage(page, `cruiseJournalEntries_${cruiseId}`)) || [];
      return check(entries.find((e) => e.date === date));
    })
    .toBe(true);
}

/** Make a JPEG of the given size in the browser and return it as a Buffer. */
export async function makeJpeg(page, width, height) {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0ea5e9');
      g.addColorStop(1, '#f97316');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    [width, height]
  );
  return Buffer.from(base64, 'base64');
}

/**
 * Seed a finished cruise directly into storage. Photos are stored the way
 * older builds stored them (original only, no display copy), so tests
 * also cover the upgrade path.
 *
 * days: number of itinerary days; photosPerDay: array of counts per day;
 * favorites: photo ids to mark as favorites. Photo ids are `d{day}-p{n}`.
 */
export async function seedFinishedCruise(
  page,
  { days = 3, photosPerDay = [1, 1, 1], favorites = [], photoSize = [1600, 1200] } = {}
) {
  await page.goto('/');
  const cruiseId = await page.evaluate(
    async ({ days, photosPerDay, favorites, photoSize, ship }) => {
      const cruiseId = 'seed-cruise';
      const start = new Date('2026-10-02T00:00:00');
      const itinerary = Array.from({ length: days }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const type = i === 0 ? 'embarkation' : i === days - 1 ? 'disembarkation' : i % 2 ? 'port' : 'sea';
        return { date, type, port: type === 'port' ? 'Cozumel, Mexico' : '' };
      });

      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('momentsatsea', 1);
        req.onupgradeneeded = () => {
          const store = req.result.createObjectStore('photos', { keyPath: 'id' });
          store.createIndex('byCruise', 'cruiseId');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const makeBlob = (hue, label) =>
        new Promise((resolve) => {
          const c = document.createElement('canvas');
          [c.width, c.height] = photoSize;
          const ctx = c.getContext('2d');
          ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 120px sans-serif';
          ctx.fillText(label, 80, 200);
          c.toBlob(resolve, 'image/jpeg', 0.85);
        });

      const entries = [];
      for (let di = 0; di < days; di++) {
        const photos = [];
        for (let pi = 0; pi < (photosPerDay[di] || 0); pi++) {
          const id = `d${di}-p${pi}`;
          const blob = await makeBlob((di * 70 + pi * 15) % 360, id);
          await new Promise((resolve, reject) => {
            const tx = db.transaction('photos', 'readwrite');
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.objectStore('photos').put({ id, cruiseId, blob, type: 'image/jpeg', caption: '', createdAt: Date.now() });
          });
          photos.push({ id, caption: pi === 0 ? `Caption ${id}` : '', activityId: null, favorite: favorites.includes(id) });
        }
        entries.push({ date: itinerary[di].date, weather: 'Sunny and warm', notes: `Notes for day ${di + 1}`, summary: '', photos, activities: [] });
      }
      db.close();

      localStorage.setItem('allCruises', JSON.stringify([{
        id: cruiseId, ship, homePort: 'Galveston, Texas',
        departureDate: itinerary[0].date, returnDate: itinerary[days - 1].date,
        itinerary, status: 'finished', finishedAt: new Date().toISOString(), label: 'Test_1',
      }]));
      localStorage.setItem(`cruiseJournalEntries_${cruiseId}`, JSON.stringify(entries));
      return cruiseId;
    },
    { days, photosPerDay, favorites, photoSize, ship: SHIP }
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: SHIP })).toBeVisible();
  return cruiseId;
}

/** Read one photo record from IndexedDB, with the display copy's size. */
export function readPhotoRecord(page, id) {
  return page.evaluate(
    (photoId) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('momentsatsea', 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const get = req.result.transaction('photos').objectStore('photos').get(photoId);
          get.onsuccess = async () => {
            const r = get.result;
            if (!r) return resolve(null);
            let displaySize = null;
            if (r.display) {
              const bmp = await createImageBitmap(r.display);
              displaySize = { width: bmp.width, height: bmp.height };
              bmp.close();
            }
            resolve({
              originalBytes: r.blob?.size || 0,
              hasDisplay: !!r.display,
              displayType: r.display?.type || null,
              displayBytes: r.display?.size || 0,
              displaySize,
              width: r.width || null,
              height: r.height || null,
            });
          };
          get.onerror = () => reject(get.error);
        };
      }),
    id
  );
}

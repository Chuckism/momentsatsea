// End-to-end checks for the offline journal: autosave, local storage,
// deletes and the finished-cruise screen. Run with `npm run test:e2e`.

import {
  test,
  expect,
  SHIP,
  PNG,
  readStorage,
  createCruise,
  reopenCruise,
  expectSaved,
} from './helpers.mjs';

/* ---------- Tests ---------- */

test('day picker shows the stored date in a US time zone', async ({ page }) => {
  await createCruise(page);
  const firstDay = page.locator('select').first().locator('option').first();
  await expect(firstDay).toHaveText(/Oct 02 2026/);
});

test('notes autosave without pressing Save, and survive a reload', async ({ page }) => {
  const cruiseId = await createCruise(page);

  await page.getByPlaceholder('Notes').fill('Sailed out at sunset');
  await expectSaved(page, cruiseId, '2026-10-02', (e) => e?.notes === 'Sailed out at sunset');

  await reopenCruise(page);
  await expect(page.getByPlaceholder('Notes')).toHaveValue('Sailed out at sunset');
});

test('switching days saves pending text immediately', async ({ page }) => {
  const cruiseId = await createCruise(page);

  await page.getByPlaceholder('Weather').fill('Breezy');
  await page.getByRole('button', { name: /Next/ }).click();

  // No waiting: the day switch itself must have written the entry.
  const entries = await readStorage(page, `cruiseJournalEntries_${cruiseId}`);
  expect(entries.find((e) => e.date === '2026-10-02')?.weather).toBe('Breezy');
});

test('uploaded photos survive a reload without pressing Save', async ({ page }) => {
  await createCruise(page);

  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('img[alt="Day photo"]')).toHaveCount(1);

  await reopenCruise(page);
  await expect(page.locator('img[alt="Day photo"]')).toHaveCount(1);
});

test('backup queue keeps one snapshot per cruise and compacts old queues', async ({ page }) => {
  // Older builds appended a full snapshot on every keystroke.
  await page.goto('/');
  await page.evaluate(() => {
    const old = Array.from({ length: 50 }, (_, i) => ({
      id: `old-${i}`,
      cruiseId: 'legacy',
      payload: { filler: 'x'.repeat(1000) },
    }));
    localStorage.setItem('mas_backup_queue', JSON.stringify(old));
  });

  const cruiseId = await createCruise(page);
  await page.getByRole('button', { name: /Add Activity/ }).click();
  await page
    .getByPlaceholder('Describe what happened…')
    .pressSequentially('We saw a sea turtle near the reef. '.repeat(5), { delay: 5 });
  await expectSaved(page, cruiseId, '2026-10-02', (e) =>
    e?.activities?.[0]?.description?.includes('sea turtle')
  );

  const queue = await readStorage(page, 'mas_backup_queue');
  expect(queue.filter((q) => q.cruiseId === String(cruiseId))).toHaveLength(1);
  expect(queue.filter((q) => q.cruiseId === 'legacy')).toHaveLength(1);
});

test('deleting an activity asks first and stays deleted', async ({ page, dialogs }) => {
  const cruiseId = await createCruise(page);

  await page.getByRole('button', { name: /Add Activity/ }).click();
  await page.getByPlaceholder('Activity title (optional)').fill('Snorkeling');
  await expectSaved(page, cruiseId, '2026-10-02', (e) => e?.activities?.[0]?.title === 'Snorkeling');

  await reopenCruise(page);
  await page.locator('button.ml-2.text-red-500').click();
  expect(dialogs.at(-1)).toMatch(/Delete this activity/);

  await reopenCruise(page);
  await expect(page.getByPlaceholder('Activity title (optional)')).toHaveCount(0);
});

test('finished cruise hides cloud actions and shows the backup panel', async ({ page }) => {
  await createCruise(page);
  await page.getByRole('button', { name: /Finish Cruise/ }).click();
  await expect(page.getByRole('heading', { name: SHIP })).toBeVisible();

  // Sync and keepsake orders need the backend, which is off (CLOUD_ENABLED).
  await expect(page.getByRole('button', { name: 'Sync' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create Keepsakes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Preview Magazine' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Export Backup/ })).toBeVisible();
});

test('magazine prints what was recorded and nothing invented', async ({ page }) => {
  const cruiseId = await createCruise(page);
  await page.getByPlaceholder('Weather').fill('Breezy');
  await page.getByPlaceholder('Notes').fill('Sailed out at sunset');
  await expectSaved(page, cruiseId, '2026-10-02', (e) => e?.notes === 'Sailed out at sunset');
  await page.getByRole('button', { name: /Finish Cruise/ }).click();

  await page.getByRole('button', { name: 'Preview Magazine' }).click();
  const magazine = page.locator('#magazine-content');
  await expect(magazine).toContainText('Breezy');
  // Days with notes but no generated summary still print their notes.
  await expect(magazine).toContainText('Sailed out at sunset');
  // Days with no weather recorded must not claim "Sunny".
  await expect(magazine).not.toContainText('Sunny');
});

test('deleting a cruise removes its journal, photos and queued backup', async ({ page }) => {
  const cruiseId = await createCruise(page);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('img[alt="Day photo"]')).toHaveCount(1);

  await page.reload();
  await page.locator('button.absolute.top-4.right-4').click();
  await expect(page.getByRole('heading', { name: SHIP })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: /Start New Cruise/ })).toBeVisible();
  expect(await readStorage(page, 'allCruises')).toEqual([]);
  expect(await readStorage(page, `cruiseJournalEntries_${cruiseId}`)).toBeNull();

  const queue = (await readStorage(page, 'mas_backup_queue')) || [];
  expect(queue.some((q) => q.cruiseId === String(cruiseId))).toBe(false);

  const photosLeft = await page.evaluate(
    (cid) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('momentsatsea', 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const count = req.result
            .transaction('photos')
            .objectStore('photos')
            .index('byCruise')
            .count(IDBKeyRange.only(cid));
          count.onsuccess = () => resolve(count.result);
        };
      }),
    cruiseId
  );
  expect(photosLeft).toBe(0);
});

// End-to-end checks for keepsakes: display copies, favorites, photo
// selection, saving and sharing, and the highlight video.

import fs from 'node:fs/promises';
import {
  test,
  expect,
  readStorage,
  createCruise,
  reopenCruise,
  expectSaved,
  makeJpeg,
  seedFinishedCruise,
  readPhotoRecord,
} from './helpers.mjs';

/** Width and height from a PNG file's header. */
async function pngSize(path) {
  const buf = await fs.readFile(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function uploadDayPhoto(page, buffer, name = 'photo.jpg') {
  const before = await page.locator('img[alt="Day photo"]').count();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name, mimeType: 'image/jpeg', buffer });
  await expect(page.locator('img[alt="Day photo"]')).toHaveCount(before + 1);
}

/* ---------- Photo storage ---------- */

test('new photos get a 2048px display copy and keep the original', async ({ page }) => {
  const cruiseId = await createCruise(page);
  const big = await makeJpeg(page, 4000, 3000);
  await uploadDayPhoto(page, big);

  const [entry] = await readStorage(page, `cruiseJournalEntries_${cruiseId}`);
  const record = await readPhotoRecord(page, entry.photos[0].id);
  expect(record.originalBytes).toBe(big.length);
  expect(record.displayType).toBe('image/jpeg');
  expect(record.displaySize).toEqual({ width: 2048, height: 1536 });
  expect(record.displayBytes).toBeLessThan(record.originalBytes);
});

test('photos saved by older versions get a display copy on first use', async ({ page }) => {
  await seedFinishedCruise(page, { photosPerDay: [1, 1, 1], photoSize: [3000, 2000] });
  expect((await readPhotoRecord(page, 'd0-p0')).hasDisplay).toBe(false);

  await page.getByRole('button', { name: 'Preview Magazine' }).click();
  await expect
    .poll(async () => (await readPhotoRecord(page, 'd0-p0')).displaySize)
    .toEqual({ width: 2048, height: 1365 });
});

/* ---------- Favorites ---------- */

test('starring a photo saves it as a favorite', async ({ page }) => {
  const cruiseId = await createCruise(page);
  await uploadDayPhoto(page, await makeJpeg(page, 800, 600), 'a.jpg');
  await uploadDayPhoto(page, await makeJpeg(page, 800, 600), 'b.jpg');

  const stars = page.getByRole('button', { name: 'Mark as favorite' });
  await stars.nth(1).click();
  await expectSaved(page, cruiseId, '2026-10-02', (e) => e?.photos?.[1]?.favorite === true && !e.photos[0].favorite);

  await reopenCruise(page);
  await expect(page.getByRole('button', { name: 'Remove from favorites' })).toHaveCount(1);
});

test('the magazine cover opens on a favorite', async ({ page }) => {
  await seedFinishedCruise(page, { photosPerDay: [2, 2, 2], favorites: ['d2-p1'] });
  await page.getByRole('button', { name: 'Preview Magazine' }).click();
  await expect(page.getByTestId('magazine-cover').locator('[data-photo-id]')).toHaveAttribute('data-photo-id', 'd2-p1');
});

/* ---------- Postcard ---------- */

test('postcard saves as a 2x PNG on desktop', async ({ page }) => {
  await seedFinishedCruise(page);
  await page.getByRole('button', { name: 'Postcard' }).click();
  await expect(page.getByTestId('postcard').locator('img[data-photo-id]').first()).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Postcard' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^postcard-.+\.png$/);
  expect(await pngSize(await download.path())).toEqual({ width: 1600, height: 1040 });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    // Record what would go to the system share sheet.
    await page.addInitScript(() => {
      window.__shared = [];
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data) => {
          window.__shared.push(
            (data.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size }))
          );
        },
      });
    });
  });

  test('postcard fits the screen and shares from a second tap', async ({ page }) => {
    await seedFinishedCruise(page);
    await page.getByRole('button', { name: 'Postcard' }).click();

    const card = page.getByTestId('postcard');
    await expect(card.locator('img[data-photo-id]').first()).toBeVisible();
    const box = await card.boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);

    await page.getByRole('button', { name: 'Save Postcard' }).click();
    await page.getByRole('button', { name: 'Save / Share Postcard' }).click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);

    const [[file]] = await page.evaluate(() => window.__shared);
    expect(file.name).toMatch(/\.png$/);
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(10_000);
  });

  test('backup export opens the share sheet', async ({ page }) => {
    await seedFinishedCruise(page);
    await page.getByRole('button', { name: /Export Backup/ }).click();
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
    const [[file]] = await page.evaluate(() => window.__shared);
    expect(file.name).toMatch(/^momentsatsea-backup-\d{8}\.json$/);
  });
});

/* ---------- Highlight video ---------- */

test('video plan uses favorites and spreads photos across the cruise', async ({ page }) => {
  await seedFinishedCruise(page, { photosPerDay: [30, 5, 5] });
  await page.getByRole('button', { name: 'Video' }).click();
  await expect(page.getByTestId('video-plan')).toContainText('Uses 20 photos');
});

async function renderVideo(page, formatLabel) {
  await page.getByRole('button', { name: 'Video' }).click();
  if (formatLabel) await page.getByRole('button', { name: new RegExp(formatLabel) }).click();
  await page.getByRole('button', { name: 'Start Rendering' }).click();
  const video = page.getByTestId('video-result');
  await expect(video).toBeVisible({ timeout: 60_000 });
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const v = document.querySelector('[data-testid="video-result"]');
        const done = () => resolve({ width: v.videoWidth, height: v.videoHeight });
        if (v.readyState >= 1) done();
        else v.addEventListener('loadedmetadata', done, { once: true });
      })
  );
}

test('landscape video renders in Full HD and downloads', async ({ page }) => {
  test.setTimeout(120_000);
  await seedFinishedCruise(page, { days: 2, photosPerDay: [1, 1] });
  expect(await renderVideo(page)).toEqual({ width: 1920, height: 1080 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Save \/ Share Video/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^test-ship-highlights\.(mp4|webm)$/);
  const { size } = await fs.stat(await download.path());
  expect(size).toBeGreaterThan(50_000);
});

test('vertical video renders at 1080x1920', async ({ page }) => {
  test.setTimeout(120_000);
  await seedFinishedCruise(page, { days: 2, photosPerDay: [1, 1] });
  expect(await renderVideo(page, 'Vertical')).toEqual({ width: 1080, height: 1920 });
});

test('rendering stops with a clear message if the app goes to the background', async ({ page }) => {
  await seedFinishedCruise(page, { days: 2, photosPerDay: [1, 1] });
  await page.getByRole('button', { name: 'Video' }).click();
  await page.getByRole('button', { name: 'Start Rendering' }).click();
  await expect(page.getByText('Rendering Video...')).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText(/Keep MomentsAtSea open/)).toBeVisible();
  await expect(page.getByTestId('video-result')).toHaveCount(0);
});

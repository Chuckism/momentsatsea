// End-to-end checks for the magazine PDF and its on-screen preview.

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test, expect, seedFinishedCruise } from './helpers.mjs';

// Playwright's ESM loader can't load pdf-lib's package entry; require works.
const { PDFDocument } = createRequire(import.meta.url)('pdf-lib');

async function openMagazine(page) {
  await page.getByRole('button', { name: 'Preview Magazine' }).click();
  await expect(page.getByTestId('magazine-cover')).toBeVisible();
}

test('magazine saves as a letter-size PDF with one page per magazine page', async ({ page }) => {
  test.setTimeout(90_000);
  await seedFinishedCruise(page, { days: 3, photosPerDay: [2, 1, 1] });
  await openMagazine(page);

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('test-ship-magazine.pdf');

  const pdf = await PDFDocument.load(await fs.readFile(await download.path()));
  // Cover + 3 days + back cover
  expect(pdf.getPageCount()).toBe(5);
  for (const p of pdf.getPages()) {
    expect(p.getSize()).toEqual({ width: 612, height: 792 });
  }
  expect(pdf.getTitle()).toBe('Test Ship magazine');
});

test('busy days continue on photo pages and every photo appears', async ({ page }) => {
  test.setTimeout(90_000);
  await seedFinishedCruise(page, { days: 3, photosPerDay: [11, 1, 1] });
  await openMagazine(page);

  // Day 1: 4 on its page, then 6 + 1 on two photo pages.
  const photoPages = page.getByTestId('photo-page');
  await expect(photoPages).toHaveCount(2);
  await expect(photoPages.nth(0).locator('[data-photo-id]')).toHaveCount(6);
  await expect(photoPages.nth(1).locator('[data-photo-id]')).toHaveCount(1);
  await expect(photoPages.nth(1)).toContainText('Page 4');

  const ids = await page.locator('#magazine-content [data-photo-id]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-photo-id'))
  );
  for (let i = 0; i < 11; i++) expect(ids).toContain(`d0-p${i}`);

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const pdf = await PDFDocument.load(await fs.readFile(await (await downloadPromise).path()));
  // Cover + day 1 + 2 photo pages + days 2-3 + back cover
  expect(pdf.getPageCount()).toBe(7);
});

test('very busy days are capped at 16 photos, favorites included', async ({ page }) => {
  await seedFinishedCruise(page, { days: 2, photosPerDay: [25, 1], favorites: ['d0-p24'] });
  await openMagazine(page);

  const ids = await page.locator('#magazine-content [data-photo-id]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-photo-id'))
  );
  // The cover shows a favorite too, so count day 1's photos on the inside pages only.
  const inside = await page
    .locator('#magazine-content [data-photo-id]:not([data-testid="magazine-cover"] *)')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-photo-id')).filter((id) => id.startsWith('d0-')));
  expect(new Set(inside).size).toBe(16);
  expect(ids).toContain('d0-p24');
});

test('printing is unaffected by the on-screen page scaling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedFinishedCruise(page);
  await openMagazine(page);

  const cover = page.getByTestId('magazine-cover');
  expect((await cover.boundingBox()).width).toBeLessThan(400);

  await page.emulateMedia({ media: 'print' });
  const printed = await cover.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    transform: getComputedStyle(el.parentElement).transform,
  }));
  expect(printed.transform).toBe('none');
  expect(printed.width).toBe(816);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('pages fit the screen and the PDF shares from a second tap', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      window.__shared = [];
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data) => {
          window.__shared.push((data.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })));
        },
      });
    });

    await seedFinishedCruise(page);
    await openMagazine(page);
    const box = await page.getByTestId('magazine-cover').boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);
    expect(box.x).toBeGreaterThanOrEqual(0);

    await page.getByRole('button', { name: 'Save PDF' }).click();
    await page.getByRole('button', { name: 'Save / Share PDF' }).click({ timeout: 60_000 });
    await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);

    const [[file]] = await page.evaluate(() => window.__shared);
    expect(file.name).toBe('test-ship-magazine.pdf');
    expect(file.type).toBe('application/pdf');
    expect(file.size).toBeGreaterThan(50_000);
  });
});

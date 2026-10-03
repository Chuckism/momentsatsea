'use client';
// lib/magazinePdf.js
// Turn the magazine's on-screen pages into a PDF, without the print dialog.
//
// window.print() output varies by browser and does nothing in the native
// apps' WebViews. This renders each page to a JPEG and places it on a US
// Letter page, so everyone gets the same file.

import * as htmlToImage from 'html-to-image';
import { APP_NAME } from './brand';

// Magazine pages are 8.5in x 11in at 96 CSS px per inch.
export const PAGE_W_PX = 816;
export const PAGE_H_PX = 1056;
const PAGE_W_PT = 612; // 8.5in at 72pt per inch
const PAGE_H_PT = 792;

// 2x is about 190 dpi on paper: sharp on screens and home printers, and
// small enough for phones to render one page at a time. Print-on-demand
// books will need their own 300 dpi pipeline with bleed.
const DEFAULT_PIXEL_RATIO = 2;
const JPEG_QUALITY = 0.85;

/** Wait until every photo on the page has loaded and decoded. */
async function waitForImages(node, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stillLoading = node.querySelector('[data-photo-loading]');
    const imgs = [...node.querySelectorAll('img')];
    if (!stillLoading && imgs.every((img) => img.complete)) {
      await Promise.all(imgs.map((img) => img.decode?.().catch(() => {})));
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Page image was empty'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  );
}

/**
 * Build a PDF from page elements, one PDF page per element.
 * onProgress(done, total) is called before each page.
 */
export async function buildMagazinePdf(
  pages,
  { title = 'Cruise Magazine', pixelRatio = DEFAULT_PIXEL_RATIO, onProgress } = {}
) {
  if (!pages.length) throw new Error('The magazine has no pages yet.');

  // Loaded on demand so pdf-lib isn't part of the app's first download.
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator(APP_NAME);
  pdf.setProducer(APP_NAME);

  if (document.fonts?.ready) await document.fonts.ready;
  // Embedding fonts is slow; do it once for all pages.
  let fontEmbedCSS;
  try {
    fontEmbedCSS = await htmlToImage.getFontEmbedCSS(pages[0]);
  } catch {
    fontEmbedCSS = undefined;
  }

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length);
    const page = pages[i];
    await waitForImages(page);

    const canvas = await htmlToImage.toCanvas(page, {
      pixelRatio,
      fontEmbedCSS,
      width: PAGE_W_PX,
      height: PAGE_H_PX,
      backgroundColor: '#ffffff',
      // On-screen controls (cover photo arrows) stay out of the file.
      filter: (node) => !node.classList?.contains('no-print'),
      style: { boxShadow: 'none', margin: '0' },
    });
    const jpeg = await canvasToJpeg(canvas);
    // Release the canvas memory right away; Safari holds on to it otherwise.
    canvas.width = 0;
    canvas.height = 0;

    const image = await pdf.embedJpg(await jpeg.arrayBuffer());
    const pdfPage = pdf.addPage([PAGE_W_PT, PAGE_H_PT]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
  }
  onProgress?.(pages.length, pages.length);

  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

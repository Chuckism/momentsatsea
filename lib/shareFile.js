'use client';
// lib/shareFile.js
// One way to hand a keepsake file to the user, wherever the app runs.
//
// - Native apps (Capacitor): write the file to the cache folder, then open
//   the system share sheet. WebViews ignore <a download> and window.print.
// - Phones and tablets in a browser: the Web Share API share sheet, which
//   offers "Save Image", "Save Video", Photos, Messages and so on.
// - Desktop browsers: a normal download.

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function prefersShareSheet() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * True when the share sheet must be opened from a fresh tap: phone
 * browsers drop the tap if generating the file took a while. Native apps
 * don't need one; desktops download instead.
 */
export function shareNeedsFreshTap() {
  return (
    !isNativeApp() &&
    prefersShareSheet() &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  );
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function shareNative(blob, filename, title) {
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({ title, files: [uri] });
}

function isCancel(err) {
  return err?.name === 'AbortError' || /cancel/i.test(err?.message || '');
}

/**
 * Save or share a generated file.
 * Returns 'shared', 'downloaded' or 'cancelled'.
 *
 * Call it from a click handler: browsers only open the share sheet in
 * response to a tap, so generate the file first and share on the next tap
 * if generating takes more than a moment.
 */
export async function saveOrShareFile(blob, filename, { title } = {}) {
  if (isNativeApp()) {
    try {
      await shareNative(blob, filename, title);
      return 'shared';
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
      throw err;
    }
  }

  if (prefersShareSheet() && typeof navigator.share === 'function') {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (err) {
        if (isCancel(err)) return 'cancelled';
        // NotAllowedError means the tap expired; fall back to a download.
      }
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}

/** A filename-safe slug, e.g. "Allure of the Seas" -> "allure-of-the-seas". */
export function slugify(text, fallback = 'cruise') {
  const slug = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

// Unit tests for keepsake photo selection. Run with `npm run test:unit`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectCruisePhotos,
  evenlySpacedIndexes,
  pickPhotos,
  favoritesFirst,
} from '../../lib/photoSelection.js';

const itinerary = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(
  (date, i) => ({ date, type: i === 0 ? 'embarkation' : 'sea', port: '' })
);

// Embarkation day has 30 photos, the other days 5 each.
function makeEntries({ favorites = [] } = {}) {
  const counts = [30, 5, 5, 5];
  return itinerary.map((d, di) => ({
    date: d.date,
    photos: Array.from({ length: counts[di] }, (_, i) => {
      const id = `d${di}-p${i}`;
      return { id, caption: '', favorite: favorites.includes(id) };
    }),
    activities: [],
  }));
}

test('collectCruisePhotos returns photos in itinerary order', () => {
  const entries = makeEntries().reverse(); // saved out of order
  const photos = collectCruisePhotos(entries, itinerary);
  assert.equal(photos.length, 45);
  assert.equal(photos[0].id, 'd0-p0');
  assert.equal(photos.at(-1).id, 'd3-p4');
});

test('collectCruisePhotos includes legacy activity photos with titles', () => {
  const entries = [
    {
      date: '2026-10-03',
      photos: [{ id: 'a', activityId: 'act1' }],
      activities: [{ id: 'act1', title: 'Snorkel', photos: [{ id: 'b' }] }],
    },
  ];
  const photos = collectCruisePhotos(entries, itinerary);
  assert.deepEqual(photos.map((p) => p.id), ['a', 'b']);
  assert.equal(photos[1].activityTitle, 'Snorkel');
});

test('evenlySpacedIndexes spreads picks across the range', () => {
  assert.deepEqual(evenlySpacedIndexes(10, 2), [2, 7]);
  assert.deepEqual(evenlySpacedIndexes(3, 5), [0, 1, 2]);
  assert.deepEqual(evenlySpacedIndexes(5, 0), []);
});

test('pickPhotos covers every day instead of the first N photos', () => {
  const photos = collectCruisePhotos(makeEntries(), itinerary);
  const picked = pickPhotos(photos, 12);
  assert.equal(picked.length, 12);

  const perDay = new Map();
  for (const p of picked) perDay.set(p.date, (perDay.get(p.date) || 0) + 1);
  assert.equal(perDay.size, 4, 'every day represented');
  assert.deepEqual([...perDay.values()], [3, 3, 3, 3]);
});

test('pickPhotos gives leftover slots to the days that still have photos', () => {
  const photos = collectCruisePhotos(makeEntries(), itinerary);
  const picked = pickPhotos(photos, 25);
  const perDay = new Map();
  for (const p of picked) perDay.set(p.date, (perDay.get(p.date) || 0) + 1);
  // Days 2-4 only have 5 each; embarkation day absorbs the rest.
  assert.deepEqual([...perDay.values()], [10, 5, 5, 5]);
});

test('pickPhotos always includes favorites and keeps trip order', () => {
  const favorites = ['d3-p4', 'd0-p29'];
  const photos = collectCruisePhotos(makeEntries({ favorites }), itinerary);
  const picked = pickPhotos(photos, 6);
  const ids = picked.map((p) => p.id);
  for (const f of favorites) assert.ok(ids.includes(f), `${f} included`);

  const order = photos.map((p) => p.id);
  const positions = ids.map((id) => order.indexOf(id));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'trip order');
});

test('pickPhotos samples favorites evenly when there are too many', () => {
  const favorites = Array.from({ length: 30 }, (_, i) => `d0-p${i}`);
  const photos = collectCruisePhotos(makeEntries({ favorites }), itinerary);
  const picked = pickPhotos(photos, 3);
  assert.ok(picked.every((p) => p.favorite));
  assert.deepEqual(picked.map((p) => p.id), ['d0-p5', 'd0-p15', 'd0-p25']);
});

test('pickPhotos returns everything when there are fewer photos than slots', () => {
  const photos = collectCruisePhotos(makeEntries(), itinerary).slice(0, 3);
  assert.equal(pickPhotos(photos, 10).length, 3);
  assert.deepEqual(pickPhotos([], 10), []);
});

test('favoritesFirst moves favorites ahead and keeps the rest in order', () => {
  const out = favoritesFirst([
    { id: 'a' },
    { id: 'b', favorite: true },
    { id: 'c' },
  ]);
  assert.deepEqual(out.map((p) => p.id), ['b', 'a', 'c']);
});

// lib/photoSelection.js
// Choosing which photos go into a keepsake.
//
// Keepsakes hold fewer photos than a cruise produces. Taking the first N
// fills a video with embarkation day, so instead: favorites first, then
// the remaining slots spread evenly across the days, then everything back
// in trip order.

/**
 * Flatten a cruise's journal entries into one photo list in trip order.
 * Entries are the saved journal entries; itinerary orders the days.
 */
export function collectCruisePhotos(entries = [], itinerary = []) {
  const dayOrder = new Map(itinerary.map((d, i) => [d.date, i]));
  const sortedEntries = [...entries].sort((a, b) => {
    const ai = dayOrder.has(a.date) ? dayOrder.get(a.date) : Infinity;
    const bi = dayOrder.has(b.date) ? dayOrder.get(b.date) : Infinity;
    return ai - bi || String(a.date).localeCompare(String(b.date));
  });

  const photos = [];
  for (const entry of sortedEntries) {
    const day = itinerary.find((d) => d.date === entry.date) || entry.dayInfo || null;
    const activityTitles = new Map(
      (entry.activities || []).map((a) => [a.id, a.title || ''])
    );

    const add = (p, activityId) => {
      if (!p?.id) return;
      photos.push({
        id: p.id,
        caption: p.caption || '',
        favorite: !!p.favorite,
        date: entry.date,
        day,
        activityId: activityId || null,
        activityTitle: activityId ? activityTitles.get(activityId) || '' : '',
      });
    };

    for (const p of entry.photos || []) add(p, p.activityId);
    // Older entries kept activity photos on the activity itself.
    for (const a of entry.activities || []) {
      for (const p of a.photos || []) add(p, a.id);
    }
  }
  return photos;
}

/** Pick `count` indexes from 0..n-1, evenly spaced. */
export function evenlySpacedIndexes(n, count) {
  if (count <= 0 || n <= 0) return [];
  if (count >= n) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: count }, (_, i) =>
    Math.min(n - 1, Math.floor(((i + 0.5) * n) / count))
  );
}

/**
 * Choose up to `count` photos: favorites first, the rest balanced across
 * days, returned in trip order. `photos` must already be in trip order
 * (as collectCruisePhotos returns them).
 */
export function pickPhotos(photos = [], count) {
  if (!photos.length || count <= 0) return [];
  if (photos.length <= count) return [...photos];

  const position = new Map(photos.map((p, i) => [p.id, i]));
  const favorites = photos.filter((p) => p.favorite);

  let chosen;
  if (favorites.length >= count) {
    chosen = evenlySpacedIndexes(favorites.length, count).map((i) => favorites[i]);
  } else {
    chosen = [...favorites];

    // Group the remaining photos by day, keeping trip order.
    const days = [];
    const byDate = new Map();
    for (const p of photos) {
      if (p.favorite) continue;
      if (!byDate.has(p.date)) {
        byDate.set(p.date, []);
        days.push(p.date);
      }
      byDate.get(p.date).push(p);
    }

    // Give each free slot to the day with the fewest photos chosen so far.
    const chosenPerDay = new Map();
    for (const p of chosen) {
      chosenPerDay.set(p.date, (chosenPerDay.get(p.date) || 0) + 1);
    }
    const allotted = new Map(days.map((d) => [d, 0]));
    let remaining = count - chosen.length;
    while (remaining > 0) {
      let best = null;
      for (const d of days) {
        if (allotted.get(d) >= byDate.get(d).length) continue;
        const load = (chosenPerDay.get(d) || 0) + allotted.get(d);
        if (best === null || load < best.load) best = { d, load };
      }
      if (!best) break;
      allotted.set(best.d, allotted.get(best.d) + 1);
      remaining--;
    }

    for (const d of days) {
      const pool = byDate.get(d);
      for (const i of evenlySpacedIndexes(pool.length, allotted.get(d))) {
        chosen.push(pool[i]);
      }
    }
  }

  return chosen.sort((a, b) => position.get(a.id) - position.get(b.id));
}

/** Favorites first, then the rest; order otherwise unchanged. */
export function favoritesFirst(photos = []) {
  return [...photos.filter((p) => p.favorite), ...photos.filter((p) => !p.favorite)];
}

/** Read a cruise's saved journal entries from localStorage. */
export function loadCruisePhotos(cruise) {
  try {
    const raw = localStorage.getItem(`cruiseJournalEntries_${cruise.id}`);
    const entries = raw ? JSON.parse(raw) : [];
    return collectCruisePhotos(Array.isArray(entries) ? entries : [], cruise.itinerary || []);
  } catch {
    return [];
  }
}

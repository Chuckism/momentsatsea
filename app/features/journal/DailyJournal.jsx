'use client';

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  Upload,
  X,
  Anchor,
  Star,
} from "lucide-react";

import DayBanner from "@/app/components/DayBanner";
import DailyGuidance from "@/app/components/DailyGuidance";


import {
  putPhoto,
  getDisplayBlob,
  deletePhotoBlob,
} from "./photoStore";

import {
  loadJournalEntries,
  saveJournalEntry,
} from "./journalStorage";

/* ===================== Utilities ===================== */

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function PhotoImg({ id, className, alt }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    (async () => {
      try {
        const blob = await getDisplayBlob(id);
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!url) {
    return (
      <div className="bg-slate-700/40 border border-slate-600/50 rounded-lg h-40 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

function FavoriteButton({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Remove from favorites" : "Mark as favorite"}
      title="Favorites are used first in keepsakes"
      className={`absolute top-2 left-2 p-1.5 rounded-full ${
        active ? "bg-amber-400 text-slate-900" : "bg-black/50 text-white"
      }`}
    >
      <Star className="w-4 h-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}

/* ===================== Day Summary Compiler ===================== */

function compileDaySummary(entry, day) {
  const parts = [];

  // 1. Day context
  if (day?.type === "port" && day.port) {
    parts.push(`Today was spent in ${day.port.split(",")[0]}.`);
  } else if (day?.type === "sea") {
    parts.push("Today was spent at sea.");
  } else if (day?.type === "embarkation") {
    parts.push("Today marked the start of the cruise.");
  } else if (day?.type === "disembarkation") {
    parts.push("Today marked the end of the cruise.");
  }

  // 2. Weather
  if (entry.weather?.trim()) {
    parts.push(`The weather was ${entry.weather.trim()}.`);
  }

  // 3. Activities
  if (entry.activities?.length) {
    const activityLines = entry.activities.map((a) => {
      if (a.title && a.description) {
        return `${a.title}, where ${a.description}`;
      }
      if (a.title) return a.title;
      if (a.description) return `An activity where ${a.description}`;
      return null;
    }).filter(Boolean);

    if (activityLines.length) {
      parts.push(`Activities today included ${activityLines.join("; ")}.`);
    }
  }

  // 4. Notes
  if (entry.notes?.trim()) {
    parts.push(`Additional notes from the day mention that ${entry.notes.trim()}.`);
  }

  return parts.join("\n\n");
}

/* ===================== Component ===================== */

// Typing autosaves after this pause, so each keystroke doesn't rewrite storage.
const AUTOSAVE_DELAY_MS = 800;

function blankEntry(date) {
  return {
    date,
    weather: "",
    notes: "",
    summary: "",
    photos: [],
    activities: [],
  };
}

export default function DailyJournal({
  cruiseDetails,
  onFinishCruise,
}) {
  const itinerary = cruiseDetails.itinerary || [];
  const cruiseId = cruiseDetails.id;

  const [selectedDate, setSelectedDate] = useState(
    itinerary[0]?.date || ""
  );

  const [entries, setEntries] = useState({});
  const [showSuccess, setShowSuccess] = useState("");

  // Refs mirror the latest entries so saves never read a stale render.
  const entriesRef = useRef({});
  const savedEntriesRef = useRef([]);
  const dirtyDatesRef = useRef(new Set());
  const autosaveTimerRef = useRef(null);

  /* -------- Save -------- */

  const persistDate = (date) => {
    const entry = entriesRef.current[date];
    if (!entry) return true;

    const result = saveJournalEntry({
      cruiseId,
      entry: {
        ...entry,
        date,
        dayInfo: itinerary.find((d) => d.date === date),
        id:
          savedEntriesRef.current.find((e) => e.date === date)?.id ||
          Date.now(),
        savedAt: new Date().toISOString(),
      },
      existingEntries: savedEntriesRef.current,
    });

    if (result.success) {
      savedEntriesRef.current = result.entries;
      dirtyDatesRef.current.delete(date);
    }
    return result.success;
  };

  const flushPending = () => {
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
    let ok = true;
    for (const date of [...dirtyDatesRef.current]) {
      ok = persistDate(date) && ok;
    }
    return ok;
  };

  // Keep the latest flush reachable from listeners and cleanup.
  const flushRef = useRef(flushPending);
  flushRef.current = flushPending;

  /**
   * Apply a change to one day's entry, built from the latest state.
   * persist: "now" saves immediately, "debounced" waits for a typing pause.
   */
  const changeEntry = (date, makeChanges, persist = "now") => {
    const prev = entriesRef.current[date] || blankEntry(date);
    const next = { ...prev, ...makeChanges(prev) };
    entriesRef.current = { ...entriesRef.current, [date]: next };
    setEntries(entriesRef.current);
    dirtyDatesRef.current.add(date);

    if (persist === "now") {
      flushPending();
    } else {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(
        () => flushRef.current(),
        AUTOSAVE_DELAY_MS
      );
    }
  };

  const updateField = (field, value) =>
    changeEntry(selectedDate, () => ({ [field]: value }), "debounced");

  const save = () => {
    // Make sure the selected day is written even if nothing changed.
    dirtyDatesRef.current.add(selectedDate);
    if (!entriesRef.current[selectedDate]) {
      entriesRef.current = {
        ...entriesRef.current,
        [selectedDate]: blankEntry(selectedDate),
      };
    }
    if (flushPending()) {
      setShowSuccess("saved");
      setTimeout(() => setShowSuccess(""), 2500);
    }
  };

  /* -------- Load persisted entries -------- */

  useEffect(() => {
    const loaded = loadJournalEntries(cruiseId);
    const map = {};
    loaded.forEach((e) => (map[e.date] = e));
    entriesRef.current = map;
    savedEntriesRef.current = loaded;
    dirtyDatesRef.current = new Set();
    setEntries(map);
  }, [cruiseId]);

  /* -------- Never lose pending text -------- */

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushRef.current();
    };
    const onPageHide = () => flushRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flushRef.current();
    };
  }, []);

  const currentDay = itinerary.find((d) => d.date === selectedDate);
  const currentEntry = entries[selectedDate] || blankEntry(selectedDate);

  const goToDate = (date) => {
    if (!date) return;
    flushPending();
    setSelectedDate(date);
  };

  const finishCruise = () => {
    flushPending();
    onFinishCruise();
  };

  /* -------- Generate Summary -------- */

  const generateSummary = () => {
    if (currentEntry.summary?.trim()) {
      const ok = confirm(
        "Regenerate the day summary? This will replace the existing summary."
      );
      if (!ok) return;
    }

    changeEntry(selectedDate, (prev) => ({
      summary: compileDaySummary(prev, currentDay),
    }));
  };

  /* -------- Photos -------- */

  const handlePhotoUpload = async ({ files, activityId = null }) => {
    // The user may switch days while photos are being stored.
    const date = selectedDate;
    const out = [];

    for (const raw of files) {
      const id = makeId();
      const buf = await raw.arrayBuffer();

      await putPhoto({
        id,
        cruiseId,
        arrayBuffer: buf,
        type: raw.type,
        caption: "",
      });

      out.push({ id, caption: "", activityId });
    }

    if (out.length) {
      changeEntry(date, (prev) => ({
        photos: [...(prev.photos || []), ...out],
      }));
    }
  };

  const updatePhotoCaption = (photoId, caption) => {
    changeEntry(
      selectedDate,
      (prev) => ({
        photos: (prev.photos || []).map((p) =>
          p.id === photoId ? { ...p, caption } : p
        ),
      }),
      "debounced"
    );
  };

  const toggleFavorite = (photoId) => {
    changeEntry(selectedDate, (prev) => ({
      photos: (prev.photos || []).map((p) =>
        p.id === photoId ? { ...p, favorite: !p.favorite } : p
      ),
    }));
  };

  const deletePhoto = async (photoId) => {
    const date = selectedDate;
    await deletePhotoBlob(photoId);
    changeEntry(date, (prev) => ({
      photos: (prev.photos || []).filter((p) => p.id !== photoId),
    }));
  };

  /* -------- Activities -------- */

  const addActivity = () => {
    changeEntry(selectedDate, (prev) => ({
      activities: [
        ...(prev.activities || []),
        {
          id: makeId(),
          title: "",
          description: "",
          createdAt: Date.now(),
        },
      ],
    }));
  };

  const updateActivity = (id, field, value) => {
    changeEntry(
      selectedDate,
      (prev) => ({
        activities: (prev.activities || []).map((a) =>
          a.id === id ? { ...a, [field]: value } : a
        ),
      }),
      "debounced"
    );
  };

  const deleteActivity = (id) => {
    const activity = (currentEntry.activities || []).find((a) => a.id === id);
    const removedPhotos = (currentEntry.photos || []).filter(
      (p) => p.activityId === id
    );

    const hasContent =
      removedPhotos.length ||
      activity?.title?.trim() ||
      activity?.description?.trim();
    if (hasContent) {
      const photoNote = removedPhotos.length
        ? ` and its ${removedPhotos.length} photo${removedPhotos.length === 1 ? "" : "s"}`
        : "";
      if (!confirm(`Delete this activity${photoNote}? This can't be undone.`)) {
        return;
      }
    }

    changeEntry(selectedDate, (prev) => ({
      activities: (prev.activities || []).filter((a) => a.id !== id),
      photos: (prev.photos || []).filter((p) => p.activityId !== id),
    }));

    // The entry no longer references these, so free the stored images.
    for (const p of removedPhotos) {
      deletePhotoBlob(p.id).catch(() => {});
    }
  };

  /* -------- Navigation -------- */

  const currentIndex = itinerary.findIndex(
    (d) => d.date === selectedDate
  );

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow">
          ✓ Entry saved
        </div>
      )}

      <div className="text-center space-y-2">
        <Calendar className="mx-auto text-cyan-400" />
        <h2 className="text-3xl font-bold text-white">
          Daily Journal Entry
        </h2>
      </div>

      <select
        value={selectedDate}
        onChange={(e) => goToDate(e.target.value)}
        className="w-full bg-slate-700 text-white rounded-lg p-3"
      >
        {itinerary.map((day) => (
          <option key={day.date} value={day.date}>
            {new Date(`${day.date}T00:00:00`).toDateString()}
          </option>
        ))}
      </select>

      <DayBanner day={currentDay} />
      <DailyGuidance day={currentDay} />
  

      <input
        className="w-full bg-slate-700 rounded-lg p-3 text-white"
        placeholder="Weather"
        value={currentEntry.weather}
        onChange={(e) => updateField("weather", e.target.value)}
      />

      <textarea
        rows={3}
        className="w-full bg-slate-700 rounded-lg p-3 text-white"
        placeholder="Notes"
        value={currentEntry.notes}
        onChange={(e) => updateField("notes", e.target.value)}
      />




      {/* -------- Day Summary -------- */}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-300">Day Summary</h3>
          <button
            type="button"
            onClick={generateSummary}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-lg"
          >
            {currentEntry.summary ? "Regenerate Summary" : "Generate Summary"}
          </button>
        </div>

        <textarea
          rows={4}
          className="w-full bg-slate-700 rounded-lg p-3 text-white"
          placeholder="Generate a summary to see a compiled recap of your day…"
          value={currentEntry.summary}
          onChange={(e) => updateField("summary", e.target.value)}
        />
      </div>

      {/* -------- Day Photos -------- */}

      <div className="space-y-4">
        <label className="font-semibold text-slate-300">
          Photos from today
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg">
          <Upload className="w-4 h-4" />
          Upload
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              handlePhotoUpload({
                files: Array.from(e.target.files || []),
              })
            }
          />
        </label>

        {(currentEntry.photos || [])
          .filter((p) => !p.activityId)
          .map((photo) => (
            <div key={photo.id} className="space-y-2">
              <div className="relative">
                <PhotoImg
                  id={photo.id}
                  alt="Day photo"
                  className="w-full rounded-lg"
                />
                <FavoriteButton
                  active={!!photo.favorite}
                  onToggle={() => toggleFavorite(photo.id)}
                />
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute top-2 right-2 bg-red-600 p-1 rounded-full"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <input
                className="w-full bg-slate-700 rounded-lg p-2 text-sm text-white"
                placeholder="Add a caption (optional)"
                value={photo.caption}
                onChange={(e) =>
                  updatePhotoCaption(photo.id, e.target.value)
                }
              />
            </div>
          ))}
      </div>

      {/* -------- Activities -------- */}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Activities</h3>
          <button
            onClick={addActivity}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" /> Add Activity
          </button>
        </div>

        {(currentEntry.activities || []).map((activity) => (
          <div key={activity.id} className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex justify-between">
              <input
                className="flex-1 bg-slate-700 rounded-lg p-2 text-white"
                placeholder="Activity title (optional)"
                value={activity.title}
                onChange={(e) =>
                  updateActivity(activity.id, "title", e.target.value)
                }
              />
              <button
                onClick={() => deleteActivity(activity.id)}
                className="ml-2 text-red-500"
              >
                <Trash2 />
              </button>
            </div>

            <textarea
              rows={3}
              className="w-full bg-slate-700 rounded-lg p-2 text-white"
              placeholder="Describe what happened…"
              value={activity.description}
              onChange={(e) =>
                updateActivity(activity.id, "description", e.target.value)
              }
            />

            <label className="inline-flex items-center gap-2 cursor-pointer bg-blue-600 text-white px-3 py-2 rounded-lg">
              <Upload className="w-4 h-4" />
              Add Photos
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handlePhotoUpload({
                    files: Array.from(e.target.files || []),
                    activityId: activity.id,
                  })
                }
              />
            </label>

            {(currentEntry.photos || [])
              .filter((p) => p.activityId === activity.id)
              .map((photo) => (
                <div key={photo.id} className="space-y-2">
                  <div className="relative">
                    <PhotoImg
                      id={photo.id}
                      alt="Activity photo"
                      className="w-full rounded-lg"
                    />
                    <FavoriteButton
                      active={!!photo.favorite}
                      onToggle={() => toggleFavorite(photo.id)}
                    />
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute top-2 right-2 bg-red-600 p-1 rounded-full"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <input
                    className="w-full bg-slate-700 rounded-lg p-2 text-sm text-white"
                    placeholder="Add a caption (optional)"
                    value={photo.caption}
                    onChange={(e) =>
                      updatePhotoCaption(photo.id, e.target.value)
                    }
                  />
                </div>
              ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => save()}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold"
      >
        Save Entry
      </button>

      <div className="flex justify-between gap-3">
        <button
          disabled={currentIndex === 0}
          onClick={() =>
            goToDate(itinerary[currentIndex - 1]?.date)
          }
          className="flex-1 bg-slate-700 text-white py-2 rounded-lg"
        >
          ← Previous
        </button>

        <button
          disabled={currentIndex === itinerary.length - 1}
          onClick={() =>
            goToDate(itinerary[currentIndex + 1]?.date)
          }
          className="flex-1 bg-slate-700 text-white py-2 rounded-lg"
        >
          Next →
        </button>
      </div>

      <button
        type="button"
        onClick={finishCruise}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-bold"
      >
        <Anchor className="inline mr-2" /> Finish Cruise
      </button>
    </div>
  );
}

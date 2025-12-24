'use client';

import { useEffect, useState } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  Upload,
  X,
  Anchor,
} from "lucide-react";

import DayBanner from "@/app/components/DayBanner";
import DailyGuidance from "@/app/components/DailyGuidance";


import {
  putPhoto,
  getPhotoBlob,
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
        const blob = await getPhotoBlob(id);
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

export default function DailyJournal({
  cruiseDetails,
  onFinishCruise,
}) {
  const itinerary = cruiseDetails.itinerary || [];

  const [selectedDate, setSelectedDate] = useState(
    itinerary[0]?.date || ""
  );

  const [entries, setEntries] = useState({});
  const [savedEntries, setSavedEntries] = useState([]);
  const [showSuccess, setShowSuccess] = useState("");

  /* -------- Load persisted entries -------- */

  useEffect(() => {
    const loaded = loadJournalEntries(cruiseDetails.id);
    const map = {};
    loaded.forEach((e) => (map[e.date] = e));
    setEntries(map);
    setSavedEntries(loaded);
  }, [cruiseDetails.id]);

  const currentDay = itinerary.find((d) => d.date === selectedDate);

  const currentEntry =
    entries[selectedDate] || {
      date: selectedDate,
      weather: "",
      notes: "",
      summary: "",
      photos: [],
      activities: [],
    };

  const updateEntry = (field, value) => {
    setEntries((prev) => ({
      ...prev,
      [selectedDate]: { ...currentEntry, [field]: value },
    }));
  };

  /* -------- Save -------- */

  const save = (auto = false) => {
    const entryToSave = {
      ...currentEntry,
      date: selectedDate,
      dayInfo: currentDay,
      id:
        savedEntries.find((e) => e.date === selectedDate)?.id ||
        Date.now(),
      savedAt: new Date().toISOString(),
    };

    const result = saveJournalEntry({
      cruiseId: cruiseDetails.id,
      entry: entryToSave,
      existingEntries: savedEntries,
      autoSave: auto,
    });

    if (result.success) {
      setSavedEntries(result.entries);
      if (!auto) {
        setShowSuccess("saved");
        setTimeout(() => setShowSuccess(""), 2500);
      }
    }
  };

  /* -------- Generate Summary -------- */

  const generateSummary = () => {
    if (currentEntry.summary?.trim()) {
      const ok = confirm(
        "Regenerate the day summary? This will replace the existing summary."
      );
      if (!ok) return;
    }

    const summary = compileDaySummary(currentEntry, currentDay);
    updateEntry("summary", summary);
    save(true);
  };

  /* -------- Photos -------- */

  const handlePhotoUpload = async ({ files, activityId = null }) => {
    const out = [];

    for (const raw of files) {
      const id = makeId();
      const buf = await raw.arrayBuffer();

      await putPhoto({
        id,
        cruiseId: cruiseDetails.id,
        arrayBuffer: buf,
        type: raw.type,
        caption: "",
      });

      out.push({ id, caption: "", activityId });
    }

    updateEntry("photos", [...(currentEntry.photos || []), ...out]);
    save(true);
  };

  const updatePhotoCaption = (photoId, caption) => {
    updateEntry(
      "photos",
      currentEntry.photos.map((p) =>
        p.id === photoId ? { ...p, caption } : p
      )
    );
    save(true);
  };

  const deletePhoto = async (photoId) => {
    await deletePhotoBlob(photoId);
    updateEntry(
      "photos",
      currentEntry.photos.filter((p) => p.id !== photoId)
    );
    save(true);
  };

  /* -------- Activities -------- */

  const addActivity = () => {
    updateEntry("activities", [
      ...(currentEntry.activities || []),
      {
        id: makeId(),
        title: "",
        description: "",
        createdAt: Date.now(),
      },
    ]);
    save(true);
  };

  const updateActivity = (id, field, value) => {
    updateEntry(
      "activities",
      currentEntry.activities.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      )
    );
    save(true);
  };

  const deleteActivity = (id) => {
    updateEntry(
      "activities",
      currentEntry.activities.filter((a) => a.id !== id)
    );
    updateEntry(
      "photos",
      currentEntry.photos.filter((p) => p.activityId !== id)
    );
    save(true);
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
        onChange={(e) => setSelectedDate(e.target.value)}
        className="w-full bg-slate-700 text-white rounded-lg p-3"
      >
        {itinerary.map((day) => (
          <option key={day.date} value={day.date}>
            {new Date(day.date).toDateString()}
          </option>
        ))}
      </select>

      <DayBanner day={currentDay} />
      <DailyGuidance day={currentDay} />
  

      <input
        className="w-full bg-slate-700 rounded-lg p-3 text-white"
        placeholder="Weather"
        value={currentEntry.weather}
        onChange={(e) => updateEntry("weather", e.target.value)}
      />

      <textarea
        rows={3}
        className="w-full bg-slate-700 rounded-lg p-3 text-white"
        placeholder="Notes"
        value={currentEntry.notes}
        onChange={(e) => updateEntry("notes", e.target.value)}
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
          onChange={(e) => updateEntry("summary", e.target.value)}
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
            setSelectedDate(itinerary[currentIndex - 1]?.date)
          }
          className="flex-1 bg-slate-700 text-white py-2 rounded-lg"
        >
          ← Previous
        </button>

        <button
          disabled={currentIndex === itinerary.length - 1}
          onClick={() =>
            setSelectedDate(itinerary[currentIndex + 1]?.date)
          }
          className="flex-1 bg-slate-700 text-white py-2 rounded-lg"
        >
          Next →
        </button>
      </div>

      <button
        type="button"
        onClick={onFinishCruise}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-bold"
      >
        <Anchor className="inline mr-2" /> Finish Cruise
      </button>
    </div>
  );
}

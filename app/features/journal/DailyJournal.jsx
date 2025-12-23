'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Plus,
  Trash2,
  Upload,
  X,
  Image,
  Anchor,
} from "lucide-react";

import DayBanner from "@/app/components/DayBanner";
import DailyGuidance from "@/app/components/DailyGuidance";
import DailyHints from "@/app/components/DailyHints";

import { generateDaySummary } from "@/lib/summaryEngine";
import { aiCaption } from "@/lib/ai";

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

/* ===================== Component ===================== */

export default function DailyJournal({
  cruiseDetails,
  onFinishCruise,
  onUpdate,
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
      activities: [],
      exceptionalFood: "",
      summary: "",
      notes: "",
      photos: [],
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

  /* -------- Summary -------- */

  const handleGenerateSummary = () => {
    const summary = generateDaySummary(currentEntry, currentDay);
    updateEntry("summary", summary);
  };

  /* -------- Photos -------- */

  const handlePhotoUpload = async (files) => {
    const out = [];
    for (const raw of files) {
      const id = makeId();
      const buf = await raw.arrayBuffer();

      let caption = "";
      try {
        caption = await aiCaption({
          type: "photo",
          date: currentDay?.date,
          port:
            currentDay?.type === "port"
              ? currentDay.port?.split(",")[0]
              : null,
        });
      } catch {}

      await putPhoto({
        id,
        cruiseId: cruiseDetails.id,
        arrayBuffer: buf,
        type: raw.type,
        caption,
      });

      out.push({ id, caption });
    }

    updateEntry("photos", [...(currentEntry.photos || []), ...out]);
    save(true);
  };

  const deletePhoto = async (photoId) => {
    await deletePhotoBlob(photoId);
    updateEntry(
      "photos",
      (currentEntry.photos || []).filter((p) => p.id !== photoId)
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
      <DailyHints day={currentDay} />

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

      <div className="space-y-3">
        <label className="font-semibold text-slate-300">
          Photos
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
              handlePhotoUpload(Array.from(e.target.files || []))
            }
          />
        </label>

        <div className="grid gap-4">
          {(currentEntry.photos || []).map((photo) => (
            <div key={photo.id} className="relative">
              <PhotoImg
                id={photo.id}
                alt="Journal photo"
                className="w-full rounded-lg"
              />
              <button
                type="button"
                onClick={() => deletePhoto(photo.id)}
                className="absolute top-2 right-2 bg-red-600 p-1 rounded-full"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
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

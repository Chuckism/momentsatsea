'use client';

import { useEffect, useState } from 'react';
import { Sun, Sunset } from 'lucide-react';

export default function DailyGuidance({ day }) {
  if (!day) return null;

  const [shouldShow, setShouldShow] = useState(false);
  const [isMorning, setIsMorning] = useState(true);

  const portName = (day.port || "").split(",")[0];

  // Determine time-of-day grouping
  const hour = new Date().getHours();
  const isMorningTime = hour < 12;
  const isAfternoonTime = hour >= 12 && hour < 18;

  // Create a unique key per day so prompts only show once per morning and once per afternoon
  const dateKey = `guidance_${day.date}`;
  const morningKey = `${dateKey}_morning`;
  const afternoonKey = `${dateKey}_afternoon`;

  // MORNING PROMPTS – vary by day type
  const morningPromptsByType = {
    embarkation: [
      "Take a photo of your cabin before settling in.",
      "Capture your first view from the ship.",
      "Get a shot of your sail-away excitement.",
    ],
    sea: [
      "Take a photo of your favorite spot on the ship.",
      "Capture a candid moment of relaxation or fun.",
      "Snap a drink, dessert, or quiet moment.",
    ],
    port: [
      `Get a picture when you first step into ${portName}.`,
      "Capture the colors and scenery around you.",
      "Take a 'before the excursion' selfie or group shot.",
    ],
    disembarkation: [
      "Take a final photo of the ship before leaving.",
      "Capture a farewell moment or favorite spot.",
      "Reflect on your favorite memory from the trip.",
    ],
  };

  // AFTERNOON PROMPTS – vary by day type
  const afternoonPromptsByType = {
    embarkation: [
      "Snap a photo of sail-away or the open ocean.",
      "Capture your first dinner or show.",
      "Take one more picture that shows today's mood.",
    ],
    sea: [
      "Did you capture lunch or dessert today?",
      "Photograph the ship wake—perfect for magazines.",
      "Get a smiling photo with someone you're traveling with.",
    ],
    port: [
      "Take a photo of the highlight of your excursion.",
      "Capture scenery on your way back to the ship.",
      "Grab a picture with your guide if they were great!",
    ],
    disembarkation: [
      "Capture one last memory of your journey.",
      "Take a parting photo of the ship or terminal.",
      "Write a short summary of your favorite moments.",
    ],
  };

  const morningList = morningPromptsByType[day.type] || [];
  const afternoonList = afternoonPromptsByType[day.type] || [];

  // Determine whether to show today’s prompt
  useEffect(() => {
    if (isMorningTime) {
      if (!localStorage.getItem(morningKey)) {
        setShouldShow(true);
        setIsMorning(true);
        localStorage.setItem(morningKey, "shown");
      }
    } else if (isAfternoonTime) {
      if (!localStorage.getItem(afternoonKey)) {
        setShouldShow(true);
        setIsMorning(false);
        localStorage.setItem(afternoonKey, "shown");
      }
    }
  }, [day.date, morningKey, afternoonKey, isMorningTime, isAfternoonTime]);

  if (!shouldShow) return null;

  // TITLE LOGIC — updated per your request
  const title = isMorning
    ? (day.type === "embarkation"
        ? "🚢 Before We Say Bon Voyage…"
        : "🌅 Good Morning!")
    : "🌇 Quick Reminder";

  const icon = isMorning ? <Sun className="w-5 h-5" /> : <Sunset className="w-5 h-5" />;
  const list = isMorning ? morningList : afternoonList;

  const gradient = isMorning
    ? "from-blue-700/30 to-cyan-700/30"
    : "from-orange-700/30 to-amber-700/30";

  return (
    <div
      className={`
        w-full rounded-xl border border-slate-700/50
        bg-gradient-to-r ${gradient}
        p-4 mb-4 shadow-lg backdrop-blur-sm animate-fade-in
      `}
    >
      <div className="flex items-center gap-3 text-white mb-1">
        {icon}
        <h3 className="text-lg font-bold">{title}</h3>
      </div>

      <ul className="text-slate-200 text-sm space-y-1 mt-1">
        {list.map((p, i) => (
          <li key={i}>• {p}</li>
        ))}
      </ul>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

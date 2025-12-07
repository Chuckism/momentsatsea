'use client';

import { Ship, MapPin, Waves, Anchor } from 'lucide-react';

export default function DayBanner({ day }) {
  if (!day) return null;

  const portName = (day.port || "").split(",")[0];

  // Pick banner content based on day.type
  let title = "";
  let message = "";
  let icon = null;
  let gradient = "";

  switch (day.type) {
    case "embarkation":
      title = "Embarkation Day";
      message = "Welcome aboard! Capture the excitement of your first moments on the ship.";
      icon = <Ship className="w-6 h-6" />;
      gradient = "from-blue-600/30 to-cyan-600/30";
      break;

    case "sea":
      title = "Day at Sea";
      message = "Sea days are perfect for relaxing. Capture the vibe — pools, sunsets, laughter, quiet moments.";
      icon = <Waves className="w-6 h-6" />;
      gradient = "from-indigo-600/30 to-purple-600/30";
      break;

    case "port":
      title = `Port Day: ${portName}`;
      message = `You're in ${portName} today! Don't forget photos of your excursion, food, views—and anything unexpected.`;
      icon = <MapPin className="w-6 h-6" />;
      gradient = "from-emerald-600/30 to-teal-600/30";
      break;

    case "disembarkation":
      title = "Debarkation Day";
      message = "Farewell for now. Wrap up your memories and capture any final reflections from your journey.";
      icon = <Anchor className="w-6 h-6" />;
      gradient = "from-slate-600/30 to-slate-500/30";
      break;

    default:
      return null;
  }

  return (
    <div
      className={`
        w-full rounded-xl border border-slate-700/50 
        bg-gradient-to-r ${gradient}
        p-4 mt-6 mb-4 shadow-lg backdrop-blur-sm
        animate-fade-in
      `}
    >
      <div className="flex items-center gap-3 text-white mb-1">
        {icon}
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <p className="text-slate-200 text-sm leading-snug">{message}</p>

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

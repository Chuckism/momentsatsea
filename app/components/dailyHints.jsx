'use client';

import { Sparkles } from 'lucide-react';
import { DAILY_PROMPTS } from './prompts/dailyPrompts';

export default function DailyHints({ day }) {
  if (!day) return null;

  const promptType = day.type; // "port", "sea", "embarkation", "disembarkation"
  const list = DAILY_PROMPTS[promptType];

  if (!list || list.length === 0) return null;

  // For now, just take the first prompt for that type.
  // (We can randomize later if you want variety.)
  let hint = list[0];

  // If it's a port day and the hint uses <port>, replace with the actual port name.
  if (promptType === 'port' && hint.includes('<port>')) {
    const portName = (day.port || '').split(',')[0] || 'port';
    hint = hint.replace(/<port>/g, portName);
  }

  return (
    <div className="mt-4 rounded-xl bg-gradient-to-br from-purple-700/30 to-purple-900/20 border border-purple-500/30 p-4 shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
        </div>

        <div className="text-purple-200 text-sm leading-relaxed">
          {hint}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Ship, X, ChevronDown } from 'lucide-react';

/* ==========================================
   Constants & Helpers
   ========================================== */

const CRUISE_PORTS = [
  "Galveston, Texas","Miami, Florida","Fort Lauderdale, Florida","Port Canaveral, Florida","Tampa, Florida",
  "New Orleans, Louisiana","Charleston, South Carolina","Baltimore, Maryland","New York, New York","Boston, Massachusetts",
  "Seattle, Washington","Los Angeles, California","San Diego, California","San Francisco, California","Vancouver, Canada",
  "Barcelona, Spain","Rome (Civitavecchia), Italy","Venice, Italy","Athens (Piraeus), Greece","Southampton, England",
  "Copenhagen, Denmark","Nassau, Bahamas","Cozumel, Mexico","Grand Cayman, Cayman Islands","Jamaica (Ocho Rios)",
  "Jamaica (Montego Bay)","St. Thomas, USVI","St. Maarten","Aruba","Barbados","San Juan, Puerto Rico","Roatan, Honduras",
  "Belize City, Belize","Costa Maya, Mexico","Key West, Florida","Cabo San Lucas, Mexico","Puerto Vallarta, Mexico",
  "Ensenada, Mexico","Juneau, Alaska","Ketchikan, Alaska","Skagway, Alaska","Victoria, Canada","Sydney, Australia",
  "Auckland, New Zealand","Singapore","Hong Kong","Dubai, UAE","Santorini, Greece","Mykonos, Greece",
  "Dubrovnik, Croatia","Lisbon, Portugal"
];

const formFieldStyles =
  "w-full h-12 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 text-base text-white " +
  "placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all";

/* ==========================================
   Port Autocomplete
   ========================================== */

function PortAutocomplete({ value, onChange, placeholder, id }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const input = e.target.value;
    onChange(input);

    if (input.length > 0) {
      const filtered = CRUISE_PORTS
        .filter(p => p.toLowerCase().includes(input.toLowerCase()))
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setActiveSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const commit = (val) => {
    onChange(val);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && activeSuggestion < suggestions.length - 1) {
      setActiveSuggestion(activeSuggestion + 1);
    } else if (e.key === 'ArrowUp' && activeSuggestion > 0) {
      setActiveSuggestion(activeSuggestion - 1);
    } else if (e.key === 'Enter' && showSuggestions) {
      e.preventDefault();
      commit(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={formFieldStyles}
        placeholder={placeholder}
        autoComplete="off"
        inputMode="text"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => (
            <div
              key={s}
              onClick={() => commit(s)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                i === activeSuggestion
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================
   Cruise Setup
   ========================================== */

export default function CruiseSetup({ onSave, cruiseDetails, onDetailsChange }) {
  const [itinerary, setItinerary] = useState([]);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone;

    const onBIP = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isIOS && !isStandalone) setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', onBIP);

    if (isIOS && !isStandalone) setShowInstallPrompt(true);
    if (isStandalone) setShowInstallPrompt(false);

    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const generateItinerary = () => {
    if (!cruiseDetails.ship?.trim()) {
      return alert('Please enter the Name of the Cruise Ship before continuing.');
    }
    if (!cruiseDetails.departureDate || !cruiseDetails.returnDate) {
      return alert('Please enter departure and return dates');
    }

    const start = new Date(`${cruiseDetails.departureDate}T00:00:00`);
    const end   = new Date(`${cruiseDetails.returnDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return alert('Invalid date(s). Please reselect.');
    }
    if (start > end) return alert('Return date must be after departure date.');

    const days = [];
    const cur = new Date(start);
    let idx = 0;

    while (cur <= end) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const isFirst = idx === 0;
      const isLast  = cur.getTime() === end.getTime();

      days.push({
        date: dateStr,
        type: isFirst ? 'embarkation' : (isLast ? 'disembarkation' : 'sea'),
        port: isFirst || isLast ? (cruiseDetails.homePort || '') : ''
      });

      cur.setDate(cur.getDate() + 1);
      idx++;
    }

    setItinerary(days);
  };

  const updateItineraryDay = (i, field, value) => {
    const next = [...itinerary];
    next[i][field] = value;
    setItinerary(next);
  };

  const handleSaveItinerary = () => {
    if (!itinerary.length) return alert('Please generate itinerary first');
    onSave(itinerary);
  };

  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="relative">
      {showInstallPrompt && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-6 border-2 border-blue-400 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Ship className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">📱 Works Offline at Sea!</h3>
              {isiOS ? (
                <p className="text-white/90">
                  On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
                </p>
              ) : (
                <>
                  <p className="text-white/90 mb-4">
                    Install now so everything works offline on the ship.
                  </p>
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="bg-white text-blue-600 font-bold py-3 px-6 rounded-lg"
                  >
                    Install App
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowInstallPrompt(false)}
              className="text-white/70 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 rounded-2xl bg-slate-800/90 p-10 border border-slate-700/50 shadow-2xl">
        <h2 className="text-3xl font-bold text-white text-center">Set Up Your Cruise</h2>

        <input
          type="text"
          value={cruiseDetails.ship || ''}
          onChange={(e) => onDetailsChange({ ship: e.target.value })}
          placeholder="Ship name"
          className={formFieldStyles}
        />

        <PortAutocomplete
          value={cruiseDetails.homePort || ''}
          onChange={(v) => onDetailsChange({ homePort: v })}
          placeholder="Home port"
        />

        <input
          type="date"
          value={cruiseDetails.departureDate || ''}
          onChange={(e) => onDetailsChange({ departureDate: e.target.value })}
          className={formFieldStyles}
        />

        <input
          type="date"
          value={cruiseDetails.returnDate || ''}
          onChange={(e) => onDetailsChange({ returnDate: e.target.value })}
          className={formFieldStyles}
        />

        <button
          type="button"
          onClick={generateItinerary}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg"
        >
          Generate Itinerary
        </button>

        {itinerary.length > 0 && (
          <div className="space-y-4">
            {itinerary.map((day, i) => (
              <div key={day.date} className="bg-slate-700/30 p-4 rounded-lg">
                <select
                  value={day.type}
                  onChange={(e) => updateItineraryDay(i, 'type', e.target.value)}
                  className={`${formFieldStyles} pr-10`}
                >
                  <option value="embarkation">Embark</option>
                  <option value="sea">At Sea</option>
                  <option value="port">Port Day</option>
                  <option value="disembarkation">Disembark</option>
                </select>

                {day.type !== 'sea' && (
                  <PortAutocomplete
                    value={day.port}
                    onChange={(v) => updateItineraryDay(i, 'port', v)}
                    placeholder="Port"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {itinerary.length > 0 && (
          <button
            type="button"
            onClick={handleSaveItinerary}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-4 rounded-xl"
          >
            Begin Your Journal
          </button>
        )}
      </div>
    </div>
  );
}

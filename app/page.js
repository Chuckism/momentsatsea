'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Ship, MapPin, Calendar, Anchor, X, Upload, Image, Plus, Trash2, ChevronDown } from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import OrderSheet from "./components/OrderSheet";

/* =========================
   IndexedDB: Offline Photos
   ========================= */
let _photoDBPromise = null;
function openPhotoDB() {
  if (_photoDBPromise) return _photoDBPromise;
  _photoDBPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('momentsatsea', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) {
        const store = db.createObjectStore('photos', { keyPath: 'id' });
        store.createIndex('byCruise', 'cruiseId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _photoDBPromise;
}

async function putPhoto({ id, cruiseId, arrayBuffer, type, caption = '' }) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const blob = new Blob([arrayBuffer], { type });
    tx.objectStore('photos').put({ id, cruiseId, blob, type, caption, createdAt: Date.now() });
  });
}
async function getPhotoBlob(id) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').get(id);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}
async function deletePhotoBlob(id) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore('photos').delete(id);
  });
}
async function deleteAllPhotosForCruise(cruiseId) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    const idx = store.index('byCruise');
    const req = idx.openKeyCursor(IDBKeyRange.only(cruiseId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/* ======================
   Small util + HEIC fix
   ====================== */
function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}
function isSafari() {
  const ua = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(ua);
}
function supportsWebP() {
  try {
    const c = document.createElement('canvas');
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch { return false; }
}

/** Downscale & convert large images to save space; convert HEIC if needed */
async function normalizePhotoFile(inputFile, { maxDim = 2000 } = {}) {
  const isHEIC = /image\/heic|image\/heif/i.test(inputFile.type);
  const canCreateBitmap = 'createImageBitmap' in window;

  // If not HEIC and small enough, keep as-is
  if (!isHEIC && inputFile.size <= 1.5 * 1024 * 1024) return inputFile;
  if (!canCreateBitmap) return inputFile; // fallback

  try {
    const bitmap = await createImageBitmap(inputFile);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0, w, h);

    const preferWebP = supportsWebP() && !isHEIC;
    const type = preferWebP ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise(res => canvas.toBlob(res, type, 0.88));
    if (!blob) return inputFile;

    const name = inputFile.name.replace(/\.(heic|heif)$/i, preferWebP ? '.webp' : '.jpg');
    return new File([blob], name, { type });
  } catch {
    return inputFile;
  }
}

/* =======================
   Photo <img> convenience
   ======================= */
function PhotoImg({ id, alt, className }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await getPhotoBlob(id);
        if (cancelled || !blob) return setUrl(null);
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch { setUrl(null); }
    })();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  if (!url) {
    return (
      <div className={`bg-slate-700/40 border border-slate-600/50 rounded-lg ${className || ''}`} style={{display:'grid',placeItems:'center'}}>
        Loading…
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

/* ===============
   Ports database
   =============== */
const CRUISE_PORTS = [
  "Galveston, Texas","Miami, Florida","Fort Lauderdale, Florida","Port Canaveral, Florida","Tampa, Florida",
  "New Orleans, Louisiana","Charleston, South Carolina","Baltimore, Maryland","New York, New York","Boston, Massachusetts",
  "Seattle, Washington","Los Angeles, California","San Diego, California","San Francisco, California","Vancouver, Canada",
  "Barcelona, Spain","Rome (Civitavecchia), Italy","Venice, Italy","Athens (Piraeus), Greece","Southampton, England",
  "Copenhagen, Denmark","Nassau, Bahamas","Cozumel, Mexico","Grand Cayman, Cayman Islands","Jamaica (Ocho Rios)",
  "Jamaica (Montego Bay)","St. Thomas, USVI","St. Maarten","Aruba","Barbados","San Juan, Puerto Rico","Roatan, Honduras",
  "Belize City, Belize","Costa Maya, Mexico","Key West, Florida","Cabo San Lucas, Mexico","Puerto Vallarta, Mexico",
  "Ensenada, Mexico","Juneau, Alaska","Ketchikan, Alaska","Skagway, Alaska","Victoria, Canada","Sydney, Australia",
  "Auckland, New Zealand","Singapore","Hong Kong","Dubai, UAE","Santorini, Greece","Mykonos, Greece","Dubrovnik, Croatia","Lisbon, Portugal"
];

const formFieldStyles = "w-full h-12 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 text-base text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all";

/* ======================
   Autocomplete component
   ====================== */
function PortAutocomplete({ value, onChange, placeholder, id }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const userInput = e.target.value;
    onChange(userInput);
    if (userInput.length > 0) {
      const filtered = CRUISE_PORTS.filter(p => p.toLowerCase().includes(userInput.toLowerCase())).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setActiveSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  };
  const commit = (s) => { onChange(s); setSuggestions([]); setShowSuggestions(false); };
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && activeSuggestion < suggestions.length - 1) setActiveSuggestion(activeSuggestion + 1);
    else if (e.key === 'ArrowUp' && activeSuggestion > 0) setActiveSuggestion(activeSuggestion - 1);
    else if (e.key === 'Enter' && showSuggestions) { e.preventDefault(); commit(suggestions[activeSuggestion]); }
    else if (e.key === 'Escape') setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text" id={id} value={value} onChange={handleChange} onKeyDown={handleKeyDown}
        className={formFieldStyles} placeholder={placeholder} autoComplete="off" inputMode="text"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => (
            <div key={s} onClick={() => commit(s)} className={`px-4 py-3 cursor-pointer transition-colors ${i===activeSuggestion?'bg-blue-600/20 text-blue-300':'text-slate-300 hover:bg-slate-700/50'}`}>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-500"/><span>{s}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================
   Storage estimate (meter)
   ========================== */
function useStorageEstimate() {
  const [estimate, setEstimate] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (navigator.storage?.estimate) {
          const e = await navigator.storage.estimate();
          if (mounted) setEstimate(e);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);
  return estimate; // {usage, quota}
}

/* ===================
   Cruises Library UI
   =================== */
function CruisesLibrary({ cruises, onSelectCruise, onStartNew, onDeleteCruise }) {
  const activeCruises = cruises.filter(c => c.status === 'active');
  const finishedCruises = cruises.filter(c => c.status === 'finished');

  const formatDateRange = (departure, returnDate) => {
    if (!departure || !returnDate) return 'Dates not set';
    const start = new Date(departure + 'T00:00:00');
    const end   = new Date(returnDate + 'T00:00:00');
    if (Number.isNaN(start) || Number.isNaN(end)) return 'Dates not set';
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const CruiseCard = ({ cruise }) => (
    <div onClick={() => onSelectCruise(cruise.id)} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/70 transition-all cursor-pointer group relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDeleteCruise(cruise.id); }}
        className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete cruise"
      >
        <Trash2 className="w-5 h-5" />
      </button>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
          <Ship className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">{cruise.homePort?.split(',')[0] || 'Cruise'} Adventure</h3>
          <p className="text-slate-400 text-sm mb-2">{formatDateRange(cruise.departureDate, cruise.returnDate)}</p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>📍 {cruise.itinerary?.length || 0} days</span>
            <span>🏠 {cruise.homePort?.split(',')[0]}</span>
            {cruise.status === 'finished' ? (
              <span className="bg-green-600/20 text-green-400 px-2 py-1 rounded">✓ Finished</span>
            ) : cruise.status === 'active' ? (
              <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded">● Active</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 mb-2">
          <Anchor className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-4xl font-bold text-white">My Cruises</h2>
        <p className="text-slate-400 text-lg">Your collection of cruise memories</p>
      </div>
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={onStartNew}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3 mb-8"
        >
          <Plus className="w-6 h-6" /> Start New Cruise
        </button>
        {cruises.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <Ship className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No cruises yet</h3>
            <p className="text-slate-500">Click "Start New Cruise" to create your first journal</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeCruises.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  Active Cruises
                </h3>
                {activeCruises.map(c => <CruiseCard key={c.id} cruise={c} />)}
              </div>
            )}
            {finishedCruises.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Finished Cruises
                </h3>
                {finishedCruises.map(c => <CruiseCard key={c.id} cruise={c} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================
   Setup (with iOS/Android install handling)
   ========================================== */
function CruiseSetup({ onSave, cruiseDetails, onDetailsChange }) {
  const [itinerary, setItinerary] = useState([]);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

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

  const handleBasicChange = (field, value) => onDetailsChange({ [field]: value });

  const generateItinerary = () => {
    if (!cruiseDetails.departureDate || !cruiseDetails.returnDate) return alert('Please enter departure and return dates');
    const start = new Date(`${cruiseDetails.departureDate}T00:00:00`);
    const end   = new Date(`${cruiseDetails.returnDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return alert('Invalid date(s). Please reselect.');
    if (start > end) return alert('Return date must be after departure date.');

    const days = [];
    const cur = new Date(start);
    let idx = 0;
    while (cur <= end) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth()+1).padStart(2,'0');
      const dd = String(cur.getDate()).padStart(2,'0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isFirst = idx === 0;
      const isLast  = cur.getTime() === end.getTime();
      days.push({ date: dateStr, type: isFirst ? 'embarkation' : (isLast ? 'disembarkation' : 'sea'), port: isFirst || isLast ? (cruiseDetails.homePort || '') : '' });
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
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl"></div>

      {showInstallPrompt && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-6 border-2 border-blue-400 shadow-2xl animate-slide-down">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Ship className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">📱 Works Offline at Sea!</h3>
              {isiOS ? (
                <p className="text-white/90">
                  On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install. Once installed, the app runs fully offline.
                </p>
              ) : (
                <>
                  <p className="text-white/90 mb-4">Install now so everything works offline on the ship.</p>
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="bg-white hover:bg-blue-50 text-blue-600 font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                  >
                    <Ship className="w-5 h-5" /> Install App
                  </button>
                </>
              )}
            </div>
            <button type="button" onClick={() => setShowInstallPrompt(false)} className="flex-shrink-0 text-white/70 hover:text-white transition-colors" aria-label="Dismiss">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <div className="relative space-y-8 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm p-10 border border-slate-700/50 shadow-2xl">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 mb-2">
            <Ship className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Set Up Your Cruise</h2>
          <p className="text-slate-400 text-lg">Let&apos;s build your cruise itinerary</p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="homePort" className="block text-sm font-semibold text-slate-300 mb-2">🏠 Home Port (Departure & Return)</label>
            <PortAutocomplete id="homePort" value={cruiseDetails.homePort || ''} onChange={(v) => onDetailsChange({ homePort: v })} placeholder="e.g., Galveston, Texas" />
          </div>

          <div>
            <label htmlFor="departureDate" className="block text-sm font-semibold text-slate-300 mb-2">📅 Departure Date</label>
            <input type="date" id="departureDate" value={cruiseDetails.departureDate || ''} onChange={(e) => onDetailsChange({ departureDate: e.target.value })} className={formFieldStyles} />
          </div>

          <div>
            <label htmlFor="returnDate" className="block text-sm font-semibold text-slate-300 mb-2">📅 Return Date</label>
            <input type="date" id="returnDate" value={cruiseDetails.returnDate || ''} onChange={(e) => onDetailsChange({ returnDate: e.target.value })} className={formFieldStyles} />
          </div>

          <button type="button" onClick={generateItinerary} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">Generate Itinerary</button>

          {itinerary.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-700">
              <h3 className="text-xl font-bold text-white">Your Itinerary</h3>
              {itinerary.map((day, index) => (
                <div key={day.date} className="bg-slate-700/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="block text-xs text-slate-400 mb-1">Location</label>
                      <select
                        value={day.type}
                        onChange={(e) => updateItineraryDay(index, 'type', e.target.value)}
                        className={`${formFieldStyles} pr-10`}
                      >
                        <option value="embarkation">Embark</option>
                        <option value="sea">At Sea</option>
                        <option value="port">Port Day</option>
                        <option value="disembarkation">Disembark</option>
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 mt-2 text-slate-400">
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </div>
                    {(day.type === 'port' || day.type === 'embarkation' || day.type === 'disembarkation') && (
                      <div className="flex flex-col">
                        <label className="block text-xs text-slate-400 mb-1">{day.type === 'port' ? 'Port Name' : 'Home Port'}</label>
                        <PortAutocomplete value={day.port} onChange={(v) => updateItineraryDay(index, 'port', v)} placeholder="Port name..." />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {itinerary.length > 0 && (
          <button
            type="button"
            onClick={handleSaveItinerary}
            className="group relative w-full overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-xl shadow-blue-500/25 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">Begin Your Journal <Ship className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          </button>
        )}

        <div className="pt-4 border-t border-slate-700/50">
          <p className="text-center text-xs text-slate-500">✨ Works offline • 📸 Optimized photos • 📖 Beautiful keepsake</p>
        </div>
      </div>
    </div>
  );
}

/* ======================
   Daily Journal (mobile)
   ====================== */
function DailyJournal({ cruiseDetails, onFinishCruise }) {
  const [selectedDate, setSelectedDate] = useState(cruiseDetails.itinerary[0]?.date || '');
  const [entries, setEntries] = useState({});
  const [savedEntries, setSavedEntries] = useState([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState('');
  const storage = useStorageEstimate();
  const usagePct = storage?.quota ? Math.round((storage.usage / storage.quota) * 100) : null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`cruiseJournalEntries_${cruiseDetails.id}`);
      if (!stored) return;
      const loaded = JSON.parse(stored);
      const map = {};
      (Array.isArray(loaded) ? loaded : []).forEach(e => {
        map[e.date] = {
          weather: e.weather || '',
          activities: e.activities || [],
          exceptionalFood: e.exceptionalFood || '',
          summary: e.summary || '',
          photos: e.photos || []
        };
      });
      setEntries(map);
      setSavedEntries(Array.isArray(loaded) ? loaded : []);
    } catch {
      setEntries({});
      setSavedEntries([]);
    }
  }, [cruiseDetails.id]);

  const currentDay = cruiseDetails.itinerary.find(d => d.date === selectedDate);
  const currentEntry = entries[selectedDate] || { weather: '', activities: [], exceptionalFood: '', summary: '', photos: [] };

  const updateEntry = (field, value) => {
    setEntries(prev => ({ ...prev, [selectedDate]: { ...currentEntry, [field]: value } }));
  };

  const addActivity = () => {
    updateEntry('activities', [...(currentEntry.activities || []), { id: Date.now(), title: '', description: '', photos: [] }]);
  };
  const updateActivity = (id, field, value) => {
    const updated = (currentEntry.activities || []).map(a => a.id === id ? { ...a, [field]: value } : a);
    updateEntry('activities', updated);
  };
  const deleteActivity = (id) => {
    updateEntry('activities', (currentEntry.activities || []).filter(a => a.id !== id));
  };

  async function processAndStoreFiles(files, cruiseId) {
    const out = [];
    for (const raw of files) {
      const file = await normalizePhotoFile(raw); // downscale/convert if useful
      const id = makeId();
      const buf = await file.arrayBuffer();
      await putPhoto({ id, cruiseId, arrayBuffer: buf, type: file.type, caption: '' });
      out.push({ id, caption: '' });
    }
    return out;
  }

  const handleActivityPhotoUpload = async (activityId, e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    try {
      const newIds = await processAndStoreFiles(files, cruiseDetails.id);
      const updated = (currentEntry.activities || []).map(a => a.id === activityId ? { ...a, photos: [...(a.photos || []), ...newIds] } : a);
      updateEntry('activities', updated);
    } catch {
      alert("Couldn't save photos offline (device storage full or permission issue). Your text is safe.");
    }
  };

  const updateActivityPhotoCaption = (activityId, photoId, caption) => {
    const updated = (currentEntry.activities || []).map(a =>
      a.id === activityId ? { ...a, photos: (a.photos || []).map(p => p.id === photoId ? { ...p, caption } : p) } : a
    );
    updateEntry('activities', updated);
  };

  const deleteActivityPhoto = async (activityId, photoId) => {
    try { await deletePhotoBlob(photoId); } catch { alert("Error: Could not delete the photo file. Please try again."); return; }
    const updatedActivities = (currentEntry.activities || []).map(a => a.id === activityId ? { ...a, photos: (a.photos || []).filter(p => p.id !== photoId) } : a);
    updateEntry('activities', updatedActivities);
    saveEntry(true, { ...currentEntry, activities: updatedActivities });
  };

  const handleGeneralPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    try {
      const newIds = await processAndStoreFiles(files, cruiseDetails.id);
      updateEntry('photos', [...(currentEntry.photos || []), ...newIds]);
    } catch {
      alert("Couldn't save photos offline (device storage full or permission issue). Your text is safe.");
    }
  };

  const updateGeneralPhotoCaption = (photoId, caption) => {
    updateEntry('photos', (currentEntry.photos || []).map(p => p.id === photoId ? { ...p, caption } : p));
  };
  const deleteGeneralPhoto = async (photoId) => {
    try { await deletePhotoBlob(photoId); } catch { alert("Error: Could not delete the photo file. Please try again."); return; }
    const updatedPhotos = (currentEntry.photos || []).filter(p => p.id !== photoId);
    updateEntry('photos', updatedPhotos);
    saveEntry(true, { ...currentEntry, photos: updatedPhotos });
  };

  function willExceedLocalStorage(valueStr) {
    try {
      localStorage.setItem('__ls_probe__', '1');
      localStorage.removeItem('__ls_probe__');
      const bytes = new Blob([valueStr]).size;
      return bytes > 4_500_000;
    } catch { return true; }
  }

  const saveEntry = (isAutoSave = false, updatedEntry) => {
    const existingIdx = savedEntries.findIndex(e => e.date === selectedDate);
    const isUpdate = existingIdx >= 0;
    const entryToSave = {
      ...(updatedEntry || currentEntry),
      date: selectedDate,
      dayInfo: currentDay,
      id: isUpdate ? savedEntries[existingIdx].id : Date.now(),
      savedAt: new Date().toISOString(),
    };
    const next = isUpdate ? (() => { const copy = [...savedEntries]; copy[existingIdx] = entryToSave; return copy; })() : [...savedEntries, entryToSave];
    const payload = JSON.stringify(next);

    if (willExceedLocalStorage(payload)) {
      alert("Save aborted: your device’s offline storage is full. Your TEXT is still on screen—please copy it somewhere safe.");
      return;
    }
    try {
      localStorage.setItem(`cruiseJournalEntries_${cruiseDetails.id}`, payload);
      setSavedEntries(next);
      if (!isAutoSave) {
        if (navigator.vibrate) navigator.vibrate(12);
        setShowSuccessMessage(isUpdate ? 'updated' : 'saved');
        setTimeout(() => setShowSuccessMessage(''), 3000);

        if (!isUpdate) {
          const i = cruiseDetails.itinerary.findIndex(d => d.date === selectedDate);
          if (i < cruiseDetails.itinerary.length - 1) setSelectedDate(cruiseDetails.itinerary[i + 1].date);
        }
      }
    } catch {
      alert("CRITICAL: Failed to save your entry (browser storage error). Please copy your text out before refreshing.");
    }
  };

  const currentDayIndex = cruiseDetails.itinerary.findIndex(d => d.date === selectedDate);
  const isFirstDay = currentDayIndex === 0;
  const isLastDay = currentDayIndex === cruiseDetails.itinerary.length - 1;

  return (
    <div className="space-y-6">
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-slide-in">
          <span className="text-xl">✓</span>
          <span className="font-medium">Entry {showSuccessMessage === 'updated' ? 'updated' : 'saved'} successfully!</span>
        </div>
      )}

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
          <Calendar className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">Daily Journal Entry</h2>
        <p className="text-slate-400">Capture today&apos;s memories</p>
      </div>

      {usagePct !== null && usagePct >= 70 && (
        <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-3 text-sm">
          <div className="flex justify-between mb-1 text-slate-300">
            <span>Device storage for this app</span><span>{usagePct}% used</span>
          </div>
          <div className="h-2 rounded bg-slate-700 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl space-y-6">
        <div className="relative">
          <label htmlFor="date" className="block text-sm font-semibold text-slate-300 mb-2">📅 Select Day</label>
          <select id="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={`${formFieldStyles} pr-10`}>
            {cruiseDetails.itinerary.map(day => (
              <option key={day.date} value={day.date}>
                {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} - {
                  day.type === 'embarkation' ? `Embark (${day.port?.split(',')[0]})` :
                  day.type === 'disembarkation' ? `Disembark (${day.port?.split(',')[0]})` :
                  day.type === 'port' ? day.port?.split(',')[0] : 'At Sea'
                }
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 mt-3 text-slate-400">
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>

        <div>
          <label htmlFor="weather" className="block text-sm font-semibold text-slate-300 mb-2">☀️ Weather</label>
          <input type="text" id="weather" value={currentEntry.weather || ''} onChange={(e) => updateEntry('weather', e.target.value)} placeholder="e.g., Sunny, 85°F" className={formFieldStyles} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-300">🎯 Activities & Excursions</label>
            <button type="button" onClick={addActivity} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Add Activity
            </button>
          </div>

          {(!currentEntry.activities || currentEntry.activities.length === 0) ? (
            <div className="text-center py-8 text-slate-500 italic border-2 border-dashed border-slate-700 rounded-lg">No activities yet. Tap &quot;Add Activity&quot; to start!</div>
          ) : (
            <div className="space-y-4">
              {currentEntry.activities.map(activity => (
                <div key={activity.id} className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={activity.title}
                      onChange={(e) => updateActivity(activity.id,'title',e.target.value)}
                      placeholder="Activity name (e.g., Team Volleyball)"
                      className="flex-1 bg-slate-600/50 border border-slate-500/50 rounded-lg p-2 text-white placeholder-slate-400 font-medium focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all h-12 text-base"
                    />
                    <button type="button" onClick={() => deleteActivity(activity.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-all" aria-label="Delete activity">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <textarea
                    value={activity.description}
                    onChange={(e) => updateActivity(activity.id,'description',e.target.value)}
                    rows={3}
                    placeholder="Describe this activity..."
                    className={`${formFieldStyles} min-h-[96px] py-3`}
                  />

                  <div className="pt-2 border-t border-slate-600/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">📸 Photos for this activity</span>
                      <label className="cursor-pointer bg-slate-600/50 hover:bg-slate-600/70 text-slate-300 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Upload
                        <input type="file" multiple accept="image/*" capture="environment" onChange={(e) => handleActivityPhotoUpload(activity.id, e)} className="hidden" />
                      </label>
                    </div>
                    {activity.photos?.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {activity.photos.map(photo => (
                          <div key={photo.id} className="relative group">
                            <PhotoImg id={photo.id} alt="Activity" className="w-full h-32 object-cover rounded-lg border border-slate-600/50" />
                            <button type="button" onClick={() => deleteActivityPhoto(activity.id, photo.id)} className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white p-1 rounded-full transition-opacity opacity-100 md:opacity-0 group-hover:opacity-100" aria-label="Delete photo">
                              <X className="w-4 h-4" />
                            </button>
                            <input
                              type="text"
                              value={photo.caption}
                              onChange={(e) => updateActivityPhotoCaption(activity.id, photo.id, e.target.value)}
                              placeholder="Add caption..."
                              className="mt-1 w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white placeholder-slate-400"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="exceptionalFood" className="block text-sm font-semibold text-slate-300 mb-2">🍽️ Exceptional Food Options</label>
          <textarea id="exceptionalFood" value={currentEntry.exceptionalFood || ''} onChange={(e) => updateEntry('exceptionalFood', e.target.value)} rows={3} placeholder="Memorable meals or dishes..." className={`${formFieldStyles} min-h-[96px] py-3`} />
        </div>

        <div>
          <label htmlFor="summary" className="block text-sm font-semibold text-slate-300 mb-2">📝 Summary of the Day</label>
          <textarea id="summary" value={currentEntry.summary || ''} onChange={(e) => updateEntry('summary', e.target.value)} rows={5} placeholder="Write your thoughts, favorite moments..." className={`${formFieldStyles} min-h-[120px] py-3`} />
        </div>

        <div className="pt-4 border-t border-slate-700/50 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-300">📸 General Photos</label>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload Photos
              <input type="file" multiple accept="image/*" capture="environment" onChange={handleGeneralPhotoUpload} className="hidden" />
            </label>
          </div>

          {(!currentEntry.photos || currentEntry.photos.length === 0) ? (
            <div className="text-center py-8 text-slate-500 italic border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center gap-2">
              <Image className="w-8 h-8 text-slate-600" /><span>No photos yet</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {currentEntry.photos.map(photo => (
                <div key={photo.id} className="relative group">
                  <PhotoImg id={photo.id} alt="General" className="w-full h-32 object-cover rounded-lg border border-slate-600/50" />
                  <button type="button" onClick={() => deleteGeneralPhoto(photo.id)} className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white p-1 rounded-full transition-opacity opacity-100 md:opacity-0 group-hover:opacity-100" aria-label="Delete photo">
                    <X className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={photo.caption}
                    onChange={(e) => updateGeneralPhotoCaption(photo.id, e.target.value)}
                    placeholder="Add caption..."
                    className="mt-1 w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white placeholder-slate-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 safe-screen">
          <button type="button" onClick={() => {
            const i = cruiseDetails.itinerary.findIndex(d => d.date === selectedDate);
            if (i > 0) setSelectedDate(cruiseDetails.itinerary[i - 1].date);
          }} disabled={isFirstDay}
            className={`flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 ${isFirstDay?'bg-slate-700 text-slate-500 cursor-not-allowed':'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-[0.98]'}`}
          >
            <span>←</span><span className="hidden sm:inline">Previous</span>
          </button>

          <button type="button" onClick={() => saveEntry()} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
            {savedEntries.some(e => e.date === selectedDate) ? 'Update' : 'Save'}
          </button>

          <button type="button" onClick={() => {
            const i = cruiseDetails.itinerary.findIndex(d => d.date === selectedDate);
            if (i < cruiseDetails.itinerary.length - 1) setSelectedDate(cruiseDetails.itinerary[i + 1].date);
          }} disabled={isLastDay}
            className={`flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 ${isLastDay?'bg-slate-700 text-slate-500 cursor-not-allowed':'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-[0.98]'}`}
          >
            <span className="hidden sm:inline">Next</span><span>→</span>
          </button>
        </div>
      </div>

      {savedEntries.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl">
          <h3 className="text-2xl font-bold text-white mb-4">Saved Entries ({savedEntries.length})</h3>
          <div className="space-y-3">
            {[...savedEntries].sort((a,b)=>a.date.localeCompare(b.date)).map(entry => (
              <div key={entry.id} onClick={() => setSelectedDate(entry.date)} className={`cursor-pointer rounded-lg p-4 transition-all ${entry.date===selectedDate?'bg-blue-600/30 border-2 border-blue-500':'bg-slate-700/30 border border-slate-600/50 hover:bg-slate-700/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-white font-semibold">
                    {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
                  </div>
                  {entry.date === selectedDate && <span className="text-blue-400 text-sm">✏️ Editing</span>}
                </div>
                <div className="text-slate-400 text-sm">
                  {entry.dayInfo?.type === 'port' ? entry.dayInfo.port?.split(',')[0]
                    : entry.dayInfo?.type === 'embarkation' ? `Embark (${entry.dayInfo.port?.split(',')[0]})`
                    : entry.dayInfo?.type === 'disembarkation' ? `Disembark (${entry.dayInfo.port?.split(',')[0]})`
                    : 'At Sea'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-3">Finished with this cruise?</h3>
        <p className="text-slate-400 mb-4">Mark this cruise as complete. You can always view it later from your cruise library.</p>
        <button type="button" onClick={onFinishCruise} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2">
          <Anchor className="w-5 h-5" /> Finish Cruise
        </button>
      </div>
    </div>
  );
}

/* ====================== Backup/Restore (device transfer) ====================== */
// Exports all cruises + per-cruise entries from localStorage to a JSON file.
// NOTE: Photos in IndexedDB do NOT transfer (use Photo ZIP export below).
function BackupRestore({ allCruises, setAllCruises, setActiveCruiseId, setAppState }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const exportJSON = () => {
    try {
      const cruises = JSON.parse(localStorage.getItem('allCruises') || '[]');
      const entriesByCruiseId = {};
      for (const c of cruises) {
        const key = `cruiseJournalEntries_${c.id}`;
        const raw = localStorage.getItem(key);
        if (raw) entriesByCruiseId[c.id] = JSON.parse(raw);
      }
      const payload = {
        app: 'MomentsAtSea',
        version: 1,
        exportedAt: new Date().toISOString(),
        allCruises: cruises,
        entriesByCruiseId,
        note: 'Photos are stored in IndexedDB and are not included in this JSON.',
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const y = new Date();
      const yyyy = y.getFullYear();
      const mm = String(y.getMonth() + 1).padStart(2, '0');
      const dd = String(y.getDate()).padStart(2, '0');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `momentsatsea-backup-${yyyy}${mm}${dd}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
    } catch (e) {
      alert('Export failed. See console for details.');
      console.error(e);
    }
  };

  const importJSON = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || data.app !== 'MomentsAtSea' || !Array.isArray(data.allCruises)) {
        alert('This file does not look like a MomentsAtSea backup.');
        return;
      }

      // Merge strategy: append new cruises, overwrite cruises with the same id.
      const existing = JSON.parse(localStorage.getItem('allCruises') || '[]');
      const byId = new Map(existing.map(c => [String(c.id), c]));
      for (const c of data.allCruises) byId.set(String(c.id), c);
      const merged = Array.from(byId.values());

      // Write entries
      const entriesByCruiseId = data.entriesByCruiseId || {};
      for (const [cid, entries] of Object.entries(entriesByCruiseId)) {
        localStorage.setItem(`cruiseJournalEntries_${cid}`, JSON.stringify(entries || []));
      }

      // Persist cruises list and refresh UI state
      localStorage.setItem('allCruises', JSON.stringify(merged));
      setAllCruises(merged);

      // If there’s exactly one active cruise in the import, select it
      const active = merged.find(c => c.status === 'active') || merged[0];
      if (active) {
        localStorage.setItem('activeCruiseId', active.id);
        setActiveCruiseId?.(active.id);
        setAppState?.('journaling');
      }

      alert('Import complete! (Photos are not included; only text/captions were imported.)');
    } catch (e) {
      alert('Import failed. See console for details.');
      console.error(e);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mt-6 rounded-xl bg-slate-800/40 border border-slate-700/60 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-white font-semibold">Backup & Restore</div>
          <div className="text-slate-400 text-sm">
            Export your cruises (text only) or import from another device.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportJSON}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Export JSON
          </button>
          <label className={`cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
            <span className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-block">
              Import JSON
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => importJSON(e.target.files?.[0])}
              disabled={busy}
            />
          </label>
        </div>
      </div>
      <div className="text-xs text-slate-500 mt-2">
        Photos are saved in device storage (IndexedDB) and aren’t included in the JSON. Use “Export ZIP” below for photos.
      </div>
    </div>
  );
}

/* ====================== Photo ZIP Export (per-cruise) ====================== */
/*
  Creates a ZIP containing:
  - /photos/<photoId>.<ext>  (all IndexedDB photo blobs for the selected cruise)
  - /manifest.json           (captions & minimal metadata from localStorage)
*/
async function getAllPhotosForCruise(cruiseId) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const idx = store.index('byCruise');
    const req = idx.openCursor(IDBKeyRange.only(cruiseId));
    const out = [];
    req.onsuccess = async () => {
      const cur = req.result;
      if (cur) { out.push(cur.value); cur.continue(); }
      else { resolve(out); }
    };
    req.onerror = () => reject(req.error);
  });
}

// Build a caption map from journal entries (in localStorage)
function buildCaptionMapFromEntries(cruiseId) {
  try {
    const raw = localStorage.getItem(`cruiseJournalEntries_${cruiseId}`);
    if (!raw) return {};
    const entries = JSON.parse(raw);
    const captions = {};
    for (const e of entries || []) {
      for (const p of e.photos || []) if (p?.id) captions[p.id] = p.caption || '';
      for (const act of e.activities || []) for (const p of act?.photos || []) if (p?.id) captions[p.id] = p.caption || '';
    }
    return captions;
  } catch { return {}; }
}
function fileExtFromType(type) {
  if (!type) return 'bin';
  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return type.split('/')[1] || 'bin';
}
function bytesFromBlob(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(new Uint8Array(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsArrayBuffer(blob);
  });
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function PhotoZipExport({ allCruises }) {
  const [cruiseId, setCruiseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // Set initial cruiseId on the client only
  useEffect(() => {
    let initial = allCruises[0]?.id ?? '';
    try {
      if (typeof window !== 'undefined') {
        const active = localStorage.getItem('activeCruiseId');
        if (active) initial = active;
      }
    } catch {}
    setCruiseId(initial);
  }, [allCruises]);

  const cruise = useMemo(() => allCruises.find(c => c.id === cruiseId) || null, [allCruises, cruiseId]);

  const onExport = async () => {
    if (!cruise) return alert('Pick a cruise to export.');
    setBusy(true); setStatus('Collecting photos…');
    try {
      const photos = await getAllPhotosForCruise(cruise.id);
      const captions = buildCaptionMapFromEntries(cruise.id);

      const files = {};
      let count = 0;
      for (const p of photos) {
        count++;
        setStatus(`Packing photo ${count} of ${photos.length}…`);
        const ext = fileExtFromType(p.type);
        const u8 = await bytesFromBlob(p.blob);
        files[`photos/${p.id}.${ext}`] = u8;
      }

      const manifest = {
        app: 'MomentsAtSea',
        version: 1,
        cruise: {
          id: cruise.id,
          homePort: cruise.homePort,
          departureDate: cruise.departureDate,
          returnDate: cruise.returnDate,
          status: cruise.status,
        },
        photoCount: photos.length,
        captions,
        exportedAt: new Date().toISOString(),
        note: 'Text entries are not included here—use "Export JSON" for that.',
      };
      files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

      setStatus('Compressing…');
      const zipped = zipSync(files, { level: 6 });
      const blob = new Blob([zipped], { type: 'application/zip' });

      const nameSafePort = (cruise.homePort || 'cruise').split(',')[0].trim().replace(/\s+/g, '-').toLowerCase();
      const yyyy = new Date().getFullYear();
      downloadBlob(blob, `momentsatsea-photos-${nameSafePort}-${yyyy}.zip`);
      setStatus('Done!');
    } catch (e) {
      console.error(e);
      alert('Photo export failed. See console for details.');
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(''), 2000);
    }
  };

  return (
    <div className="mt-6 rounded-xl bg-slate-800/40 border border-slate-700/60 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-white font-semibold">Export Photos (.zip)</div>
          <div className="text-slate-400 text-sm">Download all photos for a cruise with a manifest of captions.</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-slate-700/60 border border-slate-600/60 text-white rounded-lg px-3 h-10"
            value={cruiseId}
            onChange={(e) => setCruiseId(e.target.value)}
          >
            {allCruises.length === 0 ? <option value="">No cruises</option> : null}
            {allCruises.map(c => (
              <option key={c.id} value={c.id}>
                {(c.homePort?.split(',')[0] || 'Cruise')} · {c.departureDate || '—'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onExport}
            disabled={!cruise || busy}
            className={`px-4 py-2 rounded-lg text-white font-medium ${busy ? 'bg-slate-600 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {busy ? 'Exporting…' : 'Export ZIP'}
          </button>
        </div>
      </div>
      {status ? <div className="text-xs text-slate-500 mt-2">{status}</div> : null}
      <div className="text-xs text-slate-500 mt-2">Tip: use this along with “Export JSON” to move text + photos.</div>
    </div>
  );
}

/* ============= Main component ============= */
export default function HomePage() {
  const [appState, setAppState] = useState('cruises-list');
  const [allCruises, setAllCruises] = useState([]);
  const [activeCruiseId, setActiveCruiseId] = useState(null);
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [cruiseDetails, setCruiseDetails] = useState({ homePort:'', departureDate:'', returnDate:'', itinerary:[] });

  useEffect(() => {
    // Request persistent storage where supported (helps Android/Chrome keep data)
    if (navigator.storage?.persist) navigator.storage.persist();

    const stored = localStorage.getItem('allCruises');
    if (stored) {
      const cruises = JSON.parse(stored);
      setAllCruises(cruises);
      const activeStored = localStorage.getItem('activeCruiseId');
      if (activeStored && cruises.find(c => c.id === activeStored)) {
        setActiveCruiseId(activeStored);
        const cruise = cruises.find(c => c.id === activeStored);
        setCruiseDetails(cruise);
        setAppState('journaling');
      }
    }
  }, []);

  const handleDetailsChange = (updates) => setCruiseDetails(prev => ({ ...prev, ...updates }));

  const handleSaveSetup = (itinerary) => {
    const newCruise = { ...cruiseDetails, itinerary: itinerary || cruiseDetails.itinerary, id: Date.now().toString(), createdAt: new Date().toISOString(), status: 'active' };
    const updatedCruises = [...allCruises, newCruise];
    setAllCruises(updatedCruises);
    setActiveCruiseId(newCruise.id);
    localStorage.setItem('allCruises', JSON.stringify(updatedCruises));
    localStorage.setItem('activeCruiseId', newCruise.id);
    setCruiseDetails(newCruise);
    setAppState('journaling');
  };

  const handleStartNewCruise = () => {
    setCruiseDetails({ homePort:'', departureDate:'', returnDate:'', itinerary:[] });
    setActiveCruiseId(null);
    setAppState('setup');
  };

  const handleFinishCruise = () => {
    const updatedCruises = allCruises.map(c => c.id === activeCruiseId ? { ...c, status:'finished', finishedAt: new Date().toISOString() } : c);
    setAllCruises(updatedCruises);
    localStorage.setItem('allCruises', JSON.stringify(updatedCruises));
    localStorage.removeItem('activeCruiseId');
    setActiveCruiseId(null);
    setAppState('cruises-list');
  };

  const handleSelectCruise = (cruiseId) => {
    const cruise = allCruises.find(c => c.id === cruiseId);
    if (cruise) {
      setActiveCruiseId(cruiseId);
      setCruiseDetails(cruise);
      localStorage.setItem('activeCruiseId', cruiseId);
      setAppState('journaling');
    }
  };

  const handleDeleteCruise = async (cruiseId) => {
    if (confirm('Delete this cruise and all its entries? This cannot be undone.')) {
      const updatedCruises = allCruises.filter(c => c.id !== cruiseId);
      setAllCruises(updatedCruises);
      localStorage.setItem('allCruises', JSON.stringify(updatedCruises));

      localStorage.removeItem(`cruiseJournalEntries_${cruiseId}`);
      try { await deleteAllPhotosForCruise(cruiseId); } catch (e) { console.error('Photo purge failed', e); }

      if (activeCruiseId === cruiseId) {
        setActiveCruiseId(null);
        localStorage.removeItem('activeCruiseId');
        setAppState('cruises-list');
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-start p-6 sm:p-8 md:p-12 overflow-x-hidden">
        <div className="w-full max-w-3xl overflow-x-hidden">
          {/* HEADER */}
          <div className="text-center mb-12 space-y-2">
            {appState !== 'cruises-list' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Return to cruise library? Any unsaved changes will be lost.')) {
                    setAppState('cruises-list');
                    setActiveCruiseId(null);
                    localStorage.removeItem('activeCruiseId');
                  }
                }}
                className="mb-4 text-slate-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
              >
                <span>←</span> Back to My Cruises
              </button>
            )}

            <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
              MomentsAtSea
            </h1>

            <p className="text-slate-400 text-lg">
              Your cruise memories, beautifully preserved
            </p>

            {/* Create Keepsakes button */}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShowOrderSheet(true)}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold px-5 py-3 rounded-xl shadow-lg"
              >
                Create Keepsakes
              </button>
            </div>
          </div>

          {/* main content by state */}
          {appState === 'cruises-list' ? (
            <>
              <CruisesLibrary
                cruises={allCruises}
                onSelectCruise={handleSelectCruise}
                onStartNew={handleStartNewCruise}
                onDeleteCruise={handleDeleteCruise}
              />
              <BackupRestore
                allCruises={allCruises}
                setAllCruises={setAllCruises}
                setActiveCruiseId={setActiveCruiseId}
                setAppState={setAppState}
              />
              <PhotoZipExport allCruises={allCruises} />
            </>
          ) : appState === 'setup' ? (
            <CruiseSetup onSave={handleSaveSetup} cruiseDetails={cruiseDetails} onDetailsChange={handleDetailsChange} />
          ) : (
            <DailyJournal cruiseDetails={cruiseDetails} onFinishCruise={handleFinishCruise} />
          )}
        </div>
      </div>

      {/* Global mobile-normalizing styles */}
      <style jsx global>{`
        input, select, textarea {
          -webkit-appearance: none;
          appearance: none;
          border-radius: 0;
          font-size: 16px !important;
          line-height: 1.25;
        }
        select { background-image: none; }
        textarea { resize: vertical; }
        * { -webkit-tap-highlight-color: rgba(0,0,0,0); }
        .safe-screen { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); }
        img { content-visibility: auto; }
      `}</style>

      <style jsx>{`
        @keyframes gradient { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient { background-size: 200% auto; animation: gradient 3s ease infinite; }
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0;
         } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        @keyframes slide-down { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-down { animation: slide-down 0.5s ease-out; }
      `}</style>

      <OrderSheet open={showOrderSheet} onClose={() => setShowOrderSheet(false)} />
    </main>
  );
}

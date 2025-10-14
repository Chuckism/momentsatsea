'use client';

import { useState, useRef, useEffect } from 'react';
import { Ship, MapPin, Calendar, Anchor, X, Upload, Image, Plus, Trash2 } from 'lucide-react';

// --- Offline Photo Store (IndexedDB) ---
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

// Helper: generate stable IDs offline
function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

// React helper to render a photo by ID (handles objectURL + cleanup)
function PhotoImg({ id, alt, className }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const blob = await getPhotoBlob(id);
      if (!alive) return;
      if (blob) setUrl(URL.createObjectURL(blob));
      else setUrl(null);
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!url) {
    return <div className={`bg-slate-700/40 border border-slate-600/50 rounded-lg ${className || ''}`} style={{display:'grid',placeItems:'center'}}>Loading…</div>;
  }
  return <img src={url} alt={alt} className={className} />;
}


// Major cruise ports database
const CRUISE_PORTS = [
  "Galveston, Texas",
  "Miami, Florida",
  "Fort Lauderdale, Florida",
  "Port Canaveral, Florida",
  "Tampa, Florida",
  "New Orleans, Louisiana",
  "Charleston, South Carolina",
  "Baltimore, Maryland",
  "New York, New York",
  "Boston, Massachusetts",
  "Seattle, Washington",
  "Los Angeles, California",
  "San Diego, California",
  "San Francisco, California",
  "Vancouver, Canada",
  "Barcelona, Spain",
  "Rome (Civitavecchia), Italy",
  "Venice, Italy",
  "Athens (Piraeus), Greece",
  "Southampton, England",
  "Copenhagen, Denmark",
  "Nassau, Bahamas",
  "Cozumel, Mexico",
  "Grand Cayman, Cayman Islands",
  "Jamaica (Ocho Rios)",
  "Jamaica (Montego Bay)",
  "St. Thomas, USVI",
  "St. Maarten",
  "Aruba",
  "Barbados",
  "San Juan, Puerto Rico",
  "Roatan, Honduras",
  "Belize City, Belize",
  "Costa Maya, Mexico",
  "Key West, Florida",
  "Cabo San Lucas, Mexico",
  "Puerto Vallarta, Mexico",
  "Ensenada, Mexico",
  "Juneau, Alaska",
  "Ketchikan, Alaska",
  "Skagway, Alaska",
  "Victoria, Canada",
  "Sydney, Australia",
  "Auckland, New Zealand",
  "Singapore",
  "Hong Kong",
  "Dubai, UAE",
  "Santorini, Greece",
  "Mykonos, Greece",
  "Dubrovnik, Croatia",
  "Lisbon, Portugal"
];

// Autocomplete for single port input
function PortAutocomplete({ value, onChange, placeholder, id }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const userInput = e.target.value;
    onChange(userInput);

    if (userInput.length > 0) {
      const filtered = CRUISE_PORTS.filter(port =>
        port.toLowerCase().includes(userInput.toLowerCase())
      ).slice(0, 5);
      
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setActiveSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion);
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
      handleSuggestionClick(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full h-10 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        placeholder={placeholder}
        autoComplete="off"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                index === activeSuggestion
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{suggestion}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Cruises Library Component
function CruisesLibrary({ cruises, onSelectCruise, onStartNew, onDeleteCruise }) {
  const activeCruises = cruises.filter(c => c.status === 'active');
  const finishedCruises = cruises.filter(c => c.status === 'finished');

  const formatDateRange = (departure, returnDate) => {
    const start = new Date(departure + 'T00:00:00');
    const end = new Date(returnDate + 'T00:00:00');
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const CruiseCard = ({ cruise }) => (
    <div
      onClick={() => onSelectCruise(cruise.id)}
      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/70 transition-all cursor-pointer group relative"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteCruise(cruise.id);
        }}
        className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-5 h-5" />
      </button>
      
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
          <Ship className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">
            {cruise.homePort?.split(',')[0] || 'Cruise'} Adventure
          </h3>
          <p className="text-slate-400 text-sm mb-2">
            {formatDateRange(cruise.departureDate, cruise.returnDate)}
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>📍 {cruise.itinerary?.length || 0} days</span>
            <span>🏠 {cruise.homePort?.split(',')[0]}</span>
            {cruise.status === 'finished' && (
              <span className="bg-green-600/20 text-green-400 px-2 py-1 rounded">
                ✓ Finished
              </span>
            )}
            {cruise.status === 'active' && (
              <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
                ● Active
              </span>
            )}
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
          onClick={onStartNew}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3 mb-8"
        >
          <Plus className="w-6 h-6" />
          Start New Cruise
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
                {activeCruises.map(cruise => (
                  <CruiseCard key={cruise.id} cruise={cruise} />
                ))}
              </div>
            )}

            {finishedCruises.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Finished Cruises
                </h3>
                {finishedCruises.map(cruise => (
                  <CruiseCard key={cruise.id} cruise={cruise} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced Cruise Setup Component with Date-Based Itinerary
function CruiseSetup({ onSave, cruiseDetails, onDetailsChange }) {
  const [itinerary, setItinerary] = useState([]);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  const handleBasicChange = (field, value) => {
    onDetailsChange({ [field]: value });
  };

  const generateItinerary = () => {
    if (!cruiseDetails.departureDate || !cruiseDetails.returnDate) {
      alert('Please enter departure and return dates');
      return;
    }

    // Force local midnight to avoid TZ drift
    const start = new Date(`${cruiseDetails.departureDate}T00:00:00`);
    const end   = new Date(`${cruiseDetails.returnDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      alert('Invalid date(s). Please reselect.');
      return;
    }
    if (start > end) {
      alert('Return date must be after departure date.');
      return;
    }

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

  const updateItineraryDay = (index, field, value) => {
    const updated = [...itinerary];
    updated[index][field] = value;
    setItinerary(updated);
  };

  const handleSaveItinerary = () => {
    if (itinerary.length === 0) {
      alert('Please generate itinerary first');
      return;
    }
    // Pass itinerary directly to avoid race condition
    onSave(itinerary);
  };

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
              <h3 className="text-xl font-bold text-white mb-2">
                📱 Works Offline at Sea!
              </h3>
              <p className="text-white/90 mb-4">
                Our app works on your phone, even when offline. Download it now while you have internet access. Once installed, you can journal anywhere—even in the middle of the ocean!
              </p>
              <button
                onClick={handleInstallClick}
                className="bg-white hover:bg-blue-50 text-blue-600 font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
              >
                <Ship className="w-5 h-5" />
                Install App Now
              </button>
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            >
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
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Set Up Your Cruise
          </h2>
          <p className="text-slate-400 text-lg">Let&apos;s build your cruise itinerary</p>
        </div>
        
        <div className="space-y-6">
          
          <div>
            <label htmlFor="homePort" className="block text-sm font-semibold text-slate-300 mb-2">
              🏠 Home Port (Departure & Return)
            </label>
            <PortAutocomplete
              id="homePort"
              value={cruiseDetails.homePort || ''}
              onChange={(val) => handleBasicChange('homePort', val)}
              placeholder="e.g., Galveston, Texas"
            />
          </div>

          <div>
            <label htmlFor="departureDate" className="block text-sm font-semibold text-slate-300 mb-2">
              📅 Departure Date
            </label>
            <input
              type="date"
              id="departureDate"
              value={cruiseDetails.departureDate || ''}
              onChange={(e) => handleBasicChange('departureDate', e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label htmlFor="returnDate" className="block text-sm font-semibold text-slate-300 mb-2">
              📅 Return Date
            </label>
            <input
              type="date"
              id="returnDate"
              value={cruiseDetails.returnDate || ''}
              onChange={(e) => handleBasicChange('returnDate', e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          <button
            onClick={generateItinerary}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Generate Itinerary
          </button>

          {itinerary.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-700">
              <h3 className="text-xl font-bold text-white">Your Itinerary</h3>
              {itinerary.map((day, index) => (
                <div key={day.date} className="bg-slate-700/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="block text-xs text-slate-400 mb-1">Location</label>
                      <select
                        value={day.type}
                        onChange={(e) => updateItineraryDay(index, 'type', e.target.value)}
                        className="flex-1 h-10 bg-slate-600/50 border border-slate-500/50 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value="embarkation">Embark</option>
                        <option value="sea">At Sea</option>
                        <option value="port">Port Day</option>
                        <option value="disembarkation">Disembark</option>
                      </select>
                    </div>
                    
                    {(day.type === 'port' || day.type === 'embarkation' || day.type === 'disembarkation') && (
                      <div className="flex flex-col">
                        <label className="block text-xs text-slate-400 mb-1">
                          {day.type === 'port' ? 'Port Name' : 'Home Port'}
                        </label>
                        <div className="flex-1">
                          <PortAutocomplete
                            value={day.port}
                            onChange={(val) => updateItineraryDay(index, 'port', val)}
                            placeholder="Port name..."
                          />
                        </div>
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
            onClick={handleSaveItinerary}
            className="group relative w-full overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-xl shadow-blue-500/25 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              Begin Your Journal
              <Ship className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          </button>
        )}
        
        <div className="pt-4 border-t border-slate-700/50">
          <p className="text-center text-xs text-slate-500">
            ✨ Works offline • 📸 Unlimited photos • 📖 Beautiful keepsake
          </p>
        </div>
      </div>
    </div>
  );
}

// Daily Journal Component
function DailyJournal({ cruiseDetails, onFinishCruise }) {
  const [selectedDate, setSelectedDate] = useState(cruiseDetails.itinerary[0]?.date || '');
  const [entries, setEntries] = useState({});
  const [savedEntries, setSavedEntries] = useState([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(`cruiseJournalEntries_${cruiseDetails.id}`);
    if (stored) {
      const loadedEntries = JSON.parse(stored);
      setSavedEntries(loadedEntries);
      
      const entriesMap = {};
      loadedEntries.forEach(entry => {
        entriesMap[entry.date] = {
          weather: entry.weather || '',
          activities: entry.activities || [],
          exceptionalFood: entry.exceptionalFood || '',
          summary: entry.summary || '',
          photos: entry.photos || []
        };
      });
      setEntries(entriesMap);
    }
  }, [cruiseDetails.id]);

  const currentDay = cruiseDetails.itinerary.find(day => day.date === selectedDate);
  const currentEntry = entries[selectedDate] || {
    weather: '',
    activities: [],
    exceptionalFood: '',
    summary: '',
    photos: []
  };

  const updateEntry = (field, value) => {
    setEntries(prev => ({
      ...prev,
      [selectedDate]: {
        ...currentEntry,
        [field]: value
      }
    }));
  };

  const addActivity = () => {
    const newActivity = {
      id: Date.now(),
      title: '',
      description: '',
      photos: []
    };
    updateEntry('activities', [...(currentEntry.activities || []), newActivity]);
  };

  const updateActivity = (id, field, value) => {
    const updated = currentEntry.activities.map(activity =>
      activity.id === id ? { ...activity, [field]: value } : activity
    );
    updateEntry('activities', updated);
  };

  const deleteActivity = (id) => {
    updateEntry('activities', currentEntry.activities.filter(a => a.id !== id));
  };
  
  // Convert File -> ArrayBuffer
  async function fileToArrayBuffer(file) {
    return await file.arrayBuffer();
  }

  const handleActivityPhotoUpload = async (activityId, e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting same file next time
    if (!files.length) return;

    try {
      const newIds = [];
      for (const file of files) {
        const id = makeId();
        const buf = await fileToArrayBuffer(file);
        await putPhoto({ id, cruiseId: cruiseDetails.id, arrayBuffer: buf, type: file.type, caption: '' });
        newIds.push({ id, caption: '' });
      }

      const updated = (currentEntry.activities || []).map(a =>
        a.id === activityId ? { ...a, photos: [...(a.photos || []), ...newIds] } : a
      );
      updateEntry('activities', updated);
    } catch (err) {
      console.error(err);
      alert("Couldn't save photos offline (device storage full or permission issue). Your text is safe.");
    }
  };
  
  const updateActivityPhotoCaption = (activityId, photoId, caption) => {
    const updated = (currentEntry.activities || []).map(a =>
      a.id === activityId
        ? { ...a, photos: (a.photos || []).map(p => p.id === photoId ? { ...p, caption } : p) }
        : a
    );
    updateEntry('activities', updated);
  };
  
  const deleteActivityPhoto = async (activityId, photoId) => {
    try { await deletePhotoBlob(photoId); } catch {}
    const updated = (currentEntry.activities || []).map(a =>
      a.id === activityId
        ? { ...a, photos: (a.photos || []).filter(p => p.id !== photoId) }
        : a
    );
    updateEntry('activities', updated);
  };

  const handleGeneralPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    try {
      const newIds = [];
      for (const file of files) {
        const id = makeId();
        const buf = await fileToArrayBuffer(file);
        await putPhoto({ id, cruiseId: cruiseDetails.id, arrayBuffer: buf, type: file.type, caption: '' });
        newIds.push({ id, caption: '' });
      }
      updateEntry('photos', [...(currentEntry.photos || []), ...newIds]);
    } catch (err) {
      console.error(err);
      alert("Couldn't save photos offline (device storage full or permission issue). Your text is safe.");
    }
  };
  
  const updateGeneralPhotoCaption = (photoId, caption) => {
    const updated = (currentEntry.photos || []).map(p => p.id === photoId ? { ...p, caption } : p);
    updateEntry('photos', updated);
  };
  
  const deleteGeneralPhoto = async (photoId) => {
    try { await deletePhotoBlob(photoId); } catch {}
    updateEntry('photos', (currentEntry.photos || []).filter(p => p.id !== photoId));
  };


  // Estimate size before saving; show clear message if we’d exceed quota
  function willExceedLocalStorage(key, valueStr) {
    try {
      // Quick probe: try writing to a temp key; if it throws, we’re out of space
      localStorage.setItem('__ls_probe__', '');
      localStorage.removeItem('__ls_probe__');

      // Rough check: current + new payload size (browsers vary; this is defensive)
      const currentAll = localStorage.getItem(key) || '[]';
      const projected = valueStr;
      const bytes = new Blob([projected]).size;
      const currentBytes = new Blob([currentAll]).size;

      // Most browsers give ~5MB per origin. Use ~4.5MB soft ceiling.
      const SOFT_LIMIT = 4_500_000;
      return (currentBytes + (bytes - currentBytes)) > SOFT_LIMIT;
    } catch {
      return true;
    }
  }

  const saveEntry = () => {
    const existingEntryIndex = savedEntries.findIndex(e => e.date === selectedDate);
    const isUpdate = existingEntryIndex >= 0;

    // IMPORTANT: Only store photo metadata (id, caption) in localStorage
    const entryToSave = {
      ...currentEntry, // Contains weather, food, summary, etc.
      date: selectedDate,
      dayInfo: currentDay,
      id: isUpdate ? savedEntries[existingEntryIndex].id : Date.now(),
      savedAt: new Date().toISOString(),
    };

    const next = isUpdate
      ? (() => { const copy = [...savedEntries]; copy[existingEntryIndex] = entryToSave; return copy; })()
      : [...savedEntries, entryToSave];

    const key = `cruiseJournalEntries_${cruiseDetails.id}`;
    const payload = JSON.stringify(next);

    // Guard against silent failure
    if (willExceedLocalStorage(key, payload)) {
      alert("Save aborted: your device’s offline storage is full. Your TEXT is still on screen—please copy it somewhere safe.");
      return;
    }

    try {
      localStorage.setItem(key, payload);
      setSavedEntries(next);
      setShowSuccessMessage(isUpdate ? 'updated' : 'saved');
      setTimeout(() => setShowSuccessMessage(''), 3000);

      if (!isUpdate) {
        const i = cruiseDetails.itinerary.findIndex(d => d.date === selectedDate);
        if (i < cruiseDetails.itinerary.length - 1) {
          setSelectedDate(cruiseDetails.itinerary[i + 1].date);
        }
      }
    } catch (err) {
      console.error('Failed to save entry:', err);
      alert("CRITICAL: Failed to save your entry (browser storage error). Please copy your text out before refreshing.");
    }
  };

  const goToPreviousDay = () => {
    const currentIndex = cruiseDetails.itinerary.findIndex(d => d.date === selectedDate);
    if (currentIndex > 0) {
      setSelectedDate(cruiseDetails.itinerary[currentIndex - 1].date);
    }
  };

  const goToNextDay = () => {
    const currentIndex = cruiseDetails.itinerary.findIndex(d => d.date === selectedDate);
    if (currentIndex < cruiseDetails.itinerary.length - 1) {
      setSelectedDate(cruiseDetails.itinerary[currentIndex + 1].date);
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
          <span className="font-medium">
            Entry {showSuccessMessage === 'updated' ? 'updated' : 'saved'} successfully!
          </span>
        </div>
      )}

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
          <Calendar className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">Daily Journal Entry</h2>
        <p className="text-slate-400">Capture today&apos;s memories</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl space-y-6">
        
        <div>
          <label htmlFor="date" className="block text-sm font-semibold text-slate-300 mb-2">
            📅 Select Day
          </label>
          <select
            name="date"
            id="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          >
            {cruiseDetails.itinerary.map((day) => (
              <option key={day.date} value={day.date}>
                {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })} - {day.type === 'embarkation' ? `Embark (${day.port.split(',')[0]})` :
                      day.type === 'disembarkation' ? `Disembark (${day.port.split(',')[0]})` :
                      day.type === 'port' ? day.port.split(',')[0] : 'At Sea'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="weather" className="block text-sm font-semibold text-slate-300 mb-2">
            ☀️ Weather
          </label>
          <input
            type="text"
            name="weather"
            id="weather"
            value={currentEntry.weather || ''}
            onChange={(e) => updateEntry('weather', e.target.value)}
            placeholder="e.g., Sunny, 85°F"
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-300">
              🎯 Activities & Excursions
            </label>
            <button
              onClick={addActivity}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Activity
            </button>
          </div>

          {(!currentEntry.activities || currentEntry.activities.length === 0) ? (
            <div className="text-center py-8 text-slate-500 italic border-2 border-dashed border-slate-700 rounded-lg">
              No activities yet. Click &quot;Add Activity&quot; to start!
            </div>
          ) : (
            <div className="space-y-4">
              {currentEntry.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={activity.title}
                      onChange={(e) => updateActivity(activity.id, 'title', e.target.value)}
                      placeholder="Activity name (e.g., Team Volleyball)"
                      className="flex-1 bg-slate-600/50 border border-slate-500/50 rounded-lg p-2 text-white placeholder-slate-400 font-medium focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                    <button
                      onClick={() => deleteActivity(activity.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <textarea
                    value={activity.description}
                    onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                    rows="3"
                    placeholder="Describe this activity..."
                    className="w-full bg-slate-600/50 border border-slate-500/50 rounded-lg p-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                  />

                  <div className="pt-2 border-t border-slate-600/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">📸 Photos for this activity</span>
                      <label className="cursor-pointer bg-slate-600/50 hover:bg-slate-600/70 text-slate-300 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Upload
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleActivityPhotoUpload(activity.id, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {activity.photos && activity.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {activity.photos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <PhotoImg id={photo.id} alt="Activity" className="w-full h-32 object-cover rounded-lg border border-slate-600/50" />
                            <button
                              onClick={() => deleteActivityPhoto(activity.id, photo.id)}
                              className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
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
          <label htmlFor="exceptionalFood" className="block text-sm font-semibold text-slate-300 mb-2">
            🍽️ Exceptional Food Options
          </label>
          <textarea
            name="exceptionalFood"
            id="exceptionalFood"
            value={currentEntry.exceptionalFood || ''}
            onChange={(e) => updateEntry('exceptionalFood', e.target.value)}
            rows="3"
            placeholder="Memorable meals or dishes..."
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
          />
        </div>

        <div>
          <label htmlFor="summary" className="block text-sm font-semibold text-slate-300 mb-2">
            📝 Summary of the Day
          </label>
          <textarea
            name="summary"
            id="summary"
            value={currentEntry.summary || ''}
            onChange={(e) => updateEntry('summary', e.target.value)}
            rows="5"
            placeholder="Write your thoughts, favorite moments..."
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
          />
        </div>

        <div className="pt-4 border-t border-slate-700/50 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-300">
              📸 General Photos
            </label>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Photos
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleGeneralPhotoUpload}
                className="hidden"
              />
            </label>
          </div>
          
          {(!currentEntry.photos || currentEntry.photos.length === 0) ? (
            <div className="text-center py-8 text-slate-500 italic border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center gap-2">
              <Image className="w-8 h-8 text-slate-600" />
              <span>No photos yet</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {currentEntry.photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <PhotoImg id={photo.id} alt="General" className="w-full h-32 object-cover rounded-lg border border-slate-600/50" />
                  <button
                    onClick={() => deleteGeneralPhoto(photo.id)}
                    className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
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

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={goToPreviousDay}
            disabled={isFirstDay}
            className={`flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 ${
              isFirstDay
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <span>←</span>
            <span className="hidden sm:inline">Previous</span>
          </button>

          <button
            onClick={saveEntry}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            {savedEntries.some(e => e.date === selectedDate) ? 'Update' : 'Save'}
          </button>

          <button
            onClick={goToNextDay}
            disabled={isLastDay}
            className={`flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 ${
              isLastDay
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {savedEntries.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl">
          <h3 className="text-2xl font-bold text-white mb-4">Saved Entries ({savedEntries.length})</h3>
          <div className="space-y-3">
          {[...savedEntries].sort((a, b) => a.date.localeCompare(b.date)).map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelectedDate(entry.date)}
                className={`cursor-pointer rounded-lg p-4 transition-all ${
                  entry.date === selectedDate
                    ? 'bg-blue-600/30 border-2 border-blue-500'
                    : 'bg-slate-700/30 border border-slate-600/50 hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-white font-semibold">
                    {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  {entry.date === selectedDate && (
                    <span className="text-blue-400 text-sm">✏️ Editing</span>
                  )}
                </div>
                <div className="text-slate-400 text-sm">
                  {entry.dayInfo?.type === 'port' ? entry.dayInfo.port :
                   entry.dayInfo?.type === 'embarkation' ? 'Embark' :
                   entry.dayInfo?.type === 'disembarkation' ? 'Disembark' : 'At Sea'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-3">Finished with this cruise?</h3>
        <p className="text-slate-400 mb-4">
          Mark this cruise as complete. You can always view it later from your cruise library.
        </p>
        <button
          onClick={onFinishCruise}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Anchor className="w-5 h-5" />
          Finish Cruise
        </button>
      </div>
    </div>
  );
}

// Main App Component
export default function HomePage() {
  const [appState, setAppState] = useState('cruises-list');
  const [allCruises, setAllCruises] = useState([]);
  const [activeCruiseId, setActiveCruiseId] = useState(null);
 
  const [cruiseDetails, setCruiseDetails] = useState({
    homePort: '',
    departureDate: '',
    returnDate: '',
    itinerary: [],
  });

  useEffect(() => {
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

  const handleDetailsChange = (updates) => {
    setCruiseDetails(prev => ({ ...prev, ...updates }));
  };

  const handleSaveSetup = (itinerary) => {
    const newCruise = {
      ...cruiseDetails,
      itinerary: itinerary || cruiseDetails.itinerary, // Ensure itinerary is included
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    
    const updatedCruises = [...allCruises, newCruise];
    setAllCruises(updatedCruises);
    setActiveCruiseId(newCruise.id);
    
    localStorage.setItem('allCruises', JSON.stringify(updatedCruises));
    localStorage.setItem('activeCruiseId', newCruise.id);
    
    setCruiseDetails(newCruise); // Update with the complete cruise including itinerary
    setAppState('journaling');
  };

  const handleStartNewCruise = () => {
    setCruiseDetails({
      homePort: '',
      departureDate: '',
      returnDate: '',
      itinerary: [],
    });
    setActiveCruiseId(null);
    setAppState('setup');
  };

  const handleFinishCruise = () => {
    const updatedCruises = allCruises.map(cruise =>
      cruise.id === activeCruiseId
        ? { ...cruise, status: 'finished', finishedAt: new Date().toISOString() }
        : cruise
    );
    
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

  const handleDeleteCruise = (cruiseId) => {
    if (confirm('Are you sure you want to delete this cruise and all its entries? This cannot be undone.')) {
      const updatedCruises = allCruises.filter(c => c.id !== cruiseId);
      setAllCruises(updatedCruises);
      localStorage.setItem('allCruises', JSON.stringify(updatedCruises));
      // Clean up orphaned entries
      localStorage.removeItem(`cruiseJournalEntries_${cruiseId}`);
      
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
          
          <div className="text-center mb-12 space-y-2">
            {appState !== 'cruises-list' && (
              <button
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
            <p className="text-slate-400 text-lg">Your cruise memories, beautifully preserved</p>
          </div>
          
          {appState === 'cruises-list' ? (
            <CruisesLibrary
              cruises={allCruises}
              onSelectCruise={handleSelectCruise}
              onStartNew={handleStartNewCruise}
              onDeleteCruise={handleDeleteCruise}
            />
          ) : appState === 'setup' ? (
            <CruiseSetup
              onSave={handleSaveSetup}
              cruiseDetails={cruiseDetails}
              onDetailsChange={handleDetailsChange}
            />
          ) : (
            <DailyJournal
              cruiseDetails={cruiseDetails}
              onFinishCruise={handleFinishCruise}
            />
          )}

        </div>
      </div>
      
      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s ease infinite;
        }
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes slide-down {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.5s ease-out;
        }
      `}</style>
    </main>
  );
}
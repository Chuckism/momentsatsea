'use client';

import { useState, useRef, useEffect } from 'react';
import { Ship, MapPin, Calendar, Anchor, X, Upload, ImageIcon } from 'lucide-react';

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

// Multi-Select Ports Component with Autocomplete
function PortsMultiSelect({ ports, onChange }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const wrapperRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.length > 0) {
      const filtered = CRUISE_PORTS.filter(port =>
        port.toLowerCase().includes(value.toLowerCase()) &&
        !ports.includes(port)
      ).slice(0, 5);
      
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setActiveSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const addPort = (port) => {
    if (!ports.includes(port)) {
      onChange([...ports, port]);
    }
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const removePort = (portToRemove) => {
    onChange(ports.filter(port => port !== portToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && activeSuggestion < suggestions.length - 1) {
      setActiveSuggestion(activeSuggestion + 1);
    } else if (e.key === 'ArrowUp' && activeSuggestion > 0) {
      setActiveSuggestion(activeSuggestion - 1);
    } else if (e.key === 'Enter' && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      addPort(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && inputValue === '' && ports.length > 0) {
      removePort(ports[ports.length - 1]);
    }
  };

  return (
    <div className="group" ref={wrapperRef}>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
          <MapPin className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <label htmlFor="ports-input" className="block text-base font-semibold text-slate-200">
            Destinations
          </label>
          <p className="text-xs text-slate-500">Add each port you'll visit</p>
        </div>
      </div>

      {ports.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
          {ports.map((port) => (
            <div
              key={port}
              className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg text-sm border border-emerald-500/30"
            >
              <MapPin className="w-3 h-3" />
              <span>{port}</span>
              <button
                onClick={() => removePort(port)}
                className="hover:text-emerald-100 transition-colors"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          id="ports-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl p-4 text-white text-lg placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 focus:bg-slate-700 transition-all"
          placeholder={ports.length === 0 ? "Start typing a port name..." : "Add another port..."}
          autoComplete="off"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                onClick={() => addPort(suggestion)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  index === activeSuggestion
                    ? 'bg-emerald-600/20 text-emerald-300'
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

      {ports.length === 0 && (
        <p className="mt-2 text-xs text-slate-500 italic">
          💡 Type to search from 50+ popular cruise ports
        </p>
      )}
    </div>
  );
}

// Autocomplete Input Component (for single fields like departure port)
function AutocompleteInput({ 
  label, 
  sublabel, 
  icon: Icon, 
  iconColor,
  name, 
  value, 
  onChange, 
  placeholder,
  id 
}) {
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
    onChange(e);

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
    onChange({ target: { name, value: suggestion } });
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
    <div className="group" ref={wrapperRef}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconColor} transition-colors`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <label htmlFor={id} className="block text-base font-semibold text-slate-200">
            {label}
          </label>
          <p className="text-xs text-slate-500">{sublabel}</p>
        </div>
      </div>
      <div className="relative">
        <input 
          type="text" 
          name={name} 
          id={id} 
          value={value} 
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl p-4 text-white text-lg placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-slate-700 transition-all" 
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
    </div>
  );
}

// Enhanced Cruise Setup Component
function CruiseSetup({ onSave, cruiseDetails, onDetailsChange }) {
  return (
    <div className="relative">
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl"></div>
      
      <div className="relative space-y-8 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm p-10 border border-slate-700/50 shadow-2xl">
        
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 mb-2">
            <Ship className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Set Sail on Your Journey
          </h2>
          <p className="text-slate-400 text-lg">Let's capture every moment of your cruise adventure</p>
        </div>
        
        <div className="space-y-6">
          
          <div className="group">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <label htmlFor="days" className="block text-base font-semibold text-slate-200">
                  Cruise Duration
                </label>
                <p className="text-xs text-slate-500">How many days will you be sailing?</p>
              </div>
            </div>
            <input 
              type="number" 
              name="days" 
              id="days" 
              min="1"
              max="30"
              value={cruiseDetails.days} 
              onChange={onDetailsChange} 
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl p-4 text-white text-lg font-medium placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-slate-700 transition-all" 
              placeholder="7"
            />
          </div>

          <AutocompleteInput
            label="Home Port"
            sublabel="Where does your journey begin?"
            icon={Anchor}
            iconColor="bg-cyan-500/10 group-hover:bg-cyan-500/20"
            name="departurePort"
            id="departurePort"
            value={cruiseDetails.departurePort}
            onChange={onDetailsChange}
            placeholder="Start typing... (e.g., Galveston)"
          />

          <PortsMultiSelect
            ports={cruiseDetails.portsArray || []}
            onChange={(newPorts) => {
              onDetailsChange({ 
                target: { 
                  name: 'portsArray', 
                  value: newPorts 
                } 
              });
            }}
          />
        </div>
        
        <button 
          onClick={onSave} 
          className="group relative w-full overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-xl shadow-blue-500/25 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            Begin Your Journal
            <Ship className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
        </button>
        
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
function DailyJournal({ cruiseDetails }) {
  const [currentEntry, setCurrentEntry] = useState({
    day: 1,
    location: 'At Sea',
    weather: '',
    activities: [], // Changed to array of activity objects
    exceptionalFood: '',
    summary: '',
    photos: []
  });

  const [savedEntries, setSavedEntries] = useState([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Load saved entries from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cruiseJournalEntries');
    if (stored) {
      setSavedEntries(JSON.parse(stored));
    }
  }, []);

  // Generate day options based on cruise duration
  const dayOptions = Array.from({ length: cruiseDetails.days }, (_, i) => i + 1);
  
  // Generate location options: "At Sea" + all ports
  const locationOptions = ['At Sea', ...cruiseDetails.portsArray];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentEntry(prev => ({ ...prev, [name]: value }));
  };

  // Add a new activity block
  const addActivity = () => {
    const newActivity = {
      id: Date.now(),
      title: '',
      description: '',
      photos: []
    };
    setCurrentEntry(prev => ({
      ...prev,
      activities: [...prev.activities, newActivity]
    }));
  };

  // Update an activity
  const updateActivity = (id, field, value) => {
    setCurrentEntry(prev => ({
      ...prev,
      activities: prev.activities.map(activity =>
        activity.id === id ? { ...activity, [field]: value } : activity
      )
    }));
  };

  // Delete an activity
  const deleteActivity = (id) => {
    setCurrentEntry(prev => ({
      ...prev,
      activities: prev.activities.filter(activity => activity.id !== id)
    }));
  };

  // Handle photo upload for activities
  const handleActivityPhotoUpload = (activityId, e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Create photo objects with preview URLs
    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      file: file,
      preview: URL.createObjectURL(file),
      caption: ''
    }));

    setCurrentEntry(prev => ({
      ...prev,
      activities: prev.activities.map(activity =>
        activity.id === activityId
          ? { ...activity, photos: [...activity.photos, ...newPhotos] }
          : activity
      )
    }));
  };

  // Update photo caption for activity
  const updateActivityPhotoCaption = (activityId, photoId, caption) => {
    setCurrentEntry(prev => ({
      ...prev,
      activities: prev.activities.map(activity =>
        activity.id === activityId
          ? {
              ...activity,
              photos: activity.photos.map(photo =>
                photo.id === photoId ? { ...photo, caption } : photo
              )
            }
          : activity
      )
    }));
  };

  // Delete photo from activity
  const deleteActivityPhoto = (activityId, photoId) => {
    setCurrentEntry(prev => ({
      ...prev,
      activities: prev.activities.map(activity =>
        activity.id === activityId
          ? {
              ...activity,
              photos: activity.photos.filter(photo => photo.id !== photoId)
            }
          : activity
      )
    }));
  };

  // Handle general photo upload
  const handleGeneralPhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      file: file,
      preview: URL.createObjectURL(file),
      caption: ''
    }));

    setCurrentEntry(prev => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos]
    }));
  };

  // Update general photo caption
  const updateGeneralPhotoCaption = (photoId, caption) => {
    setCurrentEntry(prev => ({
      ...prev,
      photos: prev.photos.map(photo =>
        photo.id === photoId ? { ...photo, caption } : photo
      )
    }));
  };

  // Delete general photo
  const deleteGeneralPhoto = (photoId) => {
    setCurrentEntry(prev => ({
      ...prev,
      photos: prev.photos.filter(photo => photo.id !== photoId)
    }));
  };

  // Save entry to localStorage
  const saveEntry = () => {
    // Convert photo previews to base64 for storage
    const entryToSave = {
      ...currentEntry,
      id: Date.now(),
      savedAt: new Date().toISOString(),
      activities: currentEntry.activities.map(activity => ({
        ...activity,
        photos: activity.photos.map(photo => ({
          id: photo.id,
          caption: photo.caption,
          preview: photo.preview // Keep the preview URL
        }))
      })),
      photos: currentEntry.photos.map(photo => ({
        id: photo.id,
        caption: photo.caption,
        preview: photo.preview
      }))
    };

    const updatedEntries = [...savedEntries, entryToSave];
    setSavedEntries(updatedEntries);
    localStorage.setItem('cruiseJournalEntries', JSON.stringify(updatedEntries));

    // Show success message
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);

    // Reset form for next entry
    setCurrentEntry({
      day: currentEntry.day + 1 <= cruiseDetails.days ? currentEntry.day + 1 : 1,
      location: 'At Sea',
      weather: '',
      activities: [],
      exceptionalFood: '',
      summary: '',
      photos: []
    });
  };

  // Load an existing entry
  const loadEntry = (entry) => {
    setCurrentEntry({
      day: entry.day,
      location: entry.location,
      weather: entry.weather,
      activities: entry.activities,
      exceptionalFood: entry.exceptionalFood,
      summary: entry.summary,
      photos: entry.photos
    });
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete a saved entry
  const deleteEntry = (entryId) => {
    const updatedEntries = savedEntries.filter(entry => entry.id !== entryId);
    setSavedEntries(updatedEntries);
    localStorage.setItem('cruiseJournalEntries', JSON.stringify(updatedEntries));
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-slide-in">
          <span className="text-xl">✓</span>
          <span className="font-medium">Entry saved successfully!</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
          <Calendar className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">Daily Journal Entry</h2>
        <p className="text-slate-400">Capture today's memories</p>
      </div>

      {/* Main Form */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl space-y-6">
        
        {/* Smart Dropdowns Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Day Selector */}
          <div>
            <label htmlFor="day" className="block text-sm font-semibold text-slate-300 mb-2">
              📅 Day of Cruise
            </label>
            <select
              name="day"
              id="day"
              value={currentEntry.day}
              onChange={handleInputChange}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            >
              {dayOptions.map(day => (
                <option key={day} value={day}>
                  Day {day} of {cruiseDetails.days}
                </option>
              ))}
            </select>
          </div>

          {/* Location Selector */}
          <div>
            <label htmlFor="location" className="block text-sm font-semibold text-slate-300 mb-2">
              📍 Location
            </label>
            <select
              name="location"
              id="location"
              value={currentEntry.location}
              onChange={handleInputChange}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            >
              {locationOptions.map(location => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weather Input */}
        <div>
          <label htmlFor="weather" className="block text-sm font-semibold text-slate-300 mb-2">
            ☀️ Weather
          </label>
          <input
            type="text"
            name="weather"
            id="weather"
            value={currentEntry.weather}
            onChange={handleInputChange}
            placeholder="e.g., Sunny, 85°F"
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
          />
        </div>

        {/* Activities Section - New Expandable Blocks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-300">
              🎯 Activities & Excursions
            </label>
            <button
              onClick={addActivity}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span className="text-lg">+</span> Add Activity
            </button>
          </div>

          {currentEntry.activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic border-2 border-dashed border-slate-700 rounded-lg">
              No activities yet. Click "Add Activity" to start!
            </div>
          ) : (
            <div className="space-y-4">
              {currentEntry.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-5 space-y-3"
                >
                  {/* Activity Title */}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={activity.title}
                      onChange={(e) => updateActivity(activity.id, 'title', e.target.value)}
                      placeholder="Activity name (e.g., Team Volleyball, Snorkeling)"
                      className="flex-1 bg-slate-600/50 border border-slate-500/50 rounded-lg p-2 text-white placeholder-slate-400 font-medium focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                    <button
                      onClick={() => deleteActivity(activity.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                      title="Delete activity"
                    >
                      <span className="text-xl">×</span>
                    </button>
                  </div>

                  {/* Activity Description */}
                  <textarea
                    value={activity.description}
                    onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                    rows="3"
                    placeholder="Describe this activity... What happened? What made it memorable?"
                    className="w-full bg-slate-600/50 border border-slate-500/50 rounded-lg p-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                  />

                  {/* Photo Upload Placeholder for Activity */}
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

                    {/* Photo Grid */}
                    {activity.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {activity.photos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.preview}
                              alt="Activity"
                              className="w-full h-32 object-cover rounded-lg border border-slate-600/50"
                            />
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

        {/* Exceptional Food */}
        <div>
          <label htmlFor="exceptionalFood" className="block text-sm font-semibold text-slate-300 mb-2">
            🍽️ Exceptional Food Options
          </label>
          <textarea
            name="exceptionalFood"
            id="exceptionalFood"
            value={currentEntry.exceptionalFood}
            onChange={handleInputChange}
            rows="3"
            placeholder="Memorable meals or dishes (e.g., Lobster at specialty restaurant, fresh conch fritters)"
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
          />
        </div>

        {/* Summary */}
        <div>
          <label htmlFor="summary" className="block text-sm font-semibold text-slate-300 mb-2">
            📝 Summary of the Day
          </label>
          <textarea
            name="summary"
            id="summary"
            value={currentEntry.summary}
            onChange={handleInputChange}
            rows="5"
            placeholder="Write your thoughts, favorite moments, or anything memorable about today..."
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
          />
        </div>

        {/* General Photo Upload Section */}
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
          
          <p className="text-xs text-slate-500">
            Upload any other photos from today that don't belong to a specific activity
          </p>

          {/* General Photos Grid */}
          {currentEntry.photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {currentEntry.photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.preview}
                    alt="General"
                    className="w-full h-32 object-cover rounded-lg border border-slate-600/50"
                  />
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
          ) : (
            <div className="text-center py-8 text-slate-500 italic border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center gap-2">
              <ImageIcon className="w-8 h-8 text-slate-600" />
              <span>No photos yet. Click "Upload Photos" to add some!</span>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={saveEntry}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Save Entry
        </button>
      </div>

      {/* Saved Entries Section */}
      {savedEntries.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-8 border border-slate-700/50 shadow-2xl">
          <h3 className="text-2xl font-bold text-white mb-4">Saved Entries ({savedEntries.length})</h3>
          <div className="space-y-3">
            {savedEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white font-semibold">
                      Day {entry.day} - {entry.location}
                    </span>
                    {entry.weather && (
                      <span className="text-slate-400 text-sm">☀️ {entry.weather}</span>
                    )}
                  </div>
                  <div className="text-slate-400 text-sm">
                    {entry.activities.length} activities • {entry.photos.length} general photos
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadEntry(entry)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main App Component
export default function HomePage() {
  const [appState, setAppState] = useState('setup'); 
  
  const [cruiseDetails, setCruiseDetails] = useState({
    days: 7,
    departurePort: '',
    portsArray: [],
  });

  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setCruiseDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSetup = () => {
    setAppState('journaling');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-start p-6 sm:p-8 md:p-12">
        <div className="w-full max-w-3xl">
          
          <div className="text-center mb-12 space-y-2">
            <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
              MomentsAtSea
            </h1>
            <p className="text-slate-400 text-lg">Your cruise memories, beautifully preserved</p>
          </div>
          
          {appState === 'setup' ? (
            <CruiseSetup 
              onSave={handleSaveSetup} 
              cruiseDetails={cruiseDetails} 
              onDetailsChange={handleDetailsChange} 
            />
          ) : (
            <DailyJournal cruiseDetails={cruiseDetails} />
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
      `}</style>
    </main>
  );
}
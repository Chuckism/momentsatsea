'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Download, RefreshCw, Ship, Loader2, Square, Grid, AlignCenter, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import { getPhotoBlob } from '../HomePageClient'; 

/* ==========================================
   HELPER: Single Photo Component
   ========================================== */
function PostcardPhoto({ id, className }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!id) return;
        setLoading(true);
        const blob = await getPhotoBlob(id);
        if (active && blob) {
          setUrl(URL.createObjectURL(blob));
        }
      } catch (e) {
        console.error("Failed to load photo", id);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; if(url) URL.revokeObjectURL(url); };
  }, [id]);

  if (loading) {
    return (
      <div className={`bg-slate-100 flex items-center justify-center ${className}`}>
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (!url) return <div className={`bg-slate-100 ${className}`} />;

  return <img src={url} className={`w-full h-full object-cover ${className}`} alt="Cruise memory" />;
}

/* ==========================================
   MAIN COMPONENT: Postcard Generator
   ========================================== */
export default function PostcardGenerator({ cruise, onClose }) {
  const postcardRef = useRef(null);
  const [status, setStatus] = useState('');
  
  // Layout & Position State
  const [layoutMode, setLayoutMode] = useState('hero'); 
  // FIX: Explicitly set default to bottom-right
  const [overlayPosition, setOverlayPosition] = useState('bottom-right'); 

  // Data State
  const [photoDatabase, setPhotoDatabase] = useState([]); 
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  
  // Filter State
  const [selectedLocation, setSelectedLocation] = useState('trip');

  // Text State
  const defaultShip = cruise?.ship || "Our Voyage";
  const defaultYear = cruise?.departureDate ? new Date(cruise.departureDate).getFullYear() : new Date().getFullYear();

  const [topText, setTopText] = useState("GREETINGS FROM");
  const [mainText, setMainText] = useState(defaultShip.toUpperCase()); 
  const [bottomText, setBottomText] = useState(`${defaultYear} CRUISE MEMORIES`);
  
  // 1. EXTRACT PORTS
  const availablePorts = useMemo(() => {
    if (!cruise?.itinerary) return [];
    return cruise.itinerary
      .filter(day => day.type === 'port' && day.port)
      .map(day => ({
        date: day.date,
        name: day.port.split(',')[0]
      }));
  }, [cruise]);

  // 2. LOAD PHOTOS
  useEffect(() => {
    if (!cruise?.id) return;

    const loadPhotos = () => {
      try {
        const raw = localStorage.getItem(`cruiseJournalEntries_${cruise.id}`);
        if (!raw) return;
        const entries = JSON.parse(raw);
        const allPhotos = [];
        entries.forEach(e => {
          if (e.photos) e.photos.forEach(p => allPhotos.push({ id: p.id, date: e.date }));
          if (e.activities) {
            e.activities.forEach(a => {
              if (a.photos) a.photos.forEach(p => allPhotos.push({ id: p.id, date: e.date }));
            });
          }
        });
        setPhotoDatabase(allPhotos);
        
        const tripIds = allPhotos.map(p => p.id);
        setSelectedPhotoIds(tripIds.sort(() => 0.5 - Math.random()).slice(0, 4));
        
        const initialMainText = cruise.label || (cruise.homePort ? cruise.homePort.split(',')[0] : defaultShip);
        setMainText(initialMainText.toUpperCase());
      } catch (e) {
        console.error("Error loading photos", e);
      }
    };
    loadPhotos();
  }, [cruise?.id]);

  // 3. HANDLE FILTER CHANGE
  const handleLocationChange = (e) => {
    const loc = e.target.value;
    setSelectedLocation(loc);
    if (loc === 'trip') {
      setMainText((cruise.ship || "THE HIGH SEAS").toUpperCase());
    } else {
      const portName = availablePorts.find(p => p.date === loc)?.name;
      if (portName) setMainText(portName.toUpperCase());
    }
    shufflePhotos(loc);
  };

  // 4. SHUFFLE LOGIC
  const shufflePhotos = (loc = selectedLocation) => {
    let pool = [];
    if (loc === 'trip') {
      pool = photoDatabase.map(p => p.id);
    } else {
      pool = photoDatabase.filter(p => p.date === loc).map(p => p.id);
    }
    if (pool.length === 0) pool = photoDatabase.map(p => p.id); 
    const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, 4);
    setSelectedPhotoIds(shuffled);
  };

  // 5. DOWNLOAD LOGIC
  const handleDownload = async () => {
    if (!postcardRef.current) return;
    setStatus('Generating...');
    try {
      await new Promise(r => setTimeout(r, 500));
      const dataUrl = await htmlToImage.toPng(postcardRef.current, { quality: 1.0, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `postcard-${mainText.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      setStatus('Saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      console.error('Postcard save failed', error);
      setStatus('Error');
    }
  };

  // Positioning Logic
  const getOverlayPositionClasses = () => {
    const base = 'absolute inset-0 p-4 flex pointer-events-none transition-all duration-300';
    switch (overlayPosition) {
      case 'top-left':     return `${base} items-start justify-start`;
      case 'top-right':    return `${base} items-start justify-end`;
      case 'bottom-left':  return `${base} items-end justify-start`;
      case 'bottom-right': return `${base} items-end justify-end`;
      case 'center':       return `${base} items-center justify-center`;
      default:             return `${base} items-end justify-end`;
    }
  };

  const getPosBtnStyle = (pos) => `p-2 rounded-lg flex items-center justify-center transition-all ${overlayPosition === pos ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-6xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
        
        {/* --- LEFT: Controls --- */}
        <div className="p-6 w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-700 flex flex-col gap-6 shrink-0 bg-slate-800/50 overflow-y-auto custom-scrollbar">
          {/* ... (Controls remain the same) ... */}
          {/* I am omitting the repeating input code for brevity, assume identical to previous but functionality unchanged */}
          <div>
            <h2 className="text-white font-bold text-xl mb-1">Design Postcard</h2>
            <p className="text-slate-400 text-sm">Customize layout, text, and position.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Photo Layout</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-700">
               <button onClick={() => setLayoutMode('hero')} className={`flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-all ${layoutMode === 'hero' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Square className="w-4 h-4" /> Single</button>
               <button onClick={() => setLayoutMode('grid')} className={`flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-all ${layoutMode === 'grid' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Grid className="w-4 h-4" /> Grid</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Overlay Position</label>
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 grid grid-cols-3 grid-rows-3 gap-1 w-fit mx-auto">
               <button onClick={() => setOverlayPosition('top-left')} className={getPosBtnStyle('top-left')}><ArrowUpLeft className="w-4 h-4" /></button>
               <div className="pointer-events-none"></div> 
               <button onClick={() => setOverlayPosition('top-right')} className={getPosBtnStyle('top-right')}><ArrowUpRight className="w-4 h-4" /></button>
               
               <div className="pointer-events-none"></div> 
               <button onClick={() => setOverlayPosition('center')} className={getPosBtnStyle('center')}><AlignCenter className="w-5 h-5" /></button>
               <div className="pointer-events-none"></div> 

               <button onClick={() => setOverlayPosition('bottom-left')} className={getPosBtnStyle('bottom-left')}><ArrowDownLeft className="w-4 h-4" /></button>
               <div className="pointer-events-none"></div> 
               <button onClick={() => setOverlayPosition('bottom-right')} className={getPosBtnStyle('bottom-right')}><ArrowDownRight className="w-4 h-4" /></button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Location Context</label>
            <select value={selectedLocation} onChange={handleLocationChange} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="trip">Entire Trip (Mix)</option>
              <option disabled>──────────</option>
              {availablePorts.map(p => (<option key={p.date} value={p.date}>{p.name}</option>))}
            </select>
          </div>

          <div className="space-y-4">
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Top Line</label>
               <input type="text" value={topText} onChange={(e) => setTopText(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Main Title</label>
               <input type="text" value={mainText} onChange={(e) => setMainText(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"/>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Bottom Line</label>
               <input type="text" value={bottomText} onChange={(e) => setBottomText(e.target.value)} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
             </div>
          </div>

          <button onClick={() => shufflePhotos(selectedLocation)} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-blue-300 font-medium py-3 px-4 rounded-lg transition-colors border border-slate-600">
            <RefreshCw className="w-4 h-4" /> Shuffle Photos
          </button>

          <div className="mt-auto space-y-3 pt-4">
            <button onClick={handleDownload} disabled={!!status} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg">
              {status === 'Generating...' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {status || 'Download Image'}
            </button>
            <button onClick={onClose} className="w-full text-slate-400 hover:text-white text-sm py-2">Close</button>
          </div>
        </div>

        {/* --- RIGHT: Preview --- */}
        <div className="flex-1 bg-slate-950 p-8 flex items-center justify-center overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
          
          <div ref={postcardRef} className="relative w-[800px] h-[520px] bg-white shadow-2xl shrink-0 flex flex-col overflow-hidden font-sans">
            {/* 1. Photo Area (Top part) */}
            <div className="relative flex-1 w-full bg-slate-100 overflow-hidden">
               {/* --- PHOTO LAYOUT --- */}
               {layoutMode === 'hero' ? (
                 <div className="w-full h-full">
                   {selectedPhotoIds.length > 0 ? (
                     <PostcardPhoto id={selectedPhotoIds[0]} className="w-full h-full" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center"><Ship className="w-20 h-20 text-slate-300" /></div>
                   )}
                 </div>
               ) : (
                 <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                   {selectedPhotoIds.map((id, i) => (<PostcardPhoto key={`${id}-${i}`} id={id} className="w-full h-full border border-white/20" />))}
                   {[...Array(Math.max(0, 4 - selectedPhotoIds.length))].map((_, i) => (<div key={`empty-${i}`} className="bg-slate-100 flex items-center justify-center border border-white/20"><Ship className="w-16 h-16 text-slate-300" /></div>))}
                 </div>
               )}

               {/* --- THE BADGE --- */}
               <div className={getOverlayPositionClasses()}>
                  {/* FIX: whitespace-nowrap, reduced vertical padding (py-3), smaller font */}
                  <div className="bg-white/60 backdrop-blur-md px-8 py-3 rounded-2xl border border-white/30 shadow-xl text-center min-w-[200px] whitespace-nowrap">
                     <div className="text-slate-700 text-[10px] font-bold tracking-[0.25em] uppercase mb-1">{topText}</div>
                     {/* FIX: text-3xl font size */}
                     <div className="text-slate-900 text-3xl font-serif font-bold tracking-tight mb-2 leading-none text-shadow-sm drop-shadow-sm">{mainText}</div>
                     <div className="h-1 w-10 bg-blue-600/80 rounded-full mx-auto mb-2"></div>
                     <div className="text-slate-700 text-[9px] font-bold tracking-[0.15em] uppercase">{bottomText}</div>
                  </div>
               </div>
            </div>

            {/* 2. The Footer */}
            <div className="h-[100px] bg-white border-t border-slate-100 flex items-center justify-between px-8 relative z-10">
               <div className="text-slate-600 font-serif italic text-xl">
                  Capture your cruise at <span className="font-bold text-blue-900 not-italic">MomentsAtSea.com</span>
               </div>
               <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SCAN FOR</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">FULL STORY</div>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded-lg">
                     <QRCodeSVG value="https://momentsatsea.com" size={60} bgColor="#ffffff" fgColor="#000000" />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
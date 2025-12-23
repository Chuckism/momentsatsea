'use client';
import { useMemo, useEffect, useState } from 'react';
import { Ship, MapPin, Sun, X, Printer, Loader2, ChevronLeft, ChevronRight, Award } from 'lucide-react';
import { getPhotoBlob } from '@/lib/photoStore';


/* ==========================================
   PHOTO COMPONENT (Reads from IndexedDB)
   ========================================== */
function MagazinePhoto({ id, className, caption, objectFit = "cover" }) {
  const [url, setUrl] = useState(null);
  
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!id) return;
        const blob = await getPhotoBlob(id); 
        if (active && blob) setUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error("Failed to load photo", id);
      }
    })();
    return () => { active = false; if(url) URL.revokeObjectURL(url); };
  }, [id]);

  if (!id) return <div className={`bg-slate-100 ${className}`} />;

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {url ? (
        <img src={url} className={`w-full h-full object-${objectFit}`} alt={caption || "Cruise memory"} />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-slate-300">
           <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 backdrop-blur-[2px]">
          <p className="text-[10px] text-white text-center font-medium truncate">{caption}</p>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   TEMPLATE: "SUNSCAPE" MAG LAYOUT
   ========================================== */
export default function MagazineRenderer({ cruise, onClose }) {
  
  // 1. Load Journal Entries from LocalStorage
  const [entries, setEntries] = useState({});
  const [coverPhotoIndex, setCoverPhotoIndex] = useState(0); 

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cruiseJournalEntries_${cruise.id}`);
      if (raw) {
        const loaded = JSON.parse(raw);
        // Normalize array -> object map for easier access by date
        const map = {};
        loaded.forEach(e => { map[e.date] = e; });
        setEntries(map);
      }
    } catch (e) {
      console.error("Failed to load journal for magazine", e);
    }
  }, [cruise.id]);

  const sortedDays = useMemo(() => {
    if (!cruise.itinerary) return [];
    return cruise.itinerary.map(day => {
      const entry = entries[day.date];
      return {
        ...day,
        weather: entry?.weather || '',
        summary: entry?.summary || '',
        exceptionalFood: entry?.exceptionalFood || '',
        activities: entry?.activities || [],
        photos: entry?.photos || [],
      };
    });
  }, [cruise.itinerary, entries]);

  // Helper to get ALL photos for the cover collage
  const allPhotoIds = useMemo(() => {
    let ids = [];
    Object.values(entries).forEach(e => {
       if (e.photos) e.photos.forEach(p => ids.push(p.id));
       if (e.activities) e.activities.forEach(a => {
         if (a.photos) a.photos.forEach(p => ids.push(p.id));
       });
    });
    return ids; 
  }, [entries]);

  const nextCover = () => setCoverPhotoIndex(prev => (prev + 1) % allPhotoIds.length);
  const prevCover = () => setCoverPhotoIndex(prev => (prev - 1 + allPhotoIds.length) % allPhotoIds.length);

  // Determine Main Title (Ship Name)
  const shipTitle = cruise.ship || "VOYAGE";

  // ✅ NEW: Calculate Unique Ports for Subtitle
  const portsVisitedString = useMemo(() => {
    if (!cruise.itinerary) return "";
    // 1. Filter for port days that have a port name defined
    const portDays = cruise.itinerary.filter(day => day.type === 'port' && day.port);
    // 2. Extract just the city name (before the comma) and clean whitespace
    const portNames = portDays.map(day => day.port.split(',')[0].trim());
    // 3. Get unique ports only (using Set)
    const uniquePorts = [...new Set(portNames)];
    
    if (uniquePorts.length === 0) return "Cruise Adventure"; // Fallback
    // 4. Join them with a nice bullet separator
    return uniquePorts.join(" • ");
  }, [cruise.itinerary]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col">
      
      {/* PRINT STYLES */}
      <style>{`
        @media print {
          body > * { visibility: hidden; }
          #magazine-content, #magazine-content * { visibility: visible; }
          #magazine-content { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            background: white;
            overflow: visible;
          }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-lg shrink-0 print:hidden">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
           <Printer className="w-5 h-5 text-blue-400" /> Digital Keepsake Preview
        </h2>
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-lg transition-all"
          >
            Print / Save PDF
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-8 bg-slate-500/50 flex flex-col items-center gap-8 print:p-0 print:bg-white print:gap-0">
        
        {/* WRAPPER FOR PRINTING */}
        <div id="magazine-content" className="flex flex-col items-center gap-8 print:gap-0 print:block">

          {/* === COVER PAGE === */}
          <div className="w-[8.5in] h-[11in] bg-white relative shadow-2xl shrink-0 overflow-hidden print:shadow-none print:break-after-page group">
             
             {/* Full Bleed Background Photo */}
             <div className="absolute inset-0 bg-slate-900">
                {allPhotoIds.length > 0 ? (
                   <MagazinePhoto id={allPhotoIds[coverPhotoIndex]} className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full bg-gradient-to-br from-blue-900 to-cyan-800" />
                )}
                {/* Elegant Gradient Overlay (Darker at top for text) */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/40" />
             </div>

             {/* Photo Selectors (Hidden in Print) */}
             {allPhotoIds.length > 1 && (
               <div className="no-print absolute inset-y-0 left-0 right-0 flex justify-between items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button onClick={prevCover} className="bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm transition-all"><ChevronLeft /></button>
                  <button onClick={nextCover} className="bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm transition-all"><ChevronRight /></button>
               </div>
             )}

             {/* === MASTHEAD (Top Title) === */}
             <div className="absolute top-12 left-0 right-0 text-center px-8 z-10">
                {/* Ship Name - Big, Bold, Serif */}
                <h1 className="text-6xl md:text-8xl font-serif font-bold text-white drop-shadow-2xl uppercase tracking-tight leading-none mb-2">
                  {shipTitle}
                </h1>
                
                {/* Destination - Smaller, Sans-serif */}
                <div className="flex items-center justify-center gap-4">
                   <div className="h-[1px] w-12 bg-white/60"></div>
                   {/* ✅ UPDATED: Shows only ports visited */}
                   <p className="text-white/90 uppercase tracking-[0.3em] text-lg font-medium drop-shadow-md">
                     {portsVisitedString}
                   </p>
                   <div className="h-[1px] w-12 bg-white/60"></div>
                </div>
             </div>

             {/* Bottom Info / Date */}
             <div className="absolute bottom-12 left-0 right-0 text-center z-10">
                <div className="inline-block bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4 rounded-lg shadow-lg">
                   <div className="text-white font-serif italic text-2xl">
                     {new Date(cruise.departureDate + 'T12:00:00').toLocaleDateString(undefined, {month:'long', year:'numeric'})}
                   </div>
                   <div className="text-white/80 text-xs uppercase tracking-widest mt-1">
                      {cruise.itinerary.length} Days • {sortedDays.filter(d => d.type === 'port').length} Ports
                   </div>
                </div>
                
                {/* Branding Footer */}
                <div className="mt-6 text-[10px] uppercase tracking-widest text-white/50">
                  Created with MomentsAtSea.com
                </div>
             </div>
          </div>

          {/* === DAILY PAGES === */}
          {sortedDays.map((day, i) => (
            <div key={i} className="w-[8.5in] h-[11in] bg-white relative shadow-2xl shrink-0 print:shadow-none print:break-after-page flex flex-col overflow-hidden">
              
              {/* Header */}
              <div className="h-24 bg-slate-100 flex items-center justify-between px-10 border-b border-slate-200 shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-full font-serif font-bold text-xl">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, {weekday:'long'})}
                      </div>
                      <div className="text-2xl font-serif font-bold text-slate-900 leading-none">
                        {day.type === 'port' ? day.port?.split(',')[0] : day.type === 'sea' ? 'Day at Sea' : day.type === 'embarkation' ? 'Embarkation' : 'Disembarkation'}
                      </div>
                    </div>
                 </div>
                 <div className="text-right">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                      <Sun className="w-4 h-4 text-yellow-500" /> {day.weather || 'Sunny'}
                    </div>
                 </div>
              </div>

              {/* Grid Layout */}
              <div className="flex-1 p-10 grid grid-cols-12 gap-8 overflow-hidden">
                 
                 {/* Left Col: Journal Text */}
                 <div className="col-span-5 flex flex-col gap-8">
                    {day.summary ? (
                      <div className="prose prose-slate prose-lg font-serif leading-relaxed text-slate-600 first-letter:text-5xl first-letter:font-bold first-letter:text-slate-900 first-letter:mr-1 first-letter:float-left">
                         {day.summary}
                      </div>
                    ) : (
                      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 italic">
                        No journal entry for this day.
                      </div>
                    )}

                    <div className="space-y-4">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">Highlights</h4>
                       {day.activities.map(act => (
                         <div key={act.id} className="group">
                           <div className="font-bold text-slate-900 text-sm">{act.title}</div>
                           {act.description && <div className="text-sm text-slate-500 mt-0.5">{act.description}</div>}
                         </div>
                       ))}
                    </div>

                    {day.exceptionalFood && (
                       <div className="mt-auto bg-yellow-50 p-4 border-l-4 border-yellow-400 text-sm text-yellow-900">
                          <span className="font-bold block mb-1 text-yellow-600 uppercase text-xs">Menu Highlight</span>
                          {day.exceptionalFood}
                       </div>
                    )}
                 </div>

                 {/* Right Col: Photos */}
                 <div className="col-span-7 grid grid-cols-2 gap-4 auto-rows-min content-start">
                    {(() => {
                       const dayPhotos = [...day.photos];
                       day.activities.forEach(a => {
                         if (a.photos) dayPhotos.push(...a.photos);
                       });
                       
                       // PLATINUM LOGIC
                       if (dayPhotos.length === 0) {
                          if (i === sortedDays.length - 1) {
                             return (
                               <div className="col-span-2 aspect-[3/4] bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center border border-slate-700 rounded-xl text-center p-6 shadow-inner">
                                 <Award className="w-20 h-20 text-yellow-400 mb-4 drop-shadow-lg" />
                                 <h3 className="text-white font-serif text-2xl font-bold mb-1">Platinum Cruiser</h3>
                                 <p className="text-slate-400 text-sm">Another voyage completed.</p>
                               </div>
                             );
                          }
                          return (
                            <div className="col-span-2 aspect-[3/4] bg-slate-50 flex items-center justify-center border border-slate-100 rounded-xl text-slate-300">
                              <Ship className="w-12 h-12 opacity-20" />
                            </div>
                          );
                       }

                       return dayPhotos.slice(0, 4).map((p, idx) => (
                         <MagazinePhoto 
                           key={p.id} 
                           id={p.id} 
                           caption={p.caption}
                           className={`rounded-lg shadow-sm ${idx === 0 ? 'col-span-2 aspect-video' : 'aspect-square'}`} 
                         />
                       ));
                    })()}
                 </div>
              </div>
              
              {/* Footer */}
              <div className="h-12 border-t border-slate-100 flex items-center justify-between px-10 text-[10px] text-slate-400 uppercase tracking-widest shrink-0">
                 <span>Created with MomentsAtSea.com</span>
                 <span>Page {i + 2}</span>
              </div>

            </div>
          ))}
          
          {/* === BACK COVER === */}
          <div className="w-[8.5in] h-[11in] bg-slate-900 relative shadow-2xl shrink-0 flex items-center justify-center print:shadow-none print:break-after-page">
            <div className="text-center space-y-4">
               <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                 <Ship className="w-8 h-8 text-white" />
               </div>
               <div className="text-white tracking-widest uppercase text-xs">Created with</div>
               <div className="text-3xl font-bold text-white">MomentsAtSea</div>
               <div className="text-slate-500 text-xs mt-8">momentsatsea.com</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
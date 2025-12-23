'use client';
import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, Download, Music, AlertTriangle, Play } from 'lucide-react';
// FIX: Ensure this points to the file in the SAME directory
import { getPhotoBlob } from '@/lib/photoStore';


/* ==========================================
   CONFIG: Video Timing & Settings
   ========================================== */
const FPS = 30;
const SECONDS_PER_PHOTO = 4;
const TRANSITION_DURATION = 1; // Crossfade time
const INTRO_DURATION = 3;
const OUTRO_DURATION = 3;

/* ==========================================
   HELPER: Load Image Promise
   ========================================== */
const loadImage = (blob) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, url }); 
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

/* ==========================================
   HELPER: Generate Ambient Ocean Music
   ========================================== */
// Creates a virtual audio stream using Web Audio API (No MP3 file needed)
function createAmbientTrack(ctx, duration) {
  const dest = ctx.createMediaStreamDestination();
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0.05; // Keep volume subtle

  // Create a chord (Am7) - A2, E3, G3
  [110, 164.81, 196.00].forEach((freq, i) => { 
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    // Add LFO for "wave" modulation (pitch wobble)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1 + (i * 0.05);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3; 
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    osc.connect(gainNode);
    lfo.start();
    osc.start();
    osc.stop(ctx.currentTime + duration + 2); // Add buffer
  });

  gainNode.connect(dest);
  return dest.stream;
}

/* ==========================================
   MAIN COMPONENT
   ========================================== */
export default function VideoGenerator({ cruise, onClose }) {
  const [status, setStatus] = useState('idle'); // idle, loading, rendering, done, error
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Invisible canvas for rendering
  const canvasRef = useRef(null);

  const handleGenerate = async () => {
    try {
      setStatus('loading');
      setProgress(0);
      setErrorMsg('');

      // --- A. GET DATA ---
      const raw = localStorage.getItem(`cruiseJournalEntries_${cruise.id}`);
      if (!raw) throw new Error("No journal entries found");
      const entries = JSON.parse(raw);
      
      let photoIds = [];
      entries.forEach(e => {
        if (e.photos) e.photos.forEach(p => photoIds.push(p.id));
        if (e.activities) e.activities.forEach(a => { if(a.photos) a.photos.forEach(p => photoIds.push(p.id)); });
      });
      
      // Limit photos to prevent memory crashes on mobile
      photoIds = photoIds.slice(0, 20);
      if (photoIds.length === 0) throw new Error("No photos available to generate video.");

      // --- B. PRELOAD IMAGES ---
      const loadedImages = [];
      for (let i = 0; i < photoIds.length; i++) {
        try {
          const blob = await getPhotoBlob(photoIds[i]);
          if (blob) {
            const { img } = await loadImage(blob);
            loadedImages.push(img);
          }
        } catch (e) { console.warn("Skipped corrupt image"); }
        setProgress(Math.round((i / photoIds.length) * 10)); // 0-10% progress
      }

      if (loadedImages.length === 0) throw new Error("Could not load images.");

      // --- C. SETUP RENDERER ---
      setStatus('rendering');
      
      // Calculate strict duration
      const contentDuration = loadedImages.length * SECONDS_PER_PHOTO;
      const totalDuration = INTRO_DURATION + contentDuration + OUTRO_DURATION;
      const totalFrames = totalDuration * FPS;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = 1280; // 720p is safer for mobile browsers than 1080p
      canvas.height = 720;

      // Audio Setup
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioStream = createAmbientTrack(audioCtx, totalDuration);
      
      // Capture Stream
      const canvasStream = canvas.captureStream(FPS);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setStatus('done');
        audioCtx.close();
      };

      mediaRecorder.start();

      // --- D. RENDER LOOP ---
      let frame = 0;
      
      // We use a recursive timeout to ensure we don't render faster than the FPS allows
      const renderFrame = () => {
        if (frame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const time = frame / FPS;
        
        // 1. Clear & Background
        ctx.fillStyle = '#0f172a'; // Slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Logic Selection
        // --- INTRO ---
        if (time < INTRO_DURATION) {
           const alpha = Math.min(1, time);
           ctx.globalAlpha = alpha;
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           
           ctx.fillStyle = 'white';
           ctx.font = 'bold 80px serif';
           ctx.fillText(cruise.ship || "My Voyage", 640, 320);
           
           ctx.fillStyle = '#94a3b8'; // Slate-400
           ctx.font = '30px sans-serif';
           ctx.fillText((cruise.homePort || "").split(',')[0], 640, 420);
        }
        
        // --- OUTRO ---
        else if (time > INTRO_DURATION + contentDuration) {
           const outroLocalTime = time - (INTRO_DURATION + contentDuration);
           ctx.globalAlpha = Math.min(1, outroLocalTime);
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           
           ctx.fillStyle = 'white';
           ctx.font = 'bold 60px serif';
           ctx.fillText("MomentsAtSea", 640, 320);
           
           ctx.fillStyle = '#94a3b8';
           ctx.font = '24px sans-serif';
           ctx.fillText("momentsatsea.com", 640, 390);
        }
        
        // --- PHOTOS ---
        else {
           const contentTime = time - INTRO_DURATION;
           const photoIndex = Math.floor(contentTime / SECONDS_PER_PHOTO);
           const localTime = contentTime % SECONDS_PER_PHOTO;
           const img = loadedImages[Math.min(photoIndex, loadedImages.length - 1)];

           if (img) {
             // Ken Burns Effect (Slow Zoom)
             // Calculate scale (1.0 to 1.1)
             const scale = 1 + (localTime * 0.025); 
             
             // Calculate centering with aspect ratio support
             const imgRatio = img.width / img.height;
             const canvasRatio = canvas.width / canvas.height;
             
             let drawW, drawH;
             if (imgRatio > canvasRatio) {
                drawH = canvas.height;
                drawW = canvas.height * imgRatio;
             } else {
                drawW = canvas.width;
                drawH = canvas.width / imgRatio;
             }
             
             // Apply Zoom
             drawW *= scale;
             drawH *= scale;
             
             const centerX = canvas.width / 2;
             const centerY = canvas.height / 2;
             const x = centerX - (drawW / 2);
             const y = centerY - (drawH / 2);

             ctx.globalAlpha = 1;

             // Crossfade In (if not first photo)
             if (localTime < TRANSITION_DURATION) {
               ctx.globalAlpha = localTime / TRANSITION_DURATION;
             }
             // Crossfade Out (at end of clip)
             if (localTime > (SECONDS_PER_PHOTO - TRANSITION_DURATION)) {
                // Keep alpha 1, let the next photo draw on top? 
                // Actually, simplest is just fade in the NEXT photo over the black background, 
                // so we just handle fade-in here.
             }

             ctx.drawImage(img, x, y, drawW, drawH);
           }
        }

        // 3. Next Frame
        frame++;
        setProgress(10 + Math.round((frame / totalFrames) * 90));
        
        // Force exactly 33ms delay (30 FPS)
        setTimeout(renderFrame, 1000 / FPS);
      };

      // Start the loop
      renderFrame();

    } catch (e) {
      console.error(e);
      setStatus('error');
      setErrorMsg(e.message || "Failed to generate video");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
      {/* Invisible Canvas for Processing */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
           <div>
             <h2 className="text-white font-bold text-xl flex items-center gap-2">
               <Music className="w-5 h-5 text-purple-400" /> Smart Video
             </h2>
             <p className="text-slate-400 text-sm">Generate a 4K slideshow with ambient music.</p>
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-white">
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          
          {status === 'idle' && (
            <div className="text-center space-y-6">
               <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Play className="w-10 h-10 text-slate-500 ml-1" />
               </div>
               <p className="text-slate-300 max-w-sm mx-auto">
                 Ready to compile your cruise memories into a video? This will process on your device and may take a moment.
               </p>
               <button 
                 onClick={handleGenerate}
                 className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-purple-900/20 transform hover:scale-105 transition-all"
               >
                 Start Rendering
               </button>
            </div>
          )}

          {(status === 'loading' || status === 'rendering') && (
            <div className="w-full max-w-md space-y-4 text-center">
               <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto" />
               <h3 className="text-white font-bold text-lg">
                 {status === 'loading' ? 'Loading Photos...' : 'Rendering Video...'}
               </h3>
               <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                 <div 
                   className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                   style={{ width: `${progress}%` }}
                 />
               </div>
               <p className="text-slate-500 text-xs">Please do not close this window.</p>
            </div>
          )}

          {status === 'done' && videoUrl && (
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
               <div className="aspect-video w-full max-w-md bg-black rounded-lg overflow-hidden border border-slate-700 mx-auto shadow-2xl">
                 <video src={videoUrl} controls className="w-full h-full" />
               </div>
               <div className="flex gap-4 justify-center">
                 <a 
                   href={videoUrl} 
                   download={`moments-${cruise.id}.webm`}
                   className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl"
                 >
                   <Download className="w-5 h-5" /> Save Video
                 </a>
                 <button 
                   onClick={() => { setStatus('idle'); setVideoUrl(null); }}
                   className="text-slate-400 hover:text-white px-4 py-2"
                 >
                   Create Another
                 </button>
               </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-red-400 font-bold">Rendering Failed</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">{errorMsg}</p>
              <button 
                 onClick={() => setStatus('idle')}
                 className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg mt-4"
               >
                 Try Again
               </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
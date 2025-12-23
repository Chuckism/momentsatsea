'use client';
import { useState, useEffect } from 'react';
import { Cloud, Check, RefreshCw, AlertTriangle, Loader2, Wifi, UploadCloud } from 'lucide-react';
import { supabase } from "../../lib/supabaseClient";
import { getPhotoBlob } from '@/app/lib/photoStore';




export default function SyncManager({ cruise, onSyncComplete, onClose }) {
  const [status, setStatus] = useState('idle'); // idle, checking, syncing, success, error
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [syncedFiles, setSyncedFiles] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [errors, setErrors] = useState([]);

  // 1. THE "SMART DIFF" ENGINE
  const startSync = async () => {
    setStatus('checking');
    setErrors([]);
    
    try {
      // A. Get User Session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to sync.");

      // B. Load Local Data (IndexedDB)
      const rawEntries = localStorage.getItem(`cruiseJournalEntries_${cruise.id}`);
      const entries = rawEntries ? JSON.parse(rawEntries) : [];
      
      // Gather all local photo IDs
      let localPhotos = [];
      entries.forEach(e => {
        if (e.photos) e.photos.forEach(p => localPhotos.push(p.id));
        if (e.activities) e.activities.forEach(a => {
          if (a.photos) a.photos.forEach(p => localPhotos.push(p.id));
        });
      });

      // C. Check Cloud Storage (What's already there?)
      // We assume a bucket structure: "user_id/cruise_id/photo_id.jpg"
      const storagePath = `${user.id}/${cruise.id}`;
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('memories') // Your bucket name
        .list(storagePath, { limit: 1000 });

      if (listError) throw listError;

      const remoteIds = new Set(existingFiles.map(f => f.name.split('.')[0]));
      
      // D. Calculate the "Delta" (Missing Photos)
      const missingPhotos = localPhotos.filter(id => !remoteIds.has(id));
      
      setTotalFiles(missingPhotos.length);
      setSyncedFiles(0);

      if (missingPhotos.length === 0) {
        // Just sync JSON and finish
        await syncJournalData(user.id, cruise, entries);
        setStatus('success');
        if (onSyncComplete) onSyncComplete();
        return;
      }

      // E. Start Batch Upload
      setStatus('syncing');
      await uploadBatch(missingPhotos, user.id, storagePath);
      
      // F. Finalize Journal Data
      await syncJournalData(user.id, cruise, entries);
      setStatus('success');
      if (onSyncComplete) onSyncComplete();

    } catch (err) {
      console.error("Sync failed", err);
      setErrors(prev => [...prev, err.message || "Unknown sync error"]);
      setStatus('error');
    }
  };

  // 2. CONCURRENCY CONTROLLED UPLOADER
  const uploadBatch = async (photoIds, userId, basePath) => {
    const BATCH_SIZE = 3; // Upload 3 at a time to prevent timeout
    
    for (let i = 0; i < photoIds.length; i += BATCH_SIZE) {
      const batch = photoIds.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (id) => {
        try {
          setCurrentFile(`Uploading photo ${id.slice(0, 5)}...`);
          const blob = await getPhotoBlob(id);
          
          if (!blob) {
            console.warn(`Local file ${id} missing from device.`);
            return; 
          }

          // Convert Blob to File for Supabase
          const fileExt = blob.type.split('/')[1] || 'jpg';
          const fileName = `${basePath}/${id}.${fileExt}`;

          const { error } = await supabase.storage
            .from('memories')
            .upload(fileName, blob, {
              cacheControl: '3600',
              upsert: false // We already diffed, so no need to overwrite
            });

          if (error) throw error;

          setSyncedFiles(prev => prev + 1);
          setProgress(prev => prev + (100 / totalFiles));

        } catch (e) {
          console.error(`Failed to upload ${id}`, e);
          setErrors(prev => [...prev, `Photo ${id}: ${e.message}`]);
        }
      }));
    }
  };

  // 3. DATABASE SYNC (The Journal Text)
  const syncJournalData = async (userId, cruise, entries) => {
    setCurrentFile("Syncing journal entries...");
    
    // Upsert the Cruise Metadata
    const { error: cruiseError } = await supabase
      .from('cruises')
      .upsert({
        id: cruise.id,
        user_id: userId,
        ship: cruise.ship,
        departure_date: cruise.departure_date,
        itinerary: cruise.itinerary,
        status: cruise.status,
        last_synced_at: new Date().toISOString()
      });

    if (cruiseError) throw cruiseError;

    // Upsert the Journal JSON (Stored as a big JSONB blob for simplicity, or relational rows)
    // For this architecture, storing the full JSON blob is often safer/faster for syncing.
    const { error: journalError } = await supabase
      .from('journals')
      .upsert({
        cruise_id: cruise.id,
        user_id: userId,
        entries_data: entries, // The big JSON object
        updated_at: new Date().toISOString()
      });

    if (journalError) throw journalError;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 p-6 text-center border-b border-slate-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-900/30 text-blue-400 rounded-full mb-4">
            <Cloud className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Syncing to Cloud</h2>
          <p className="text-slate-400 text-sm mt-1">Backing up your memories to the Trophy Case.</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Status Display */}
          <div className="flex flex-col items-center">
            {status === 'checking' && <span className="text-slate-400 animate-pulse">Checking cloud differences...</span>}
            {status === 'syncing' && <span className="text-blue-400 font-medium">{currentFile}</span>}
            {status === 'success' && <span className="text-emerald-400 font-bold flex items-center gap-2"><Check className="w-5 h-5"/> Sync Complete!</span>}
            {status === 'error' && <span className="text-red-400 font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Sync Failed</span>}
          </div>

          {/* Progress Bar */}
          {(status === 'syncing' || status === 'success') && (
            <div className="space-y-2">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${(syncedFiles / (totalFiles || 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{syncedFiles} / {totalFiles} Photos</span>
                <span>{Math.round((syncedFiles / (totalFiles || 1)) * 100)}%</span>
              </div>
            </div>
          )}

          {/* Error Log */}
          {errors.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-red-400 text-xs font-bold mb-1">Errors:</p>
              {errors.map((e, i) => (
                <div key={i} className="text-red-300 text-[10px]">{e}</div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {status === 'idle' && (
              <button 
                onClick={startSync}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-5 h-5" /> Start Sync
              </button>
            )}
            
            {status === 'syncing' && (
              <button disabled className="w-full py-3 bg-slate-700 text-slate-400 font-bold rounded-xl flex items-center justify-center gap-2 cursor-wait">
                <Loader2 className="w-5 h-5 animate-spin" /> Syncing...
              </button>
            )}

            {status === 'error' && (
              <button 
                onClick={startSync}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" /> Retry
              </button>
            )}

            <button 
              onClick={onClose} 
              className="py-3 px-4 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              {status === 'success' ? 'Close' : 'Cancel'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
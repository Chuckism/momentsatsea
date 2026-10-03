'use client';
import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, Share2, Music, AlertTriangle, Play, Monitor, Smartphone } from 'lucide-react';
import { getDisplayBlob } from '@/lib/photoStore';
import { loadCruisePhotos, pickPhotos } from '@/lib/photoSelection';
import { saveOrShareFile, slugify } from '@/lib/shareFile';
import { APP_NAME, SITE_LABEL } from '@/lib/brand';

/* ==========================================
   CONFIG: Video Timing & Settings
   ========================================== */
const FPS = 30;
const SECONDS_PER_PHOTO = 4;
const TRANSITION_DURATION = 1; // Crossfade time
const INTRO_DURATION = 3;
const OUTRO_DURATION = 3;
// Photos are decoded a few at a time, so this is about video length, not memory.
const MAX_PHOTOS = 20;

const FORMATS = {
  landscape: { width: 1920, height: 1080, label: 'Landscape', hint: '16:9 · TV, YouTube', bitrate: 8_000_000 },
  vertical: { width: 1080, height: 1920, label: 'Vertical', hint: '9:16 · Reels, Stories', bitrate: 8_000_000 },
};

// MP4 first: it saves to iPhone Photos and uploads everywhere.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1.42E028,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function pickRecorderType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return ''; // let the browser choose
}

export function videoDurationSeconds(photoCount) {
  return INTRO_DURATION + photoCount * SECONDS_PER_PHOTO + OUTRO_DURATION;
}

/* ==========================================
   HELPER: Generate Ambient Ocean Music
   ========================================== */
// Creates a virtual audio stream using Web Audio API (No MP3 file needed)
function createAmbientTrack(ctx, duration) {
  const dest = ctx.createMediaStreamDestination();
  const gainNode = ctx.createGain();
  const now = ctx.currentTime;
  // Fade in, hold, then fade out over the last two seconds.
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.05, now + 1.5);
  gainNode.gain.setValueAtTime(0.05, now + Math.max(1.5, duration - 2));
  gainNode.gain.linearRampToValueAtTime(0, now + duration);

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
    osc.stop(now + duration + 2); // Add buffer
    lfo.stop(now + duration + 2);
  });

  gainNode.connect(dest);
  return dest.stream;
}

/* ==========================================
   HELPER: Text for the timeline
   ========================================== */
function dayLabel(day, itinerary) {
  if (!day) return '';
  const index = itinerary.findIndex((d) => d.date === day.date);
  const prefix = index >= 0 ? `DAY ${index + 1}` : '';
  const port = (day.port || '').split(',')[0].trim();
  const place =
    day.type === 'port' ? port :
    day.type === 'sea' ? 'AT SEA' :
    day.type === 'embarkation' ? 'EMBARKATION' :
    day.type === 'disembarkation' ? 'HOMEWARD' : '';
  return [prefix, place.toUpperCase()].filter(Boolean).join(' · ');
}

function dateRangeLabel(cruise) {
  if (!cruise?.departureDate) return '';
  const start = new Date(`${cruise.departureDate}T00:00:00`);
  const end = cruise.returnDate ? new Date(`${cruise.returnDate}T00:00:00`) : null;
  if (Number.isNaN(start.getTime())) return '';
  const fmt = (d, opts) => d.toLocaleDateString('en-US', opts);
  if (!end || Number.isNaN(end.getTime())) return fmt(start, { month: 'long', year: 'numeric' });
  return `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/* ==========================================
   HELPER: Drawing
   ========================================== */
function fitText(ctx, text, maxWidth, size, weight, family) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 18 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function drawPhoto(ctx, W, H, img, progress, index) {
  if (!img) return;
  const imgRatio = img.width / img.height;
  const canvasRatio = W / H;
  const mismatch = Math.max(imgRatio, canvasRatio) / Math.min(imgRatio, canvasRatio);

  // Ken Burns: a slow zoom, panning a little in alternating directions.
  const scale = 1 + 0.08 * progress;
  const pan = (index % 2 === 0 ? 1 : -1) * 0.02 * progress;

  // 4:3 or 3:2 photos in a 16:9 video (mismatch up to ~1.33) just crop.
  // Only opposite orientations (~2.4) get the blurred fill.
  if (mismatch > 1.5) {
    // e.g. a landscape photo in a vertical video: blurred fill behind the
    // whole photo instead of cropping most of it away.
    const coverScale = Math.max(W / img.width, H / img.height) * 1.1;
    const cw = img.width * coverScale;
    const ch = img.height * coverScale;
    ctx.save();
    ctx.filter = 'blur(40px) brightness(0.55)';
    ctx.drawImage(img, (W - cw) / 2, (H - ch) / 2, cw, ch);
    ctx.restore();

    const containScale = Math.min(W / img.width, H / img.height) * scale;
    const w = img.width * containScale;
    const h = img.height * containScale;
    ctx.drawImage(img, (W - w) / 2 + pan * W, (H - h) / 2, w, h);
    return;
  }

  const coverScale = Math.max(W / img.width, H / img.height) * scale;
  const w = img.width * coverScale;
  const h = img.height * coverScale;
  ctx.drawImage(img, (W - w) / 2 + pan * W, (H - h) / 2, w, h);
}

function drawLowerThird(ctx, W, H, label, caption, alpha) {
  if ((!label && !caption) || alpha <= 0) return;
  const unit = Math.min(W, H) / 1080;
  const pad = 64 * unit;

  ctx.save();
  ctx.globalAlpha = alpha;
  const gradient = ctx.createLinearGradient(0, H * 0.6, 0, H);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 12 * unit;
  let y = H - pad;
  if (caption) {
    ctx.fillStyle = 'white';
    fitText(ctx, caption, W - pad * 2, 44 * unit, '600', 'Georgia, serif');
    ctx.fillText(caption, pad, y);
    y -= 60 * unit;
  }
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${26 * unit}px system-ui, sans-serif`;
    ctx.fillText(label, pad, y);
  }
  ctx.restore();
}

function drawTitleCard(ctx, W, H, title, lines, alpha) {
  const unit = Math.min(W, H) / 1080;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  fitText(ctx, title, W * 0.85, 110 * unit, 'bold', 'Georgia, serif');
  ctx.fillText(title, W / 2, H / 2 - 40 * unit);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${34 * unit}px system-ui, sans-serif`;
  lines.filter(Boolean).forEach((line, i) => {
    ctx.fillText(line, W / 2, H / 2 + (50 + i * 50) * unit);
  });
  ctx.restore();
}

/* ==========================================
   MAIN COMPONENT
   ========================================== */
export default function VideoGenerator({ cruise, onClose }) {
  const [status, setStatus] = useState('idle'); // idle, loading, rendering, done, error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null); // { blob, url, ext }
  const [errorMsg, setErrorMsg] = useState('');
  const [format, setFormat] = useState('landscape');
  const [saveStatus, setSaveStatus] = useState('');

  const [photos] = useState(() => pickPhotos(loadCruisePhotos(cruise), MAX_PHOTOS));
  const duration = videoDurationSeconds(photos.length);

  // Invisible canvas for rendering
  const canvasRef = useRef(null);
  const jobRef = useRef(null);

  // Stop any render and free resources when closing.
  useEffect(() => {
    return () => {
      jobRef.current?.cancel('closed');
    };
  }, []);
  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const handleGenerate = async () => {
    const recorderType = pickRecorderType();
    if (recorderType === null || !canvasRef.current?.captureStream) {
      setStatus('error');
      setErrorMsg("This browser can't record video. Please update Safari or Chrome and try again.");
      return;
    }
    if (photos.length === 0) {
      setStatus('error');
      setErrorMsg('Add some photos to your journal first.');
      return;
    }

    // Created inside the tap so iOS lets it play.
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.().catch(() => {});

    const bitmaps = new Map();
    const loading = new Map();
    let wakeLock = null;
    let recorder = null;
    let cancelled = null;
    let timer = null;

    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const b of bitmaps.values()) b?.close?.();
      bitmaps.clear();
      wakeLock?.release?.().catch(() => {});
      if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
    };

    const job = {
      cancel(reason) {
        if (cancelled) return;
        cancelled = reason;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        else cleanup();
      },
    };
    jobRef.current = job;

    function onVisibility() {
      if (document.visibilityState === 'hidden') job.cancel('hidden');
    }

    // Decode photos a couple at a time instead of all up front.
    const ensureBitmap = (i) => {
      if (i < 0 || i >= photos.length) return Promise.resolve(null);
      if (bitmaps.has(i)) return Promise.resolve(bitmaps.get(i));
      if (!loading.has(i)) {
        loading.set(
          i,
          getDisplayBlob(photos[i].id)
            .then((blob) => (blob ? createImageBitmap(blob) : null))
            .catch(() => null)
            .then((bmp) => {
              if (cancelled) bmp?.close?.();
              else bitmaps.set(i, bmp);
              loading.delete(i);
              return bmp;
            })
        );
      }
      return loading.get(i);
    };
    const releaseBefore = (i) => {
      for (const [k, b] of bitmaps) {
        if (k < i) {
          b?.close?.();
          bitmaps.delete(k);
        }
      }
    };

    try {
      setStatus('loading');
      setProgress(0);
      setErrorMsg('');
      setResult(null);

      await Promise.all([ensureBitmap(0), ensureBitmap(1)]);
      if (cancelled) return;

      setStatus('rendering');
      const { width: W, height: H, bitrate } = FORMATS[format];
      const canvas = canvasRef.current;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      try {
        wakeLock = await navigator.wakeLock?.request('screen');
      } catch {
        // Not supported or not allowed; rendering still works.
      }
      document.addEventListener('visibilitychange', onVisibility);

      const itinerary = cruise.itinerary || [];
      const labels = photos.map((p, i) =>
        i === 0 || photos[i - 1].date !== p.date ? dayLabel(p.day, itinerary) : ''
      );
      const title = cruise.ship || 'My Voyage';
      const subtitle = [dateRangeLabel(cruise), (cruise.homePort || '').split(',')[0]];
      const contentDuration = photos.length * SECONDS_PER_PHOTO;
      const total = duration;

      const audioStream = createAmbientTrack(audioCtx, total);
      const stream = new MediaStream([
        ...canvas.captureStream(FPS).getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);
      recorder = new MediaRecorder(stream, {
        ...(recorderType ? { mimeType: recorderType } : {}),
        videoBitsPerSecond: bitrate,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        cleanup();
        stream.getTracks().forEach((t) => t.stop());
        if (cancelled === 'hidden') {
          setStatus('error');
          setErrorMsg('Rendering stopped because the app left the screen. Keep MomentsAtSea open until the video finishes.');
          return;
        }
        // Closed, or failed mid-render (the catch below reports it).
        if (cancelled) return;
        const type = recorder.mimeType || recorderType || 'video/webm';
        const blob = new Blob(chunks, { type });
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        setResult({ blob, url: URL.createObjectURL(blob), ext });
        setStatus('done');
      };

      const drawFrame = (time) => {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);

        const contentTime = time - INTRO_DURATION;

        if (time < INTRO_DURATION) {
          drawTitleCard(ctx, W, H, title, subtitle, Math.min(1, time, (INTRO_DURATION - time) / TRANSITION_DURATION));
          return;
        }

        if (contentTime >= contentDuration) {
          const outroTime = contentTime - contentDuration;
          const last = photos.length - 1;
          if (outroTime < TRANSITION_DURATION) {
            drawPhoto(ctx, W, H, bitmaps.get(last), 1 + outroTime / SECONDS_PER_PHOTO, last);
            ctx.globalAlpha = outroTime / TRANSITION_DURATION;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, W, H);
          }
          drawTitleCard(ctx, W, H, APP_NAME, [SITE_LABEL.toLowerCase()], Math.min(1, outroTime / TRANSITION_DURATION));
          return;
        }

        const i = Math.min(photos.length - 1, Math.floor(contentTime / SECONDS_PER_PHOTO));
        const local = contentTime - i * SECONDS_PER_PHOTO;

        if (local < TRANSITION_DURATION) {
          const fadeIn = local / TRANSITION_DURATION;
          // True crossfade: the previous photo keeps moving underneath.
          if (i > 0) {
            drawPhoto(ctx, W, H, bitmaps.get(i - 1), 1 + local / SECONDS_PER_PHOTO, i - 1);
          }
          ctx.globalAlpha = fadeIn;
          drawPhoto(ctx, W, H, bitmaps.get(i), local / SECONDS_PER_PHOTO, i);
          ctx.globalAlpha = 1;
        } else {
          drawPhoto(ctx, W, H, bitmaps.get(i), local / SECONDS_PER_PHOTO, i);
        }

        const textAlpha = Math.max(0, Math.min(1, (local - 0.5) / 0.5, (SECONDS_PER_PHOTO - 0.5 - local) / 0.5));
        drawLowerThird(ctx, W, H, labels[i], photos[i].caption, textAlpha);

        // Keep the next photo decoded ahead of time; drop ones behind us.
        ensureBitmap(i + 1);
        releaseBefore(i - 1);
      };

      // Driven by the clock so the video's timing stays right even when
      // frames are late.
      drawFrame(0);
      recorder.start(1000);
      const startedAt = performance.now();
      let frames = 0;
      const tick = () => {
        if (cancelled) return;
        const time = (performance.now() - startedAt) / 1000;
        if (time >= total) {
          drawFrame(total - 0.001);
          recorder.stop();
          return;
        }
        drawFrame(time);
        if (++frames % 10 === 0) setProgress(Math.round((time / total) * 100));
        timer = setTimeout(tick, 1000 / FPS);
      };
      tick();
    } catch (e) {
      console.error(e);
      job.cancel('error');
      cleanup();
      setStatus('error');
      setErrorMsg(e.message || 'Failed to generate video');
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      const name = `${slugify(cruise.ship || cruise.label, 'cruise')}-highlights.${result.ext}`;
      const outcome = await saveOrShareFile(result.blob, name, { title: cruise.ship || 'Cruise highlights' });
      if (outcome !== 'cancelled') setSaveStatus('Saved!');
    } catch (e) {
      console.error('Video save failed', e);
      setSaveStatus('Could not save');
    }
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const handleClose = () => {
    jobRef.current?.cancel('closed');
    onClose();
  };

  const formatButton = (key, Icon) => {
    const f = FORMATS[key];
    const active = format === key;
    return (
      <button
        type="button"
        onClick={() => setFormat(key)}
        aria-pressed={active}
        className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
          active ? 'border-purple-500 bg-purple-600/20 text-white' : 'border-slate-700 text-slate-400 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2 font-semibold"><Icon className="w-4 h-4" /> {f.label}</div>
        <div className="text-xs mt-1 opacity-80">{f.hint}</div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
      {/* Invisible Canvas for Processing */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-400" /> Highlight Video
            </h2>
            <p className="text-slate-400 text-sm">A Full HD slideshow of your cruise with ambient music.</p>
          </div>
          <button onClick={handleClose} aria-label="Close" className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[300px]">
          {status === 'idle' && (
            <div className="text-center space-y-6 w-full">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <Play className="w-10 h-10 text-slate-500 ml-1" />
              </div>

              <div className="flex gap-3 w-full max-w-md mx-auto">
                {formatButton('landscape', Monitor)}
                {formatButton('vertical', Smartphone)}
              </div>

              <p className="text-slate-300 max-w-sm mx-auto" data-testid="video-plan">
                {photos.length === 0
                  ? 'Add some photos to your journal to make a video.'
                  : `Uses ${photos.length} photo${photos.length === 1 ? '' : 's'}: your favorites first, then moments from across the cruise. Takes about ${Math.ceil(duration)} seconds; keep the app open while it renders.`}
              </p>
              <button
                onClick={handleGenerate}
                disabled={photos.length === 0}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-purple-900/20"
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
              <p className="text-slate-500 text-xs">Keep this screen open until the video finishes.</p>
            </div>
          )}

          {status === 'done' && result && (
            <div className="text-center space-y-6 w-full">
              <div className={`${format === 'vertical' ? 'aspect-[9/16] max-w-[240px]' : 'aspect-video max-w-md'} w-full bg-black rounded-lg overflow-hidden border border-slate-700 mx-auto shadow-2xl`}>
                <video src={result.url} controls playsInline className="w-full h-full" data-testid="video-result" />
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl"
                >
                  <Share2 className="w-5 h-5" /> {saveStatus || 'Save / Share Video'}
                </button>
                <button
                  onClick={() => { setStatus('idle'); setResult(null); }}
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

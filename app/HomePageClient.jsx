'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Ship,
  Anchor,
  Plus,
  Trash2,
  ChevronRight,
  Cloud,
} from 'lucide-react';

import AuthGate from './features/auth/AuthGate';
import CruiseSetup from './features/cruise-setup/CruiseSetup';
import DailyJournal from './features/journal/DailyJournal';

import MagazineRenderer from './components/MagazineRenderer';
import PostcardGenerator from './components/PostcardGenerator';
import VideoGenerator from './components/VideoGenerator';
import SyncManager from './components/SyncManager';

import OrderSheet from './components/OrderSheet';
import BackupRestore from './components/BackupRestore';
import AuthSheet from './components/AuthSheet';


/* =========================
   Helpers
   ========================= */

const isCruiseFinished = (c) =>
  c?.status === 'finished' || c?.status === 'complete' || !!c?.finishedAt;

function pad(n) {
  return String(n);
}

function computeNextCruiseIndex(cruises, handle) {
  const prefix = `${handle}_`;
  const existing = cruises
    .map((c) => c?.label)
    .filter((l) => typeof l === 'string' && l.startsWith(prefix))
    .map((l) => Number(l.split('_').pop()) || 0);

  return (existing.length ? Math.max(...existing) : 0) + 1;
}

function makeCruiseLabel(cruises, handle) {
  return `${handle}_${pad(computeNextCruiseIndex(cruises, handle))}`;
}

/* =========================
   Cruises Library
   ========================= */

function CruisesLibrary({
  cruises,
  onSelectCruise,
  onStartNew,
  onDeleteCruise,
  onOpenOrder,
  onPreview,
  onPostcard,
  onVideo,
  onSync,
}) {
  const active = cruises.filter((c) => !isCruiseFinished(c));
  const finished = cruises.filter(isCruiseFinished);

  const CruiseCard = ({ cruise }) => (
    <div
      onClick={() => onSelectCruise(cruise.id)}
      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 cursor-pointer relative"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteCruise(cruise.id);
        }}
        className="absolute top-4 right-4 text-slate-400 hover:text-red-400"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      <h3 className="text-xl font-bold text-white mb-2">
        {cruise.ship || cruise.label || 'Cruise'}
      </h3>

      {isCruiseFinished(cruise) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSync(cruise);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Cloud className="w-4 h-4" /> Sync
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenOrder(cruise);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Create Keepsakes
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview(cruise);
            }}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg"
          >
            Preview Magazine
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onPostcard(cruise);
            }}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg"
          >
            Postcard
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onVideo(cruise);
            }}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg"
          >
            Video
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <button
        onClick={onStartNew}
        className="w-full bg-blue-600 text-white py-4 rounded-xl flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" /> Start New Cruise
      </button>

      {active.map((c) => (
        <CruiseCard key={c.id} cruise={c} />
      ))}

      {finished.map((c) => (
        <CruiseCard key={c.id} cruise={c} />
      ))}
    </div>
  );
}

/* =========================
   Main Component
   ========================= */

export default function HomePageClient() {
  const [appState, setAppState] = useState('cruises-list');
  const [allCruises, setAllCruises] = useState([]);
  const [activeCruiseId, setActiveCruiseId] = useState(null);

  const [orderCruise, setOrderCruise] = useState(null);
  const [previewCruise, setPreviewCruise] = useState(null);
  const [postcardCruise, setPostcardCruise] = useState(null);
  const [videoCruise, setVideoCruise] = useState(null);
  const [syncCruise, setSyncCruise] = useState(null);

  const [showAuth, setShowAuth] = useState(false);
  const [cruiseDetails, setCruiseDetails] = useState({
    ship: '',
    homePort: '',
    departureDate: '',
    returnDate: '',
    itinerary: [],
  });

  useEffect(() => {
    const stored = localStorage.getItem('allCruises');
    if (stored) setAllCruises(JSON.parse(stored));
  }, []);

  const handleStartNewCruise = () => {
    setCruiseDetails({
      ship: '',
      homePort: '',
      departureDate: '',
      returnDate: '',
      itinerary: [],
    });
    setAppState('setup');
  };

  const handleSaveSetup = (itinerary) => {
    const handle =
      localStorage.getItem('userHandle') ||
      cruiseDetails.homePort?.split(',')[0] ||
      'Cruise';

    const newCruise = {
      ...cruiseDetails,
      itinerary,
      id: Date.now().toString(),
      status: 'active',
      label: makeCruiseLabel(allCruises, handle),
    };

    const updated = [...allCruises, newCruise];
    setAllCruises(updated);
    localStorage.setItem('allCruises', JSON.stringify(updated));
    setActiveCruiseId(newCruise.id);
    setCruiseDetails(newCruise);
    setAppState('journaling');
  };

  const handleFinishCruise = () => {
    const updated = allCruises.map((c) =>
      c.id === activeCruiseId
        ? { ...c, status: 'finished', finishedAt: new Date().toISOString() }
        : c
    );
    setAllCruises(updated);
    localStorage.setItem('allCruises', JSON.stringify(updated));
    setActiveCruiseId(null);
    setAppState('cruises-list');
  };

  return (
    <AuthGate>
      <main className="min-h-screen bg-slate-900 text-white p-6">
        {appState === 'cruises-list' && (
          <CruisesLibrary
            cruises={allCruises}
            onSelectCruise={(id) => {
              const c = allCruises.find((x) => x.id === id);
              if (c) {
                setActiveCruiseId(id);
                setCruiseDetails(c);
                setAppState('journaling');
              }
            }}
            onStartNew={handleStartNewCruise}
            onDeleteCruise={(id) =>
              setAllCruises(allCruises.filter((c) => c.id !== id))
            }
            onOpenOrder={setOrderCruise}
            onPreview={setPreviewCruise}
            onPostcard={setPostcardCruise}
            onVideo={setVideoCruise}
            onSync={setSyncCruise}
          />
        )}

        {appState === 'setup' && (
          <CruiseSetup
            cruiseDetails={cruiseDetails}
            onDetailsChange={(u) =>
              setCruiseDetails((prev) => ({ ...prev, ...u }))
            }
            onSave={handleSaveSetup}
          />
        )}

        {appState === 'journaling' && (
          <DailyJournal
            cruiseDetails={cruiseDetails}
            onFinishCruise={handleFinishCruise}
            onUpdate={(u) =>
              setCruiseDetails((prev) => ({ ...prev, ...u }))
            }
          />
        )}

        <OrderSheet open={!!orderCruise} onClose={() => setOrderCruise(null)} cruise={orderCruise} />
        <AuthSheet open={showAuth} onClose={() => setShowAuth(false)} />

        {previewCruise && (
          <MagazineRenderer cruise={previewCruise} onClose={() => setPreviewCruise(null)} />
        )}
        {postcardCruise && (
          <PostcardGenerator cruise={postcardCruise} onClose={() => setPostcardCruise(null)} />
        )}
        {videoCruise && (
          <VideoGenerator cruise={videoCruise} onClose={() => setVideoCruise(null)} />
        )}
        {syncCruise && (
          <SyncManager cruise={syncCruise} onClose={() => setSyncCruise(null)} />
        )}
      </main>
    </AuthGate>
  );
}

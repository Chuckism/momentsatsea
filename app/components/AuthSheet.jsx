'use client';
import { useEffect, useState } from 'react';
import { X, Mail, LogOut, CloudDownload, User } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseConfigured, restoreLatestBackup } from '../../lib/backupSync';

export default function AuthSheet({ open, onClose, onSignedIn }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [user, setUser] = useState(null);

  // Load current user and react to auth changes
  useEffect(() => {
    if (!supabase) return;
    let subscription;

    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const { data: userRes } = await supabase.auth.getUser();
      setUser(userRes?.user || session?.session?.user || null);

      const res = supabase.auth.onAuthStateChange((_event, sess) => {
        const u = sess?.user || null;
        setUser(u);
        if (u && onSignedIn) onSignedIn(u);
      });
      subscription = res.data?.subscription;
    })();

    return () => subscription?.unsubscribe?.();
  }, [onSignedIn]);

  if (!open) return null;

  const sendMagic = async () => {
    if (!supabase) {
      setStatus('Supabase is not configured.');
      return;
    }
    if (!email) {
      setStatus('Enter your email.');
      return;
    }
    setSending(true);
    setStatus('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setStatus('Magic link sent! Check your email.');
    } catch (e) {
      setStatus(e.message || 'Failed to send magic link.');
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase?.auth.signOut();
      setStatus('Signed out.');
    } catch {/* ignore */}
  };

  function pickCruiseId() {
    try {
      const storedActive = localStorage.getItem('activeCruiseId');
      const all = JSON.parse(localStorage.getItem('allCruises') || '[]');
      if (storedActive && all.find(c => String(c.id) === String(storedActive))) return storedActive;
      const active = all.find(c => c.status === 'active');
      if (active) return active.id;
      return all[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  const doRestore = async () => {
    if (!supabaseConfigured()) {
      setStatus('Cloud backup not configured.');
      return;
    }
    const cruiseId = pickCruiseId();
    if (!cruiseId) {
      setStatus('No cruises found to restore into.');
      return;
    }
    setStatus('Restoring from cloud…');
    const ok = await restoreLatestBackup(cruiseId);
    setStatus(ok ? 'Restore complete.' : 'No cloud backup found for this cruise.');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/60 p-0 md:p-6">
      <div className="w-full md:max-w-md bg-slate-900 rounded-t-2xl md:rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-slate-300" />
            <div>
              <div className="text-sm uppercase tracking-wider text-slate-400">Account</div>
              <div className="text-xl font-bold text-white">{user ? 'You’re signed in' : 'Sign in'}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!user ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 text-base text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                autoComplete="email"
              />
              <button
                onClick={sendMagic}
                disabled={sending}
                className={`w-full ${sending ? 'bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 rounded-xl shadow-lg transition`}
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  {sending ? 'Sending…' : 'Send magic link'}
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-slate-300">
                Signed in as <span className="text-white font-semibold">{user.email}</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={doRestore}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl"
                  title="Restores the latest backup for your current/active cruise"
                >
                  <span className="inline-flex items-center gap-2">
                    <CloudDownload className="w-5 h-5" /> Restore from Cloud
                  </span>
                </button>
                <button
                  onClick={signOut}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl"
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="w-5 h-5" /> Sign out
                  </span>
                </button>
              </div>
            </div>
          )}

          {status && (
            <div className="text-sm text-slate-300 bg-slate-800/50 border border-slate-700/60 rounded-lg p-3">
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

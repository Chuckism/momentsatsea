'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Finishing sign-in…');

  useEffect(() => {
    let unsub = () => {};
    let timeoutId;

    async function finish() {
      try {
        // First, check if session is already set (detectSessionInUrl:true)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.replace('/?auth=ok');
          return;
        }

        // Otherwise, wait for auth state change
        unsub = supabase.auth
          .onAuthStateChange((_event, session2) => {
            if (session2?.user) router.replace('/?auth=ok');
          })
          .data?.subscription?.unsubscribe ?? (() => {});

        // Fallback check after a few seconds
        timeoutId = setTimeout(async () => {
          const { data: { session: s3 } } = await supabase.auth.getSession();
          if (s3?.user) router.replace('/?auth=ok');
          else setStatus('Could not complete sign-in. You can close this screen and try again.');
        }, 4000);
      } catch {
        setStatus('Could not complete sign-in. You can close this screen and try again.');
      }
    }

    finish();
    return () => {
      try { unsub?.(); } catch {}
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router]);

  return (
    <main className="min-h-screen grid place-items-center bg-slate-950 text-white p-6">
      <div className="max-w-sm w-full bg-slate-900/70 border border-slate-800 rounded-xl p-6 text-center">
        <div className="text-lg font-semibold mb-2">MomentsAtSea</div>
        <div className="text-slate-300">{status}</div>
      </div>
    </main>
  );
}

// app/features/auth/useAuthState.js
// Optional, non-blocking auth state for offline-first use

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Auth state is OPTIONAL.
 * App must always function without it.
 */
export function useAuthState() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("unknown"); 
  // unknown | guest | authenticated | error

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        if (!supabase) {
          if (mounted) {
            setUser(null);
            setStatus("guest");
          }
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!mounted) return;

        if (data?.session?.user) {
          setUser(data.session.user);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("guest");
        }
      } catch (err) {
        console.warn("[Auth] Non-fatal auth error:", err);
        if (mounted) {
          setUser(null);
          setStatus("guest");
        }
      }
    }

    init();

    let subscription;
    try {
      subscription = supabase?.auth?.onAuthStateChange(
        (_event, session) => {
          if (!mounted) return;
          if (session?.user) {
            setUser(session.user);
            setStatus("authenticated");
          } else {
            setUser(null);
            setStatus("guest");
          }
        }
      );
    } catch {
      // ignore — auth is optional
    }

    return () => {
      mounted = false;
      if (subscription?.data?.subscription) {
        subscription.data.subscription.unsubscribe();
      }
    };
  }, []);

  return {
    user,
    isAuthenticated: status === "authenticated",
    isGuest: status === "guest",
    status,
  };
}

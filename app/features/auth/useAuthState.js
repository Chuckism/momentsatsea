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
  // unknown | guest | authenticated

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!supabase) {
        if (mounted) {
          setUser(null);
          setStatus("guest");
        }
        return;
      }

      let session = null;

      try {
        // Supabase v2
        if (typeof supabase.auth.getSession === "function") {
          const { data } = await supabase.auth.getSession();
          session = data?.session ?? null;
        }
        // Supabase v1
        else if (typeof supabase.auth.session === "function") {
          session = supabase.auth.session();
        }
      } catch (err) {
        console.warn("[Auth] Non-fatal auth error:", err);
      }

      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("guest");
      }
    }

    init();

    let subscription;
    try {
      subscription = supabase.auth?.onAuthStateChange?.(
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
      // auth is optional — ignore
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

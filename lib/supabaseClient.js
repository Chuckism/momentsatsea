// lib/supabaseClient.js
// Temporary stub for offline/TestFlight build.
// Prevents crashes when SUPABASE env vars are not set.

export const supabase = {
  from() {
    throw new Error("Supabase is disabled in this offline build.");
  },
  auth: {
    getUser() {
      throw new Error("Supabase auth is disabled in this offline build.");
    },
  },
  storage: {
    from() {
      throw new Error("Supabase storage is disabled in this offline build.");
    },
  },
};

export default supabase;

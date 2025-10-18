import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Don’t crash if env vars aren’t set yet; just warn in the browser
if (!url || !key) {
  if (typeof window !== "undefined") {
    console.warn("[Supabase] Env vars missing. Cloud sync disabled until you add them.");
  }
}

export const supabase =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

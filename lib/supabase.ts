// lib/supabase.ts
// Supabase client — singleton for browser, fresh for server

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

let _browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (typeof window === "undefined") {
    // Server-side: fresh instance per request
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  // Client-side: reuse singleton
  if (!_browserClient) {
    _browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _browserClient;
}

export default getSupabase;

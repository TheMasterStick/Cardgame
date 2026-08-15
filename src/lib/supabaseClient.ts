import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Null when no Supabase project is configured (e.g. running the static
 * Artifact preview, or a fresh checkout before .env.local is filled in).
 * Callers should treat backend-dependent features (accounts, the admin
 * panel, shared collections) as unavailable rather than throwing.
 */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export function isBackendConfigured(): boolean {
  return supabase !== null;
}

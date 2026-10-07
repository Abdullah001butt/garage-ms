import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for admin-only tasks (creating staff logins, resetting passwords).
 * Never import this into client components — the key bypasses row-level security.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Staff logins aren't set up on the server yet (SUPABASE_SERVICE_ROLE_KEY is missing).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Bypasses RLS entirely. Only for operations the browser is deliberately denied:
 * approving transactions, crediting balances, creating investments. Never import this
 * from a Client Component — the `server-only` guard above turns that into a build error
 * rather than a leaked key.
 */
export function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; admin operations are unavailable.");
  }

  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

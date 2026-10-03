export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Demo mode is a supported way to run the site, not a failure state: with no Supabase
 * credentials the app falls back to the seeded localStorage store. Set
 * NEXT_PUBLIC_DATA_MODE=demo to force it even when credentials are present.
 */
export const usingSupabase =
  process.env.NEXT_PUBLIC_DATA_MODE !== "demo" && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

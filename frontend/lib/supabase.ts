import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — createClient must not run during static pre-rendering (build).
let _client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    // Fail with a message that names the missing variable, matching lib/api.ts.
    // These were `!` non-null assertions, so a missing value surfaced as an
    // opaque createClient failure at first auth use — same class of
    // misconfiguration as a missing API base, but far harder to diagnose.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set — add it to frontend/.env.local');
    }
    if (!key) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set — add it to frontend/.env.local',
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — createClient must not run during static pre-rendering (build).
let _client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return _client;
}

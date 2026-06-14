import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';
import { SUPABASE_URL } from './env';

/** Service-role client. SERVER ONLY — never import into a client component.
 *  Bypasses RLS, so every caller must verify the actor's role first. */
export function createAdminClient(): SupabaseClient<Database, any, any> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient<Database, any, any>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL);
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

type Fns = Database['public']['Functions'];

/** Typed wrapper over `supabase.rpc`. Arg and return types come from our own
 *  schema, sidestepping the SSR client's generic-resolution quirks. */
export async function callRpc<K extends keyof Fns>(
  client: SupabaseClient<Database, any, any>,
  fn: K,
  args: Fns[K]['Args'],
): Promise<{ data: Fns[K]['Returns'] | null; error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client.rpc as any)(fn as string, args);
}

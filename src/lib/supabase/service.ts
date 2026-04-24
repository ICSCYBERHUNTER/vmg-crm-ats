import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS — use only in server-side
 * admin contexts (cron jobs, backfill scripts, migrations).
 * Never expose to the browser or pass to client components.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

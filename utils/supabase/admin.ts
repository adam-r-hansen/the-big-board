import { createClient } from '@supabase/supabase-js'

/** Server-only admin client (service role bypasses RLS). Do NOT import in client components. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE!
  return createClient(url, key, { auth: { persistSession: false } })
}

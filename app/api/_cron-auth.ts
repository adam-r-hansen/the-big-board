import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export function hasCronSecret(req: NextRequest) {
  const got = req.headers.get('x-cron-secret')
  return !!got && got === process.env.CRON_SECRET
}

/** Pick the right Supabase client for this request */
export async function supabaseForRequest(req: NextRequest) {
  if (hasCronSecret(req)) {
    // Cron/server job => admin client (service role)
    return createAdminClient()
  }
  // Normal user/cookie-bound SSR client
  return await createClient()
}

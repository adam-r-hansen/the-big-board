// lib/clients.ts
import { cookies } from 'next/headers'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * SSR client (uses anon key + Next cookies).
 * NOTE: cookies() may be Promise-typed in Next 15, so we await it.
 */
export async function createServerClient(_opts: { req?: Request } = {}) {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSSRClient(url, anon, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) { cookiesToSet.forEach(c => cookieStore.set(c.name, c.value)) },
    },
  })
}

/**
 * Admin client (service role). NEVER expose to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

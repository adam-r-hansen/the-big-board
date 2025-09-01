// lib/clients.ts
import { cookies } from 'next/headers'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * SSR client (uses anon key + Next cookies)
 * Usage: const sb = createServerClient()
 */
export function createServerClient(_opts: { req?: Request } = {}) {
  const cookieStore = cookies()
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
 * Admin client (uses service role — NEVER expose to browser)
 * Usage: const sbAdmin = createAdminClient()
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

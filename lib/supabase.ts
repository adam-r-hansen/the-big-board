// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

/**
 * Browser client (anon key). Use in client components.
 */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  if (!anon) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  return createClient(url, anon)
}

/**
 * Server client using the service-role key.
 * No session persistence; for trusted server-side work.
 */
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ''
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE is required')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Explicit admin helper (same as supabaseServer, exported under a clearer name)
 * so API routes can `import { createAdminClient } from '@/lib/supabase'`.
 */
export function createAdminClient() {
  return supabaseServer()
}

/** Optional alias for older imports */
export const supabaseAdmin = createAdminClient


// utils/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Safe server-side Supabase client.
 * - On Vercel (prod/preview): requires env and behaves exactly as before.
 * - Local (NOT Vercel): if env is missing, returns a minimal no-op stub so pages render.
 */
export async function createClient() {
  const isVercel = process.env.VERCEL === '1'
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY

  // Local dev: if env is missing, return a no-op stub instead of throwing.
  if (!isVercel && (!url || !anon)) {
    const stub = {
      auth: {
        async getUser() {
          return { data: { user: null }, error: null as any }
        },
        async getSession() {
          return { data: { session: null }, error: null as any }
        },
        async signOut() {
          return { error: null as any }
        },
      },
    }
    return stub as any
  }

  // On Vercel (or if env is set locally), create the real client.
  const cookieStore = await cookies()
  return createServerClient(url!, anon!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options, maxAge: 0 })
      },
    },
  })
}

// Some callers may import default; keep both exports.
export default createClient

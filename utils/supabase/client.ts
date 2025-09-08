// utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

/**
 * Safe browser Supabase client.
 * - On Vercel (prod/preview) or when env exists locally: returns the real client.
 * - If env is missing (typical localhost w/o .env): returns a no-op stub so UI doesn't crash.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    // Local-only stub: provides the auth methods your UI calls.
    const stub = {
      auth: {
        async signInWithOtp(_: any) {
          // Pretend success so local flows can proceed without Supabase
          console.warn('[supabase stub] signInWithOtp called without env; returning ok')
          return { data: {}, error: null as any }
        },
        async getSession() {
          return { data: { session: null }, error: null as any }
        },
        async getUser() {
          return { data: { user: null }, error: null as any }
        },
        async signOut() {
          return { error: null as any }
        },
      },
      // Minimal query stub so accidental data calls don't explode
      from() {
        return {
          select() { return { data: [], error: null as any } },
          insert() { return { data: null, error: null as any } },
          update() { return { data: null, error: null as any } },
          upsert() { return { data: null, error: null as any } },
          delete() { return { data: null, error: null as any } },
          eq() { return this },
          in() { return this },
          order() { return this },
          limit() { return this },
          range() { return this },
          single() { return this },
          maybeSingle() { return this },
        }
      },
    }
    return stub as any
  }

  // Real client (prod/preview or properly configured local)
  return createBrowserClient(url, anon)
}

export default createClient

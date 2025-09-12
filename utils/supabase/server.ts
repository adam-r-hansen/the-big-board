// utils/supabase/server.ts
import {
  createServerClient as _createServerClient,
  type CookieOptions,
} from "@supabase/ssr"
import { createClient as _createClient } from "@supabase/supabase-js"

/**
 * Full server client (auth-aware). Safe in Server Components and Route Handlers.
 * Lazy-imports next/headers so just importing this module won't break in pages/.
 *
 * Usage:
 *   const supabase = await createServerClient()
 */
export async function createServerClient() {
  // Lazy import to avoid module-scope dependency on server-only APIs
  const { cookies } = await import("next/headers")
  const store = await cookies()

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            return store.get(name)?.value
          } catch {
            return undefined
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          // In SSR this throws; in Actions/Route Handlers it works.
          try {
            // @ts-expect-error Next's cookies() mutates in Actions/Routes
            store.set({ name, value, ...options })
          } catch {
            // swallow to avoid “Cookies can only be modified…” crash
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // @ts-expect-error Next's cookies() mutates in Actions/Routes
            store.set({ name, value: "", expires: new Date(0), ...options })
          } catch {
            // swallow in SSR
          }
        },
      },
    }
  )
}

/**
 * Read-only client (no cookie writes). Synchronous and safe to import anywhere,
 * including places where you just need public data and don’t want headers/cookies.
 *
 * Usage:
 *   const supabase = createServerClientReadOnly()
 */
export function createServerClientReadOnly() {
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

// Back-compat alias some callsites already use:
export { createServerClient as createClient }

// Optional default export
export default createServerClient

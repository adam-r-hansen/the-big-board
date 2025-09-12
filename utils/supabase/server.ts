// utils/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr"

/**
 * Server-side Supabase client that's safe in:
 * - Server Components / SSR (cookie writes are no-ops)
 * - Server Actions / Route Handlers (cookie writes succeed)
 *
 * Continue importing from "@/utils/supabase/server".
 */
export function createServerClient() {
  const store = cookies()

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Next 15 types sometimes widen `cookies()`—guard subtly without @ts-expect-error.
          const v = (store as any)?.get?.(name)?.value
          return typeof v === "string" ? v : undefined
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Next's cookies() supports object form in Actions/Route Handlers
            ;(store as any).set({ name, value, ...options })
          } catch {
            // swallow to avoid “Cookies can only be modified…” crash during SSR
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            ;(store as any).set({ name, value: "", expires: new Date(0), ...options })
          } catch {
            // swallow in SSR
          }
        },
      },
    }
  )
}

// Back-compat alias so routes that import `{ createClient }` keep working.
export const createClient = createServerClient

// Optional default export for existing default-import call sites
export default createServerClient

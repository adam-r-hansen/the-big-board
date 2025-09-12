// utils/supabase/server.ts
import { cookies } from "next/headers"
import {
  createServerClient as _createServerClient,
  type CookieOptions,
} from "@supabase/ssr"

/**
 * Safe server client for App Router:
 * - In SSR/server components: cookie writes are swallowed (avoid Next crash).
 * - In Server Actions/Route Handlers: cookie writes succeed.
 *
 * You can keep doing:
 *   import { createClient } from "@/utils/supabase/server"
 *   const supabase = await createClient()
 */
export async function createServerClient() {
  // Next 15 makes cookies() async in some contexts
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

// Back-compat for existing imports
export { createServerClient as createClient }

// Optional default export for default-import call sites
export default createServerClient

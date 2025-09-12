// utils/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr"

/**
 * Drop-in safe server client:
 * - In Server Components/SSR: cookie writes are try/catch no-ops (avoids Next crash).
 * - In Server Actions/Route Handlers: cookie writes succeed (Next allows it there).
 *
 * Keep importing this the way you already do:
 *   import { createServerClient } from "@/utils/supabase/server"
 */
export function createServerClient() {
  const store = cookies()

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // In SSR this throws; in Actions/Route Handlers it works.
          try {
            // @ts-expect-error next cookies API accepts this object form
            store.set({ name, value, ...options })
          } catch {
            // swallow to avoid “Cookies can only be modified…” crash
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // @ts-expect-error next cookies API accepts this object form
            store.set({ name, value: "", expires: new Date(0), ...options })
          } catch {
            // swallow in SSR
          }
        },
      },
    }
  )
}

// Optional default export for existing default-import call sites
export default createServerClient

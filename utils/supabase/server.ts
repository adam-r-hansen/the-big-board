// utils/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr"

/**
 * Server-safe Supabase client.
 * - In Server Components/SSR: cookie writes are try/catch no-ops.
 * - In Server Actions/Route Handlers: cookie writes succeed.
 */
export async function createServerClient() {
  const store = await cookies()

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            store.set({ name, value, ...options })
          } catch {
            // swallow to avoid “Cookies can only be modified…” crash
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            store.set({ name, value: "", expires: new Date(0), ...options })
          } catch {
            // swallow in SSR
          }
        },
      },
    }
  )
}

// Compat exports for existing call sites
export { createServerClient as createClient }
export default createServerClient

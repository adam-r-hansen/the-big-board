// utils/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr"

/**
 * Safe server client for Next 15:
 * - Works in Server Components/SSR (cookie writes are no-ops)
 * - Works in Server Actions/Route Handlers (cookie writes succeed)
 */
export async function createServerClient() {
  // Next 15 typings can be Promise-like in some contexts; normalize to an object
  const store = (await (cookies() as unknown as Promise<ReturnType<typeof cookies>> | ReturnType<typeof cookies>)) as ReturnType<typeof cookies>

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
          try {
            // In SSR this throws; in Actions/Route Handlers it works.
            store.set({ name, value, ...options } as any)
          } catch {
            /* no-op in SSR */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            store.set({ name, value: "", expires: new Date(0), ...options } as any)
          } catch {
            /* no-op in SSR */
          }
        },
      },
    }
  )
}

// Optional default export for existing default-import call sites
export default createServerClient

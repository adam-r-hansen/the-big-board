// utils/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr"

/**
 * Server-safe Supabase client for App Router:
 * - In Server Components/SSR: cookie writes are swallowed (avoid Next crash).
 * - In Server Actions/Route Handlers: cookie writes succeed.
 */
export function createServerClient() {
  // Next 15 types can vary (edge/runtime) and appear as a Promise in some paths.
  // Cast to any so we can call .get/.set without tripping TS during type-check.
  const store: any = cookies() as any

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store?.get?.(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // Next’s cookies() allows mutation in Actions/Route Handlers.
            store?.set?.({ name, value, ...options })
          } catch {
            // swallow to avoid “Cookies can only be modified…” crash in SSR
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            store?.set?.({ name, value: "", expires: new Date(0), ...options })
          } catch {
            // swallow in SSR
          }
        },
      },
    }
  )
}

// Historical alias so route handlers that import { createClient } keep working.
export const createClient = createServerClient

// Optional default export for existing default-import call sites
export default createServerClient

// Back-compat alias for existing server call sites
export const createClient = createServerClient

import { cookies } from "next/headers"
import { createServerClient as _createServerClient, type CookieOptions } from "@supabase/ssr"

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
        set(name: string, value: string, options?: CookieOptions) {
          store.set({ name, value, ...options })
        },
        remove(name: string, options?: CookieOptions) {
          store.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )
}

// Back-compat for existing imports in API routes:
export { createServerClient as createClient }

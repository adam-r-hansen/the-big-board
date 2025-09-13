// utils/supabase/server.ts
import { cookies as nextCookies } from 'next/headers'
import { createServerClient as _createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Next 15 compat:
 * - `cookies()` can be sync or Promise depending on context/runtimes.
 * - We normalize it here and keep the same exported API you’ve been using.
 */
export async function createServerClient() {
  const maybeStore = nextCookies() as unknown
  // If it quacks like a Promise, await it; otherwise use directly.
  const store: any =
    typeof (maybeStore as any)?.then === 'function' ? await (maybeStore as Promise<any>) : (maybeStore as any)

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            return store?.get?.(name)?.value
          } catch {
            return undefined
          }
        },
        set(name: string, value: string, options?: CookieOptions) {
          try {
            // `set` exists in Route Handlers / Server Actions; no-op if unavailable
            store?.set?.({ name, value, ...(options || {}) })
          } catch {
            /* ignore */
          }
        },
        remove(name: string, options?: CookieOptions) {
          try {
            store?.set?.({ name, value: '', ...(options || {}), maxAge: 0 })
          } catch {
            /* ignore */
          }
        },
      },
    }
  )
}

// Preserve the long-standing API the rest of the app imports:
export { createServerClient as createClient }

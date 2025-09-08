import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Local-safe Supabase session refresher.
 * - On Vercel (prod/preview): requires env and runs normally.
 * - Off Vercel (local): if env missing, becomes a no-op so localhost can run.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request })

  const isVercel = process.env.VERCEL === '1'
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If we're NOT on Vercel and env is missing, skip Supabase entirely (local dev passthrough).
  if (!isVercel && (!url || !anon)) {
    return response
  }

  // On Vercel (or if env is set locally), try to refresh the session.
  try {
    const supabase = createServerClient(url!, anon!, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    })

    await supabase.auth.getSession()
  } catch (err) {
    // If we're local, fail open (still allow page to render); on Vercel we rethrow to catch misconfig.
    if (!isVercel) return response
    throw err
  }

  return response
}

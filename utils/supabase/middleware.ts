// utils/supabase/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function updateSession(request: NextRequest) {
  // Create a response we can mutate (set cookies on)
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Read cookies from the incoming request
        getAll() {
          return request.cookies.getAll()
        },
        // Write refreshed cookies to the outgoing response
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          } catch {
            /* no-op: can't set during certain phases */
          }
        },
      },
    }
  )

  // Important: touching auth triggers token refresh & cookie updates
  await supabase.auth.getUser()

  return response
}


// middleware.ts
import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => req.cookies.get(key)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )

  const { data } = await supabase.auth.getUser()
  const email = data?.user?.email || ''
  const admin = (process.env.ADMIN_EMAIL || '').toLowerCase()

  if (!email || email.toLowerCase() !== admin) {
    const url = req.nextUrl.clone()
    url.pathname = '/access-denied'
    url.searchParams.set('reason', 'admin')
    return NextResponse.redirect(url)
  }
  return res
}

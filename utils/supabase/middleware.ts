// utils/supabase/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          try { list.forEach(({name,value,options}) => response.cookies.set(name, value, options)) } catch {}
        },
      },
    }
  )
  // Touch auth to trigger token refresh + cookie writes
  await supabase.auth.getUser()
  return response
}
≈

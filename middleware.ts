// middleware.ts (at project root)
import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // refresh Supabase auth cookies on each request
  return await updateSession(request)
}

// run on everything except static assets
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}


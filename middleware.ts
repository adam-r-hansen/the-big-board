import type { NextRequest } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

// Run on all app routes, skip static assets.
export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

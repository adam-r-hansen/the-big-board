import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

// (optional) Limit where middleware runs
// export const config = { matcher: ['/((?!_next|.*\\..*|api/auth).*)'] }

// app/auth/confirm/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as
    | 'magiclink'
    | 'recovery'
    | 'email_change'
    | 'invite'
    | null

  const next = url.searchParams.get('next') || '/'

  const supabase = await createClient()

  // PKCE / OAuth / email link flow that returns "code"
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }
  // Magic link "verify" flow (redirected by Supabase) that returns token_hash + type
  else if (token_hash && type) {
    await supabase.auth.verifyOtp({ type, token_hash })
  }

  return NextResponse.redirect(new URL(next, url.origin))
}


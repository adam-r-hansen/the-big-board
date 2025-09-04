// app/api/auth/email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: typeof init === 'number' ? init : 200 } : init || {}
  const headers = new Headers((base as ResponseInit).headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...(base as ResponseInit), headers })
}

/**
 * POST /api/auth/email
 * Body: { email: string, redirect: string }
 * Sends a Supabase passwordless magic link. We allow creating users.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const origin = url.origin

    let body: any = {}
    try { body = await req.json() } catch {}

    const email = (body?.email || '').trim().toLowerCase()
    const redirect = (body?.redirect || `${origin}/picks`).trim()

    if (!email) return j({ error: 'email required' }, 400)

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirect,     // where the magic link should land after verification
        shouldCreateUser: true,
      },
    })

    if (error) return j({ error: error.message }, 400)
    return j({ ok: true })
  } catch (e: any) {
    return j({ error: e?.message || 'email auth error' }, 500)
  }
}

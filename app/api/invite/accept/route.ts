// app/api/invite/accept/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  if (!leagueId) return j({ error: 'leagueId required' }, 400)

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user || null
  if (!user?.id || !user.email) {
    // Let the client know to go sign in first; client will carry redirect.
    return j({ error: 'unauthenticated' }, 401)
  }

  // 1) Enforce allow-list
  const email = String(user.email).toLowerCase()
  const { data: allowRow, error: allowErr } = await supabase
    .from('allowed_emails')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (allowErr) return j({ error: allowErr.message }, 400)
  if (!allowRow) return j({ error: 'email not allowed' }, 403)

  // 2) Upsert membership (idempotent)
  const { error: upErr } = await supabase
    .from('league_memberships')
    .upsert(
      { league_id: leagueId, profile_id: user.id, role: 'member' },
      { onConflict: 'league_id,profile_id' }
    )

  if (upErr) return j({ error: upErr.message }, 400)

  // 3) Success: tell client where to land
  return j({ ok: true, leagueId, redirect: `/picks?leagueId=${encodeURIComponent(leagueId)}` }, 200)
}

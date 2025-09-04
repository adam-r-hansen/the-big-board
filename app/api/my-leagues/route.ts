// app/api/my-leagues/route.ts
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

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  // 1) fetch memberships
  const { data: mems, error: mErr } = await supabase
    .from('league_memberships')
    .select('league_id')
    .eq('profile_id', auth.user.id)

  if (mErr) return j({ error: mErr.message }, 400)
  const ids = (mems ?? []).map((m: any) => m.league_id).filter(Boolean)
  if (ids.length === 0) return j({ leagues: [] }, 200)

  // 2) fetch only those leagues
  const { data: leagues, error: lErr } = await supabase
    .from('leagues')
    .select('id, name, season, created_at')
    .in('id', ids)

  if (lErr) return j({ error: lErr.message }, 400)
  return j({ leagues: leagues ?? [] }, 200)
}

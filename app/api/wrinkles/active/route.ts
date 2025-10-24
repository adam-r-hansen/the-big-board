// app/api/wrinkles/active/route.ts
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
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  const season = Number(searchParams.get('season') || '0')
  const week = Number(searchParams.get('week') || '0')

  if (!leagueId || !season || !week) return j({ error: 'leagueId, season, week required' }, 400)

  const { data, error } = await supabase
    .from('wrinkles')
    .select('id, name, status, kind, extra_picks, params')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'active')
    .order('id', { ascending: true })

  if (error) return j({ error: error.message }, 400)

  // normalize
  const rows = (data || []).map((w: any) => ({
    id: w.id,
    name: w.name,
    status: w.status,
    kind: w.kind,
    extra_picks: w.extra_picks || 0,
    params: w.params || {},
  }))

  return j({ wrinkles: rows }, 200)
}

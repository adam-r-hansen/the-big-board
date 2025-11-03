// app/api/admin/wrinkles/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

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
  const season = Number(searchParams.get('season') || '0')
  if (!leagueId || !season) return j({ error: 'leagueId and season required' }, 400)

  const sb = createAdminClient()
  const { data, error } = await sb
    .from('wrinkles')
    .select('id, league_id, season, week, name, status, extra_picks, kind')
    .eq('league_id', leagueId)
    .eq('season', season)
    .order('week', { ascending: true })
    .order('id', { ascending: true })

  if (error) return j({ error: error.message }, 400)
  return j({ wrinkles: data ?? [] }, 200)
}

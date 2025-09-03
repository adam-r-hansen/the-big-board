// app/api/my-picks/route.ts
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
    .from('picks')
    .select('id, team_id, game_id, season, week')
    .eq('profile_id', auth.user.id)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .order('id', { ascending: true })

  if (error) return j({ error: error.message }, 400)
  return j({ picks: data ?? [] }, 200)
}


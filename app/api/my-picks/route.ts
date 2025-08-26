import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const leagueId = u.searchParams.get('leagueId')
  const season = Number(u.searchParams.get('season'))
  const week = Number(u.searchParams.get('week'))
  if (!leagueId || !season || !week) {
    return NextResponse.json({ error: 'leagueId, season, week required' }, { status: 400 })
  }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await sb
    .from('picks')
    .select('id, team_id, game_id')
    .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('profile_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ picks: data ?? [] })
}

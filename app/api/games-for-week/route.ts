// app/api/games-for-week/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const url = new URL(req.url)
  const season = Number(url.searchParams.get('season') || '')
  const week = Number(url.searchParams.get('week') || '')

  if (!Number.isFinite(season) || !Number.isFinite(week)) {
    return NextResponse.json({ error: 'season and week are required' }, { status: 400, headers: { 'cache-control': 'no-store' } })
  }

  const { data, error } = await supabase
    .from('games')
    .select('id, season, week, game_utc, status, home_team, away_team, home_score, away_score, espn_id')
    .eq('season', season)
    .eq('week', week)
    .order('game_utc', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }

  return NextResponse.json(
    { games: data ?? [] },
    { headers: { 'cache-control': 'no-store' } }
  )
}

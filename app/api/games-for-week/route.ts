// app/api/games-for-week/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type DbGame = {
  id: string
  season: number
  week: number
  game_utc: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: 'UPCOMING' | 'LIVE' | 'FINAL' | null
}

function inferStatus(g: DbGame): 'UPCOMING' | 'LIVE' | 'FINAL' {
  // Only used if DB status is null. Otherwise DB is authoritative.
  const now = Date.now()
  const kickoff = Date.parse(g.game_utc)
  // Treat 4 hours after kickoff as a safe “game window” for LIVE inference.
  const endWindow = kickoff + 4 * 60 * 60 * 1000

  if (now < kickoff) return 'UPCOMING'
  if (now >= kickoff && now <= endWindow) return 'LIVE'
  // If scores exist and we're past the window, assume FINAL.
  return 'FINAL'
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const season = Number(searchParams.get('season'))
    const week = Number(searchParams.get('week'))

    if (!Number.isFinite(season) || !Number.isFinite(week)) {
      return NextResponse.json({ error: 'season and week are required' }, { status: 400 })
    }

    const supabase = createClient()
    // No auth requirement to view schedule/scoreboard
    const { data, error } = await supabase
      .from('games')
      .select(
        `
        id, season, week, game_utc, home_team, away_team,
        home_score, away_score, status
      `
      )
      .eq('season', season)
      .eq('week', week)
      .order('game_utc', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data as DbGame[]).map((g) => ({
      id: g.id,
      season: g.season,
      week: g.week,
      game_utc: g.game_utc,
      home_team: g.home_team,
      away_team: g.away_team,
      home_score: g.home_score,
      away_score: g.away_score,
      // DB status is authoritative unless it's null.
      status: g.status ?? inferStatus(g),
    }))

    return NextResponse.json({ games: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}

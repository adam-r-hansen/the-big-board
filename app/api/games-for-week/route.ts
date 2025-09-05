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

// Only used when DB status is null
function inferStatus(g: DbGame): 'UPCOMING' | 'LIVE' | 'FINAL' {
  const now = Date.now()
  const kickoff = Date.parse(g.game_utc)
  const endWindow = kickoff + 4 * 60 * 60 * 1000 // 4h window

  if (now < kickoff) return 'UPCOMING'
  if (now >= kickoff && now <= endWindow) return 'LIVE'
  return 'FINAL'
}

// Reconcile DB status with wall clock to avoid "LIVE" before kickoff
function reconcileStatus(g: DbGame): 'UPCOMING' | 'LIVE' | 'FINAL' {
  const db = g.status
  const now = Date.now()
  const kickoff = Date.parse(g.game_utc)
  const preBufferMs = 60 * 1000 // 1 minute early buffer

  if (db === 'FINAL') return 'FINAL'

  // If we're clearly before kickoff (with a buffer), it cannot be LIVE.
  if (now < kickoff - preBufferMs) return 'UPCOMING'

  if (db === 'UPCOMING' && now >= kickoff) return 'LIVE'
  if (db === 'LIVE' && now < kickoff) return 'UPCOMING'

  // Fall back to DB value or inference when null
  return db ?? inferStatus(g)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const season = Number(searchParams.get('season'))
    const week = Number(searchParams.get('week'))

    if (!Number.isFinite(season) || !Number.isFinite(week)) {
      return NextResponse.json({ error: 'season and week are required' }, { status: 400 })
    }

    // NOTE: createClient() returns a Promise in this codebase
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('games')
      .select(`
        id, season, week, game_utc, home_team, away_team,
        home_score, away_score, status
      `)
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
      status: reconcileStatus(g),
    }))

    return NextResponse.json({ games: rows })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}

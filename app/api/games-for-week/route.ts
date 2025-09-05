// app/api/games-for-week/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Always hit the DB (no prerender cache)
export const dynamic = 'force-dynamic'

// Use the public (read-only) anon client for scoreboard
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail fast if env vars are missing
  console.warn(
    '[games-for-week] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const seasonParam = url.searchParams.get('season')
    const weekParam = url.searchParams.get('week')

    const season = Number(seasonParam ?? new Date().getUTCFullYear())
    const week = Number(weekParam ?? 1)

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })

    // Pull games for the selected week/season
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select(
        'id, season, week, game_utc, status, home_team, away_team, home_score, away_score'
      )
      .eq('season', season)
      .eq('week', week)
      .order('game_utc', { ascending: true })

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ rows: [], season, week })
    }

    // Join team metadata
    const teamIds = Array.from(
      new Set(
        games.flatMap((g: any) => [g.home_team, g.away_team]).filter(Boolean)
      )
    )

    let teamsById: Record<string, any> = {}
    if (teamIds.length) {
      const { data: teams, error: tErr } = await supabase
        .from('teams')
        .select(
          'id, abbreviation, short_name, name, color_primary, color_secondary'
        )
        .in('id', teamIds)

      if (tErr) {
        return NextResponse.json({ error: tErr.message }, { status: 500 })
      }

      teamsById = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))
    }

    const rows = games.map((g: any) => ({
      id: g.id,
      season: g.season,
      week: g.week,
      game_utc: g.game_utc,
      status: g.status, // UPCOMING | LIVE | FINAL
      home_score: g.home_score,
      away_score: g.away_score,
      home_team_id: g.home_team,
      away_team_id: g.away_team,
      home_team: teamsById[g.home_team] ?? null,
      away_team: teamsById[g.away_team] ?? null,
    }))

    return NextResponse.json({ rows, season, week })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unknown server error' },
      { status: 500 }
    )
  }
}

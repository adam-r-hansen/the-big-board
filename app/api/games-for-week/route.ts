// app/api/games-for-week/route.ts
import { NextRequest, NextResponse } from 'next/server'
// Use a RELATIVE import to avoid alias resolution issues in build
import { createClient } from '../../../lib/supabase/server'

// NOTE: This route is AUTH-OPTIONAL (public scoreboard).
// It returns games for a given season & week with joined team metadata.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    // Be tolerant of missing params; default to current UTC year & week 1
    const seasonParam = url.searchParams.get('season')
    const weekParam = url.searchParams.get('week')

    const season = Number(seasonParam ?? new Date().getUTCFullYear())
    const week = Number(weekParam ?? 1)

    const supabase = await createClient() // your helper returns a Promise<SupabaseClient>

    // 1) Pull games
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
      // Return a well-formed empty payload (the page expects `rows`)
      return NextResponse.json({ rows: [], season, week })
    }

    // 2) Join team metadata in one round-trip
    const ids = Array.from(
      new Set(
        games
          .flatMap((g: any) => [g.home_team, g.away_team])
          .filter((x: any) => !!x)
      )
    )

    let teamsById: Record<string, any> = {}
    if (ids.length > 0) {
      const { data: teams, error: tErr } = await supabase
        .from('teams')
        .select(
          'id, abbreviation, short_name, name, color_primary, color_secondary'
        )
        .in('id', ids)

      if (tErr) {
        return NextResponse.json({ error: tErr.message }, { status: 500 })
      }

      teamsById = Object.fromEntries((teams ?? []).map((t: any) => [t.id, t]))
    }

    // 3) Shape the response the UI expects
    const rows = games.map((g: any) => ({
      id: g.id,
      season: g.season,
      week: g.week,
      game_utc: g.game_utc,
      status: g.status, // 'UPCOMING' | 'LIVE' | 'FINAL'
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

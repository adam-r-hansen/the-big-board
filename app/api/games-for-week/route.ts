import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const season = Number(u.searchParams.get('season'))
  const week = Number(u.searchParams.get('week'))
  if (!season || !week) {
    return NextResponse.json({ error: 'season & week required' }, { status: 400 })
  }

  const sb = await createClient()

  // 1) games for the requested week
  const { data: games, error: gErr } = await sb
    .from('games')
    .select('id, game_utc, week, home_team, away_team, home_score, away_score')
    .eq('season', season).eq('week', week)
    .order('game_utc', { ascending: true })

  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!games || games.length === 0) return NextResponse.json({ games: [] })

  // 2) teams referenced in those games — alias to consistent names the UI expects
  const teamIds = Array.from(new Set(games.flatMap(g => [g.home_team, g.away_team]).filter(Boolean)))
  const { data: teams, error: tErr } = await sb
    .from('teams')
    .select(`
      id,
      name,
      abbreviation,
      primary_color:color_primary,
      secondary_color:color_secondary,
      tertiary_color:color_tertiary,
      quaternary_color:color_quaternary,
      logo,
      logo_dark
    `)
    .in('id', teamIds as string[])

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  const byId = new Map((teams ?? []).map(t => [t.id, t]))

  // 3) embed teams into each game
  const shaped = games.map(g => ({
    id: g.id,
    game_utc: g.game_utc,
    week: g.week,
    home_score: g.home_score,
    away_score: g.away_score,
    home: byId.get(g.home_team) ?? { id: g.home_team, name: 'TBD', abbreviation: 'TBD' },
    away: byId.get(g.away_team) ?? { id: g.away_team, name: 'TBD', abbreviation: 'TBD' },
  }))

  return NextResponse.json({ games: shaped })
}

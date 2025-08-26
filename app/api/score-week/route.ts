import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

function resultFor(teamScore: number|null, oppScore: number|null) {
  if (teamScore == null || oppScore == null) return { pts: 0, note: 'no-score' }
  if (teamScore > oppScore) return { pts: teamScore, note: 'win' }
  if (teamScore < oppScore) return { pts: 0, note: 'loss' }
  // tie
  return { pts: teamScore / 2, note: 'tie' }
}

export async function POST(req: NextRequest) {
  const u = new URL(req.url)
  const leagueId = u.searchParams.get('leagueId') || (await req.json().catch(()=>({}))).leagueId
  const season = Number(u.searchParams.get('season')) || (await req.json().catch(()=>({}))).season
  const week = Number(u.searchParams.get('week')) || (await req.json().catch(()=>({}))).week
  if (!leagueId || !season || !week) return NextResponse.json({ error: 'leagueId, season, week required' }, { status: 400 })

  const sb = supabaseServer()

  // Pull picks + game scores
  const { data: picks, error: ep } = await sb
    .from('picks')
    .select(`
      id, profile_id, team_id, game_id,
      games!inner ( id, home_team, away_team, home_score, away_score )
    `)
    .eq('league_id', leagueId).eq('season', season).eq('week', week)

  if (ep) return NextResponse.json({ error: ep.message }, { status: 500 })
  if (!picks || picks.length === 0) return NextResponse.json({ upserts: 0, note: 'no picks' })

  // Compute per-pick points
  const perUser: Record<string, number> = {}
  for (const p of picks) {
    const g = (p as any).games
    if (!g) continue
    const isHome = g.home_team === p.team_id
    const teamScore = isHome ? g.home_score : g.away_score
    const oppScore  = isHome ? g.away_score : g.home_score

    const { pts } = resultFor(
      typeof teamScore === 'number' ? teamScore : (teamScore == null ? null : Number(teamScore)),
      typeof oppScore  === 'number' ? oppScore  : (oppScore  == null ? null : Number(oppScore))
    )

    perUser[p.profile_id] = (perUser[p.profile_id] ?? 0) + pts
  }

  // Upsert weekly_points
  const weeklyRows = Object.entries(perUser).map(([profile_id, points]) => ({
    league_id: leagueId, season, week, profile_id, points
  }))
  if (weeklyRows.length === 0) return NextResponse.json({ upserts: 0, note: 'no scores available' })

  const { data: wp, error: ewp } = await sb
    .from('weekly_points')
    .upsert(weeklyRows, { onConflict: 'league_id,season,week,profile_id' })
    .select('id')

  if (ewp) return NextResponse.json({ error: ewp.message }, { status: 500 })

  // Recompute season_points from weekly_points
  const { data: sums, error: es } = await sb.rpc('sum_season_points', { in_league: leagueId, in_season: season })
  if (es && es.message?.includes('function sum_season_points')) {
    // helper not present yet: compute here in-line
    const { data: allWp } = await sb.from('weekly_points')
      .select('profile_id, points').eq('league_id', leagueId).eq('season', season)
    const agg: Record<string, number> = {}
    for (const row of allWp ?? []) agg[row.profile_id] = (agg[row.profile_id] ?? 0) + (row.points ?? 0)
    const seasonRows = Object.entries(agg).map(([profile_id, points]) => ({ league_id: leagueId, season, profile_id, points }))
    await sb.from('season_points').upsert(seasonRows, { onConflict: 'league_id,season,profile_id' })
  } else if (!es && sums) {
    // RPC wrote directly (see SQL below if you add it)
  }

  return NextResponse.json({ upserts: wp?.length ?? 0 })
}

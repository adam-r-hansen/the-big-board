import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const profileId = searchParams.get('profileId')
  const season = Number(searchParams.get('season') || new Date().getFullYear())

  if (!leagueId || !profileId) {
    return NextResponse.json({ error: 'leagueId and profileId required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get all picks for this player in this league/season
  const { data: picks, error: picksErr } = await supabase
    .from('picks')
    .select('id, team_id, game_id, week')
    .eq('league_id', leagueId)
    .eq('profile_id', profileId)
    .eq('season', season)

  if (picksErr) return NextResponse.json({ error: picksErr.message }, { status: 500 })

  // Get wrinkle picks
  const { data: wrinkleDefs, error: wDefErr } = await supabase
    .from('wrinkles')
    .select('id')
    .eq('league_id', leagueId)
    .eq('season', season)
  if (wDefErr) return NextResponse.json({ error: wDefErr.message }, { status: 500 })

  const wrinkleIds = (wrinkleDefs ?? []).map((w: any) => w.id)
  let wrinklePicks: any[] = []
  if (wrinkleIds.length) {
    const { data: wpRows, error: wpErr } = await supabase
      .from('wrinkle_picks')
      .select('id, team_id, game_id, wrinkle_id')
      .in('wrinkle_id', wrinkleIds)
      .eq('profile_id', profileId)
    if (!wpErr) wrinklePicks = wpRows ?? []
  }

  const allPicks = [...(picks ?? []), ...wrinklePicks]
  const gameIds = Array.from(new Set(allPicks.map(p => p.game_id).filter(Boolean))) as string[]

  let gamesById = new Map<string, any>()
  if (gameIds.length) {
    const { data: g, error: gErr } = await supabase
      .from('games')
      .select('id, week, home_team, away_team, home_score, away_score, status')
      .in('id', gameIds)
    if (!gErr) gamesById = new Map((g || []).map((x: any) => [x.id, x]))
  }

  function pickPoints(teamId: string, g: any): number | null {
    if (!g) return null
    const s = (g.status || '').toUpperCase()
    if (s !== 'FINAL') return null
    const hs = g.home_score ?? null
    const as = g.away_score ?? null
    if (hs == null || as == null) return 0
    if (hs === as) {
      if (g.home_team === teamId) return hs / 2
      if (g.away_team === teamId) return as / 2
      return 0
    }
    if (hs > as) return g.home_team === teamId ? hs : 0
    return g.away_team === teamId ? as : 0
  }

  // Calculate stats for this player
  let totalPoints = 0
  let decidedPicks = 0
  let correctPicks = 0
  let longestStreak = 0
  let currentStreak = 0
  const weeklyPoints = new Map<number, number>()

  for (const p of allPicks) {
    const g = p.game_id ? gamesById.get(p.game_id) : undefined
    const pts = pickPoints(p.team_id, g)

    if (typeof pts === 'number') {
      totalPoints += pts
      decidedPicks++

      if (pts > 0) {
        correctPicks++
        currentStreak++
        if (currentStreak > longestStreak) longestStreak = currentStreak
      } else {
        currentStreak = 0
      }

      // Track weekly points
      const week = g?.week ?? (picks ?? []).find((pk: any) => pk.id === p.id)?.week ?? 0
      if (week > 0) {
        weeklyPoints.set(week, (weeklyPoints.get(week) ?? 0) + pts)
      }
    }
  }

  const accuracy = decidedPicks > 0 ? correctPicks / decidedPicks : 0
  const avgPerPick = decidedPicks > 0 ? totalPoints / decidedPicks : 0

  // Points per week average (all weeks)
  const weeks = Array.from(weeklyPoints.keys()).sort((a, b) => a - b)
  const avgPerWeek = weeks.length > 0 
    ? Array.from(weeklyPoints.values()).reduce((acc, v) => acc + v, 0) / weeks.length 
    : 0

  // Points per week average (last 3 weeks)
  const last3Weeks = weeks.slice(-3)
  const avgLast3Weeks = last3Weeks.length > 0
    ? last3Weeks.reduce((acc, w) => acc + (weeklyPoints.get(w) ?? 0), 0) / last3Weeks.length
    : 0

  // Get ALL players' points to calculate points behind leader
  const { data: allPicksData, error: allPicksErr } = await supabase
    .from('picks')
    .select('profile_id, team_id, game_id')
    .eq('league_id', leagueId)
    .eq('season', season)

  let leaderPoints = totalPoints

  if (!allPicksErr && allPicksData) {
    // Also get all wrinkle picks for all players
    let allWrinklePicks: any[] = []
    if (wrinkleIds.length) {
      const { data: allWpRows, error: allWpErr } = await supabase
        .from('wrinkle_picks')
        .select('profile_id, team_id, game_id')
        .in('wrinkle_id', wrinkleIds)
      if (!allWpErr) allWrinklePicks = allWpRows ?? []
    }

    const allPlayerPicks = [...allPicksData, ...allWrinklePicks]
    const profilePoints = new Map<string, number>()
    
    for (const pick of allPlayerPicks) {
      const g = pick.game_id ? gamesById.get(pick.game_id) : undefined
      const pts = pickPoints(pick.team_id, g)
      if (typeof pts === 'number') {
        profilePoints.set(pick.profile_id, (profilePoints.get(pick.profile_id) ?? 0) + pts)
      }
    }

    // Find the max points (leader)
    const allPoints = Array.from(profilePoints.values())
    if (allPoints.length > 0) {
      leaderPoints = Math.max(...allPoints)
    }
  }

  const pointsBehind = leaderPoints - totalPoints

  return NextResponse.json({
    totalPoints,
    decidedPicks,
    correctPicks,
    accuracy: Number((accuracy * 100).toFixed(1)),
    avgPerPick: Number(avgPerPick.toFixed(1)),
    longestStreak,
    avgPerWeek: Number(avgPerWeek.toFixed(1)),
    avgLast3Weeks: Number(avgLast3Weeks.toFixed(1)),
    pointsBehind,
  })
}

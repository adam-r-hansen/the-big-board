// app/api/league-member-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

type GameRow = {
  id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string | null
  game_utc: string | null
}

function isCorrect(g: GameRow, teamId: string): boolean {
  if (g.status !== 'FINAL') return false
  const hs = Number(g.home_score ?? 0)
  const as = Number(g.away_score ?? 0)
  if (hs === as) return false
  return (teamId === g.home_team && hs > as) || (teamId === g.away_team && as > hs)
}

function pointsFor(g: GameRow, teamId: string): number | null {
  if (g.status !== 'FINAL') return null
  const hs = Number(g.home_score ?? 0)
  const as = Number(g.away_score ?? 0)
  if (hs === as) {
    if (teamId === g.home_team || teamId === g.away_team) return hs / 2
    return 0
  }
  if (teamId === g.home_team && hs > as) return hs
  if (teamId === g.away_team && as > hs) return as
  return 0
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const leagueId = sp.get('leagueId') || ''
  const season = Number(sp.get('season') || '0')

  if (!leagueId || !season) {
    return NextResponse.json({ error: 'leagueId and season required' }, { status: 400 })
  }

  const service = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false }
  })

  // Get members
  const { data: memberData } = await service.rpc('get_league_member_ids', {
    p_league_id: leagueId
  })
  const memberIds: string[] = (memberData ?? []).map((r: any) => r.profile_id)

  if (memberIds.length === 0) {
    return NextResponse.json({ members: [] })
  }

  // Get profiles
  const { data: profiles } = await service
    .from('profiles')
    .select('id, display_name, email')
    .in('id', memberIds)

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [
      p.id,
      { display_name: p.display_name, email: p.email }
    ])
  )

  // Get all wrinkles for this league/season to check for winless_double
  const { data: wrinkles } = await service
    .from('wrinkles')
    .select('id, week, kind')
    .eq('league_id', leagueId)
    .eq('season', season)

  const wrinklesByWeek = new Map<number, { id: string; kind: string }[]>()
  for (const w of wrinkles ?? []) {
    if (!wrinklesByWeek.has(w.week)) {
      wrinklesByWeek.set(w.week, [])
    }
    wrinklesByWeek.get(w.week)!.push({ id: w.id, kind: w.kind })
  }

  // Get picks
  const { data: picks } = await service
    .from('picks')
    .select('id, profile_id, team_id, game_id, week')
    .eq('league_id', leagueId)
    .eq('season', season)

  // Get wrinkle picks with kind
  const wrinkleMap = new Map((wrinkles ?? []).map((w: any) => [w.id, { week: w.week, kind: w.kind }]))

  const { data: wp } = await service
    .from('wrinkle_picks')
    .select('id, profile_id, team_id, game_id, wrinkle_id')

  const wrinklePicks = (wp ?? [])
    .filter((p: any) => wrinkleMap.has(p.wrinkle_id))
    .map((p: any) => {
      const wr = wrinkleMap.get(p.wrinkle_id)!
      return {
        id: p.id,
        profile_id: p.profile_id,
        team_id: p.team_id,
        game_id: p.game_id,
        week: wr.week,
        wrinkle: true,
        wrinkle_kind: wr.kind
      }
    })

  const allPicks = [
    ...(picks ?? []).map((p: any) => {
      // Check if this week has a winless_double wrinkle
      const weekWrinkles = wrinklesByWeek.get(p.week) || []
      const winlessDouble = weekWrinkles.find(w => w.kind === 'winless_double')
      
      return {
        ...p,
        wrinkle: !!winlessDouble,
        wrinkle_kind: winlessDouble?.kind
      }
    }),
    ...wrinklePicks
  ]

  // Get games
  const gameIds = Array.from(
    new Set(allPicks.map((p: any) => p.game_id).filter(Boolean))
  ) as string[]

  const { data: games } = await service
    .from('games')
    .select('id, home_team, away_team, home_score, away_score, status, game_utc')
    .in('id', gameIds)

  const gamesMap = new Map((games ?? []).map((g: any) => [g.id, g as GameRow]))

  // Calculate stats for each member
  const members = memberIds.map(mid => {
    const prof = profileMap.get(mid)
    const displayName = prof?.display_name || prof?.email?.split('@')[0] || 'Member'

    const memberPicks = allPicks.filter((p: any) => p.profile_id === mid)
    const finalPicks = memberPicks
      .map((p: any) => {
        const g = gamesMap.get(p.game_id)
        return { ...p, game: g }
      })
      .filter((p: any) => p.game && p.game.status === 'FINAL')

    // Sort by game date for streak/last 5 calculations
    const sortedFinals = [...finalPicks].sort((a: any, b: any) => {
      const aDate = a.game?.game_utc || ''
      const bDate = b.game?.game_utc || ''
      return aDate.localeCompare(bDate)
    })

    const decided = finalPicks.length
    const correct = sortedFinals.filter((p: any) => isCorrect(p.game, p.team_id)).length
    const accuracy = decided > 0 ? correct / decided : 0

    const pointsTotal = sortedFinals.reduce(
      (sum: number, p: any) => sum + (pointsFor(p.game, p.team_id) || 0),
      0
    )
    const avgPerPick = decided > 0 ? pointsTotal / decided : 0

    // Calculate longest streak
    let longestStreak = 0
    let currentStreak = 0
    for (const p of sortedFinals) {
      if (isCorrect(p.game, p.team_id)) {
        currentStreak++
        if (currentStreak > longestStreak) longestStreak = currentStreak
      } else {
        currentStreak = 0
      }
    }

    // Calculate last 5 games
    const last5 = sortedFinals.slice(-5).map((p: any) => 
      isCorrect(p.game, p.team_id) ? 'W' : 'L'
    )

    // FIXED: Wrinkle points calculation
    const wrinklePoints = sortedFinals
      .filter((p: any) => p.wrinkle)
      .reduce((sum: number, p: any) => {
        const pts = pointsFor(p.game, p.team_id) || 0
        // For winless_double, only count half (the base points)
        if (p.wrinkle_kind === 'winless_double') {
          return sum + (pts / 2)
        }
        // For other wrinkles, count full points
        return sum + pts
      }, 0)

    return {
      profile_id: mid,
      display_name: displayName,
      total_picks: decided,
      decided_picks: decided,
      correct_picks: correct,
      accuracy: Number(accuracy.toFixed(3)),
      points_total: Number(pointsTotal.toFixed(1)),
      avg_per_pick: Number(avgPerPick.toFixed(2)),
      longest_streak: longestStreak,
      current_streak: currentStreak,
      wrinkle_points: Number(wrinklePoints.toFixed(1)),
      last_5: last5
    }
  })

  // Sort by points total descending
  members.sort((a, b) => b.points_total - a.points_total)

  return NextResponse.json({ members })
}

// app/api/playoffs/calculate-scores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

async function getClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

/**
 * POST /api/playoffs/calculate-scores
 * Body: { roundId }
 * Calculates scores for all picks in a playoff round and updates playoff_standings
 */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const roundId = body.roundId

  if (!roundId) return j({ error: 'roundId required' }, 400)

  // Get round info
  const { data: round } = await supabase
    .from('playoff_rounds')
    .select('id, league_id, week_number, round_type')
    .eq('id', roundId)
    .maybeSingle()

  if (!round) return j({ error: 'round not found' }, 404)

  // Check if user is admin
  const { data: member } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', round.league_id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'owner'].includes(member.role)) {
    return j({ error: 'admin access required' }, 403)
  }

  // Get all picks for this round
  const { data: picks } = await supabase
    .from('playoff_picks')
    .select('league_membership_id, game_id, team_id, pick_position')
    .eq('playoff_round_id', roundId)
    .not('game_id', 'is', null)
    .not('team_id', 'is', null)

  if (!picks || picks.length === 0) {
    return j({ message: 'no picks found for this round', standings: [] }, 200)
  }

  // Get all games for these picks
  const gameIds = [...new Set(picks.map(p => p.game_id).filter(Boolean))]
  
  const { data: games } = await supabase
    .from('games')
    .select('id, home_team, away_team, home_score, away_score, status')
    .in('id', gameIds)

  const gamesMap = new Map((games || []).map(g => [g.id, g]))

  // Calculate scores by membership (same logic as regular season)
  const scoresByMembership = new Map<string, number>()

  for (const pick of picks) {
    const game = gamesMap.get(pick.game_id)
    if (!game || game.status !== 'FINAL') continue

    const isHome = game.home_team === pick.team_id
    const isAway = game.away_team === pick.team_id
    const homeScore = game.home_score ?? 0
    const awayScore = game.away_score ?? 0

    let points = 0

    // Team won = earn their final score
    if (isHome && homeScore > awayScore) {
      points = homeScore
    } else if (isAway && awayScore > homeScore) {
      points = awayScore
    }
    // Loss or tie = 0 points

    const currentScore = scoresByMembership.get(pick.league_membership_id) || 0
    scoresByMembership.set(pick.league_membership_id, currentScore + points)
  }

  // Update playoff_standings
  for (const [membershipId, totalScore] of scoresByMembership.entries()) {
    await supabase
      .from('playoff_standings')
      .update({ total_score: totalScore })
      .eq('playoff_round_id', roundId)
      .eq('league_membership_id', membershipId)
  }

  // Get updated standings and rank them
  const { data: standings } = await supabase
    .from('playoff_standings')
    .select('*')
    .eq('playoff_round_id', roundId)
    .order('total_score', { ascending: false })

  // Update ranks based on score
  if (standings) {
    for (let i = 0; i < standings.length; i++) {
      await supabase
        .from('playoff_standings')
        .update({ rank: i + 1 })
        .eq('id', standings[i].id)
    }
  }

  return j({ 
    ok: true, 
    standings: standings || []
  }, 200)
}

// app/api/playoffs/init-round/route.ts
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

// Calculate unlock times for snake draft
// Snake order for Week 17: 1-1-2-3-4-1-2-3-4 (9 unlock windows)
// Snake order for Week 18: 1-2-1-2-1-2-1-2 (8 unlock windows)
function calculateUnlockTimes(roundType: 'semifinal' | 'championship', weekNumber: number) {
  const baseDate = new Date()
  
  // Find next Tuesday at 9am ET
  const dayOfWeek = baseDate.getDay()
  const daysUntilTuesday = dayOfWeek <= 2 ? 2 - dayOfWeek : 9 - dayOfWeek
  const tuesday = new Date(baseDate)
  tuesday.setDate(tuesday.getDate() + daysUntilTuesday)
  tuesday.setHours(9, 0, 0, 0) // 9am
  
  const unlockSchedule: Array<{ seed: number; pickPosition: number; unlockTime: Date }> = []
  
  if (roundType === 'semifinal') {
    // Week 17 snake: 1-1-2-3-4-1-2-3-4
    const snakeOrder = [1, 1, 2, 3, 4, 1, 2, 3, 4]
    const pickPositions = [1, 2, 1, 1, 1, 3, 2, 2, 2] // Which pick number for each seed
    
    let currentTime = new Date(tuesday)
    
    for (let i = 0; i < snakeOrder.length; i++) {
      // Apply sleep mode (8pm-9am = 13 hours)
      const hour = currentTime.getHours()
      if (hour >= 20) { // After 8pm
        currentTime.setDate(currentTime.getDate() + 1)
        currentTime.setHours(9, 0, 0, 0)
      }
      
      unlockSchedule.push({
        seed: snakeOrder[i],
        pickPosition: pickPositions[i],
        unlockTime: new Date(currentTime)
      })
      
      // Add 3 hours for next unlock
      currentTime = new Date(currentTime.getTime() + 3 * 60 * 60 * 1000)
    }
  } else {
    // Week 18 championship snake: 1-2-1-2-1-2-1-2
    const snakeOrder = [1, 2, 1, 2, 1, 2, 1, 2]
    const pickPositions = [1, 1, 2, 2, 3, 3, 4, 4]
    
    let currentTime = new Date(tuesday)
    
    for (let i = 0; i < snakeOrder.length; i++) {
      const hour = currentTime.getHours()
      if (hour >= 20) {
        currentTime.setDate(currentTime.getDate() + 1)
        currentTime.setHours(9, 0, 0, 0)
      }
      
      unlockSchedule.push({
        seed: snakeOrder[i],
        pickPosition: pickPositions[i],
        unlockTime: new Date(currentTime)
      })
      
      currentTime = new Date(currentTime.getTime() + 3 * 60 * 60 * 1000)
    }
  }
  
  return unlockSchedule
}

/**
 * POST /api/playoffs/init-round
 * Body: { leagueId, weekNumber }
 * Initializes a playoff round by:
 * 1. Getting regular season standings (for Week 17) or Week 17 results (for Week 18)
 * 2. Determining top seeds
 * 3. Creating playoff_round
 * 4. Creating playoff_standings with seeds
 * 5. Creating placeholder playoff_picks with unlock times
 */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const leagueId = body.leagueId
  const weekNumber = body.weekNumber

  if (!leagueId || ![17, 18].includes(weekNumber)) {
    return j({ error: 'leagueId and weekNumber (17 or 18) required' }, 400)
  }

  // Check if user is admin
  const { data: member } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'owner'].includes(member.role)) {
    return j({ error: 'admin access required' }, 403)
  }

  // Get playoff settings
  const { data: settings } = await supabase
    .from('playoff_settings')
    .select('enabled, regular_season_weeks')
    .eq('league_id', leagueId)
    .maybeSingle()

  if (!settings?.enabled) {
    return j({ error: 'playoffs not enabled for this league' }, 400)
  }

  const regularSeasonWeeks = settings.regular_season_weeks || 16

  // Determine seeds based on week number
  let topSeeds: Array<{ membershipId: string; seed: number; score: number }> = []

  if (weekNumber === 17) {
    // Use regular season standings (weeks 1-16)
    // We'll call the existing /api/standings logic but inline here for now
    
    // Get all league memberships
    const { data: memberships } = await supabase
      .from('league_memberships')
      .select('id, profile_id')
      .eq('league_id', leagueId)

    if (!memberships || memberships.length === 0) {
      return j({ error: 'no league members found' }, 400)
    }

    // Get all picks for weeks 1-16
    const { data: picks } = await supabase
      .from('picks')
      .select('profile_id, team_id, game_id')
      .eq('league_id', leagueId)
      .lte('week', regularSeasonWeeks)

    // Get all wrinkle picks
    const { data: wrinklePicks } = await supabase
      .from('wrinkle_picks')
      .select('profile_id, team_id, game_id, wrinkle_id')
      .eq('league_id', leagueId)

    // Get games
    const gameIds = [
      ...(picks || []).map(p => p.game_id).filter(Boolean),
      ...(wrinklePicks || []).map(p => p.game_id).filter(Boolean)
    ]
    
    const { data: games } = await supabase
      .from('games')
      .select('id, home_team, away_team, home_score, away_score, status')
      .in('id', gameIds)

    const gamesMap = new Map(( games || []).map(g => [g.id, g]))

    // Calculate scores for each membership
    const standings = memberships.map(m => {
      const myPicks = (picks || []).filter(p => p.profile_id === m.profile_id)
      const myWrinkles = (wrinklePicks || []).filter(p => p.profile_id === m.profile_id)

      let totalPoints = 0
      let correct = 0
      let longestStreak = 0
      let currentStreak = 0
      let wrinklePoints = 0

      const allPicks = [...myPicks, ...myWrinkles]

      for (const pick of allPicks) {
        const game = gamesMap.get(pick.game_id)
        if (!game || game.status !== 'FINAL') continue

        const isHome = game.home_team === pick.team_id
        const isAway = game.away_team === pick.team_id
        const homeScore = game.home_score ?? 0
        const awayScore = game.away_score ?? 0

        let won = false
        let points = 0

        if (isHome && homeScore > awayScore) {
          won = true
          points = homeScore
        } else if (isAway && awayScore > homeScore) {
          won = true
          points = awayScore
        }

        if (won) {
          correct++
          currentStreak++
          longestStreak = Math.max(longestStreak, currentStreak)
        } else {
          currentStreak = 0
        }

        totalPoints += points
        if (myWrinkles.includes(pick as any)) {
          wrinklePoints += points
        }
      }

      return {
        membershipId: m.id,
        profileId: m.profile_id,
        points: totalPoints,
        correct,
        longestStreak,
        wrinklePoints
      }
    })

    // Sort by playoff tiebreakers
    standings.sort((a, b) =>
      (b.points - a.points) ||
      (b.correct - a.correct) ||
      (b.longestStreak - a.longestStreak) ||
      (b.wrinklePoints - a.wrinklePoints)
    )

    // Top 4 make playoffs
    topSeeds = standings.slice(0, 4).map((s, idx) => ({
      membershipId: s.membershipId,
      seed: idx + 1,
      score: s.points
    }))

  } else {
    // Week 18 - use Week 17 playoff results
    const { data: week17Round } = await supabase
      .from('playoff_rounds')
      .select('id')
      .eq('league_id', leagueId)
      .eq('week_number', 17)
      .eq('round_type', 'semifinal')
      .maybeSingle()

    if (!week17Round) {
      return j({ error: 'Week 17 round not found' }, 400)
    }

    const { data: week17Standings } = await supabase
      .from('playoff_standings')
      .select('*')
      .eq('playoff_round_id', week17Round.id)
      .order('rank', { ascending: true })

    if (!week17Standings || week17Standings.length < 2) {
      return j({ error: 'Week 17 standings not complete' }, 400)
    }

    // Top 2 from Week 17 advance to championship
    topSeeds = week17Standings.slice(0, 2).map((s, idx) => ({
      membershipId: s.league_membership_id,
      seed: idx + 1,
      score: s.total_score
    }))
  }

  if (topSeeds.length === 0) {
    return j({ error: 'no playoff participants found' }, 400)
  }

  // Create playoff round
  const roundType = weekNumber === 17 ? 'semifinal' : 'championship'
  
  const { data: round, error: roundErr } = await supabase
    .from('playoff_rounds')
    .insert({
      league_id: leagueId,
      week_number: weekNumber,
      round_type: roundType,
      status: 'active'
    })
    .select()
    .single()

  if (roundErr) return j({ error: roundErr.message }, 400)

  // Create playoff standings
  const standingsData = topSeeds.map(s => ({
    playoff_round_id: round.id,
    league_membership_id: s.membershipId,
    rank: s.seed,
    total_score: 0, // Will be calculated as picks are scored
    seed: s.seed
  }))

  const { error: standingsErr } = await supabase
    .from('playoff_standings')
    .insert(standingsData)

  if (standingsErr) return j({ error: standingsErr.message }, 400)

  // Calculate unlock schedule
  const unlockSchedule = calculateUnlockTimes(roundType, weekNumber)

  // Create placeholder picks with unlock times
  const picksData: any[] = []

  for (const seed of topSeeds) {
    const seedUnlocks = unlockSchedule.filter(u => u.seed === seed.seed)
    
    for (const unlock of seedUnlocks) {
      picksData.push({
        league_membership_id: seed.membershipId,
        playoff_round_id: round.id,
        pick_position: unlock.pickPosition,
        unlock_time: unlock.unlockTime.toISOString(),
        game_id: null, // Will be set when user makes pick
        picked_at: null,
        last_changed_at: null,
        is_tiebreaker: false
      })
    }
  }

  const { error: picksErr } = await supabase
    .from('playoff_picks')
    .insert(picksData)

  if (picksErr) return j({ error: picksErr.message }, 400)

  return j({ 
    ok: true, 
    round, 
    topSeeds,
    unlockSchedule: unlockSchedule.map(u => ({
      seed: u.seed,
      pickPosition: u.pickPosition,
      unlockTime: u.unlockTime.toISOString()
    }))
  }, 201)
}

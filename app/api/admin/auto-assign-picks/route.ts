// app/api/admin/auto-assign-picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AssignmentResult = {
  userId: string
  displayName: string
  picksAssigned: number
  teams: string[]
}

type LeagueResult = {
  leagueName: string
  assignments: AssignmentResult[]
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  })
}

// Helper: Get available teams for a user (teams they haven't picked yet this season)
async function getAvailableTeams(
  supabase: any,
  userId: string,
  leagueId: string,
  season: number
): Promise<string[]> {
  // Get all teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id')
    .order('abbreviation')

  if (!allTeams) return []

  // Get teams user has already picked this season
  const { data: userPicks } = await supabase
    .from('picks')
    .select('team_id')
    .eq('league_id', leagueId)
    .eq('profile_id', userId)
    .eq('season', season)

  const usedTeamIds = new Set((userPicks || []).map((p: any) => p.team_id))
  
  return allTeams
    .map((t: any) => t.id)
    .filter((teamId: string) => !usedTeamIds.has(teamId))
}

// Helper: Get teams that lost their game (0 points) this week
async function getLosingTeams(
  supabase: any,
  week: number,
  season: number,
  availableTeams: string[]
): Promise<string[]> {
  if (availableTeams.length === 0) return []

  const { data: games } = await supabase
    .from('games')
    .select('id, home_team, away_team, home_score, away_score, status')
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'FINAL')

  if (!games) return []

  const losingTeams: string[] = []

  for (const game of games) {
    const homeScore = game.home_score ?? 0
    const awayScore = game.away_score ?? 0

    // Skip ties
    if (homeScore === awayScore) continue

    // Add losing team if it's in available teams
    if (homeScore < awayScore && availableTeams.includes(game.home_team)) {
      losingTeams.push(game.home_team)
    }
    if (awayScore < homeScore && availableTeams.includes(game.away_team)) {
      losingTeams.push(game.away_team)
    }
  }

  return losingTeams
}

// Helper: Get lowest-scoring team from available teams
async function getLowestScoringTeam(
  supabase: any,
  week: number,
  season: number,
  availableTeams: string[]
): Promise<string | null> {
  if (availableTeams.length === 0) return null

  const { data: games } = await supabase
    .from('games')
    .select('id, home_team, away_team, home_score, away_score, status')
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'FINAL')

  if (!games) return null

  type TeamScore = { teamId: string; points: number }
  const teamScores: TeamScore[] = []

  for (const game of games) {
    const homeScore = game.home_score ?? 0
    const awayScore = game.away_score ?? 0

    // Calculate points based on your scoring rules
    let homePoints = 0
    let awayPoints = 0

    if (homeScore > awayScore) {
      homePoints = homeScore // Win
      awayPoints = 0 // Loss
    } else if (awayScore > homeScore) {
      awayPoints = awayScore // Win
      homePoints = 0 // Loss
    } else {
      // Tie - half points
      homePoints = homeScore / 2
      awayPoints = awayScore / 2
    }

    if (availableTeams.includes(game.home_team)) {
      teamScores.push({ teamId: game.home_team, points: homePoints })
    }
    if (availableTeams.includes(game.away_team)) {
      teamScores.push({ teamId: game.away_team, points: awayPoints })
    }
  }

  if (teamScores.length === 0) return null

  // Sort by points ascending, return lowest
  teamScores.sort((a, b) => a.points - b.points)
  return teamScores[0].teamId
}

// Helper: Get game ID for a team in a specific week
async function getGameForTeam(
  supabase: any,
  teamId: string,
  week: number,
  season: number
): Promise<string | null> {
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('season', season)
    .eq('week', week)
    .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
    .maybeSingle()

  return game?.id || null
}

// Main POST handler
export async function POST(req: NextRequest) {
  try {
    // Check for API key auth (for GitHub Actions)
    const apiKey = req.headers.get('x-api-key')
    const validApiKey = process.env.ADMIN_API_KEY
    
    let supabase
    let isApiKeyAuth = false
    
    if (apiKey && validApiKey && apiKey === validApiKey) {
      // API Key authentication - use service role
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
      isApiKeyAuth = true
    } else {
      // Regular session-based auth
      supabase = await createClient()
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) {
        return json({ error: 'Unauthorized' }, 401)
      }
      // TODO: Add admin role check here if needed
    }

    const body = await req.json()
    const { season, week, leagueId } = body

    if (!season || !week) {
      return json({ error: 'season and week are required' }, 400)
    }

    console.log('[AUTO-ASSIGN] Starting:', { season, week, leagueId })

    // Step 1: Check all games are FINAL
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status')
      .eq('season', season)
      .eq('week', week)

    if (gamesError) {
      return json({ error: gamesError.message }, 500)
    }

    if (!games || games.length === 0) {
      return json({ error: 'No games found for this week' }, 404)
    }

    const allFinal = games.every((g: any) => g.status === 'FINAL')
    if (!allFinal) {
      return json({ error: 'Not all games are FINAL yet' }, 400)
    }

    console.log('[AUTO-ASSIGN] All games FINAL:', games.length)

    // Step 2: Get leagues to process
    let leaguesToProcess: any[] = []
    
    if (leagueId) {
      const { data: league } = await supabase
        .from('leagues')
        .select('id, name, start_week')
        .eq('id', leagueId)
        .eq('season', season)
        .maybeSingle()
      
      if (league) leaguesToProcess = [league]
      console.log('[AUTO-ASSIGN] League found:', league?.name)
    } else {
      const { data: leagues } = await supabase
        .from('leagues')
        .select('id, name, start_week')
        .eq('season', season)
      
      leaguesToProcess = leagues || []
      console.log('[AUTO-ASSIGN] Processing all leagues:', leaguesToProcess.length)
    }

    const processed: Record<string, LeagueResult> = {}
    const errors: string[] = []

    // Step 3: Process each league
    for (const league of leaguesToProcess) {
      try {
        console.log('[AUTO-ASSIGN] Processing league:', league.name)

        // Check if week is in valid range (start_week to 18)
        const startWeek = league.start_week || 1
        const validWeek = week >= startWeek && week <= 18

        if (!validWeek) {
          errors.push(`League ${league.name}: Week ${week} out of range (starts at week ${startWeek})`)
          continue
        }

        // Get all members
        const { data: members } = await supabase
          .from('league_members')
          .select('profile_id')
          .eq('league_id', league.id)

        console.log('[AUTO-ASSIGN] League members:', members?.length || 0)

        if (!members || members.length === 0) continue

        const assignments: AssignmentResult[] = []

        // Step 4: Process each user
        for (const member of members) {
          const userId = member.profile_id

          // Get profile separately to avoid nested typing issues
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', userId)
            .maybeSingle()

          const displayName = profile?.display_name || 'Unknown'

          // Count picks made this week
          const { data: weekPicks } = await supabase
            .from('picks')
            .select('id, team_id, wrinkle_id')
            .eq('league_id', league.id)
            .eq('profile_id', userId)
            .eq('season', season)
            .eq('week', week)

          console.log(`[AUTO-ASSIGN] ${displayName} week ${week} picks:`, weekPicks?.length || 0, weekPicks)

          // Filter out wrinkle picks if wrinkle_id column exists
          const regularPicks = (weekPicks || []).filter((p: any) => !p.wrinkle_id)
          const picksMade = regularPicks.length
          const picksNeeded = Math.max(0, 2 - picksMade)

          console.log(`[AUTO-ASSIGN] ${displayName} needs ${picksNeeded} picks (has ${picksMade} regular picks)`)

          if (picksNeeded === 0) continue

          // Get available teams
          let availableTeams = await getAvailableTeams(supabase, userId, league.id, season)
          
          console.log(`[AUTO-ASSIGN] ${displayName} has ${availableTeams.length} available teams`)

          const teamsAssigned: string[] = []

          for (let i = 0; i < picksNeeded; i++) {
            if (availableTeams.length === 0) break

            let teamToAssign: string | null = null

            // Roll for 95% losing team / 5% lowest scorer
            const roll = Math.floor(Math.random() * 100) + 1

            if (roll <= 95) {
              // Try to get a losing team
              const losingTeams = await getLosingTeams(supabase, week, season, availableTeams)
              if (losingTeams.length > 0) {
                // Pick random losing team
                teamToAssign = losingTeams[Math.floor(Math.random() * losingTeams.length)]
              }
            }

            // If no losing team (either 5% roll or no losers available), get lowest scorer
            if (!teamToAssign) {
              teamToAssign = await getLowestScoringTeam(supabase, week, season, availableTeams)
            }

            if (!teamToAssign) break

            // Get game for this team
            const gameId = await getGameForTeam(supabase, teamToAssign, week, season)

            console.log(`[AUTO-ASSIGN] Assigning team ${teamToAssign} to ${displayName}`)

            // Create the pick
            const { error: pickError } = await supabase
              .from('picks')
              .insert({
                league_id: league.id,
                profile_id: userId,
                season,
                week,
                team_id: teamToAssign,
                game_id: gameId,
                auto_assigned: true
              })

            if (pickError) {
              console.error(`[AUTO-ASSIGN] Error assigning pick:`, pickError)
              errors.push(`Failed to assign pick for ${displayName}: ${pickError.message}`)
              break
            }

            // Get team abbreviation for response
            const { data: team } = await supabase
              .from('teams')
              .select('abbreviation')
              .eq('id', teamToAssign)
              .maybeSingle()

            teamsAssigned.push(team?.abbreviation || teamToAssign)

            // Remove from available teams
            availableTeams = availableTeams.filter(t => t !== teamToAssign)
          }

          if (teamsAssigned.length > 0) {
            assignments.push({
              userId,
              displayName,
              picksAssigned: teamsAssigned.length,
              teams: teamsAssigned
            })
          }
        }

        console.log('[AUTO-ASSIGN] Assignments for league:', assignments.length)

        processed[league.id] = {
          leagueName: league.name,
          assignments
        }

      } catch (err: any) {
        console.error('[AUTO-ASSIGN] League error:', err)
        errors.push(`League ${league.name}: ${err.message}`)
      }
    }

    console.log('[AUTO-ASSIGN] Complete. Processed:', Object.keys(processed).length, 'leagues')

    return json({
      success: true,
      processed,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('[AUTO-ASSIGN] Fatal error:', error)
    return json({ error: error.message }, 500)
  }
}

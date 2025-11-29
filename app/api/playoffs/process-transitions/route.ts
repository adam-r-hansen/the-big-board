// app/api/playoffs/process-transitions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Process playoff transitions
 * Called nightly by GitHub Action (or manually)
 * 
 * Handles:
 * - Week 17 → Week 18 transition (Monday after Week 17)
 * - Week 18 finalization (Monday after Week 18)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current date/time
    const now = new Date()
    const currentYear = now.getFullYear()
    
    // Get all leagues with playoffs enabled
    const { data: playoffSettings, error: settingsError } = await supabase
      .from('playoff_settings')
      .select('league_id, enabled, regular_season_weeks')
      .eq('enabled', true)
    
    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 })
    }
    
    if (!playoffSettings || playoffSettings.length === 0) {
      return NextResponse.json({ message: 'No playoff-enabled leagues found' })
    }
    
    const results: any[] = []
    
    // Process each playoff-enabled league
    for (const setting of playoffSettings) {
      const leagueId = setting.league_id
      
      // Get active playoff rounds for this league
      const { data: activeRounds, error: roundsError } = await supabase
        .from('playoff_rounds')
        .select('*')
        .eq('league_id', leagueId)
        .eq('status', 'active')
      
      if (roundsError) {
        results.push({ leagueId, error: roundsError.message })
        continue
      }
      
      if (!activeRounds || activeRounds.length === 0) {
        // No active rounds - check if we need to start Week 17
        const shouldStartWeek17 = await checkShouldStartWeek17(supabase, leagueId, currentYear)
        
        if (shouldStartWeek17) {
          // Initialize Week 17 semifinals
          const initResult = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/playoffs/init-round`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leagueId,
              weekNumber: 17,
              roundType: 'semifinal'
            })
          }).then(r => r.json())
          
          results.push({ 
            leagueId, 
            action: 'initialized_week_17',
            result: initResult 
          })
        }
        
        continue
      }
      
      // Process each active round
      for (const round of activeRounds) {
        if (round.week_number === 17 && round.round_type === 'semifinal') {
          // Check if Week 17 is complete (all games finished)
          const isComplete = await checkWeekComplete(supabase, currentYear, 17)
          
          if (isComplete) {
            // Week 17 is done - transition to Week 18
            const transitionResult = await transitionToWeek18(supabase, leagueId, round.id)
            results.push({
              leagueId,
              action: 'transitioned_to_week_18',
              result: transitionResult
            })
          }
        } else if (round.week_number === 18) {
          // Check if Week 18 is complete
          const isComplete = await checkWeekComplete(supabase, currentYear, 18)
          
          if (isComplete) {
            // Week 18 is done - finalize playoffs
            const finalizeResult = await finalizePlayoffs(supabase, leagueId, round.id)
            results.push({
              leagueId,
              action: 'finalized_playoffs',
              result: finalizeResult
            })
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    })
    
  } catch (error: any) {
    console.error('Transition error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Check if we should start Week 17 (it's the Monday after Week 16)
async function checkShouldStartWeek17(supabase: any, leagueId: string, season: number): Promise<boolean> {
  const now = new Date()
  
  // Check if all Week 16 games are complete
  const { data: week16Games } = await supabase
    .from('games')
    .select('status')
    .eq('season', season)
    .eq('week', 16)
  
  if (!week16Games || week16Games.length === 0) return false
  
  const allComplete = week16Games.every((g: any) => g.status === 'FINAL')
  
  // Check if it's Monday or later after Week 16
  const isMonday = now.getDay() >= 1
  
  return allComplete && isMonday
}

// Check if all games for a week are complete
async function checkWeekComplete(supabase: any, season: number, week: number): Promise<boolean> {
  const { data: games } = await supabase
    .from('games')
    .select('status')
    .eq('season', season)
    .eq('week', week)
  
  if (!games || games.length === 0) return false
  
  return games.every((g: any) => g.status === 'FINAL')
}

// Transition from Week 17 to Week 18
async function transitionToWeek18(supabase: any, leagueId: string, week17RoundId: string) {
  try {
    // 1. Calculate final Week 17 scores
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/playoffs/calculate-scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundId: week17RoundId
      })
    }).then(r => r.json())
    
    // 2. Mark Week 17 round as complete
    await supabase
      .from('playoff_rounds')
      .update({ status: 'complete' })
      .eq('id', week17RoundId)
    
    // 3. Get Week 17 standings
    const { data: standings } = await supabase
      .from('playoff_standings')
      .select('*')
      .eq('playoff_round_id', week17RoundId)
      .order('rank', { ascending: true })
    
    if (!standings || standings.length < 4) {
      throw new Error('Not enough playoff participants')
    }
    
    // 4. Initialize Week 18 Championship (top 2)
    const championshipResult = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/playoffs/init-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId,
        weekNumber: 18,
        roundType: 'championship'
      })
    }).then(r => r.json())
    
    // 5. Initialize Week 18 Consolation (3rd & 4th)
    const consolationResult = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/playoffs/init-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId,
        weekNumber: 18,
        roundType: 'consolation'
      })
    }).then(r => r.json())
    
    return {
      week17Finalized: true,
      championship: championshipResult,
      consolation: consolationResult
    }
    
  } catch (error: any) {
    throw new Error(`Week 18 transition failed: ${error.message}`)
  }
}

// Finalize playoffs after Week 18
async function finalizePlayoffs(supabase: any, leagueId: string, week18RoundId: string) {
  try {
    // 1. Calculate final Week 18 scores
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/playoffs/calculate-scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundId: week18RoundId
      })
    }).then(r => r.json())
    
    // 2. Mark Week 18 rounds as complete
    const { data: week18Rounds } = await supabase
      .from('playoff_rounds')
      .select('id')
      .eq('league_id', leagueId)
      .eq('week_number', 18)
    
    if (week18Rounds && week18Rounds.length > 0) {
      for (const round of week18Rounds) {
        await supabase
          .from('playoff_rounds')
          .update({ status: 'complete' })
          .eq('id', round.id)
      }
    }
    
    return {
      playoffsFinalized: true,
      roundsCompleted: week18Rounds?.length || 0
    }
    
  } catch (error: any) {
    throw new Error(`Playoff finalization failed: ${error.message}`)
  }
}

// Allow GET for manual testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to process transitions',
    endpoint: '/api/playoffs/process-transitions'
  })
}

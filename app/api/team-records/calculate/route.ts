// app/api/team-records/calculate/route.ts
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

export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: { season?: number; week?: number } = {}
  try {
    body = await req.json()
  } catch {}

  const { season, week } = body

  if (!season || !week) {
    return j({ error: 'season and week required' }, 400)
  }

  try {
    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id')

    if (teamsError) throw new Error(teamsError.message)
    if (!teams || teams.length === 0) {
      return j({ error: 'No teams found' }, 400)
    }

    // Get all completed games up to (but not including) this week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, home_score, away_score, status')
      .eq('season', season)
      .lt('week', week)
      .eq('status', 'FINAL')

    if (gamesError) throw new Error(gamesError.message)

    // Calculate records for each team
    const records: Record<string, { wins: number; losses: number; ties: number }> = {}
    
    // Initialize all teams with 0-0-0
    teams.forEach(team => {
      records[team.id] = { wins: 0, losses: 0, ties: 0 }
    })

    // Process each completed game
    if (games && games.length > 0) {
      games.forEach(game => {
        const homeScore = game.home_score ?? 0
        const awayScore = game.away_score ?? 0

        if (homeScore > awayScore) {
          // Home team wins
          if (records[game.home_team]) records[game.home_team].wins++
          if (records[game.away_team]) records[game.away_team].losses++
        } else if (awayScore > homeScore) {
          // Away team wins
          if (records[game.away_team]) records[game.away_team].wins++
          if (records[game.home_team]) records[game.home_team].losses++
        } else {
          // Tie
          if (records[game.home_team]) records[game.home_team].ties++
          if (records[game.away_team]) records[game.away_team].ties++
        }
      })
    }

    // Prepare records for insertion
    const recordsToInsert = Object.entries(records).map(([teamId, record]) => {
      const totalGames = record.wins + record.losses + record.ties
      const winPct = totalGames > 0 
        ? ((record.wins + (record.ties * 0.5)) / totalGames).toFixed(3)
        : '0.000'

      return {
        team_id: teamId,
        season,
        week,
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        win_pct: parseFloat(winPct),
        updated_at: new Date().toISOString(),
      }
    })

    // Delete existing records for this season/week, then insert new ones
    const { error: deleteError } = await supabase
      .from('team_records')
      .delete()
      .eq('season', season)
      .eq('week', week)

    if (deleteError) throw new Error(deleteError.message)

    const { error: insertError } = await supabase
      .from('team_records')
      .insert(recordsToInsert)

    if (insertError) throw new Error(insertError.message)

    return j({ 
      ok: true, 
      message: `Calculated records for ${recordsToInsert.length} teams`,
      season,
      week,
    })

  } catch (err: any) {
    console.error('Team records calculation error:', err)
    return j({ error: err?.message || 'Failed to calculate team records' }, 500)
  }
}

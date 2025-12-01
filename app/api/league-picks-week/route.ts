// app/api/league-picks-week/route.ts
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

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  const season = Number(searchParams.get('season') || '0')
  const week = Number(searchParams.get('week') || '0')

  if (!leagueId || !season || !week) return j({ error: 'leagueId, season, week required' }, 400)

  // Get all picks for this league/season/week with game status
  const { data: picks, error: picksErr } = await supabase
    .from('picks')
    .select(`
      id,
      profile_id,
      team_id,
      game_id,
      winless_double,
      auto_assigned,
      profiles (
        id,
        display_name,
        email,
        preferred_color
      ),
      games (
        id,
        status,
        game_utc,
        home_team,
        away_team,
        home_score,
        away_score
      )
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)

  if (picksErr) return j({ error: picksErr.message }, 400)

  // Filter to only locked games (LIVE or FINAL) and calculate points
  const rows = (picks || [])
    .filter((p: any) => {
      const game = p.games
      if (!game) return false
      const status = (game.status || '').toUpperCase()
      // Check if game has started (locked)
      if (status === 'LIVE' || status === 'FINAL') return true
      if (game.game_utc && new Date(game.game_utc) <= new Date()) return true
      return false
    })
    .map((p: any) => {
      const game = p.games
      const status = (game.status || '').toUpperCase()
      const profile = p.profiles || {}
      
      // Calculate points
      let points: number | null = null
      if (status === 'FINAL') {
        const homeScore = game.home_score
        const awayScore = game.away_score
        if (typeof homeScore === 'number' && typeof awayScore === 'number') {
          const isHome = p.team_id === game.home_team
          const isAway = p.team_id === game.away_team
          
          if (homeScore === awayScore) {
            // Tie - half points
            points = isHome ? homeScore / 2 : isAway ? awayScore / 2 : 0
          } else if (homeScore > awayScore) {
            // Home won
            points = isHome ? homeScore : 0
          } else {
            // Away won
            points = isAway ? awayScore : 0
          }
          
          // Double points for winless_double
          if (p.winless_double && points !== null) {
            points = points * 2
          }
        }
      }

      return {
        profile_id: p.profile_id,
        display_name: profile.display_name || profile.email?.split('@')[0] || 'Member',
        preferred_color: profile.preferred_color,
        team_id: p.team_id,
        status: status === 'FINAL' ? 'FINAL' : 'LIVE',
        points,
        winless_double: p.winless_double || false,
        auto_assigned: p.auto_assigned || false,
      }
    })

  return j({ rows }, 200)
}

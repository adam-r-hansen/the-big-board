import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type GameRow = {
  id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string | null
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
  const includeLive = sp.get('includeLive') === 'true'

  if (!leagueId || !season) {
    return NextResponse.json({ error: 'leagueId and season required' }, { status: 400 })
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  // Get picks
  const { data: picks, error: picksError } = await service
    .from('picks')
    .select('id, profile_id, team_id, game_id, week, season')
    .eq('league_id', leagueId)
    .eq('season', season)

  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500 })
  }

  // Get wrinkle picks
  const { data: wp } = await service
    .from('wrinkle_picks')
    .select('id, profile_id, team_id, game_id, wrinkle_id')

  const { data: wrinkles } = await service
    .from('wrinkles')
    .select('id, week')
    .eq('league_id', leagueId)
    .eq('season', season)

  const wrinkleMap = new Map((wrinkles ?? []).map((w: any) => [w.id, w.week]))
  const wrinklePicks = (wp ?? [])
    .filter((p: any) => wrinkleMap.has(p.wrinkle_id))
    .map((p: any) => ({
      id: p.id,
      profile_id: p.profile_id,
      team_id: p.team_id,
      game_id: p.game_id,
      week: wrinkleMap.get(p.wrinkle_id),
      wrinkle: true
    }))

  const allPicks = [
    ...(picks ?? []).map((p: any) => ({ ...p, wrinkle: false })),
    ...wrinklePicks
  ]

  // Get games
  const gameIds = Array.from(
    new Set(allPicks.map((p: any) => p.game_id).filter(Boolean))
  ) as string[]

  const { data: games } = await service
    .from('games')
    .select('id, home_team, away_team, home_score, away_score, status')
    .in('id', gameIds)

  const gamesMap = new Map((games ?? []).map((g: any) => [g.id, g as GameRow]))

  // Get profiles with preferred_color
  const profileIds = Array.from(new Set(allPicks.map((p: any) => p.profile_id)))
  const { data: profiles } = await service
    .from('profiles')
    .select('id, display_name, email, preferred_color')
    .in('id', profileIds)

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [
      p.id,
      { 
        display_name: p.display_name, 
        email: p.email,
        preferred_color: p.preferred_color 
      }
    ])
  )

  // Build log
  const log = allPicks
    .map((p: any) => {
      const g = gamesMap.get(p.game_id)
      if (!g) return null

      const status = (g.status || '').toUpperCase()
      if (!includeLive && status !== 'FINAL') return null

      const prof = profileMap.get(p.profile_id)
      const displayName = prof?.display_name || prof?.email?.split('@')[0] || 'Member'
      const preferredColor = prof?.preferred_color || null

      let result: 'W' | 'L' | 'T' | '—' = '—'
      if (status === 'FINAL') {
        const correct = isCorrect(g, p.team_id)
        const hs = Number(g.home_score ?? 0)
        const as = Number(g.away_score ?? 0)
        if (hs === as) result = 'T'
        else result = correct ? 'W' : 'L'
      }

      const points = pointsFor(g, p.team_id)
      const score = status === 'FINAL' ? { home: g.home_score, away: g.away_score } : null

      return {
        week: p.week,
        profile_id: p.profile_id,
        display_name: displayName,
        preferred_color: preferredColor,
        team_id: p.team_id,
        game_id: p.game_id,
        status,
        result,
        score,
        points,
        wrinkle: p.wrinkle || false
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      // Sort by week desc, then by display_name
      if (a.week !== b.week) return b.week - a.week
      return (a.display_name || '').localeCompare(b.display_name || '')
    })

  return NextResponse.json({ ok: true, log })
}

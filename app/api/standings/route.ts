// app/api/standings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

type Row = { profile_id: string; display_name: string; points: number }

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // Params
  const url = new URL(req.url)
  const leagueId = url.searchParams.get('leagueId') || ''
  const season = Number(url.searchParams.get('season') || '')
  const weekParam = url.searchParams.get('week')
  const week = weekParam != null ? Number(weekParam) : null

  if (!leagueId || !Number.isFinite(season) || (weekParam != null && !Number.isFinite(week))) {
    return NextResponse.json({ error: 'leagueId and season are required; week optional' }, { status: 400, headers: { 'cache-control': 'no-store' } })
  }

  // Authorization: user must be a member OR the league owner
  const { data: isMember } = await supabase
    .from('league_memberships')
    .select('profile_id')
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!isMember) {
    const { data: lg } = await supabase
      .from('leagues')
      .select('owner_id')
      .eq('id', leagueId)
      .maybeSingle()
    if (!lg || lg.owner_id !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: { 'cache-control': 'no-store' } })
    }
  }

  // Members
  const { data: lm, error: lmErr } = await supabase
    .from('league_memberships')
    .select('profile_id')
    .eq('league_id', leagueId)
  if (lmErr) return NextResponse.json({ error: lmErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })

  const profileIds = (lm ?? []).map(r => r.profile_id)
  let profiles: Record<string, { id: string; display_name: string | null; email: string | null }> = {}

  if (profileIds.length) {
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', profileIds)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    for (const p of profs || []) profiles[p.id] = { id: p.id, display_name: p.display_name, email: p.email }
  }

  // Picks for league/season(+week)
  let picksQ = supabase
    .from('picks')
    .select('id, profile_id, team_id, game_id, season, week')
    .eq('league_id', leagueId)
    .eq('season', season)

  if (week != null) picksQ = picksQ.eq('week', week)

  const { data: picks, error: pkErr } = await picksQ
  if (pkErr) return NextResponse.json({ error: pkErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })

  // Fetch only the games we need
  const gameIds = Array.from(new Set((picks ?? []).map(p => p.game_id).filter(Boolean)))
  const gamesMap = new Map<string, { id: string; status: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null }>()

  if (gameIds.length) {
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('id, status, home_team, away_team, home_score, away_score')
      .in('id', gameIds)
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    for (const g of games || []) gamesMap.set(g.id, g as any)
  }

  // Score function
  function scorePick(p: any): number {
    const g = gamesMap.get(p.game_id)
    if (!g || g.status !== 'FINAL') return 0
    const hs = Number(g.home_score ?? 0)
    const as = Number(g.away_score ?? 0)
    if (hs === as && (p.team_id === g.home_team || p.team_id === g.away_team)) return hs / 2
    if (p.team_id === g.home_team && hs > as) return hs
    if (p.team_id === g.away_team && as > hs) return as
    return 0
  }

  // Aggregate per member
  const rows: Row[] = (lm ?? []).map(m => {
    const memberPicks = (picks ?? []).filter(p => p.profile_id === m.profile_id)
    const points = memberPicks.reduce((acc, pk) => acc + scorePick(pk), 0)
    const prof = profiles[m.profile_id] || { id: m.profile_id, display_name: null, email: null }
    const display = prof.display_name || (prof.email ? String(prof.email).split('@')[0] : 'Member')
    return { profile_id: m.profile_id, display_name: display, points: Number(points) }
  })

  rows.sort((a, b) => (b.points - a.points) || a.display_name.localeCompare(b.display_name))

  return NextResponse.json({ rows, season, week: week ?? null }, { headers: { 'cache-control': 'no-store' } })
}

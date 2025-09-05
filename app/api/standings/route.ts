// app/api/standings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

type Member = { id: string; display_name: string | null; email: string | null }
type Pick = { id: string; profile_id: string; team_id: string; game_id: string }
type Game = {
  id: string
  status: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  game_utc: string | null
}

function winnerScore(g: Game, teamId: string): number {
  const hs = Number(g.home_score ?? 0)
  const as = Number(g.away_score ?? 0)
  if (g.status !== 'FINAL') return 0
  if (hs === as && (teamId === g.home_team || teamId === g.away_team)) return hs / 2
  if (teamId === g.home_team && hs > as) return hs
  if (teamId === g.away_team && as > hs) return as
  return 0
}

function isCorrect(g: Game, teamId: string): boolean {
  if (g.status !== 'FINAL') return false
  const hs = Number(g.home_score ?? 0)
  const as = Number(g.away_score ?? 0)
  if (hs === as) return false
  return (teamId === g.home_team && hs > as) || (teamId === g.away_team && as > hs)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }

  const url = new URL(req.url)
  let leagueId = url.searchParams.get('leagueId') || ''
  const season = Number(url.searchParams.get('season') || '')
  const weekParam = url.searchParams.get('week')
  const week = weekParam != null ? Number(weekParam) : null

  if (!Number.isFinite(season) || (weekParam != null && !Number.isFinite(week))) {
    return NextResponse.json({ error: 'season (and optional week) must be numbers' }, { status: 400, headers: { 'cache-control': 'no-store' } })
  }

  // If no leagueId provided, pick one from the user's memberships the simple way (no relational joins).
  if (!leagueId) {
    // 1) memberships
    const { data: mems, error: mErr } = await supabase
      .from('league_memberships')
      .select('league_id')
      .eq('profile_id', user.id)
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })

    const leagueIds = (mems ?? []).map(r => r.league_id)
    if (!leagueIds.length) {
      return NextResponse.json({ rows: [], season, week: week ?? null, leagueId: '' }, { headers: { 'cache-control': 'no-store' } })
    }

    // 2) candidate leagues (id, season), then choose by requested season or first
    const { data: leagues, error: lErr } = await supabase
      .from('leagues')
      .select('id, season')
      .in('id', leagueIds)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })

    const bySeason = (leagues ?? []).find((l: any) => Number(l.season) === season)
    const any = (leagues ?? [])[0]
    leagueId = (bySeason as any)?.id || (any as any)?.id || ''
    if (!leagueId) {
      return NextResponse.json({ rows: [], season, week: week ?? null, leagueId: '' }, { headers: { 'cache-control': 'no-store' } })
    }
  }

  // === Members (via RPC to avoid RLS headaches) ===
  // Ensure the function exists (we shared earlier):
  // create or replace function public.get_league_member_ids(p_league_id uuid) returns table(profile_id uuid) ...
  const { data: memberRows, error: rpcErr } = await supabase.rpc('get_league_member_ids', { p_league_id: leagueId })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  const memberIds: string[] = (memberRows ?? []).map((r: any) => r.profile_id)

  // Names
  let profiles: Record<string, Member> = {}
  if (memberIds.length) {
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', memberIds)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    for (const p of profs ?? []) profiles[(p as any).id] = p as any
  }

  // Weekly picks
  let picksQ = supabase
    .from('picks')
    .select('id, profile_id, team_id, game_id, season, week')
    .eq('league_id', leagueId)
    .eq('season', season)
  if (week != null) picksQ = picksQ.eq('week', week)
  const { data: picksRows, error: pkErr } = await picksQ
  if (pkErr) return NextResponse.json({ error: pkErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  const picks: Pick[] = (picksRows ?? []) as any

  // Wrinkles for scope
  const wrnQ = supabase.from('wrinkles').select('id').eq('league_id', leagueId).eq('season', season)
  const { data: wrinkleDefs, error: wDefErr } = week != null ? await wrnQ.eq('week', week) : await wrnQ
  if (wDefErr) return NextResponse.json({ error: wDefErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  const wrinkleIds = (wrinkleDefs ?? []).map(w => (w as any).id)

  let wrinklePicks: Pick[] = []
  if (wrinkleIds.length) {
    const { data: wp, error: wpErr } = await supabase
      .from('wrinkle_picks')
      .select('id, profile_id, team_id, game_id, wrinkle_id')
      .in('wrinkle_id', wrinkleIds)
    if (wpErr) return NextResponse.json({ error: wpErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    wrinklePicks = (wp ?? []).map(r => ({
      id: (r as any).id,
      profile_id: (r as any).profile_id,
      team_id: (r as any).team_id,
      game_id: (r as any).game_id,
    }))
  }

  // Games we need
  const gameIds = Array.from(new Set([
    ...picks.map(p => p.game_id).filter(Boolean),
    ...wrinklePicks.map(p => p.game_id).filter(Boolean),
  ])) as string[]

  const gamesMap = new Map<string, Game>()
  if (gameIds.length) {
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('id, status, home_team, away_team, home_score, away_score, game_utc')
      .in('id', gameIds)
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    for (const g of games ?? []) gamesMap.set((g as any).id, g as any)
  }

  // Build rows for each member
  const rows = memberIds.map((mid) => {
    const prof = profiles[mid] || { id: mid, display_name: null, email: null }
    const display = (prof.display_name || (prof.email ? String(prof.email).split('@')[0] : 'Member')) as string

    const myPicks = picks.filter(p => p.profile_id === mid)
    const myWrn = wrinklePicks.filter(p => p.profile_id === mid)

    const events = [...myPicks, ...myWrn].map(p => {
      const g = gamesMap.get(p.game_id)
      const when = g?.game_utc ? Date.parse(g.game_utc) : 0
      const correct = g ? isCorrect(g, p.team_id) : false
      const pts = g ? winnerScore(g, p.team_id) : 0
      const isWrinkle = myWrn.includes(p as any)
      return { when, correct, pts, isWrinkle }
    }).sort((a, b) => a.when - b.when)

    let cur = 0, best = 0, correctCount = 0, wrinklePts = 0, totalPts = 0
    for (const e of events) {
      totalPts += e.pts
      if (e.isWrinkle) wrinklePts += e.pts
      if (e.correct) { correctCount += 1; cur += 1; best = Math.max(best, cur) } else { cur = 0 }
    }

    return {
      profile_id: mid,
      display_name: display,
      points: Number(totalPts),
      correct: correctCount,
      longest_streak: best,
      wrinkle_points: Number(wrinklePts),
    }
  })

  // Sort by tiebreakers
  rows.sort((a, b) =>
    (b.points - a.points) ||
    (b.correct - a.correct) ||
    (b.longest_streak - a.longest_streak) ||
    (b.wrinkle_points - a.wrinkle_points) ||
    a.display_name.localeCompare(b.display_name)
  )

  const leaderPts = rows[0]?.points ?? 0
  const playoffCutPts = rows[3]?.points ?? 0

  const final = rows.map((r, idx) => ({
    ...r,
    rank: idx + 1,
    back_from_first: Math.max(0, leaderPts - r.points),
    back_to_playoffs: Math.max(0, playoffCutPts - r.points),
  }))

  return NextResponse.json(
    { rows: final, season, week: week ?? null, leagueId },
    { headers: { 'cache-control': 'no-store' } }
  )
}

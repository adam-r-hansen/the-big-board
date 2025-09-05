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

type Row = {
  profile_id: string
  display_name: string
  points: number
  correct: number
  longest_streak: number
  wrinkle_points: number
  rank: number
  back_from_first: number
  back_to_playoffs: number
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
  if (hs === as) return false // tie is NOT a "correct pick"; still awards half points
  return (teamId === g.home_team && hs > as) || (teamId === g.away_team && as > hs)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } })
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

  // Memberships (who is in this league?)
  const { data: lm, error: lmErr } = await supabase
    .from('league_memberships')
    .select('profile_id')
    .eq('league_id', leagueId)
  if (lmErr) return NextResponse.json({ error: lmErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  const memberIds = (lm ?? []).map(r => r.profile_id)

  // Profiles for names
  let profiles: Record<string, Member> = {}
  if (memberIds.length) {
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', memberIds)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    for (const p of profs ?? []) profiles[p.id] = p as any
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

  // Wrinkle picks (limit to wrinkles belonging to this league/season[/week])
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
    // Coerce to Pick shape (wrinkle_id not needed post-fetch)
    wrinklePicks = (wp ?? []).map(r => ({
      id: (r as any).id,
      profile_id: (r as any).profile_id,
      team_id: (r as any).team_id,
      game_id: (r as any).game_id,
    }))
  }

  // Games we need to score
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

  // Aggregate per member
  const baseRows = memberIds.map<Row>((mid) => {
    const prof = profiles[mid] || { id: mid, display_name: null, email: null }
    const display = prof.display_name || (prof.email ? String(prof.email).split('@')[0] : 'Member')

    const myPicks = picks.filter(p => p.profile_id === mid)
    const myWrn = wrinklePicks.filter(p => p.profile_id === mid)

    // events for streak (weekly + wrinkle) with time
    const events = [...myPicks, ...myWrn].map(p => {
      const g = gamesMap.get(p.game_id)
      const when = g?.game_utc ? Date.parse(g.game_utc) : 0
      const correct = g ? isCorrect(g, p.team_id) : false
      const pts = g ? winnerScore(g, p.team_id) : 0
      return { when, correct, pts, isWrinkle: myWrn.includes(p as any) }
    }).sort((a, b) => a.when - b.when)

    // longest correct streak
    let cur = 0, best = 0, correctCount = 0, wrinklePts = 0, totalPts = 0
    for (const e of events) {
      totalPts += e.pts
      if (e.isWrinkle) wrinklePts += e.pts
      if (e.correct) {
        correctCount += 1
        cur += 1
        if (cur > best) best = cur
      } else {
        cur = 0
      }
    }

    return {
      profile_id: mid,
      display_name: display,
      points: Number(totalPts),
      correct: correctCount,
      longest_streak: best,
      wrinkle_points: Number(wrinklePts),
      rank: 0,
      back_from_first: 0,
      back_to_playoffs: 0,
    }
  })

  // Sort by your tiebreakers
  baseRows.sort((a, b) =>
    (b.points - a.points) ||
    (b.correct - a.correct) ||
    (b.longest_streak - a.longest_streak) ||
    (b.wrinkle_points - a.wrinkle_points) ||
    a.display_name.localeCompare(b.display_name)
  )

  const leaderPts = baseRows[0]?.points ?? 0
  const playoffCutPts = baseRows[3]?.points ?? 0

  // assign rank and "points back"
  baseRows.forEach((r, idx) => {
    r.rank = idx + 1
    r.back_from_first = Math.max(0, leaderPts - r.points)
    r.back_to_playoffs = Math.max(0, playoffCutPts - r.points)
  })

  return NextResponse.json(
    { rows: baseRows, season, week: week ?? null, leagueId },
    { headers: { 'cache-control': 'no-store' } }
  )
}

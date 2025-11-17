import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  let season = Number(searchParams.get('season') || new Date().getFullYear())
  const week = searchParams.get('week') ? Number(searchParams.get('week')) : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }

  let targetLeagueId = leagueId

  if (!targetLeagueId) {
    const { data: memberships, error: memErr } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('profile_id', user.id)
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })

    const leagueIds = (memberships ?? []).map(r => r.league_id)
    if (!leagueIds.length) {
      return NextResponse.json({ rows: [], season, week: week ?? null, leagueId: '', leagueName: '' }, { headers: { 'cache-control': 'no-store' } })
    }

    const { data: leagues, error: lErr } = await supabase
      .from('leagues')
      .select('id, season')
      .in('id', leagueIds)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })

    const bySeason = (leagues ?? []).find((l: any) => Number(l.season) === season)
    const any = (leagues ?? [])[0]
    targetLeagueId = (bySeason as any)?.id || (any as any)?.id || ''
    if (!targetLeagueId) {
      return NextResponse.json({ rows: [], season, week: week ?? null, leagueId: '', leagueName: '' }, { headers: { 'cache-control': 'no-store' } })
    }
  }

  let leagueName = ''
  {
    const { data: leagueRow } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', targetLeagueId)
      .maybeSingle()
    leagueName = (leagueRow as any)?.name ?? ''
  }

  const { data: memberRows, error: rpcErr } = await supabase.rpc('get_league_member_ids', { p_league_id: targetLeagueId })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  const memberIds: string[] = (memberRows ?? []).map((r: any) => r.profile_id)

  type Member = { id: string; display_name: string | null; email: string | null; preferred_color: string | null }
  let profiles: Record<string, Member> = {}
  if (memberIds.length) {
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, email, preferred_color')
      .in('id', memberIds)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    for (const p of profs ?? []) profiles[(p as any).id] = p as any
  }

  let picksQ = supabase
    .from('picks')
    .select('id, profile_id, team_id, game_id, season, week')
    .eq('league_id', targetLeagueId)
    .eq('season', season)
  if (week != null) picksQ = picksQ.eq('week', week)
  const { data: picksRows, error: pkErr } = await picksQ
  if (pkErr) return NextResponse.json({ error: pkErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  const picks: any[] = (picksRows ?? []) as any

  const wrnQ = supabase.from('wrinkles').select('id').eq('league_id', targetLeagueId).eq('season', season)
  const { data: wrinkleDefs, error: wDefErr } = week != null ? await wrnQ.eq('week', week) : await wrnQ
  if (wDefErr) return NextResponse.json({ error: wDefErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  const wrinkleIds = (wrinkleDefs ?? []).map((w: any) => w.id)

  let wrinklePicks: any[] = []
  if (wrinkleIds.length) {
    const { data: wpRows, error: wpErr } = await supabase
      .from('wrinkle_picks')
      .select('id, wrinkle_id, profile_id, team_id, game_id')
      .in('wrinkle_id', wrinkleIds)
    if (wpErr) return NextResponse.json({ error: wpErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    wrinklePicks = (wpRows ?? []) as any
  }

  const allPicks = [...picks, ...wrinklePicks]
  const gameIds = Array.from(new Set(allPicks.map(p => p.game_id).filter(Boolean))) as string[]
  let gamesById = new Map<string, any>()
  if (gameIds.length) {
    const { data: g, error: gErr } = await supabase
      .from('games')
      .select('id, home_team, away_team, home_score, away_score, status')
      .in('id', gameIds)
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
    gamesById = new Map((g || []).map((x: any) => [x.id, x]))
  }

  function pickPoints(teamId: string, g: any): number | null {
    if (!g) return null
    const s = (g.status || '').toUpperCase()
    if (s !== 'FINAL') return null
    const hs = g.home_score ?? null
    const as = g.away_score ?? null
    if (hs == null || as == null) return 0
    if (hs === as) {
      if (g.home_team === teamId) return hs / 2
      if (g.away_team === teamId) return as / 2
      return 0
    }
    if (hs > as) return g.home_team === teamId ? hs : 0
    return g.away_team === teamId ? as : 0
  }

  const byMember = new Map<string, { points: number; correct: number; decided: number; longest: number; current: number }>()
  for (const pid of memberIds) {
    byMember.set(pid, { points: 0, correct: 0, decided: 0, longest: 0, current: 0 })
  }

  for (const p of allPicks) {
    const g = p.game_id ? gamesById.get(p.game_id) : undefined
    const pts = pickPoints(p.team_id, g)
    const entry = byMember.get(p.profile_id)
    if (!entry) continue
    if (typeof pts === 'number') {
      entry.points += pts
      entry.decided++
      if (pts > 0) {
        entry.correct++
        entry.current++
        if (entry.current > entry.longest) entry.longest = entry.current
      } else {
        entry.current = 0
      }
    }
  }

  const rows = memberIds.map(pid => {
    const pr = profiles[pid]
    const st = byMember.get(pid)!
    return {
      profile_id: pid,
      display_name: pr?.display_name || pr?.email?.split('@')[0] || 'Member',
      preferred_color: pr?.preferred_color || null,
      points_total: st.points,
      picks_correct: st.correct,
      longest_streak: st.longest,
    }
  })

  rows.sort((a, b) =>
    (b.points_total || 0) - (a.points_total || 0) ||
    (b.picks_correct || 0) - (a.picks_correct || 0) ||
    (b.longest_streak || 0) - (a.longest_streak || 0) ||
    a.display_name.localeCompare(b.display_name)
  )

  return NextResponse.json({ rows, season, week, leagueId: targetLeagueId, leagueName }, { headers: { 'cache-control': 'no-store' } })
}

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
  game_utc: string | null
}

function resultFor(teamId: string, g?: GameRow): 'W' | 'L' | 'T' | '—' {
  if (!g || g.status !== 'FINAL') return '—'
  const hs = Number(g.home_score ?? 0)
  const as = Number(g.away_score ?? 0)
  if (hs === as) return 'T'
  const isHome = g.home_team === teamId
  return (isHome && hs > as) || (!isHome && as > hs) ? 'W' : 'L'
}

function pointsFor(teamId: string, g?: GameRow): number | null {
  if (!g || g.status !== 'FINAL') return null
  const hs = Number(g.home_score ?? 0)
  const as = Number(g.away_score ?? 0)
  if (hs === as) {
    return g.home_team === teamId || g.away_team === teamId ? hs / 2 : 0
  }
  const isHome = g.home_team === teamId
  if (isHome && hs > as) return hs
  if (!isHome && as > hs) return as
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

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  const { data: memberData } = await sb.rpc('get_league_member_ids', {
    p_league_id: leagueId
  })
  const memberIds: string[] = (memberData ?? []).map((r: any) => r.profile_id)

  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, leagueId, season, leaders: null, log: [] })
  }

  const { data: profs } = await sb
    .from('profiles')
    .select('id, display_name, email')
    .in('id', memberIds)
  const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]))

  function prettyName(pid: string) {
    const p = profMap.get(pid)
    return p?.display_name || p?.email?.split('@')[0] || 'Member'
  }

  // Get picks with winless_double flag
  const { data: picks } = await sb
    .from('picks')
    .select('id, profile_id, team_id, game_id, week, winless_double')
    .eq('league_id', leagueId)
    .eq('season', season)

  // Get wrinkles
  const { data: wrinkles } = await sb
    .from('wrinkles')
    .select('id, week, kind')
    .eq('league_id', leagueId)
    .eq('season', season)

  const wrIndex = new Map((wrinkles ?? []).map((w: any) => [w.id, { week: w.week, kind: w.kind }]))

  const { data: wrPicks } = await sb
    .from('wrinkle_picks')
    .select('id, profile_id, team_id, game_id, wrinkle_id')

  const wrinklePicks = (wrPicks ?? [])
    .filter((r: any) => wrIndex.has(r.wrinkle_id))
    .map((r: any) => {
      const wr = wrIndex.get(r.wrinkle_id)!
      return {
        id: r.id,
        profile_id: r.profile_id,
        team_id: r.team_id,
        game_id: r.game_id,
        week: wr.week,
        wrinkle: true,
        wrinkle_kind: wr.kind
      }
    })

  const allPicks = [
    ...(picks ?? []).map((p: any) => ({
      ...p,
      wrinkle: p.winless_double || false,
      wrinkle_kind: p.winless_double ? 'winless_double' : undefined
    })),
    ...wrinklePicks
  ]

  // Get games
  const gameIds = Array.from(
    new Set(allPicks.map((p: any) => p.game_id).filter(Boolean))
  ) as string[]

  const { data: games } = await sb
    .from('games')
    .select('id, home_team, away_team, home_score, away_score, status, game_utc')
    .in('id', gameIds)

  const gamesMap = new Map((games ?? []).map((g: any) => [g.id, g as GameRow]))

  type LogRow = {
    week: number
    profile_id: string
    display_name: string
    team_id: string
    game_id: string | null
    status: string
    result: 'W' | 'L' | 'T' | '—'
    score: { home: number | null; away: number | null } | null
    points: number | null
    wrinkle: boolean
  }

  const log: LogRow[] = allPicks.map((p: any) => {
    const g = p.game_id ? gamesMap.get(p.game_id) : undefined
    const s = (g?.status || 'UPCOMING').toUpperCase()
    const res = resultFor(p.team_id, g)
    let pts = pointsFor(p.team_id, g)
    
    // Double points for winless_double
    if (p.wrinkle_kind === 'winless_double' && pts !== null) {
      pts = pts * 2
    }
    
    const score = g ? { home: g.home_score, away: g.away_score } : null
    return {
      week: p.week,
      profile_id: p.profile_id,
      display_name: prettyName(p.profile_id),
      team_id: p.team_id,
      game_id: p.game_id,
      status: s,
      result: res,
      score,
      points: includeLive ? (pts ?? 0) : (s === 'FINAL' ? pts : null),
      wrinkle: p.wrinkle || false,
    }
  })

  if (!includeLive) {
    log.forEach(r => {
      if (r.status !== 'FINAL') r.points = null
    })
  }
  
  log.sort((a, b) => a.week - b.week || a.display_name.localeCompare(b.display_name))

  // Leaderboards from FINAL rows
  const finalsByProfile = new Map<string, LogRow[]>()
  for (const r of log) {
    if (r.status !== 'FINAL') continue
    const arr = finalsByProfile.get(r.profile_id) || []
    arr.push(r)
    finalsByProfile.set(r.profile_id, arr)
  }

  type Leader = { profile_id: string; display_name: string }
  const leadersAvg: Array<Leader & { decided: number; points_total: number; avg_points_per_pick: number }> = []
  const leadersAcc: Array<Leader & { correct: number; decided: number; accuracy: number }> = []
  const leadersStreak: Array<Leader & { longest_streak: number }> = []

  for (const [pid, rows] of finalsByProfile.entries()) {
    const name = prettyName(pid)
    const decided = rows.length
    const points_total = rows.reduce((acc, r) => acc + (r.points || 0), 0)
    const correct = rows.filter(r => r.result === 'W').length
    let longest = 0,
      cur = 0
    const sorted = [...rows].sort((a, b) => a.week - b.week)
    for (const r of sorted) {
      if (r.result === 'W') {
        cur++
        if (cur > longest) longest = cur
      } else {
        cur = 0
      }
    }

    leadersAvg.push({
      profile_id: pid,
      display_name: name,
      decided,
      points_total,
      avg_points_per_pick: decided ? points_total / decided : 0
    })
    leadersAcc.push({
      profile_id: pid,
      display_name: name,
      correct,
      decided,
      accuracy: decided ? correct / decided : 0
    })
    leadersStreak.push({ profile_id: pid, display_name: name, longest_streak: longest })
  }

  leadersAvg.sort(
    (a, b) =>
      (b.avg_points_per_pick || 0) - (a.avg_points_per_pick || 0) ||
      (b.points_total || 0) - (a.points_total || 0) ||
      a.display_name.localeCompare(b.display_name)
  )
  leadersAcc.sort(
    (a, b) =>
      (b.accuracy || 0) - (a.accuracy || 0) ||
      (b.correct || 0) - (a.correct || 0) ||
      a.display_name.localeCompare(b.display_name)
  )
  leadersStreak.sort(
    (a, b) =>
      (b.longest_streak || 0) - (a.longest_streak || 0) || a.display_name.localeCompare(b.display_name)
  )

  return NextResponse.json({
    ok: true,
    leagueId,
    season,
    leaders: {
      avg_points_per_pick: leadersAvg.map(x => ({
        profile_id: x.profile_id,
        display_name: x.display_name,
        decided: x.decided,
        points_total: x.points_total,
        avg_points_per_pick: Number(x.avg_points_per_pick.toFixed(2))
      })),
      accuracy: leadersAcc.map(x => ({
        profile_id: x.profile_id,
        display_name: x.display_name,
        correct: x.correct,
        decided: x.decided,
        accuracy: Number(x.accuracy.toFixed(3))
      })),
      longest_streak: leadersStreak
    },
    log
  })
}

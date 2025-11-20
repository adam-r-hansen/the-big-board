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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const userId = user.user.id

  type Row = { id: string; week: number; team_id: string; game_id: string; wrinkle: boolean; wrinkle_kind?: string }

  // Regular picks
  const { data: picks } = await supabase
    .from('picks')
    .select('id, week, team_id, game_id')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('profile_id', userId)

  const weeklyRows: Row[] = (picks ?? []).map(p => ({
    id: p.id,
    week: p.week,
    team_id: p.team_id,
    game_id: p.game_id,
    wrinkle: false
  }))

  // Wrinkle picks with kind
  const { data: wrinkles } = await supabase
    .from('wrinkles')
    .select('id, week, kind')
    .eq('league_id', leagueId)
    .eq('season', season)

  const wrIndex = new Map((wrinkles ?? []).map((w: any) => [w.id, { week: w.week, kind: w.kind }]))

  const { data: wrinklePicks } = await supabase
    .from('wrinkle_picks')
    .select('id, wrinkle_id, team_id, game_id')
    .eq('profile_id', userId)

  const wrinkleRows: Row[] = (wrinklePicks ?? [])
    .map((r: any) => {
      const wr = wrIndex.get(r.wrinkle_id)
      if (!wr) return null
      return { 
        id: r.id, 
        week: wr.week, 
        team_id: r.team_id, 
        game_id: r.game_id, 
        wrinkle: true,
        wrinkle_kind: wr.kind
      } as Row
    })
    .filter(Boolean) as Row[]

  const all = [...weeklyRows, ...wrinkleRows]

  // Games lookup
  const gameIds = Array.from(new Set(all.map(r => r.game_id).filter(Boolean))) as string[]
  let gamesById = new Map<string, GameRow>()
  if (gameIds.length) {
    const { data: g } = await supabase
      .from('games')
      .select('id, game_utc, home_team, away_team, home_score, away_score, status')
      .in('id', gameIds)
    gamesById = new Map((g || []).map((x: any) => [x.id, x as GameRow]))
  }

  type LogRow = {
    week: number
    team_id: string
    game_id: string | null
    status: string
    result: 'W' | 'L' | 'T' | '—'
    score: { home: number | null; away: number | null } | null
    points: number | null
    wrinkle: boolean
  }

  const log: LogRow[] = all
    .map(r => {
      const g = r.game_id ? gamesById.get(r.game_id) : undefined
      const s = (g?.status || 'UPCOMING').toUpperCase()
      const res = resultFor(r.team_id, g)
      const pts = pointsFor(r.team_id, g)
      const score = g ? { home: g.home_score, away: g.away_score } : null
      return {
        week: r.week,
        team_id: r.team_id,
        game_id: r.game_id,
        status: s,
        result: res,
        score,
        points: includeLive ? (pts ?? 0) : (s === 'FINAL' ? pts : null),
        wrinkle: r.wrinkle,
        wrinkle_kind: r.wrinkle_kind
      }
    })
    .sort((a, b) => a.week - b.week)

  // Summary from FINAL rows only
  const finals = log.filter(r => r.status === 'FINAL')
  const decidedCount = finals.length
  const pointsTotal = finals.reduce((acc, r) => acc + (typeof r.points === 'number' ? r.points : 0), 0)
  const correct = finals.filter(r => r.result === 'W').length
  
  let longest = 0, cur = 0
  for (const r of finals) { 
    if (r.result === 'W') { 
      cur++
      if (cur > longest) longest = cur 
    } else { 
      cur = 0 
    } 
  }
  
  // FIXED: Wrinkle points calculation
  const wrinklePoints = finals
    .filter(r => r.wrinkle)
    .reduce((acc, r) => {
      const pts = r.points || 0
      // For winless_double, only count half (the base points, not the doubled amount)
      if ((r as any).wrinkle_kind === 'winless_double') {
        return acc + (pts / 2)
      }
      // For other wrinkles (bonus games), count full points
      return acc + pts
    }, 0)

  const avg = decidedCount ? pointsTotal / decidedCount : 0
  const accuracy = decidedCount ? correct / decidedCount : 0

  // Remove wrinkle_kind from log before returning
  const cleanLog = log.map(({ wrinkle_kind, ...rest }: any) => rest)

  return NextResponse.json({
    ok: true,
    season,
    summary: {
      picks_total: log.length,
      decided_picks: decidedCount,
      correct,
      accuracy: Number(accuracy.toFixed(3)),
      longest_streak: longest,
      points_total: pointsTotal,
      avg_points_per_pick: Number(avg.toFixed(2)),
      wrinkle_points: Number(wrinklePoints.toFixed(1)),
    },
    log: cleanLog,
  })
}

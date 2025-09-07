import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getCookieStore() {
  const c = (nextCookies as any)()
  if (typeof c?.get === 'function') return c
  return await c
}

type WrinkleRow = {
  id: string
  league_id: string
  season: number
  week: number
}
type GameRow = {
  id: string
  game_utc: string | null
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string | null
}

function toBool(v: string | null): boolean {
  if (!v) return false
  const s = v.toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on'
}

function resultFor(teamId: string, g?: GameRow | null): 'W' | 'L' | 'T' | '—' {
  if (!g) return '—'
  const s = (g.status || '').toUpperCase()
  if (s !== 'FINAL') return '—'
  const hs = typeof g.home_score === 'number' ? g.home_score : null
  const as = typeof g.away_score === 'number' ? g.away_score : null
  if (hs == null || as == null) return '—'
  if (hs === as) return 'T'
  const winner = hs > as ? g.home_team : g.away_team
  return winner === teamId ? 'W' : 'L'
}

function pointsFor(teamId: string, g?: GameRow | null): number | null {
  if (!g) return null
  const s = (g.status || '').toUpperCase()
  if (s !== 'FINAL') return null
  const hs = typeof g.home_score === 'number' ? g.home_score : null
  const as = typeof g.away_score === 'number' ? g.away_score : null
  if (hs == null || as == null) return 0
  if (hs === as) {
    if (g.home_team === teamId) return hs / 2
    if (g.away_team === teamId) return as / 2
    return 0
  }
  if (hs > as) return g.home_team === teamId ? hs : 0
  return g.away_team === teamId ? as : 0
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const season = Number(url.searchParams.get('season')) || new Date().getFullYear()
  const leagueId = url.searchParams.get('leagueId') || ''      // ← NEW
  const includeLive = toBool(url.searchParams.get('includeLive'))

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { ok: false, error: 'Supabase URL/Anon key not configured in this environment.' },
      { status: 200 },
    )
  }

  const cookieStore = await getCookieStore()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (n: string) => cookieStore.get(n)?.value,
      set: (n: string, v: string, o: any) => cookieStore.set(n, v, o),
      remove: (n: string, o: any) => cookieStore.set(n, '', { ...o, maxAge: 0 }),
    },
  })

  // Weekly picks (RLS = only this user). Scope by season (+ league if provided).
  let q = supabase
    .from('picks')
    .select('id, team_id, game_id, season, week')
    .eq('season', season)
  if (leagueId) q = q.eq('league_id', leagueId)
  const { data: picks, error: pErr } = await q
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 200 })

  // Wrinkle picks (RLS = only this user) → join via wrinkles to get week & filter to league/season
  const { data: wp, error: wErr } = await supabase
    .from('wrinkle_picks')
    .select('id, profile_id, team_id, game_id, wrinkle_id')
  if (wErr) return NextResponse.json({ ok: false, error: wErr.message }, { status: 200 })

  const wrIds = Array.from(new Set((wp || []).map(r => r.wrinkle_id))).filter(Boolean) as string[]
  let wrinkles: WrinkleRow[] = []
  if (wrIds.length) {
    let wq = supabase
      .from('wrinkles')
      .select('id, league_id, season, week')
      .in('id', wrIds)
      .eq('season', season)
    if (leagueId) wq = wq.eq('league_id', leagueId)
    const { data: wr, error: wrErr } = await wq
    if (wrErr) return NextResponse.json({ ok: false, error: wrErr.message }, { status: 200 })
    wrinkles = (wr || []) as any
  }

  type Row = { id: string; week: number; team_id: string; game_id: string | null; wrinkle: boolean }
  const weeklyRows: Row[] = (picks || []).map((p: any) => ({
    id: p.id,
    week: p.week,
    team_id: p.team_id,
    game_id: p.game_id,
    wrinkle: false,
  }))

  const wrIndex = new Map(wrinkles.map(w => [w.id, w]))
  const wrinkleRows: Row[] = (wp || [])
    .map((r: any) => {
      const wr = wrIndex.get(r.wrinkle_id)
      if (!wr) return null // filtered out by leagueId/season
      return { id: r.id, week: wr.week, team_id: r.team_id, game_id: r.game_id, wrinkle: true } as Row
    })
    .filter(Boolean) as Row[]

  const all = [...weeklyRows, ...wrinkleRows]

  // Games lookup
  const gameIds = Array.from(new Set(all.map(r => r.game_id).filter(Boolean))) as string[]
  let gamesById = new Map<string, GameRow>()
  if (gameIds.length) {
    const { data: g, error: gErr } = await supabase
      .from('games')
      .select('id, game_utc, home_team, away_team, home_score, away_score, status')
      .in('id', gameIds)
    if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 200 })
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
      }
    })
    .sort((a, b) => a.week - b.week)

  // FINAL-only for summary metrics
  const finals = log.filter(r => r.status === 'FINAL')
  const decidedCount = finals.length
  const pointsTotal = finals.reduce((acc, r) => acc + (typeof r.points === 'number' ? r.points : 0), 0)
  const correct = finals.filter(r => r.result === 'W').length
  let longest = 0,
    cur = 0
  for (const r of finals) {
    if (r.result === 'W') {
      cur++
      if (cur > longest) longest = cur
    } else {
      cur = 0
    }
  }
  const wrinklePoints = finals.filter(r => r.wrinkle).reduce((acc, r) => acc + (r.points || 0), 0)
  const avg = decidedCount ? pointsTotal / decidedCount : 0
  const accuracy = decidedCount ? correct / decidedCount : 0

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
      wrinkle_points: wrinklePoints,
    },
    log,
  })
}

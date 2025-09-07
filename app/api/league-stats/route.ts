import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getCookieStore() {
  const c = (nextCookies as any)()
  if (typeof c?.get === 'function') return c
  return await c
}
function toBool(v: string | null): boolean {
  if (!v) return false
  const s = v.toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on'
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
  const leagueId = url.searchParams.get('leagueId') || ''
  const season = Number(url.searchParams.get('season')) || new Date().getFullYear()
  const includeLive = toBool(url.searchParams.get('includeLive'))

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false, error: 'Supabase URL/Anon key not configured in this environment.' }, { status: 200 })
  }
  if (!SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: 'Service role key not configured (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 200 })
  }
  if (!leagueId) {
    return NextResponse.json({ ok: false, error: 'leagueId is required.' }, { status: 200 })
  }

  // Auth user (to confirm membership)
  const cookieStore = await getCookieStore()
  const userClient = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (n: string) => cookieStore.get(n)?.value,
      set: (n: string, v: string, o: any) => cookieStore.set(n, v, o),
      remove: (n: string, o: any) => cookieStore.set(n, '', { ...o, maxAge: 0 }),
    },
  })
  const { data: userData, error: uErr } = await userClient.auth.getUser()
  if (uErr || !userData?.user) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 200 })
  const uid = userData.user.id

  // Service client (cross-user reads), still gated by membership
  const service = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  // Verify membership
  const { data: membership, error: mErr } = await service
    .from('league_memberships')
    .select('id')
    .eq('league_id', leagueId)
    .eq('profile_id', uid)
    .limit(1)
    .maybeSingle()
  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 200 })
  if (!membership) return NextResponse.json({ ok: false, error: 'Forbidden (not a league member)' }, { status: 200 })

  // Weekly picks for league/season
  const { data: picks, error: pErr } = await service
    .from('picks')
    .select('id, profile_id, team_id, game_id, season, week')
    .eq('league_id', leagueId)
    .eq('season', season)
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 200 })

  // Wrinkle picks filtered via wrinkles (league+season)
  const { data: wp, error: wpErr } = await service
    .from('wrinkle_picks')
    .select('id, profile_id, team_id, game_id, wrinkle_id')
  if (wpErr) return NextResponse.json({ ok: false, error: wpErr.message }, { status: 200 })
  const wrinkleIds = Array.from(new Set((wp || []).map(r => r.wrinkle_id))).filter(Boolean) as string[]
  let wrinkles = [] as Array<{ id: string; league_id: string; season: number; week: number }>
  if (wrinkleIds.length) {
    const { data: wr, error: wrErr } = await service
      .from('wrinkles')
      .select('id, league_id, season, week')
      .in('id', wrinkleIds)
      .eq('league_id', leagueId)
      .eq('season', season)
    if (wrErr) return NextResponse.json({ ok: false, error: wrErr.message }, { status: 200 })
    wrinkles = (wr || []) as any
  }
  const wrIndex = new Map(wrinkles.map(w => [w.id, w]))
  const wrinklePicks = (wp || []).filter(r => wrIndex.get(r.wrinkle_id))

  type Row = { id: string; profile_id: string; week: number; team_id: string; game_id: string | null; wrinkle: boolean }
  const weeklyRows: Row[] = (picks || []).map((p: any) => ({
    id: p.id, profile_id: p.profile_id, week: p.week, team_id: p.team_id, game_id: p.game_id, wrinkle: false,
  }))
  const wrinkleRows: Row[] = wrinklePicks.map((r: any) => {
    const wr = wrIndex.get(r.wrinkle_id)!
    return { id: r.id, profile_id: r.profile_id, week: wr.week, team_id: r.team_id, game_id: r.game_id, wrinkle: true }
  })
  const all = [...weeklyRows, ...wrinkleRows]

  // Games lookup
  const gameIds = Array.from(new Set(all.map(r => r.game_id).filter(Boolean))) as string[]
  let gamesById = new Map<string, GameRow>()
  if (gameIds.length) {
    const { data: g, error: gErr } = await service
      .from('games')
      .select('id, game_utc, home_team, away_team, home_score, away_score, status')
      .in('id', gameIds)
    if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 200 })
    gamesById = new Map((g || []).map((x: any) => [x.id, x as GameRow]))
  }

  // Profiles lookup
  const profileIds = Array.from(new Set(all.map(r => r.profile_id)))
  let profileName = new Map<string, { display_name: string | null; email: string | null }>()
  if (profileIds.length) {
    const { data: profs, error: prErr } = await service
      .from('profiles')
      .select('id, display_name, email')
      .in('id', profileIds)
    if (prErr) return NextResponse.json({ ok: false, error: prErr.message }, { status: 200 })
    profileName = new Map((profs || []).map((x: any) => [x.id, { display_name: x.display_name, email: x.email }]))
  }
  const prettyName = (pid: string) => {
    const p = profileName.get(pid)
    if (p?.display_name && p.display_name.trim()) return p.display_name
    if (p?.email) return p.email.split('@')[0]
    return 'Member'
  }

  type LogRow = {
    week: number
    profile_id: string
    display_name: string
    team_id: string
    game_id: string | null
    status: string
    result: 'W'|'L'|'T'|'—'
    score: { home: number|null; away: number|null } | null
    points: number | null
    wrinkle: boolean
  }
  let log: LogRow[] = all.map(r => {
    const g = r.game_id ? gamesById.get(r.game_id) : undefined
    const s = (g?.status || 'UPCOMING').toUpperCase()
    const res = resultFor(r.team_id, g)
    const pts = pointsFor(r.team_id, g)
    const score = g ? { home: g.home_score, away: g.away_score } : null
    return {
      week: r.week,
      profile_id: r.profile_id,
      display_name: prettyName(r.profile_id),
      team_id: r.team_id,
      game_id: r.game_id,
      status: s,
      result: res,
      score,
      points: includeLive ? (pts ?? 0) : (s === 'FINAL' ? pts : null),
      wrinkle: r.wrinkle,
    }
  })
  if (!includeLive) log = log.filter(r => r.status === 'FINAL')
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
    let longest = 0, cur = 0
    const sorted = [...rows].sort((a, b) => a.week - b.week)
    for (const r of sorted) { if (r.result === 'W') { cur++; if (cur > longest) longest = cur } else { cur = 0 } }

    leadersAvg.push({ profile_id: pid, display_name: name, decided, points_total, avg_points_per_pick: decided ? points_total / decided : 0 })
    leadersAcc.push({ profile_id: pid, display_name: name, correct, decided, accuracy: decided ? correct / decided : 0 })
    leadersStreak.push({ profile_id: pid, display_name: name, longest_streak: longest })
  }

  leadersAvg.sort((a, b) =>
    (b.avg_points_per_pick || 0) - (a.avg_points_per_pick || 0) ||
    (b.points_total || 0) - (a.points_total || 0) ||
    a.display_name.localeCompare(b.display_name)
  )
  leadersAcc.sort((a, b) =>
    (b.accuracy || 0) - (a.accuracy || 0) ||
    (b.correct || 0) - (a.correct || 0) ||
    a.display_name.localeCompare(b.display_name)
  )
  leadersStreak.sort((a, b) =>
    (b.longest_streak || 0) - (a.longest_streak || 0) ||
    a.display_name.localeCompare(b.display_name)
  )

  return NextResponse.json({
    ok: true,
    leagueId,
    season,
    leaders: {
      avg_points_per_pick: leadersAvg.map(x => ({
        profile_id: x.profile_id, display_name: x.display_name, decided: x.decided, points_total: x.points_total,
        avg_points_per_pick: Number((x.avg_points_per_pick).toFixed(2)),
      })),
      accuracy: leadersAcc.map(x => ({
        profile_id: x.profile_id, display_name: x.display_name, correct: x.correct, decided: x.decided,
        accuracy: Number((x.accuracy).toFixed(3)),
      })),
      longest_streak: leadersStreak,
    },
    log,
  })
}

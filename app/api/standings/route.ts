import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type GameRow = { id: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null; status: string | null; game_utc: string | null }

function isCorrect(g: GameRow, teamId: string) {
  if (g.status !== 'FINAL') return false
  const hs = Number(g.home_score ?? 0), as = Number(g.away_score ?? 0)
  if (hs === as) return false
  return (teamId === g.home_team && hs > as) || (teamId === g.away_team && as > hs)
}

function winnerScore(g: GameRow, teamId: string) {
  if (g.status !== 'FINAL') return 0
  const hs = Number(g.home_score ?? 0), as = Number(g.away_score ?? 0)
  if (hs === as) return (teamId === g.home_team || teamId === g.away_team) ? hs / 2 : 0
  if (teamId === g.home_team && hs > as) return hs
  if (teamId === g.away_team && as > hs) return as
  return 0
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const leagueId = sp.get('leagueId') || ''
  const season = Number(sp.get('season') || new Date().getFullYear())
  const week = sp.get('week') ? Number(sp.get('week')) : null

  if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 })

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const { data: lInfo } = await sb.from('leagues').select('name').eq('id', leagueId).single()
  const leagueName = lInfo?.name || 'League'

  const { data: memberData } = await sb.rpc('get_league_member_ids', { p_league_id: leagueId })
  const memberIds: string[] = (memberData ?? []).map((r: any) => r.profile_id)
  if (!memberIds.length) return NextResponse.json({ rows: [], season, week, leagueId, leagueName })

  const { data: profs } = await sb.from('profiles').select('id, display_name, email, preferred_color').in('id', memberIds)
  const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]))

  // Get picks with winless_double flag
  let picks: any[] = []
  if (week) {
    const { data: p } = await sb.from('picks').select('id, profile_id, team_id, game_id, week, winless_double').eq('league_id', leagueId).eq('season', season).eq('week', week)
    picks = (p ?? []).map((pick: any) => ({
      ...pick,
      wrinkle_kind: pick.winless_double ? 'winless_double' : undefined
    }))
  } else {
    const { data: p } = await sb.from('picks').select('id, profile_id, team_id, game_id, week, winless_double').eq('league_id', leagueId).eq('season', season)
    picks = (p ?? []).map((pick: any) => ({
      ...pick,
      wrinkle_kind: pick.winless_double ? 'winless_double' : undefined
    }))
  }

  // Wrinkles with kind
  const { data: wrs } = await sb.from('wrinkles').select('id, week, kind').eq('league_id', leagueId).eq('season', season)
  const wrinkleIndex = new Map((wrs ?? []).map((w: any) => [w.id, { week: w.week, kind: w.kind }]))

  const { data: wrPicks } = await sb.from('wrinkle_picks').select('id, profile_id, team_id, game_id, wrinkle_id')
  const wrinklePicks = (wrPicks ?? [])
    .filter((r: any) => wrinkleIndex.has(r.wrinkle_id))
    .map((r: any) => {
      const wr = wrinkleIndex.get(r.wrinkle_id)!
      return {
        id: r.id,
        profile_id: r.profile_id,
        team_id: r.team_id,
        game_id: r.game_id,
        week: wr.week,
        wrinkle_kind: wr.kind
      }
    })
    .filter((p: any) => !week || p.week === week)

  const gameIds = Array.from(new Set([...picks, ...wrinklePicks].map((p: any) => p.game_id).filter(Boolean))) as string[]
  const { data: games } = await sb.from('games').select('id, home_team, away_team, home_score, away_score, status, game_utc').in('id', gameIds)
  const gamesMap = new Map((games ?? []).map((g: any) => [g.id, g as GameRow]))

  const rows = memberIds.map((mid: string) => {
    const prof = profMap.get(mid)
    const display = ((prof?.display_name as string | null) || String(prof?.email).split('@')[0] || 'Member') as string

    const myPicks = picks.filter(p => p.profile_id === mid)
    const myWrn = wrinklePicks.filter(p => p.profile_id === mid)

    const events = [...myPicks, ...myWrn].map(p => {
      const g = gamesMap.get(p.game_id)
      const when = g?.game_utc ? Date.parse(g.game_utc) : 0
      const correct = g ? isCorrect(g, p.team_id) : false
      let pts = g ? winnerScore(g, p.team_id) : 0
      
      // Double points for winless_double
      if (p.wrinkle_kind === 'winless_double' && pts > 0) {
        pts = pts * 2
      }
      
      const isWrinkle = !!p.wrinkle_kind
      const wrinkleKind = p.wrinkle_kind
      return { when, correct, pts, isWrinkle, wrinkleKind }
    }).sort((a, b) => a.when - b.when)

    let cur = 0, best = 0, correctCount = 0, totalPts = 0
    
    // FIXED: Wrinkle points calculation
    let wrinklePts = 0
    for (const e of events) {
      totalPts += e.pts
      if (e.isWrinkle) {
        // For winless_double, only count half (the base points)
        if (e.wrinkleKind === 'winless_double') {
          wrinklePts += e.pts / 2
        } else {
          wrinklePts += e.pts
        }
      }
      if (e.correct) { correctCount += 1; cur += 1; best = Math.max(best, cur) } else { cur = 0 }
    }

    return {
      profile_id: mid,
      display_name: display,
      preferred_color: prof?.preferred_color || null,
      points: Number(totalPts),
      correct: correctCount,
      longest_streak: best,
      wrinkle_points: Number(wrinklePts.toFixed(1)),
    }
  })

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
    { rows: final, season, week: week ?? null, leagueId, leagueName },
    { headers: { 'cache-control': 'no-store' } }
  )
}

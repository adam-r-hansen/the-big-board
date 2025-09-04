// app/api/league-picks-week/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

function statusFor(game: any): 'LIVE' | 'FINAL' | 'UPCOMING' {
  const raw = (game?.status || '').toUpperCase()
  if (raw === 'FINAL' || raw === 'LIVE') return raw as any
  const utc = game?.game_utc || game?.start_time
  if (utc && new Date(utc) <= new Date()) return 'LIVE'
  return 'UPCOMING'
}

// scoring per your rules
function pointsForPick(pickTeamId: string, game: any): number {
  const s = statusFor(game)
  if (s !== 'FINAL') return 0
  const hs = typeof game?.home_score === 'number' ? game.home_score : null
  const as = typeof game?.away_score === 'number' ? game.away_score : null
  const homeId = game?.home_team ?? game?.homeTeamId ?? game?.home?.id
  const awayId = game?.away_team ?? game?.awayTeamId ?? game?.away?.id
  if (hs == null || as == null) return 0
  if (hs === as) {
    if (pickTeamId === homeId) return hs / 2
    if (pickTeamId === awayId) return as / 2
    return 0
  }
  if (hs > as) return pickTeamId === homeId ? hs : 0
  return pickTeamId === awayId ? as : 0
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const leagueId = url.searchParams.get('leagueId') || ''
  const season = Number(url.searchParams.get('season') || '0')
  const week = Number(url.searchParams.get('week') || '0')

  if (!leagueId || !season || !week) {
    return j({ error: 'leagueId, season, week required' }, 400)
  }

  const supabase = await createClient()
  const { data: auth, error: aErr } = await supabase.auth.getUser()
  if (aErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)
  const uid = auth.user.id

  // membership check (privacy)
  const { data: mem, error: mErr } = await supabase
    .from('league_memberships')
    .select('league_id')
    .eq('profile_id', uid)
    .eq('league_id', leagueId)
    .maybeSingle()
  if (mErr) return j({ error: mErr.message }, 400)
  if (!mem) return j({ error: 'forbidden' }, 403)

  // load picks for this league/week with joined game + profile (display name)
  // only include rows with game_id not null (weekly picks)
  const { data: rows, error: pErr } = await supabase
    .from('picks')
    .select(
      `
        id,
        profile_id,
        team_id,
        game_id,
        profiles:profile_id ( id, display_name, full_name, email ),
        games:game_id ( id, game_utc, status, home_team, away_team, home_score, away_score )
      `
    )
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .not('game_id', 'is', null)

  if (pErr) return j({ error: pErr.message }, 400)

  // compute status and filter to LOCKED (LIVE/FINAL)
  const locked = (rows || []).filter((r: any) => {
    const s = statusFor(r.games)
    return s === 'LIVE' || s === 'FINAL'
  })

  // group by member
  const byMember = new Map<
    string,
    { profile_id: string; display_name: string; picks: any[]; points_week: number }
  >()

  for (const r of locked) {
    const prof = r.profiles || {}
    const display =
      prof.display_name ||
      prof.full_name ||
      (prof.email ? String(prof.email).split('@')[0] : 'Member')
    const s = statusFor(r.games)
    const pts = s === 'FINAL' ? pointsForPick(r.team_id, r.games) : 0

    if (!byMember.has(r.profile_id)) {
      byMember.set(r.profile_id, {
        profile_id: r.profile_id,
        display_name: display,
        picks: [],
        points_week: 0,
      })
    }
    const bucket = byMember.get(r.profile_id)!
    bucket.picks.push({
      game_id: r.game_id,
      team_id: r.team_id,
      status: s,
      points: s === 'FINAL' ? pts : null,
    })
    if (s === 'FINAL') bucket.points_week += pts
  }

  // alphabetical by display_name
  const members = Array.from(byMember.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  )

  return j({ members }, 200)
}

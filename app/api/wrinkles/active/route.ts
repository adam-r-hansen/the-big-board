// app/api/wrinkles/active/route.ts
import { NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'

type WinlessParams = {
  multiplier?: number
  eligibleTeamIds?: string[]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const leagueId = url.searchParams.get('leagueId') || ''
  const season = Number(url.searchParams.get('season') || '')
  const week = Number(url.searchParams.get('week') || '')

  if (!leagueId || !season || !week) {
    return NextResponse.json({ error: 'leagueId, season, week are required' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  // 1) Fetch active wrinkles for this league/season/week
  const { data: wrinkleRows, error: wrErr } = await supabase
    .from('wrinkles')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'active')

  if (wrErr) {
    return NextResponse.json({ error: wrErr.message }, { status: 500 })
  }

  const wrinkles = (wrinkleRows || []).map((w) => ({
    id: w.id,
    league_id: w.league_id,
    season: w.season,
    week: w.week,
    name: w.name,
    status: w.status,
    extra_picks: w.extra_picks ?? 0,
    kind: w.kind,
    config: typeof w.config === 'string' ? safeJson(w.config) : (w.config ?? {}),
  }))

  // 2) If we have a winless_double wrinkle, compute eligible teams (0 wins before this week)
  const winless = wrinkles.find((w) => String(w.kind).toLowerCase() === 'winless_double')
  if (winless) {
    // optional multiplier in config; default to 2
    const multiplier =
      (winless.config && typeof winless.config.multiplier === 'number' && winless.config.multiplier > 0
        ? winless.config.multiplier
        : 2)

    // Pull FINAL games strictly earlier than this week in the same season
    const { data: finals, error: gErr } = await supabase
      .from('games')
      .select('home_team, away_team, home_score, away_score')
      .eq('season', season)
      .lt('week', week)
      .eq('status', 'FINAL')

    if (gErr) {
      // return wrinkle without params if we fail to compute
      return NextResponse.json({ wrinkles }, { status: 200 })
    }

    // Compute all teams that appeared and their wins
    const appeared = new Set<string>()
    const wins = new Map<string, number>()

    for (const g of finals || []) {
      const home = String(g.home_team)
      const away = String(g.away_team)
      appeared.add(home)
      appeared.add(away)

      const hs = typeof g.home_score === 'number' ? g.home_score : null
      const as = typeof g.away_score === 'number' ? g.away_score : null
      if (hs == null || as == null) continue
      if (hs === as) continue // ties not counted as wins

      const winner = hs > as ? home : away
      wins.set(winner, (wins.get(winner) || 0) + 1)
    }

    const eligibleTeamIds: string[] = []
    for (const id of appeared) {
      if ((wins.get(id) || 0) === 0) eligibleTeamIds.push(id)
    }

    ;(winless as any).params = { multiplier, eligibleTeamIds } as WinlessParams
  }

  return NextResponse.json({ wrinkles }, { status: 200 })
}

function safeJson(s: any) {
  try {
    return typeof s === 'string' ? JSON.parse(s) : s
  } catch {
    return {}
  }
}

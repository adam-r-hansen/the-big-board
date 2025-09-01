// app/api/wrinkles/active/route.ts
import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const leagueId = url.searchParams.get('leagueId') ?? ''
  const season = Number(url.searchParams.get('season') ?? '0')
  const week = Number(url.searchParams.get('week') ?? '0')

  if (!leagueId || !season || !week) {
    return json({ error: 'leagueId, season, week are required' }, { status: 400 })
  }

  const sb = supabaseServer()

  // Get the active wrinkle for the week
  const { data: wrks, error: wErr } = await sb
    .from('wrinkles')
    .select('id, league_id, season, week, name, status, kind, extra_picks')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'active')
    .limit(1)

  if (wErr) return json({ error: wErr.message }, { status: 500 })

  const base = wrks?.[0]
  if (!base) return json({ wrinkle: null })

  // Pull any linked games (what the hero needs to show / pick)
  const { data: games, error: gErr } = await sb
    .from('wrinkle_games')
    .select('id, wrinkle_id, game_id, home_team, away_team, game_utc, status')
    .eq('wrinkle_id', base.id)
    .order('game_utc', { ascending: true })

  if (gErr) return json({ error: gErr.message }, { status: 500 })

  return json({ wrinkle: { ...base, games: games ?? [] } })
}


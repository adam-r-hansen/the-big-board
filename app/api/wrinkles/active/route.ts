// app/api/wrinkles/active/route.ts
import type { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma', 'no-cache'); h.set('Expires', '0'); h.set('Surrogate-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const leagueId = url.searchParams.get('leagueId') ?? ''
    const season = Number(url.searchParams.get('season') ?? '')
    const week = Number(url.searchParams.get('week') ?? '')
    if (!leagueId || !season || !week) {
      return jsonNoStore({ error: 'missing params (leagueId, season, week)' }, { status: 400 })
    }

    const sb = supabaseServer()

    // Select ONLY columns we know exist. (No 'spread' or 'min_win_pct'.)
    const { data, error } = await sb
      .from('wrinkles')
      .select(`
        id, league_id, season, week, name, status,
        wrinkle_games ( id, game_id, game_utc, home_team, away_team, status )
      `)
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('week', week)
      .eq('status', 'active')

    if (error) return jsonNoStore({ error: error.message }, { status: 500 })

    return jsonNoStore({ wrinkles: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'server error'
    return jsonNoStore({ error: msg }, { status: 500 })
  }
}

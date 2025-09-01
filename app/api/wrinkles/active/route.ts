// app/api/wrinkles/active/route.ts
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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
  const sb = createServerClient({ req })
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  const season = Number(searchParams.get('season') || '0')
  const week = Number(searchParams.get('week') || '0')

  if (!leagueId || !season || !week) {
    return jsonNoStore({ error: 'leagueId, season, week are required' }, { status: 400 })
  }

  const { data: wrinkles, error: wErr } = await sb
    .from('wrinkles')
    .select('id, league_id, season, week, name, status, extra_picks, created_at')
    .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('status','active')
    .order('created_at', { ascending: true })
  if (wErr) return jsonNoStore({ error: wErr.message }, { status: 500 })

  const ids = (wrinkles ?? []).map(w => w.id)
  let gamesByWrinkle: Record<string, any[]> = {}
  let myPicks: any[] = []

  if (ids.length) {
    const { data: wg, error: gErr } = await sb
      .from('wrinkle_games')
      .select('id, wrinkle_id, game_utc, home_team, away_team, home_score, away_score, status')
      .in('wrinkle_id', ids)
    if (gErr) return jsonNoStore({ error: gErr.message }, { status: 500 })
    for (const g of wg ?? []) {
      if (!gamesByWrinkle[g.wrinkle_id]) gamesByWrinkle[g.wrinkle_id] = []
      gamesByWrinkle[g.wrinkle_id].push(g)
    }

    const { data: picks, error: pErr } = await sb
      .from('wrinkle_picks')
      .select('id, wrinkle_id, game_id, team_id, created_at')
      .in('wrinkle_id', ids)
    if (pErr) return jsonNoStore({ error: pErr.message }, { status: 500 })
    myPicks = picks ?? []
  }

  return jsonNoStore({ wrinkles: wrinkles ?? [], gamesByWrinkle, myPicks })
}

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma','no-cache'); h.set('Expires','0'); h.set('Surrogate-Control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const leagueId = url.searchParams.get('leagueId') || ''
    const seasonStr = url.searchParams.get('season') || ''
    const weekStr = url.searchParams.get('week') || ''
    const season = seasonStr ? Number(seasonStr) : undefined
    const week = weekStr ? Number(weekStr) : undefined

    const sb = await createClient()
    const { data: auth } = await sb.auth.getUser()
    const user = auth?.user
    if (!user) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

    let q = sb.from('picks')
      .select('id, team_id, game_id, league_id, season, week')
      .eq('profile_id', user.id)

    if (leagueId) q = q.eq('league_id', leagueId)
    if (Number.isFinite(season)) q = q.eq('season', season as number)
    if (Number.isFinite(week)) q = q.eq('week', week as number)

    // no fragile order on a possibly missing column
    const { data, error } = await q
    if (error) return jsonNoStore({ error: error.message }, { status: 500 })

    return jsonNoStore({ picks: data ?? [] })
  } catch (e: any) {
    console.error('my-picks error:', e?.message || e)
    return jsonNoStore({ error: 'internal error' }, { status: 500 })
  }
}

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
    const leagueId = url.searchParams.get('leagueId') ?? ''
    const seasonStr = url.searchParams.get('season') ?? ''
    const weekStr = url.searchParams.get('week') ?? ''
    const season = Number(seasonStr)
    const week = Number(weekStr)

    // If any param missing/invalid, don't block user—return empty set
    if (!leagueId || !Number.isFinite(season) || !Number.isFinite(week)) {
      return jsonNoStore({ used: [] })
    }

    const sb = await createClient()
    const { data: auth } = await sb.auth.getUser()
    const user = auth?.user
    if (!user) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

    // Only teams used in PRIOR weeks count as "used so far"
    const { data, error } = await sb
      .from('picks')
      .select('team_id, week')
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('profile_id', user.id)
      .lt('week', week)

    if (error) return jsonNoStore({ error: error.message }, { status: 500 })
    const used = Array.from(new Set((data ?? []).map(r => r.team_id))).filter(Boolean)
    return jsonNoStore({ used })
  } catch (e: any) {
    console.error('used-teams error:', e?.message || e)
    return jsonNoStore({ error: 'internal error' }, { status: 500 })
  }
}

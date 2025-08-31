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
async function requireAdmin(sb: any, leagueId: string) {
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) throw new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
  const { data: me, error } = await sb.from('league_members').select('role').eq('league_id', leagueId).eq('profile_id', u.id).maybeSingle()
  if (error) throw new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!me || !['owner','admin'].includes(me.role)) throw new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  return u.id
}

export async function POST(req: NextRequest) {
  const { leagueId, season, week, teamId, gameId, profileId } = await req.json().catch(()=> ({} as any))
  if (!leagueId || !profileId || !Number.isFinite(season) || !Number.isFinite(week) || !teamId) {
    return jsonNoStore({ error: 'leagueId, profileId, season, week, teamId required' }, { status: 400 })
  }
  const sb = await createClient()
  try { await requireAdmin(sb, leagueId) } catch (r: any) { return r }

  const { error } = await sb.from('picks').insert([{
    league_id: leagueId, profile_id: profileId, season, week, team_id: teamId, game_id: gameId ?? null
  }])
  if (error) return jsonNoStore({ error: error.message }, { status: 500 })
  return jsonNoStore({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const leagueId  = url.searchParams.get('leagueId') || undefined
  const profileId = url.searchParams.get('profileId') || undefined
  const season    = url.searchParams.get('season') ? Number(url.searchParams.get('season')) : undefined
  const week      = url.searchParams.get('week') ? Number(url.searchParams.get('week')) : undefined
  const teamId    = url.searchParams.get('teamId') || undefined
  const id        = url.searchParams.get('id') || undefined
  if (!leagueId) return jsonNoStore({ error: 'leagueId required' }, { status: 400 })
  const sb = await createClient()
  try { await requireAdmin(sb, leagueId) } catch (r: any) { return r }

  if (id) {
    const { error } = await sb.from('picks').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, { status: 500 })
    return jsonNoStore({ ok: true })
  }
  if (!profileId || !Number.isFinite(season) || !Number.isFinite(week) || !teamId) {
    return jsonNoStore({ error: 'id OR (profileId, season, week, teamId) required' }, { status: 400 })
  }
  const { error } = await sb.from('picks')
    .delete()
    .eq('league_id', leagueId)
    .eq('profile_id', profileId)
    .eq('season', season as number)
    .eq('week', week as number)
    .eq('team_id', teamId)
  if (error) return jsonNoStore({ error: error.message }, { status: 500 })
  return jsonNoStore({ ok: true })
}

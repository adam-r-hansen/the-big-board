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

export async function POST(req: NextRequest) {
  const { leagueId, email, role } = await req.json().catch(()=> ({} as any))
  if (!leagueId || !email || !role) return jsonNoStore({ error: 'leagueId, email, role required' }, { status: 400 })
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

  // ensure caller admin of the league
  const { data: me, error: meErr } = await sb.from('league_members')
    .select('role').eq('league_id', leagueId).eq('profile_id', u.id).maybeSingle()
  if (meErr) return jsonNoStore({ error: meErr.message }, { status: 500 })
  if (!me || !['owner','admin'].includes(me.role)) return jsonNoStore({ error: 'forbidden' }, { status: 403 })

  const { data, error } = await sb.from('league_invites')
    .insert([{ league_id: leagueId, email, role }])
    .select('id, token, expires_at').maybeSingle()
  if (error) return jsonNoStore({ error: error.message }, { status: 500 })

  // For MVP we just return token; later, send an email.
  return jsonNoStore({ ok: true, invite: data })
}

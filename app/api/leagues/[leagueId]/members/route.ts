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
const isAdminRole = (r?: string) => r === 'admin' || r === 'owner'

export async function GET(_: NextRequest, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

  const { data: me, error: meErr } = await sb
    .from('league_members').select('role').eq('league_id', leagueId).eq('profile_id', u.id).maybeSingle()
  if (meErr) return jsonNoStore({ error: meErr.message }, { status: 500 })
  if (!isAdminRole(me?.role)) return jsonNoStore({ error: 'forbidden' }, { status: 403 })

  const { data, error } = await sb
    .from('league_members')
    .select('profile_id, role, profiles(id, display_name, email)')
    .eq('league_id', leagueId)
    .order('role', { ascending: false })
  if (error) return jsonNoStore({ error: error.message }, { status: 500 })

  const members = (data ?? []).map((m: any) => ({
    profile_id: m.profile_id,
    role: m.role,
    name: m.profiles?.display_name ?? m.profiles?.email ?? m.profile_id,
    email: m.profiles?.email ?? null,
  }))
  return jsonNoStore({ members })
}

// POST { email, role? } -> add member by email (admin/member)
export async function POST(req: NextRequest, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const body = await req.json().catch(() => null) as { email?: string; role?: 'admin'|'member' } | null
  if (!body?.email) return jsonNoStore({ error: 'email required' }, { status: 400 })
  const role = (body.role === 'admin' ? 'admin' : 'member') as 'admin'|'member'

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

  const { data: me, error: meErr } = await sb
    .from('league_members').select('role').eq('league_id', leagueId).eq('profile_id', u.id).maybeSingle()
  if (meErr) return jsonNoStore({ error: meErr.message }, { status: 500 })
  if (!isAdminRole(me?.role)) return jsonNoStore({ error: 'forbidden' }, { status: 403 })

  const { data: prof, error: pErr } = await sb
    .from('profiles')
    .select('id, email, display_name')
    .eq('email', body.email.toLowerCase())
    .maybeSingle()
  if (pErr) return jsonNoStore({ error: pErr.message }, { status: 500 })
  if (!prof?.id) return jsonNoStore({ error: 'user not found (no profile with that email)' }, { status: 404 })

  const { error: mErr } = await sb
    .from('league_members')
    .upsert({ league_id: leagueId, profile_id: prof.id, role }, { onConflict: 'league_id,profile_id' })
  if (mErr) return jsonNoStore({ error: mErr.message }, { status: 500 })

  return jsonNoStore({ ok: true })
}

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

// GET: leagues where I'm admin or owner
export async function GET(_req: NextRequest) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await sb
    .from('league_members')
    .select('role, leagues(id, name, season)')
    .eq('profile_id', u.id)
    .in('role', ['admin', 'owner'])
    .order('season', { referencedTable: 'leagues', ascending: false })

  if (error) return jsonNoStore({ error: error.message }, { status: 500 })

  const leagues = (data ?? [])
    .map((r: any) => ({ id: r.leagues?.id, name: r.leagues?.name, season: r.leagues?.season, role: r.role }))
    .filter((x: any) => x.id)
  return jsonNoStore({ leagues })
}

// POST: create league, then add creator as ADMIN (not owner)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { name?: string; season?: number } | null
  if (!body?.name || !Number.isFinite(body?.season)) {
    return jsonNoStore({ error: 'name and season required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

  // Create league
  const { data: created, error: cErr } = await sb
    .from('leagues')
    .insert([{ name: body.name.trim(), season: Number(body.season) }])
    .select('id, name, season')
    .maybeSingle()

  if (cErr || !created?.id) {
    return jsonNoStore({ error: cErr?.message || 'create failed' }, { status: 500 })
  }

  // Add membership (admin role)
  const { error: mErr } = await sb
    .from('league_members')
    .insert([{ league_id: created.id, profile_id: u.id, role: 'admin' }])

  if (mErr) {
    // best effort rollback of the league if membership insert fails
    await sb.from('leagues').delete().eq('id', created.id)
    return jsonNoStore({ error: mErr.message }, { status: 500 })
  }

  return jsonNoStore({ ok: true, league: created })
}

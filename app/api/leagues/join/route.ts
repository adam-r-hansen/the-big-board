// app/api/leagues/join/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

/**
 * POST /api/leagues/join
 * Body: { leagueId: "uuid" }  → creates membership if it doesn't exist.
 *
 * Table expectation: public.league_memberships (id, league_id uuid, profile_id uuid, role text?)
 * RLS: allow insert when profile_id = auth.uid()
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}
  const leagueId = (body?.leagueId || '').trim()
  if (!leagueId) return j({ error: 'leagueId required' }, 400)

  // Is user already a member?
  const { data: existing, error: selErr } = await supabase
    .from('league_memberships')
    .select('id')
    .eq('league_id', leagueId)
    .eq('profile_id', auth.user.id)
    .maybeSingle()

  if (selErr) return j({ error: selErr.message }, 400)
  if (existing) return j({ ok: true, already: true }, 200)

  // Insert membership (role optional; omit if your table doesn't have it)
  const { data: ins, error: insErr } = await supabase
    .from('league_memberships')
    .insert({ league_id: leagueId, profile_id: auth.user.id })
    .select('id')
    .single()

  if (insErr) return j({ error: insErr.message }, 400)
  return j({ ok: true, id: ins?.id }, 200)
}

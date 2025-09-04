// app/api/leagues/route.ts
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

async function client() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

/** GET /api/leagues  → ONLY leagues the user is a member of */
export async function GET() {
  const { supabase, user, error } = await client()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { data: mems, error: mErr } = await supabase
    .from('league_memberships')
    .select('league_id')
    .eq('profile_id', user.id)

  if (mErr) return j({ error: mErr.message }, 400)
  const ids = (mems ?? []).map((m: any) => m.league_id).filter(Boolean)
  if (ids.length === 0) return j({ leagues: [] }, 200)

  const { data, error: dbErr } = await supabase
    .from('leagues')
    .select('id, name, season, created_at')
    .in('id', ids)
    .order('created_at', { ascending: false })

  if (dbErr) return j({ error: dbErr.message }, 400)
  return j({ leagues: data ?? [] }, 200)
}

/** POST /api/leagues  Body: { name: string, season: number } + auto-join creator */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await client()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}
  const name = (body?.name || '').trim()
  const season = Number(body?.season || 0)
  if (!name || !season) return j({ error: 'name and season required' }, 400)

  const { data: league, error: insErr } = await supabase
    .from('leagues')
    .insert({ name, season })
    .select('id')
    .single()

  if (insErr) return j({ error: insErr.message }, 400)

  // Auto-join creator (idempotent)
  try {
    await supabase
      .from('league_memberships')
      .upsert(
        { league_id: league!.id, profile_id: user.id, role: 'member' },
        { onConflict: 'league_id,profile_id' }
      )
  } catch {}

  return j({ ok: true, id: league?.id }, 200)
}

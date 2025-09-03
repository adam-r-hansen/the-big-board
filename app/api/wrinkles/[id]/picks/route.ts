// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Next 14/15 compat: context.params may be object OR Promise
type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function resolveParams(ctx: Ctx): Promise<{ id: string }> {
  const p: any = (ctx as any).params
  return typeof p?.then === 'function' ? await p : p
}

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

async function getUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

// GET /api/wrinkles/:id/picks -> { picks: [...] }
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await resolveParams(ctx)
  const { supabase, user, error } = await getUser()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { data, error: dbErr } = await supabase
    .from('wrinkle_picks')
    .select('id, team_id, game_id')
    .eq('wrinkle_id', id)
    .eq('profile_id', user.id)

  if (dbErr) return j({ error: dbErr.message }, 400)
  return j({ picks: data ?? [] }, 200)
}

// POST /api/wrinkles/:id/picks  Body: { teamId, gameId|null } -> { ok, id }
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await resolveParams(ctx)
  const { supabase, user, error } = await getUser()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}
  const teamId = body?.teamId as string | undefined
  const gameId = (body?.gameId ?? null) as string | null
  if (!teamId) return j({ error: 'teamId required' }, 400)

  const { data, error: dbErr } = await supabase
    .from('wrinkle_picks')
    .insert({ wrinkle_id: id, profile_id: user.id, team_id: teamId, game_id: gameId })
    .select('id')
    .single()

  if (dbErr) return j({ error: dbErr.message }, 400)
  return j({ ok: true, id: data?.id }, 200)
}

// DELETE /api/wrinkles/:id/picks?id=pickUuid -> { ok: true }
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id: wrinkleId } = await resolveParams(ctx)
  const { supabase, user, error } = await getUser()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id')
  if (!pickId) return j({ error: 'id required' }, 400)

  const { error: dbErr } = await supabase
    .from('wrinkle_picks')
    .delete()
    .eq('id', pickId)
    .eq('profile_id', user.id)

  if (dbErr) return j({ error: dbErr.message }, 400)
  return j({ ok: true }, 200)
}


// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic' // avoid caching

// --- Compat helpers (Next 14/15: params may be object OR Promise) ---
type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> }

async function resolveParams(ctx: Ctx): Promise<{ id: string }> {
  const p: any = (ctx as any).params
  return typeof p?.then === 'function' ? await p : p
}

// --- tiny JSON helper with no-store ---
function json(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

async function getUser() {
  // ✅ your helper returns a Promise — await it
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

// GET /api/wrinkles/:id/picks
// -> { picks: [ { id, team_id, game_id } ] }
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await resolveParams(ctx)
  const { supabase, user, error } = await getUser()
  if (error || !user) return json({ error: 'unauthenticated' }, 401)

  const { data, error: dbErr } = await supabase
    .from('wrinkle_picks')
    .select('id, team_id, game_id')
    .eq('wrinkle_id', id)
    .eq('profile_id', user.id)
    .order('id', { ascending: true })

  if (dbErr) return json({ error: dbErr.message }, 400)
  return json({ picks: data ?? [] }, 200)
}

// POST /api/wrinkles/:id/picks
// Body: { teamId: "uuid|text", gameId: "uuid|null" }
// -> { ok: true, id: "uuid" }
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await resolveParams(ctx)
  const { supabase, user, error } = await getUser()
  if (error || !user) return json({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const teamId = body?.teamId as string | undefined
  const gameId = (body?.gameId ?? null) as string | null
  if (!teamId) return json({ error: 'teamId required' }, 400)

  const { data, error: dbErr } = await supabase
    .from('wrinkle_picks')
    .insert({
      wrinkle_id: id,
      profile_id: user.id, // satisfies RLS WITH CHECK
      team_id: teamId,
      game_id: gameId,
    })
    .select('id')
    .single()

  if (dbErr) return json({ error: dbErr.message }, 400)
  return json({ ok: true, id: data?.id }, 200)
}

// DELETE /api/wrinkles/:id/picks?id=pickUuid
// -> { ok: true }
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id: wrinkleId } = await resolveParams(ctx)
  const { supabase, user, error } = await getUser()
  if (error || !user) return json({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id')
  if (!pickId) return json({ error: 'id required' }, 400)

  const { error: dbErr } = await supabase
    .from('wrinkle_picks')
    .delete()
    .eq('id', pickId)
    .eq('profile_id', user.id)

  if (dbErr) return json({ error: dbErr.message }, 400)
  return json({ ok: true }, 200)
}


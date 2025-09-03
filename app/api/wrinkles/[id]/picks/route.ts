// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Next 14/15 compat: params may be object OR Promise
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

async function getClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

// Lock helper (same idea as weekly picks). If games table missing, skip instead of 500.
async function isLocked(supabase: any, gameId?: string | null): Promise<{ locked: boolean; why?: string }> {
  if (!gameId) return { locked: false }
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, game_utc, status')
      .eq('id', gameId)
      .maybeSingle()
    if (error) return { locked: false }
    const utc = data?.game_utc as string | undefined
    if (utc && new Date(utc) <= new Date()) return { locked: true, why: 'game is locked (kickoff passed)' }
    if ((data?.status || '').toUpperCase() === 'FINAL') return { locked: true, why: 'game is locked (kickoff passed)' }
    return { locked: false }
  } catch {
    return { locked: false }
  }
}

// GET /api/wrinkles/:id/picks  -> { picks: [ { id, team_id, game_id } ] }
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await resolveParams(ctx)
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { data, error: dbErr } = await supabase
    .from('wrinkle_picks')
    .select('id, team_id, game_id')
    .eq('wrinkle_id', id)
    .eq('profile_id', user.id)

  if (dbErr) return j({ error: dbErr.message }, 400)
  return j({ picks: data ?? [] }, 200)
}

// POST /api/wrinkles/:id/picks
// Body: { teamId: "uuid|text", gameId: "uuid|null" }
// Behavior: upsert on (wrinkle_id, profile_id, game_id) so user can flip sides without duplicate errors.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await resolveParams(ctx)
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}
  const teamId = body?.teamId as string | undefined
  const gameId = (body?.gameId ?? null) as string | null
  if (!teamId) return j({ error: 'teamId required' }, 400)

  // respect lock if we know the game
  const lock = await isLocked(supabase, gameId)
  if (lock.locked) return j({ error: lock.why }, 400)

  // ✅ UPSERT so we update team when the same wrinkle/profile/game already exists
  const { data, error: upErr } = await supabase
    .from('wrinkle_picks')
    .upsert(
      { wrinkle_id: id, profile_id: user.id, game_id: gameId, team_id: teamId },
      { onConflict: 'wrinkle_id,profile_id,game_id' }
    )
    .select('id')
    .single()

  if (upErr) return j({ error: upErr.message }, 400)
  return j({ ok: true, id: data?.id }, 200)
}

// DELETE /api/wrinkles/:id/picks?id=pickUuid  -> { ok: true }
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id: wrinkleId } = await resolveParams(ctx)
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id')
  if (!pickId) return j({ error: 'id required' }, 400)

  // enforce lock before deleting
  const { data: row, error: rowErr } = await supabase
    .from('wrinkle_picks')
    .select('id, game_id')
    .eq('id', pickId)
    .eq('profile_id', user.id)
    .maybeSingle()
  if (rowErr) return j({ error: rowErr.message }, 400)

  const lock = await isLocked(supabase, row?.game_id ?? null)
  if (lock.locked) return j({ error: lock.why }, 400)

  const { error: delErr } = await supabase
    .from('wrinkle_picks')
    .delete()
    .eq('id', pickId)
    .eq('profile_id', user.id)

  if (delErr) return j({ error: delErr.message }, 400)
  return j({ ok: true }, 200)
}


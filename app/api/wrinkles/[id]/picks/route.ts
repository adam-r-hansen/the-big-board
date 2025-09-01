// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: unknown, init?: number | ResponseInit) {
  const status = typeof init === 'number' ? init : undefined
  const initObj = typeof init === 'object' ? init : undefined
  return NextResponse.json(data, {
    status,
    ...initObj,
    headers: { 'cache-control': 'no-store' },
  })
}

/** Next 15 compat: params may be a Promise */
type ParamCtx = { params: Promise<{ id: string }> } | { params: { id: string } }
async function getId(ctx: ParamCtx) {
  const p: any = (ctx as any)?.params
  return p && typeof p.then === 'function' ? (await p).id : p.id
}

/** Next 15 compat: cookies() may return a Promise */
async function sbFromRequest() {
  const storeMaybe = (nextCookies as any)()
  const store = storeMaybe && typeof storeMaybe.then === 'function'
    ? await storeMaybe
    : storeMaybe

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return store.getAll() },
        setAll(cs) { cs.forEach((c: any) => store.set(c.name, c.value)) },
      },
    },
  )
}

// GET /api/wrinkles/:id/picks → caller’s pick for that wrinkle (if any)
export async function GET(req: NextRequest, context: ParamCtx) {
  const id = await getId(context)
  const supabase = await sbFromRequest()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthorized' }, 401)

  const { data, error } = await supabase
    .from('wrinkle_picks')
    .select('*')
    .eq('wrinkle_id', id)
    .eq('user_id', auth.user.id)
    .limit(1)

  if (error) return json({ error: error.message }, 500)
  const pick = (data ?? [])[0] || null
  return json({ pick })
}

// POST /api/wrinkles/:id/picks → make/update pick
// Body: { teamId, gameId? } — if multiple games linked, gameId required.
export async function POST(req: NextRequest, context: ParamCtx) {
  const id = await getId(context)
  const supabase = await sbFromRequest()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthorized' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}
  const teamId: string | undefined = body?.teamId
  let gameId: string | undefined = body?.gameId
  if (!teamId) return json({ error: 'teamId required' }, 400)

  // Wrinkle exists
  const { data: w, error: wErr } = await supabase
    .from('wrinkles')
    .select('id, league_id, season, week')
    .eq('id', id)
    .single()
  if (wErr || !w) return json({ error: wErr?.message ?? 'wrinkle not found' }, 404)

  // Caller is a member of the wrinkle’s league
  const { data: mem, error: memErr } = await supabase
    .from('league_members')
    .select('profile_id')
    .eq('league_id', w.league_id)
    .eq('profile_id', auth.user.id)
    .limit(1)
  if (memErr) return json({ error: memErr.message }, 500)
  if (!mem || mem.length === 0) return json({ error: 'forbidden' }, 403)

  // Allowed games linked to the wrinkle
  const { data: wg, error: wgErr } = await supabase
    .from('wrinkle_games')
    .select('game_id, home_team, away_team')
    .eq('wrinkle_id', id)
  if (wgErr) return json({ error: wgErr.message }, 500)
  const linked = wg ?? []

  if (!gameId) {
    if (linked.length === 0) return json({ error: 'no games linked to wrinkle' }, 400)
    if (linked.length > 1) return json({ error: 'gameId required when multiple games are linked' }, 400)
    gameId = linked[0].game_id
  }

  // If we know the link for that game, validate team belongs to it
  const link = linked.find(g => g.game_id === gameId)
  if (link && !(link.home_team === teamId || link.away_team === teamId)) {
    return json({ error: 'team not in selected wrinkle game' }, 400)
  }

  // Upsert pick (unique on wrinkle_id,user_id)
  const upsertRow = {
    wrinkle_id: id,
    user_id: auth.user.id,
    game_id: gameId!,
    team_id: teamId,
  }

  const { data: up, error: upErr } = await supabase
    .from('wrinkle_picks')
    .upsert(upsertRow, { onConflict: 'wrinkle_id,user_id' })
    .select('*')
    .single()

  if (upErr) return json({ error: upErr.message }, 500)
  return json({ pick: up })
}

// DELETE /api/wrinkles/:id/picks?id=<pickId>
export async function DELETE(req: NextRequest, context: ParamCtx) {
  const id = await getId(context) // id not used, but keep signature consistent
  const supabase = await sbFromRequest()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthorized' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id')
  if (!pickId) return json({ error: 'id required' }, 400)

  const { error } = await supabase
    .from('wrinkle_picks')
    .delete()
    .eq('id', pickId)
    .eq('user_id', auth.user.id)

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}


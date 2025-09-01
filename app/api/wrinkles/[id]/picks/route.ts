// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseServer } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: unknown, init?: number | ResponseInit) {
  const status = typeof init === 'number' ? init : undefined
  const initObj = typeof init === 'object' ? init : undefined
  return NextResponse.json(data, { status, ...initObj, headers: { 'cache-control': 'no-store' } })
}

type ParamCtx = { params: Promise<{ id: string }> } | { params: { id: string } }
async function getId(ctx: ParamCtx) {
  const p: any = (ctx as any)?.params
  return p && typeof p.then === 'function' ? (await p).id : p.id
}

async function sbFromRequest() {
  const storeMaybe = (nextCookies as any)()
  const store = storeMaybe && typeof storeMaybe.then === 'function' ? await storeMaybe : storeMaybe
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

// GET → caller’s wrinkle pick (if any)
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
  return json({ pick: (data ?? [])[0] || null })
}

// POST → make/update pick (body: { teamId, gameId? })
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

  // Load wrinkle & verify league membership
  const { data: w, error: wErr } = await supabase
    .from('wrinkles')
    .select('id, league_id, season, week')
    .eq('id', id)
    .single()
  if (wErr || !w) return json({ error: wErr?.message ?? 'wrinkle not found' }, 404)

  const { data: mem, error: memErr } = await supabase
    .from('league_members')
    .select('profile_id')
    .eq('league_id', w.league_id)
    .eq('profile_id', auth.user.id)
    .limit(1)
  if (memErr) return json({ error: memErr.message }, 500)
  if (!mem || mem.length === 0) return json({ error: 'forbidden' }, 403)

  // Linked games for this wrinkle
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

  // If we can, ensure chosen team belongs to the linked game
  const link = linked.find(g => g.game_id === gameId)
  if (link && !(link.home_team === teamId || link.away_team === teamId)) {
    return json({ error: 'team not in selected wrinkle game' }, 400)
  }

  // Write with service-role after checks — delete-then-insert for reliability
  const admin = supabaseServer()

  const { error: delErr } = await admin
    .from('wrinkle_picks')
    .delete()
    .eq('wrinkle_id', id)
    .eq('user_id', auth.user.id)
  if (delErr) return json({ error: delErr.message }, 500)

  const row = {
    wrinkle_id: id,
    user_id: auth.user.id,
    league_id: w.league_id, // include to satisfy NOT NULL / FKs if present
    season: w.season,
    week: w.week,
    game_id: gameId!,
    team_id: teamId,
  }

  const { data: ins, error: insErr } = await admin
    .from('wrinkle_picks')
    .insert(row)
    .select('*')
    .single()

  if (insErr) return json({ error: insErr.message }, 500)
  return json({ pick: ins })
}

// DELETE → /api/wrinkles/:id/picks?id=<pickId>
export async function DELETE(req: NextRequest, context: ParamCtx) {
  await getId(context) // id unused, but keeps signature uniform
  const supabase = await sbFromRequest()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthorized' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id')
  if (!pickId) return json({ error: 'id required' }, 400)

  const admin = supabaseServer()
  const { error } = await admin
    .from('wrinkle_picks')
    .delete()
    .eq('id', pickId)
    .eq('user_id', auth.user.id)

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}


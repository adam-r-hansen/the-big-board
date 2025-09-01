// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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

function sbFromRequest() {
  const store = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return store.getAll() },
        setAll(cs) { cs.forEach(c => store.set(c.name, c.value)) },
      },
    }
  )
}

// GET /api/wrinkles/:id/picks → caller’s pick for this wrinkle (if any)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = sbFromRequest()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthorized' }, 401)

  const { data, error } = await sb
    .from('wrinkle_picks')
    .select('*')
    .eq('wrinkle_id', params.id)
    .eq('profile_id', auth.user.id)
    .limit(1)

  if (error) return json({ error: error.message }, 500)
  return json({ pick: (data ?? [])[0] ?? null })
}

// POST /api/wrinkles/:id/picks
// Body: { teamId: string, gameId?: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = sbFromRequest()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthorized' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}
  const teamId: string | undefined = body?.teamId
  let gameId: string | undefined = body?.gameId
  if (!teamId) return json({ error: 'teamId required' }, 400)

  // Load wrinkle
  const { data: w, error: wErr } = await sb
    .from('wrinkles')
    .select('id, league_id, season, week')
    .eq('id', params.id)
    .single()
  if (wErr || !w) return json({ error: wErr?.message ?? 'wrinkle not found' }, 404)

  // Ensure requester is a member of the wrinkle's league
  const { data: mem, error: memErr } = await sb
    .from('league_members')
    .select('profile_id')
    .eq('league_id', w.league_id)
    .eq('profile_id', auth.user.id)
    .limit(1)
  if (memErr) return json({ error: memErr.message }, 500)
  if (!mem || mem.length === 0) return json({ error: 'forbidden' }, 403)

  // Allowed games (linked to the wrinkle)
  const { data: wg, error: wgErr } = await sb
    .from('wrinkle_games')
    .select('game_id, home_team, away_team')
    .eq('wrinkle_id', params.id)
  if (wgErr) return json({ error: wgErr.message }, 500)
  const linked = wg ?? []

  if (!gameId) {
    if (linked.length === 0) return json({ error: 'no games linked to wrinkle' }, 400)
    if (linked.length > 1) return json({ error: 'gameId required when multiple games are linked' }, 400)
    gameId = linked[0].game_id
  }

  // If we know the link, validate the team is in it
  const link = linked.find(g => g.game_id === gameId)
  if (link && !(link.home_team === teamId || link.away_team === teamId)) {
    return json({ error: 'team not in selected wrinkle game' }, 400)
  }

  // Upsert pick (unique on wrinkle_id + profile_id)
  const upsertRow = {
    wrinkle_id: params.id,
    profile_id: auth.user.id,
    game_id: gameId!,
    team_id: teamId,
  }

  const { data: up, error: upErr } = await sb
    .from('wrinkle_picks')
    .upsert(upsertRow, { onConflict: 'wrinkle_id,profile_id' })
    .select('*')
    .single()

  if (upErr) return json({ error: upErr.message }, 500)
  return json({ pick: up })
}

// DELETE /api/wrinkles/:id/picks?id=<pickId>
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = sbFromRequest()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return json({ error: 'unauthorized' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id')
  if (!pickId) return json({ error: 'id required' }, 400)

  const { error } = await sb
    .from('wrinkle_picks')
    .delete()
    .eq('id', pickId)
    .eq('profile_id', auth.user.id)

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
}


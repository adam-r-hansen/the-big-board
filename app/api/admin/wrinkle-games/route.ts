// app/api/admin/wrinkle-games/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/**
 * POST: Attach or replace the game bound to a wrinkle (bonus_game).
 * Body: { wrinkleId: string, gameId: string }
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {}
    try { body = await req.json() } catch { return json({ error: 'invalid JSON' }, 400) }

    const wrinkleId = body?.wrinkleId as string
    const gameId = body?.gameId as string
    if (!wrinkleId || !gameId) return json({ error: 'wrinkleId and gameId required' }, 400)

    const sb = createAdminClient()

    // Validate wrinkle exists
    const { data: wr, error: wErr } = await sb
      .from('wrinkles')
      .select('id, kind')
      .eq('id', wrinkleId)
      .maybeSingle()
    if (wErr) return json({ error: wErr.message }, 400)
    if (!wr) return json({ error: 'wrinkle not found' }, 404)

    // Pull game details so wrinkle_games has denormalized fields
    const { data: g, error: gErr } = await sb
      .from('games')
      .select('id, game_utc, status, home_team, away_team')
      .eq('id', gameId)
      .maybeSingle()
    if (gErr) return json({ error: gErr.message }, 400)
    if (!g) return json({ error: 'game not found' }, 404)

    const row = {
      wrinkle_id: wrinkleId,
      game_id: g.id,
      game_utc: g.game_utc ?? null,
      status: g.status ?? null,
      home_team: g.home_team ?? null,
      away_team: g.away_team ?? null,
    }

    const { data: up, error: uErr } = await sb
      .from('wrinkle_games')
      .upsert(row, { onConflict: 'wrinkle_id' })
      .select('*')
      .single()

    if (uErr) return json({ error: uErr.message }, 400)
    return json({ ok: true, wrinkle_game: up })
  } catch (e: any) {
    return json({ error: e?.message ?? 'server error' }, 500)
  }
}

// app/api/admin/wrinkles/[id]/hydrate/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      pragma: 'no-cache',
    },
  })
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // Next 15 typed context is a Promise
) {
  try {
    const { id: wrinkleId } = await context.params
    if (!wrinkleId) return json({ error: 'missing wrinkle id' }, 400)

    let body: any = null
    try {
      body = await req.json()
    } catch {
      return json({ error: 'missing or invalid JSON body' }, 400)
    }

    const gameIds: string[] = Array.isArray(body?.gameIds) ? body.gameIds : []
    const spreads: Record<string, number | null> = body?.spreads ?? {}

    if (gameIds.length === 0) {
      return json({ error: 'gameIds must be a non-empty array' }, 400)
    }

    const sb = createAdminClient()

    // Fetch required columns from games so we can satisfy NOT NULL on wrinkle_games.game_utc
    const { data: games, error: gErr } = await sb
      .from('games')
      .select('id, game_utc')
      .in('id', gameIds)

    if (gErr) return json({ error: gErr.message, hint: 'select games failed' }, 500)

    const found = new Map<string, string>()
    for (const g of games ?? []) {
      if (g?.id && g?.game_utc) found.set(g.id as string, g.game_utc as string)
    }

    const missing = gameIds.filter(id => !found.has(id))
    const rows = gameIds
      .filter(id => found.has(id))
      .map(id => ({
        wrinkle_id: wrinkleId,
        game_id: id,
        game_utc: found.get(id)!,               // required by NOT NULL constraint
        spread: spreads[id] ?? null,            // present for spread-type wrinkles
      }))

    if (rows.length === 0) {
      return json({
        error: 'no valid gameIds resolved from games table',
        missing,
      }, 400)
    }

    // Upsert is idempotent; requires UNIQUE(wrinkle_id, game_id) on wrinkle_games
    const { data: upserted, error: uErr } = await sb
      .from('wrinkle_games')
      .upsert(rows, { onConflict: 'wrinkle_id,game_id' })
      .select('id')

    if (uErr) {
      return json({
        error: uErr.message,
        hint: 'upsert into wrinkle_games failed',
        attempted: rows.length,
      }, 500)
    }

    return json({
      ok: true,
      counts: {
        requested: gameIds.length,
        upserted: upserted?.length ?? 0,
        missing: missing.length,
      },
      missing,
    })
  } catch (e: any) {
    return json({ error: e?.message ?? 'server error' }, 500)
  }
}

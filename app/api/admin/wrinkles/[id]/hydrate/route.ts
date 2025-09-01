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
  context: { params: Promise<{ id: string }> } // Next 15 passes params as a Promise
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

    // Pull the fields required by wrinkle_games NOT NULL constraints
    const { data: games, error: gErr } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .in('id', gameIds)

    if (gErr) {
      return json({ error: gErr.message, hint: 'select games failed' }, 500)
    }

    // Build rows only when all required props are present
    const found = new Map<string, { game_utc: string; home_team: string; away_team: string }>()
    for (const g of games ?? []) {
      if (g?.id && g?.game_utc && g?.home_team && g?.away_team) {
        found.set(g.id as string, {
          game_utc: g.game_utc as string,
          home_team: g.home_team as string,
          away_team: g.away_team as string,
        })
      }
    }

    const missing: string[] = []
    const incomplete: string[] = []
    const rows = gameIds.flatMap((id) => {
      const info = found.get(id)
      if (!info) {
        // missing game or some required field is null
        const raw = (games ?? []).find((x: any) => x?.id === id)
        if (!raw) missing.push(id)
        else incomplete.push(id)
        return []
      }
      return [{
        wrinkle_id: wrinkleId,
        game_id: id,
        game_utc: info.game_utc,
        home_team: info.home_team,
        away_team: info.away_team,
        spread: spreads[id] ?? null,
      }]
    })

    if (rows.length === 0) {
      return json({
        error: 'no valid gameIds resolved with required fields (game_utc, home_team, away_team)',
        missing, incomplete,
      }, 400)
    }

    // Requires UNIQUE(wrinkle_id, game_id) on wrinkle_games
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
        incomplete: incomplete.length,
      },
      missing,
      incomplete,
    })
  } catch (e: any) {
    return json({ error: e?.message ?? 'server error' }, 500)
  }
}


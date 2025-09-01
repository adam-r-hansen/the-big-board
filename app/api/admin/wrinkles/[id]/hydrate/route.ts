// app/api/admin/wrinkles/[id]/hydrate/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const wrinkleId = params?.id
    if (!wrinkleId) return json({ error: 'missing wrinkle id' }, 400)

    let body: any = null
    try {
      body = await req.json()
    } catch {
      return json({ error: 'missing or invalid JSON body' }, 400)
    }

    const { gameIds = [], spreads = {} } = body ?? {}
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return json({ error: 'gameIds must be a non-empty array' }, 400)
    }

    const sb = supabaseAdmin()

    const rows = gameIds.map((g: string) => ({
      wrinkle_id: wrinkleId,
      game_id: g,
      spread: spreads[g] ?? null,
    }))

    const { error, count } = await sb
      .from('wrinkle_games')
      .insert(rows)
      .select('*', { count: 'exact' })

    if (error) {
      return json({ error: error.message, hint: 'insert wrinkle_games failed', rows }, 500)
    }

    return json({ ok: true, inserted: count ?? rows.length })
  } catch (e: any) {
    return json({ error: e?.message ?? 'server error' }, 500)
  }
}


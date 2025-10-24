// app/api/admin/wrinkles/route.ts
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

export async function POST(req: NextRequest) {
  try {
    let body: any = null
    try {
      body = await req.json()
    } catch {
      return json({ error: 'missing or invalid JSON body' }, 400)
    }

    const {
      leagueId,
      season,
      week,
      name,
      status = 'active',
      kind,            // e.g. 'winless_double' | 'extra_picks' | 'custom'
      extraPicks = 0,  // integer
      params = {},     // JSONB, e.g. { multiplier: 2, eligibleTeamIds: ['NYJ','CAR'] }
      // autoHydrate,  // ignored here; hydrate is a separate call
    } = body ?? {}

    if (!leagueId || !season || !week || !name || !kind) {
      return json({ error: 'missing required fields' }, 400)
    }

    const sb = createAdminClient()

    const insertRow = {
      league_id: leagueId,
      season,
      week,
      name,
      status,
      kind,
      extra_picks: extraPicks,
      params, // <-- now persisted
    }

    const { data, error } = await sb
      .from('wrinkles')
      .insert(insertRow)
      .select('*')
      .single()

    if (error) {
      return json({ error: error.message, hint: 'insert wrinkles failed', insertRow }, 500)
    }

    return json({ ok: true, wrinkle: data })
  } catch (e: any) {
    return json({ error: e?.message ?? 'server error' }, 500)
  }
}

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
      kind,
      extraPicks = 0,
      autoHydrate, // ignored here; hydrate is a separate call
    } = body ?? {}

    if (!leagueId || !season || !week || !name || !kind) {
      return json({ error: 'missing required fields' }, 400)
    }

    // use service-role so RLS can’t block admin actions
    const sb = createAdminClient()

    // Map to DB column names (adjust if your columns differ)
    const insertRow = {
      league_id: leagueId,
      season,
      week,
      name,
      status,
      kind,
      extra_picks: extraPicks,
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


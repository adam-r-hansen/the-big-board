import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-clients'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { season, week } = body

  if (!season || !week) {
    return json({ error: 'season and week required' }, 400)
  }

  const sb = createAdminSupabaseClient()

  const { data: games, error: gErr } = await sb
    .from('games')
    .select('*')
    .eq('season', season)
    .eq('week', week)

  if (gErr) {
    return json({ error: gErr.message }, 500)
  }

  return json({ ok: true, games: games ?? [] })
}

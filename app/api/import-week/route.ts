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
  const sb = createAdminSupabaseClient()
  const body = await req.json().catch(() => ({ games: [] }))
  const games = Array.isArray(body?.games) ? body.games : []

  if (!games.length) {
    return json({ error: 'No games provided' }, 400)
  }

  const { data, error } = await sb
    .from('games')
    .upsert(games, { onConflict: 'season,week,home_team,away_team' })
    .select()

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ ok: true, count: data?.length ?? 0, games: data })
}

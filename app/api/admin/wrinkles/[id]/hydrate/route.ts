import { NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-clients'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  if (!id) {
    return json({ error: 'wrinkle id required' }, 400)
  }

  const sb = createAdminSupabaseClient()

  const { data: wrinkle, error: wErr } = await sb
    .from('wrinkles')
    .select('*')
    .eq('id', id)
    .single()

  if (wErr || !wrinkle) {
    return json({ error: wErr?.message ?? 'wrinkle not found' }, 404)
  }

  const { data: games, error: gErr } = await sb
    .from('games')
    .select('id, home_team, away_team')
    .eq('season', wrinkle.season)
    .eq('week', wrinkle.week)

  if (gErr) {
    return json({ error: gErr.message }, 500)
  }

  const rows = (games ?? []).map((g: any) => ({
    wrinkle_id: id,
    game_id: g.id,
    home_team: g.home_team,
    away_team: g.away_team,
  }))

  if (!rows.length) {
    return json({ ok: true, hydrated: 0 })
  }

  const { error: insertErr } = await sb
    .from('wrinkle_games')
    .upsert(rows, { onConflict: 'wrinkle_id,game_id' })

  if (insertErr) {
    return json({ error: insertErr.message }, 500)
  }

  return json({ ok: true, hydrated: rows.length })
}

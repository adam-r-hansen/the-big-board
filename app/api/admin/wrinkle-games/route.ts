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

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const wrinkleId = url.searchParams.get('wrinkleId')

  if (!wrinkleId) {
    return json({ error: 'wrinkleId required' }, 400)
  }

  const sb = createAdminSupabaseClient()

  const { data, error } = await sb
    .from('wrinkle_games')
    .select('*')
    .eq('wrinkle_id', wrinkleId)

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ games: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { wrinkleId, gameId, homeTeam, awayTeam } = body

  if (!wrinkleId || !gameId) {
    return json({ error: 'wrinkleId and gameId required' }, 400)
  }

  const sb = createAdminSupabaseClient()

  const { data, error } = await sb
    .from('wrinkle_games')
    .upsert(
      {
        wrinkle_id: wrinkleId,
        game_id: gameId,
        home_team: homeTeam,
        away_team: awayTeam,
      },
      { onConflict: 'wrinkle_id,game_id' }
    )
    .select()
    .single()

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ ok: true, game: data })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const wrinkleId = url.searchParams.get('wrinkleId')
  const gameId = url.searchParams.get('gameId')

  if (!wrinkleId || !gameId) {
    return json({ error: 'wrinkleId and gameId required' }, 400)
  }

  const sb = createAdminSupabaseClient()

  const { error } = await sb
    .from('wrinkle_games')
    .delete()
    .eq('wrinkle_id', wrinkleId)
    .eq('game_id', gameId)

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ ok: true })
}

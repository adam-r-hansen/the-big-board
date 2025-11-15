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
  const { season, week, scores } = body

  if (!season || !week || !Array.isArray(scores)) {
    return json({ error: 'season, week, and scores array required' }, 400)
  }

  const sb = createAdminSupabaseClient()
  const updated = []

  for (const s of scores) {
    if (!s.gameId) continue

    const { data, error } = await sb
      .from('games')
      .update({
        home_score: s.homeScore,
        away_score: s.awayScore,
        status: s.status || 'FINAL',
      })
      .eq('id', s.gameId)
      .select()
      .single()

    if (error) continue
    updated.push(data)
  }

  return json({ ok: true, updated: updated.length, games: updated })
}

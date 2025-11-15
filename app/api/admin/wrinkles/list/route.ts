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
  const leagueId = url.searchParams.get('leagueId')
  const season = url.searchParams.get('season')

  if (!leagueId || !season) {
    return json({ error: 'leagueId and season required' }, 400)
  }

  const sb = createAdminSupabaseClient()

  const { data, error } = await sb
    .from('wrinkles')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', parseInt(season))
    .order('week', { ascending: true })

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ wrinkles: data ?? [] })
}

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
  const body = await req.json().catch(() => ({ teams: [] }))
  const teams = Array.isArray(body?.teams) ? body.teams : []

  if (!teams.length) {
    return json({ error: 'No teams provided' }, 400)
  }

  const { data, error } = await sb
    .from('teams')
    .upsert(teams, { onConflict: 'abbreviation' })
    .select()

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ ok: true, count: data?.length ?? 0, teams: data })
}

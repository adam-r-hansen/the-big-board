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
  const body = await req.json().catch(() => ({ colors: [] }))
  const colors = Array.isArray(body?.colors) ? body.colors : []

  if (!colors.length) {
    return json({ error: 'No color data provided' }, 400)
  }

  const updated = []
  for (const c of colors) {
    if (!c.abbreviation) continue

    const { data, error } = await sb
      .from('teams')
      .update({
        color_primary: c.primary,
        color_secondary: c.secondary,
        color_tertiary: c.tertiary,
        color_quaternary: c.quaternary,
      })
      .eq('abbreviation', c.abbreviation)
      .select()
      .single()

    if (error) continue
    updated.push(data)
  }

  return json({ ok: true, updated: updated.length, teams: updated })
}

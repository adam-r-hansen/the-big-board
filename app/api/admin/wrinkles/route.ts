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

function parseMaybeJson(input: any) {
  if (!input) return {}
  if (typeof input === 'object') return input
  if (typeof input === 'string') {
    try { return JSON.parse(input) } catch { return {} }
  }
  return {}
}

/** GET: List wrinkles for a league (optionally filter by season). */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const leagueId = searchParams.get('leagueId') || ''
    const season = searchParams.get('season')

    if (!leagueId) return json({ error: 'leagueId required' }, 400)

    const sb = createAdminClient()

    // base query
    let q = sb
      .from('wrinkles')
      .select('id, league_id, season, week, name, status, kind, extra_picks, config, created_at')
      .eq('league_id', leagueId)
      .order('week', { ascending: false })
      .order('created_at', { ascending: false })

    if (season) q = q.eq('season', Number(season))

    const { data, error } = await q
    if (error) return json({ error: error.message }, 400)

    const rows = (data ?? []).map((w: any) => ({
      id: w.id,
      league_id: w.league_id,
      season: w.season,
      week: w.week,
      name: w.name,
      status: w.status,
      kind: w.kind,
      extra_picks: w.extra_picks || 0,
      params: parseMaybeJson(w.config),
      created_at: w.created_at,
    }))

    return json({ wrinkles: rows })
  } catch (e: any) {
    return json({ error: e?.message ?? 'server error' }, 500)
  }
}

/** POST: Create a wrinkle for a league/week/season. */
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
      kind,                // 'bonus_game' | 'winless_double' | 'bonus_picks_only' | etc.
      extraPicks = 0,
      description,         // optional text; we store inside config
      // Future: multiplier, eligibleTeamIds, game binding, etc.
      // multiplier,
      // eligibleTeamIds,
    } = body ?? {}

    if (!leagueId || !season || !week || !name || !kind) {
      return json({ error: 'missing required fields' }, 400)
    }

    const sb = createAdminClient()

    // Persist description inside config for quick retrieval on the client
    const config = description ? JSON.stringify({ description }) : JSON.stringify({})

    const insertRow = {
      league_id: leagueId,
      season,
      week,
      name,
      status,
      kind,
      extra_picks: extraPicks,
      config,
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

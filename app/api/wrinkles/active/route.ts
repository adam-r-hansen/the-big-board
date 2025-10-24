// app/api/wrinkles/active/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

function parseMaybeJson(input: any) {
  if (!input) return {}
  if (typeof input === 'object') return input
  if (typeof input === 'string') {
    try { return JSON.parse(input) } catch { return {} }
  }
  return {}
}

export async function GET(req: NextRequest) {
  // We still read the user (for optional membership check)
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id || null

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  const season = Number(searchParams.get('season') || '0')
  const week = Number(searchParams.get('week') || '0')

  if (!leagueId || !season || !week) return j({ error: 'leagueId, season, week required' }, 400)

  const admin = createAdminClient()

  // Optional: require requester to be a member of the league
  if (userId) {
    const { data: mem } = await admin
      .from('league_memberships')
      .select('profile_id')
      .eq('league_id', leagueId)
      .eq('profile_id', userId)
      .maybeSingle()
    if (!mem) return j({ wrinkles: [] }, 200) // silently return none if not a member
  }

  // Fetch wrinkles with admin client (RLS-safe)
  const { data: wr, error: wErr } = await admin
    .from('wrinkles')
    .select('id, name, status, kind, extra_picks, params, config')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'active')
    .order('id', { ascending: true })

  if (wErr) return j({ error: wErr.message }, 400)

  const wrinkles = (wr || []).map((w: any) => ({
    id: w.id,
    name: w.name,
    status: w.status,
    kind: w.kind,
    extra_picks: w.extra_picks || 0,
    // prefer params; fall back to config; parse string "{}" safely
    params: (w.params && typeof w.params === 'object')
      ? w.params
      : parseMaybeJson(w.config),
  }))

  if (wrinkles.length === 0) return j({ wrinkles: [] }, 200)

  // Join wrinkle_games and attach to each wrinkle
  const ids = wrinkles.map(w => w.id)
  const { data: wg, error: gErr } = await admin
    .from('wrinkle_games')
    .select('wrinkle_id, game_id, game_utc, status, home_team, away_team')
    .in('wrinkle_id', ids)

  if (!gErr && wg) {
    const byId = new Map(wrinkles.map(w => [w.id, w]))
    for (const g of wg) {
      const w = byId.get(g.wrinkle_id)
      if (!w) continue
      ;(w as any).game = {
        game_id: g.game_id || null,
        game_utc: g.game_utc || null,
        status: g.status || null,
        home_team: g.home_team || null,
        away_team: g.away_team || null,
      }
    }
  }

  return j({ wrinkles }, 200)
}

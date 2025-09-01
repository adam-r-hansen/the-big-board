// app/api/admin/wrinkles/route.ts
import { NextRequest } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma', 'no-cache'); h.set('Expires', '0'); h.set('Surrogate-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

function headerKeyOk(req: NextRequest) {
  const want = process.env.ADMIN_CRON_KEY
  const got = req.headers.get('x-admin-key') || ''
  return !!want && got === want
}

async function assertOwner(req: NextRequest, leagueId: string) {
  if (headerKeyOk(req)) return { ok: true as const }

  const sb = createServerClient({ req })
  const { data: { user }, error: uErr } = await sb.auth.getUser()
  if (uErr || !user) return { ok: false as const, status: 401, error: 'unauthorized' }

  const { data: lm, error: lErr } = await sb
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .maybeSingle()
  if (lErr) return { ok: false as const, status: 500, error: lErr.message }
  if (!lm || !['owner'].includes(lm.role)) return { ok: false as const, status: 403, error: 'forbidden' }

  return { ok: true as const }
}

// POST: create a wrinkle; optional autoHydrate copies games for that week into wrinkle_games
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    leagueId, season, week,
    name, status = 'active',
    extraPicks = 1,
    autoHydrate = false,
    onlyTeams = [] as string[],
    onlyGameIds = [] as string[]
  } = body || {}

  if (!leagueId || !season || !week || !name) {
    return jsonNoStore({ error: 'leagueId, season, week, name are required' }, { status: 400 })
  }

  const authz = await assertOwner(req, leagueId)
  if (!authz.ok) return jsonNoStore({ error: authz.error }, { status: authz.status })

  const sb = createAdminClient()

  const { data: wr, error: wErr } = await sb
    .from('wrinkles')
    .insert([{ league_id: leagueId, season, week, name, status, extra_picks: Number(extraPicks) || 1 }])
    .select()
    .single()
  if (wErr || !wr) return jsonNoStore({ error: wErr?.message || 'insert wrinkle failed' }, { status: 500 })

  let hydrated = 0
  if (autoHydrate) {
    const { data: games, error: gErr } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team, home_score, away_score, status')
      .eq('season', season).eq('week', week)
    if (gErr) return jsonNoStore({ error: gErr.message }, { status: 500 })

    let filtered = games ?? []
    if (Array.isArray(onlyGameIds) && onlyGameIds.length) {
      const set = new Set(onlyGameIds)
      filtered = filtered.filter(g => set.has(g.id))
    }
    if (Array.isArray(onlyTeams) && onlyTeams.length) {
      const set = new Set(onlyTeams.map(s => String(s).toUpperCase()))
      filtered = filtered.filter(g =>
        set.has(String(g.home_team).toUpperCase()) || set.has(String(g.away_team).toUpperCase())
      )
    }

    if (filtered.length) {
      const rows = filtered.map(g => ({
        wrinkle_id: wr.id,
        game_utc: g.game_utc,
        home_team: g.home_team,
        away_team: g.away_team,
        home_score: g.home_score ?? null,
        away_score: g.away_score ?? null,
        status: g.status ?? 'UPCOMING',
      }))
      const { error: insErr } = await sb.from('wrinkle_games').insert(rows)
      if (insErr) return jsonNoStore({ error: insErr.message }, { status: 500 })
      hydrated = rows.length
    }
  }

  return jsonNoStore({ ok: true, wrinkle: wr, hydrated })
}

// GET: list wrinkles for league/season (members)
export async function GET(req: NextRequest) {
  const sb = createServerClient({ req })
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  const season = Number(searchParams.get('season') || '0')
  if (!leagueId || !season) return jsonNoStore({ error: 'leagueId & season required' }, { status: 400 })

  const { data, error } = await sb
    .from('wrinkles')
    .select('id, league_id, season, week, name, status, extra_picks, created_at')
    .eq('league_id', leagueId)
    .eq('season', season)
    .order('week', { ascending: true })
  if (error) return jsonNoStore({ error: error.message }, { status: 500 })
  return jsonNoStore({ wrinkles: data ?? [] })
}


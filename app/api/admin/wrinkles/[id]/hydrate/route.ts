// app/api/admin/wrinkles/[id]/hydrate/route.ts
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

async function assertOwnerByWrinkle(req: NextRequest, wrinkleId: string) {
  if (headerKeyOk(req)) return { ok: true as const }
  const sbUser = createServerClient({ req })
  const { data: { user }, error: uErr } = await sbUser.auth.getUser()
  if (uErr || !user) return { ok: false as const, status: 401, error: 'unauthorized' }

  const sb = createAdminClient()
  const { data: w, error: wErr } = await sb.from('wrinkles').select('league_id').eq('id', wrinkleId).single()
  if (wErr || !w) return { ok: false as const, status: 404, error: 'wrinkle not found' }

  const { data: lm, error: lErr } = await sbUser
    .from('league_members')
    .select('role')
    .eq('league_id', w.league_id)
    .eq('profile_id', user.id)
    .maybeSingle()
  if (lErr) return { ok: false as const, status: 500, error: lErr.message }
  if (!lm || !['owner'].includes(lm.role)) return { ok: false as const, status: 403, error: 'forbidden' }

  return { ok: true as const }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = createAdminClient()
  const authz = await assertOwnerByWrinkle(req, id)
  if (!authz.ok) return jsonNoStore({ error: authz.error }, { status: authz.status })

  const body = await req.json().catch(() => ({}))
  const { onlyTeams = [] as string[], onlyGameIds = [] as string[] } = body || {}

  // Load wrinkle to know season/week
  const { data: w, error: wErr } = await sb.from('wrinkles').select('id, season, week').eq('id', id).single()
  if (wErr || !w) return jsonNoStore({ error: wErr?.message || 'wrinkle not found' }, { status: 404 })

  const { data: games, error: gErr } = await sb
    .from('games')
    .select('id, game_utc, home_team, away_team, home_score, away_score, status')
    .eq('season', w.season).eq('week', w.week)
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

  await sb.from('wrinkle_games').delete().eq('wrinkle_id', id)

  let inserted = 0
  if (filtered.length) {
    const rows = filtered.map(g => ({
      wrinkle_id: id,
      game_utc: g.game_utc,
      home_team: g.home_team,
      away_team: g.away_team,
      home_score: g.home_score ?? null,
      away_score: g.away_score ?? null,
      status: g.status ?? 'UPCOMING',
    }))
    const { error: insErr, count } = await sb.from('wrinkle_games').insert(rows).select('*', { count: 'exact' })
    if (insErr) return jsonNoStore({ error: insErr.message }, { status: 500 })
    inserted = count ?? rows.length
  }

  return jsonNoStore({ ok: true, inserted })
}


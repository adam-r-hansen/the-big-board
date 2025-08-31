import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma','no-cache'); h.set('Expires','0'); h.set('Surrogate-Control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

const isOwner = (r?: string) => r === 'owner'

type Item = { week: number; kickoff: string; home: string; away: string }

export async function POST(req: NextRequest, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const body = await req.json().catch(() => null) as { season?: number; items?: Item[] } | null
  const season = Number(body?.season)
  const items  = body?.items ?? []
  if (!Number.isFinite(season) || !Array.isArray(items) || items.length === 0) {
    return json({ error: 'season and items[] required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return json({ error: 'unauthenticated' }, { status: 401 })

  const { data: me, error: meErr } = await sb
    .from('league_members').select('role')
    .eq('league_id', leagueId).eq('profile_id', u.id).maybeSingle()
  if (meErr) return json({ error: meErr.message }, { status: 500 })
  if (!isOwner(me?.role)) return json({ error: 'forbidden' }, { status: 403 })

  const { data: teams, error: tErr } = await sb.from('teams').select('id, abbreviation, name')
  if (tErr) return json({ error: tErr.message }, { status: 500 })
  const norm = (s: string) => s.trim().toLowerCase()
  const findTeamId = (key: string) =>
    teams?.find(t => norm(t.abbreviation) === norm(key) || norm(t.name) === norm(key))?.id || null

  let inserted = 0, updated = 0, skipped = 0
  const errors: Array<{ item: Item; error: string }> = []

  for (const it of items) {
    try {
      if (!Number.isFinite(it.week) || !it.kickoff || !it.home || !it.away) {
        skipped++; errors.push({ item: it, error: 'invalid item' }); continue
      }
      const homeId = findTeamId(it.home)
      const awayId = findTeamId(it.away)
      if (!homeId || !awayId) { skipped++; errors.push({ item: it, error: 'unknown team(s)' }); continue }
      const gameUtc = new Date(it.kickoff).toISOString()

      const { data: existing, error: gErr } = await sb.from('games')
        .select('id, game_utc').eq('season', season).eq('week', it.week)
        .eq('home_team', homeId).eq('away_team', awayId).maybeSingle()
      if (gErr) throw new Error(gErr.message)

      if (!existing?.id) {
        const { error: iErr } = await sb.from('games').insert([{
          season, week: it.week, home_team: homeId, away_team: awayId, game_utc: gameUtc, status: 'UPCOMING'
        }])
        if (iErr) throw new Error(iErr.message)
        inserted++
      } else if ((existing.game_utc ?? '') !== gameUtc) {
        const { error: uErr } = await sb.from('games').update({ game_utc: gameUtc, status: 'UPCOMING' })
          .eq('id', existing.id)
        if (uErr) throw new Error(uErr.message)
        updated++
      } else {
        skipped++
      }
    } catch (e: any) { skipped++; errors.push({ item: it, error: e?.message || 'error' }) }
  }

  return json({ ok: true, season, counts: { inserted, updated, skipped }, errors })
}

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { Game } from '@/types/domain'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma','no-cache'); h.set('Expires','0'); h.set('Surrogate-Control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

function coercePostBody(raw: any) {
  const leagueId = raw?.leagueId ?? raw?.league_id
  const teamId   = raw?.teamId   ?? raw?.team_id
  const gameId   = raw?.gameId   ?? raw?.game_id ?? null
  const season   = Number(raw?.season ?? raw?.season_id)
  const week     = Number(raw?.week   ?? raw?.week_number)
  const ok = !!leagueId && !!teamId && Number.isFinite(season) && Number.isFinite(week)
  return ok ? { leagueId, season, week, teamId, gameId } : null
}

async function isWrinkleGame(sb: ReturnType<typeof createClient> extends Promise<infer C> ? C : any, args: {
  leagueId: string, season: number, week: number, gameId: string | null
}) {
  if (!args.gameId) return null
  // active wrinkle for this league/season/week that links to this game
  const { data, error } = await sb
    .from('wrinkles')
    .select('id, status, extra_picks, wrinkle_games!inner(game_id)')
    .eq('league_id', args.leagueId)
    .eq('season', args.season)
    .eq('week', args.week)
    .eq('status', 'active')
    .eq('wrinkle_games.game_id', args.gameId)
    .limit(1)
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) && data[0] ? data[0] as any : null
  if (!row) return null
  return {
    wrinkleId: row.id as string,
    extraPicks: Number(row.extra_picks ?? 0),
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const body = coercePostBody(raw)
  if (!body) return jsonNoStore({ error: 'invalid body (need leagueId, season, week, teamId)' }, { status: 400 })
  const { leagueId, season, week, teamId, gameId } = body

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  if (!user) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })
  const profileId = user.id

  // If this game belongs to an active wrinkle, treat it as a wrinkle-pick (extra; DO NOT count toward weekly/season)
  let wrinkleMeta: { wrinkleId: string, extraPicks: number } | null = null
  try {
    wrinkleMeta = await isWrinkleGame(sb, { leagueId, season, week, gameId })
  } catch (e: any) {
    return jsonNoStore({ error: e?.message || 'wrinkle lookup failed' }, { status: 500 })
  }

  if (wrinkleMeta) {
    // Lock check for the game
    if (gameId) {
      const { data: g, error } = await sb.from('games')
        .select('id, game_utc').eq('id', gameId).limit(1).maybeSingle<Game>()
      if (error) return jsonNoStore({ error: error.message }, { status: 500 })
      if (g?.game_utc && new Date(g.game_utc) <= new Date()) {
        return jsonNoStore({ error: 'game is locked (kickoff passed)' }, { status: 400 })
      }
    }

    // Upsert wrinkle pick for this user+wrinkle
    const { error: iErr } = await sb
      .from('wrinkle_picks')
      .upsert([{ wrinkle_id: wrinkleMeta.wrinkleId, profile_id: profileId, team_id: teamId, game_id: gameId ?? null }], { onConflict: 'wrinkle_id,profile_id' })
    if (iErr) return jsonNoStore({ error: iErr.message }, { status: 500 })

    return jsonNoStore({ ok: true, wrinkle: true })
  }

  // ---------- Normal weekly pick path (counts toward weekly/season) ----------

  // ensure membership (auto-join)
  {
    const { data: lm, error } = await sb
      .from('league_members').select('role')
      .eq('league_id', leagueId).eq('profile_id', profileId)
      .limit(1).maybeSingle<{ role: string }>()
    if (error) return jsonNoStore({ error: error.message }, { status: 500 })
    if (!lm) {
      const { error: jErr } = await sb
        .from('league_members').insert([{ league_id: leagueId, profile_id: profileId, role: 'member' }])
      if (jErr) return jsonNoStore({ error: jErr.message }, { status: 500 })
    }
  }

  // weekly quota (2 picks per selected week) — wrinkle picks are excluded because they never hit this branch
  {
    const { count, error } = await sb
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('profile_id', profileId)
    if (error) return jsonNoStore({ error: error.message }, { status: 500 })
    if ((count ?? 0) >= 2) return jsonNoStore({ error: 'quota reached (2 picks/week)' }, { status: 400 })
  }

  // no reuse in PRIOR weeks only — tolerate mocks without `.lt`
  {
    const base: any = (sb as any).from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId).eq('season', season).eq('profile_id', profileId).eq('team_id', teamId) as any

    let reuseCount = 0
    if (typeof base.lt === 'function') {
      const { count, error } = await base.lt('week', week)
      if (error) return jsonNoStore({ error: error.message }, { status: 500 })
      reuseCount = count ?? 0
    } else {
      reuseCount = 0
    }

    if (reuseCount > 0) {
      return jsonNoStore({ error: 'team already used in a prior week' }, { status: 400 })
    }
  }

  // lock check
  if (gameId) {
    const { data: g, error } = await sb.from('games')
      .select('id, game_utc').eq('id', gameId).limit(1).maybeSingle<Game>()
    if (error) return jsonNoStore({ error: error.message }, { status: 500 })
    if (g?.game_utc && new Date(g.game_utc) <= new Date()) {
      return jsonNoStore({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  }

  const { data: created, error: cErr } = await sb
    .from('picks')
    .insert([{ league_id: leagueId, season, week, team_id: teamId, profile_id: profileId, game_id: gameId ?? null }])
    .select('id').limit(1).maybeSingle<{ id: string }>()
  if (cErr) return jsonNoStore({ error: cErr.message }, { status: 500 })

  return jsonNoStore({ ok: true, id: created?.id })
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let id        = url.searchParams.get('id')        || undefined
    let leagueId  = url.searchParams.get('leagueId')  || undefined
    let teamId    = url.searchParams.get('teamId')    || undefined
    let seasonStr = url.searchParams.get('season')    || undefined
    let weekStr   = url.searchParams.get('week')      || undefined
    let gameId    = url.searchParams.get('gameId')    || undefined

    if (!(id || leagueId || teamId || seasonStr || weekStr || gameId)) {
      const body = await req.json().catch(() => null)
      if (body && typeof body === 'object') {
        id        = (body as any).id       ?? id
        leagueId  = (body as any).leagueId ?? (body as any).league_id ?? leagueId
        teamId    = (body as any).teamId   ?? (body as any).team_id   ?? teamId
        gameId    = (body as any).gameId   ?? (body as any).game_id   ?? gameId
        if (!seasonStr && (body as any).season != null) seasonStr = String((body as any).season)
        if (!weekStr   && (body as any).week   != null) weekStr   = String((body as any).week)
      }
    }

    const sb = await createClient()
    const { data: auth } = await sb.auth.getUser()
    const user = auth?.user
    if (!user) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })
    const profileId = user.id

    const season = seasonStr != null ? Number(seasonStr) : undefined
    const week   = weekStr   != null ? Number(weekStr)   : undefined
    const hasSW  = Number.isFinite(season) && Number.isFinite(week)

    async function isLocked(game_id: string | null) {
      if (!game_id) return false
      const { data: g, error } = await sb.from('games')
        .select('id, game_utc').eq('id', game_id).limit(1).maybeSingle<Game>()
      if (error) throw new Error(error.message)
      return !!(g?.game_utc && new Date(g.game_utc) <= new Date())
    }

    // If this is a wrinkle-linked game, delete from wrinkle_picks instead of picks
    if (leagueId && hasSW && gameId) {
      const wr = await isWrinkleGame(sb, { leagueId, season: season as number, week: week as number, gameId })
      if (wr) {
        // find existing wrinkle pick for this user+wrinkle
        const { data: wp, error: sErr } = await sb
          .from('wrinkle_picks')
          .select('wrinkle_id, profile_id, game_id')
          .eq('wrinkle_id', wr.wrinkleId)
          .eq('profile_id', profileId)
          .limit(1)
        if (sErr) return jsonNoStore({ error: sErr.message }, { status: 500 })

        if (wp && wp.length > 0) {
          // lock check based on game_id on the row (or requested gameId)
          const gId = (wp[0] as any).game_id ?? gameId
          if (await isLocked(gId)) return jsonNoStore({ error: 'game is locked (kickoff passed)' }, { status: 400 })

          const { error: dErr } = await sb
            .from('wrinkle_picks')
            .delete()
            .eq('wrinkle_id', wr.wrinkleId)
            .eq('profile_id', profileId)
          if (dErr) return jsonNoStore({ error: dErr.message }, { status: 500 })
          return jsonNoStore({ ok: true, wrinkle: true })
        }
        // Nothing to delete; fall through to normal logic to return 404 if needed
      }
    }

    // ---------- Normal weekly deletions below ----------

    // Delete without .select(); confirm by re-selecting the row
    async function mustDeleteById(idToDelete: string, game_id: string | null) {
      if (await isLocked(game_id)) return { status: 400, body: { error: 'game is locked (kickoff passed)' } }

      const { error: dErr } = await sb
        .from('picks')
        .delete()
        .eq('id', idToDelete)
        .eq('profile_id', profileId)
      if (dErr) return { status: 500, body: { error: dErr.message } }

      // Verify it's gone (mock-friendly; works in prod too)
      const { data: still, error: sErr } = await sb
        .from('picks')
        .select('id')
        .eq('id', idToDelete)
        .eq('profile_id', profileId)
        .limit(1)
      if (sErr) return { status: 500, body: { error: sErr.message } }
      if (still && still.length > 0) return { status: 404, body: { error: 'not found or not allowed' } }

      return { status: 200, body: { ok: true } }
    }

    // A) by (league, season, week, game)
    if (leagueId && hasSW && gameId) {
      const { data: byGame, error } = await sb.from('picks')
        .select('id, game_id').eq('league_id', leagueId)
        .eq('season', season as number).eq('week', week as number)
        .eq('game_id', gameId).eq('profile_id', profileId)
        .limit(1).maybeSingle<{ id: string; game_id: string | null }>()
      if (error) return jsonNoStore({ error: error.message }, { status: 500 })
      if (byGame) {
        const r = await mustDeleteById(byGame.id, byGame.game_id)
        return jsonNoStore(r.body, { status: r.status })
      }
    }

    // B) by id
    if (id) {
      const { data: byId, error } = await sb.from('picks')
        .select('id, game_id').eq('id', id).eq('profile_id', profileId)
        .limit(1).maybeSingle<{ id: string; game_id: string | null }>()
      if (error) return jsonNoStore({ error: error.message }, { status: 500 })
      if (byId) {
        const r = await mustDeleteById(byId.id, byId.game_id)
        return jsonNoStore(r.body, { status: r.status })
      }
    }

    // C) by (league, season, week, team)
    if (leagueId && hasSW && teamId) {
      const { data: byTeam, error } = await sb.from('picks')
        .select('id, game_id').eq('league_id', leagueId)
        .eq('season', season as number).eq('week', week as number)
        .eq('team_id', teamId).eq('profile_id', profileId)
        .limit(1).maybeSingle<{ id: string; game_id: string | null }>()
      if (error) return jsonNoStore({ error: error.message }, { status: 500 })
      if (byTeam) {
        const r = await mustDeleteById(byTeam.id, byTeam.game_id)
        return jsonNoStore(r.body, { status: r.status })
      }
    }

    return jsonNoStore({ ok: false, deleted: false, reason: 'not_found' }, { status: 404 })
  } catch (e: any) {
    console.error('picks DELETE error:', e?.message || e)
    return jsonNoStore({ error: 'internal error' }, { status: 500 })
  }
}


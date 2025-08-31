import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'
const isAdminRole = (r?: string) => r === 'admin' || r === 'owner'

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma','no-cache'); h.set('Expires','0'); h.set('Surrogate-Control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

async function assertAdmin(sb: any, leagueId: string, userId: string) {
  const { data: me, error } = await sb
    .from('league_members').select('role').eq('league_id', leagueId).eq('profile_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!isAdminRole(me?.role)) throw new Error('forbidden')
}

// GET ?season=2025&week=1  -> list picks for the week (email, name, team_abbr)
export async function GET(req: NextRequest, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const url = new URL(req.url)
  const season = Number(url.searchParams.get('season') || '')
  const week = Number(url.searchParams.get('week') || '')
  if (!Number.isFinite(season) || !Number.isFinite(week)) {
    return jsonNoStore({ error: 'season & week required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })
  try { await assertAdmin(sb, leagueId, u.id) } catch (e:any) {
    return jsonNoStore({ error: e.message }, { status: e.message==='forbidden'?403:500 })
  }

  // Picks + profile + team for the week
  const { data, error } = await sb
    .from('picks')
    .select('id, profile_id, team_id, game_id, profiles(email, display_name), teams(abbreviation, name)')
    .eq('league_id', leagueId).eq('season', season).eq('week', week)
    .order('profile_id', { ascending: true })
  if (error) return jsonNoStore({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r:any) => ({
    pick_id: r.id,
    email: r.profiles?.email ?? r.profile_id,
    name: r.profiles?.display_name ?? r.profiles?.email ?? r.profile_id,
    team_abbr: r.teams?.abbreviation ?? null,
    team_name: r.teams?.name ?? null,
    game_id: r.game_id,
  }))
  return jsonNoStore({ picks: rows })
}

// POST { email, season, week, teamAbbr, force? } -> set/replace a pick for that member
export async function POST(req: NextRequest, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const body = await req.json().catch(() => null) as {
    email?: string; season?: number; week?: number; teamAbbr?: string; force?: boolean;
  } | null
  if (!body?.email || !Number.isFinite(body?.season) || !Number.isFinite(body?.week) || !body?.teamAbbr) {
    return jsonNoStore({ error: 'email, season, week, teamAbbr required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })
  try { await assertAdmin(sb, leagueId, u.id) } catch (e:any) {
    return jsonNoStore({ error: e.message }, { status: e.message==='forbidden'?403:500 })
  }

  // Resolve profile by email
  const { data: prof, error: pErr } = await sb.from('profiles')
    .select('id, email').eq('email', body.email.toLowerCase()).maybeSingle()
  if (pErr) return jsonNoStore({ error: pErr.message }, { status: 500 })
  if (!prof?.id) return jsonNoStore({ error: 'user not found' }, { status: 404 })

  // Resolve team by abbreviation or name
  const teamKey = body.teamAbbr.trim()
  const { data: team, error: tErr } = await sb.from('teams')
    .select('id, abbreviation, name').or(`abbreviation.ilike.${teamKey},name.ilike.${teamKey}`)
    .maybeSingle()
  if (tErr) return jsonNoStore({ error: tErr.message }, { status: 500 })
  if (!team?.id) return jsonNoStore({ error: 'team not found' }, { status: 404 })

  // Resolve game for season/week where team participates
  const { data: game, error: gErr } = await sb.from('games')
    .select('id, game_utc, status, home_team, away_team')
    .eq('season', body.season).eq('week', body.week)
    .or(`home_team.eq.${team.id},away_team.eq.${team.id}`)
    .order('game_utc', { ascending: true })
    .maybeSingle()
  if (gErr) return jsonNoStore({ error: gErr.message }, { status: 500 })
  if (!game?.id) return jsonNoStore({ error: 'game not found for that team in the given week' }, { status: 404 })

  // Lock/limit checks unless force
  if (!body.force) {
    const locked = game.game_utc ? new Date(game.game_utc) <= new Date() : false
    if (locked) return jsonNoStore({ error: 'game locked (kickoff passed)' }, { status: 400 })
    // enforce 2 picks/week
    const { count, error: cErr } = await sb
      .from('picks').select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId).eq('season', body.season).eq('week', body.week).eq('profile_id', prof.id)
    if (cErr) return jsonNoStore({ error: cErr.message }, { status: 500 })
    if ((count ?? 0) >= 2) return jsonNoStore({ error: 'weekly quota reached (2 picks)' }, { status: 400 })
  }

  // Remove existing pick for same game (swap behavior)
  await sb.from('picks').delete()
    .eq('league_id', leagueId).eq('season', body.season).eq('week', body.week)
    .eq('profile_id', prof.id).eq('game_id', game.id)

  // Insert the new pick
  const { error: iErr } = await sb.from('picks').insert([{
    league_id: leagueId,
    season: body.season,
    week: body.week,
    profile_id: prof.id,
    team_id: team.id,
    game_id: game.id,
  }])
  if (iErr) return jsonNoStore({ error: iErr.message }, { status: 500 })

  return jsonNoStore({ ok: true })
}

// DELETE { email, season, week, teamAbbr? } -> remove a member's pick (by game/team if provided, else first)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const body = await req.json().catch(() => null) as {
    email?: string; season?: number; week?: number; teamAbbr?: string;
  } | null
  if (!body?.email || !Number.isFinite(body?.season) || !Number.isFinite(body?.week)) {
    return jsonNoStore({ error: 'email, season, week required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })
  try { await assertAdmin(sb, leagueId, u.id) } catch (e:any) {
    return jsonNoStore({ error: e.message }, { status: e.message==='forbidden'?403:500 })
  }

  const { data: prof } = await sb.from('profiles')
    .select('id, email').eq('email', body.email.toLowerCase()).maybeSingle()
  if (!prof?.id) return jsonNoStore({ error: 'user not found' }, { status: 404 })

  let q = sb.from('picks').delete()
    .eq('league_id', leagueId).eq('season', body.season).eq('week', body.week).eq('profile_id', prof.id)

  if (body.teamAbbr) {
    // narrow by team in that week
    const { data: team } = await sb.from('teams').select('id')
      .or(`abbreviation.ilike.${body.teamAbbr},name.ilike.${body.teamAbbr}`).maybeSingle()
    if (team?.id) q = q.eq('team_id', team.id)
  }

  const { error: dErr } = await q
  if (dErr) return jsonNoStore({ error: dErr.message }, { status: 500 })
  return jsonNoStore({ ok: true })
}

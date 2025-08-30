// app/api/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Create a pick
 * - 2 picks per week
 * - no team reuse within the season
 * - cannot create after that game's kickoff
 */
export async function POST(req: NextRequest) {
  const { leagueId, season, week, teamId, gameId } = await req.json()
  if (!leagueId || !season || !week || !teamId) {
    return NextResponse.json({ error: 'leagueId, season, week, teamId required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: userRes, error: uerr } = await sb.auth.getUser()
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })
  if (!userRes?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const profileId = userRes.user.id

  // Must be a league member
  {
    const { data, error } = await sb
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('profile_id', profileId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'not a league member' }, { status: 403 })
  }

  // Two picks per week
  {
    const { count, error } = await sb
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('week', week)
      .eq('profile_id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if ((count ?? 0) >= 2) {
      return NextResponse.json({ error: 'quota reached (2 picks/week)' }, { status: 400 })
    }
  }

  // No team reuse in season
  {
    const { count, error } = await sb
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('profile_id', profileId)
      .eq('team_id', teamId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'team already used this season' }, { status: 400 })
    }
  }

  // Find the game for this team/week if not provided and enforce kickoff lock
  let resolvedGameId: string | null = gameId || null
  if (!resolvedGameId) {
    const { data: g, error: gErr } = await sb
      .from('games')
      .select('id, game_utc')
      .eq('season', season)
      .eq('week', week)
      .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
      .limit(1)
      .maybeSingle()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    if (!g) return NextResponse.json({ error: 'could not resolve game for team/week' }, { status: 400 })
    if (new Date(g.game_utc) <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
    resolvedGameId = g.id
  } else {
    // If caller provided a gameId, check its kickoff too
    const { data: g, error: gErr } = await sb
      .from('games')
      .select('game_utc')
      .eq('id', resolvedGameId)
      .single()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    if (new Date(g.game_utc) <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  }

  const { data, error } = await sb
    .from('picks')
    .insert({
      league_id: leagueId,
      season,
      week,
      profile_id: profileId,
      team_id: teamId,
      game_id: resolvedGameId,
    })
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // return the new pick id (first row)
  return NextResponse.json({ id: data?.[0]?.id })
}

/**
 * Delete (unpick) a pick
 * - only your own pick
 * - cannot delete after that game's kickoff
 * Expects JSON: { pickId: string }
 */
export async function DELETE(req: NextRequest) {
  const { pickId } = await req.json()
  if (!pickId) return NextResponse.json({ error: 'pickId required' }, { status: 400 })

  const sb = await createClient()
  const { data: userRes, error: uerr } = await sb.auth.getUser()
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })
  if (!userRes?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const profileId = userRes.user.id

  // Load the pick (must be yours)
  const { data: p, error: pErr } = await sb
    .from('picks')
    .select('id, game_id')
    .eq('id', pickId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!p) return NextResponse.json({ ok: true }) // already gone / not yours

  // Fetch kickoff for that game and enforce lock
  if (p.game_id) {
    const { data: g, error: gErr } = await sb
      .from('games')
      .select('game_utc')
      .eq('id', p.game_id)
      .single() // assert exactly one row
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

    const kickoff = new Date(g.game_utc)
    if (kickoff <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  }

  const { error: dErr } = await sb.from('picks').delete().eq('id', pickId)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}


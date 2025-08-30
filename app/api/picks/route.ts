// app/api/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const { leagueId, season, week, teamId, gameId } = await req.json()

  if (!leagueId || !season || !week || !teamId) {
    return NextResponse.json({ error: 'leagueId, season, week, teamId required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: { user }, error: uerr } = await sb.auth.getUser()
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const profileId = user.id

  // must be a league member
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

  // weekly quota: 2
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

  // season reuse forbidden
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

  // figure out the game + lock check
  let gId = gameId as string | undefined
  let kickoff: Date | null = null
  if (!gId) {
    const { data: g, error } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season).eq('week', week)
      .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!g) return NextResponse.json({ error: 'game not found for team' }, { status: 400 })
    gId = g.id
    kickoff = g.game_utc ? new Date(g.game_utc) : null
  } else {
    const { data: g, error } = await sb
      .from('games')
      .select('game_utc')
      .eq('id', gId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    kickoff = g?.game_utc ? new Date(g.game_utc) : null
  }

  if (kickoff && kickoff <= new Date()) {
    return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('picks')
    .insert({
      league_id: leagueId,
      season,
      week,
      profile_id: profileId,
      team_id: teamId,
      game_id: gId || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = await createClient()
  const { data: { user }, error: uerr } = await sb.auth.getUser()
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const profileId = user.id

  // fetch the pick (must belong to user)
  const { data: pick, error: pErr } = await sb
    .from('picks')
    .select('id, game_id')
    .eq('id', id)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!pick) return NextResponse.json({ ok: true }) // nothing to do

  // if the pick has a linked game, block once kickoff has passed
  if (pick.game_id) {
    const { data: g, error: gErr } = await sb
      .from('games')
      .select('game_utc')
      .eq('id', pick.game_id)
      .maybeSingle()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    const kickoff = g?.game_utc ? new Date(g.game_utc) : null
    if (kickoff && kickoff <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  }

  const { error: dErr } = await sb.from('picks').delete().eq('id', id).eq('profile_id', profileId)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}


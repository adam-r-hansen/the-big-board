// app/api/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type LeagueMember = { role: string }
type PickRow = { id: string; team_id: string; game_id: string | null }
type GameRow = { id: string; game_utc: string | null }
type PickWithGame = {
  id: string
  game_id: string | null
  // PostgREST embedding may return object or array depending on relationship detection
  games?: GameRow | GameRow[]
}

export async function POST(req: NextRequest) {
  const { leagueId, season, week, teamId, gameId } = await req.json()
  if (!leagueId || !season || !week || !teamId) {
    return NextResponse.json({ error: 'leagueId, season, week, teamId required' }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const profileId = user.id

  // Must be a league member
  {
    const { data: lm, error } = await sb
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('profile_id', profileId)
      .maybeSingle<LeagueMember>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!lm) return NextResponse.json({ error: 'not a league member' }, { status: 403 })
  }

  // Two picks per week
  {
    const { count, error } = await sb
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('profile_id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if ((count ?? 0) >= 2) return NextResponse.json({ error: 'quota reached (2 picks/week)' }, { status: 400 })
  }

  // No team reuse in season
  {
    const { count, error } = await sb
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId).eq('season', season).eq('profile_id', profileId).eq('team_id', teamId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'team already used this season' }, { status: 400 })
  }

  // Rolling lock: prevent picks after kickoff
  let gId: string | undefined = gameId as string | undefined
  if (!gId) {
    const { data: g, error } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season).eq('week', week)
      .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
      .limit(1).maybeSingle<GameRow & { home_team: string; away_team: string }>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (g) gId = g.id
    if (g?.game_utc && new Date(g.game_utc) <= new Date()) {
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
      game_id: gId || null
    })
    .select('id')
    .single<PickRow>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const profileId = user.id

  // Load pick + embedded game (to check kickoff lock)
  const { data: p, error: pErr } = await sb
    .from('picks')
    .select('id, game_id, games:game_id ( id, game_utc )')
    .eq('id', id)
    .eq('profile_id', profileId) // only allow deleting own pick
    .maybeSingle<PickWithGame>()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!p) return NextResponse.json({ ok: true }) // already gone / harmless

  // games can be object or array — normalize
  const rel = p.games
  let kickoffIso: string | null = null
  if (Array.isArray(rel)) {
    kickoffIso = rel[0]?.game_utc ?? null
  } else if (rel && typeof rel === 'object') {
    kickoffIso = rel.game_utc ?? null
  }

  if (kickoffIso) {
    const kickoff = new Date(kickoffIso)
    if (kickoff <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  }

  const { error: dErr } = await sb.from('picks').delete().eq('id', id).eq('profile_id', profileId)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}


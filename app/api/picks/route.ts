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

  // membership
  const { data: lm, error: lmErr } = await sb
    .from('league_members').select('role')
    .eq('league_id', leagueId).eq('profile_id', profileId).maybeSingle()
  if (lmErr) return NextResponse.json({ error: lmErr.message }, { status: 500 })
  if (!lm) return NextResponse.json({ error: 'not a league member' }, { status: 403 })

  // weekly quota (2)
  const { count: wkCount, error: wkErr } = await sb
    .from('picks').select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('profile_id', profileId)
  if (wkErr) return NextResponse.json({ error: wkErr.message }, { status: 500 })
  if ((wkCount ?? 0) >= 2) return NextResponse.json({ error: 'quota reached (2 picks/week)' }, { status: 400 })

  // no team reuse in season
  const { count: used, error: usedErr } = await sb
    .from('picks').select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId).eq('season', season).eq('profile_id', profileId).eq('team_id', teamId)
  if (usedErr) return NextResponse.json({ error: usedErr.message }, { status: 500 })
  if ((used ?? 0) > 0) return NextResponse.json({ error: 'team already used this season' }, { status: 400 })

  // derive game if needed, and enforce kickoff lock
  let gId: string | null = gameId ?? null
  if (!gId) {
    const { data: g, error: gErr } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season).eq('week', week)
      .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
      .maybeSingle()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    gId = g?.id ?? null
    if (g?.game_utc && new Date(g.game_utc) <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  } else {
    const { data: g, error: gErr } = await sb
      .from('games').select('game_utc').eq('id', gId).maybeSingle()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    if (g?.game_utc && new Date(g.game_utc) <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  }

  const { data, error } = await sb
    .from('picks')
    .insert({ league_id: leagueId, season, week, profile_id: profileId, team_id: teamId, game_id: gId })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = await createClient()
  const { data: { user }, error: uerr } = await sb.auth.getUser()
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // lock check (can’t unpick after kickoff)
  const { data: p, error: pErr } = await sb
    .from('picks')
    .select('id, game_id, games!inner(id, game_utc)')
    .eq('id', id).eq('profile_id', user.id)
    .maybeSingle()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const kickoff = Array.isArray(p?.games) ? p?.games[0]?.game_utc : p?.games?.game_utc
  if (kickoff && new Date(kickoff) <= new Date()) {
    return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
  }

  const { error } = await sb.from('picks').delete().eq('id', id).eq('profile_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

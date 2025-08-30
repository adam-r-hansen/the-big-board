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

  // must be league member
  const { data: lm, error: lmErr } = await sb
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (lmErr) return NextResponse.json({ error: lmErr.message }, { status: 500 })
  if (!lm) return NextResponse.json({ error: 'not a league member' }, { status: 403 })

  // two picks per week
  const { count: countWeek, error: cErr } = await sb
    .from('picks')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('profile_id', profileId)
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if ((countWeek ?? 0) >= 2) return NextResponse.json({ error: 'quota reached (2 picks/week)' }, { status: 400 })

  // no team reuse in season
  const { count: used, error: uErr } = await sb
    .from('picks')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId).eq('season', season).eq('profile_id', profileId).eq('team_id', teamId)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  if ((used ?? 0) > 0) return NextResponse.json({ error: 'team already used this season' }, { status: 400 })

  // rolling lock by kickoff
  let gId = gameId as string | undefined
  if (!gId) {
    const { data: g, error: gErr } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season).eq('week', week)
      .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
      .limit(1).maybeSingle()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    if (g) gId = g.id
    if (g && g.game_utc && new Date(g.game_utc) <= new Date()) {
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Supabase can return array; normalize to single id
  const id = Array.isArray(data) ? data[0]?.id : (data as any)?.id
  return NextResponse.json({ id })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const sb = await createClient()
  const { data: { user }, error: uerr } = await sb.auth.getUser()
  if (uerr) return NextResponse.json({ error: uerr.message }, { status: 500 })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // We must ensure the pick belongs to the user and has not locked
  const { data: p, error: pErr } = await sb
    .from('picks')
    .select('id, profile_id, game_id, games(id, game_utc)')
    .eq('id', id)
    .maybeSingle()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!p) return NextResponse.json({ ok: true }) // already deleted
  if (p.profile_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const kickoffISO = (p as any).games?.game_utc as string | undefined
  if (kickoffISO && new Date(kickoffISO) <= new Date()) {
    return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
  }

  const { error: dErr } = await sb.from('picks').delete().eq('id', id)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}


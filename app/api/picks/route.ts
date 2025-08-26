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

  // Must be a league member
  const { data: lm, error: lmErr } = await sb
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (lmErr) return NextResponse.json({ error: lmErr.message }, { status: 500 })
  if (!lm) return NextResponse.json({ error: 'not a league member' }, { status: 403 })

  // Two picks per week
  const { count: countWeek, error: cErr } = await sb
    .from('picks')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('profile_id', profileId)
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if ((countWeek ?? 0) >= 2) return NextResponse.json({ error: 'quota reached (2 picks/week)' }, { status: 400 })

  // No team reuse in season
  const { count: used, error: uErr } = await sb
    .from('picks')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId).eq('season', season).eq('profile_id', profileId).eq('team_id', teamId)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  if ((used ?? 0) > 0) return NextResponse.json({ error: 'team already used this season' }, { status: 400 })

  // Rolling lock: prevent picks after kickoff
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
    if (g && new Date(g.game_utc) <= new Date()) {
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
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

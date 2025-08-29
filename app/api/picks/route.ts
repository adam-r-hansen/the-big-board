// app/api/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/** Helpers */
async function getAuthedClient() {
  const sb = await createClient()
  const { data: { user }, error } = await sb.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('unauthenticated')
  return { sb, user }
}

async function assertLeagueMember(sb: any, leagueId: string, profileId: string) {
  const { data, error } = await sb
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    const e: any = new Error('not a league member')
    e.status = 403
    throw e
  }
}

async function findGameForTeam(sb: any, season: number, week: number, teamId: string) {
  const { data, error } = await sb
    .from('games')
    .select('id, game_utc, home_team, away_team')
    .eq('season', season).eq('week', week)
    .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}

function isLocked(gameUtc?: string | null) {
  return !!gameUtc && new Date(gameUtc).getTime() <= Date.now()
}

/** POST: create/make a pick */
export async function POST(req: NextRequest) {
  try {
    const { leagueId, season, week, teamId, gameId } = await req.json()

    if (!leagueId || !season || !week || !teamId) {
      return NextResponse.json(
        { error: 'leagueId, season, week, teamId required' },
        { status: 400 }
      )
    }

    const { sb, user } = await getAuthedClient()
    const profileId = user.id
    await assertLeagueMember(sb, leagueId, profileId)

    // Cap: two picks per week
    const { count: weekCount, error: wcErr } = await sb
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId).eq('season', season).eq('week', week).eq('profile_id', profileId)
    if (wcErr) return NextResponse.json({ error: wcErr.message }, { status: 500 })
    if ((weekCount ?? 0) >= 2) {
      return NextResponse.json({ error: 'quota reached (2 picks/week)' }, { status: 400 })
    }

    // Season-wide “already used this team” guard
    const { count: usedCount, error: ucErr } = await sb
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId).eq('season', season).eq('profile_id', profileId).eq('team_id', teamId)
    if (ucErr) return NextResponse.json({ error: ucErr.message }, { status: 500 })
    if ((usedCount ?? 0) > 0) {
      // 409 Conflict: semantic duplicate
      return NextResponse.json({ error: 'team already used this season' }, { status: 409 })
    }

    // Resolve/validate game + kickoff lock
    let gId: string | null = gameId || null
    let kickoff: string | null = null

    if (gId) {
      const { data: g, error: gErr } = await sb.from('games').select('id, game_utc').eq('id', gId).maybeSingle()
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
      if (!g) return NextResponse.json({ error: 'game not found' }, { status: 400 })
      kickoff = g.game_utc
    } else {
      const g = await findGameForTeam(sb, season, week, teamId)
      if (!g) return NextResponse.json({ error: 'game not found for team/week' }, { status: 400 })
      gId = g.id
      kickoff = g.game_utc
    }

    if (isLocked(kickoff)) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 403 })
    }

    // Insert pick
    const { data, error } = await sb
      .from('picks')
      .insert({
        league_id: leagueId,
        season,
        week,
        profile_id: profileId,
        team_id: teamId,
        game_id: gId
      })
      .select('id')
      .single()

    if (error) {
      // If you added a unique index (league_id, profile_id, season, team_id), surface a friendly message
      if ((error.code ?? '').toString() === '23505') {
        return NextResponse.json({ error: 'team already used this season' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (e: any) {
    const status = Number(e?.status) || 500
    return NextResponse.json({ error: e?.message || 'Server error' }, { status })
  }
}

/** DELETE: unpick (toggle off) – only before kickoff */
export async function DELETE(req: NextRequest) {
  try {
    const { leagueId, season, week, teamId, gameId } = await req.json()
    if (!leagueId || !season || !week || !teamId || !gameId) {
      return NextResponse.json(
        { error: 'leagueId, season, week, teamId, gameId required' },
        { status: 400 }
      )
    }

    const { sb, user } = await getAuthedClient()
    const profileId = user.id
    await assertLeagueMember(sb, leagueId, profileId)

    // Kickoff lock
    const { data: g, error: gErr } = await sb.from('games').select('id, game_utc').eq('id', gameId).maybeSingle()
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    if (!g) return NextResponse.json({ error: 'game not found' }, { status: 400 })
    if (isLocked(g.game_utc)) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 403 })
    }

    // Delete the pick (idempotent: if missing, returns ok)
    const { error } = await sb
      .from('picks')
      .delete()
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('week', week)
      .eq('game_id', gameId)
      .eq('team_id', teamId)
      .eq('profile_id', profileId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.status) || 500
    return NextResponse.json({ error: e?.message || 'Server error' }, { status })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createPickInputSchema, deletePickInputSchema } from '@/schemas/domain'
import { firstOrNull } from '@/lib/api/normalize'
import type { Game } from '@/types/domain'

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = createPickInputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 })
  }
  const { leagueId, season, week, teamId, gameId } = parsed.data

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const profileId = user.id

  // Verify membership
  {
    const { data: lm, error } = await sb
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId).eq('profile_id', profileId)
      .limit(1).maybeSingle<{ role: string }>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!lm) return NextResponse.json({ error: 'not in league' }, { status: 403 })
  }

  // Weekly quota (2)
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
  let gId: string | undefined = gameId ?? undefined
  if (!gId) {
    const { data: g, error } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season).eq('week', week)
      .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
      .limit(1).maybeSingle<{ id: string; game_utc: string | null }>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (g) gId = g.id
  }
  if (gId) {
    const { data: g, error } = await sb.from('games').select('id, game_utc').eq('id', gId).limit(1).maybeSingle<Game>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const kickoffIso = g?.game_utc
    if (kickoffIso && new Date(kickoffIso) <= new Date()) {
      return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
    }
  }

  const { data: created, error: cErr } = await sb
    .from('picks')
    .insert([{ league_id: leagueId, season, week, team_id: teamId, profile_id: profileId, game_id: gId ?? null }])
    .select('id').limit(1).maybeSingle<{ id: string }>()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: created?.id })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const parsed = deletePickInputSchema.safeParse({ id })
  if (!parsed.success) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const profileId = user.id

  const { data: p, error: pErr } = await sb
    .from('picks')
    .select('id, game_id, games:game_id ( id, game_utc )')
    .eq('id', parsed.data.id)
    .eq('profile_id', profileId)
    .maybeSingle<{ id: string; game_id: string | null; games?: { id: string; game_utc: string | null } | { id: string; game_utc: string | null }[] }>()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!p) return NextResponse.json({ ok: true })

  const rel = firstOrNull(p.games)
  const kickoffIso = rel?.game_utc ?? null
  if (kickoffIso && new Date(kickoffIso) <= new Date()) {
    return NextResponse.json({ error: 'game is locked (kickoff passed)' }, { status: 400 })
  }

  const { error: dErr } = await sb.from('picks').delete().eq('id', parsed.data.id).eq('profile_id', profileId)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

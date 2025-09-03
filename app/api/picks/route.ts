// app/api/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

async function getClient() {
  // your helper returns a Promise
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

type Body = {
  leagueId?: string
  season?: number
  week?: number
  teamId?: string
  gameId?: string | null
}

// Lock helper — if "games" table exists use it, otherwise skip lock check gracefully.
async function isLocked(supabase: any, gameId?: string | null): Promise<{ locked: boolean; why?: string }> {
  if (!gameId) return { locked: false }
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, game_utc, status')
      .eq('id', gameId)
      .maybeSingle()
    if (error) return { locked: false } // don't 500 on missing table
    const utc = data?.game_utc as string | undefined
    if (utc && new Date(utc) <= new Date()) return { locked: true, why: 'game is locked (kickoff passed)' }
    // also honor explicit status if present
    if ((data?.status || '').toUpperCase() === 'FINAL') return { locked: true, why: 'game is locked (kickoff passed)' }
    return { locked: false }
  } catch {
    return { locked: false }
  }
}

// POST /api/picks  -> { ok: true, id } or 400 with explicit error
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: Body = {}
  try { body = await req.json() } catch {}
  const leagueId = body.leagueId
  const season = body.season
  const week = body.week
  const teamId = body.teamId
  const gameId = body.gameId ?? null

  if (!leagueId || !season || !week || !teamId) {
    return j({ error: 'leagueId, season, week, teamId required' }, 400)
  }

  // 1) Weekly quota = 2
  const { data: weekPicks, error: countErr } = await supabase
    .from('picks')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .eq('season', season)
    .eq('week', week)

  if (countErr) return j({ error: countErr.message }, 400)
  if ((weekPicks?.length ?? 0) >= 2) {
    return j({ error: 'quota reached (2 picks/week)' }, 400)
  }

  // 2) Season prior-week reuse check
  const { data: prior, error: priorErr } = await supabase
    .from('picks')
    .select('id')
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .eq('season', season)
    .lt('week', week)
    .eq('team_id', teamId)
    .limit(1)

  if (priorErr) return j({ error: priorErr.message }, 400)
  if (prior && prior.length > 0) {
    return j({ error: 'team already used in a prior week' }, 400)
  }

  // 3) Lock check iff we have a gameId
  const lock = await isLocked(supabase, gameId)
  if (lock.locked) return j({ error: lock.why }, 400)

  // 4) Insert
  const { data: inserted, error: insErr } = await supabase
    .from('picks')
    .insert({
      league_id: leagueId,
      profile_id: user.id,
      team_id: teamId,
      game_id: gameId, // can be null
      season,
      week,
    })
    .select('id')
    .single()

  if (insErr) return j({ error: insErr.message }, 400)
  return j({ ok: true, id: inserted?.id }, 200)
}

// DELETE /api/picks?id=… (or allow other selectors later)
export async function DELETE(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id')
  if (!pickId) return j({ error: 'id required' }, 400)

  // fetch pick to check lock
  const { data: pickRow, error: pickErr } = await supabase
    .from('picks')
    .select('id, game_id')
    .eq('id', pickId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (pickErr) return j({ error: pickErr.message }, 400)
  if (!pickRow) return j({ ok: true }, 200) // already gone

  const lock = await isLocked(supabase, pickRow.game_id)
  if (lock.locked) return j({ error: lock.why }, 400)

  const { error: delErr } = await supabase
    .from('picks')
    .delete()
    .eq('id', pickId)
    .eq('profile_id', user.id)

  if (delErr) return j({ error: delErr.message }, 400)
  return j({ ok: true }, 200)
}


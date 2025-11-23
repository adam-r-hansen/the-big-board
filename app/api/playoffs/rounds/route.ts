// app/api/playoffs/rounds/route.ts
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
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

/**
 * GET /api/playoffs/rounds?leagueId=xxx
 * Returns all playoff rounds for a league
 */
export async function GET(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')

  if (!leagueId) return j({ error: 'leagueId required' }, 400)

  const { data: rounds, error: roundsErr } = await supabase
    .from('playoff_rounds')
    .select('*')
    .eq('league_id', leagueId)
    .order('week_number', { ascending: true })

  if (roundsErr) return j({ error: roundsErr.message }, 400)

  return j({ rounds: rounds ?? [] }, 200)
}

/**
 * POST /api/playoffs/rounds
 * Body: { leagueId, weekNumber, roundType, status }
 * Creates a new playoff round (admin only)
 */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const leagueId = body.leagueId
  const weekNumber = body.weekNumber
  const roundType = body.roundType
  const status = body.status ?? 'pending'

  if (!leagueId || !weekNumber || !roundType) {
    return j({ error: 'leagueId, weekNumber, and roundType required' }, 400)
  }

  // Validate roundType
  if (!['semifinal', 'championship', 'consolation'].includes(roundType)) {
    return j({ error: 'invalid roundType' }, 400)
  }

  // Validate weekNumber
  if (![17, 18].includes(weekNumber)) {
    return j({ error: 'weekNumber must be 17 or 18' }, 400)
  }

  // Check if user is admin/owner
  const { data: member } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'owner'].includes(member.role)) {
    return j({ error: 'admin access required' }, 403)
  }

  // Create round
  const { data: round, error: insertErr } = await supabase
    .from('playoff_rounds')
    .insert({
      league_id: leagueId,
      week_number: weekNumber,
      round_type: roundType,
      status
    })
    .select()
    .single()

  if (insertErr) return j({ error: insertErr.message }, 400)

  return j({ round }, 201)
}

/**
 * PATCH /api/playoffs/rounds
 * Body: { roundId, status }
 * Updates a playoff round status (admin only)
 */
export async function PATCH(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const roundId = body.roundId
  const status = body.status

  if (!roundId || !status) {
    return j({ error: 'roundId and status required' }, 400)
  }

  // Get round to check league_id
  const { data: round } = await supabase
    .from('playoff_rounds')
    .select('league_id')
    .eq('id', roundId)
    .maybeSingle()

  if (!round) return j({ error: 'round not found' }, 404)

  // Check if user is admin/owner
  const { data: member } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', round.league_id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'owner'].includes(member.role)) {
    return j({ error: 'admin access required' }, 403)
  }

  // Update round
  const { data: updated, error: updateErr } = await supabase
    .from('playoff_rounds')
    .update({ status })
    .eq('id', roundId)
    .select()
    .single()

  if (updateErr) return j({ error: updateErr.message }, 400)

  return j({ round: updated }, 200)
}

// app/api/playoffs/picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type { PlayoffPickRow } from '@/types/tables'

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

// Check if game is locked (started or final)
async function isGameLocked(supabase: any, gameId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('games')
      .select('game_utc, status')
      .eq('id', gameId)
      .maybeSingle()
    
    if (!data) return false
    
    const gameTime = data.game_utc ? new Date(data.game_utc) : null
    if (gameTime && gameTime <= new Date()) return true
    if (data.status?.toUpperCase() === 'FINAL') return true
    
    return false
  } catch {
    return false
  }
}

// Get user's league membership ID
async function getMembershipId(supabase: any, leagueId: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('league_memberships')
    .select('id')
    .eq('league_id', leagueId)
    .eq('profile_id', userId)
    .maybeSingle()
  
  return data?.id ?? null
}

/**
 * GET /api/playoffs/picks
 * Query params: leagueId, roundId (optional)
 * Returns all playoff picks for the user (and optionally other users' picks for availability checking)
 */
export async function GET(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const roundId = searchParams.get('roundId')

  if (!leagueId) return j({ error: 'leagueId required' }, 400)

  // Get user's membership ID
  const membershipId = await getMembershipId(supabase, leagueId, user.id)
  if (!membershipId) return j({ error: 'not a league member' }, 403)

  // Build query
  let query = supabase
    .from('playoff_picks')
    .select(`
      *,
      playoff_rounds!inner(league_id, week_number, round_type, status)
    `)
    .eq('playoff_rounds.league_id', leagueId)

  if (roundId) {
    query = query.eq('playoff_round_id', roundId)
  }

  const { data: picks, error: pickErr } = await query

  if (pickErr) return j({ error: pickErr.message }, 400)

  // Separate user's picks from others (for availability checking)
  const userPicks = (picks ?? []).filter((p: any) => p.league_membership_id === membershipId)
  const otherPicks = (picks ?? []).filter((p: any) => p.league_membership_id !== membershipId)

  return j({ 
    userPicks, 
    otherPicks: otherPicks.map((p: any) => ({ game_id: p.game_id })) // Only expose game_id for availability
  }, 200)
}

/**
 * POST /api/playoffs/picks
 * Body: { roundId, gameId, pickPosition }
 * Creates or updates a playoff pick
 */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const roundId = body.roundId
  const gameId = body.gameId
  const pickPosition = body.pickPosition

  if (!roundId || !gameId || !pickPosition) {
    return j({ error: 'roundId, gameId, and pickPosition required' }, 400)
  }

  // Get round info
  const { data: round, error: roundErr } = await supabase
    .from('playoff_rounds')
    .select('id, league_id, status')
    .eq('id', roundId)
    .maybeSingle()

  if (roundErr || !round) return j({ error: 'round not found' }, 404)
  if (round.status !== 'active') return j({ error: 'round is not active' }, 400)

  // Get user's membership ID
  const membershipId = await getMembershipId(supabase, round.league_id, user.id)
  if (!membershipId) return j({ error: 'not a league member' }, 403)

  // Validation 1: Check if game is locked
  const locked = await isGameLocked(supabase, gameId)
  if (locked) return j({ error: 'game has already started or is final' }, 400)

  // Validation 2: Check if game already picked by another playoff participant
  const { data: otherPicks } = await supabase
    .from('playoff_picks')
    .select('id, league_membership_id')
    .eq('playoff_round_id', roundId)
    .eq('game_id', gameId)

  const pickedByOther = (otherPicks ?? []).some((p: any) => p.league_membership_id !== membershipId)
  if (pickedByOther) return j({ error: 'game already picked by another player' }, 400)

  // Check if user already has a pick for this position
  const { data: existingPick } = await supabase
    .from('playoff_picks')
    .select('id, picked_at, last_changed_at, unlock_time')
    .eq('league_membership_id', membershipId)
    .eq('playoff_round_id', roundId)
    .eq('pick_position', pickPosition)
    .maybeSingle()

  // If updating existing pick
  if (existingPick) {
    // Validation 3: Check 1-per-hour limit
    const lastChange = existingPick.last_changed_at || existingPick.picked_at
    if (lastChange) {
      const hoursSinceChange = (Date.now() - new Date(lastChange).getTime()) / (1000 * 60 * 60)
      if (hoursSinceChange < 1) {
        return j({ error: 'can only change picks once per hour' }, 400)
      }
    }

    // Update existing pick
    const { data: updated, error: updateErr } = await supabase
      .from('playoff_picks')
      .update({ 
        game_id: gameId,
        last_changed_at: new Date().toISOString()
      })
      .eq('id', existingPick.id)
      .select()
      .single()

    if (updateErr) return j({ error: updateErr.message }, 400)
    return j({ pick: updated }, 200)
  }

  // Creating new pick - calculate unlock time based on position
  // For now, we'll set a placeholder unlock_time - this will be calculated properly when we build the unlock schedule logic
  const unlockTime = new Date().toISOString()

  const { data: newPick, error: insertErr } = await supabase
    .from('playoff_picks')
    .insert({
      league_membership_id: membershipId,
      playoff_round_id: roundId,
      game_id: gameId,
      pick_position: pickPosition,
      unlock_time: unlockTime,
      picked_at: new Date().toISOString()
    })
    .select()
    .single()

  if (insertErr) return j({ error: insertErr.message }, 400)
  return j({ pick: newPick }, 201)
}

/**
 * DELETE /api/playoffs/picks
 * Query params: pickId
 * Deletes a playoff pick
 */
export async function DELETE(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('pickId')

  if (!pickId) return j({ error: 'pickId required' }, 400)

  // Verify ownership before deleting
  const { data: pick } = await supabase
    .from('playoff_picks')
    .select('id, league_membership_id, playoff_round_id, last_changed_at, picked_at')
    .eq('id', pickId)
    .maybeSingle()

  if (!pick) return j({ error: 'pick not found' }, 404)

  // Verify user owns this pick
  const { data: membership } = await supabase
    .from('league_memberships')
    .select('id')
    .eq('id', pick.league_membership_id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!membership) return j({ error: 'unauthorized' }, 403)

  // Check 1-per-hour limit
  const lastChange = pick.last_changed_at || pick.picked_at
  if (lastChange) {
    const hoursSinceChange = (Date.now() - new Date(lastChange).getTime()) / (1000 * 60 * 60)
    if (hoursSinceChange < 1) {
      return j({ error: 'can only change picks once per hour' }, 400)
    }
  }

  const { error: delErr } = await supabase
    .from('playoff_picks')
    .delete()
    .eq('id', pickId)

  if (delErr) return j({ error: delErr.message }, 400)
  return j({ ok: true }, 200)
}

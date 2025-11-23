// app/api/playoffs/standings/route.ts
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
 * GET /api/playoffs/standings?roundId=xxx
 * Returns playoff standings for a specific round
 */
export async function GET(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const roundId = searchParams.get('roundId')
  const leagueId = searchParams.get('leagueId')

  if (!roundId && !leagueId) {
    return j({ error: 'roundId or leagueId required' }, 400)
  }

  let query = supabase
    .from('playoff_standings')
    .select(`
      *,
      league_memberships!inner(profile_id, league_id),
      playoff_rounds!inner(week_number, round_type, status, league_id)
    `)

  if (roundId) {
    query = query.eq('playoff_round_id', roundId)
  } else if (leagueId) {
    query = query.eq('playoff_rounds.league_id', leagueId)
  }

  const { data: standings, error: standingsErr } = await query.order('rank', { ascending: true })

  if (standingsErr) return j({ error: standingsErr.message }, 400)

  return j({ standings: standings ?? [] }, 200)
}

/**
 * POST /api/playoffs/standings
 * Body: { roundId, standings: [{ membershipId, rank, totalScore, seed }] }
 * Creates/updates playoff standings (admin only, typically called by transition logic)
 */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const roundId = body.roundId
  const standings = body.standings

  if (!roundId || !Array.isArray(standings)) {
    return j({ error: 'roundId and standings array required' }, 400)
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

  // Insert standings (upsert to handle updates)
  const standingsData = standings.map((s: any) => ({
    playoff_round_id: roundId,
    league_membership_id: s.membershipId,
    rank: s.rank,
    total_score: s.totalScore ?? 0,
    seed: s.seed
  }))

  const { data: created, error: insertErr } = await supabase
    .from('playoff_standings')
    .upsert(standingsData, {
      onConflict: 'playoff_round_id,league_membership_id'
    })
    .select()

  if (insertErr) return j({ error: insertErr.message }, 400)

  return j({ standings: created }, 201)
}

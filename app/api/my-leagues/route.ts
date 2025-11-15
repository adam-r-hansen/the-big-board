import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'cache-control': 'no-store' } }
    )
  }

  // Get all league_memberships for this user
  const { data: memberships, error: membershipError } = await supabase
    .from('league_memberships')
    .select('league_id, role')
    .eq('profile_id', user.id)

  if (membershipError) {
    return NextResponse.json(
      { error: membershipError.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json(
      { leagues: [] },
      { headers: { 'cache-control': 'no-store' } }
    )
  }

  // Get the league IDs
  const leagueIds = memberships.map(m => m.league_id)

  // Fetch the actual league data
  const { data: leagues, error: leaguesError } = await supabase
    .from('leagues')
    .select('id, name, season, created_at')
    .in('id', leagueIds)
    .order('season', { ascending: false })

  if (leaguesError) {
    return NextResponse.json(
      { error: leaguesError.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  // Combine the data - add role to each league
  const leaguesWithRoles = (leagues ?? []).map(league => {
    const membership = memberships.find(m => m.league_id === league.id)
    return {
      id: league.id,
      name: league.name,
      season: league.season,
      role: membership?.role || 'member'
    }
  })

  return NextResponse.json(
    { leagues: leaguesWithRoles },
    { headers: { 'cache-control': 'no-store' } }
  )
}

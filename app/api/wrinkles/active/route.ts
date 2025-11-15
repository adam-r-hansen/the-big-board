import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-clients'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const leagueId = url.searchParams.get('leagueId')
  const season = url.searchParams.get('season')
  const week = url.searchParams.get('week')

  if (!leagueId || !season || !week) {
    return NextResponse.json(
      { error: 'leagueId, season, and week required' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    )
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'cache-control': 'no-store' } }
    )
  }

  const adminSb = createAdminSupabaseClient()
  const { data, error } = await adminSb
    .from('wrinkles')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', parseInt(season))
    .eq('week', parseInt(week))
    .eq('status', 'active')

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { wrinkles: data ?? [] },
    { headers: { 'cache-control': 'no-store' } }
  )
}

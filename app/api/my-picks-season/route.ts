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

  const url = new URL(req.url)
  const leagueId = url.searchParams.get('leagueId')
  const season = url.searchParams.get('season')

  if (!leagueId || !season) {
    return NextResponse.json(
      { error: 'leagueId and season required' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    )
  }

  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .eq('profile_id', user.id)
    .eq('league_id', leagueId)
    .eq('season', parseInt(season))
    .order('week', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { picks: data ?? [] },
    { headers: { 'cache-control': 'no-store' } }
  )
}

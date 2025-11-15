import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await context.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'cache-control': 'no-store' } }
    )
  }

  const url = new URL(req.url)
  const season = url.searchParams.get('season')
  const week = url.searchParams.get('week')

  let query = supabase.from('picks').select('*').eq('league_id', leagueId)

  if (season) query = query.eq('season', parseInt(season))
  if (week) query = query.eq('week', parseInt(week))

  const { data, error } = await query

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

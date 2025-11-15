import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const season = url.searchParams.get('season')
  const week = url.searchParams.get('week')

  if (!season || !week) {
    return NextResponse.json(
      { error: 'season and week required' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    )
  }

  const sb = createAdminSupabaseClient()

  const { data, error } = await sb
    .from('games')
    .select('*')
    .eq('season', parseInt(season))
    .eq('week', parseInt(week))
    .order('game_utc', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { games: data ?? [] },
    { headers: { 'cache-control': 'no-store' } }
  )
}

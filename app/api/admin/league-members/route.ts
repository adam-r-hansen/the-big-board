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

  if (!leagueId) {
    return NextResponse.json(
      { error: 'leagueId required' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    )
  }

  const { data, error } = await supabase
    .from('league_members')
    .select('*, profiles(*)')
    .eq('league_id', leagueId)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { members: data ?? [] },
    { headers: { 'cache-control': 'no-store' } }
  )
}

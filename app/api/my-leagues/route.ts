// app/api/my-leagues/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }

  // Get league ids I belong to
  const { data: mems, error: mErr } = await supabase
    .from('league_memberships')
    .select('league_id')
    .eq('profile_id', user.id)

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }

  const leagueIds = Array.from(new Set((mems ?? []).map(r => r.league_id))).filter(Boolean)
  if (leagueIds.length === 0) {
    return NextResponse.json({ leagues: [] }, { headers: { 'cache-control': 'no-store' } })
  }

  // Fetch leagues (minimal fields the UI needs; add more if your UI expects them)
  const { data: leagues, error: lErr } = await supabase
    .from('leagues')
    .select('id, name, season')
    .in('id', leagueIds)
    .order('name', { ascending: true })

  if (lErr) {
    return NextResponse.json({ error: lErr.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }

  return NextResponse.json({ leagues: leagues ?? [] }, { headers: { 'cache-control': 'no-store' } })
}

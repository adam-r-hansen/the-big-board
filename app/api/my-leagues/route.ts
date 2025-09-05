// app/api/my-leagues/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }

  // Pull leagues by JOINing from memberships. This works even if a separate
  // "select leagues by id" is blocked by RLS, as long as leagues are readable.
  const { data, error } = await supabase
    .from('league_memberships')
    .select(`
      league_id,
      leagues:league_id (
        id,
        name,
        season
      )
    `)
    .eq('profile_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }

  // Dedupe leagues in case of multiple membership rows (role changes, etc.)
  const leaguesMap = new Map<string, { id: string; name: string; season: number }>()
  for (const r of data ?? []) {
    const lg = (r as any).leagues
    if (lg?.id) leaguesMap.set(lg.id, { id: lg.id, name: lg.name, season: lg.season })
  }

  return NextResponse.json(
    { leagues: Array.from(leaguesMap.values()) },
    { headers: { 'cache-control': 'no-store' } }
  )
}

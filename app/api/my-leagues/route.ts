// app/api/my-leagues/route.ts
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

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)
  const uid = auth.user.id

  // 1) Current memberships
  const { data: mems, error: mErr } = await supabase
    .from('league_memberships')
    .select('league_id')
    .eq('profile_id', uid)

  if (mErr) return j({ error: mErr.message }, 400)

  let leagueIds = (mems ?? []).map((m: any) => m.league_id).filter(Boolean)

  // 2) Backfill: if no memberships, infer from past picks (migration helper)
  if (leagueIds.length === 0) {
    const { data: picksLeagues, error: pErr } = await supabase
      .from('picks')
      .select('league_id')
      .eq('profile_id', uid)

    if (!pErr) {
      const inferred = Array.from(new Set((picksLeagues ?? [])
        .map((r: any) => r.league_id)
        .filter(Boolean)))

      // Upsert inferred memberships (ignore errors quietly to avoid blocking)
      if (inferred.length > 0) {
        try {
          await supabase
            .from('league_memberships')
            .upsert(
              inferred.map((lid: string) => ({ league_id: lid, profile_id: uid, role: 'member' })),
              { onConflict: 'league_id,profile_id' }
            )
        } catch { /* ignore */ }

        // Recompute leagueIds to include inferred
        leagueIds = inferred
      }
    }
  }

  if (leagueIds.length === 0) return j({ leagues: [] }, 200)

  // 3) Return only leagues the user belongs to (RLS will also enforce this if enabled)
  const { data: leagues, error: lErr } = await supabase
    .from('leagues')
    .select('id, name, season, created_at')
    .in('id', leagueIds)
    .order('created_at', { ascending: false })

  if (lErr) return j({ error: lErr.message }, 400)
  return j({ leagues: leagues ?? [] }, 200)
}

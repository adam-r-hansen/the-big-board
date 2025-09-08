// app/api/used-teams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type PickRow = {
  team_id: string | null
  league_id?: string | null
  season?: number | null
  week?: number | null
  profile_id?: string | null
}

function jsonNoStore(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  headers.set('pragma', 'no-cache')
  headers.set('expires', '0')
  headers.set('surrogate-control', 'no-store')
  return new NextResponse(JSON.stringify(data), { ...init, headers, status: init.status ?? 200 })
}

export async function GET(req: NextRequest) {
  const sb = await createClient()

  // Auth
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  if (!user) return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })

  // Optional query params: leagueId, season, week
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || undefined
  const seasonParam = searchParams.get('season')
  const weekParam = searchParams.get('week')

  const season = seasonParam && !Number.isNaN(Number(seasonParam)) ? Number(seasonParam) : undefined
  const week = weekParam && !Number.isNaN(Number(weekParam)) ? Number(weekParam) : undefined

  try {
    // Base query
    let q = sb
      .from('picks')
      .select('team_id, league_id, season, week, profile_id')
      .eq('profile_id', user.id)

    if (leagueId) q = q.eq('league_id', leagueId)
    if (typeof season === 'number') q = q.eq('season', season)
    if (typeof week === 'number') q = q.eq('week', week)

    const { data, error } = await q

    if (error) return jsonNoStore({ error: error.message }, { status: 500 })

    const used: string[] = Array.from(
      new Set(
        (data ?? [])
          .map((r: PickRow) => r.team_id)
          .filter((v: string | null): v is string => Boolean(v))
      )
    )

    return jsonNoStore({ used })
  } catch (e: unknown) {
    const msg = (e as any)?.message || 'unexpected error'
    console.error('used-teams error:', msg)
    return jsonNoStore({ error: msg }, { status: 500 })
  }
}

// Some clients may POST to fetch; mirror GET for idempotence
export async function POST(req: NextRequest) {
  return GET(req)
}

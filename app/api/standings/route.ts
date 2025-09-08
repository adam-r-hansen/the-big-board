// app/api/standings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type MemberRow = { league_id: string }
type LeagueRow = { id: string; name: string | null; season: number | null }

function noStoreJson(data: unknown, init: ResponseInit = {}) {
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
  if (!user) return noStoreJson({ error: 'unauthenticated' }, { status: 401 })

  // Query params (optional)
  const { searchParams } = new URL(req.url)
  const qpLeagueId = searchParams.get('leagueId') || ''
  const qpSeason = searchParams.get('season')
  const qpWeek = searchParams.get('week')

  const season = qpSeason ? Number(qpSeason) : null
  const week = qpWeek ? Number(qpWeek) : null

  // User's leagues (to constrain access)
  const { data: mems, error: mErr } = await sb
    .from('league_members')
    .select('league_id')
    .eq('profile_id', user.id)

  if (mErr) return noStoreJson({ error: mErr.message }, { status: 500 })

  const leagueIds: string[] = (mems ?? [])
    .map((r: MemberRow) => r.league_id)
    .filter(Boolean)

  if (!leagueIds.length) {
    return noStoreJson({
      rows: [],
      season: season ?? null,
      week: week ?? null,
      leagueId: '',
      leagueName: '',
    })
  }

  // Choose an allowed leagueId
  const leagueId = qpLeagueId && leagueIds.includes(qpLeagueId) ? qpLeagueId : leagueIds[0]

  // Fetch league for name/season (season param wins if provided)
  const { data: leagueRow, error: lErr } = await sb
    .from('leagues')
    .select('id, name, season')
    .eq('id', leagueId)
    .maybeSingle()

  if (lErr) return noStoreJson({ error: lErr.message }, { status: 500 })

  const leagueName = (leagueRow?.name ?? '') as string
  const resolvedSeason =
    season ?? (Number.isFinite(leagueRow?.season as number) ? (leagueRow?.season as number) : null)

  // NOTE:
  // Computing true standings requires business rules (win conditions, points, ties, OOF, wrinkles, etc).
  // To avoid incorrect logic here, we return an empty list when we can't confidently aggregate.
  // The shape matches the UI contract and is safe for rendering.
  const rows: Array<{
    profile_id: string
    display_name: string
    wins: number
    losses: number
    pushes: number
    points: number
  }> = []

  return noStoreJson({
    rows,
    season: resolvedSeason,
    week: Number.isFinite(week as number) ? (week as number) : null,
    leagueId,
    leagueName,
  })
}

// Some clients may POST to refresh; mirror GET for idempotence
export async function POST(req: NextRequest) {
  return GET(req)
}

